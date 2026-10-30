const fs=require('fs');let s=fs.readFileSync('firestore.rules','utf8');
const replace=(a,b)=>{if(!s.includes(a))throw Error(a.slice(0,100));s=s.replace(a,()=>b);};
replace('function me() { return get(/databases/$(database)/documents/users/$(request.auth.uid)); }',`function hasDniSession() { return anonymous() && exists(/databases/$(database)/documents/workerSessions/$(request.auth.uid)); }
    function me() { return hasDniSession() ? get(/databases/$(database)/documents/workerSessions/$(request.auth.uid)) : get(/databases/$(database)/documents/users/$(request.auth.uid)); }
    function approvedPerson(dni) {
      let p = get(/databases/$(database)/documents/personnel/$(dni)).data;
      let u = get(/databases/$(database)/documents/users/$(p.approvedUid)).data;
      return p.active == true && p.approvedUid is string && u.active == true && u.role == 'trabajador' && u.personnelId == dni;
    }
    function sessionWorkerActive() {
      let session = me().data;
      let p = get(/databases/$(database)/documents/personnel/$(session.personnelId)).data;
      return session.createdAt + duration.value(12, 'h') > request.time
        && approvedPerson(session.personnelId)
        && session.createdAt >= get(/databases/$(database)/documents/users/$(p.approvedUid)).data.get('createdAt', timestamp.date(2000, 1, 1));
    }`);
replace('function workerActive() {','function legacyWorkerActive() {');
replace('function active() {',"function workerActive() { return anonymous() && (hasDniSession() ? sessionWorkerActive() : legacyWorkerActive()); }\n    function active() {");
const marker='    // Solo la consola de Firebase';
replace(marker,`    // Minimal pre-login directory. Exact reads only; DNI-only access does not verify the holder.
    function directoryMatches(d, p) { return d.keys().hasOnly(['active','approved']) && d.active == p.active && d.approved == (p.approvedUid is string); }
    function panelMatches(d, p, dni) {
      return d.keys().hasOnly(['dni','displayName','active','scheduleStart','scheduleEnd','graceMinutes'])
        && d.dni == dni && d.displayName == p.displayName && d.active == p.active
        && d.scheduleStart == p.scheduleStart && d.scheduleEnd == endOf(p) && d.graceMinutes == p.graceMinutes;
    }
    function projectionsAfter(dni) {
      let p = getAfter(/databases/$(database)/documents/personnel/$(dni)).data;
      return directoryMatches(getAfter(/databases/$(database)/documents/workerDirectory/$(dni)).data, p)
        && panelMatches(getAfter(/databases/$(database)/documents/workerPanels/$(dni)).data, p, dni);
    }
    // Legacy roster documents may not have projections until the additive migration.
    function projectionsIfMigrated(dni) { return !exists(/databases/$(database)/documents/workerDirectory/$(dni)) || projectionsAfter(dni); }
    match /workerDirectory/{dni} {
      allow get: if manager() || (anonymous() && dni.matches('^[0-9]{8}$'));
      allow list: if manager();
      allow create, update: if manager() && directoryMatches(request.resource.data, getAfter(/databases/$(database)/documents/personnel/$(dni)).data);
      allow delete: if manager() && !existsAfter(/databases/$(database)/documents/personnel/$(dni));
    }
    match /workerPanels/{dni} {
      allow get: if manager() || (workerActive() && me().data.personnelId == dni);
      allow list: if manager();
      allow create, update: if manager() && panelMatches(request.resource.data, getAfter(/databases/$(database)/documents/personnel/$(dni)).data, dni);
      allow delete: if manager() && !existsAfter(/databases/$(database)/documents/personnel/$(dni));
    }
    match /workerSessions/{uid} {
      allow get: if manager() || (anonymous() && request.auth.uid == uid);
      allow list: if manager();
      allow create: if anonymous() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['personnelId','createdAt'])
        && request.resource.data.personnelId is string && request.resource.data.personnelId.matches('^[0-9]{8}$')
        && request.resource.data.createdAt == request.time && approvedPerson(request.resource.data.personnelId);
      allow update: if false;
      allow delete: if manager();
    }

`+marker);
replace('&& personnelAudit(dni)\n        && (getAfter', '&& personnelAudit(dni) && projectionsIfMigrated(dni)\n        && (getAfter');
replace("&& auditAfter('roster_delete_' + resource.data.lastAuditId, 'roster_delete', dni);", "&& auditAfter('roster_delete_' + resource.data.lastAuditId, 'roster_delete', dni)\n        && !existsAfter(/databases/$(database)/documents/workerDirectory/$(dni)) && !existsAfter(/databases/$(database)/documents/workerPanels/$(dni));");
// A concurrent approval must not replace a current person's approval silently.
replace("|| (item.action == 'registration_approved' && item.targetId == request.resource.data.approvedUid));", "|| (item.action == 'registration_approved' && item.targetId == request.resource.data.approvedUid && resource.data.approvedUid == null));");
fs.writeFileSync('firestore.rules',s);
