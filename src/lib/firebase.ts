// Firebase app initialization
// Fill in your VITE_FIREBASE_* values in .env (see .env.example)

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);
export const functions = getFunctions(app, 'southamerica-east1');

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

// ── Global Error Interceptor → Admin Activity Log ───────────────────────────
// Captures unhandled errors and rejected promises so they appear in the admin
// live feed instead of being silently swallowed by the browser console.

import { activityLogger } from '../services/ActivityLogger';

function getErrorDigest(error: unknown): { message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, code: (error as any).code };
  }
  return { message: String(error) };
}

window.addEventListener('error', (event) => {
  const { message, stack, code } = getErrorDigest(event.error ?? event.message);
  activityLogger.logAdmin('system', 'unhandled_error', `[GLOBAL_ERROR] ${message}`, {
    stack, code, filename: event.filename, lineno: event.lineno, colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const { message, stack, code } = getErrorDigest(event.reason);
  // Skip noisy Firestore internal transport retries that auto-resolve
  if (message.includes('Failed to fetch') || message.includes('access control checks')) return;
  activityLogger.logAdmin('system', 'unhandled_rejection', `[PROMISE_ERROR] ${message}`, {
    stack, code,
  });
});
