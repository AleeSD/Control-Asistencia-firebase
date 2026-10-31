import {readFileSync,writeFileSync} from 'node:fs';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,deleteDoc,Timestamp,onSnapshot} from 'firebase/firestore';
let env;const projectId='demo-null-guards',dni='12345678';
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(process.env.RULES_FILE??'firestore.rules','utf8')}});await env.clearFirestore()});
after(async()=>{try{const r=await fetch('http://127.0.0.1:8080/emulator/v1/projects/'+projectId+':ruleCoverage');assert(r.ok);const report=await r.json();writeFileSync('tmp/null-guard-coverage-'+(process.env.COVERAGE_TAG??'after')+'.json',JSON.stringify(report));const causes=[];function walk(value){if(!value||typeof value!=='object')return;if(value.causeMessage)causes.push(value.causeMessage);for(const item of Object.values(value))walk(item)}walk(report.report);if(process.env.COVERAGE_TAG!=='before')assert.deepEqual(causes,[],'Missing/inactive identities must deny without evaluation errors');}finally{await env.cleanup()}});
test('fresh/missing legacy profiles fail closed; revoked sessions stop active listeners',async()=>{
 const visitor=env.authenticatedContext('no-profile',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 await assertFails(getDoc(doc(visitor,'workerPanels',dni)));
 await assertFails(getDoc(doc(visitor,'marks',dni+'_2026-10-31_entrada')));
 await assertFails(getDoc(doc(visitor,'personnel',dni)));
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();await setDoc(doc(db,'personnel',dni),{dni,active:true,approvedUid:'old',displayName:'Persona Demo'});
  await setDoc(doc(db,'users','old'),{role:'trabajador',active:true,personnelId:dni,createdAt:Timestamp.fromMillis(0)});
  await setDoc(doc(db,'workerSessions','temporary'),{personnelId:dni,createdAt:Timestamp.now()});
  await setDoc(doc(db,'workerPanels',dni),{dni,active:true});
 });
 const client=env.authenticatedContext('temporary',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 let resolveReady,resolveDenied;const ready=new Promise(r=>resolveReady=r),denied=new Promise(r=>resolveDenied=r);
 const stop=onSnapshot(doc(client,'workerPanels',dni),()=>resolveReady(),e=>resolveDenied(e));
 try{await ready;await env.withSecurityRulesDisabled(async c=>{await deleteDoc(doc(c.firestore(),'workerSessions','temporary'));await setDoc(doc(c.firestore(),'workerPanels',dni),{dni,active:true,changed:true});});const e=await denied;assert.equal(e.code,'permission-denied');}finally{stop()}
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'personnel',dni),{dni,active:true,approvedUid:null}));
 await assertFails(setDoc(doc(visitor,'workerSessions','no-profile'),{personnelId:dni,createdAt:Timestamp.now()}));
});
test('unknown Gmail is denied cleanly; private identity manager without public email still works',async()=>{
 const user=env.authenticatedContext('new-google',{email:'new@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 await assertFails(getDoc(doc(user,'workerPanels',dni)));
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users','new-google'),{active:true,role:'encargado'});await setDoc(doc(c.firestore(),'privateIdentities','new-google'),{email:'new@gmail.com'})});
 assert.equal((await getDoc(doc(user,'workerPanels',dni))).exists(),true);
});
