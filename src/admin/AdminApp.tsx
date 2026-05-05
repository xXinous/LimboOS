import React, { useState, useEffect } from 'react';
import { auth, db, testConnection } from '../lib/firebase';
import { logout } from '../store/profile';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
const ADMIN_CODENAME = 'gm.mpg';
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-chakra overflow-hidden relative">
        <div className="noise-overlay" /><div className="scanlines" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="animate-pulse text-primary text-xl font-black tracking-[0.3em] uppercase">Inicializando_Protocolos...</div>
        </div>
      </div>
    );
  }
  if (!user) {
    window.location.href = '/';
    return null;
  }
  return <Dashboard user={user} onLogout={logout} />;
}
