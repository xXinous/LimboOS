
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
import { activityLogger } from '../services/ActivityLogger';
let _isLogging = false; 
function argsToString(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return `${a.message}`;
    if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
    return String(a);
  }).join(' ');
}
function logGlobalBrowserError(tag: string, fullMessage: string, stack?: string, code?: string, extraArgs?: any) {
  const user = auth?.currentUser;
  const lines = fullMessage.split('\n');
  let summary = lines[0] || 'Unknown Error';
  if (summary.length > 150) summary = summary.slice(0, 147) + '...';
  const finalMessage = `[${tag}] ${summary}`;
  const metadata: Record<string, unknown> = { fullMessage };
  if (stack !== undefined) metadata.stack = stack;
  if (code !== undefined) metadata.code = code;
  if (extraArgs !== undefined) metadata.extraArgs = extraArgs;
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
    if (
      msg.includes('[ActivityLogger]') ||
      msg.includes('access control checks') ||
      msg.includes('Missing or insufficient permissions')
    ) { _isLogging = false; return; }
    logGlobalBrowserError('CONSOLE.ERROR', msg, undefined, undefined, args.length > 1 ? args : undefined);
  } finally { _isLogging = false; }
};
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
    message.includes('permission-denied') ||
    message.includes('access control checks')
  ) return;
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('PROMISE_ERROR', message, stack, code);
  } finally { _isLogging = false; }
});
