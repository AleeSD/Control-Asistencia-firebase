import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import ts from "typescript";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where, orderBy, limit, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";

let env;
const token = (email) => ({ email, email_verified: true, firebase: { sign_in_provider: "google.com" } });
const localDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const workerId = "worker-test";
const managerId = "manager-test";
const workerEmail = "worker.test@gmail.com";
const managerEmail = "manager.test@gmail.com";
const privateManagerId = "private-manager-test";
const privateManagerEmail = "private.manager@gmail.com";
const corporateEmail = "operaciones4@oslogisticsperu.com";
const anonymousToken = { firebase: { sign_in_provider: "anonymous" } };
const person = (dni, extras = {}) => ({
  dni, firstNames: "Persona", lastNameP: "Prueba", lastNameM: "OS", displayName: "Persona Prueba OS",
  companies: ["OS"], occupation: "CONDUCTOR DE CAMION", location: "LIMA", active: true,
  scheduleStart: "08:00", graceMinutes: 10, approvedUid: null, contactPhone: "", contactEmail: "",
  createdAt: Timestamp.now(), updatedAt: Timestamp.now(), updatedBy: managerId, lastAuditId: "seed", ...extras
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-os-logistics", firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") }
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await setDoc(doc(store, "users", workerId), { email: workerEmail, displayName: "Trabajador Prueba", role: "trabajador", active: true, scheduleStart: "08:00", graceMinutes: 10 });
    await setDoc(doc(store, "users", managerId), { email: managerEmail, displayName: "Encargado Prueba", role: "encargado", active: true, scheduleStart: "08:00", graceMinutes: 10 });
    await setDoc(doc(store, "users", privateManagerId), { email: corporateEmail, displayName: "Encargado Principal", role: "encargado", active: true, scheduleStart: "08:00", graceMinutes: 10 });
    await setDoc(doc(store, "privateIdentities", privateManagerId), { email: privateManagerEmail });
  });
});
after(async () => { if (env) await env.cleanup(); });

test("consultas optimizadas conservan permisos y reportes de más de 500 marcas", async () => {
  const dni = "87650001", uid = "optimized-worker";
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "personnel", dni), person(dni, { approvedUid: uid }));
    await setDoc(doc(db, "users", uid), { personnelId: dni, role: "trabajador", active: true });
    for (let start = 0; start < 601; start += 200) {
      const batch = writeBatch(db);
      for (let i = start; i < Math.min(start + 200, 601); i++) batch.set(doc(db, "marks", `report-fixture-${i}`), { dayKey: "2025-01-15", userId: "other", personnelId: "99999999", type: "entrada" });
      await batch.commit();
    }
  });
  const worker = env.authenticatedContext(uid, anonymousToken).firestore();
  for (const type of ["entrada", "salida"]) {
    const snap = await assertSucceeds(getDoc(doc(worker, "marks", `${dni}_${localDay()}_${type}`)));
    assert.equal(snap.exists(), false);
  }
  await assertFails(getDoc(doc(worker, "marks", `99999999_${localDay()}_entrada`)));
  await assertSucceeds(getDocs(query(collection(worker, "incidents"), where("personnelId", "==", dni), orderBy("createdAt", "desc"), limit(3))));
  await assertFails(getDocs(query(collection(worker, "registrationRequests"), where("status", "==", "pendiente"))));
  const manager = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  await assertSucceeds(getDocs(query(collection(manager, "registrationRequests"), where("status", "==", "pendiente"))));
  await assertSucceeds(getDocs(query(collection(manager, "incidents"), where("status", "==", "pendiente"))));
  const monthly = await assertSucceeds(getDocs(query(collection(manager, "marks"), where("dayKey", ">=", "2025-01-01"), where("dayKey", "<", "2025-02-01"), orderBy("dayKey"))));
  assert.equal(monthly.size, 601);
  const daily = await assertSucceeds(getDocs(query(collection(manager, "marks"), where("dayKey", "==", "2025-01-15"))));
  assert.equal(daily.size, 601);
  await assertSucceeds(getDocs(query(collection(manager, "adjustments"), where("dayKey", "==", "2025-01-15"))));
  await assertSucceeds(getDocs(query(collection(worker, "marks"), where("userId", "==", uid), where("dayKey", "==", localDay()))));
  await assertSucceeds(getDocs(query(collection(worker, "adjustments"), where("userId", "==", uid), where("dayKey", "==", localDay()))));
  await assertFails(getDocs(query(collection(worker, "marks"), where("dayKey", "==", "2025-01-15"))));
});

test("importación optimizada es idempotente y conserva aprobación, contacto y horario", async () => {
  const dni = "87650002", uid = "existing-approved-worker";
  const db = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "personnel", dni), person(dni, { approvedUid: uid, scheduleStart: "06:10", graceMinutes: 0, contactPhone: "999111222" }));
    await setDoc(doc(ctx.firestore(), "users", uid), { personnelId: dni, role: "trabajador", active: true });
  });
  globalThis.__rosterTest = { db, auth: { currentUser: { uid: managerId, isAnonymous: false } } };
  const path = new URL("./.roster-runtime.mjs", import.meta.url);
  const source = readFileSync("src/roster.ts", "utf8").replace('import { auth, db } from "./firebase";', 'const {auth, db} = globalThis.__rosterTest;');
  writeFileSync(path, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  try {
    const { importRoster } = await import(path.href);
    const before = (await getDoc(doc(db, "personnel", dni))).data();
    const entry = Object.fromEntries(["dni", "firstNames", "lastNameP", "lastNameM", "displayName", "companies", "occupation", "location"].map(key => [key, before[key]]));
    assert.deepEqual(await importRoster([entry]), { changed: 0, unchanged: 1 });
    assert.deepEqual((await getDoc(doc(db, "personnel", dni))).data(), before);
    assert.deepEqual(await importRoster([{ ...entry, location: "ICA" }]), { changed: 1, unchanged: 0 });
    const saved = (await getDoc(doc(db, "personnel", dni))).data();
    for (const key of ["approvedUid", "active", "contactPhone", "scheduleStart", "graceMinutes"]) assert.deepEqual(saved[key], before[key]);
    assert.equal((await getDoc(doc(db, "users", uid))).data().active, true);
    assert.deepEqual(await importRoster([{ ...entry, location: "ICA" }]), { changed: 0, unchanged: 1 });
  } finally { unlinkSync(path); delete globalThis.__rosterTest; }
});

test("trabajador puede marcar una sola entrada con hora de servidor y auditoría", async () => {
  const store = env.authenticatedContext(workerId, token(workerEmail)).firestore();
  const id = `${workerId}_${localDay()}_entrada`;
  const markRef = doc(store, "marks", id);
  const batch = writeBatch(store);
  batch.set(markRef, { userId: workerId, displayName: "Trabajador Prueba", type: "entrada", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "08:00", scheduleEnd: null, graceMinutes: 10, source: "web", location: { status: "captured", lat: -12.05, lng: -77.04, accuracyMeters: 25 } });
  batch.set(doc(store, "audit", `mark_${id}`), { action: "mark_attendance", actorId: workerId, targetId: id, at: serverTimestamp() });
  await assertSucceeds(batch.commit());
  const saved = await getDoc(markRef);
  assert.equal(saved.data().userId, workerId);
  assert.ok(saved.data().occurredAt);
  await assertFails(updateDoc(markRef, { type: "salida" }));
  await assertFails(setDoc(markRef, { userId: workerId, type: "entrada" }));
});

test("rechaza hora inventada, fecha falsa y marcación de otra persona", async () => {
  const store = env.authenticatedContext(workerId, token(workerEmail)).firestore();
  for (const [id, changes] of [
    [`${workerId}_2000-01-01_entrada`, { dayKey: "2000-01-01" }],
    [`${workerId}_${localDay()}_salida`, { occurredAt: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")) }],
    [`${managerId}_${localDay()}_entrada`, { userId: managerId }]
  ]) {
    const batch = writeBatch(store);
    batch.set(doc(store, "marks", id), { userId: workerId, displayName: "Trabajador Prueba", type: id.endsWith("salida") ? "salida" : "entrada", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "08:00", scheduleEnd: null, graceMinutes: 10, source: "web", location: { status: "captured", lat: -12.05, lng: -77.04, accuracyMeters: 25 }, ...changes });
    batch.set(doc(store, "audit", `mark_${id}`), { action: "mark_attendance", actorId: workerId, targetId: id, at: serverTimestamp() });
    await assertFails(batch.commit());
  }
});

test("solo encargado puede modificar horario y deja auditoría", async () => {
  const workerStore = env.authenticatedContext(workerId, token(workerEmail)).firestore();
  await assertFails(updateDoc(doc(workerStore, "users", workerId), { scheduleStart: "09:00" }));
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const auditRef = doc(managerStore, "audit", "user-edit-1");
  const batch = writeBatch(managerStore);
  batch.update(doc(managerStore, "users", workerId), { scheduleStart: "09:00", graceMinutes: 5, active: true, updatedAt: serverTimestamp(), updatedBy: managerId, lastAuditId: auditRef.id });
  batch.set(auditRef, { action: "update_user", actorId: managerId, targetId: workerId, at: serverTimestamp() });
  await assertSucceeds(batch.commit());
});

test("Gmail no invitado no puede crear su propio rol", async () => {
  const store = env.authenticatedContext("intruder", token("intruder@gmail.com")).firestore();
  await assertFails(setDoc(doc(store, "users", "intruder"), { email: "intruder@gmail.com", role: "encargado", active: true }));
});

test("encargado invita y Gmail autorizado activa solo el rol asignado", async () => {
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const email = "new.worker@gmail.com";
  const invite = writeBatch(managerStore);
  invite.set(doc(managerStore, "invites", email), { email, displayName: "Nueva Persona", role: "trabajador", active: true, scheduleStart: "08:30", graceMinutes: 5, invitedBy: managerId, createdAt: serverTimestamp() });
  invite.set(doc(managerStore, "audit", `invite_${email}`), { action: "invite_user", actorId: managerId, targetId: email, at: serverTimestamp() });
  await assertSucceeds(invite.commit());
  const workerStore = env.authenticatedContext("new-worker", token(email)).firestore();
  const claim = writeBatch(workerStore);
  claim.set(doc(workerStore, "users", "new-worker"), { email, displayName: "Nueva Persona", role: "trabajador", active: true, scheduleStart: "08:30", graceMinutes: 5, invitedBy: managerId, createdAt: serverTimestamp() });
  claim.set(doc(workerStore, "audit", "claim_new-worker"), { action: "claim_access", actorId: "new-worker", targetId: "new-worker", at: serverTimestamp() });
  await assertSucceeds(claim.commit());
  const profile = await getDoc(doc(workerStore, "users", "new-worker"));
  assert.equal(profile.data().role, "trabajador");
  await assertFails(updateDoc(doc(workerStore, "users", "new-worker"), { role: "encargado" }));
});

test("incidencia aprobada crea corrección separada y conserva la marca", async () => {
  const workerStore = env.authenticatedContext(workerId, token(workerEmail)).firestore();
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const id = "incident-approved-test";
  const proposedAt = Timestamp.fromDate(new Date(Date.now() - 1000));
  const dayKey = localDay(proposedAt.toDate());
  const originalMarkId = `${workerId}_${dayKey}_entrada`;
  const incident = writeBatch(workerStore);
  incident.set(doc(workerStore, "incidents", id), { userId: workerId, displayName: "Trabajador Prueba", dayKey, type: "entrada", markId: originalMarkId, proposedAt, reason: "Olvidé registrar la hora correcta", status: "pendiente", createdAt: serverTimestamp() });
  incident.set(doc(workerStore, "audit", `incident_${id}`), { action: "submit_incident", actorId: workerId, targetId: id, at: serverTimestamp() });
  await assertSucceeds(incident.commit());
  await assertFails(updateDoc(doc(workerStore, "incidents", id), { status: "aprobada" }));
  const resolution = writeBatch(managerStore);
  resolution.update(doc(managerStore, "incidents", id), { status: "aprobada", resolvedBy: managerId, resolutionNote: "Validado con el registro de turno", resolvedAt: serverTimestamp() });
  resolution.set(doc(managerStore, "adjustments", `${workerId}_${dayKey}_entrada`), { incidentId: id, userId: workerId, dayKey, type: "entrada", originalMarkId,
    correctedAt: proposedAt, reason: "Olvidé registrar la hora correcta", approvedBy: managerId, approvalNote: "Validado con el registro de turno", approvedAt: serverTimestamp() });
  resolution.set(doc(managerStore, "audit", `resolve_${id}`), { action: "resolve_incident", actorId: managerId, targetId: id, at: serverTimestamp() });
  await assertSucceeds(resolution.commit());
  await assertFails(updateDoc(doc(managerStore, "adjustments", `${workerId}_${dayKey}_entrada`), { correctedAt: Timestamp.now() }));
  assert.ok((await getDoc(doc(workerStore, "marks", originalMarkId))).exists());
});

test("trabajador solo consulta sus registros; encargado consulta el equipo", async () => {
  const workerStore = env.authenticatedContext(workerId, token(workerEmail)).firestore();
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  await assertSucceeds(getDocs(query(collection(workerStore, "marks"), where("userId", "==", workerId), orderBy("dayKey", "desc"))));
  await assertFails(getDocs(collection(workerStore, "marks")));
  await assertFails(getDoc(doc(workerStore, "users", managerId)));
  await assertSucceeds(getDocs(collection(managerStore, "users")));
});

test("Gmail del primer encargado queda privado incluso para otros encargados", async () => {
  const privateManagerStore = env.authenticatedContext(privateManagerId, token(privateManagerEmail)).firestore();
  const otherManagerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const team = await assertSucceeds(getDocs(collection(privateManagerStore, "users")));
  assert.equal(team.docs.find(d => d.id === privateManagerId)?.data().email, corporateEmail);
  await assertFails(getDoc(doc(otherManagerStore, "privateIdentities", privateManagerId)));
  await assertFails(getDoc(doc(privateManagerStore, "privateIdentities", privateManagerId)));
  const wrongEmailStore = env.authenticatedContext(privateManagerId, token("wrong@gmail.com")).firestore();
  await assertFails(getDocs(collection(wrongEmailStore, "users")));
});

test("el encargado administra el padrón y un celular sin aprobar no puede leerlo", async () => {
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const dni = "12345678";
  const batch = writeBatch(managerStore);
  batch.set(doc(managerStore, "personnel", dni), {
    ...person(dni), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastAuditId: "roster-test-1"
  });
  batch.set(doc(managerStore, "audit", "roster-test-1"), { action: "roster_upsert", actorId: managerId, targetId: dni, at: serverTimestamp() });
  await assertSucceeds(batch.commit());
  const anonStore = env.authenticatedContext("anon-unapproved", anonymousToken).firestore();
  await assertFails(getDoc(doc(anonStore, "personnel", dni)));
  await assertFails(getDocs(collection(anonStore, "personnel")));
});

test("el padrón rechaza ocupaciones fuera de las cuatro autorizadas", async () => {
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const dni = "11223344";
  const batch = writeBatch(managerStore);
  batch.set(doc(managerStore, "personnel", dni), {
    ...person(dni, { occupation: "OCUPACION NO AUTORIZADA" }), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastAuditId: "monitor-rejected"
  });
  batch.set(doc(managerStore, "audit", "monitor-rejected"), { action: "roster_upsert", actorId: managerId, targetId: dni, at: serverTimestamp() });
  await assertFails(batch.commit());
});

test("DNI válido solicita acceso; solo el encargado puede aprobar el celular", async () => {
  const dni = "23456789";
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), "personnel", dni), person(dni)));
  const anonId = "anon-approved-test";
  const anonStore = env.authenticatedContext(anonId, anonymousToken).firestore();
  const requestRef = doc(anonStore, "registrationRequests", anonId);
  await assertSucceeds(setDoc(requestRef, { dni, firstNames: "Persona", surnames: "Prueba",
    contactPhone: "999888777", contactEmail: "", status: "pendiente", createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(anonStore, "users", anonId), { role: "trabajador", active: true }));
  await assertFails(getDocs(collection(anonStore, "registrationRequests")));
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const approved = writeBatch(managerStore);
  approved.update(doc(managerStore, "personnel", dni), { approvedUid: anonId, contactPhone: "999888777",
    updatedAt: serverTimestamp(), updatedBy: managerId, lastAuditId: "approve-test-1" });
  approved.set(doc(managerStore, "users", anonId), { personnelId: dni, displayName: "Persona Prueba OS",
    role: "trabajador", active: true, scheduleStart: "08:00", graceMinutes: 10,
    createdAt: serverTimestamp(), approvedBy: managerId });
  approved.update(doc(managerStore, "registrationRequests", anonId), { status: "aprobada", resolvedAt: serverTimestamp(),
    resolvedBy: managerId, resolutionNote: "Aprobado", lastAuditId: "approve-test-1" });
  approved.set(doc(managerStore, "audit", "approve-test-1"), { action: "registration_approved", actorId: managerId, targetId: anonId, at: serverTimestamp() });
  await assertSucceeds(approved.commit());
  const profile = await assertSucceeds(getDoc(doc(anonStore, "users", anonId)));
  assert.equal(profile.data().personnelId, dni);
  await assertSucceeds(getDoc(doc(anonStore, "personnel", dni)));
  await assertFails(getDoc(doc(anonStore, "personnel", "12345678")));
});

test("celular aprobado marca con hora oficial y ubicación; la baja impide nuevas marcas", async () => {
  const dni = "34567890";
  const anonId = "anon-mark-test";
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await setDoc(doc(store, "personnel", dni), person(dni, { approvedUid: anonId }));
    await setDoc(doc(store, "users", anonId), { personnelId: dni, displayName: "Persona Prueba OS", role: "trabajador",
      active: true, scheduleStart: "08:00", graceMinutes: 10 });
  });
  const anonStore = env.authenticatedContext(anonId, anonymousToken).firestore();
  const id = `${dni}_${localDay()}_entrada`;
  const withoutGps = writeBatch(anonStore);
  withoutGps.set(doc(anonStore, "marks", id), { userId: anonId, personnelId: dni, displayName: "Persona Prueba OS",
    type: "entrada", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "08:00",
    scheduleEnd: null, graceMinutes: 10, source: "web", location: { status: "unavailable" } });
  withoutGps.set(doc(anonStore, "audit", `mark_${id}`), { action: "mark_attendance", actorId: anonId, targetId: id, at: serverTimestamp() });
  await assertFails(withoutGps.commit());
  const batch = writeBatch(anonStore);
  batch.set(doc(anonStore, "marks", id), { userId: anonId, personnelId: dni, displayName: "Persona Prueba OS",
    type: "entrada", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "08:00",
    scheduleEnd: null, graceMinutes: 10, source: "web", location: { status: "captured", lat: -12.05, lng: -77.04, accuracyMeters: 25 } });
  batch.set(doc(anonStore, "audit", `mark_${id}`), { action: "mark_attendance", actorId: anonId, targetId: id, at: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(anonStore, "marks", id), { location: { status: "unavailable" } }));
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const deactivation = writeBatch(managerStore);
  deactivation.update(doc(managerStore, "personnel", dni), { active: false, updatedAt: serverTimestamp(),
    updatedBy: managerId, lastAuditId: "roster-deactivate-1" });
  deactivation.set(doc(managerStore, "audit", "roster-deactivate-1"), { action: "roster_upsert", actorId: managerId, targetId: dni, at: serverTimestamp() });
  await assertSucceeds(deactivation.commit());
  const denied = writeBatch(anonStore);
  const exitId = `${dni}_${localDay()}_salida`;
  denied.set(doc(anonStore, "marks", exitId), { userId: anonId, personnelId: dni, displayName: "Persona Prueba OS",
    type: "salida", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "08:00",
    scheduleEnd: null, graceMinutes: 10, source: "web", location: { status: "captured", lat: -12.05, lng: -77.04, accuracyMeters: 25 } });
  denied.set(doc(anonStore, "audit", `mark_${exitId}`), { action: "mark_attendance", actorId: anonId, targetId: exitId, at: serverTimestamp() });
  await assertFails(denied.commit());
});

test("trabajador sin marca puede solicitar corrección y el encargado la aprueba sin alterar el historial", async () => {
  const dni = "45678901";
  const anonId = "anon-incident-test";
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await setDoc(doc(store, "personnel", dni), person(dni, { approvedUid: anonId }));
    await setDoc(doc(store, "users", anonId), { personnelId: dni, displayName: "Persona Prueba OS", role: "trabajador",
      active: true, scheduleStart: "08:00", graceMinutes: 10 });
  });
  const anonStore = env.authenticatedContext(anonId, anonymousToken).firestore();
  const markId = `${dni}_${localDay()}_entrada`;
  const missing = await assertSucceeds(getDoc(doc(anonStore, "marks", markId)));
  assert.equal(missing.exists(), false);
  const proposedAt = Timestamp.fromDate(new Date(Date.now() - 60_000));
  const dayKey = localDay(proposedAt.toDate());
  const incidentId = "anon-incident-1";
  const request = writeBatch(anonStore);
  request.set(doc(anonStore, "incidents", incidentId), { userId: anonId, personnelId: dni,
    displayName: "Persona Prueba OS", dayKey, type: "entrada", markId: null,
    proposedAt, reason: "Olvidé marcar la entrada", status: "pendiente", createdAt: serverTimestamp() });
  request.set(doc(anonStore, "audit", `incident_${incidentId}`), { action: "submit_incident", actorId: anonId, targetId: incidentId, at: serverTimestamp() });
  await assertSucceeds(request.commit());
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const resolution = writeBatch(managerStore);
  resolution.update(doc(managerStore, "incidents", incidentId), { status: "aprobada", resolvedBy: managerId,
    resolutionNote: "Validado", resolvedAt: serverTimestamp() });
  resolution.set(doc(managerStore, "adjustments", `${dni}_${dayKey}_entrada`), {
    incidentId, userId: anonId, personnelId: dni, dayKey, type: "entrada", originalMarkId: null,
    correctedAt: proposedAt, reason: "Olvidé marcar la entrada", approvedBy: managerId,
    approvalNote: "Validado", approvedAt: serverTimestamp()
  });
  resolution.set(doc(managerStore, "audit", `resolve_${incidentId}`), { action: "resolve_incident", actorId: managerId, targetId: incidentId, at: serverTimestamp() });
  await assertSucceeds(resolution.commit());
  await assertSucceeds(getDoc(doc(anonStore, "adjustments", `${dni}_${dayKey}_entrada`)));
});

test("el registro acepta celular o correo y rechaza solicitudes sin contacto", async () => {
  const dni = "56789012";
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), "personnel", dni), person(dni)));
  const emailStore = env.authenticatedContext("anon-email-test", anonymousToken).firestore();
  await assertSucceeds(setDoc(doc(emailStore, "registrationRequests", "anon-email-test"), {
    dni, firstNames: "Persona", surnames: "Prueba OS", contactPhone: "", contactEmail: "persona@correo.com",
    status: "pendiente", createdAt: serverTimestamp()
  }));
  const emptyStore = env.authenticatedContext("anon-empty-contact", anonymousToken).firestore();
  await assertFails(setDoc(doc(emptyStore, "registrationRequests", "anon-empty-contact"), {
    dni, firstNames: "Persona", surnames: "Prueba OS", contactPhone: "", contactEmail: "",
    status: "pendiente", createdAt: serverTimestamp()
  }));
});

test("un cambio de horario del padrón se aplica a la siguiente marcación", async () => {
  const dni = "67890123";
  const anonId = "anon-schedule-test";
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await setDoc(doc(store, "personnel", dni), person(dni, { approvedUid: anonId }));
    await setDoc(doc(store, "users", anonId), { personnelId: dni, displayName: "Persona Prueba OS", role: "trabajador",
      active: true, scheduleStart: "08:00", graceMinutes: 10 });
  });
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const edit = writeBatch(managerStore);
  edit.update(doc(managerStore, "personnel", dni), { scheduleStart: "09:00", graceMinutes: 5,
    updatedAt: serverTimestamp(), updatedBy: managerId, lastAuditId: "roster-schedule-test" });
  edit.set(doc(managerStore, "audit", "roster-schedule-test"), {
    action: "roster_upsert", actorId: managerId, targetId: dni, at: serverTimestamp()
  });
  await assertSucceeds(edit.commit());
  const anonStore = env.authenticatedContext(anonId, anonymousToken).firestore();
  const markId = `${dni}_${localDay()}_entrada`;
  const oldSchedule = writeBatch(anonStore);
  oldSchedule.set(doc(anonStore, "marks", markId), { userId: anonId, personnelId: dni, displayName: "Persona Prueba OS",
    type: "entrada", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "08:00",
    scheduleEnd: null, graceMinutes: 10, source: "web", location: { status: "captured", lat: -12.05, lng: -77.04, accuracyMeters: 25 } });
  oldSchedule.set(doc(anonStore, "audit", `mark_${markId}`), {
    action: "mark_attendance", actorId: anonId, targetId: markId, at: serverTimestamp()
  });
  await assertFails(oldSchedule.commit());
  const currentSchedule = writeBatch(anonStore);
  currentSchedule.set(doc(anonStore, "marks", markId), { userId: anonId, personnelId: dni, displayName: "Persona Prueba OS",
    type: "entrada", dayKey: localDay(), occurredAt: serverTimestamp(), scheduleStart: "09:00",
    scheduleEnd: null, graceMinutes: 5, source: "web", location: { status: "captured", lat: -12.05, lng: -77.04, accuracyMeters: 25 } });
  currentSchedule.set(doc(anonStore, "audit", `mark_${markId}`), {
    action: "mark_attendance", actorId: anonId, targetId: markId, at: serverTimestamp()
  });
  await assertSucceeds(currentSchedule.commit());
});

test("encargado elimina acceso anterior y permite aprobar otro celular sin borrar historial", async () => {
  const dni = "78901234";
  const oldUid = "anon-old-phone";
  const newUid = "anon-new-phone";
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await setDoc(doc(store, "personnel", dni), person(dni, { approvedUid: oldUid, lastAuditId: "approved-old" }));
    await setDoc(doc(store, "users", oldUid), { personnelId: dni, displayName: "Persona Prueba OS", role: "trabajador", active: true, scheduleStart: "08:00", graceMinutes: 10 });
    await setDoc(doc(store, "registrationRequests", oldUid), { dni, firstNames: "Persona", surnames: "Prueba OS", contactPhone: "999888777", contactEmail: "", status: "aprobada", createdAt: Timestamp.now() });
  });
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  const oldStore = env.authenticatedContext(oldUid, anonymousToken).firestore();
  await assertFails(deleteDoc(doc(oldStore, "users", oldUid)));
  await assertFails(deleteDoc(doc(managerStore, "users", oldUid)));
  const batch = writeBatch(managerStore);
  batch.update(doc(managerStore, "personnel", dni), { approvedUid: null, updatedAt: serverTimestamp(), updatedBy: managerId, lastAuditId: "access_remove_approved-old" });
  batch.delete(doc(managerStore, "users", oldUid));
  batch.delete(doc(managerStore, "registrationRequests", oldUid));
  batch.set(doc(managerStore, "audit", "access_remove_approved-old"), { action: "worker_access_removed", actorId: managerId, targetId: dni, at: serverTimestamp() });
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(doc(managerStore, "personnel", dni))).data().approvedUid, null);
  assert.equal((await getDoc(doc(managerStore, "users", oldUid))).exists(), false);
  const newStore = env.authenticatedContext(newUid, anonymousToken).firestore();
  await assertSucceeds(setDoc(doc(newStore, "registrationRequests", newUid), { dni, firstNames: "Persona", surnames: "Prueba OS", contactPhone: "999888777", contactEmail: "", status: "pendiente", createdAt: serverTimestamp() }));
});

test("solo se elimina del padrón una persona de baja y sin dispositivo", async () => {
  const dni = "89012345";
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), "personnel", dni), person(dni, { lastAuditId: "inactive-seed" })));
  const managerStore = env.authenticatedContext(managerId, token(managerEmail)).firestore();
  await assertFails(deleteDoc(doc(managerStore, "personnel", dni)));
  const deactivate = writeBatch(managerStore);
  deactivate.update(doc(managerStore, "personnel", dni), { active: false, updatedAt: serverTimestamp(), updatedBy: managerId, lastAuditId: "deactivate-before-delete" });
  deactivate.set(doc(managerStore, "audit", "deactivate-before-delete"), { action: "roster_upsert", actorId: managerId, targetId: dni, at: serverTimestamp() });
  await assertSucceeds(deactivate.commit());
  await assertFails(deleteDoc(doc(managerStore, "personnel", dni)));
  const remove = writeBatch(managerStore);
  remove.delete(doc(managerStore, "personnel", dni));
  remove.set(doc(managerStore, "audit", "roster_delete_deactivate-before-delete"), { action: "roster_delete", actorId: managerId, targetId: dni, at: serverTimestamp() });
  await assertSucceeds(remove.commit());
  assert.equal((await getDoc(doc(managerStore, "personnel", dni))).exists(), false);
});
