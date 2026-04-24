
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserDoc, loadPlayerData, updateLastLogin } from './firestore';
import type { PlayerData } from './firestore';

export type { PlayerData };

function codinomeToEmail(codinome: string): string {
  const slug = codinome.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${slug}@runningman.local`;
}

export type LoginResult =
  | { ok: true;  data: PlayerData }
  | { ok: false; error: 'wrong_password' | 'network' | 'unknown'; message: string };

export async function loginOrCreate(
  codinome: string,
  password: string,
): Promise<LoginResult> {
  const email = codinomeToEmail(codinome);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    // Atualiza o visto por último ao logar
    await updateLastLogin(user.uid);
    const data = await loadPlayerData(user.uid);
    return { ok: true, data };
  } catch (signInErr: unknown) {
    const code = (signInErr as { code?: string }).code ?? '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await createUserDoc(user.uid, codinome.trim(), email);
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
    if (code === 'auth/wrong-password') {
      return { ok: false, error: 'wrong_password', message: 'FALHA NA AUTENTICAÇÃO: CREDENCIAIS INVÁLIDAS' };
    }
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: 'SEM CONEXÃO: verifique a rede.' };
    }
    return { ok: false, error: 'unknown', message: `Erro inesperado (${code})` };
  }
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
