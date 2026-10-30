import {readFileSync} from 'node:fs';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,updateDoc,writeBatch,Timestamp,serverTimestamp} from 'firebase/firestore';
let env;const dni='12345678',anon={firebase:{sign_in_provider:'anonymous'}};
const person={dni,displayName:'Persona Prueba',active:true,approvedUid:'legacy',scheduleStart:'06:10',scheduleEnd:null,graceMinutes:0};
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const db=uid=>env.authenticatedContext(uid,anon).firestore();
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-dni-access',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'personnel',dni),person);await setDoc(doc(d,'users','legacy'),{personnelId:dni,role:'trabajador',active:true,createdAt:Timestamp.fromMillis(Date.now()-3600000)});await setDoc(doc(d,'workerDirectory',dni),{active:true,approved:true});const {approvedUid,...panel}=person;await setDoc(doc(d,'workerPanels',dni),panel);});
});
after(async()=>{if(env)await env.cleanup()});
test('DNI lookup has minimal data, denies listing and private roster',async()=>{
 const d=db('visitor');assert.deepEqual((await assertSucceeds(getDoc(doc(d,'workerDirectory',dni)))).data(),{active:true,approved:true});
 assert.equal((await assertSucceeds(getDoc(doc(d,'workerDirectory','99999999')))).exists(),false);
 await assertFails(getDocs(collection(d,'workerDirectory')));await assertFails(getDoc(doc(d,'personnel',dni)));await assertFails(getDoc(doc(d,'workerPanels',dni)));
 await assertFails(setDoc(doc(d,'workerDirectory','99999999'),{active:true,approved:true}));
});
test('approved DNI works on fresh UID; rejects identity changes, roles and unapproved DNI',async()=>{
 const d=db('fresh');await assertSucceeds(setDoc(doc(d,'workerSessions','fresh'),{personnelId:dni,createdAt:serverTimestamp()}));
 assert.equal((await assertSucceeds(getDoc(doc(d,'workerPanels',dni)))).data().displayName,person.displayName);
 await assertFails(getDoc(doc(d,'personnel',dni)));await assertFails(getDoc(doc(d,'workerPanels','99999999')));
 await assertFails(updateDoc(doc(d,'workerSessions','fresh'),{personnelId:'99999999'}));await assertFails(setDoc(doc(d,'users','fresh'),{role:'encargado',active:true}));
 await assertFails(setDoc(doc(db('bad'),'workerSessions','bad'),{personnelId:'99999999',createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db('other'),'workerSessions','fresh'),{personnelId:dni,createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db('extra'),'workerSessions','extra'),{personnelId:dni,createdAt:serverTimestamp(),role:'encargado'}));
});
const mark=(d,uid,type,extra={})=>{const id=dni+'_'+day()+'_'+type;const b=writeBatch(d);b.set(doc(d,'marks',id),{userId:uid,personnelId:dni,displayName:person.displayName,type,dayKey:day(),occurredAt:serverTimestamp(),scheduleStart:'06:10',scheduleEnd:null,graceMinutes:0,source:'web',location:{status:'captured',lat:-12,lng:-77,accuracyMeters:20},...extra});b.set(doc(d,'audit','mark_'+id),{action:'mark_attendance',actorId:uid,targetId:id,at:serverTimestamp()});return b.commit();};
test('legacy entry and DNI exit share original day; concurrent duplicate is denied',async()=>{
 await assertSucceeds(mark(db('legacy'),'legacy','entrada'));
 const d=db('new-device');await setDoc(doc(d,'workerSessions','new-device'),{personnelId:dni,createdAt:serverTimestamp()});
 assert.equal((await getDoc(doc(d,'marks',dni+'_'+day()+'_entrada'))).data().userId,'legacy');
 await assertFails(mark(d,'new-device','entrada'));
 await assertFails(mark(d,'new-device','salida',{location:{status:'unavailable'}}));
 await assertSucceeds(mark(d,'new-device','salida'));await assertFails(mark(d,'new-device','salida'));
});
test('session expiry and roster baja revoke access, including existing session',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'workerSessions','expired'),{personnelId:dni,createdAt:Timestamp.fromMillis(Date.now()-13*3600000)}));
 await assertFails(getDoc(doc(db('expired'),'workerPanels',dni)));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'personnel',dni),{active:false}));
 await assertFails(getDoc(doc(db('fresh'),'workerPanels',dni)));
 await assertFails(setDoc(doc(db('baja'),'workerSessions','baja'),{personnelId:dni,createdAt:serverTimestamp()}));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'personnel',dni),{active:true}));
});
test('reapproval invalidates old sessions without losing approval for new sessions',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users','replacement'),{personnelId:dni,role:'trabajador',active:true,createdAt:Timestamp.now()});await updateDoc(doc(c.firestore(),'personnel',dni),{approvedUid:'replacement'});});
 await assertFails(getDoc(doc(db('fresh'),'workerPanels',dni)));
 const d=db('reapproved');await assertSucceeds(setDoc(doc(d,'workerSessions','reapproved'),{personnelId:dni,createdAt:serverTimestamp()}));await assertSucceeds(getDoc(doc(d,'workerPanels',dni)));
});
