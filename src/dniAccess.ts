import { signInAnonymously, signOut } from "firebase/auth";
import { doc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { workerAuth, workerDb } from "./firebase";
import type { Timestamp } from "firebase/firestore";
import type { Personnel } from "./types";

export type WorkerPerson = Pick<Personnel, "dni" | "displayName" | "active" | "scheduleStart" | "scheduleEnd" | "graceMinutes">;
export type DniSession = { personnelId: string; createdAt: Timestamp };
export type DniResult = { state: "unknown" | "inactive" | "register" | "ready"; uid: string; dni: string };
export async function enterDni(raw: string): Promise<DniResult> {
  const dni = raw.trim();
  if (!/^\d{8}$/.test(dni)) throw new Error("Ingresa los 8 dígitos de tu DNI.");
  if (!workerAuth || !workerDb) throw new Error("La conexión no está disponible.");
  await workerAuth.authStateReady();
  let user = workerAuth.currentUser ?? (await signInAnonymously(workerAuth)).user;
  const directory = await getDocFromServer(doc(workerDb, "workerDirectory", dni));
  if (!directory.exists()) return {state:"unknown",uid:user.uid,dni};
  if (!directory.data().active) return {state:"inactive",uid:user.uid,dni};
  // A UID is permanently bound to one DNI. Changing people creates a fresh session.
  const ref = doc(workerDb, "workerSessions", user.uid);
  const session = await getDocFromServer(ref);
  if (session.exists() && (session.data().personnelId !== dni || Date.now() - session.data().createdAt.toMillis() >= 12 * 3600000)) {
    await signOut(workerAuth); user = (await signInAnonymously(workerAuth)).user;
  }
  const request = !directory.data().approved || !session.exists() ? await getDocFromServer(doc(workerDb, "registrationRequests", user.uid)) : null;
  if (request?.exists() && request.data().dni !== dni) {
    await signOut(workerAuth); user = (await signInAnonymously(workerAuth)).user;
  }
  if (!directory.data().approved) return {state:"register",uid:user.uid,dni};
  if (!session.exists() || user.uid !== session.id) {
    await setDoc(doc(workerDb, "workerSessions", user.uid), {personnelId:dni,createdAt:serverTimestamp()});
  }
  // This read verifies the current approval, including revocation and session expiration.
  try { await getDocFromServer(doc(workerDb, "workerPanels", dni)); }
  catch(error) {
    if ((error as {code?:string}).code !== "permission-denied" || !session.exists()) throw error;
    // A new approval invalidates an earlier session, but never requires another approval.
    await signOut(workerAuth); user = (await signInAnonymously(workerAuth)).user;
    await setDoc(doc(workerDb, "workerSessions", user.uid), {personnelId:dni,createdAt:serverTimestamp()});
    await getDocFromServer(doc(workerDb, "workerPanels", dni));
  }
  return {state:"ready",uid:user.uid,dni};
}
export async function leaveWorker() { if (workerAuth) await signOut(workerAuth); }
