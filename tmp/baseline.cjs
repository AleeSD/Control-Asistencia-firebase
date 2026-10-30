const fs=require('fs');const crypto=require('crypto');
const auth=require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
(async()=>{
 const account=auth.getGlobalDefaultAccount();const token=await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
 async function get(url){const r=await fetch(url,{headers:{Authorization:'Bearer '+token.access_token}});if(!r.ok) return {status:r.status};return r.json();}
 const project='sistema-de-asistencia-os'; const result={at:new Date().toISOString(),metrics:{}};
 const releases=await get('https://firebasehosting.googleapis.com/v1beta1/sites/'+project+'/releases?pageSize=2');
 result.hosting=releases.releases?.map(r=>({name:r.name,version:r.version?.name,releaseTime:r.releaseTime}))??releases;
 const release=await get('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore');
 if(release.rulesetName){const rules=await get('https://firebaserules.googleapis.com/v1/'+release.rulesetName);result.rules={release:release.rulesetName,matchesLocal:rules.source?.files?.some(f=>f.content.replace(/\r\n/g,'\n')===fs.readFileSync('firestore.rules','utf8').replace(/\r\n/g,'\n'))};}
 const end=new Date(),start=new Date(end-7*86400000);
 for(const name of ['document/read_count','document/write_count','document/delete_count']){
  const params=new URLSearchParams({filter:'metric.type="firestore.googleapis.com/'+name+'"','interval.startTime':start.toISOString(),'interval.endTime':end.toISOString(),'aggregation.alignmentPeriod':'86400s','aggregation.perSeriesAligner':'ALIGN_SUM',view:'FULL'});
  result.metrics[name]=await get('https://monitoring.googleapis.com/v3/projects/'+project+'/timeSeries?'+params);
 }
 fs.writeFileSync('tmp/optimization-baseline.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({hosting:result.hosting,rules:result.rules,metrics:Object.fromEntries(Object.entries(result.metrics).map(([k,v])=>[k,v.status??v.timeSeries?.map(t=>t.points)]))}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
