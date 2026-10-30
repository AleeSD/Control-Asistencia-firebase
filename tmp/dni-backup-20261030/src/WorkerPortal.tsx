import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { onSnapshot, collection, doc, limit, orderBy, query, where } from "firebase/firestore";
import { signOut, type User } from "firebase/auth";
import { ArrowRight, CheckCircle2, Clock3, MapPin, Truck } from "lucide-react";
import { auth, db } from "./firebase";
import LocationPrompt from "./LocationPrompt";
import { getMarkLocation, limaDay, markWorkerAttendance, submitRegistration, submitWorkerIncident } from "./workerActions";
import type { Incident, Mark, Personnel, Profile, RegistrationRequest } from "./types";
import "./worker.css";

const hour = (date?: Date) => date ? new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "—";
const messageOf = (error: unknown) => (error as { message?: string })?.message?.includes("permission")
  ? "No se pudo completar la acción. Consulta al encargado."
  : (error as { message?: string })?.message ?? "Ocurrió un error. Intenta de nuevo.";

export default function WorkerPortal({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [request, setRequest] = useState<RegistrationRequest | null | undefined>(undefined);
  const [person, setPerson] = useState<Personnel | null | undefined>(undefined);
  const [marksReady, setMarksReady] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [today, setToday] = useState(limaDay());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showIncident, setShowIncident] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!db) return;
    const stopProfile = onSnapshot(doc(db, "users", user.uid), snap =>
      setProfile(snap.exists() ? { id: snap.id, ...snap.data() } as Profile : null),
      () => setProfile(null));
    return stopProfile;
  }, [user.uid]);

  useEffect(() => {
    if (!db || profile === undefined || profile) return;
    const stopRequest = onSnapshot(doc(db, "registrationRequests", user.uid), snap =>
      setRequest(snap.exists() ? { id: snap.id, ...snap.data() } as RegistrationRequest : null),
      () => setRequest(null));
    return stopRequest;
  }, [user.uid, profile]);

  useEffect(() => {
    if (!db || !profile?.personnelId) return;
    return onSnapshot(doc(db, "personnel", profile.personnelId), snap =>
      setPerson(snap.exists() ? { id: snap.id, ...snap.data() } as Personnel : null),
      () => setPerson(null));
  }, [profile?.personnelId, user.uid]);

  useEffect(() => {
    if (!db || !profile?.active || !profile.personnelId || !person?.active || person.approvedUid !== user.uid) return;
    setMarks([]); setMarksReady(false);
    const loaded = new Set<string>();
    const stops = (["entrada", "salida"] as const).map(type => {
      const id = profile.personnelId + "_" + today + "_" + type;
      return onSnapshot(doc(db!, "marks", id), snap => {
        setMarks(current => [...current.filter(m => m.id !== id), ...(snap.exists() ? [{ id: snap.id, ...snap.data() } as Mark] : [])]);
        loaded.add(type); setMarksReady(loaded.size === 2);
      }, error => { setMarksReady(false); setNotice(messageOf(error)); });
    });
    return () => stops.forEach(stop => stop());
  }, [profile?.personnelId, profile?.active, person?.active, person?.approvedUid, user.uid, today]);

  useEffect(() => {
    if (!db || !profile?.active || !profile.personnelId || !person?.active || person.approvedUid !== user.uid) return;
    return onSnapshot(query(collection(db, "incidents"), where("personnelId", "==", profile.personnelId), orderBy("createdAt", "desc"), limit(3)),
      snap => setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Incident))),
      error => setNotice(messageOf(error)));
  }, [profile?.personnelId, profile?.active, person?.active, person?.approvedUid, user.uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(limaDay()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const entry = marks.find(m => m.dayKey === today && m.type === "entrada");
  const departure = marks.find(m => m.dayKey === today && m.type === "salida");
  const nextType = entry ? "salida" : "entrada";
  const label = entry ? "Marcar salida" : "Marcar entrada";

  async function mark() {
    if (!profile || !person || departure || busy) return;
    setBusy(true); setLocationError("");
    try {
      const location = await getMarkLocation();
      await markWorkerAttendance(profile, person, nextType, location);
      setShowLocationPrompt(false);
      setNotice(`${nextType === "entrada" ? "Entrada" : "Salida"} registrada correctamente con ubicación.`);
    } catch (error) { setLocationError(messageOf(error)); }
    finally { setBusy(false); }
  }

  if (profile === undefined || (!profile && request === undefined)) return <div className="worker-loading">Cargando asistencia…</div>;

  if (!profile && request?.status !== "pendiente" && request?.status !== "aprobada") return <div className="worker-page"><div className="worker-card">
    <WorkerBrand />
    <span className="worker-eyebrow">PRIMER INGRESO</span>
    <h1>Registra este celular</h1>
    <p className="worker-intro">Completa tus datos una sola vez. El encargado los revisará para habilitar tus marcaciones.</p>
    {request?.status === "rechazada" && <div className="worker-warning">El encargado pidió revisar tus datos.{request.resolutionNote ? ` Motivo: ${request.resolutionNote}` : ""}</div>}
    <RegistrationForm initial={request ?? null} onDone={() => setNotice("Solicitud enviada. Espera la aprobación del encargado.")} />
    {notice && <div className="worker-notice">{notice}</div>}
    <button className="worker-text-button" onClick={() => signOut(auth!)}>Volver al inicio</button>
  </div></div>;

  if (!profile) return <div className="worker-page"><div className="worker-card worker-center"><WorkerBrand />
    <div className="worker-status-icon"><Clock3 size={34} /></div>
    <h1>Esperando aprobación</h1>
    <p>Tu solicitud ya llegó al encargado. Cuando apruebe este celular, aquí aparecerá el botón para marcar.</p>
    <p className="worker-muted">Puedes cerrar la página y volver más tarde desde este mismo celular.</p>
  </div></div>;

  if (person === undefined) return <div className="worker-loading">Comprobando acceso…</div>;
  if (!profile.active || !person?.active || person.approvedUid !== user.uid) return <div className="worker-page"><div className="worker-card worker-center"><WorkerBrand />
    <h1>Acceso desactivado</h1><p>Consulta al encargado para volver a usar el sistema.</p>
  </div></div>;

  return <div className="worker-page"><main className="worker-card worker-home">
    <WorkerBrand />
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
    {incidents.length > 0 && <div className="worker-incidents"><strong>Mis solicitudes recientes</strong>{incidents.slice(0, 3).map(i => <p key={i.id}>{i.dayKey} · {i.type} · {i.status}</p>)}</div>}
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
    <label>DNI<input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ""))} placeholder="8 dígitos" /></label>
    <label>Nombres<input required autoComplete="given-name" value={firstNames} onChange={e => setFirstNames(e.target.value)} placeholder="Tus nombres" /></label>
    <label>Apellidos<input required autoComplete="family-name" value={surnames} onChange={e => setSurnames(e.target.value)} placeholder="Tus apellidos" /></label>
    <p className="worker-form-help">Ingresa al menos un dato de contacto:</p>
    <label>Celular (opcional si ingresas correo)<input inputMode="tel" type="tel" autoComplete="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Tu número" /></label>
    <label>Correo (opcional si ingresas celular)<input type="email" autoComplete="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="tu@correo.com" /></label>
    {error && <div className="worker-warning">{error}</div>}
    <button className="worker-mark-button" disabled={busy}>{busy ? "Enviando…" : "Enviar para aprobación"}<ArrowRight size={20} /></button>
  </form>;
}

function IncidentForm({ profile, person, onDone }: { profile: Profile; person: Personnel; onDone: () => void }) {
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
