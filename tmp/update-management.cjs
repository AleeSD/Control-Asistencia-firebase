const fs=require('fs');
let p='src/RosterPanel.tsx',s=fs.readFileSync(p,'utf8');
function replace(a,b){if(!s.includes(a))throw Error('Expected UI source missing');s=s.replace(a,b)}
replace('approveRegistration, deletePersonnel,','approveRegistration, removePersonnel,');
replace('await deletePersonnel(confirming.person);','await removePersonnel(confirming.person);');
replace('{!p.active && !p.approvedUid && <button','{<button');
replace('Esta persona dejará de figurar en el padrón. Sus marcaciones e incidencias anteriores seguirán en el historial. Si permanece en el Excel, una importación futura volverá a agregarla.','Se eliminará a esta persona del padrón y se revocará su acceso en todos los dispositivos. Sus marcaciones e incidencias anteriores seguirán en el historial. Si permanece en el Excel, una importación futura volverá a agregarla.');
replace('<option value="AUXILIAR DE TRANSPORTE">Auxiliar</option></select>','<option value="AUXILIAR DE TRANSPORTE">Auxiliar</option><option value="COORDINADOR">Coordinador</option><option value="MONITOREO">Monitoreo</option></select>');
// Keep entered schedules when choosing a different occupation: all roles use the form's explicit schedule.
replace('onChange={e => { setOccupation(e.target.value); if (!initial) { setScheduleStart("06:10"); setScheduleEnd(""); setGraceMinutes(0); } }}','onChange={e => setOccupation(e.target.value)}');
fs.writeFileSync(p,s);
p='tests/dni-manager.rules.test.mjs';s=fs.readFileSync(p,'utf8');
replace("existing Monitoreo can be approved without admitting new Monitoreo roster entries","existing Monitoreo can be approved; managers can add Monitoreo and coordinators");
replace("// The exception preserves an existing occupation; it cannot add or reclassify staff.\r\n await assert.rejects(roster.savePersonnel({...entry,dni:'45678901',occupation:'MONITOREO'}));", "await roster.savePersonnel({...entry,dni:'45678901',occupation:'MONITOREO'});\n assert.equal((await getDoc(doc(store,'personnel','45678901'))).data().occupation,'MONITOREO');\n await roster.savePersonnel({...entry,dni:'45678902',occupation:'COORDINADOR'});\n assert.equal((await getDoc(doc(store,'personnel','45678902'))).data().occupation,'COORDINADOR');");
fs.writeFileSync(p,s);
