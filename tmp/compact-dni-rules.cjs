const fs=require('fs');let s=fs.readFileSync('firestore.rules','utf8');
const a=s.indexOf('    function legacyWorkerActive()'),b=s.indexOf('    function workerActive()',a);
s=s.slice(0,a)+`    function legacyWorkerActive() {
      let u = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      let p = get(/databases/$(database)/documents/personnel/$(u.personnelId)).data;
      return u.role == 'trabajador' && u.active == true && p.active == true && p.approvedUid == request.auth.uid;
    }
`+s.slice(b);
const begin=s.indexOf('    match /marks/{markId}');
const end=s.indexOf('    match /incidents/{incidentId}',begin);
s=s.slice(0,begin)+`    function workerMarkOK(markId) {
      let d = request.resource.data;
      let dni = me().data.personnelId;
      let p = get(/databases/$(database)/documents/personnel/$(dni)).data;
      return d.keys().hasOnly(['userId','personnelId','displayName','type','dayKey','occurredAt','scheduleStart','scheduleEnd','graceMinutes','source','location'])
        && d.personnelId == dni && d.displayName == p.displayName && d.scheduleStart == p.scheduleStart
        && d.scheduleEnd == endOf(p) && d.graceMinutes == p.graceMinutes
        && markId == dni + '_' + d.dayKey + '_' + d.type
        && (d.type == 'entrada' || exists(/databases/$(database)/documents/marks/$(dni + '_' + d.dayKey + '_entrada')));
    }
    function managerMarkOK(markId) {
      let d = request.resource.data;
      let u = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      return d.keys().hasOnly(['userId','displayName','type','dayKey','occurredAt','scheduleStart','scheduleEnd','graceMinutes','source','location'])
        && d.displayName == u.displayName && d.scheduleStart == u.scheduleStart && d.scheduleEnd == endOf(u) && d.graceMinutes == u.graceMinutes
        && markId == request.auth.uid + '_' + d.dayKey + '_' + d.type
        && (d.type == 'entrada' || exists(/databases/$(database)/documents/marks/$(request.auth.uid + '_' + d.dayKey + '_entrada')));
    }
    match /marks/{markId} {
      allow get: if active() && (manager() || markId.matches('^' + (anonymous() ? me().data.personnelId : request.auth.uid) + '_[0-9]{4}-[0-9]{2}-[0-9]{2}_(entrada|salida)$'));
      allow list: if active() && (manager() || (anonymous() && resource.data.personnelId == me().data.personnelId) || resource.data.userId == request.auth.uid);
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid
        && request.resource.data.type in ['entrada','salida'] && request.resource.data.dayKey == limaDay(request.time)
        && request.resource.data.occurredAt == request.time && request.resource.data.source == 'web' && locationOK(request.resource.data.location)
        && (anonymous() ? (workerActive() && workerMarkOK(markId)) : (legacyActive() && managerMarkOK(markId)))
        && auditAfter('mark_' + markId, 'mark_attendance', markId);
      allow update, delete: if false;
    }

    function incidentIdentityOK() {
      let d = request.resource.data;
      let id = anonymous() ? me().data.personnelId : request.auth.uid;
      let expected = id + '_' + d.dayKey + '_' + d.type;
      let name = anonymous() ? get(/databases/$(database)/documents/personnel/$(id)).data.displayName : me().data.displayName;
      return d.displayName == name
        && d.keys().hasOnly(anonymous() ? ['userId','personnelId','displayName','dayKey','type','markId','proposedAt','reason','status','createdAt'] : ['userId','displayName','dayKey','type','markId','proposedAt','reason','status','createdAt'])
        && (!anonymous() || d.personnelId == id)
        && d.markId == (exists(/databases/$(database)/documents/marks/$(expected)) ? expected : null);
    }
`+s.slice(end);
const ia=s.indexOf('        && ((legacyActive()',s.indexOf('    match /incidents/'));
const ib=s.indexOf('        && request.resource.data.reason',ia);
s=s.slice(0,ia)+'        && incidentIdentityOK()\n'+s.slice(ib);
fs.writeFileSync('firestore.rules',s);
