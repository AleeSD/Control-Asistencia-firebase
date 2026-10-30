import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/transporte.ope3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const env=await initializeTestEnvironment({projectId:'demo-os-logistics',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 await env.clearFirestore();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174');await page.getByRole('heading',{name:'Ingresa tu DNI'}).waitFor();
 const uid=await page.evaluate(async()=>{const f=await import('/src/firebase.ts');const a=await import('/node_modules/.vite/deps/firebase_auth.js');const r=await a.signInWithCredential(f.auth,a.GoogleAuthProvider.credential(JSON.stringify({sub:'manager-ui',email:'manager@gmail.com',email_verified:true})));return r.user.uid});
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',uid),{role:'encargado',active:true,email:'manager@gmail.com',displayName:'Encargado Demo',scheduleStart:'08:00',graceMinutes:0}));
 await page.getByRole('button',{name:'Equipo',exact:true}).click();await page.getByRole('button',{name:'Agregar persona',exact:true}).click();
 await page.getByLabel('Ocupación',{exact:false}).selectOption('MONITOREO');assert.equal(await page.getByLabel('Ocupación',{exact:false}).inputValue(),'MONITOREO');
 await page.getByLabel('Ocupación',{exact:false}).selectOption('COORDINADOR');
 await page.getByLabel('DNI',{exact:true}).fill('12341234');await page.getByLabel('Nombres',{exact:true}).fill('Persona');await page.getByLabel('Apellido paterno',{exact:true}).fill('Demo');
 await page.screenshot({path:'tmp/management-occupations.png'});await page.getByRole('button',{name:'Guardar',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'12341234'});await row.waitFor();assert.match(await row.innerText(),/COORDINADOR/);
 await row.getByRole('button',{name:'Eliminar del padrón',exact:true}).click();await page.getByRole('dialog').waitFor();await page.screenshot({path:'tmp/management-delete.png'});
 await page.getByRole('button',{name:'Confirmar eliminación',exact:true}).click();await row.waitFor({state:'detached'});
 await env.withSecurityRulesDisabled(async c=>assert.equal((await getDoc(doc(c.firestore(),'personnel','12341234'))).exists(),false));
 assert.deepEqual(errors,[]);console.log('PASS: manager Google emulator session, both occupation options, create coordinator, direct confirmed roster deletion. No production calls.');
}finally{await browser.close();await env.cleanup()}
