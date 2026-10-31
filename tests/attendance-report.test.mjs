import { readFileSync } from "node:fs";
import ts from "typescript";
import test from "node:test";
import assert from "node:assert/strict";
const servicesCode=ts.transpileModule(readFileSync('src/services.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const servicesUrl='data:text/javascript;base64,'+Buffer.from(servicesCode).toString('base64');
const code = ts.transpileModule(readFileSync("src/attendanceReport.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('"./services"',JSON.stringify(servicesUrl));
const { buildAttendanceSummary: summary, enrichMark, statusLabel } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const stamp = value => ({ toDate: () => new Date(value) });
const person = (dni, extras = {}) => ({ dni, displayName: "Persona " + dni, active: true, companies: ["OS"], scheduleStart: "06:10", graceMinutes: 0, ...extras });
const mark = (day = "2026-10-31", type = "entrada", time = "06:10", extras = {}) => ({ id: "m-" + type, userId: "uid1", personnelId: "12345678", displayName: "Persona 1", dayKey: day, type, occurredAt: stamp(`${day}T${time}:00-05:00`), scheduleStart: "06:10", graceMinutes: 0, ...extras });
test("nuevo Registrado es prospectivo y conserva Puntual histórico y la tardanza", () => {
  assert.equal(statusLabel(enrichMark(mark("2026-10-30")).status), "Puntual");
  assert.equal(statusLabel(enrichMark(mark()).status), "Registrado");
  assert.equal(enrichMark(mark("2026-10-31", "entrada", "06:11")).lateMinutes, 1);
  assert.equal(enrichMark(mark("2026-10-31", "entrada", "06:11")).status, "tarde");
});
test("resumen agrupa por DNI y día, conserva originales y aplica correcciones", () => {
  const marks = [mark(undefined, "entrada", "07:00"), mark(undefined, "salida", "17:00")];
  const before = JSON.stringify(marks);
  const adjustment = { id: "a1", userId: "uid1", personnelId: "12345678", dayKey: "2026-10-31", type: "entrada", correctedAt: stamp("2026-10-31T06:10:00-05:00"), originalMarkId: "m-entrada" };
  const rows = summary(marks, [adjustment], [person("12345678")], [], "2026-10-31");
  assert.equal(rows.length, 1); assert.equal(rows[0].entry, "06:10"); assert.equal(rows[0].exit, "17:00");
  assert.equal(rows[0].late, 0); assert.equal(rows[0].status, "Registrado"); assert.equal(rows[0].corrections, "Entrada");
  assert.equal(JSON.stringify(marks), before);
});
test("día incluye padrón activo sin inventar faltas; mes no fabrica días sin registro", () => {
  const roster = [person("12345678"), person("87654321"), person("99999999", {active:false})];
  const daily = summary([mark()], [], roster, [], "2026-10-31");
  assert.equal(daily.length, 2); assert.equal(daily.find(r => r.dni === "87654321").status, "Sin registro");
  assert.equal(summary([mark()], [], roster, []).length, 1);
});
test("corrección sin original, salida sin entrada e histórico de baja siguen visibles", () => {
  const correction = { userId:"old", personnelId:"12345678", dayKey:"2026-10-31", type:"salida", correctedAt:stamp("2026-10-31T17:00:00-05:00") };
  const rows = summary([], [correction], [person("12345678", {active:false})], [], "2026-10-31");
  assert.equal(rows.length, 1); assert.equal(rows[0].status, "Sin entrada"); assert.equal(rows[0].exit, "17:00");
});
test("más de 500 marcas no se recortan en el resumen", () => {
  const marks = Array.from({length:601}, (_,i) => mark(undefined, "entrada", "06:00", {id:"m"+i, personnelId:String(10000000+i)}));
  assert.equal(summary(marks, [], [], []).length, 601);
});

test("servicio preserva históricos vacíos y toma la salida nueva sin alterar la entrada", () => {
 const entry=mark();const exit=mark(undefined,'salida','17:00',{service:'Mass'});
 assert.equal(summary([entry],[],[],[])[0].service,'');
 assert.equal(summary([entry,exit],[],[],[])[0].service,'MASS');
 assert.equal(entry.service,undefined);
 assert.equal(summary([{...entry,service:'Transferencia'},exit],[],[],[])[0].service,'Transferencia / MASS');
});
