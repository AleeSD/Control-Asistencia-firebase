import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import ts from 'typescript';import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,getDocs,collection,query,where,updateDoc,Timestamp,serverTimestamp,writeBatch} from 'firebase/firestore';
let env,admin,monitor,adminActions,actions,roster,adminRoster;const email='monitor@example.com',uid='monitor',dni='12345678',files=[];
const googleToken=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
const token=email=>({email,email_verified:false,firebase:{sign_in_provider:'password'}});
async function moduleFor(file,db,id,email){const key='__monitor'+files.length;globalThis[key]={auth:{currentUser:{uid:id,email,emailVerified:id==='admin',isAnonymous:false,providerData:[{providerId:id==='admin'?'google.com':'password'}]}},db};const source=readFileSync('src/'+file+'.ts','utf8').replace('import { auth, db } from "./firebase";',`const {auth,db}=globalThis.${key};`);const path=new URL('./.monitor-password-'+files.length+'.mjs',import.meta.url);files.push(path);writeFileSync(path,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);return import(path.href)}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-monitor-password',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users','admin'),{email:'admin@gmail.com',role:'encargado',active:true,displayName:'Admin'}));admin=env.authenticatedContext('admin',googleToken('admin@gmail.com')).firestore();monitor=env.authenticatedContext(uid,token(email)).firestore();adminActions=await moduleFor('actions',admin,'admin','admin@gmail.com');actions=await moduleFor('actions',monitor,uid,email);roster=await moduleFor('roster',monitor,uid,email);adminRoster=await moduleFor('roster',admin,'admin','admin@gmail.com')});
after(async()=>{await env.cleanup();for(const file of files)unlinkSync(file)});
const entry={dni,firstNames:'Persona',lastNameP:'Demo',lastNameM:'OS',displayName:'Persona Demo OS',companies:['OS'],occupation:'CONDUCTOR DE CAMION',location:'LIMA',active:true,scheduleStart:'06:10',scheduleEnd:null,graceMinutes:0,contactPhone:'',contactEmail:''};
test('password monitor requires provisioned profile, cannot self-claim invitation, become manager or invite others',async()=>{
 await adminActions.call('inviteUser',{email,displayName:'OSMonitor',role:'monitor',scheduleStart:'08:00',graceMinutes:0});
 await assert.rejects(actions.call('claimAccess'));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',uid),{email,displayName:'OSMonitor',role:'monitor',authMethod:'password',active:true,scheduleStart:'08:00',graceMinutes:0}));
 await actions.call('claimAccess');assert.equal((await getDoc(doc(monitor,'users',uid))).data().role,'monitor');
 await assertFails(updateDoc(doc(monitor,'users',uid),{role:'encargado'}));
 await assert.rejects(actions.call('inviteUser',{email:'other@gmail.com',role:'encargado'}));
 const uninvited=env.authenticatedContext('outsider',token('other@example.com')).firestore();await assertFails(getDocs(collection(uninvited,'personnel')));
});
test('monitor approves and rejects requests without editing roster, schedules, status or approved access',async()=>{
 await adminRoster.savePersonnel(entry);
 const req={id:'applicant',dni,firstNames:'Persona',surnames:'Demo OS',contactPhone:'999111222',contactEmail:'',status:'pendiente',createdAt:Timestamp.now()};
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'registrationRequests',req.id),req));
 const person=async()=>({id:dni,...(await getDoc(doc(monitor,'personnel',dni))).data()});
 await roster.approveRegistration(req,await person());assert.equal((await person()).approvedUid,req.id);
 await assertFails(roster.savePersonnel({...entry,scheduleStart:'07:00'}));await assertFails(roster.savePersonnel({...entry,dni:'87654321'}));
 await assertFails(roster.removeWorkerAccess(await person()));await assertFails(roster.removePersonnel(await person()));
 await assertFails(updateDoc(doc(monitor,'personnel',dni),{active:false}));
 const rejected={...req,id:'other-applicant',dni:'87654321'};await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'registrationRequests',rejected.id),rejected));await roster.rejectRegistration(rejected,'Datos no coinciden');
 assert.equal((await getDoc(doc(monitor,'registrationRequests',rejected.id))).data().status,'rechazada');
});
test('monitor consults operational data, resolves corrections with audit, cannot access audit/private identities or manager profiles',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'incidents','incident'),{userId:'applicant',personnelId:dni,displayName:'Persona Demo OS',dayKey:'2026-10-30',type:'entrada',markId:null,proposedAt:Timestamp.fromDate(new Date('2026-10-30T11:00:00Z')),reason:'Olvido de registro',status:'pendiente',createdAt:Timestamp.now()});});
 for(const col of ['personnel','marks','incidents','adjustments'])await getDocs(collection(monitor,col));
 await getDocs(query(collection(monitor,'users'),where('role','==','trabajador')));
 await assertFails(getDocs(collection(monitor,'users')));await assertFails(getDoc(doc(monitor,'users','admin')));
 await assertFails(getDocs(collection(monitor,'audit')));await assertFails(getDoc(doc(monitor,'privateIdentities','admin')));
 await actions.call('resolveIncident',{id:'incident',decision:'aprobar',note:'Revisado por monitoreo'});
 assert.equal((await getDoc(doc(monitor,'adjustments',dni+'_2026-10-30_entrada'))).data().approvedBy,uid);
 await assertFails(setDoc(doc(monitor,'adjustments','forged'),{approvedBy:uid}));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users',uid),{active:false}));await assertFails(getDocs(collection(monitor,'marks')));
});

test('password accounts with manager role, missing authMethod or wrong email cannot access operational data',async()=>{
 for(const [id,p] of [['pw-manager',{role:'encargado',authMethod:'password',email}],['pw-unprovisioned',{role:'monitor',email}],['pw-mismatch',{role:'monitor',authMethod:'password',email:'other@example.com'}]]){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',id),{...p,active:true}));const db=env.authenticatedContext(id,token(email)).firestore();await assertFails(getDocs(collection(db,'marks')));await assertFails(updateDoc(doc(db,'users',id),{authMethod:'password',role:'encargado'}));}
});

