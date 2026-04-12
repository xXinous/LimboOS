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
  experimentalForceLongPolling: true,
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
// Intercepts ALL console.error / console.warn calls + unhandled errors so they
// appear in the admin live feed. Uses a re-entrancy guard to avoid infinite
// loops when the activityLogger itself triggers a console.error.

import { activityLogger } from '../services/ActivityLogger';

let _isLogging = false; // re-entrancy guard

function argsToString(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return `${a.message}`;
    if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
    return String(a);
  }).join(' ');
}

// ── Intercept console.error ─────────────────────────────────────────────────

function logGlobalBrowserError(tag: string, fullMessage: string, stack?: string, code?: string, extraArgs?: any) {
  const user = auth?.currentUser;
  
  // Create a clean summary from the first line, max 150 chars
  const lines = fullMessage.split('\n');
  let summary = lines[0] || 'Unknown Error';
  if (summary.length > 150) summary = summary.slice(0, 147) + '...';
  
  const finalMessage = `[${tag}] ${summary}`;
  const metadata: Record<string, unknown> = { fullMessage };
  if (stack !== undefined) metadata.stack = stack;
  if (code !== undefined) metadata.code = code;
  if (extraArgs !== undefined) metadata.extraArgs = extraArgs;

  // Only log to Firestore when there is an authenticated user.
  // Writing without auth causes a permission-denied error, which would
  // re-enter this function and create an infinite loop.
  if (!user) return;

  const name = user.displayName || user.email || 'unknown_player';
  if (user.email === 'gm.mpg@runningman.local') {
    activityLogger.logAdmin(name, tag.toLowerCase(), finalMessage, metadata);
  } else {
    activityLogger.logError(user.uid, name, finalMessage, stack, metadata);
  }
}

const _origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  _origError(...args);
  if (_isLogging) return;
  _isLogging = true;
  try {
    const msg = argsToString(args);
    // Skip Firestore transport noise that auto-resolves, and ActivityLogger
    // write failures (permission errors) to prevent infinite feedback loops.
    if (msg.includes('[ActivityLogger]')) { _isLogging = false; return; }
    logGlobalBrowserError('CONSOLE.ERROR', msg, undefined, undefined, args.length > 1 ? args : undefined);
  } finally { _isLogging = false; }
};

// ── Intercept console.warn ──────────────────────────────────────────────────
const _origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  _origWarn(...args);
  if (_isLogging) return;
  _isLogging = true;
  try {
    const msg = argsToString(args);
    if (
      msg.includes('access control checks') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('[ActivityLogger]')
    ) { _isLogging = false; return; }
    logGlobalBrowserError('CONSOLE.WARN', msg, undefined, undefined, args.length > 1 ? args : undefined);
  } finally { _isLogging = false; }
};

// ── Unhandled errors & rejections ───────────────────────────────────────────
function getErrorDigest(error: unknown): { message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, code: (error as any).code };
  }
  return { message: String(error) };
}

window.addEventListener('error', (event) => {
  const { message, stack, code } = getErrorDigest(event.error ?? event.message);
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('GLOBAL_ERROR', message, stack, code, {
      filename: event.filename, lineno: event.lineno, colno: event.colno
    });
  } finally { _isLogging = false; }
});

window.addEventListener('unhandledrejection', (event) => {
  const { message, stack, code } = getErrorDigest(event.reason);
  if (
    message.includes('[ActivityLogger]') ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('permission-denied')
  ) return;
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('PROMISE_ERROR', message, stack, code);
  } finally { _isLogging = false; }
});
