const fs=require('fs');
let s=fs.readFileSync('tmp/test-dni-ui.mjs','utf8');
s=s.replace("await page.getByRole('heading',{name:'Acceso aprobado'}).waitFor();await page.getByRole('button',{name:'Comprobar acceso'}).click();",'');
s=s.replace("const browser=await chromium.launch", "const browser=await chromium.launch");
fs.writeFileSync('tmp/test-flow-worker.mjs',s);
s=fs.readFileSync('tmp/test-management-ui.mjs','utf8');
s=s.replace(" const uid=await page.evaluate",` const popupPromise=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Acceso del encargado',exact:true}).click();
 const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
 assert.equal(await page.getByText('Soy trabajador',{exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'Ingresa tu DNI'}).count(),1);
 await popup.close();await page.getByRole('button',{name:'Acceso del encargado',exact:true}).waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Acceso del encargado')?.disabled);
 const uid=await page.evaluate`);
s=s.replace(" assert.deepEqual(errors,[]);console.log(",` for(const label of ['Inicio','Marcaciones','Incidencias','Equipo','Reportes','Auditoría']) {
  await page.getByRole('button',{name:label,exact:true}).click();
  if(label!=='Inicio')await page.getByRole('heading',{name:label,exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'Reportes',exact:true}).click();
 for(const mode of ['Día','Mes']) {
  await page.getByRole('group',{name:'Período del reporte'}).getByRole('button',{name:mode,exact:true}).click();
  for(const format of ['Excel','PDF']) {
   const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar '+format,exact:true}).click();
   const file=await downloading;assert.equal(await file.failure(),null);
  }
 }
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await page.getByRole('heading',{name:'Ingresa tu DNI'}).waitFor();
 assert.equal(await page.getByText('Soy trabajador',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log(`);
fs.writeFileSync('tmp/test-flow-manager.mjs',s);
