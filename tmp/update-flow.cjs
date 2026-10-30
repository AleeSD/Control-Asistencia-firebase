const fs=require('fs');
let p='src/App.tsx',s=fs.readFileSync(p,'utf8');
s=s.replace('  const [workerMode, setWorkerMode] = useState(false);','  const [managerLoginBusy, setManagerLoginBusy] = useState(false);\n  const [managerLoginError, setManagerLoginError] = useState("");\n  const [profileReady, setProfileReady] = useState(false);');
s=s.replace('  const [showWelcome, setShowWelcome] = useState(false);','');
s=s.replace('setUser(next); setProfile(null); setAuthReady(true); setAccessMessage("");','setUser(next); setProfile(null); setProfileReady(false); setAuthReady(true); setAccessMessage(""); setView("inicio"); setMobileMenu(false); setModal(null); setSelectedIncident(null); setMarkingType(null); setNotice("");');
s=s.replace('if (!cancelled) setProfile(snap.exists() ? { id: snap.id, ...snap.data() } as Profile : null);','if (!cancelled) { setProfile(snap.exists() ? { id: snap.id, ...snap.data() } as Profile : null); setProfileReady(true); }');
s=s.replace('}, error => { if (!cancelled) setAccessMessage(err(error)); });','}, error => { if (!cancelled) { setAccessMessage(err(error)); setProfileReady(true); } });');
const start=s.indexOf('  if (workerMode ||');const end=s.indexOf('  if (!profile || !profile.active)',start);
if(start<0||end<0)throw Error('Login block missing');
s=s.slice(0,start)+'  if (!user || user.isAnonymous) return <WorkerPortal onManagerLogin={loginManager} managerLoginBusy={managerLoginBusy} managerLoginError={managerLoginError} />;\n  if (!profileReady) return <div className="loading-page" role="status">Comprobando tu acceso…</div>;\n\n'+s.slice(end);
const pos=s.indexOf('  if (!configured)');
s=s.slice(0,pos)+`  async function loginManager() {
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

`+s.slice(pos);
s=s.replace('className="sidebar-user" onClick=', 'className="sidebar-user" aria-label="Cerrar sesión" title="Cerrar sesión" onClick=');
fs.writeFileSync(p,s);
p='src/WorkerPortal.tsx';s=fs.readFileSync(p,'utf8');
s=s.replace('useEffect, useState','useEffect, useRef, useState');
s=s.replace('export default function WorkerPortal({onBack}: {onBack:()=>void}) {','export default function WorkerPortal({onManagerLogin, managerLoginBusy, managerLoginError}: {onManagerLogin:()=>void; managerLoginBusy:boolean; managerLoginError:string}) {');
s=s.replace('  async function enter() {','  const autoApproval = useRef<string | null>(null);\n  useEffect(() => {\n    if (result?.state === "register" && request?.status === "aprobada" && !busy && autoApproval.current !== result.uid) {\n      autoApproval.current = result.uid;\n      void enter();\n    }\n  }, [request?.status, result?.state, result?.uid, busy]);\n  async function enter() {');
s=s.replace('function leave(){setBusy(true);','function leave(){autoApproval.current=null;setBusy(true);');
s=s.replace('onClick={onBack}>Acceso del encargado</button>','disabled={busy || managerLoginBusy} onClick={onManagerLogin}>{managerLoginBusy ? "Abriendo Google…" : "Acceso del encargado"}</button>{managerLoginError && <p className="worker-warning" role="alert">{managerLoginError}</p>}');
// Prevent a second flow from being started while Google's popup is open.
s=s.replace('onSubmit={e=>{e.preventDefault();void enter();}}','onSubmit={e=>{e.preventDefault();if (!managerLoginBusy && !busy) void enter();}}');
s=s.replace('disabled={busy}>{busy?"Comprobando…":"Ingresar"}', 'disabled={busy || managerLoginBusy}>{busy?"Comprobando…":"Ingresar"}');
fs.writeFileSync(p,s);
