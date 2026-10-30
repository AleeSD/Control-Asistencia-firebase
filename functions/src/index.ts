import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const options = { region: "us-central1", maxInstances: 10 } as const;
type Role = "trabajador" | "encargado";
type MarkType = "entrada" | "salida";

function requireGoogle(request: { auth?: { uid: string; token: Record<string, unknown> } }) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión con Google.");
  const email = request.auth.token.email;
  const provider = (request.auth.token.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (provider !== "google.com" || request.auth.token.email_verified !== true || typeof email !== "string" || !/@(gmail|googlemail)\.com$/i.test(email)) {
    throw new HttpsError("permission-denied", "Usa una cuenta Gmail personal verificada.");
  }
  return { uid: request.auth.uid, email: email.toLowerCase() };
}

async function requireProfile(request: { auth?: { uid: string; token: Record<string, unknown> } }, role?: Role) {
  const identity = requireGoogle(request);
  const snap = await db.doc(`users/${identity.uid}`).get();
  const profile = snap.data();
  if (!profile?.active || profile.email !== identity.email) throw new HttpsError("permission-denied", "Tu cuenta no está habilitada.");
  if (role && profile.role !== role) throw new HttpsError("permission-denied", "No tienes permiso para esta acción.");
  return { ...identity, profile };
}

function text(value: unknown, name: string, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpsError("invalid-argument", `${name} no es válido.`);
  }
  return value.trim();
}

function limaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const part = (key: string) => parts.find((item) => item.type === key)?.value ?? "";
  return { dayKey: `${part("year")}-${part("month")}-${part("day")}`, minute: Number(part("hour")) * 60 + Number(part("minute")) };
}

function validDay(day: unknown) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new HttpsError("invalid-argument", "Fecha no válida.");
  return day;
}

function validMarkType(value: unknown): MarkType {
  if (value !== "entrada" && value !== "salida") throw new HttpsError("invalid-argument", "Tipo de marcación no válido.");
  return value;
}

function audit(action: string, actorId: string, targetId: string, details: Record<string, unknown>) {
  return { action, actorId, targetId, details, at: FieldValue.serverTimestamp() };
}

export const claimAccess = onCall(options, async (request) => {
  const { uid, email } = requireGoogle(request);
  const userRef = db.doc(`users/${uid}`);
  const inviteRef = db.doc(`invites/${email}`);
  await db.runTransaction(async (tx) => {
    const [existing, invite] = await Promise.all([tx.get(userRef), tx.get(inviteRef)]);
    if (existing.exists) return;
    if (!invite.exists || invite.data()?.active !== true) throw new HttpsError("permission-denied", "Solicita acceso al encargado.");
    const data = invite.data()!;
    tx.create(userRef, {
      email, displayName: data.displayName, role: data.role, active: true,
      scheduleStart: data.scheduleStart, graceMinutes: data.graceMinutes,
      createdAt: FieldValue.serverTimestamp(), invitedBy: data.invitedBy
    });
    tx.update(inviteRef, { claimedBy: uid, claimedAt: FieldValue.serverTimestamp(), active: false });
    tx.create(db.collection("audit").doc(), audit("claim_access", uid, uid, { email }));
  });
  return { ok: true };
});

export const inviteUser = onCall(options, async (request) => {
  const { uid } = await requireProfile(request, "encargado");
  const email = text(request.data?.email, "Correo", 254).toLowerCase();
  if (!/^[^\s@]+@(gmail|googlemail)\.com$/.test(email)) throw new HttpsError("invalid-argument", "Usa un correo Gmail personal.");
  const displayName = text(request.data?.displayName, "Nombre", 100);
  const role = request.data?.role;
  if (role !== "trabajador" && role !== "encargado") throw new HttpsError("invalid-argument", "Rol no válido.");
  const scheduleStart = text(request.data?.scheduleStart, "Horario", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart)) throw new HttpsError("invalid-argument", "Horario no válido.");
  const graceMinutes = Number(request.data?.graceMinutes);
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) throw new HttpsError("invalid-argument", "Tolerancia no válida.");
  let existingUid: string | undefined;
  try { existingUid = (await getAuth().getUserByEmail(email)).uid; } catch (error: unknown) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  if (existingUid) {
    const profile = await db.doc(`users/${existingUid}`).get();
    if (profile.exists) throw new HttpsError("already-exists", "Esta cuenta ya tiene un perfil. Usa la edición de usuarios.");
  }
  await db.doc(`invites/${email}`).set({ email, displayName, role, scheduleStart, graceMinutes, active: true, invitedBy: uid, createdAt: FieldValue.serverTimestamp() });
  await db.collection("audit").add(audit("invite_user", uid, email, { role, scheduleStart, graceMinutes }));
  return { ok: true };
});

export const updateUser = onCall(options, async (request) => {
  const { uid } = await requireProfile(request, "encargado");
  const targetUid = text(request.data?.uid, "Usuario", 128);
  const targetRef = db.doc(`users/${targetUid}`);
  const snap = await targetRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "No se encontró el usuario.");
  const scheduleStart = text(request.data?.scheduleStart, "Horario", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart)) throw new HttpsError("invalid-argument", "Horario no válido.");
  const graceMinutes = Number(request.data?.graceMinutes);
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) throw new HttpsError("invalid-argument", "Tolerancia no válida.");
  const active = request.data?.active;
  if (typeof active !== "boolean") throw new HttpsError("invalid-argument", "Estado no válido.");
  if (targetUid === uid && !active) throw new HttpsError("failed-precondition", "No puedes desactivar tu propia cuenta.");
  const batch = db.batch();
  batch.update(targetRef, { scheduleStart, graceMinutes, active, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
  batch.create(db.collection("audit").doc(), audit("update_user", uid, targetUid, { scheduleStart, graceMinutes, active }));
  await batch.commit();
  return { ok: true };
});

export const markAttendance = onCall(options, async (request) => {
  const { uid, profile } = await requireProfile(request);
  const type = validMarkType(request.data?.type);
  const now = new Date();
  const { dayKey, minute } = limaParts(now);
  const ref = db.doc(`marks/${uid}_${dayKey}_${type}`);
  const entryRef = db.doc(`marks/${uid}_${dayKey}_entrada`);
  const [hour, minutes] = String(profile.scheduleStart ?? "08:00").split(":").map(Number);
  const grace = Number(profile.graceMinutes ?? 0);
  const lateMinutes = type === "entrada" ? Math.max(0, minute - (hour * 60 + minutes + grace)) : 0;
  await db.runTransaction(async (tx) => {
    const [existing, entry] = await Promise.all([tx.get(ref), type === "salida" ? tx.get(entryRef) : Promise.resolve(null)]);
    if (existing.exists) throw new HttpsError("already-exists", `La ${type} de hoy ya fue registrada.`);
    if (type === "salida" && !entry?.exists) throw new HttpsError("failed-precondition", "Registra la entrada antes de la salida.");
    tx.create(ref, {
      userId: uid, displayName: profile.displayName, type, dayKey,
      occurredAt: Timestamp.fromDate(now), scheduleStart: profile.scheduleStart,
      graceMinutes: grace, lateMinutes, status: type === "entrada" ? (lateMinutes > 0 ? "tarde" : "puntual") : "registrada",
      source: "web"
    });
    tx.create(db.collection("audit").doc(), audit("mark_attendance", uid, ref.id, { type, dayKey, lateMinutes }));
  });
  return { ok: true, dayKey, type, lateMinutes };
});

export const submitIncident = onCall(options, async (request) => {
  const { uid, profile } = await requireProfile(request);
  const dayKey = validDay(request.data?.dayKey);
  const type = validMarkType(request.data?.type);
  const reason = text(request.data?.reason, "Motivo", 1000);
  const proposedAt = new Date(request.data?.proposedAt);
  if (Number.isNaN(proposedAt.getTime()) || limaParts(proposedAt).dayKey !== dayKey || proposedAt.getTime() > Date.now() || Date.now() - proposedAt.getTime() > 90 * 86400000) {
    throw new HttpsError("invalid-argument", "La hora propuesta debe corresponder a una fecha de los últimos 90 días.");
  }
  const markId = `${uid}_${dayKey}_${type}`;
  const mark = await db.doc(`marks/${markId}`).get();
  const ref = db.collection("incidents").doc();
  const batch = db.batch();
  batch.create(ref, {
    userId: uid, displayName: profile.displayName, dayKey, type, markId: mark.exists ? markId : null,
    proposedAt: Timestamp.fromDate(proposedAt), reason, status: "pendiente", createdAt: FieldValue.serverTimestamp()
  });
  batch.create(db.collection("audit").doc(), audit("submit_incident", uid, ref.id, { dayKey, type, markId: mark.exists ? markId : null }));
  await batch.commit();
  return { ok: true, id: ref.id };
});

export const resolveIncident = onCall(options, async (request) => {
  const { uid } = await requireProfile(request, "encargado");
  const id = text(request.data?.id, "Incidencia", 128);
  const decision = request.data?.decision;
  if (decision !== "aprobar" && decision !== "rechazar") throw new HttpsError("invalid-argument", "Decisión no válida.");
  const note = text(request.data?.note, "Nota", 500);
  const ref = db.doc(`incidents/${id}`);
  await db.runTransaction(async (tx) => {
    const incident = await tx.get(ref);
    if (!incident.exists) throw new HttpsError("not-found", "No se encontró la incidencia.");
    const data = incident.data()!;
    if (data.status !== "pendiente") throw new HttpsError("failed-precondition", "Esta incidencia ya fue resuelta.");
    if (decision === "aprobar") {
      const adjustmentRef = db.doc(`adjustments/${data.userId}_${data.dayKey}_${data.type}`);
      if ((await tx.get(adjustmentRef)).exists) throw new HttpsError("already-exists", "Ya existe una corrección aprobada para esa marcación.");
      tx.create(adjustmentRef, {
        incidentId: id, userId: data.userId, dayKey: data.dayKey, type: data.type,
        originalMarkId: data.markId, correctedAt: data.proposedAt,
        reason: data.reason, approvedBy: uid, approvalNote: note, approvedAt: FieldValue.serverTimestamp()
      });
    }
    tx.update(ref, { status: decision === "aprobar" ? "aprobada" : "rechazada", resolvedBy: uid, resolutionNote: note, resolvedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection("audit").doc(), audit("resolve_incident", uid, id, { decision, note }));
  });
  return { ok: true };
});
