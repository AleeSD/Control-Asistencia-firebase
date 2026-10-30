// Additive projection migration. Never writes personnel/users/marks/requests/adjustments.
const fs=require('fs'),crypto=require('crypto');
const auth=require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
const project='sistema-de-asistencia-os',base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const decode=v=>v?.stringValue??v?.booleanValue??(v?.integerValue!==undefined?Number(v.integerValue):null);
const encode=v=>v===null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:v};
const fields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v; const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
async function main(){
 const a=auth.getGlobalDefaultAccount(),token=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok){if(r.status===404)return null;throw Error('Firebase API status '+r.status);}return r.json();}
 async function list(name){let documents=[],pageToken='';do{const b=await api(base+'/'+name+'?'+new URLSearchParams({pageSize:'1000',...(pageToken?{pageToken}:{})}));documents.push(...b.documents??[]);pageToken=b.nextPageToken??'';}while(pageToken);return documents;}
 const roster=await list('personnel');const users=await list('users');const userMap=new Map(users.map(d=>[d.name.split('/').pop(),d]));
 const summary={at:new Date().toISOString(),mode:process.argv[2]??'dry-run',personnel:roster.length,approvedActive:0,inconsistentActive:0,created:0,updated:0,unchanged:0};
 for(const p of roster){const f=p.fields;if(decode(f.active)&&decode(f.approvedUid)){const u=userMap.get(decode(f.approvedUid))?.fields;if(decode(u?.active)&&decode(u?.personnelId)===decode(f.dni)&&decode(u?.role)==='trabajador')summary.approvedActive++;else summary.inconsistentActive++;}}
 const signatures={};for(const name of ['personnel','users','registrationRequests','marks','adjustments']){const docs=name==='personnel'?roster:name==='users'?users:await list(name);signatures[name]=Object.fromEntries(docs.map(d=>[hash(d.name),hash(d.fields)]));}
 const before='tmp/dni-integrity-canonical-before.json';
 if(!fs.existsSync(before))fs.writeFileSync(before,JSON.stringify(signatures,null,2));
 else {const old=JSON.parse(fs.readFileSync(before));summary.integrity=Object.fromEntries(Object.entries(old).map(([name,docs])=>[name,{before:Object.keys(docs).length,now:Object.keys(signatures[name]).length,existingChangedOrMissing:Object.entries(docs).filter(([key,value])=>signatures[name][key]!==value).length}]));}
 if(summary.mode==='apply'){
  if(summary.inconsistentActive)throw Error('Revisar incoherencias de aprobación antes de migrar.');
  for(const item of roster){
   const tx=(await api(base+':beginTransaction','POST',{options:{readWrite:{}}})).transaction;
   const suffix='?'+new URLSearchParams({transaction:tx});
   const p=await api('https://firestore.googleapis.com/v1/'+item.name+suffix);if(!p){await api(base+':rollback','POST',{transaction:tx});continue;}
   const f=p.fields,dni=decode(f.dni),uid=decode(f.approvedUid);
   if(uid){const u=await api(base+'/users/'+encodeURIComponent(uid)+suffix);if(decode(f.active)&&(!u||decode(u.fields.active)!==true||decode(u.fields.personnelId)!==dni))throw Error('La aprobación cambió durante la migración.');}
   const directory={active:decode(f.active),approved:typeof uid==='string'};
   const panel={dni,displayName:decode(f.displayName),active:decode(f.active),scheduleStart:decode(f.scheduleStart),scheduleEnd:decode(f.scheduleEnd),graceMinutes:decode(f.graceMinutes)};
   const writes=[];
   for(const [collection,data] of [['workerDirectory',directory],['workerPanels',panel]]){
    const name=`projects/${project}/databases/(default)/documents/${collection}/${dni}`;
    const old=await api('https://firestore.googleapis.com/v1/'+name+suffix);const next=fields(data);
    const same=old&&Object.keys(old.fields).length===Object.keys(next).length&&Object.entries(data).every(([k,v])=>decode(old.fields[k])===v);
    if(same)summary.unchanged++;else {writes.push({update:{name,fields:next}});summary[old?'updated':'created']++;}
   }
   if(writes.length)await api(base+':commit','POST',{writes,transaction:tx});else await api(base+':rollback','POST',{transaction:tx});
  }
 }
 fs.writeFileSync('tmp/dni-migration-'+summary.mode+'.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
