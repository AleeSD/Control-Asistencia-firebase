const fs=require('fs'),crypto=require('crypto');
const auth=require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
(async()=>{
 const a=auth.getGlobalDefaultAccount(),token=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 const summary={};
 for(const collection of ['personnel','users','registrationRequests']){
  const all=[];let next='';do{
   const u=new URL('https://firestore.googleapis.com/v1/projects/sistema-de-asistencia-os/databases/(default)/documents/'+collection);
   u.searchParams.set('pageSize','1000');if(next)u.searchParams.set('pageToken',next);
   const r=await fetch(u,{headers:{Authorization:'Bearer '+token.access_token}});if(!r.ok)throw Error('Read failed '+r.status);
   const body=await r.json();all.push(...(body.documents??[]));next=body.nextPageToken;
  }while(next);
  const fields=['approvedUid','personnelId','active','role','status'];
  const values=all.map(d=>[d.name,...fields.map(f=>d.fields?.[f]??null)]).sort((a,b)=>a[0].localeCompare(b[0]));
  summary[collection]={count:all.length,sha256:crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex')};
 }
 const file='tmp/optimization-access-before.json';
 if(!fs.existsSync(file)){fs.writeFileSync(file,JSON.stringify(summary,null,2));console.log('Baseline saved: '+JSON.stringify(summary));}
 else console.log(JSON.stringify({unchanged:JSON.stringify(JSON.parse(fs.readFileSync(file)))===JSON.stringify(summary),summary}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
