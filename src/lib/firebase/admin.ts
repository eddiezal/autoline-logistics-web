/**
 * Firebase Admin SDK (SERVER ONLY).
 * Imported only by route handlers / proxy / server components — never the
 * browser. Holds the service-account credential, so do NOT add "use client"
 * and never import this from a client component.
 *
 * Used for: verifying ID tokens, minting + verifying session cookies, and
 * privileged Firestore access (seed, server reads).
 *
 * Two auth modes (auto-detected):
 *
 *   1. Explicit service-account creds via env vars (Vercel production):
 *      FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *      (private key stored with literal \n escapes; un-escaped here).
 *
 *   2. Application Default Credentials (local dev when service-account key
 *      creation is blocked by GCP org policy):
 *      Run `gcloud auth application-default login` once. The Admin SDK then
 *      reads ~/.config/gcloud/application_default_credentials.json or the
 *      GOOGLE_APPLICATION_CREDENTIALS env var automatically. FIREBASE_PROJECT_ID
 *      is still required so the SDK knows which project to target.
 *
 * Production deploy on Vercel MUST use mode 1 — ADC is unavailable in the
 * Vercel runtime. Get a real service account key once Ben flips the
 * `iam.disableServiceAccountKeyCreation` org policy.
 */

import "server-only";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Firebase admin not configured: set FIREBASE_PROJECT_ID in .env.local",
    );
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  // Mode 1 — explicit service account credentials.
  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  // Mode 2 — Application Default Credentials (gcloud login).
  // Throws at first use if gcloud creds aren't available.
  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
