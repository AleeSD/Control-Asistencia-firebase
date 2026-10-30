const fs=require('fs');let s=fs.readFileSync('src/WorkerPortal.tsx','utf8');
const forms=s.slice(s.indexOf('function WorkerBrand()')).replace('person: Personnel','person: WorkerPerson');
const panel=s.slice(s.indexOf('  return <div className="worker-page"><main'),s.indexOf('\nfunction WorkerBrand()'));
const header=`import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { onSnapshot, collection, doc, limit, orderBy, query, where } from "firebase/firestore";
import { ArrowRight, CheckCircle2, Clock3, MapPin, Truck } from "lucide-react";
import { workerDb as db } from "./firebase";
import { enterDni, leaveWorker, type DniResult, type WorkerPerson } from "./dniAccess";
import LocationPrompt from "./LocationPrompt";
import { getMarkLocation, limaDay, markWorkerAttendance, submitRegistration, submitWorkerIncident } from "./workerActions";
import type { Incident, Mark, Profile, RegistrationRequest } from "./types";
import "./worker.css";
const hour = (date?: Date) => date ? new Intl.DateTimeFormat("es-PE", {timeZone:"America/Lima",hour:"2-digit",minute:"2-digit",hour12:false}).format(date) : "—";
const messageOf = (error: unknown) => (error as {code?:string})?.code === "permission-denied" ? "No se pudo validar tu acceso. Vuelve a ingresar tu DNI o consulta con Monitoreo." : (error as {message?:string})?.message ?? "No pudimos validar tu DNI. Intenta nuevamente.";

export default function WorkerPortal({onBack}: {onBack:()=>void}) {
  const [dni,setDni]=useState(""); const [result,setResult]=useState<DniResult|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [unknown,setUnknown]=useState(false);
  const [request,setRequest]=useState<RegistrationRequest|null|undefined>(undefined);
  async function enter() {
    setBusy(true);setError("");setUnknown(false);
    try {const next=await enterDni(dni); if(next.state==="unknown")setUnknown(true); else if(next.state==="inactive")setError("Tu acceso está desactivado. Comunícate con el coordinador de tu operación o con Monitoreo.");else {setRequest(undefined);setResult(next);}}
    catch(cause){setError(messageOf(cause));}finally{setBusy(false);}
  }
  function leave(){setResult(null);setRequest(undefined);setDni("");setError("");void leaveWorker().catch(()=>{});}
  useEffect(()=>{if(!db||result?.state!=="register")return;return onSnapshot(doc(db,"registrationRequests",result.uid),snap=>setRequest(snap.exists()?{id:snap.id,...snap.data()} as RegistrationRequest:null),cause=>setError(messageOf(cause)));},[result?.uid,result?.state]);
  if(result?.state==="ready")return <WorkerHome key={result.uid+result.dni} uid={result.uid} dni={result.dni} onLeave={leave}/>;
  if(result?.state==="register")return <div className="worker-page"><div className="worker-card"><WorkerBrand/>
    {request===undefined?<p>Comprobando solicitud…</p>:request?.status==="pendiente"||request?.status==="aprobada"?<><h1>{request.status==="aprobada"?"Acceso aprobado":"Esperando aprobación"}</h1><p>Tu solicitud fue recibida. Una vez aprobada podrás ingresar con tu DNI desde cualquier celular.</p><button className="worker-mark-button" disabled={busy} onClick={enter}>{busy?"Comprobando…":"Comprobar acceso"}</button></>:<><h1>Solicita tu acceso</h1><p className="worker-intro">Completa tus datos. El encargado aprobará tu acceso una sola vez.</p>{request?.status==="rechazada"&&<p className="worker-warning">Revisa tus datos. {request.resolutionNote}</p>}<RegistrationForm initial={request??{dni:result.dni} as RegistrationRequest} onDone={()=>{}}/></>}
    {error&&<p className="worker-warning" role="alert">{error}</p>}<button className="worker-text-button" onClick={leave}>Volver al ingreso</button>
  </div></div>;
  return <div className="worker-page"><div className="worker-card"><WorkerBrand/><span className="worker-eyebrow">MI ASISTENCIA</span><h1>Ingresa tu DNI</h1><p className="worker-intro">Si ya tienes aprobación, ingresa para marcar tu entrada o salida.</p>
    <form className="worker-form" onSubmit={e=>{e.preventDefault();void enter();}}><label>DNI<input autoFocus required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" value={dni} onChange={e=>setDni(e.target.value.replace(/\\D/g,""))} placeholder="8 dígitos"/></label><button className="worker-mark-button" disabled={busy}>{busy?"Comprobando…":"Ingresar"}<ArrowRight size={23}/></button></form>
    {error&&<p className="worker-warning" role="alert">{error}</p>}<p className="worker-muted">¿Primera vez? Ingresa tu DNI para solicitar la aprobación.</p><button className="worker-text-button" onClick={onBack}>Volver al inicio</button>
    {unknown&&<div className="modal-backdrop"><div className="modal dni-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unknown-title" aria-describedby="unknown-help"><h2 id="unknown-title">DNI no registrado</h2><p id="unknown-help">No encontramos tu DNI en el registro del personal de la empresa. Revisa que esté bien escrito. Si es correcto, comunícate con el coordinador de tu operación o con el área de Monitoreo para que revisen tus datos.</p><button autoFocus className="worker-mark-button" onClick={()=>setUnknown(false)}>Revisar DNI</button></div></div>}
  </div></div>;
}

function WorkerHome({uid,dni,onLeave}:{uid:string;dni:string;onLeave:()=>void}) {
  const [person,setPerson]=useState<WorkerPerson|null|undefined>(undefined);
  const [expired,setExpired]=useState(false);const [marksReady,setMarksReady]=useState(false);
  const [marks,setMarks]=useState<Mark[]>([]);const [incidents,setIncidents]=useState<Incident[]>([]);
  const [today,setToday]=useState(limaDay());const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
  const [showIncident,setShowIncident]=useState(false);const [showLocationPrompt,setShowLocationPrompt]=useState(false);const [locationError,setLocationError]=useState("");
  const profile:Profile={id:uid,personnelId:dni,displayName:person?.displayName??"",role:"trabajador",active:Boolean(person?.active)&&!expired,scheduleStart:person?.scheduleStart??"06:10",graceMinutes:person?.graceMinutes??0};
  useEffect(()=>{if(!db)return;return onSnapshot(doc(db,"workerPanels",dni),snap=>setPerson(snap.exists()?snap.data() as WorkerPerson:null),()=>{setPerson(null);setMarks([]);setMarksReady(false);});},[dni,uid]);
  useEffect(()=>{if(!db)return;let timer:ReturnType<typeof setTimeout>;const stop=onSnapshot(doc(db,"workerSessions",uid),snap=>{clearTimeout(timer);const created=snap.data()?.createdAt?.toMillis();if(!created){setExpired(true);return;}const remaining=created+12*3600000-Date.now();setExpired(remaining<=0);if(remaining>0)timer=setTimeout(()=>setExpired(true),remaining);},()=>setExpired(true));return()=>{stop();clearTimeout(timer);};},[uid]);
  useEffect(()=>{if(!db||!person?.active||expired)return;setMarks([]);setMarksReady(false);const loaded=new Set<string>();const stops=(["entrada","salida"] as const).map(type=>{const id=dni+"_"+today+"_"+type;return onSnapshot(doc(db!,"marks",id),snap=>{setMarks(current=>[...current.filter(m=>m.id!==id),...(snap.exists()?[{id:snap.id,...snap.data()} as Mark]:[])]);loaded.add(type);setMarksReady(loaded.size===2);},cause=>{setMarksReady(false);setNotice(messageOf(cause));});});return()=>stops.forEach(stop=>stop());},[dni,uid,person?.active,expired,today]);
  useEffect(()=>{if(!db||!person?.active||expired||!showIncident)return;return onSnapshot(query(collection(db,"incidents"),where("personnelId","==",dni),orderBy("createdAt","desc"),limit(3)),snap=>setIncidents(snap.docs.map(d=>({id:d.id,...d.data()} as Incident))),cause=>setNotice(messageOf(cause)));},[dni,uid,person?.active,expired,showIncident]);
  useEffect(()=>{const timer=setInterval(()=>setToday(limaDay()),60000);return()=>clearInterval(timer);},[]);
  const entry=marks.find(m=>m.dayKey===today&&m.type==="entrada"),departure=marks.find(m=>m.dayKey===today&&m.type==="salida");const nextType=entry?"salida":"entrada";const label=entry?"Marcar salida":"Marcar entrada";
  async function mark(){if(!person||departure||busy||!marksReady||expired)return;setBusy(true);setLocationError("");try{const location=await getMarkLocation();await markWorkerAttendance(profile,person,nextType,location);setShowLocationPrompt(false);setNotice((nextType==="entrada"?"Entrada":"Salida")+" registrada correctamente con ubicación.");}catch(error){setLocationError(messageOf(error));}finally{setBusy(false);}}
  if(person===undefined)return <div className="worker-loading">Cargando tu asistencia…</div>;
  if(!person?.active||expired)return <div className="worker-page"><div className="worker-card"><WorkerBrand/><h1>Vuelve a ingresar</h1><p>Tu sesión terminó o tu acceso cambió. Ingresa tu DNI nuevamente. Si no puedes acceder, comunícate con Monitoreo.</p><button className="worker-mark-button" onClick={onLeave}>Ingresar DNI</button></div></div>;
`;
let result=header+panel.replace('<WorkerBrand />','<WorkerBrand /><button className="worker-text-button" onClick={onLeave}>Salir</button>').replace('{incidents.length > 0 &&','{showIncident && incidents.length > 0 &&')+forms;
result=result.replace('autoComplete="off" value={dni} onChange=', 'autoComplete="off" value={dni} onChange=');
// DNI in registration is fixed by the validated directory lookup.
result=result.replace('<label>DNI<input required inputMode="numeric"','<label>DNI<input readOnly required inputMode="numeric"');
fs.writeFileSync('src/WorkerPortal.tsx',result);
let app=fs.readFileSync('src/App.tsx','utf8');
app=app.replace('  const [user, setUser]', '  const [workerMode, setWorkerMode] = useState(false);\n  const [user, setUser]');
app=app.replace('  if (!user) return', '  if (workerMode || user?.isAnonymous) return <WorkerPortal onBack={() => { setWorkerMode(false); if (user?.isAnonymous) void signOut(auth!); }} />;\n  if (!user) return');
app=app.replace('onClick={() => auth && signInAnonymously(auth).catch(e => setNotice(err(e)))}','onClick={() => setWorkerMode(true)}');
app=app.replace('  if (user.isAnonymous) return <WorkerPortal user={user} />;','');
app=app.replace('Si trabajas en OS o SLI, registra este celular una sola vez. Después podrás marcar con un toque.','Si trabajas en OS o SLI, ingresa con tu DNI. El encargado aprueba tu acceso una sola vez.');
app=app.replace('Aprueba celulares, actualiza el padrón y gestiona las bajas.','Aprueba accesos por DNI, actualiza el padrón y gestiona las bajas.');
fs.writeFileSync('src/App.tsx',app);
