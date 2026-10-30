import { useEffect, useState } from "react";
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
    try {const next=await enterDni(dni); if(next.state==="unknown")setUnknown(true); else if(next.state==="inactive")setError("Tu acceso está desactivado. Comunícate con el coordinador de tu operación o con Monitoreo.");else {if(result?.uid!==next.uid||result?.state!==next.state)setRequest(undefined);setResult(next);}}
    catch(cause){setError(messageOf(cause));}finally{setBusy(false);}
  }
  function leave(){setBusy(true);setResult(null);setRequest(undefined);setDni("");setError("");void leaveWorker().catch(()=>{}).finally(()=>setBusy(false));}
  useEffect(()=>{if(!db||result?.state!=="register")return;return onSnapshot(doc(db,"registrationRequests",result.uid),{includeMetadataChanges:true},snap=>{if(!snap.metadata.hasPendingWrites)setRequest(snap.exists()?{id:snap.id,...snap.data()} as RegistrationRequest:null);},cause=>setError(messageOf(cause)));},[result?.uid,result?.state]);
  if(result?.state==="ready")return <WorkerHome key={result.uid+result.dni} uid={result.uid} dni={result.dni} onLeave={leave}/>;
  if(result?.state==="register")return <div className="worker-page"><div className="worker-card"><WorkerBrand/>
    {request===undefined?<p>Comprobando solicitud…</p>:request?.status==="pendiente"||request?.status==="aprobada"?<><h1>{request.status==="aprobada"?"Acceso aprobado":"Esperando aprobación"}</h1><p>Tu solicitud fue recibida. Una vez aprobada podrás ingresar con tu DNI desde cualquier celular.</p><button className="worker-mark-button" disabled={busy} onClick={enter}>{busy?"Comprobando…":"Comprobar acceso"}</button></>:<><h1>Solicita tu acceso</h1><p className="worker-intro">Completa tus datos. El encargado aprobará tu acceso una sola vez.</p>{request?.status==="rechazada"&&<p className="worker-warning">Revisa tus datos. {request.resolutionNote}</p>}<RegistrationForm initial={request??{dni:result.dni} as RegistrationRequest} onDone={()=>{}}/></>}
    {error&&<p className="worker-warning" role="alert">{error}</p>}<button className="worker-text-button" onClick={leave}>Volver al ingreso</button>
  </div></div>;
  return <div className="worker-page"><div className="worker-card"><WorkerBrand/><span className="worker-eyebrow">MI ASISTENCIA</span><h1>Ingresa tu DNI</h1><p className="worker-intro">Si ya tienes aprobación, ingresa para marcar tu entrada o salida.</p>
    <form className="worker-form" onSubmit={e=>{e.preventDefault();void enter();}}><label>DNI<input autoFocus required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" value={dni} onChange={e=>setDni(e.target.value.replace(/\D/g,""))} placeholder="8 dígitos"/></label><button className="worker-mark-button" disabled={busy}>{busy?"Comprobando…":"Ingresar"}<ArrowRight size={23}/></button></form>
    {error&&<p className="worker-warning" role="alert">{error}</p>}<p className="worker-muted">¿Primera vez? Ingresa tu DNI para solicitar la aprobación.</p><button className="worker-text-button" onClick={onBack}>Acceso del encargado</button>
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
  return <div className="worker-page"><main className="worker-card worker-home">
    <WorkerBrand /><button className="worker-text-button" onClick={onLeave}>Salir</button>
    <span className="worker-eyebrow">MI ASISTENCIA</span>
    <h1>Hola, {person.displayName.split(" ")[0]}</h1>
    <p className="worker-date">{new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
    <p className="worker-schedule">Entrada prevista: {person.scheduleStart} · Salida: {person.scheduleEnd || "horario variable"}</p>
    <div className="worker-times"><div><span>Entrada</span><strong>{hour(entry?.occurredAt?.toDate())}</strong></div><div><span>Salida</span><strong>{hour(departure?.occurredAt?.toDate())}</strong></div></div>
    <button className="worker-mark-button" disabled={busy || !marksReady || Boolean(departure)} onClick={() => { setLocationError(""); setShowLocationPrompt(true); void mark(); }}>
      {busy ? "Registrando…" : departure ? "Jornada completada" : label}
      {!departure && <ArrowRight size={23} />}
    </button>
    {notice && <div className="worker-notice" role="status">{notice}</div>}
    <p className="worker-explain"><MapPin size={16} /> La ubicación es obligatoria para guardar cada marcación.</p>
    <p className="worker-explain"><CheckCircle2 size={16} /> La hora oficial se toma del servidor.</p>
    <div className="worker-divider" />
    <button className="worker-text-button" onClick={() => setShowIncident(!showIncident)}>{showIncident ? "Cerrar solicitud" : "¿Olvidaste una marcación?"}</button>
    {showIncident && <IncidentForm profile={profile} person={person} onDone={() => { setShowIncident(false); setNotice("Solicitud enviada al encargado."); }} />}
    {showIncident && incidents.length > 0 && <div className="worker-incidents"><strong>Mis solicitudes recientes</strong>{incidents.slice(0, 3).map(i => <p key={i.id}>{i.dayKey} · {i.type} · {i.status}</p>)}</div>}
    {showLocationPrompt && <LocationPrompt type={nextType} busy={busy} error={locationError} automatic onConfirm={mark} onClose={() => setShowLocationPrompt(false)} />}
  </main></div>;
}
function WorkerBrand() { return <div className="worker-brand"><div><Truck size={22} /></div><strong>O.S. LOGISTICS</strong></div>; }

function RegistrationForm({ initial, onDone }: { initial: RegistrationRequest | null; onDone: () => void }) {
  const [dni, setDni] = useState(initial?.dni ?? "");
  const [firstNames, setFirstNames] = useState(initial?.firstNames ?? "");
  const [surnames, setSurnames] = useState(initial?.surnames ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await submitRegistration({ dni, firstNames, surnames, contactPhone, contactEmail }); onDone(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  return <form className="worker-form" onSubmit={submit}>
    <label>DNI<input readOnly required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ""))} placeholder="8 dígitos" /></label>
    <label>Nombres<input required autoComplete="given-name" value={firstNames} onChange={e => setFirstNames(e.target.value)} placeholder="Tus nombres" /></label>
    <label>Apellidos<input required autoComplete="family-name" value={surnames} onChange={e => setSurnames(e.target.value)} placeholder="Tus apellidos" /></label>
    <p className="worker-form-help">Ingresa al menos un dato de contacto:</p>
    <label>Celular (opcional si ingresas correo)<input inputMode="tel" type="tel" autoComplete="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Tu número" /></label>
    <label>Correo (opcional si ingresas celular)<input type="email" autoComplete="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="tu@correo.com" /></label>
    {error && <div className="worker-warning">{error}</div>}
    <button className="worker-mark-button" disabled={busy}>{busy ? "Enviando…" : "Enviar para aprobación"}<ArrowRight size={20} /></button>
  </form>;
}

function IncidentForm({ profile, person, onDone }: { profile: Profile; person: WorkerPerson; onDone: () => void }) {
  const [day, setDay] = useState(limaDay());
  const [type, setType] = useState<"entrada" | "salida">("entrada");
  const [time, setTime] = useState("08:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await submitWorkerIncident(profile, person, { dayKey: day, type, proposedAt: `${day}T${time}:00-05:00`, reason }); onDone(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  return <form className="worker-form worker-incident-form" onSubmit={submit}>
    <label>Fecha<input required type="date" max={limaDay()} value={day} onChange={e => setDay(e.target.value)} /></label>
    <label>Marcación<select value={type} onChange={e => setType(e.target.value as "entrada" | "salida")}><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label>
    <label>Hora correcta<input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
    <label>¿Qué ocurrió?<textarea required minLength={5} maxLength={1000} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error && <div className="worker-warning">{error}</div>}
    <button className="worker-mark-button" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}<ArrowRight size={20} /></button>
  </form>;
}
