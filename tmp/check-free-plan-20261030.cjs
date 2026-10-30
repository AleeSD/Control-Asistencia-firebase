const fs = require('node:fs');
const auth = require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
(async () => {
 const a = auth.getGlobalDefaultAccount();
 const t = await auth.getAccessToken(a.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
 const headers = {Authorization:'Bearer ' + t.access_token};
 const r = await fetch('https://cloudbilling.googleapis.com/v1/projects/sistema-de-asistencia-os/billingInfo', {headers});
 const d = await r.json();
 const result = {at:new Date().toISOString(),status:r.status,billingEnabled:r.ok ? d.billingEnabled : null};
 const params = new URLSearchParams({filter:'metric.type="firestore.googleapis.com/storage/data_and_index_storage_bytes"', 'interval.startTime':new Date(Date.now()-48*3600000).toISOString(),'interval.endTime':new Date().toISOString(),view:'FULL'});
 const sr=await fetch('https://monitoring.googleapis.com/v3/projects/sistema-de-asistencia-os/timeSeries?'+params,{headers});
 const sd=await sr.json();
 const all=sd.timeSeries??[]; const preferred=all.filter(s=>s.resource?.type==='firestore.googleapis.com/Database');
 result.storageStatus=sr.status;
 result.storage=(preferred.length?preferred:all).map(s=>({resourceType:s.resource?.type,labels:s.metric.labels,latest:s.points?.[0]}));
 fs.writeFileSync('tmp/optimization-monitoring/billing-20261030.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
})().catch(()=>{console.error('No se pudo verificar el estado de facturación.');process.exitCode=1});
