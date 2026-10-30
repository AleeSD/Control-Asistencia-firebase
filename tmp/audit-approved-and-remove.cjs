const fs=require('fs'),crypto=require('crypto');
const auth=require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
const base='https://firestore.googleapis.com/v1/projects/sistema-de-asistencia-os/databases/(default)/documents';
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(canon(x))).digest('hex');
const val=v=>v?.stringValue??v?.booleanValue??(v?.integerValue!==undefined?Number(v.integerValue):null);
(async()=>{
 const a=auth.getGlobalDefaultAccount(),t=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+t.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.status===404)return null;if(!r.ok)throw Error('Firebase API '+r.status);return r.json()}
 async function list(col){let docs=[],pageToken='';do{const b=await api(base+'/'+col+'?'+new URLSearchParams({pageSize:1000,...(pageToken?{pageToken}:{})}));docs.push(...b.documents??[]);pageToken=b.nextPageToken??''}while(pageToken);return docs}
 const names=['personnel','users','workerDirectory','workerPanels','marks','adjustments'];
 const all=Object.fromEntries(await Promise.all(names.map(async n=>[n,await list(n)])));
 const maps=Object.fromEntries(names.map(n=>[n,new Map(all[n].map(d=>[d.name.split('/').pop(),d.fields]))]));
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const result={at:new Date().toISOString(),approvedActive:0,consistent:0,inconsistent:0,todayWithEntryNoExit:0,todayCompleted:0,todayNoEntry:0};
 for(const [dni,p] of maps.personnel){if(val(p.active)!==true||!val(p.approvedUid))continue;result.approvedActive++;
  const u=maps.users.get(val(p.approvedUid)),d=maps.workerDirectory.get(dni),panel=maps.workerPanels.get(dni);
  const ok=val(u?.active)===true&&val(u?.role)==='trabajador'&&val(u?.personnelId)===dni&&val(d?.active)===true&&val(d?.approved)===true&&['dni','displayName','active','scheduleStart','scheduleEnd','graceMinutes'].every(k=>val(panel?.[k])===val(p[k]));
  result[ok?'consistent':'inconsistent']++;
  if(maps.marks.has(dni+'_'+day+'_salida'))result.todayCompleted++;else if(maps.marks.has(dni+'_'+day+'_entrada'))result.todayWithEntryNoExit++;else result.todayNoEntry++;
 }
 // Hash-only inventory: identifiers and personal fields are not written into the audit artifact.
 const baseline=Object.fromEntries(names.map(n=>[n,Object.fromEntries(all[n].map(d=>[hash(d.name),hash(d.fields)]))]));
 const file='tmp/management-integrity-before.json';if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(baseline,null,2));
 if(process.argv[2]==='remove'){
  const target='25705680';const tx=(await api(base+':beginTransaction','POST',{options:{readWrite:{}}})).transaction;
  const ref=base+'/personnel/'+target;const current=await api(ref+'?'+new URLSearchParams({transaction:tx}));
  if(!current)result.removal='already absent';else{
   const p=current.fields;
   if(val(p.dni)!==target||val(p.displayName).trim().replace(/\s+/g,' ').toLowerCase()!=='luis de la cruz'||val(p.approvedUid)!==null)throw Error('La persona cambió: detener eliminación para revisar identidad/aprobación.');
   const prefix='projects/sistema-de-asistencia-os/databases/(default)/documents/';
   const audit=prefix+'audit/roster_remove_requested_20261030_'+target;
   const writes=['personnel','workerDirectory','workerPanels'].map(c=>({delete:prefix+c+'/'+target}));
   writes.push({update:{name:audit,fields:{action:{stringValue:'roster_delete'},actorId:{stringValue:'firebase-cli-authorized-maintenance'},targetId:{stringValue:target}}},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]});
   await api(base+':commit','POST',{transaction:tx,writes});result.removal='removed exact unapproved person and two projections; audit stored';
  }
 }
 const old=JSON.parse(fs.readFileSync(file));result.integrity={};
 for(const n of ['personnel','users','marks','adjustments']){const docs=await list(n),next=new Map(docs.map(d=>[hash(d.name),hash(d.fields)]));result.integrity[n]={before:Object.keys(old[n]).length,now:docs.length,changedOrMissing:Object.entries(old[n]).filter(([k,v])=>next.get(k)!==v).length};}
 const out='tmp/management-audit-'+(process.argv[2]??'check')+'.json';fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(result.inconsistent)throw Error('Aprobaciones inconsistentes detectadas.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
