import { collection, doc, getDoc, runTransaction, serverTimestamp, writeBatch, type Transaction, type WriteBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Personnel, RegistrationRequest } from "./types";

export type RosterEntry = Pick<Personnel, "dni" | "firstNames" | "lastNameP" | "lastNameM" | "displayName" | "companies" | "occupation" | "location">;

export function baseSchedule(_entry: Pick<RosterEntry, "dni" | "occupation">) {
  return { scheduleStart: "06:10", scheduleEnd: null, graceMinutes: 0 };
}

const store = () => { if (!db) throw new Error("La conexión no está disponible."); return db; };
const managerUid = () => { const uid = auth?.currentUser?.uid; if (!uid || auth?.currentUser?.isAnonymous) throw new Error("Ingresa como encargado."); return uid; };
const validDni = (dni: string) => /^\d{8}$/.test(dni);

function syncWorkerViews(tx: Transaction, person: Pick<Personnel, "dni" | "displayName" | "active" | "approvedUid" | "scheduleStart" | "scheduleEnd" | "graceMinutes">) {
  tx.set(doc(store(), "workerDirectory", person.dni), {active:person.active,approved:typeof person.approvedUid === "string"});
  tx.set(doc(store(), "workerPanels", person.dni), {dni:person.dni,displayName:person.displayName,active:person.active,scheduleStart:person.scheduleStart,scheduleEnd:person.scheduleEnd??null,graceMinutes:person.graceMinutes});
}

export async function readRosterExcel(file: File): Promise<RosterEntry[]> {
  if (file.size > 6_000_000) throw new Error("El archivo supera el tamaño permitido de 6 MB.");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer() as never);
  const byDni = new Map<string, RosterEntry>();
  for (const [sheetName, company] of [["PERSONAL_OS", "OS"], ["PERSONAL_SLI", "SLI"]] as const) {
    const sheet = book.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Falta la hoja ${sheetName}.`);
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const value = (col: number) => row.getCell(col).text.trim().replace(/\s+/g, " ");
      const dni = value(2);
      const rawOccupation = value(6).toUpperCase();
      if (!validDni(dni) || !/(CONDUCTOR|AUXILIAR)/.test(rawOccupation) || value(8).toUpperCase() !== "ACTIVO") return;
      const occupation = rawOccupation.includes("CONDUCTOR") ? "CONDUCTOR DE CAMION"
        : "AUXILIAR DE TRANSPORTE";
      const firstNames = value(5); const lastNameP = value(3); const lastNameM = value(4);
      if (!firstNames || !lastNameP) return;
      const existing = byDni.get(dni);
      if (existing) {
        if (existing.firstNames !== firstNames || existing.lastNameP !== lastNameP || existing.lastNameM !== lastNameM || existing.occupation !== occupation) {
          throw new Error(`El DNI ${dni} tiene datos diferentes entre las hojas OS y SLI. Corrige esa fila antes de importar.`);
        }
        if (!existing.companies.includes(company)) existing.companies.push(company);
        return;
      }
      byDni.set(dni, { dni, firstNames, lastNameP, lastNameM,
        displayName: [firstNames, lastNameP, lastNameM].filter(Boolean).join(" "),
        companies: [company], occupation, location: value(7) });
    });
  }
  if (byDni.size === 0) throw new Error("No se encontraron conductores o auxiliares con DNI válido.");
  return [...byDni.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

export async function savePersonnel(entry: RosterEntry & {
  active: boolean; scheduleStart: string; scheduleEnd?: string | null; graceMinutes: number; contactPhone?: string; contactEmail?: string;
}) {
  const uid = managerUid();
  if (!validDni(entry.dni) || !entry.firstNames.trim() || !entry.lastNameP.trim() ||
    !entry.companies.length || !entry.companies.every(c => c === "OS" || c === "SLI") ||
    !["CONDUCTOR DE CAMION", "AUXILIAR DE TRANSPORTE", "COORDINADOR", "MONITOREO"].includes(entry.occupation) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.scheduleStart) ||
    (entry.scheduleEnd != null && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.scheduleEnd) || entry.scheduleEnd <= entry.scheduleStart)) ||
    !Number.isInteger(entry.graceMinutes) || entry.graceMinutes < 0 || entry.graceMinutes > 120) {
    throw new Error("Revisa los datos, horario y tolerancia.");
  }
  const ref = doc(store(), "personnel", entry.dni);
  await runTransaction(store(), async batch => {
  const existing = await batch.get(ref);
  const auditRef = doc(collection(store(), "audit"));
  const data = {
    dni: entry.dni, firstNames: entry.firstNames.trim(), lastNameP: entry.lastNameP.trim(), lastNameM: entry.lastNameM.trim(),
    displayName: [entry.firstNames, entry.lastNameP, entry.lastNameM].filter(Boolean).join(" ").trim(),
    companies: entry.companies, occupation: entry.occupation.trim(), location: entry.location.trim(),
    active: entry.active, scheduleStart: entry.scheduleStart, scheduleEnd: entry.scheduleEnd || null, graceMinutes: entry.graceMinutes,
    contactPhone: entry.contactPhone?.trim() ?? "", contactEmail: entry.contactEmail?.trim().toLowerCase() ?? "",
    approvedUid: existing.data()?.approvedUid ?? null, updatedAt: serverTimestamp(), updatedBy: uid,
    lastAuditId: auditRef.id
  };
  batch.set(ref, { ...data, ...(existing.exists() ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
  syncWorkerViews(batch, data);
  batch.set(auditRef, { action: "roster_upsert", actorId: uid, targetId: entry.dni, at: serverTimestamp() });
  });
}

export function rosterChanged(entry: RosterEntry, current?: Personnel) {
  return !current || ["firstNames", "lastNameP", "lastNameM", "displayName", "occupation", "location"].some(key => entry[key as keyof RosterEntry] !== current[key as keyof Personnel])
    || [...entry.companies].sort().join("/") !== [...current.companies].sort().join("/");
}

export async function importRoster(entries: RosterEntry[], onProgress?: (done: number) => void) {
  const uid = managerUid();
  let done = 0, changed = 0;
  for (const entry of entries) {
    const didChange = await runTransaction(store(), async tx => {
      const ref = doc(store(), "personnel", entry.dni);
      const snapshot = await tx.get(ref);
      const current = snapshot.exists() ? snapshot.data() as Personnel : undefined;
      if (!rosterChanged(entry, current)) return false;
      const auditRef = doc(collection(store(), "audit"));
      const update = { ...entry, updatedAt: serverTimestamp(), updatedBy: uid, lastAuditId: auditRef.id };
      if (current) tx.update(ref, update);
      else tx.set(ref, { ...update, ...baseSchedule(entry), active: true, approvedUid: null, contactPhone: "", contactEmail: "", createdAt: serverTimestamp() });
      syncWorkerViews(tx, current ? {...current,...entry} : {...entry,...baseSchedule(entry),active:true,approvedUid:null});
      tx.set(auditRef, { action: "roster_upsert", actorId: uid, targetId: entry.dni, at: serverTimestamp() });
      return true;
    });
    if (didChange) changed++;
    onProgress?.(++done);
  }
  return { changed, unchanged: entries.length - changed };
}

export async function approveRegistration(request: RegistrationRequest, person: Personnel) {
  const uid = managerUid();
  await runTransaction(store(), async tx => {
    const personRef = doc(store(), "personnel", person.dni);
    const requestRef = doc(store(), "registrationRequests", request.id);
    const profileRef = doc(store(), "users", request.id);
    const auditRef = doc(collection(store(), "audit"));
    const [currentPerson, currentRequest, currentProfile] = await Promise.all([
      tx.get(personRef), tx.get(requestRef), tx.get(profileRef)
    ]);
    const roster = currentPerson.data() as Personnel | undefined;
    const pending = currentRequest.data() as RegistrationRequest | undefined;
    if (!roster?.active || roster.approvedUid || pending?.status !== "pendiente" || pending.dni !== person.dni || currentProfile.exists()) {
      throw new Error("La solicitud cambió o la persona ya no está activa.");
    }
    tx.update(personRef, { approvedUid: request.id, contactPhone: pending.contactPhone,
      contactEmail: pending.contactEmail, updatedAt: serverTimestamp(), updatedBy: uid, lastAuditId: auditRef.id });
    syncWorkerViews(tx, {...roster, approvedUid:request.id});
    tx.set(profileRef, { personnelId: person.dni, displayName: roster.displayName, role: "trabajador",
      active: true, scheduleStart: roster.scheduleStart, graceMinutes: roster.graceMinutes,
      createdAt: serverTimestamp(), approvedBy: uid });
    tx.update(requestRef, { status: "aprobada", resolvedAt: serverTimestamp(), resolvedBy: uid, resolutionNote: "Aprobado", lastAuditId: auditRef.id });
    tx.set(auditRef, { action: "registration_approved", actorId: uid, targetId: request.id, at: serverTimestamp() });
  });
}

export async function rejectRegistration(request: RegistrationRequest, note: string) {
  const uid = managerUid();
  if (!note.trim()) throw new Error("Escribe un motivo breve.");
  const ref = doc(store(), "registrationRequests", request.id);
  const auditRef = doc(collection(store(), "audit"));
  const batch = writeBatch(store());
  batch.update(ref, { status: "rechazada", resolvedAt: serverTimestamp(), resolvedBy: uid, resolutionNote: note.trim(), lastAuditId: auditRef.id });
  batch.set(auditRef, { action: "registration_rejected", actorId: uid, targetId: request.id, at: serverTimestamp() });
  await batch.commit();
}

export async function removeWorkerAccess(person: Personnel) {
  const uid = managerUid();
  if (!person.approvedUid) throw new Error("Esta persona no tiene un dispositivo aprobado.");
  await runTransaction(store(), async tx => {
    const personRef = doc(store(), "personnel", person.dni);
    const current = await tx.get(personRef);
    const roster = current.data() as Personnel | undefined;
    if (!roster || !roster.approvedUid || roster.approvedUid !== person.approvedUid || !roster.lastAuditId) {
      throw new Error("El acceso cambió. Actualiza el panel y vuelve a intentarlo.");
    }
    const approvedUid = roster.approvedUid;
    const userRef = doc(store(), "users", approvedUid);
    const requestRef = doc(store(), "registrationRequests", approvedUid);
    const [profile, request] = await Promise.all([tx.get(userRef), tx.get(requestRef)]);
    if (!profile.exists() || profile.data().personnelId !== person.dni ||
      (request.exists() && (request.data().dni !== person.dni || request.data().status !== "aprobada"))) {
      throw new Error("Los datos de acceso no coinciden. Consulta al administrador del proyecto.");
    }
    const auditId = `access_remove_${roster.lastAuditId}`;
    tx.update(personRef, { approvedUid: null, updatedAt: serverTimestamp(), updatedBy: uid, lastAuditId: auditId });
    syncWorkerViews(tx, {...roster, approvedUid:null});
    tx.delete(userRef);
    if (request.exists()) tx.delete(requestRef);
    tx.set(doc(store(), "audit", auditId), { action: "worker_access_removed", actorId: uid, targetId: person.dni, at: serverTimestamp() });
  });
}

export async function deletePersonnel(person: Personnel) {
  const uid = managerUid();
  await runTransaction(store(), async tx => {
    const personRef = doc(store(), "personnel", person.dni);
    const current = await tx.get(personRef);
    const roster = current.data() as Personnel | undefined;
    if (!roster || roster.active || roster.approvedUid || !roster.lastAuditId) {
      throw new Error("Primero da de baja a la persona y elimina su acceso aprobado.");
    }
    const auditId = `roster_delete_${roster.lastAuditId}`;
    tx.delete(personRef);
    tx.delete(doc(store(), "workerDirectory", person.dni));
    tx.delete(doc(store(), "workerPanels", person.dni));
    tx.set(doc(store(), "audit", auditId), { action: "roster_delete", actorId: uid, targetId: person.dni, at: serverTimestamp() });
  });
}

// One user action runs the existing audited baja, revocation and deletion stages.
// Each stage rechecks current server data; a failure leaves access blocked and is retryable.
export async function removePersonnel(person: Personnel) {
  const uid = managerUid();
  const ref = doc(store(), "personnel", person.dni);
  const current = await runTransaction(store(), async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const roster = { id: snap.id, ...snap.data() } as Personnel;
    if (!roster.active) return roster;
    const auditRef = doc(collection(store(), "audit"));
    tx.update(ref, { active: false, updatedAt: serverTimestamp(), updatedBy: uid, lastAuditId: auditRef.id });
    syncWorkerViews(tx, { ...roster, active: false });
    tx.set(auditRef, { action: "roster_upsert", actorId: uid, targetId: person.dni, at: serverTimestamp() });
    return { ...roster, active: false, lastAuditId: auditRef.id };
  });
  if (!current) return;
  if (current.approvedUid) await removeWorkerAccess(current);
  const latest = await getDoc(ref);
  if (latest.exists()) await deletePersonnel({ id: latest.id, ...latest.data() } as Personnel);
}
