/**
 * Firebase client SDK (BROWSER).
 * Imported by client components (login, callback). Uses the public web-app
 * config — all NEXT_PUBLIC_ values are safe to ship to the browser; Firebase
 * security is enforced by Auth + Firestore rules, not by hiding these.
 *
 * Singleton-guarded so Fast Refresh / multiple imports don't re-initialize.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function getClientAuth(): Auth {
  return getAuth(getClientApp());
}
