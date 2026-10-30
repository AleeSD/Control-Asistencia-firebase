const fs = require('node:fs');
const file = 'src/App.tsx';
let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const replace = (before, after) => { if (!s.includes(before)) throw Error('Missing target: ' + before.slice(0, 100)); s = s.replace(before, after); };
replace('import RosterPanel from "./RosterPanel";', 'import RosterPanel from "./RosterPanel";\nimport { buildAttendanceSummary, enrichMark, statusLabel } from "./attendanceReport";');
const start = s.indexOf('const enrichMark =');
const end = s.indexOf('\nfunction App()', start);
if (start < 0 || end < 0) throw Error('Missing helper');
s = s.slice(0, start) + s.slice(end);
replace('  const [search, setSearch] = useState("");', `  const [search, setSearch] = useState("");
  const [marksMode, setMarksMode] = useState<"day" | "recent">("day");
  const [marksDay, setMarksDay] = useState(dayKey());
  const [reportLayout, setReportLayout] = useState<"summary" | "detail">("summary");`);
replace('if (view === "marcaciones") stops.push(load<Mark>("Marcaciones", query(collection(db, "marks"), orderBy("dayKey", "desc"), limit(500)), items => setMarks(items.map(enrichMark))));', `if (view === "marcaciones") stops.push(load<Mark>("Marcaciones", marksMode === "day"
        ? query(collection(db, "marks"), where("dayKey", "==", marksDay))
        : query(collection(db, "marks"), orderBy("dayKey", "desc"), limit(500)), items => setMarks(items.map(enrichMark))));`);
replace('manager ? query(collection(db, "adjustments"), orderBy("dayKey", "desc"), limit(300)) :', 'manager ? (marksMode === "day" ? query(collection(db, "adjustments"), where("dayKey", "==", marksDay)) : query(collection(db, "adjustments"), orderBy("dayKey", "desc"), limit(300))) :');
replace('view, today]);', 'view, today, marksMode, marksDay]);');
replace('  const lateCount = selectedMarks.filter(m => m.type === "entrada" && m.lateMinutes > 0).length;', '  const attendanceRows = buildAttendanceSummary(selectedMarks, selectedAdjustments, personnel, profiles, reportMode === "day" ? reportDay : undefined);\n  const lateCount = attendanceRows.filter(r => (r.late ?? 0) > 0).length;');
replace('].sort((a, b) => a.date.localeCompare(b.date) || a.sortTime - b.sortTime);', '].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "es") || a.sortTime - b.sortTime);');
replace('marks.filter(m => `${m.displayName} ${m.dayKey} ${m.type}`.toLowerCase().includes(search.toLowerCase())), [marks, search]', 'marks.filter(m => (marksMode !== "day" || m.dayKey === marksDay) && `${m.displayName} ${m.dayKey} ${m.type}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => b.dayKey.localeCompare(a.dayKey) || a.displayName.localeCompare(b.displayName, "es") || (a.occurredAt?.toDate().getTime() ?? 0) - (b.occurredAt?.toDate().getTime() ?? 0)), [marks, search, marksMode, marksDay]');
replace('      const sheet = book.addWorksheet("Asistencia");', `      const summary = book.addWorksheet("Resumen asistencia");
      summary.columns = [
        {header:"Fecha",key:"date",width:14}, {header:"Trabajador",key:"name",width:42},
        {header:"DNI",key:"dni",width:13}, {header:"Empresa",key:"company",width:13},
        {header:"Entrada",key:"entry",width:16}, {header:"Salida",key:"exit",width:16},
        {header:"Estado entrada",key:"status",width:18}, {header:"Tardanza (min)",key:"late",width:18},
        {header:"Corrección aprobada",key:"corrections",width:24}
      ];
      attendanceRows.forEach(row => summary.addRow(row));
      const info = book.addWorksheet("Cómo leer el reporte");
      info.getColumn(1).width = 115;
      ["O.S. Logistics | Asistencia " + reportPeriod,
        "Horario de Lima (UTC-05:00). Una fila por persona y día.",
        "Entrada y salida muestran la hora corregida cuando existe una corrección aprobada.",
        "Estado entrada y tardanza se calculan con esa hora y el horario de la marcación original.",
        "Corrección sin marca original: se usa el horario actual del padrón, si está disponible.",
        "Sin registro o Sin entrada no equivale a una falta. No se descuentan descansos ni permisos.",
        reportMode === "day" ? "Se incluye el personal activo del padrón actual y las personas con registros del día." : "El mes incluye solo días con marcas o correcciones; no calcula días de ausencia.",
        "El detalle conserva las horas originales, correcciones, ubicación y tardanza original.",
        "Las entradas anteriores al 30/10/2026 08:50:29 conservan Puntual; las nuevas usan Registrado."
      ].forEach(text => info.addRow([text]));
      const sheet = book.addWorksheet("Detalle marcaciones");`);
replace('{ header: "Tardanza (min)", key: "late", width: 18 }', '{ header: "Tardanza original (min)", key: "late", width: 23 }');
const styleStart = s.indexOf('      sheet.getRow(1).font');
const styleEnd = s.indexOf('      const buffer', styleStart);
s = s.slice(0, styleStart) + `      for (const table of [summary, sheet]) {
        table.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        table.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173259" } };
        table.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, table.rowCount), column: table.columnCount } };
        table.views = [{ state: "frozen", ySplit: 1 }];
      }
` + s.slice(styleEnd);
replace('pdf.text(`Marcaciones: ${selectedMarks.length}', 'pdf.text(`Marcaciones: ${selectedMarks.length}'); // verified anchor, intentionally retained
replace('      autoTable(pdf, {\n        startY: 37,', `      const summaryView = reportLayout === "summary";
      pdf.setFontSize(8);
      pdf.text(summaryView ? "Una fila por persona y día. Entrada/salida incorporan correcciones aprobadas." : "Detalle de marcas originales y correcciones aprobadas. Tardanza original, antes de correcciones.", 14, 37);
      pdf.text(reportMode === "day" ? "Padrón activo actual. Sin registro no equivale a una falta." : "Solo días con marcas o correcciones; no calcula ausencias.", 14, 42);
      autoTable(pdf, {
        startY: 47,`);
replace('head: [["Fecha", "Trabajador", "DNI", "Tipo", "Hora original", "Hora corregida", "Estado", "Tardanza", "Ubicación"]],', 'head: summaryView ? [["Fecha", "Trabajador", "DNI", "Empresa", "Entrada", "Salida", "Estado entrada", "Tardanza", "Corrección"]] : [["Fecha", "Trabajador", "DNI", "Tipo", "Hora original", "Hora corregida", "Estado original", "Tardanza original", "Ubicación"]],');
replace('body: reportRows.length ? reportRows.map', 'body: summaryView ? (attendanceRows.length ? attendanceRows.map(r => [r.date, r.name, r.dni, r.company, r.entry, r.exit, r.status, r.late ? `${r.late} min` : "-", r.corrections]) : [["Sin registros", "", "", "", "", "", "", "", ""]]) : reportRows.length ? reportRows.map');
replace('columnStyles: { 1: { cellWidth: 57 }, 8: { cellWidth: 45 } },', 'columnStyles: summaryView ? { 1: { cellWidth: 61 } } : { 1: { cellWidth: 57 }, 8: { cellWidth: 45 } },');
replace('pdf.save(`asistencia-os-${reportPeriod}.pdf`);', 'pdf.save(`asistencia-os-${reportPeriod}-${reportLayout === "summary" ? "resumen" : "detalle"}.pdf`);');
replace('<div className="table-toolbar"><div className="search-box">', `<div className="table-toolbar marks-toolbar"><div className="report-period-controls"><div className="report-mode" role="group" aria-label="Período de marcaciones"><button type="button" className={marksMode === "day" ? "selected" : ""} onClick={() => setMarksMode("day")}>Día</button><button type="button" className={marksMode === "recent" ? "selected" : ""} onClick={() => setMarksMode("recent")}>Recientes</button></div>{marksMode === "day" && <label>Fecha de marcaciones <input aria-label="Fecha de marcaciones" type="date" required value={marksDay} max={today} onChange={e => { if (e.target.value) setMarksDay(e.target.value); }} /></label>}<button className="text-button" onClick={() => { setMarksDay(today); setMarksMode("day"); }}>Hoy</button></div><div className="search-box">`);
replace('{shownMarks.length} registros</span>', '{shownMarks.length} registros{marksMode === "recent" && manager ? " · últimos 500" : ""}</span>');
replace('onChange={e => setReportMonth(e.target.value)}', 'onChange={e => { if (e.target.value) setReportMonth(e.target.value); }}');
replace('onChange={e => setReportDay(e.target.value)}', 'onChange={e => { if (e.target.value) setReportDay(e.target.value); }}');
replace('<Stat label="Tardanzas" value={lateCount}', '<Stat label="Tardanzas vigentes" value={lateCount}');
const detailStart = s.indexOf('          <div className="panel table-panel"><div className="panel-heading"><div><h2>Detalle del');
if (detailStart < 0) throw Error('Report table not found');
const detailEnd = s.indexOf('\n        </>}', detailStart);
let detail = s.slice(detailStart, detailEnd);
detail = detail.replace('<h2>Detalle del {reportMode === "day" ? "día" : "mes"}</h2><p>La vista y las descargas incluyen marcas originales, correcciones y ubicación.</p>', '<h2>Detalle de marcaciones</h2><p>Horas y estados originales, correcciones y ubicación. Tardanza antes de correcciones.</p>');
detail = detail.replace('<th>TARDANZA</th>', '<th>TARDANZA ORIGINAL</th>');
s = s.slice(0, detailStart) + `          <div className="report-toolbar"><div className="report-mode" role="group" aria-label="Vista del reporte"><button className={reportLayout === "summary" ? "selected" : ""} onClick={() => setReportLayout("summary")}>Resumen por persona</button><button className={reportLayout === "detail" ? "selected" : ""} onClick={() => setReportLayout("detail")}>Detalle de marcaciones</button></div></div>
          <p className="report-timezone">Excel incluye resumen y detalle. El PDF descarga la vista elegida. El resumen utiliza las correcciones aprobadas; el detalle conserva las horas originales.</p>
          {reportLayout === "summary" ? <div className="panel table-panel"><div className="panel-heading"><div><h2>Asistencia del {reportMode === "day" ? "día" : "mes"}</h2><p>{reportMode === "day" ? "Padrón activo actual y personas con registros del día. Sin registro no equivale a una falta." : "Una fila por persona y día con marcas o correcciones. No calcula ausencias."}</p></div></div><div className="table-scroll"><table><thead><tr><th>FECHA</th><th>TRABAJADOR</th><th>DNI</th><th>EMPRESA</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO ENTRADA</th><th>TARDANZA</th><th>CORRECCIÓN</th></tr></thead><tbody>{reportReady && attendanceRows.map(r => <tr key={r.id}><td className="strong-cell">{r.date}</td><td>{r.name}</td><td>{r.dni || "—"}</td><td>{r.company || "—"}</td><td>{r.entry}</td><td>{r.exit}</td><td>{r.status}</td><td>{r.late ? r.late + " min" : "—"}</td><td>{r.corrections}</td></tr>)}</tbody></table>{!reportReady ? <Empty text="Cargando reporte…" /> : attendanceRows.length === 0 && <Empty text="No hay registros para este período." />}</div></div> : <>
` + detail + `</>}
` + s.slice(detailEnd);
fs.writeFileSync(file, s);
