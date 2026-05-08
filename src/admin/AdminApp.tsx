import React, { useState, useEffect } from 'react';
import { auth, db, testConnection } from '../lib/firebase';
import { logout } from '../store/profile';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
import RetroLoading from '../components/player/RetroLoading';

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
    return <RetroLoading fullScreen message="Inicializando_Protocolos..." subMessage="Acessando Terminal Administrativo RM-84" />;
  }

  if (!user) {
    window.location.href = '/';
    return null;
  }

  return <Dashboard user={user} onLogout={logout} />;
}
