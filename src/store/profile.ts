
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserDoc, loadMasterAccount, updateLastLogin } from './firestore';
import type { MasterAccount } from '../types/player';

function masterIdToEmail(masterId: string): string {
  const slug = masterId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${slug}@limboos.local`;
}

export type LoginResult =
  | { ok: true;  account: MasterAccount }
  | { ok: false; error: 'wrong_password' | 'network' | 'unknown'; message: string };

export async function loginOrCreate(
  masterId: string,
  password: string,
): Promise<LoginResult> {
  // Verifica se o input é um e-mail legado
  const isLegacyEmail = masterId.includes('@') && masterId.includes('.');
  const email = isLegacyEmail ? masterId.trim() : masterIdToEmail(masterId);
  
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await updateLastLogin(user.uid);
    const account = await loadMasterAccount(user.uid);
    // Block suspended non-admin accounts
    if (account.suspended && account.role !== 'admin') {
      await firebaseSignOut(auth);
      return { ok: false, error: 'unknown' as const, message: 'CONTA SUSPENSA: Contate o administrador.' };
    }
    return { ok: true, account };
  } catch (signInErr: unknown) {
    const code = (signInErr as { code?: string }).code ?? '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await createUserDoc(user.uid, email, masterId);
        const account = await loadMasterAccount(user.uid);
        return { ok: true, account };
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

export async function loginWithProvider(providerName: 'google' | 'apple'): Promise<LoginResult> {
  try {
    let provider;
    if (providerName === 'google') {
      provider = new GoogleAuthProvider();
    } else {
      provider = new OAuthProvider('apple.com');
    }

    const { user } = await signInWithPopup(auth, provider);
    await updateLastLogin(user.uid);
    
    let account;
    try {
      account = await loadMasterAccount(user.uid);
    } catch {
      // Conta não existe ainda, vamos criá-la
      const email = user.email || `${user.uid}@limboos.local`;
      const masterId = user.displayName || email.split('@')[0];
      await createUserDoc(user.uid, email, masterId);
      account = await loadMasterAccount(user.uid);
    }

    if (account.suspended && account.role !== 'admin') {
      await firebaseSignOut(auth);
      return { ok: false, error: 'unknown' as const, message: 'CONTA SUSPENSA: Contate o administrador.' };
    }

    return { ok: true, account };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    
    if (code === 'auth/popup-closed-by-user') {
      return { ok: false, error: 'unknown', message: 'OPERAÇÃO CANCELADA PELO USUÁRIO' };
    }
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: 'SEM CONEXÃO: verifique a rede.' };
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return { ok: false, error: 'unknown', message: 'E-mail já cadastrado através de outro método de login.' };
    }
    
    return { ok: false, error: 'unknown', message: `Erro no login via provedor (${code})` };
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
