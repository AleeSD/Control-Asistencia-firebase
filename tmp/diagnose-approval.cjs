const fs=require('fs'),crypto=require('crypto');
const auth=require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
(async()=>{
 const a=auth.getGlobalDefaultAccount(),t=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 const root='https://firestore.googleapis.com/v1/projects/sistema-de-asistencia-os/databases/(default)/documents';
 async function get(url){const r=await fetch(url,{headers:{Authorization:'Bearer '+t.access_token}});if(!r.ok)throw Error('API '+r.status);return r.json()}
 const p=(await get(root+'/personnel/72642085')).fields;
 const decode=v=>v?.stringValue??v?.booleanValue??v?.integerValue??null;
 console.log(JSON.stringify({personnelKeys:Object.keys(p),occupation:decode(p.occupation),active:decode(p.active),approved:!!decode(p.approvedUid),scheduleStart:decode(p.scheduleStart),scheduleEnd:decode(p.scheduleEnd),hasCreatedAt:!!p.createdAt,graceType:Object.keys(p.graceMinutes??{})}));
 const release=await get('https://firebaserules.googleapis.com/v1/projects/sistema-de-asistencia-os/releases/cloud.firestore');
 const ruleset=await get('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
 const remote=ruleset.source.files.find(f=>f.name==='firestore.rules')?.content;
 console.log(JSON.stringify({rulesMatchLocal:remote?.replace(/\r\n/g,'\n')===fs.readFileSync('firestore.rules','utf8').replace(/\r\n/g,'\n'),rulesReleased:release.updateTime}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
