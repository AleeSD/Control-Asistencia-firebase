// One isolated anonymous session; verifies access only, never presses a mark button.
const fs=require('fs');
const auth=require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
const {chromium}=require('C:/Users/transporte.ope3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const a=auth.getGlobalDefaultAccount(),token=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 const base='https://firestore.googleapis.com/v1/projects/sistema-de-asistencia-os/databases/(default)/documents';
 const headers={Authorization:'Bearer '+token.access_token};const r=await fetch(base+'/personnel?pageSize=1000',{headers});if(!r.ok)throw Error('No se pudo seleccionar una aprobación para comprobar acceso.');
 const people=(await r.json()).documents??[];const p=people.find(p=>p.fields?.active?.booleanValue&&p.fields?.approvedUid?.stringValue);if(!p)throw Error('No se encontró aprobación vigente.');const dni=p.fields.dni.stringValue;
 const browser=await chromium.launch({headless:true,channel:'chrome'});let created=null,key=null;const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async res=>{if(res.url().includes('identitytoolkit.googleapis.com/v1/accounts:signUp')&&res.ok()){created=await res.json();key=new URL(res.url()).searchParams.get('key');}});
  const response=await page.goto(process.argv[2]);if(response.status()!==200)throw Error('Hosting no disponible.');
  await page.getByRole('heading',{name:'Ingresa tu DNI'}).waitFor();
  await page.getByLabel('DNI',{exact:true}).fill(dni);await page.getByRole('button',{name:'Ingresar',exact:true}).click();
  await page.getByRole('heading',{name:/Hola,/}).waitFor();await page.getByRole('button',{name:/^(Marcar entrada|Marcar salida|Jornada completada)$/}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Ingresa tu DNI'}).waitFor();
  if(errors.length)throw Error('Error JavaScript en la vista previa.');
  console.log('PASS: Hosting HTTP 200, aprobado existente accede con DNI en navegador nuevo, recarga vuelve al DNI. No se marcaron asistencias.');
 }finally{
  await browser.close();
  if(created?.localId&&created?.idToken&&key){
   const del=await fetch(base+'/workerSessions/'+encodeURIComponent(created.localId),{method:'DELETE',headers});
   const au=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:created.idToken})});
   console.log('Limpieza exclusiva de sesión de prueba y cuenta anónima temporal: '+(del.ok&&au.ok?'OK':'revisar'));
   if(!del.ok||!au.ok)throw Error('Limpieza de prueba incompleta.');
  }
 }
})().catch(()=>{console.error('La comprobación de acceso no terminó correctamente; revisar localmente sin publicar datos personales.');process.exitCode=1});
