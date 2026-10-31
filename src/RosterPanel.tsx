import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { approveRegistration, removePersonnel, importRoster, readRosterExcel, rejectRegistration, removeWorkerAccess, rosterChanged, savePersonnel, type RosterEntry } from "./roster";
import type { Personnel, RegistrationRequest } from "./types";
import "./roster.css";

const errorText = (error: unknown) => (error as { code?: string })?.code === "permission-denied"
  ? "No se pudo completar la acción por una restricción de acceso. Actualiza la página e inténtalo nuevamente; si continúa, comunícalo al administrador."
  : (error as { message?: string })?.message ?? "No se pudo completar la acción.";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

export default function RosterPanel({ personnel, canManage = true }: { personnel: Personnel[]; canManage?: boolean }) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [preview, setPreview] = useState<RosterEntry[]>([]);
  const [queryText, setQueryText] = useState("");
  const [editing, setEditing] = useState<Personnel | "new" | null>(null);
  const [rejecting, setRejecting] = useState<RegistrationRequest | null>(null);
  const [confirming, setConfirming] = useState<{ person: Personnel; action: "access" | "personnel" } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [verifiedRequestId, setVerifiedRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!db) return;
    return onSnapshot(query(collection(db, "registrationRequests"), where("status", "==", "pendiente")), snap =>
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistrationRequest))),
      error => setNotice(errorText(error)));
  }, []);

  const pending = requests.filter(r => r.status === "pendiente");
  const visible = useMemo(() => personnel.filter(p =>
    normalize(`${p.displayName} ${p.dni} ${p.companies.join(" ")}`).includes(normalize(queryText))), [personnel, queryText]);

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy("reading"); setNotice(""); setPreview([]);
    try { const entries = await readRosterExcel(file); setPreview(entries); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(""); }
  }

  async function runImport() {
    setBusy("import"); setNotice("Importando padrón…");
    try {
      const result = await importRoster(preview, done => setNotice(`Importando ${done} de ${preview.length}…`));
      setNotice(`Padrón actualizado: ${result.changed} cambios; ${result.unchanged} sin cambios. Las ausentes del archivo no se desactivaron.`);
      setPreview([]);
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(""); }
  }

  async function approve(request: RegistrationRequest, person: Personnel) {
    setBusy(request.id); setNotice("");
    try { await approveRegistration(request, person); setVerifiedRequestId(null); setNotice(`${person.displayName}: acceso aprobado.`); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(""); }
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(rejecting.id); setNotice("");
    try { await rejectRegistration(rejecting, rejectNote); setNotice("Solicitud rechazada."); setRejecting(null); setRejectNote(""); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(""); }
  }

  async function confirmRemoval() {
    if (!confirming) return;
    setBusy("removing"); setNotice("");
    try {
      if (confirming.action === "access") {
        await removeWorkerAccess(confirming.person);
        setNotice(`${confirming.person.displayName}: acceso revocado en todos los dispositivos.`);
      } else {
        await removePersonnel(confirming.person);
        setNotice(`${confirming.person.displayName}: eliminado del padrón. Las marcaciones e incidencias anteriores se conservan.`);
      }
      setConfirming(null);
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(""); }
  }

  return <div className="roster-stack">
    {notice && <div className="notice">{notice}</div>}
    <section className="panel roster-section">
      <div className="panel-heading"><div><h2>Solicitudes de acceso</h2><p>Verifica los datos antes de aprobar el acceso por DNI.</p></div><strong>{pending.length} pendientes</strong></div>
      {pending.length === 0 ? <p className="roster-empty">No hay solicitudes pendientes.</p> : <div className="request-grid">{pending.map(request => {
        const person = personnel.find(p => p.dni === request.dni);
        const nameMatches = Boolean(person && normalize(`${request.firstNames} ${request.surnames}`) === normalize(person.displayName));
        return <article className="request-card" key={request.id}>
          <div className="request-label">DATOS DECLARADOS</div>
          <h3>{request.firstNames} {request.surnames}</h3>
          <p>DNI: {request.dni}</p><p>Contacto: {request.contactPhone || request.contactEmail}</p>
          <div className={nameMatches ? "request-match" : "request-mismatch"}>
            {person ? <>Padrón: <strong>{person.displayName}</strong> · {person.companies.join("/")} · {person.active ? "Activo" : "Inactivo"}</> : "No figura en el padrón autorizado."}
          </div>
          {person?.active && !nameMatches && <><p className="request-help">Los nombres no coinciden por completo. Comprueba la identidad antes de aprobar.</p><label className="request-verify"><input type="checkbox" checked={verifiedRequestId === request.id} onChange={e => setVerifiedRequestId(e.target.checked ? request.id : null)} /> Confirmé la identidad y el DNI con el padrón, aunque los nombres no coincidan exactamente.</label></>}
          <div className="request-actions"><button className="secondary-button" disabled={Boolean(busy)} onClick={() => { setRejecting(request); setRejectNote(""); }}>Rechazar</button>
            <button className="primary-button" disabled={Boolean(busy) || !person?.active || Boolean(person?.approvedUid) || (!nameMatches && verifiedRequestId !== request.id)} onClick={() => person && approve(request, person)}>{busy === request.id ? "Aprobando…" : "Aprobar acceso"}</button></div>
        </article>;
      })}</div>}
    </section>

    <section className="panel roster-section">
      <div className="panel-heading"><div><h2>Padrón de OS y SLI</h2><p>{canManage ? "Gestiona el personal y sus accesos por DNI. Las marcaciones e incidencias se conservan." : "Consulta el personal y su estado de acceso por DNI."}</p></div>{canManage && <button className="primary-button" onClick={() => setEditing("new")}>Agregar persona</button>}</div>
      {canManage && <div className="roster-import"><label>Actualizar desde Excel <input type="file" accept=".xlsx" disabled={Boolean(busy)} onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <span>Solo se leen choferes y auxiliares de PERSONAL_OS y PERSONAL_SLI; coordinador, monitoreo y terceros quedan fuera.</span></div>}
      {preview.length > 0 && <div className="roster-preview"><strong>{preview.length} personas listas para importar</strong><p>Nuevas: {preview.filter(p => !personnel.some(c => c.dni === p.dni)).length} · Modificadas: {preview.filter(p => personnel.some(c => c.dni === p.dni) && rosterChanged(p, personnel.find(c => c.dni === p.dni))).length} · Sin cambios: {preview.filter(p => !rosterChanged(p, personnel.find(c => c.dni === p.dni))).length}</p><p>OS: {preview.filter(p => p.companies.includes("OS")).length} · SLI: {preview.filter(p => p.companies.includes("SLI")).length} · En ambas: {preview.filter(p => p.companies.length === 2).length}. Cada DNI se cuenta una sola vez.</p><div className="roster-preview-list">{preview.map(p => <div key={p.dni}><strong>{p.displayName}</strong><span>DNI {p.dni} · {p.companies.join("/")} · {p.occupation}</span></div>)}</div><p>Las personas que no figuren en este archivo conservarán su estado actual. Podrás darlas de baja en el panel.</p><button className="primary-button" disabled={Boolean(busy)} onClick={runImport}>{busy === "import" ? "Importando…" : "Importar padrón"}</button></div>}
      <div className="roster-filter"><input type="search" value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="Buscar por nombre, DNI o empresa" /><span>{visible.length} personas</span></div>
      <div className="table-scroll"><table><thead><tr><th>PERSONA</th><th>EMPRESA</th><th>OCUPACIÓN</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO</th><th>ACCESO DNI</th>{canManage && <th>ACCIONES</th>}</tr></thead><tbody>{visible.map(p => <tr key={p.dni}><td><strong>{p.displayName}</strong><br /><small>DNI {p.dni}</small></td><td>{p.companies.join("/")}</td><td>{p.occupation}</td><td>{p.scheduleStart}</td><td>{p.scheduleEnd || "Variable"}</td><td>{p.active ? "Activo" : "Baja"}</td><td>{p.approvedUid ? "Aprobado" : "Sin aprobar"}</td>{canManage && <td><div className="roster-row-actions"><button className="text-button" disabled={Boolean(busy)} onClick={() => setEditing(p)}>Editar</button>{p.approvedUid && <button className="text-button" disabled={Boolean(busy)} onClick={() => setConfirming({ person: p, action: "access" })}>Eliminar acceso</button>}{<button className="text-button roster-danger" disabled={Boolean(busy)} onClick={() => setConfirming({ person: p, action: "personnel" })}>Eliminar del padrón</button>}</div></td>}</tr>)}</tbody></table>{visible.length === 0 && <p className="roster-empty">No hay personas para mostrar.</p>}</div>
    </section>

    {canManage && editing && <PersonnelModal initial={editing === "new" ? null : editing} busy={Boolean(busy)} onClose={() => setEditing(null)} onSubmit={async data => {
      setBusy("save"); setNotice("");
      try { await savePersonnel(data); setEditing(null); setNotice("Datos del personal guardados."); }
      catch (error) { setNotice(errorText(error)); }
      finally { setBusy(""); }
    }} />}
    {rejecting && <div className="modal-backdrop" onMouseDown={() => setRejecting(null)}><div className="modal" onMouseDown={e => e.stopPropagation()}><h2>Rechazar solicitud</h2><p>El trabajador verá este motivo y podrá corregir su registro.</p><label className="modal-field">Motivo<textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} maxLength={300} /></label><div className="modal-actions"><button className="secondary-button" onClick={() => setRejecting(null)}>Cancelar</button><button className="primary-button" disabled={Boolean(busy) || !rejectNote.trim()} onClick={reject}>Rechazar</button></div></div></div>}
    {canManage && confirming && <div className="modal-backdrop" onMouseDown={() => !busy && setConfirming(null)}><div className="modal roster-confirm" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}><h2>{confirming.action === "access" ? "Revocar acceso por DNI" : "Eliminar del padrón"}</h2><p><strong>{confirming.person.displayName}</strong> · DNI {confirming.person.dni}</p><p>{confirming.action === "access" ? "Se revocará el acceso de esta persona en todos los dispositivos. Para volver a marcar necesitará una nueva aprobación. Sus marcaciones e incidencias anteriores se conservarán." : "Se eliminará a esta persona del padrón y se revocará su acceso en todos los dispositivos. Sus marcaciones e incidencias anteriores seguirán en el historial. Si permanece en el Excel, una importación futura volverá a agregarla."}</p><div className="modal-actions"><button className="secondary-button" disabled={Boolean(busy)} onClick={() => setConfirming(null)}>Cancelar</button><button className="primary-button" disabled={Boolean(busy)} onClick={confirmRemoval}>{busy ? "Eliminando…" : "Confirmar eliminación"}</button></div></div></div>}
  </div>;
}

function PersonnelModal({ initial, busy, onClose, onSubmit }: {
  initial: Personnel | null; busy: boolean; onClose: () => void;
  onSubmit: (data: RosterEntry & { active: boolean; scheduleStart: string; scheduleEnd: string | null; graceMinutes: number; contactPhone: string; contactEmail: string }) => void;
}) {
  const [dni, setDni] = useState(initial?.dni ?? "");
  const [firstNames, setFirstNames] = useState(initial?.firstNames ?? "");
  const [lastNameP, setLastNameP] = useState(initial?.lastNameP ?? "");
  const [lastNameM, setLastNameM] = useState(initial?.lastNameM ?? "");
  const [companies, setCompanies] = useState(initial?.companies.join("/") ?? "OS");
  const [occupation, setOccupation] = useState(initial?.occupation ?? "CONDUCTOR DE CAMION");
  const [location, setLocation] = useState(initial?.location ?? "LIMA");
  const [scheduleStart, setScheduleStart] = useState(initial?.scheduleStart ?? "06:10");
  const [scheduleEnd, setScheduleEnd] = useState(initial?.scheduleEnd ?? "");
  const [graceMinutes, setGraceMinutes] = useState(initial?.graceMinutes ?? 0);
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  function submit(e: FormEvent) {
    e.preventDefault(); onSubmit({ dni, firstNames, lastNameP, lastNameM,
      displayName: [firstNames, lastNameP, lastNameM].filter(Boolean).join(" "),
      companies: companies.split("/").filter(Boolean), occupation, location, active,
      scheduleStart, scheduleEnd: scheduleEnd || null, graceMinutes, contactPhone, contactEmail });
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-header"><div><h2>{initial ? "Editar personal" : "Agregar persona"}</h2><p>Solo el encargado puede cambiar estos datos.</p></div><button className="icon-button" onClick={onClose}>×</button></div><form className="modal-form" onSubmit={submit}>
    <label>DNI<input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} disabled={Boolean(initial)} value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ""))} /></label>
    <label>Nombres<input required value={firstNames} onChange={e => setFirstNames(e.target.value)} /></label>
    <div className="form-grid"><label>Apellido paterno<input required value={lastNameP} onChange={e => setLastNameP(e.target.value)} /></label><label>Apellido materno<input value={lastNameM} onChange={e => setLastNameM(e.target.value)} /></label></div>
    <div className="form-grid"><label>Empresa<select value={companies} onChange={e => setCompanies(e.target.value)}><option value="OS">OS</option><option value="SLI">SLI</option><option value="OS/SLI">OS/SLI</option></select></label><label>Ocupación<select value={occupation} onChange={e => setOccupation(e.target.value)}><option value="CONDUCTOR DE CAMION">Conductor</option><option value="AUXILIAR DE TRANSPORTE">Auxiliar</option><option value="COORDINADOR">Coordinador</option><option value="MONITOREO">Monitoreo</option></select></label></div>
    <div className="form-grid"><label>Ubicación<input required value={location} onChange={e => setLocation(e.target.value)} /></label><label>Hora de entrada<input required type="time" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} /></label></div>
    <label>Hora de salida (vacía si varía)<input type="time" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} /></label>
    <div className="form-grid"><label>Tolerancia (min)<input required type="number" min={0} max={120} value={graceMinutes} onChange={e => setGraceMinutes(Number(e.target.value))} /></label><label>Estado<select value={active ? "activo" : "baja"} onChange={e => setActive(e.target.value === "activo")}><option value="activo">Activo</option><option value="baja">Baja</option></select></label></div>
    <label>Celular<input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></label><label>Correo<input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} /></label>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></div>
  </form></div></div>;
}
