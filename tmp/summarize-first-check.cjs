const fs=require('fs');
const filename='tmp/optimization-monitoring/2026-10-29T19-49-18-823Z.json';
const r=JSON.parse(fs.readFileSync(filename));
for(const [type,body] of Object.entries(r.metrics)){
 const all=body.timeSeries??[], preferred=all.filter(s=>s.resource?.type==='firestore.googleapis.com/Database'), selected=preferred.length?preferred:all;
 const windows={},results={};
 for(const s of selected)for(const p of s.points??[]){const key=p.interval.endTime,v=Number(p.value.int64Value??p.value.doubleValue??0);windows[key]=/snapshot_listeners$|active_connections$/.test(type)?Math.max(windows[key]??0,v):(windows[key]??0)+v;
 if(s.metric.labels.result){results[key]??={};results[key][s.metric.labels.result]=(results[key][s.metric.labels.result]??0)+v;}}
 r.summary[type]={windows,results,series:selected.length,resourceType:selected[0]?.resource?.type??null};
}
r.review={number:1,decision:'DONT_NOTIFY',reason:'Lecturas bajo el umbral, sitio y recurso principal HTTP 200. Tres errores aislados GET de reglas sin atribución a cuentas aprobadas; seguir tendencia. La menor actividad impide atribuir el descenso exclusivamente a optimización.'};
fs.writeFileSync(filename,JSON.stringify(r,null,2));
console.log(JSON.stringify(r.summary));
