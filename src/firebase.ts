import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserSessionPersistence, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const emulator = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";
const config = emulator ? {apiKey:"demo-key",authDomain:"localhost",projectId:"demo-os-logistics",appId:"demo-app",messagingSenderId:"demo"} : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

export const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
// Separate session storage for workers: never changes the manager's Google session.
const workerApp = configured ? initializeApp(config, "worker-dni") : null;
export const workerAuth = workerApp ? initializeAuth(workerApp, { persistence: browserSessionPersistence }) : null;
export const workerDb = workerApp ? getFirestore(workerApp) : null;
if (emulator && auth && db && workerAuth && workerDb) {
  for (const instance of [auth, workerAuth]) connectAuthEmulator(instance, "http://127.0.0.1:9099", {disableWarnings:true});
  for (const instance of [db, workerDb]) connectFirestoreEmulator(instance, "127.0.0.1", 8080);
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
