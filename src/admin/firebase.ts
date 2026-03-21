import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

/** Turn a codename into a stable synthetic email accepted by Firebase Auth. */
function codinomeToEmail(codinome: string): string {
  const slug = codinome.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${slug}@runningman.local`;
}

export const loginWithCredentials = async (codename: string, password: string) => {
  const email = codinomeToEmail(codename);
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
