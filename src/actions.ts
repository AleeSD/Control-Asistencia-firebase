import { collection, doc, getDoc, runTransaction, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { MarkLocation, MarkType, Profile } from "./types";

const database = () => { if (!db) throw new Error("Firebase no está configurado."); return db; };
const identity = () => {
  const user = auth?.currentUser;
  if (!user?.email || !(user.providerData.some(provider => provider.providerId === "password") || (user.emailVerified && user.providerData.some(provider => provider.providerId === "google.com")))) throw new Error("Ingresa con tu cuenta autorizada.");
  return { uid: user.uid, email: user.email.toLowerCase() };
};
const todayKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const requireProfile = async (role?: "encargado" | "staff") => {
  const { uid } = identity();
  const snap = await getDoc(doc(database(), "users", uid));
  const profile = snap.data() as Profile | undefined;
  if (!profile?.active || (role && (role === "staff" ? !["encargado","monitor"].includes(profile.role) : profile.role !== role))) throw new Error("Tu cuenta no tiene permiso para esta acción.");
  return { uid, profile };
};
const validMark = (value: unknown): MarkType => {
  if (value !== "entrada" && value !== "salida") throw new Error("Tipo de marcación no válido.");
  return value;
};

export async function call<T = unknown>(name: string, raw?: unknown): Promise<T> {
  const data = (raw ?? {}) as Record<string, unknown>;
  const store = database();
  const { uid, email } = identity();

  if (name === "claimAccess") {
    if (auth?.currentUser?.providerData.some(provider => provider.providerId === "password")) {
      const profile = (await getDoc(doc(store,"users",uid))).data();
      if (!profile?.active || profile.role !== "monitor" || profile.authMethod !== "password" || profile.email !== email) throw new Error("Esta cuenta no tiene acceso de monitoreo.");
      return {ok:true} as T;
    }
    await runTransaction(store, async tx => {
      const userRef = doc(store, "users", uid);
      const inviteRef = doc(store, "invites", email);
      const [existing, invite] = await Promise.all([tx.get(userRef), tx.get(inviteRef)]);
      if (existing.exists()) return;
      const invited = invite.data();
      if (!invited?.active) throw new Error("Solicita acceso al encargado.");
      const auditRef = doc(store, "audit", `claim_${uid}`);
      tx.set(userRef, {
        email, displayName: invited.displayName, role: invited.role, active: true,
        scheduleStart: invited.scheduleStart, graceMinutes: invited.graceMinutes,
        createdAt: serverTimestamp(), invitedBy: invited.invitedBy
      });
      tx.set(auditRef, { action: "claim_access", actorId: uid, targetId: uid, at: serverTimestamp() });
    });
    return { ok: true } as T;
  }

  if (name === "inviteUser") {
    await requireProfile("encargado");
    const invitedEmail = String(data.email ?? "").trim().toLowerCase();
    const displayName = String(data.displayName ?? "").trim();
    const role = data.role;
    const scheduleStart = String(data.scheduleStart ?? "");
    const graceMinutes = Number(data.graceMinutes);
    if (!(role === "monitor" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/ : /^[^\s@]+@(gmail|googlemail)\.com$/).test(invitedEmail) || !displayName || displayName.length > 100 ||
      (role !== "trabajador" && role !== "encargado" && role !== "monitor") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart) ||
      !Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) throw new Error("Revisa los datos de la invitación.");
    const batch = writeBatch(store);
    batch.set(doc(store, "invites", invitedEmail), { email: invitedEmail, displayName, role, scheduleStart, graceMinutes, active: true, invitedBy: uid, createdAt: serverTimestamp() });
    batch.set(doc(store, "audit", `invite_${invitedEmail}`), { action: "invite_user", actorId: uid, targetId: invitedEmail, at: serverTimestamp() });
    await batch.commit();
    return { ok: true } as T;
  }

  if (name === "updateUser") {
    await requireProfile("encargado");
    const targetUid = String(data.uid ?? "");
    const scheduleStart = String(data.scheduleStart ?? "");
    const graceMinutes = Number(data.graceMinutes);
    const active = data.active;
    if (!targetUid || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleStart) || !Number.isInteger(graceMinutes) ||
      graceMinutes < 0 || graceMinutes > 120 || typeof active !== "boolean") throw new Error("Revisa el horario y el estado.");
    if (targetUid === uid && !active) throw new Error("No puedes desactivar tu cuenta.");
    const auditRef = doc(collection(store, "audit"));
    const batch = writeBatch(store);
    batch.update(doc(store, "users", targetUid), { scheduleStart, graceMinutes, active, updatedAt: serverTimestamp(), updatedBy: uid, lastAuditId: auditRef.id });
    batch.set(auditRef, { action: "update_user", actorId: uid, targetId: targetUid, at: serverTimestamp() });
    await batch.commit();
    return { ok: true } as T;
  }

  if (name === "markAttendance") {
    const { profile } = await requireProfile();
    const type = validMark(data.type);
    const location = data.location as MarkLocation | undefined;
    if (location?.status !== "captured" || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) ||
      !Number.isFinite(location.accuracyMeters)) throw new Error("La ubicación es obligatoria para marcar.");
    const dayKey = todayKey();
    const markId = `${uid}_${dayKey}_${type}`;
    const batch = writeBatch(store);
    batch.set(doc(store, "marks", markId), {
      userId: uid, displayName: profile.displayName, type, dayKey,
      occurredAt: serverTimestamp(), scheduleStart: profile.scheduleStart,
      scheduleEnd: profile.scheduleEnd ?? null, graceMinutes: profile.graceMinutes, source: "web", location
    });
    batch.set(doc(store, "audit", `mark_${markId}`), { action: "mark_attendance", actorId: uid, targetId: markId, at: serverTimestamp() });
    await batch.commit();
    return { ok: true } as T;
  }

  if (name === "submitIncident") {
    const { profile } = await requireProfile();
    const dayKey = String(data.dayKey ?? "");
    const type = validMark(data.type);
    const reason = String(data.reason ?? "").trim();
    const proposedAt = new Date(String(data.proposedAt ?? ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || reason.length < 5 || reason.length > 1000 ||
      Number.isNaN(proposedAt.getTime()) || todayKey(proposedAt) !== dayKey || proposedAt.getTime() > Date.now() ||
      Date.now() - proposedAt.getTime() > 90 * 86400000) throw new Error("Revisa la fecha, hora y motivo. Se permiten los últimos 90 días.");
    const markId = `${uid}_${dayKey}_${type}`;
    const mark = await getDoc(doc(store, "marks", markId));
    const ref = doc(collection(store, "incidents"));
    const batch = writeBatch(store);
    batch.set(ref, { userId: uid, displayName: profile.displayName, dayKey, type, markId: mark.exists() ? markId : null,
      proposedAt: Timestamp.fromDate(proposedAt), reason, status: "pendiente", createdAt: serverTimestamp() });
    batch.set(doc(store, "audit", `incident_${ref.id}`), { action: "submit_incident", actorId: uid, targetId: ref.id, at: serverTimestamp() });
    await batch.commit();
    return { ok: true } as T;
  }

  if (name === "resolveIncident") {
    await requireProfile("staff");
    const id = String(data.id ?? "");
    const decision = data.decision;
    const note = String(data.note ?? "").trim();
    if (!id || (decision !== "aprobar" && decision !== "rechazar") || !note || note.length > 500) throw new Error("Revisa la decisión y la nota.");
    await runTransaction(store, async tx => {
      const incidentRef = doc(store, "incidents", id);
      const incident = await tx.get(incidentRef);
      if (!incident.exists() || incident.data().status !== "pendiente") throw new Error("La incidencia ya fue resuelta o no existe.");
      const item = incident.data();
      const adjustmentRef = doc(store, "adjustments", `${item.personnelId ?? item.userId}_${item.dayKey}_${item.type}`);
      if (decision === "aprobar" && (await tx.get(adjustmentRef)).exists()) throw new Error("Ya existe una corrección aprobada para esa marcación.");
      tx.update(incidentRef, { status: decision === "aprobar" ? "aprobada" : "rechazada", resolvedBy: uid,
        resolutionNote: note, resolvedAt: serverTimestamp() });
      if (decision === "aprobar") tx.set(adjustmentRef, {
        incidentId: id, userId: item.userId, dayKey: item.dayKey, type: item.type,
        ...(item.personnelId ? { personnelId: item.personnelId } : {}),
        originalMarkId: item.markId, correctedAt: item.proposedAt,
        reason: item.reason, approvedBy: uid, approvalNote: note, approvedAt: serverTimestamp()
      });
      tx.set(doc(store, "audit", `resolve_${id}`), { action: "resolve_incident", actorId: uid, targetId: id, at: serverTimestamp() });
    });
    return { ok: true } as T;
  }

  throw new Error("Acción no reconocida.");
}
