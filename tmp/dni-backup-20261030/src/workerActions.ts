import { collection, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { MarkLocation, MarkType, Personnel, Profile } from "./types";

const store = () => { if (!db) throw new Error("La conexión no está disponible."); return db; };
const worker = () => {
  const user = auth?.currentUser;
  if (!user?.isAnonymous) throw new Error("Abre el acceso para trabajadores.");
  return user;
};
export const limaDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit"
}).format(date);

export async function submitRegistration(data: {
  dni: string; firstNames: string; surnames: string; contactPhone: string; contactEmail: string;
}) {
  const user = worker();
  const dni = data.dni.trim();
  const firstNames = data.firstNames.trim();
  const surnames = data.surnames.trim();
  const contactPhone = data.contactPhone.trim();
  const contactEmail = data.contactEmail.trim().toLowerCase();
  if (!/^\d{8}$/.test(dni) || firstNames.length < 2 || surnames.length < 2 ||
      (!contactPhone && !contactEmail) || contactPhone.length > 25 ||
      (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
    throw new Error("Revisa tu DNI, nombres, apellidos y un dato de contacto.");
  }
  const ref = doc(store(), "registrationRequests", user.uid);
  const current = await getDoc(ref);
  if (current.exists()) {
    if (current.data().status !== "rechazada") throw new Error("Tu solicitud ya está registrada.");
    await updateDoc(ref, { dni, firstNames, surnames, contactPhone, contactEmail, status: "pendiente", updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, { dni, firstNames, surnames, contactPhone, contactEmail, status: "pendiente", createdAt: serverTimestamp() });
  }
}

export function getMarkLocation(): Promise<Extract<MarkLocation, { status: "captured" }>> {
  if (!navigator.geolocation) return Promise.reject(new Error("Este navegador no ofrece ubicación. Abre la página en Chrome o Safari desde tu celular."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(accuracy) &&
          lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && accuracy >= 0 && accuracy <= 100000) {
          resolve({ status: "captured", lat, lng, accuracyMeters: Math.round(accuracy) });
        } else reject(new Error("La ubicación recibida no es válida. Activa el GPS e inténtalo de nuevo."));
      },
      error => reject(new Error(error.code === 1
        ? "Debes permitir la ubicación para marcar. Activa el GPS y cambia el permiso de ubicación de esta página a «Permitir» en tu navegador."
        : error.code === 3 ? "No se obtuvo tu ubicación a tiempo. Activa el GPS, busca una zona con señal e inténtalo de nuevo."
        : "No se pudo obtener tu ubicación. Activa el GPS e inténtalo de nuevo.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export async function markWorkerAttendance(profile: Profile, person: Personnel, type: MarkType, location: Extract<MarkLocation, { status: "captured" }>) {
  const user = worker();
  if (!profile.personnelId || !profile.active || !person.active || person.dni !== profile.personnelId || person.approvedUid !== user.uid) throw new Error("Tu celular aún no está autorizado.");
  const dayKey = limaDay();
  const id = `${profile.personnelId}_${dayKey}_${type}`;
  const batch = writeBatch(store());
  batch.set(doc(store(), "marks", id), {
    userId: user.uid, personnelId: profile.personnelId, displayName: person.displayName,
    type, dayKey, occurredAt: serverTimestamp(), scheduleStart: person.scheduleStart,
    scheduleEnd: person.scheduleEnd ?? null, graceMinutes: person.graceMinutes, source: "web", location
  });
  batch.set(doc(store(), "audit", `mark_${id}`), { action: "mark_attendance", actorId: user.uid, targetId: id, at: serverTimestamp() });
  await batch.commit();
}

export async function submitWorkerIncident(profile: Profile, person: Personnel, data: {
  dayKey: string; type: MarkType; proposedAt: string; reason: string;
}) {
  const user = worker();
  if (!profile.personnelId || !profile.active || !person.active || person.dni !== profile.personnelId || person.approvedUid !== user.uid) throw new Error("Tu celular aún no está autorizado.");
  const reason = data.reason.trim();
  const proposedAt = new Date(data.proposedAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dayKey) || !["entrada", "salida"].includes(data.type) ||
      reason.length < 5 || reason.length > 1000 || Number.isNaN(proposedAt.getTime()) ||
      limaDay(proposedAt) !== data.dayKey || proposedAt.getTime() > Date.now() ||
      Date.now() - proposedAt.getTime() > 90 * 86400000) throw new Error("Revisa la fecha, hora y motivo. Se permiten los últimos 90 días.");
  const markId = `${profile.personnelId}_${data.dayKey}_${data.type}`;
  const mark = await getDoc(doc(store(), "marks", markId));
  const ref = doc(collection(store(), "incidents"));
  const batch = writeBatch(store());
  batch.set(ref, { userId: user.uid, personnelId: profile.personnelId, displayName: person.displayName,
    dayKey: data.dayKey, type: data.type, markId: mark.exists() ? markId : null,
    proposedAt: Timestamp.fromDate(proposedAt), reason, status: "pendiente", createdAt: serverTimestamp() });
  batch.set(doc(store(), "audit", `incident_${ref.id}`), { action: "submit_incident", actorId: user.uid, targetId: ref.id, at: serverTimestamp() });
  await batch.commit();
}
