const fs = require('node:fs');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {chromium} = require('C:/Users/transporte.ope3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const original = fs.readFileSync('tmp/ui-check.cjs','utf8');
let mock = original.match(/const mock=`([\s\S]*?)`;/)[1];
const a = mock.indexOf('function snapshot(q)');
const b = mock.indexOf('export function onSnapshot',a);
mock = mock.slice(0,a) + `
const prev=new Date(Date.parse(day+'T12:00:00-05:00')-86400000).toISOString().slice(0,10);
const at=(d,t)=>({toDate:()=>new Date(d+'T'+t+':00-05:00')});
const marks=[{...mark,occurredAt:at(day,'05:55')},{...mark,id:'exit',type:'salida',occurredAt:at(day,'17:00')},{...mark,id:'prev',dayKey:prev,occurredAt:at(prev,'06:15')}];
const roster=[person,{...person,id:'87654321',dni:'87654321',displayName:'Persona sin marca'}];
function snapshot(q){let rows=[];if(q.c==='users')rows=[profile];if(q.c==='personnel')rows=roster;if(q.c==='marks')rows=q.id?(q.id.endsWith('entrada')?[marks[0]]:[]):window.largeReport?Array.from({length:75},(_,i)=>({...marks[0],id:'large'+i,personnelId:String(20000000+i),displayName:'Persona de prueba con nombre y apellidos extensos '+i})):marks;
for(const filter of q.filters??[]){if(filter.where){const [key,op,v]=filter.where;rows=rows.filter(r=>op==='=='?r[key]===v:op==='>='?r[key]>=v:op==='<'?r[key]<v:true);}}
return q.id?{id:q.id,exists:()=>rows.length>0,data:()=>rows[0]}:{docs:rows.map(r=>({id:r.id,data:()=>r})),size:rows.length};}
` + mock.slice(b);
(async()=>{
 fs.mkdirSync('tmp/pdfs',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/firebase.ts',r=>r.fulfill({contentType:'application/javascript',body:'export const auth={};export const db={};export const configured=true;export const googleProvider={};'}));
 await page.route('**/firebase_auth.js*',r=>r.fulfill({contentType:'application/javascript',body:`export const onAuthStateChanged=(_,cb)=>{cb({uid:'test-user',isAnonymous:false});return()=>{}};export const signOut=()=>{};export const signInWithPopup=()=>{};export const signInAnonymously=()=>{};`}));
 await page.route('**/firebase_firestore.js*',r=>r.fulfill({contentType:'application/javascript',body:mock}));
 await page.goto('http://127.0.0.1:5174');await page.getByRole('heading',{name:/Hola/}).waitFor();
 await page.getByRole('button',{name:'Marcaciones',exact:true}).click();await page.getByText('2 registros',{exact:true}).waitFor();
 let calls=await page.evaluate(()=>window.calls.filter(c=>c.kind==='listen'&&c.c==='marks'));
 assert(calls.at(-1).filters.some(f=>f.where?.[0]==='dayKey'&&f.where[1]==='=='));
 assert(!calls.at(-1).filters.some(f=>f.limit));
 const day=await page.getByLabel('Fecha de marcaciones').inputValue();const prev=new Date(Date.parse(day+'T12:00:00-05:00')-86400000).toISOString().slice(0,10);
 await page.getByLabel('Fecha de marcaciones').fill(prev);await page.getByText('1 registros',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Recientes',exact:true}).click();await page.getByText('3 registros · últimos 500',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Hoy',exact:true}).click();await page.getByText('2 registros',{exact:true}).waitFor();
 await page.screenshot({path:'tmp/marks-day-20261030.png',fullPage:true});
 await page.getByRole('button',{name:'Reportes',exact:true}).click();await page.getByRole('button',{name:'Descargar Excel'}).waitFor({state:'visible'});
 await page.waitForFunction(()=>window.calls.filter(c=>c.kind==='get').length===2);
 await page.getByRole('button',{name:'Día',exact:true}).click();
 await page.getByRole('cell',{name:'Persona sin marca',exact:true}).waitFor();
 const before=await page.evaluate(()=>window.calls.length);
 const save=async(name,file)=>{const event=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();await(await event).saveAs(file);};
 await save('Descargar Excel','tmp/pdfs/reporte-dia.xlsx');
 const book=new ExcelJS.Workbook();await book.xlsx.readFile('tmp/pdfs/reporte-dia.xlsx');
 assert.equal(book.getWorksheet('Resumen asistencia').rowCount,3);assert.equal(book.getWorksheet('Detalle marcaciones').rowCount,3);
 assert.equal(book.getWorksheet('Resumen asistencia').getRows(2,2).find(row=>row.getCell('B').value==='Prueba Persona').getCell('E').value,'05:55');
 await save('Descargar PDF','tmp/pdfs/reporte-dia-resumen.pdf');
 await page.screenshot({path:'tmp/report-summary-20261030.png',fullPage:true});
 await page.getByRole('button',{name:'Detalle de marcaciones',exact:true}).click();
 await save('Descargar PDF','tmp/pdfs/reporte-dia-detalle.pdf');
 assert.equal(await page.evaluate(()=>window.calls.length),before,'layout/export should not add queries');
 await page.getByRole('button',{name:'Mes',exact:true}).click();await page.getByRole('button',{name:'Resumen por persona',exact:true}).click();
 await save('Descargar PDF','tmp/pdfs/reporte-mes-resumen.pdf');
 await save('Descargar Excel','tmp/pdfs/reporte-mes.xlsx');
 const monthly=new ExcelJS.Workbook();await monthly.xlsx.readFile('tmp/pdfs/reporte-mes.xlsx');assert.equal(monthly.getWorksheet('Resumen asistencia').rowCount,3);assert.equal(monthly.getWorksheet('Detalle marcaciones').rowCount,4);
 await page.evaluate(()=>window.largeReport=true);await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('cell',{name:'Persona de prueba con nombre y apellidos extensos 74',exact:true}).waitFor();
 await save('Descargar PDF','tmp/pdfs/reporte-mes-multipagina.pdf');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:'tmp/report-mobile-20261030.png'});
 assert.deepEqual(errors,[]);console.log('OK: day/recent queries, prior-date filter, summary/detail, daily/monthly Excel and PDF, no extra reads for layout/export; 0 JS errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
