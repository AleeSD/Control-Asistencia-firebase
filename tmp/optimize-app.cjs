const fs=require('fs'); const path='src/App.tsx'; let s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
function replace(a,b){if(!s.includes(a))throw Error(a.slice(0,80));s=s.replace(a,b);}
replace('useEffect, useMemo, useState','useEffect, useMemo, useRef, useState');
replace('collection, doc, limit,','collection, doc, getDocsFromServer, limit,');
replace('  const [reportMarks,',`  const [today, setToday] = useState(dayKey());
  const [pendingIncidents, setPendingIncidents] = useState<Incident[]>([]);
  const [reportRefresh, setReportRefresh] = useState(0);
  const [reportUpdated, setReportUpdated] = useState<Date | null>(null);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const reportCache = useRef(new Map<string, { marks: Mark[]; adjustments: Adjustment[]; at: Date }>());
  useEffect(() => { const timer = window.setInterval(() => setToday(dayKey()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { reportCache.current.clear(); setLoadedPeriod(""); }, [user?.uid, profile?.active]);
  const [reportMarks,`);
let a=s.indexOf('    const stops = [',s.indexOf('const load =')); let b=s.indexOf('\n  useEffect(() => {\n    if (profile?.role',a);
s=s.slice(0,a)+`    const stops: (() => void)[] = [];
    setMarks([]); setIncidents([]); setAdjustments([]); setProfiles([]); setAudit([]);
    if (!manager) {
      stops.push(load<Mark>("Marcaciones", query(collection(db, "marks"), where("userId", "==", profile.id), orderBy("dayKey", "desc"), limit(100)), items => setMarks(items.map(enrichMark))));
      stops.push(load<Incident>("Incidencias", query(collection(db, "incidents"), where("userId", "==", profile.id), orderBy("createdAt", "desc"), limit(100)), setIncidents));
    } else {
      if (view === "inicio") {
        let daily: Mark[] = [], own: Mark[] = [];
        const combine = () => setMarks([...new Map([...daily, ...own].map(m => [m.id, enrichMark(m)])).values()].sort((a,b) => b.dayKey.localeCompare(a.dayKey)));
        stops.push(load<Mark>("Hoy", query(collection(db, "marks"), where("dayKey", "==", today)), items => { daily = items; combine(); }));
        stops.push(load<Mark>("Mi historial", query(collection(db, "marks"), where("userId", "==", profile.id), orderBy("dayKey", "desc"), limit(100)), items => { own = items; combine(); }));
      }
      if (view === "marcaciones") stops.push(load<Mark>("Marcaciones", query(collection(db, "marks"), orderBy("dayKey", "desc"), limit(500)), items => setMarks(items.map(enrichMark))));
      if (view === "incidencias" || view === "reportes") stops.push(load<Incident>("Incidencias", query(collection(db, "incidents"), orderBy("createdAt", "desc"), limit(300)), setIncidents));
      if (view === "auditoria" || view === "reportes") stops.push(load<Profile>("Equipo", query(collection(db, "users"), limit(300)), setProfiles));
      if (view === "auditoria") stops.push(load<AuditEntry>("Auditoría", query(collection(db, "audit"), orderBy("at", "desc"), limit(300)), setAudit));
    }
    if (view === "marcaciones") stops.push(load<Adjustment>("Correcciones", manager ? query(collection(db, "adjustments"), orderBy("dayKey", "desc"), limit(300)) : query(collection(db, "adjustments"), where("userId", "==", profile.id), orderBy("dayKey", "desc"), limit(100)), setAdjustments));
    return () => stops.forEach(stop => stop());
  }, [profile?.id, profile?.active, profile?.role, user?.isAnonymous, view, today]);

  useEffect(() => {
    setPendingIncidents([]);
    if (!db || !profile?.active || profile.role !== "encargado") return;
    return onSnapshot(query(collection(db, "incidents"), where("status", "==", "pendiente")), snap => setPendingIncidents(snap.docs.map(d => ({id: d.id, ...d.data()} as Incident))), error => setNotice(err(error)));
  }, [profile?.id, profile?.active, profile?.role]);
`+s.slice(b);
replace('if (profile?.role !== "encargado" || !db)', 'if (!profile?.active || profile.role !== "encargado" || !db)');
replace('}, [profile?.role]);','}, [profile?.id, profile?.active, profile?.role]);');
replace('if (view !== "reportes" || profile?.role !== "encargado" || !db)', 'if (view !== "reportes" || !profile?.active || profile.role !== "encargado" || !db)');
replace('    setReportMarks([]); setReportAdjustments([]);', '    let cancelled = false;\n    const periodKey = profile.id + ":" + reportMode + ":" + (reportMode === "day" ? reportDay : reportMonth);\n    setLoadedPeriod(periodKey); setReportUpdated(null);\n    setReportMarks([]); setReportAdjustments([]);');
a=s.indexOf('    const stopMarks = onSnapshot(marksQuery'); b=s.indexOf('\n  const myToday',a);
s=s.slice(0,a)+`    if (reportMode === "month") {
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
`+s.slice(b);
replace('const pending = incidents.filter(i => i.status === "pendiente");','const pending = profile?.role === "encargado" ? pendingIncidents : incidents.filter(i => i.status === "pendiente");');
replace('const reportReady = reportLoaded.marks && reportLoaded.adjustments;', 'const reportReady = loadedPeriod === profile?.id + ":" + reportMode + ":" + reportPeriod && reportLoaded.marks && reportLoaded.adjustments;');
replace('incidents.filter(i => i.userId === profile.id && i.status === "pendiente").length','pending.filter(i => i.userId === profile.id).length');
replace('<div className="report-downloads">','<div className="report-downloads">{reportMode === "month" && <button className="secondary-button" onClick={() => { reportCache.current.delete(profile.id + ":month:" + reportMonth); setReportLoaded({marks:false, adjustments:false}); setReportRefresh(n => n + 1); }}>Actualizar</button>}');
replace('<p className="report-timezone">Horario de referencia: Lima (UTC−05:00)</p>','<p className="report-timezone">Horario de referencia: Lima (UTC−05:00){reportMode === "month" && reportUpdated ? " · Consultado: " + dateTimeLabel(reportUpdated) + ". Pulsa Actualizar para ver cambios recientes." : ""}</p>');
fs.writeFileSync(path,s);
