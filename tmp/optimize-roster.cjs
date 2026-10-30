const fs=require('fs');let s=fs.readFileSync('src/roster.ts','utf8').replace(/\r\n/g,'\n');
const a=s.indexOf('export async function importRoster('), b=s.indexOf('\nexport async function approveRegistration',a);
s=s.slice(0,a)+`export function rosterChanged(entry: RosterEntry, current?: Personnel) {
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
      tx.set(auditRef, { action: "roster_upsert", actorId: uid, targetId: entry.dni, at: serverTimestamp() });
      return true;
    });
    if (didChange) changed++;
    onProgress?.(++done);
  }
  return { changed, unchanged: entries.length - changed };
}
`+s.slice(b);fs.writeFileSync('src/roster.ts',s);
s=fs.readFileSync('src/RosterPanel.tsx','utf8').replace(/\r\n/g,'\n').replace('orderBy, query','orderBy, query, where').replace('removeWorkerAccess, savePersonnel','removeWorkerAccess, rosterChanged, savePersonnel').replace('orderBy("createdAt", "desc")','where("status", "==", "pendiente")');
s=s.replace('await importRoster(preview,','const result = await importRoster(preview,').replace('Padrón actualizado: \\${preview.length} personas.', 'Padrón actualizado: \\${result.changed} cambios; \\${result.unchanged} sin cambios.');
s=s.replace('const result = await importRoster(preview, done =>', 'const result = await importRoster(preview, done =>');
s=s.replace('Padrón actualizado: ${preview.length} personas.', 'Padrón actualizado: ${result.changed} cambios; ${result.unchanged} sin cambios.');
s=s.replace('<strong>{preview.length} personas listas para importar</strong>', '<strong>{preview.length} personas listas para importar</strong><p>Nuevas: {preview.filter(p => !personnel.some(c => c.dni === p.dni)).length} · Modificadas: {preview.filter(p => personnel.some(c => c.dni === p.dni) && rosterChanged(p, personnel.find(c => c.dni === p.dni))).length} · Sin cambios: {preview.filter(p => !rosterChanged(p, personnel.find(c => c.dni === p.dni))).length}</p>');
fs.writeFileSync('src/RosterPanel.tsx',s);
