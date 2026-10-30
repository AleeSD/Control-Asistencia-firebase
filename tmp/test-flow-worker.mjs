import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,getDocs,collection,Timestamp} from 'firebase/firestore';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/transporte.ope3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const env=await initializeTestEnvironment({projectId:'demo-os-logistics',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
const dni='12345678',pending='87654321';
const seed=async(d,approved)=>env.withSecurityRulesDisabled(async c=>{
 const s=c.firestore();const p={dni:d,displayName:'Persona Demo',active:true,approvedUid:approved?'legacy':null,scheduleStart:'06:10',scheduleEnd:null,graceMinutes:0};
 await setDoc(doc(s,'personnel',d),p);await setDoc(doc(s,'workerDirectory',d),{active:true,approved});const {approvedUid,...panel}=p;await setDoc(doc(s,'workerPanels',d),panel);
 if(approved)await setDoc(doc(s,'users','legacy'),{personnelId:d,role:'trabajador',active:true,createdAt:Timestamp.fromMillis(Date.now()-3600000)});
});
await env.clearFirestore();await seed(dni,true);await seed(pending,false);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const ctx=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:-12.05,longitude:-77.04},permissions:['geolocation']});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const open=async p=>{await p.goto('http://127.0.0.1:5174');await p.getByRole('heading',{name:'Ingresa tu DNI'}).waitFor();};
const enter=async(p,d)=>{await p.getByLabel('DNI',{exact:true}).fill(d);await p.getByRole('button',{name:'Ingresar',exact:true}).click();};
try{
 await open(page);await enter(page,'99999999');await page.getByRole('alertdialog').waitFor();await page.screenshot({path:'tmp/dni-unknown.png'});
 await page.getByRole('button',{name:'Revisar DNI'}).click();await enter(page,dni);await page.getByRole('button',{name:'Marcar entrada'}).waitFor();
 await page.screenshot({path:'tmp/dni-home.png'});await page.getByRole('button',{name:'Marcar entrada'}).click();await page.getByText('Entrada registrada correctamente con ubicación.').waitFor();
 await page.reload();await page.getByRole('heading',{name:'Ingresa tu DNI'}).waitFor();await enter(page,dni);await page.getByRole('button',{name:'Marcar salida'}).waitFor();
 const ctx2=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:-12.05,longitude:-77.04},permissions:['geolocation']});const other=await ctx2.newPage();await open(other);await enter(other,dni);await other.getByRole('button',{name:'Marcar salida'}).waitFor();
 await other.getByRole('button',{name:'Marcar salida'}).click();await other.getByText('Salida registrada correctamente con ubicación.').waitFor();await page.getByRole('button',{name:'Jornada completada'}).waitFor();
 await env.withSecurityRulesDisabled(async c=>{const marks=await getDocs(collection(c.firestore(),'marks'));assert.equal(marks.size,2);const persons=await getDoc(doc(c.firestore(),'personnel',dni));assert.equal(persons.data().approvedUid,'legacy');await updateDoc(doc(c.firestore(),'personnel',dni),{active:false});await updateDoc(doc(c.firestore(),'workerPanels',dni),{active:false});});
 await page.getByRole('heading',{name:'Vuelve a ingresar'}).waitFor();
 await page.getByRole('button',{name:'Ingresar DNI',exact:true}).click();await enter(page,pending);await page.getByRole('heading',{name:'Solicita tu acceso'}).waitFor();
 await page.getByLabel('Nombres',{exact:true}).fill('Persona');await page.getByLabel('Apellidos',{exact:true}).fill('Demo');await page.getByLabel('Celular (opcional si ingresas correo)').fill('999888777');await page.getByRole('button',{name:'Enviar para aprobación'}).click();await page.getByRole('heading',{name:'Esperando aprobación'}).waitFor();
 await env.withSecurityRulesDisabled(async c=>{const s=c.firestore();const r=(await getDocs(collection(s,'registrationRequests'))).docs.find(d=>d.data().dni===pending);assert(r);await setDoc(doc(s,'users',r.id),{personnelId:pending,role:'trabajador',active:true,createdAt:Timestamp.now()});await updateDoc(doc(s,'personnel',pending),{approvedUid:r.id});await updateDoc(doc(s,'workerDirectory',pending),{approved:true});await updateDoc(r.ref,{status:'aprobada'});});
 await page.getByRole('button',{name:'Marcar entrada'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: real anonymous emulator auth, missing DNI, approval preserved across devices/reload, entry+exit GPS, baja live, registration+approval. No production calls.');
}finally{await browser.close();await env.cleanup();}
