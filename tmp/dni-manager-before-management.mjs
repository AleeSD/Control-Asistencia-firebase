import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import ts from 'typescript';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,Timestamp,updateDoc} from 'firebase/firestore';
let env,roster,store;const id='manager',dni='23456789';const runtime=new URL('./.dni-roster-runtime.mjs',import.meta.url);
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-dni-manager',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',id),{role:'encargado',active:true,email:'manager@gmail.com'}));
 store=env.authenticatedContext(id,{email:'manager@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 globalThis.__dniRoster={auth:{currentUser:{uid:id,isAnonymous:false}},db:store};
 const code=readFileSync('src/roster.ts','utf8').replace('import { auth, db } from "./firebase";','const {auth,db}=globalThis.__dniRoster;');
 writeFileSync(runtime,ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);roster=await import(runtime.href);
});

test('existing Monitoreo can be approved without admitting new Monitoreo roster entries',async()=>{
 const legacyDni='34567890';
 const entry={dni:legacyDni,firstNames:'Persona',lastNameP:'Legado',lastNameM:'OS',displayName:'Persona Legado OS',companies:['OS'],occupation:'CONDUCTOR DE CAMION',location:'LIMA',active:true,scheduleStart:'08:00',scheduleEnd:'17:00',graceMinutes:0,contactPhone:'',contactEmail:''};
 await roster.savePersonnel(entry);
 await env.withSecurityRulesDisabled(async c=>{
  await updateDoc(doc(c.firestore(),'personnel',legacyDni),{occupation:'MONITOREO'});
  await setDoc(doc(c.firestore(),'registrationRequests','legacy-applicant'),{dni:legacyDni,firstNames:'Persona',surnames:'Legado',contactPhone:'999111222',contactEmail:'',status:'pendiente',createdAt:Timestamp.now()});
 });
 const person=()=>getDoc(doc(store,'personnel',legacyDni));
 await roster.approveRegistration({id:'legacy-applicant'},{id:legacyDni,...(await person()).data()});
 assert.equal((await person()).data().occupation,'MONITOREO');
 assert.equal((await person()).data().approvedUid,'legacy-applicant');
 assert.equal((await getDoc(doc(store,'workerDirectory',legacyDni))).data().approved,true);
 // The exception preserves an existing occupation; it cannot add or reclassify staff.
 await assert.rejects(roster.savePersonnel({...entry,dni:'45678901',occupation:'MONITOREO'}));
 const other={...entry,dni:'56789012'};await roster.savePersonnel(other);
 await assertFails(updateDoc(doc(store,'personnel',other.dni),{occupation:'MONITOREO'}));
 await roster.removeWorkerAccess({id:legacyDni,...(await person()).data()});
 assert.equal((await getDoc(doc(store,'workerDirectory',legacyDni))).data().approved,false);
});
after(async()=>{if(env)await env.cleanup();try{unlinkSync(runtime)}catch{}});
test('manager lifecycle keeps projections, approval and revocation consistent',async()=>{
 const entry={dni,firstNames:'Persona',lastNameP:'Prueba',lastNameM:'OS',displayName:'Persona Prueba OS',companies:['OS'],occupation:'CONDUCTOR DE CAMION',location:'LIMA',active:true,scheduleStart:'06:10',scheduleEnd:null,graceMinutes:0,contactPhone:'',contactEmail:''};
 await roster.savePersonnel(entry);
 assert.equal((await getDoc(doc(store,'workerDirectory',dni))).data().approved,false);
 const req={id:'applicant',dni,firstNames:'Persona',surnames:'Prueba OS',contactPhone:'999111222',contactEmail:'',status:'pendiente',createdAt:Timestamp.now()};
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'registrationRequests',req.id),req));
 const getPerson=async()=>({id:dni,...(await getDoc(doc(store,'personnel',dni))).data()});
 await roster.approveRegistration(req,await getPerson());assert.equal((await getDoc(doc(store,'workerDirectory',dni))).data().approved,true);
 await roster.savePersonnel({...entry,scheduleStart:'07:00'});assert.equal((await getDoc(doc(store,'workerPanels',dni))).data().scheduleStart,'07:00');assert.equal((await getPerson()).approvedUid,req.id);
 const anon=env.authenticatedContext('new-device',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 await assertFails(updateDoc(doc(anon,'workerDirectory',dni),{approved:true}));
 await roster.savePersonnel({...entry,active:false});assert.equal((await getDoc(doc(store,'workerDirectory',dni))).data().active,false);
 await roster.removeWorkerAccess(await getPerson());assert.equal((await getDoc(doc(store,'workerDirectory',dni))).data().approved,false);
 await roster.deletePersonnel(await getPerson());assert.equal((await getDoc(doc(store,'workerDirectory',dni))).exists(),false);assert.equal((await getDoc(doc(store,'workerPanels',dni))).exists(),false);
});
