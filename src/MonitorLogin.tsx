import { useState } from "react";
import type { FormEvent } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { Truck } from "lucide-react";
import "./worker.css";

export const MONITOR_EMAIL = "superv.nac@oslogisticsperu.com";
export default function MonitorLogin({onBack}:{onBack:()=>void}) {
  const [username,setUsername]=useState(""),[password,setPassword]=useState("");
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const validUser=()=>["osmonitor",MONITOR_EMAIL].includes(username.trim().toLowerCase());
  async function login(event:FormEvent){event.preventDefault();if(!auth||busy)return;setError("");setNotice("");if(!validUser()){setError("No se pudo ingresar. Revisa el usuario y la contraseña, o solicita un enlace para crearla o recuperarla.");return;}setBusy(true);
    try{await signInWithEmailAndPassword(auth,MONITOR_EMAIL,password);setPassword("");}
    catch(cause){const code=(cause as {code?:string}).code;setError(code==="auth/too-many-requests"?"Hubo varios intentos. Espera unos minutos antes de volver a ingresar.":code==="auth/network-request-failed"?"Revisa tu conexión e inténtalo nuevamente.":"No se pudo ingresar. Revisa el usuario y la contraseña, o solicita un enlace para crearla o recuperarla.");}
    finally{setBusy(false);}
  }
  async function recover(){if(!auth||busy)return;setError("");setNotice("");if(!username.trim()){setError("Ingresa tu usuario para solicitar el enlace.");return;}const recoveryNotice="Si el usuario está habilitado, recibirás un enlace en el correo asociado para establecer tu contraseña. Revisa también Correo no deseado.";if(!validUser()){setNotice(recoveryNotice);return;}setBusy(true);
    try{await sendPasswordResetEmail(auth,MONITOR_EMAIL,{url:window.location.origin+"/?login=monitor"});setNotice(recoveryNotice);}
    catch{setError("No se pudo solicitar el enlace. Revisa tu conexión e inténtalo más tarde.");}finally{setBusy(false);}
  }
  return <div className="worker-page"><main className="worker-card"><div className="worker-brand"><div><Truck size={22}/></div><strong>O.S. LOGISTICS</strong></div><span className="worker-eyebrow">MONITOREO</span><h1>Ingreso OSMonitor</h1><p className="worker-intro">Ingresa con la contraseña de esta plataforma. Es independiente de la de tu correo.</p><form className="worker-form" onSubmit={login}><label>Usuario<input required autoComplete="off" autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="worker-mark-button" disabled={busy}>{busy?"Procesando…":"Ingresar a monitoreo"}</button></form>{error&&<p className="worker-warning" role="alert">{error}</p>}{notice&&<p className="worker-notice" role="status">{notice}</p>}<div className="worker-access-links"><button className="worker-text-button" disabled={busy} onClick={recover}>Crear o recuperar contraseña</button><button className="worker-text-button" disabled={busy} onClick={onBack}>Volver al ingreso</button></div></main></div>;
}
