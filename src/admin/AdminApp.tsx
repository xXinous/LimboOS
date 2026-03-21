import React, { useState, useEffect } from 'react';
import { auth, db, loginWithCredentials, logout, testConnection } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Dashboard from './components/Dashboard';

const ADMIN_CODENAME = 'gm.mpg';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [codename, setCodename] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: ADMIN_CODENAME,
            role: 'admin',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (codename.trim().toLowerCase() !== ADMIN_CODENAME) {
      setLoginError('ACESSO NEGADO: CREDENCIAIS INVÁLIDAS');
      return;
    }

    setLoginLoading(true);
    try {
      await loginWithCredentials(codename.trim(), password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setLoginError('FALHA NA AUTENTICAÇÃO: SENHA INCORRETA');
      } else if (code === 'auth/user-not-found') {
        setLoginError('CONTA_ADM NÃO ENCONTRADA. Crie primeiro no app principal.');
      } else {
        setLoginError(`ERRO: ${code || 'DESCONHECIDO'}`);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center font-headline">
        <div className="animate-pulse text-primary-container text-2xl tracking-widest">INITIALIZING_SYSTEM...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center font-headline">
        {/* CRT overlay */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-[0.03] z-100 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%]"></div>

        <div className="w-full max-w-md p-8">
          {/* Header */}
          <div className="mb-10 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.6)]"></div>
              <h1 className="text-3xl font-black tracking-tighter text-orange-500 italic">SYS_ADMIN</h1>
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.6)]"></div>
            </div>
            <p className="font-label text-[10px] uppercase tracking-[0.4em] text-zinc-500">
              RunningMan // Administrative_Interface
            </p>
            <div className="mt-4 h-px bg-linear-to-r from-transparent via-orange-500/30 to-transparent"></div>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-orange-500 text-sm">terminal</span>
                <span className="font-label text-[10px] uppercase tracking-widest text-zinc-500">Authentication_Required</span>
              </div>

              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Operator_Codename</label>
                <input
                  type="text"
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  placeholder="ENTER_CODENAME..."
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-4 py-3 text-sm font-headline tracking-wide focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none placeholder:text-zinc-700 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Access_Key</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-4 py-3 text-sm font-headline tracking-wide focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none placeholder:text-zinc-700 transition-all"
                />
              </div>
            </div>

            {loginError && (
              <div className="bg-error/10 border border-error/30 px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-sm">error</span>
                <p className="text-error text-xs font-label tracking-wider">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-primary-container text-on-primary py-3 font-label text-xs font-bold tracking-[0.3em] uppercase shadow-[0_0_15px_rgba(255,140,0,0.3)] hover:brightness-110 active:scale-[0.98] transition-all machined-edge disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  AUTHENTICATING...
                </span>
              ) : (
                'INITIALIZE_SESSION'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="font-label text-[8px] uppercase tracking-widest text-zinc-700">
              RESTRICTED_ACCESS // AUTHORIZED_PERSONNEL_ONLY
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} onLogout={logout} />;
}
