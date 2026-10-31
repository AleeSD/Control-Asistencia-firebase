import MonitorLogin from "./MonitorLogin";
import { SERVICES, canonicalService, ALL_SERVICES, NO_SERVICE, serviceMatches, summaryServiceMatches, serviceFilterLabel } from "./services";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardList, Clock3, Download, FileClock, LayoutDashboard, LogIn, LogOut,
  Menu, Plus, Search, ShieldCheck, Truck, UserRound, Users, X
} from "lucide-react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, doc, getDocsFromServer, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, configured, db, googleProvider } from "./firebase";
import { call } from "./actions";
import RosterPanel from "./RosterPanel";
import { buildAttendanceSummary, enrichMark, statusLabel } from "./attendanceReport";
import WorkerPortal from "./WorkerPortal";
import LocationPrompt from "./LocationPrompt";
import { getMarkLocation } from "./workerActions";
import "./schedule.css";
import type { Adjustment, AuditEntry, Incident, Mark, MarkType, Personnel, Profile } from "./types";

type View = "inicio" | "marcaciones" | "incidencias" | "equipo" | "reportes" | "auditoria";
const TZ = "America/Lima";
const err = (error: unknown) => {
  const message = (error as { message?: string })?.message ?? "Ocurrió un error.";
  if ((error as { code?: string })?.code === "permission-denied" || message.includes("Missing or insufficient permissions")) {
    return "Esta cuenta aún no está autorizada.";
  }
  return message.replace(/^functions\/[^:]+:\s*/, "");
};
const dayKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const dateLabel = (date = new Date()) => new Intl.DateTimeFormat("es-PE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
const timeLabel = (date?: Date) => date ? new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "—";
const dateTimeLabel = (date?: Date) => date ? `${new Intl.DateTimeFormat("es-PE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(date)} · ${timeLabel(date)}` : "—";
const initial = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");
const mapsUrl = (mark: Mark) => mark.location?.status === "captured"
  ? `https://www.google.com/maps/search/?api=1&query=${mark.location.lat}%2C${mark.location.lng}` : "";
const csvCell = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

function App() {
  const [monitorLogin, setMonitorLogin] = useState(() => new URLSearchParams(window.location.search).get("login") === "monitor");
  const [managerLoginBusy, setManagerLoginBusy] = useState(false);
  const [managerLoginError, setManagerLoginError] = useState("");
  const [profileReady, setProfileReady] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [view, setView] = useState<View>("inicio");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [today, setToday] = useState(dayKey());
  const [pendingIncidents, setPendingIncidents] = useState<Incident[]>([]);
  const [reportRefresh, setReportRefresh] = useState(0);
  const [reportUpdated, setReportUpdated] = useState<Date | null>(null);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const reportCache = useRef(new Map<string, { marks: Mark[]; adjustments: Adjustment[]; at: Date }>());
  useEffect(() => { const timer = window.setInterval(() => setToday(dayKey()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { reportCache.current.clear(); setLoadedPeriod(""); }, [user?.uid, profile?.active, profile?.role]);
  const [reportMarks, setReportMarks] = useState<Mark[]>([]);
  const [reportAdjustments, setReportAdjustments] = useState<Adjustment[]>([]);
  const [reportLoaded, setReportLoaded] = useState({ marks: false, adjustments: false });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"incident" | "invite" | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [markingType, setMarkingType] = useState<MarkType | null>(null);
  const [markError, setMarkError] = useState("");
  const [marksService, setMarksService] = useState(ALL_SERVICES);
  const [reportService, setReportService] = useState(ALL_SERVICES);
  const [search, setSearch] = useState("");
  const [marksMode, setMarksMode] = useState<"day" | "recent">("day");
  const [marksDay, setMarksDay] = useState(dayKey());
  const [reportLayout, setReportLayout] = useState<"summary" | "detail">("summary");
  const [reportMode, setReportMode] = useState<"month" | "day">("month");
  const [reportMonth, setReportMonth] = useState(dayKey().slice(0, 7));
  const [reportDay, setReportDay] = useState(dayKey());

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    return onAuthStateChanged(auth, next => { setUser(next); if (next && !next.isAnonymous) setMonitorLogin(false); setManagerLoginError(""); setProfile(null); setProfileReady(false); setAuthReady(true); setAccessMessage(""); setView("inicio"); setMarksService(ALL_SERVICES); setReportService(ALL_SERVICES); setSearch(""); setMobileMenu(false); setModal(null); setSelectedIncident(null); setMarkingType(null); setNotice(""); });
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous || !db) return;
    let cancelled = false;
    call("claimAccess").catch(error => { if (!cancelled) setAccessMessage(err(error)); });
    const stop = onSnapshot(doc(db, "users", user.uid), snap => {
      if (!cancelled) { setProfile(snap.exists() ? { id: snap.id, ...snap.data() } as Profile : null); if (snap.data()?.role === "monitor") setView(current => ["marcaciones","incidencias","equipo","reportes"].includes(current) ? current : "marcaciones"); setProfileReady(true); }
    }, error => { if (!cancelled) { setAccessMessage(err(error)); setProfileReady(true); } });
    return () => { cancelled = true; stop(); };
  }, [user]);

  useEffect(() => {
    if (!profile?.active || user?.isAnonymous || !db) return;
    const manager = ["encargado", "monitor"].includes(profile.role);
    const load = <T extends { id: string }>(name: string, q: ReturnType<typeof query>, setter: (items: T[]) => void) =>
      onSnapshot(q, snap => setter(snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T)), error => setNotice(`${name}: ${err(error)}`));
    const stops: (() => void)[] = [];
    setMarks([]); setIncidents([]); setAdjustments([]); setProfiles([]); setAudit([]);
    if (!manager) {
      stops.push(load<Mark>("Marcaciones", view === "marcaciones" && marksMode === "day" ? query(collection(db, "marks"), where("userId", "==", profile.id), where("dayKey", "==", marksDay)) : query(collection(db, "marks"), where("userId", "==", profile.id), orderBy("dayKey", "desc"), limit(100)), items => setMarks(items.map(enrichMark))));
      stops.push(load<Incident>("Incidencias", query(collection(db, "incidents"), where("userId", "==", profile.id), orderBy("createdAt", "desc"), limit(100)), setIncidents));
    } else {
      if (view === "inicio") {
        let daily: Mark[] = [], own: Mark[] = [];
        const combine = () => setMarks([...new Map([...daily, ...own].map(m => [m.id, enrichMark(m)])).values()].sort((a,b) => b.dayKey.localeCompare(a.dayKey)));
        stops.push(load<Mark>("Hoy", query(collection(db, "marks"), where("dayKey", "==", today)), items => { daily = items; combine(); }));
        stops.push(load<Mark>("Mi historial", query(collection(db, "marks"), where("userId", "==", profile.id), orderBy("dayKey", "desc"), limit(100)), items => { own = items; combine(); }));
      }
      if (view === "marcaciones") stops.push(load<Mark>("Marcaciones", marksMode === "day"
        ? query(collection(db, "marks"), where("dayKey", "==", marksDay))
        : query(collection(db, "marks"), orderBy("dayKey", "desc"), limit(500)), items => setMarks(items.map(enrichMark))));
      if (view === "incidencias" || view === "reportes") stops.push(load<Incident>("Incidencias", query(collection(db, "incidents"), orderBy("createdAt", "desc"), limit(300)), setIncidents));
      if (view === "auditoria" || view === "reportes") stops.push(load<Profile>("Equipo", profile.role === "monitor" ? query(collection(db, "users"), where("role","==","trabajador"), limit(300)) : query(collection(db, "users"), limit(300)), setProfiles));
      if (view === "auditoria") stops.push(load<AuditEntry>("Auditoría", query(collection(db, "audit"), orderBy("at", "desc"), limit(300)), setAudit));
    }
    if (view === "marcaciones") stops.push(load<Adjustment>("Correcciones", manager ? (marksMode === "day" ? query(collection(db, "adjustments"), where("dayKey", "==", marksDay)) : query(collection(db, "adjustments"), orderBy("dayKey", "desc"), limit(300))) : (marksMode === "day" ? query(collection(db, "adjustments"), where("userId", "==", profile.id), where("dayKey", "==", marksDay)) : query(collection(db, "adjustments"), where("userId", "==", profile.id), orderBy("dayKey", "desc"), limit(100))), setAdjustments));
    return () => stops.forEach(stop => stop());
  }, [profile?.id, profile?.active, profile?.role, user?.isAnonymous, view, today, marksMode, marksDay]);

  useEffect(() => {
    setPendingIncidents([]);
    if (!db || !profile?.active || !["encargado", "monitor"].includes(profile.role)) return;
    return onSnapshot(query(collection(db, "incidents"), where("status", "==", "pendiente")), snap => setPendingIncidents(snap.docs.map(d => ({id: d.id, ...d.data()} as Incident))), error => setNotice(err(error)));
  }, [profile?.id, profile?.active, profile?.role]);

  useEffect(() => {
    if (!profile?.active || !["encargado", "monitor"].includes(profile.role) || !db) return;
    return onSnapshot(collection(db, "personnel"), snap =>
      setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as Personnel))),
      error => setNotice(`Personal: ${err(error)}`));
  }, [profile?.id, profile?.active, profile?.role]);

  useEffect(() => {
    if (view !== "reportes" || !profile?.active || !["encargado", "monitor"].includes(profile.role) || !db) return;
    let cancelled = false;
    const periodKey = profile.id + ":" + reportMode + ":" + (reportMode === "day" ? reportDay : reportMonth);
    setLoadedPeriod(periodKey); setReportUpdated(null);
    setReportMarks([]); setReportAdjustments([]); setReportLoaded({ marks: false, adjustments: false });
    const [year, month] = reportMonth.split("-").map(Number);
    const start = `${reportMonth}-01`;
    const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const marksQuery = reportMode === "day"
      ? query(collection(db, "marks"), where("dayKey", "==", reportDay))
      : query(collection(db, "marks"), where("dayKey", ">=", start), where("dayKey", "<", end), orderBy("dayKey"));
    const adjustmentsQuery = reportMode === "day"
      ? query(collection(db, "adjustments"), where("dayKey", "==", reportDay))
      : query(collection(db, "adjustments"), where("dayKey", ">=", start), where("dayKey", "<", end), orderBy("dayKey"));
    if (reportMode === "month") {
      const apply = (result: { marks: Mark[]; adjustments: Adjustment[]; at: Date }) => {
        if (cancelled) return;
        setReportMarks(result.marks); setReportAdjustments(result.adjustments); setReportUpdated(result.at);
        setReportLoaded({ marks: true, adjustments: true });
      };
      const cached = reportCache.current.get(periodKey);
      if (cached) apply(cached);
      else Promise.all([getDocsFromServer(marksQuery), getDocsFromServer(adjustmentsQuery)]).then(([marks, adjustments]) => {
        if (cancelled) return;
        const result = { marks: marks.docs.map(d => enrichMark({id:d.id, ...d.data()} as Mark)), adjustments: adjustments.docs.map(d => ({id:d.id, ...d.data()} as Adjustment)), at: new Date() };
        reportCache.current.set(periodKey, result); apply(result);
      }).catch(error => { if (!cancelled) setNotice(err(error)); });
      return () => { cancelled = true; };
    }
    const stopMarks = onSnapshot(marksQuery,
      snap => { setReportMarks(snap.docs.map(d => enrichMark({ id: d.id, ...d.data() } as Mark))); setReportLoaded(current => ({ ...current, marks: true })); }, error => setNotice(err(error)));
    const stopAdjustments = onSnapshot(adjustmentsQuery,
      snap => { setReportAdjustments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Adjustment))); setReportLoaded(current => ({ ...current, adjustments: true })); }, error => setNotice(err(error)));
    return () => { cancelled = true; stopMarks(); stopAdjustments(); };
  }, [view, profile?.id, profile?.active, profile?.role, reportMode, reportMonth, reportDay, reportRefresh]);

  const myToday = marks.filter(m => m.userId === profile?.id && m.dayKey === today);
  const entry = myToday.find(m => m.type === "entrada");
  const exit = myToday.find(m => m.type === "salida");
  const pending = ["encargado", "monitor"].includes(profile?.role ?? "") ? pendingIncidents : incidents.filter(i => i.status === "pendiente");
  const periodMarks = view === "reportes" ? reportMarks : marks.filter(m => reportMode === "day" ? m.dayKey === reportDay : m.dayKey.startsWith(reportMonth));
  const periodAdjustments = view === "reportes" ? reportAdjustments : adjustments.filter(a => reportMode === "day" ? a.dayKey === reportDay : a.dayKey.startsWith(reportMonth));
  const selectedMarks = periodMarks.filter(mark => serviceMatches(mark.service, reportService));
  const selectedMarkIds = new Set(selectedMarks.map(mark => mark.id));
  const selectedAdjustments = periodAdjustments.filter(adjustment => reportService === ALL_SERVICES || (adjustment.originalMarkId ? selectedMarkIds.has(adjustment.originalMarkId) : reportService === NO_SERVICE));
  // Select complete person-days for summary; filtering marks first would hide historical entries.
  const attendanceRows = buildAttendanceSummary(periodMarks, periodAdjustments, personnel, profiles, reportMode === "day" ? reportDay : undefined).filter(row => summaryServiceMatches(row.service, reportService));
  const serviceLabel = serviceFilterLabel(reportService);
  const serviceSuffix = reportService === ALL_SERVICES ? "todos" : reportService === NO_SERVICE ? "sin-servicio" : reportService.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const lateCount = attendanceRows.filter(r => (r.late ?? 0) > 0).length;
  const activeCount = personnel.filter(p => p.active).length;
  const enteredToday = new Set(marks.filter(m => m.dayKey === today && m.type === "entrada" && m.personnelId).map(m => m.personnelId));
  const withoutEntry = personnel.filter(p => p.active && !enteredToday.has(p.dni));
  const displayName = profile?.displayName || user?.displayName || "Usuario";
  const manager = ["encargado", "monitor"].includes(profile?.role ?? "");
  const fullManager = profile?.role === "encargado";

  const adjustedMap = useMemo(() => new Map((view === "reportes" ? reportAdjustments : adjustments).map(a => [`${a.personnelId ?? a.userId}_${a.dayKey}_${a.type}`, a])), [adjustments, reportAdjustments, view]);
  const reportRows = [
    ...selectedMarks.map(mark => {
      const person = personnel.find(p => p.dni === mark.personnelId);
      const correction = adjustedMap.get(`${mark.personnelId ?? mark.userId}_${mark.dayKey}_${mark.type}`);
      const location = mark.location;
      return {
        id: mark.id, date: mark.dayKey, name: mark.displayName, dni: mark.personnelId ?? "",
        company: person?.companies.join("/") ?? "", service: canonicalService(mark.service), type: mark.type,
        original: dateTimeLabel(mark.occurredAt?.toDate()), corrected: correction ? dateTimeLabel(correction.correctedAt?.toDate()) : "",
        scheduledStart: mark.scheduleStart, scheduledEnd: mark.scheduleEnd || "Variable",
        status: statusLabel(mark.status), late: mark.lateMinutes,
        location: location?.status === "captured" ? `${location.lat}, ${location.lng}` : "Sin ubicación",
        maps: mapsUrl(mark), sortTime: mark.occurredAt?.toDate().getTime() ?? 0
      };
    }),
    ...selectedAdjustments.filter(a => !a.originalMarkId).map(correction => {
      const person = personnel.find(p => p.dni === correction.personnelId);
      const incident = incidents.find(i => i.id === correction.incidentId);
      return {
        id: `correction_${correction.id}`, date: correction.dayKey,
        name: incident?.displayName ?? person?.displayName ?? profiles.find(p => p.id === correction.userId)?.displayName ?? "Persona sin nombre",
        dni: correction.personnelId ?? person?.dni ?? "", company: person?.companies.join("/") ?? "",
        service: "", type: correction.type, original: "Sin marcación", corrected: dateTimeLabel(correction.correctedAt?.toDate()),
        scheduledStart: person?.scheduleStart ?? "", scheduledEnd: person?.scheduleEnd || "Variable",
        status: "Corrección aprobada", late: "" as const, location: "Sin ubicación", maps: "",
        sortTime: correction.correctedAt?.toDate().getTime() ?? 0
      };
    })
  ].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "es") || a.sortTime - b.sortTime);
  const reportPeriod = reportMode === "day" ? reportDay : reportMonth;
  const reportReady = loadedPeriod === profile?.id + ":" + reportMode + ":" + reportPeriod && reportLoaded.marks && reportLoaded.adjustments;
  const shownMarks = useMemo(() => marks.filter(m => serviceMatches(m.service, marksService) && (marksMode !== "day" || m.dayKey === marksDay) && `${m.displayName} ${m.dayKey} ${m.type}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => b.dayKey.localeCompare(a.dayKey) || a.displayName.localeCompare(b.displayName, "es") || (a.occurredAt?.toDate().getTime() ?? 0) - (b.occurredAt?.toDate().getTime() ?? 0)), [marks, search, marksMode, marksDay, marksService]);

  async function perform(name: string, data: unknown, success: string) {
    setBusy(name); setNotice("");
    try { await call(name, data); setNotice(success); setModal(null); setSelectedIncident(null); }
    catch (error) { setNotice(err(error)); }
    finally { setBusy(""); }
  }

  async function confirmManagerMark() {
    if (!markingType) return;
    setBusy("markAttendance"); setMarkError("");
    try {
      const location = await getMarkLocation();
      await call("markAttendance", { type: markingType, location });
      setNotice(`${markingType === "entrada" ? "Entrada" : "Salida"} registrada con ubicación.`);
      setMarkingType(null);
    } catch (error) { setMarkError(err(error)); }
    finally { setBusy(""); }
  }

  async function downloadReport() {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const book = new ExcelJS.Workbook();
      const summary = book.addWorksheet("Resumen asistencia");
      summary.columns = [
        {header:"Fecha",key:"date",width:14}, {header:"Trabajador",key:"name",width:42},
        {header:"DNI",key:"dni",width:13}, {header:"Servicio",key:"service",width:25}, {header:"Empresa",key:"company",width:13},
        {header:"Entrada",key:"entry",width:16}, {header:"Salida",key:"exit",width:16},
        {header:"Estado entrada",key:"status",width:18}, {header:"Tardanza (min)",key:"late",width:18},
        {header:"Corrección aprobada",key:"corrections",width:24}
      ];
      attendanceRows.forEach(row => summary.addRow(row));
      const info = book.addWorksheet("Cómo leer el reporte");
      info.getColumn(1).width = 115;
      ["O.S. Logistics | Asistencia " + reportPeriod, "Servicio: " + serviceLabel,
        "El resumen conserva la jornada completa de personas con el servicio elegido; el detalle muestra solo las marcas del filtro.",
        "Horario de Lima (UTC-05:00). Una fila por persona y día.",
        "Entrada y salida muestran la hora corregida cuando existe una corrección aprobada.",
        "Estado entrada y tardanza se calculan con esa hora y el horario de la marcación original.",
        "Corrección sin marca original: se usa el horario actual del padrón, si está disponible.",
        "Sin registro o Sin entrada no equivale a una falta. No se descuentan descansos ni permisos.",
        reportMode === "day" ? "Se incluye el personal activo del padrón actual y las personas con registros del día." : "El mes incluye solo días con marcas o correcciones; no calcula días de ausencia.",
        "El detalle conserva las horas originales, correcciones, ubicación y tardanza original.",
        "Las entradas anteriores al 30/10/2026 08:50:29 conservan Puntual; las nuevas usan Registrado."
      ].forEach(text => info.addRow([text]));
      const sheet = book.addWorksheet("Detalle marcaciones");
      sheet.columns = [
        { header: "Fecha", key: "date", width: 14 }, { header: "Trabajador", key: "name", width: 35 },
        { header: "DNI", key: "dni", width: 15 }, {header:"Servicio",key:"service",width:25}, { header: "Empresa", key: "company", width: 15 },
        { header: "Tipo", key: "type", width: 14 }, { header: "Hora original", key: "original", width: 23 },
        { header: "Hora corregida", key: "corrected", width: 23 }, { header: "Horario entrada", key: "scheduledStart", width: 18 },
        { header: "Horario salida", key: "scheduledEnd", width: 18 }, { header: "Estado", key: "status", width: 22 },
        { header: "Tardanza original (min)", key: "late", width: 23 }, { header: "Ubicación", key: "location", width: 18 },
        { header: "Google Maps", key: "maps", width: 55 }
      ];
      for (const row of reportRows) sheet.addRow(row);
      for (const table of [summary, sheet]) {
        table.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        table.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173259" } };
        table.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, table.rowCount), column: table.columnCount } };
        table.views = [{ state: "frozen", ySplit: 1 }];
      }
      const buffer = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer as ArrayBuffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = `asistencia-os-${reportPeriod}-${serviceSuffix}.xlsx`; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setNotice(err(error)); }
  }

  async function downloadPdf() {
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(17); pdf.setTextColor(23, 50, 89);
      pdf.text("O.S. Logistics | Reporte de asistencia", 14, 17);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(80, 97, 122);
      pdf.text(`${reportMode === "day" ? "Día" : "Mes"}: ${reportPeriod}  |  ${serviceLabel}  |  Lima (UTC-05:00)`, 14, 25);
      pdf.text(`Marcaciones: ${selectedMarks.length}  |  Entradas: ${selectedMarks.filter(m => m.type === "entrada").length}  |  Tardanzas: ${lateCount}  |  Correcciones aprobadas: ${selectedAdjustments.length}`, 14, 31);
      const summaryView = reportLayout === "summary";
      pdf.setFontSize(8);
      pdf.text(summaryView ? "Una fila por persona y día. Entrada/salida incorporan correcciones aprobadas." : "Detalle de marcas originales y correcciones aprobadas. Tardanza original, antes de correcciones.", 14, 37);
      pdf.text(reportMode === "day" ? "Padrón activo actual. Sin registro no equivale a una falta." : "Solo días con marcas o correcciones; no calcula ausencias.", 14, 42);
      autoTable(pdf, {
        startY: 47,
        head: summaryView ? [["Fecha", "Trabajador", "DNI", "Servicio", "Empresa", "Entrada", "Salida", "Estado entrada", "Tardanza", "Corrección"]] : [["Fecha", "Trabajador", "DNI", "Servicio", "Tipo", "Hora original", "Hora corregida", "Estado original", "Tardanza original", "Ubicación"]],
        body: summaryView ? (attendanceRows.length ? attendanceRows.map(r => [r.date, r.name, r.dni, r.service, r.company, r.entry, r.exit, r.status, r.late ? `${r.late} min` : "-", r.corrections]) : [["Sin registros", "", "", "", "", "", "", "", "", ""]]) : reportRows.length ? reportRows.map(r => [r.date, r.name, r.dni, r.service, r.type, r.original, r.corrected || "-", r.status, typeof r.late === "number" && r.late > 0 ? `${r.late} min` : "-", r.location]) : [["Sin registros", "", "", "", "", "", "", "", "", ""]],
        styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: { fillColor: [23, 50, 89], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        columnStyles: summaryView ? { 1: { cellWidth: 46 }, 3: { cellWidth: 28 } } : { 1: { cellWidth: 43 }, 3: { cellWidth: 27 }, 9: { cellWidth: 35 } },
        margin: { left: 14, right: 14, bottom: 15 },
        didDrawPage: data => { pdf.setFontSize(8); pdf.setTextColor(110, 125, 145); pdf.text(`Página ${data.pageNumber}`, 280, 200, { align: "right" }); }
      });
      pdf.save(`asistencia-os-${reportPeriod}-${serviceSuffix}-${reportLayout === "summary" ? "resumen" : "detalle"}.pdf`);
    } catch (error) { setNotice(err(error)); }
  }

  async function loginManager() {
    if (!auth || managerLoginBusy) return;
    setManagerLoginBusy(true); setManagerLoginError("");
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) {
      const code = (error as {code?:string}).code;
      setManagerLoginError(code === "auth/popup-closed-by-user" ? "Se cerró el acceso de Google. Puedes intentarlo otra vez o ingresar tu DNI."
        : code === "auth/popup-blocked" ? "Permite las ventanas emergentes de esta página y vuelve a pulsar Acceso del encargado."
        : err(error));
    } finally { setManagerLoginBusy(false); }
  }

  if (!configured) return <div className="setup-page"><div className="setup-card"><div className="brand-mark"><Truck size={28} /></div><h1>Configura Firebase para comenzar</h1><p>La aplicación está preparada. Copia <code>.env.example</code> a <code>.env.local</code> y completa los datos de configuración de la app web registrada en el proyecto <strong>sistema-de-asistencia-os</strong>.</p><p>Luego habilita Google Authentication y sigue los pasos de activación de Firestore y Hosting en el archivo README.</p></div></div>;
  if (!authReady) return <div className="loading-page">Cargando asistencia…</div>;
  if ((!user || user.isAnonymous) && monitorLogin) return <MonitorLogin onBack={() => setMonitorLogin(false)}/>;
  if (!user || user.isAnonymous) return <WorkerPortal onMonitorLogin={() => {setManagerLoginError(""); setMonitorLogin(true);}} onManagerLogin={loginManager} managerLoginBusy={managerLoginBusy} managerLoginError={managerLoginError} />;
  if (!profileReady) return <div className="loading-page" role="status">Comprobando tu acceso…</div>;

  if (!profile || !profile.active) return <div className="setup-page"><div className="setup-card"><div className="brand-mark"><Truck size={28} /></div><h1>Acceso pendiente</h1><p>Tu sesión está activa, pero tu cuenta aún no tiene acceso. Solicita al encargado que autorice tu cuenta.</p>{accessMessage && <div className="inline-alert">{accessMessage}</div>}<div className="pending-actions"><button className="primary-button" onClick={() => call("claimAccess").catch(e => setAccessMessage(err(e)))}>Volver a comprobar</button><button className="secondary-button" onClick={() => signOut(auth!)}>Cerrar sesión</button></div></div></div>;

  const nav: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    ...(profile.role === "monitor" ? [] : [{ id: "inicio" as View, label: "Inicio", icon: LayoutDashboard }]),
    { id: "marcaciones", label: "Marcaciones", icon: Clock3 },
    { id: "incidencias", label: "Incidencias", icon: ClipboardList },
    ...(manager ? [{ id: "equipo" as View, label: "Equipo", icon: Users }, { id: "reportes" as View, label: "Reportes", icon: FileClock }, ...(fullManager ? [{ id: "auditoria" as View, label: "Auditoría", icon: ShieldCheck }] : [])] : [])
  ];
  const navigate = (next: View) => { setView(next); setMobileMenu(false); setNotice(""); };

  return <div className="app-shell">
    {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="sidebar-brand"><div className="brand-mark"><Truck size={25} /></div><div><strong>O.S. LOGISTICS</strong><small>CONTROL DE ASISTENCIA</small></div></div>
      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.label}</span>{item.id === "incidencias" && manager && pending.length > 0 && <b>{pending.length}</b>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-help"><div className="help-icon"><ShieldCheck size={20} /></div><strong>Registros confiables</strong><span>Las marcaciones originales se conservan para auditoría.</span></div>
      <button className="sidebar-user" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => signOut(auth!)}><div className="avatar">{initial(displayName)}</div><div><strong>{displayName}</strong><small>{profile.role === "monitor" ? "Monitor" : manager ? "Encargado" : "Trabajador"}</small></div><LogOut size={17} /></button>
    </aside>
    <div className="main-area">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileMenu(true)}><Menu size={22} /></button><div className="breadcrumb">O.S. Logistics <span>/</span> <strong>{nav.find(n => n.id === view)?.label}</strong></div><div className="topbar-right"><span className="top-date"><CalendarDays size={16} /> {dateLabel()}</span><div className="top-avatar">{initial(displayName)}</div></div></header>
      <main className="content">
        {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}><X size={16} /></button></div>}
        {view === "inicio" && <>
          <div className="page-heading"><div><div className="eyebrow">PANEL GENERAL</div><h1>Hola, {displayName.split(" ")[0]} <span className="wave">👋</span></h1><p>Aquí tienes el resumen de asistencia de hoy.</p></div><div className="date-chip"><CalendarDays size={17} /> {dateLabel()}</div></div>
          <div className="hero-grid"><section className="clock-card"><div className="card-top"><span className="mini-label">MI JORNADA DE HOY</span><span className="live-pill"><i /> EN VIVO</span></div><div className="clock-card-main"><div><div className="clock-caption">Hora referencial en Lima</div><LiveClock /><div className="timezone">La marcación usa la hora del servidor</div></div><div className="clock-art"><Clock3 size={104} strokeWidth={1} /></div></div><div className="clock-divider" /><div className="clock-actions"><div className="clock-state"><span>Entrada</span><strong>{timeLabel(entry?.occurredAt?.toDate())}</strong></div><div className="clock-state"><span>Salida</span><strong>{timeLabel(exit?.occurredAt?.toDate())}</strong></div><button className="mark-button" disabled={Boolean(busy) || Boolean(exit)} onClick={() => { setMarkError(""); setMarkingType(entry ? "salida" : "entrada"); }}>{busy === "markAttendance" ? "Registrando…" : exit ? "Jornada completada" : entry ? "Marcar salida" : "Marcar entrada"} <ArrowRight size={18} /></button></div></section>
          <section className="summary-card"><div className="section-title"><span>Resumen del mes</span><span className="small-muted">{new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date())}</span></div><div className="summary-row"><div className="summary-icon blue"><CheckCircle2 size={20} /></div><div><span>Marcaciones</span><strong>{marks.filter(m => m.userId === profile.id && m.dayKey.startsWith(today.slice(0, 7))).length}</strong></div><ArrowUpRight size={18} /></div><div className="summary-row"><div className="summary-icon orange"><Clock3 size={20} /></div><div><span>Tardanzas</span><strong>{marks.filter(m => m.userId === profile.id && m.dayKey.startsWith(today.slice(0, 7)) && m.lateMinutes > 0).length}</strong></div><ArrowDownRight size={18} /></div><div className="summary-row"><div className="summary-icon purple"><ClipboardList size={20} /></div><div><span>Incidencias pendientes</span><strong>{pending.filter(i => i.userId === profile.id).length}</strong></div><ArrowRight size={18} /></div></section></div>
          {manager && <><div className="stats-grid"><Stat label="Personal activo" value={activeCount} icon={Users} tone="blue" /><Stat label="Entradas hoy" value={activeCount - withoutEntry.length} icon={LogIn} tone="green" /><Stat label="Sin entrada hoy" value={withoutEntry.length} icon={Clock3} tone="orange" /><Stat label="Incidencias por revisar" value={pending.length} icon={Bell} tone="purple" /></div><section className="panel missing-panel"><div className="panel-heading"><div><h2>Sin entrada registrada hoy</h2><p>Personal activo de OS y SLI que aún no marcó. No equivale a una ausencia.</p></div></div><div className="missing-list">{withoutEntry.map(person => <div key={person.dni}><strong>{person.displayName}</strong><span>{person.companies.join("/")} · {person.occupation}</span></div>)}{withoutEntry.length === 0 && <p>Todo el personal activo tiene entrada registrada.</p>}</div></section></>}
          <div className="two-columns"><section className="panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Tus últimos movimientos registrados</p></div><button className="text-button" onClick={() => navigate("marcaciones")}>Ver todo <ArrowRight size={16} /></button></div><div className="activity-list">{marks.filter(m => m.userId === profile.id).slice(0, 5).map(m => <div className="activity-item" key={m.id}><div className={`activity-icon ${m.type === "entrada" ? "green" : "blue"}`}>{m.type === "entrada" ? <LogIn size={18} /> : <LogOut size={18} />}</div><div><strong>{m.type === "entrada" ? "Entrada registrada" : "Salida registrada"}</strong><span>{m.dayKey} · {timeLabel(m.occurredAt?.toDate())}</span></div><Status status={m.status} /></div>)}{marks.filter(m => m.userId === profile.id).length === 0 && <Empty text="Aún no tienes marcaciones." />}</div></section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Accesos rápidos</h2><p>Lo que necesitas a un clic</p></div></div><button className="quick-action" onClick={() => setModal("incident")}><div className="quick-icon purple"><Plus size={20} /></div><div><strong>Reportar incidencia</strong><span>Solicita una corrección de horario</span></div><ArrowRight size={18} /></button><button className="quick-action" onClick={() => navigate("marcaciones")}><div className="quick-icon blue"><FileClock size={20} /></div><div><strong>Ver mis marcaciones</strong><span>Consulta tu historial completo</span></div><ArrowRight size={18} /></button>{manager && <button className="quick-action" onClick={() => navigate("equipo")}><div className="quick-icon orange"><Users size={20} /></div><div><strong>Gestionar equipo</strong><span>Revisa accesos y horarios</span></div><ArrowRight size={18} /></button>}</section></div>
        </>}
        {view === "marcaciones" && <><PageHeader eyebrow="REGISTROS" title="Marcaciones" description="Entradas y salidas con hora oficial del servidor." action={profile.role !== "monitor" ? <button className="primary-button" onClick={() => setModal("incident")}><Plus size={17} /> Reportar incidencia</button> : undefined} /><div className="panel table-panel"><div className="table-toolbar marks-toolbar"><div className="report-period-controls"><div className="report-mode" role="group" aria-label="Período de marcaciones"><button type="button" className={marksMode === "day" ? "selected" : ""} onClick={() => setMarksMode("day")}>Día</button><button type="button" className={marksMode === "recent" ? "selected" : ""} onClick={() => setMarksMode("recent")}>Recientes</button></div>{marksMode === "day" && <label>Fecha de marcaciones <input aria-label="Fecha de marcaciones" type="date" required value={marksDay} max={today} onChange={e => { if (e.target.value) setMarksDay(e.target.value); }} /></label>}<ServiceFilter label="Servicio de marcaciones" value={marksService} onChange={setMarksService}/><button className="text-button" onClick={() => { setMarksDay(today); setMarksMode("day"); }}>Hoy</button></div><div className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, fecha o tipo" /></div><span className="record-count">{shownMarks.length} registros{marksMode === "recent" && manager ? " · últimos 500" : ""}</span></div><div className="table-scroll"><table><thead><tr><th>FECHA</th>{manager && <th>TRABAJADOR</th>}<th>SERVICIO</th><th>TIPO</th><th>HORA ORIGINAL</th><th>ESTADO</th><th>CORRECCIÓN</th>{manager && <th>UBICACIÓN</th>}</tr></thead><tbody>{shownMarks.map(m => { const a = adjustedMap.get(`${m.personnelId ?? m.userId}_${m.dayKey}_${m.type}`); return <tr key={m.id}><td className="strong-cell">{m.dayKey}</td>{manager && <td>{m.displayName}</td>}<td>{canonicalService(m.service)}</td><td><span className={`type-pill ${m.type}`}>{m.type === "entrada" ? <LogIn size={14} /> : <LogOut size={14} />}{m.type}</span></td><td>{timeLabel(m.occurredAt?.toDate())}</td><td><Status status={m.status} /></td><td>{a ? <span className="adjusted">{timeLabel(a.correctedAt.toDate())} <Check size={14} /></span> : "—"}</td>{manager && <td>{mapsUrl(m) ? <a href={mapsUrl(m)} target="_blank" rel="noreferrer">Ver en Maps</a> : "Sin ubicación"}</td>}</tr>})}</tbody></table>{shownMarks.length === 0 && <Empty text="No hay marcaciones para mostrar." />}</div></div></>}
        {view === "incidencias" && <><PageHeader eyebrow="SOLICITUDES" title="Incidencias" description={manager ? "Revisa y resuelve solicitudes de corrección." : "Solicita ajustes sin alterar tus marcaciones originales."} action={profile.role !== "monitor" ? <button className="primary-button" onClick={() => setModal("incident")}><Plus size={17} /> Nueva incidencia</button> : undefined} /><div className="incident-grid">{incidents.map(i => <div className="incident-card" key={i.id}><div className="incident-top"><span className="incident-date"><CalendarDays size={15} /> {i.dayKey}</span><Status status={i.status} /></div><h3>{i.type === "entrada" ? "Corrección de entrada" : "Corrección de salida"}</h3><p>{i.reason}</p><div className="incident-meta"><span><UserRound size={15} /> {i.displayName}</span><span><Clock3 size={15} /> Propuesta: {timeLabel(i.proposedAt?.toDate())}</span></div>{i.resolutionNote && <div className="resolution-note">Respuesta: {i.resolutionNote}</div>}{manager && i.status === "pendiente" && <button className="review-button" onClick={() => setSelectedIncident(i)}>Revisar solicitud <ArrowRight size={16} /></button>}</div>)}{incidents.length === 0 && <div className="panel"><Empty text="No hay incidencias registradas." /></div>}</div></>}
        {view === "equipo" && manager && <><PageHeader eyebrow="PERSONAL" title="Equipo" description={fullManager ? "Aprueba accesos por DNI, actualiza el padrón y gestiona las bajas." : "Aprueba solicitudes de acceso y consulta el padrón."} /><RosterPanel personnel={personnel} canManage={fullManager} /></>}
        {view === "reportes" && manager && <>
          <PageHeader eyebrow="ANÁLISIS" title="Reportes" description="Consulta la asistencia por día o por mes y descárgala en Excel o PDF." />
          <div className="report-toolbar">
            <div className="report-period-controls">
              <div className="report-mode" role="group" aria-label="Período del reporte">
                <button type="button" className={reportMode === "month" ? "selected" : ""} onClick={() => setReportMode("month")}>Mes</button>
                <button type="button" className={reportMode === "day" ? "selected" : ""} onClick={() => setReportMode("day")}>Día</button>
              </div>
              {reportMode === "month" ? <label>Mes <input type="month" value={reportMonth} onChange={e => { if (e.target.value) setReportMonth(e.target.value); }} /></label>
                : <label>Fecha <input type="date" value={reportDay} max={dayKey()} onChange={e => { if (e.target.value) setReportDay(e.target.value); }} /></label>}
            </div>
            <ServiceFilter label="Servicio del reporte" value={reportService} onChange={setReportService}/>
            <div className="report-downloads">{reportMode === "month" && <button className="secondary-button" onClick={() => { reportCache.current.delete(profile.id + ":month:" + reportMonth); setReportLoaded({marks:false, adjustments:false}); setReportRefresh(n => n + 1); }}>Actualizar</button>}<button className="secondary-button" disabled={!reportReady} onClick={downloadReport}><Download size={17} /> Descargar Excel</button><button className="primary-button" disabled={!reportReady} onClick={downloadPdf}><Download size={17} /> Descargar PDF</button></div>
          </div>
          <p className="report-timezone">Horario de referencia: Lima (UTC−05:00){reportMode === "month" && reportUpdated ? " · Consultado: " + dateTimeLabel(reportUpdated) + ". Pulsa Actualizar para ver cambios recientes." : ""}</p>
          <div className="stats-grid"><Stat label="Marcaciones" value={selectedMarks.length} icon={Activity} tone="blue" /><Stat label="Entradas" value={selectedMarks.filter(m => m.type === "entrada").length} icon={LogIn} tone="green" /><Stat label="Tardanzas vigentes" value={lateCount} icon={Clock3} tone="orange" /><Stat label="Correcciones aprobadas" value={selectedAdjustments.length} icon={CheckCircle2} tone="purple" /></div>
          <div className="report-toolbar"><div className="report-mode" role="group" aria-label="Vista del reporte"><button className={reportLayout === "summary" ? "selected" : ""} onClick={() => setReportLayout("summary")}>Resumen por persona</button><button className={reportLayout === "detail" ? "selected" : ""} onClick={() => setReportLayout("detail")}>Detalle de marcaciones</button></div></div>
          <p className="report-timezone">Servicio: {serviceLabel}. Excel incluye resumen y detalle. El PDF descarga la vista elegida. El resumen conserva la jornada completa de personas con el servicio elegido; el detalle muestra solo las marcas de ese servicio. El resumen utiliza las correcciones aprobadas; el detalle conserva las horas originales.</p>
          {reportLayout === "summary" ? <div className="panel table-panel"><div className="panel-heading"><div><h2>Asistencia del {reportMode === "day" ? "día" : "mes"}</h2><p>{reportMode === "day" ? "Padrón activo actual y personas con registros del día. Sin registro no equivale a una falta." : "Una fila por persona y día con marcas o correcciones. No calcula ausencias."}</p></div></div><div className="table-scroll"><table><thead><tr><th>FECHA</th><th>TRABAJADOR</th><th>DNI</th><th>SERVICIO</th><th>EMPRESA</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO ENTRADA</th><th>TARDANZA</th><th>CORRECCIÓN</th></tr></thead><tbody>{reportReady && attendanceRows.map(r => <tr key={r.id}><td className="strong-cell">{r.date}</td><td>{r.name}</td><td>{r.dni || "—"}</td><td>{r.service}</td><td>{r.company || "—"}</td><td>{r.entry}</td><td>{r.exit}</td><td>{r.status}</td><td>{r.late ? r.late + " min" : "—"}</td><td>{r.corrections}</td></tr>)}</tbody></table>{!reportReady ? <Empty text="Cargando reporte…" /> : attendanceRows.length === 0 && <Empty text="No hay registros para este período." />}</div></div> : <>
          <div className="panel table-panel"><div className="panel-heading"><div><h2>Detalle de marcaciones</h2><p>Horas y estados originales, correcciones y ubicación. Tardanza antes de correcciones.</p></div></div><div className="table-scroll"><table><thead><tr><th>FECHA</th><th>TRABAJADOR</th><th>DNI</th><th>SERVICIO</th><th>TIPO</th><th>HORA</th><th>HORA CORREGIDA</th><th>ESTADO</th><th>TARDANZA ORIGINAL</th><th>UBICACIÓN</th></tr></thead><tbody>{reportReady && reportRows.map(r => <tr key={r.id}><td className="strong-cell">{r.date}</td><td>{r.name}</td><td>{r.dni || "—"}</td><td>{r.service}</td><td className="capitalize">{r.type}</td><td>{r.original}</td><td>{r.corrected || "—"}</td><td>{r.status}</td><td>{typeof r.late === "number" && r.late > 0 ? `${r.late} min` : "—"}</td><td>{r.maps ? <a href={r.maps} target="_blank" rel="noopener noreferrer">Ver en Maps</a> : "—"}</td></tr>)}</tbody></table>{!reportReady ? <Empty text="Cargando reporte…" /> : reportRows.length === 0 && <Empty text={`No hay datos para este ${reportMode === "day" ? "día" : "mes"}.`} />}</div></div></>}

        </>}
        {view === "auditoria" && manager && <><PageHeader eyebrow="TRAZABILIDAD" title="Auditoría" description="Historial de acciones realizadas en el sistema." /><div className="panel audit-list">{audit.map(a => <div className="audit-item" key={a.id}><div className="audit-icon"><ShieldCheck size={19} /></div><div><strong>{({ mark_attendance: "Marcación registrada", submit_incident: "Incidencia creada", resolve_incident: "Incidencia resuelta", invite_user: "Persona invitada", update_user: "Perfil actualizado", claim_access: "Acceso activado", roster_upsert: "Padrón actualizado", roster_delete: "Persona eliminada del padrón", worker_access_removed: "Acceso anterior eliminado", registration_approved: "Celular aprobado", registration_rejected: "Solicitud rechazada" } as Record<string, string>)[a.action] ?? a.action}</strong><span>Actor: {profiles.find(p => p.id === a.actorId)?.displayName ?? a.actorId} · Referencia: {a.targetId}</span></div><time>{dateTimeLabel(a.at?.toDate())}</time></div>)}{audit.length === 0 && <Empty text="Aún no hay acciones registradas." />}</div></>}
      </main>
    </div>
    {modal === "incident" && <IncidentModal busy={Boolean(busy)} onClose={() => setModal(null)} onSubmit={data => perform("submitIncident", data, "Incidencia enviada para revisión.")} />}
    {modal === "invite" && <InviteModal busy={Boolean(busy)} onClose={() => setModal(null)} onSubmit={data => perform("inviteUser", data, "Invitación registrada. La persona debe ingresar con Google.")} />}
    {selectedIncident && <ResolveModal incident={selectedIncident} busy={Boolean(busy)} onClose={() => setSelectedIncident(null)} onSubmit={data => perform("resolveIncident", data, "Incidencia resuelta.")} />}
    {markingType && <LocationPrompt type={markingType} busy={busy === "markAttendance"} error={markError} onConfirm={confirmManagerMark} onClose={() => setMarkingType(null)} />}
  </div>;
}

function ServiceFilter({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
  return <label className="service-filter">{label}<select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}><option value={ALL_SERVICES}>Todos los servicios</option>{SERVICES.map(service=><option key={service} value={service}>{service}</option>)}<option value={NO_SERVICE}>Sin servicio</option></select></label>;
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <div className="live-clock">{new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)}</div>;
}
function Status({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{statusLabel(status)}</span>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><FileClock size={27} /><span>{text}</span></div>; }
function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Users; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={21} /></div><span>{label}</span><strong>{value}</strong></div>; }
function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>; }

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-header"><div><h2>{title}</h2><p>{description}</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>{children}</div></div>; }
function IncidentModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (data: unknown) => void }) {
  const [day, setDay] = useState(dayKey()); const [type, setType] = useState<MarkType>("entrada"); const [time, setTime] = useState("08:00"); const [reason, setReason] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit({ dayKey: day, type, proposedAt: `${day}T${time}:00-05:00`, reason }); };
  return <Modal title="Nueva incidencia" description="Explica la corrección que solicitas. El registro original se conservará." onClose={onClose}><form onSubmit={submit} className="modal-form"><div className="form-grid"><label>Fecha<input required type="date" value={day} max={dayKey()} onChange={e => setDay(e.target.value)} /></label><label>Marcación<select value={type} onChange={e => setType(e.target.value as MarkType)}><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label></div><label>Hora correcta propuesta<input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label><label>Motivo<textarea required minLength={5} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe qué ocurrió y por qué se necesita la corrección" rows={4} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</button></div></form></Modal>;
}
function InviteModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (data: unknown) => void }) {
  const [email, setEmail] = useState(""); const [displayName, setDisplayName] = useState(""); const [role, setRole] = useState("trabajador"); const [scheduleStart, setScheduleStart] = useState("08:00"); const [graceMinutes, setGraceMinutes] = useState(10);
  return <Modal title="Invitar persona" description="Autoriza su Gmail personal para acceder al sistema." onClose={onClose}><form className="modal-form" onSubmit={e => { e.preventDefault(); onSubmit({ email, displayName, role, scheduleStart, graceMinutes }); }}><label>Nombre completo<input required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nombre y apellido" /></label><label>Correo Gmail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="persona@gmail.com" /></label><div className="form-grid"><label>Rol<select value={role} onChange={e => setRole(e.target.value)}><option value="trabajador">Trabajador</option><option value="encargado">Encargado</option></select></label><label>Hora de entrada<input required type="time" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} /></label></div><label>Tolerancia en minutos<input required type="number" min={0} max={120} value={graceMinutes} onChange={e => setGraceMinutes(Number(e.target.value))} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Crear invitación"}</button></div></form></Modal>;
}
function ResolveModal({ incident, busy, onClose, onSubmit }: { incident: Incident; busy: boolean; onClose: () => void; onSubmit: (data: unknown) => void }) {
  const [note, setNote] = useState("");
  return <Modal title="Revisar incidencia" description={`${incident.displayName} · ${incident.dayKey} · ${incident.type}`} onClose={onClose}><div className="review-detail"><strong>Hora propuesta: {timeLabel(incident.proposedAt?.toDate())}</strong><p>{incident.reason}</p></div><label className="modal-field">Nota de resolución<textarea required maxLength={500} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Explica la decisión para dejar constancia" /></label><div className="modal-actions"><button className="secondary-button" disabled={busy || !note.trim()} onClick={() => onSubmit({ id: incident.id, decision: "rechazar", note })}>Rechazar</button><button className="primary-button" disabled={busy || !note.trim()} onClick={() => onSubmit({ id: incident.id, decision: "aprobar", note })}>{busy ? "Guardando…" : "Aprobar corrección"}</button></div></Modal>;
}
function TeamRow({ profile, busy, onSave }: { profile: Profile; busy: boolean; onSave: (data: { scheduleStart: string; graceMinutes: number; active: boolean }) => void }) {
  const [editing, setEditing] = useState(false); const [scheduleStart, setScheduleStart] = useState(profile.scheduleStart); const [graceMinutes, setGraceMinutes] = useState(profile.graceMinutes); const [active, setActive] = useState(profile.active);
  return <tr><td><div className="person-cell"><div className="mini-avatar">{initial(profile.displayName)}</div><div><strong>{profile.displayName}</strong><span>{profile.email}</span></div></div></td><td className="capitalize">{profile.role}</td><td>{editing ? <input className="table-input" type="time" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} /> : profile.scheduleStart}</td><td>{editing ? <input className="table-input number" type="number" min={0} max={120} value={graceMinutes} onChange={e => setGraceMinutes(Number(e.target.value))} /> : `${profile.graceMinutes} min`}</td><td>{editing ? <select value={active ? "active" : "inactive"} onChange={e => setActive(e.target.value === "active")}><option value="active">Activo</option><option value="inactive">Inactivo</option></select> : <Status status={profile.active ? "activo" : "inactivo"} />}</td><td>{editing ? <button className="text-button" disabled={busy} onClick={() => { onSave({ scheduleStart, graceMinutes, active }); setEditing(false); }}>Guardar</button> : <button className="text-button" onClick={() => setEditing(true)}>Editar</button>}</td></tr>;
}

export default App;
