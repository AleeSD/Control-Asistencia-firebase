import type { Adjustment, Mark, Personnel, Profile } from "./types";

const TZ = "America/Lima";
// Requested on 30/10: preserve earlier entries; use the new label prospectively.
export const REGISTERED_LABEL_FROM = new Date("2026-10-30T13:50:29Z").getTime();
const onTimeStatus = (date: Date) => date.getTime() >= REGISTERED_LABEL_FROM ? "registrado" : "puntual";
const minuteOfDay = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find(p => p.type === "hour")?.value) * 60 + Number(parts.find(p => p.type === "minute")?.value);
};
export const attendanceTime = (date?: Date) => date ? new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "Sin registro";
export const statusLabel = (status: string) => ({
  puntual: "Puntual", registrada: "Registrada", registrado: "Registrado", tarde: "Tarde",
  "salida-anticipada": "Antes de horario", "salida-posterior": "Después de horario", "salida-a-tiempo": "A horario"
} as Record<string, string>)[status] ?? status;

export function enrichMark(mark: Mark): Mark {
  if (!mark.occurredAt) return { ...mark, status: "registrada", lateMinutes: 0 };
  const minute = minuteOfDay(mark.occurredAt.toDate());
  if (mark.type === "salida") {
    if (!mark.scheduleEnd) return { ...mark, status: "registrada", lateMinutes: 0 };
    const [h, m] = mark.scheduleEnd.split(":").map(Number);
    const difference = minute - (h * 60 + m);
    return { ...mark, status: difference < 0 ? "salida-anticipada" : difference > 0 ? "salida-posterior" : "salida-a-tiempo", lateMinutes: 0 };
  }
  const [h, m] = mark.scheduleStart.split(":").map(Number);
  const lateMinutes = Math.max(0, minute - (h * 60 + m + mark.graceMinutes));
  // Keep stored documents and historical status values compatible with older clients.
  return { ...mark, lateMinutes, status: lateMinutes > 0 ? "tarde" : onTimeStatus(mark.occurredAt.toDate()) };
}

export type AttendanceRow = {
  id: string; date: string; name: string; dni: string; company: string;
  entry: string; exit: string; status: string; late: number | null; corrections: string;
};

export function buildAttendanceSummary(marks: Mark[], adjustments: Adjustment[], personnel: Personnel[], profiles: Profile[], day?: string): AttendanceRow[] {
  const people = new Map(personnel.map(p => [p.dni, p]));
  const users = new Map(profiles.map(p => [p.id, p]));
  type Group = { row: AttendanceRow; entry?: Mark; exit?: Mark; entryCorrection?: Adjustment; exitCorrection?: Adjustment };
  const groups = new Map<string, Group>();
  const identity = (item: Mark | Adjustment) => item.personnelId || users.get(item.userId)?.personnelId || item.userId;
  const ensure = (personId: string, date: string, name = "", userId = "") => {
    const id = `${personId}_${date}`;
    if (!groups.has(id)) {
      const person = people.get(personId);
      groups.set(id, { row: { id, date, name: name || person?.displayName || users.get(userId)?.displayName || "Persona sin nombre", dni: person?.dni || (personId === userId ? "" : personId), company: person?.companies.join("/") || "", entry: "Sin registro", exit: "Sin registro", status: "Sin registro", late: null, corrections: "—" } });
    }
    return groups.get(id)!;
  };
  for (const mark of marks) {
    if (day && mark.dayKey !== day) continue;
    const group = ensure(identity(mark), mark.dayKey, mark.displayName, mark.userId);
    // Duplicated legacy records stay in detail; choose first entry and last exit in summary.
    const previous = group[mark.type === "entrada" ? "entry" : "exit"];
    const time = mark.occurredAt?.toDate().getTime() ?? 0;
    const oldTime = previous?.occurredAt?.toDate().getTime() ?? 0;
    if (!previous || (mark.type === "entrada" ? time < oldTime : time > oldTime)) group[mark.type === "entrada" ? "entry" : "exit"] = mark;
  }
  for (const adjustment of adjustments) {
    if (day && adjustment.dayKey !== day) continue;
    const group = ensure(identity(adjustment), adjustment.dayKey, "", adjustment.userId);
    group[adjustment.type === "entrada" ? "entryCorrection" : "exitCorrection"] = adjustment;
  }
  // Daily reports use the current roster, without labelling missing records as absences.
  if (day) for (const person of personnel.filter(p => p.active)) ensure(person.dni, day, person.displayName);
  for (const group of groups.values()) {
    const { row, entry, exit, entryCorrection, exitCorrection } = group;
    const entryAt = entryCorrection?.correctedAt ?? entry?.occurredAt;
    row.entry = attendanceTime(entryAt?.toDate());
    row.exit = attendanceTime((exitCorrection?.correctedAt ?? exit?.occurredAt)?.toDate());
    row.corrections = [entryCorrection ? "Entrada" : "", exitCorrection ? "Salida" : ""].filter(Boolean).join(" y ") || "—";
    if (entryAt) {
      const schedule = entry ?? people.get(row.dni);
      if (schedule?.scheduleStart) {
        const [h, m] = schedule.scheduleStart.split(":").map(Number);
        row.late = Math.max(0, minuteOfDay(entryAt.toDate()) - (h * 60 + m + schedule.graceMinutes));
        row.status = row.late > 0 ? "Tarde" : statusLabel(onTimeStatus((entry?.occurredAt ?? entryAt).toDate()));
      } else row.status = "Registrado";
    } else if (exit || exitCorrection) row.status = "Sin entrada";
  }
  return [...groups.values()].map(g => g.row).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
}
