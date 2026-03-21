// Firebase Auth service — replaces the localStorage-based profile system.
//
// Login strategy (Opção B from the plan):
//   "Codinome do Agente" is used as the username.
//   Internally we craft a synthetic email: {codinome}@runningman.local
//   The player never sees or types an email address.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserDoc, loadPlayerData } from './firestore';
import type { PlayerData } from './firestore';

// Re-export so the rest of the app only imports from here
export type { PlayerData };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Turn a codinome into a stable synthetic email accepted by Firebase Auth. */
function codinomeToEmail(codinome: string): string {
  const slug = codinome.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${slug}@runningman.local`;
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export type LoginResult =
  | { ok: true;  data: PlayerData }
  | { ok: false; error: 'wrong_password' | 'network' | 'unknown'; message: string };

/**
 * Attempt to sign in, and create the account if it doesn't exist yet.
 * Returns the full PlayerData on success.
 */
export async function loginOrCreate(
  codinome: string,
  password: string,
): Promise<LoginResult> {
  const email = codinomeToEmail(codinome);

  try {
    // ── Try sign-in first ──────────────────────────────────────────────────
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const data = await loadPlayerData(user.uid);
    return { ok: true, data };

  } catch (signInErr: unknown) {
    const code = (signInErr as { code?: string }).code ?? '';

    // ── Account doesn't exist → create it ─────────────────────────────────
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await createUserDoc(user.uid, codinome.trim());
        const data = await loadPlayerData(user.uid);
        return { ok: true, data };
      } catch (createErr: unknown) {
        const createCode = (createErr as { code?: string }).code ?? '';
        if (createCode === 'auth/weak-password') {
          return { ok: false, error: 'wrong_password', message: 'Senha muito fraca (mínimo 6 caracteres).' };
        }
        if (createCode === 'auth/email-already-in-use') {
          return { ok: false, error: 'wrong_password', message: 'FALHA NA AUTENTICAÇÃO: SENHA INCORRETA' };
        }
        return { ok: false, error: 'unknown', message: 'Erro ao criar perfil.' };
      }
    }

    // ── Wrong password ─────────────────────────────────────────────────────
    if (code === 'auth/wrong-password') {
      return { ok: false, error: 'wrong_password', message: 'FALHA NA AUTENTICAÇÃO: CREDENCIAIS INVÁLIDAS' };
    }

    // ── Network / other ────────────────────────────────────────────────────
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: 'SEM CONEXÃO: verifique a rede.' };
    }

    return { ok: false, error: 'unknown', message: `Erro inesperado (${code})` };
  }
}

/** Sign out the current user. */
export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Returns unsubscribe function.
 * Fires immediately with the current user (or null).
 */
export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

/** Get current Firebase user (synchronous, may be null before auth resolves). */
export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
