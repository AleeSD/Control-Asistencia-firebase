const {chromium}=require('C:/Users/transporte.ope3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const mock=`
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const stamp={toDate:()=>new Date()};
const profile={id:'test-user',displayName:'Prueba',active:true,role:window.testRole==='worker'?'trabajador':'encargado',personnelId:'12345678',scheduleStart:'06:10',graceMinutes:0};
const person={id:'12345678',dni:'12345678',displayName:'Prueba Persona',active:true,approvedUid:'test-user',companies:['OS'],occupation:'CONDUCTOR DE CAMION',scheduleStart:'06:10',graceMinutes:0};
const mark={id:'12345678_'+day+'_entrada',personnelId:'12345678',displayName:'Prueba Persona',userId:'test-user',dayKey:day,type:'entrada',scheduleStart:'06:10',graceMinutes:0,occurredAt:stamp};
window.calls=[];
export const doc=(_,c,id)=>({c,id}); export const collection=(_,c)=>({c});
export const where=(...args)=>({where:args}); export const orderBy=(...args)=>({order:args}); export const limit=n=>({limit:n}); export const query=(ref,...filters)=>({...ref,filters});
function snapshot(q){let rows=[];if(q.c==='users')rows=[profile];if(q.c==='personnel')rows=[person];if(q.c==='marks')rows=q.id?(q.id.endsWith('entrada')?[mark]:[]):[mark];
return q.id?{id:q.id,exists:()=>rows.length>0,data:()=>rows[0]}:{docs:rows.map(r=>({id:r.id,data:()=>r})),size:rows.length};}
export function onSnapshot(q,cb){window.calls.push({kind:'listen',...q});let active=true;queueMicrotask(()=>{if(active)cb(snapshot(q))});return()=>{window.calls.push({kind:'stop',...q});active=false};}
export async function getDocsFromServer(q){window.calls.push({kind:'get',...q});return snapshot(q)}
export async function getDoc(q){return snapshot(q)}
export const runTransaction=async(_,fn)=>fn({get:getDoc}); export const serverTimestamp=()=>stamp; export const Timestamp={fromDate:d=>({toDate:()=>d})};
export const writeBatch=()=>{throw Error('Unexpected write')}; export const setDoc=()=>{throw Error('Unexpected write')}; export const updateDoc=setDoc;
`;
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
for(const role of ['worker','manager']){
const page=await browser.newPage({viewport:{width:role==='worker'?390:1280,height:850}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(r=>window.testRole=r,role);
await page.route('**/src/firebase.ts',route=>route.fulfill({contentType:'application/javascript',body:'export const auth={}; export const db={}; export const configured=true; export const googleProvider={};'}));
await page.route('**/firebase_auth.js*',route=>route.fulfill({contentType:'application/javascript',body:`export const onAuthStateChanged=(_,cb)=>{cb({uid:'test-user',email:'test@gmail.com',isAnonymous:window.testRole==='worker'});return()=>{}}; export const signInAnonymously=()=>{};export const signInWithPopup=()=>{};export const signOut=()=>{};`}));
await page.route('**/firebase_firestore.js*',route=>route.fulfill({contentType:'application/javascript',body:mock}));
await page.goto('http://127.0.0.1:5174');
if(role==='worker'){
await page.getByRole('button',{name:'Marcar salida'}).waitFor();assert.equal(await page.getByRole('button',{name:'Marcar salida'}).isEnabled(),true);
const calls=await page.evaluate(()=>window.calls);assert.equal(calls.filter(c=>c.kind==='listen'&&c.c==='marks').length,2);assert.equal(calls.filter(c=>c.kind==='listen'&&c.c==='registrationRequests').length,0);
}else{
await page.getByRole('heading',{name:/Hola/}).waitFor();let calls=await page.evaluate(()=>window.calls);assert.equal(calls.filter(c=>c.kind==='listen'&&c.c==='audit').length,0);
await page.getByRole('button',{name:'Reportes',exact:true}).click();await page.getByRole('button',{name:'Descargar Excel'}).waitFor();await page.waitForFunction(()=>window.calls.filter(c=>c.kind==='get').length===2);
await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.getByRole('button',{name:'Reportes',exact:true}).click();await page.waitForTimeout(150);assert.equal((await page.evaluate(()=>window.calls.filter(c=>c.kind==='get').length)),2);
await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.waitForFunction(()=>window.calls.filter(c=>c.kind==='get').length===4);
const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel'}).click();assert.match((await download).suggestedFilename(),/\.xlsx$/);
}
assert.deepEqual(errors,[]);await page.screenshot({path:'tmp/optimization-'+role+'.png'});console.log(role+': OK');await page.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
