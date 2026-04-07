import { db, functions } from "../lib/firebase";
import {
  collection,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDoc,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

export interface UserData {
  uid: string;
  displayName?: string;
  username?: string;
  email: string;
  role: string;
  lastLogin?: any;
  createdAt?: any;
  hasTerminalAccess?: boolean;
  hasMacAccess?: boolean;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
  achievementsRevealed?: boolean;
}

export interface TapeData {
  tapeId: string;
  unlockedAt?: any;
}

export interface PlayCountData {
  tapeId: string;
  count: number;
}

export interface PlayerStats {
  totalListenTime?: number;
  screwClicks?: number;
  ejectWithoutPlay?: number;
  maxVolumeTime?: number;
  zeroVolumeTime?: number;
}

export class UserService {
  private static instance: UserService;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public subscribeToUsers(callback: (users: UserData[]) => void): () => void {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const users: UserData[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserData);
      });
      callback(users);
    });
  }

  public subscribeToUserTotalPlays(callback: (counts: Record<string, number>) => void): () => void {
    return onSnapshot(collection(db, "playEvents"), (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid) {
          counts[data.uid] = (counts[data.uid] || 0) + 1;
        }
      });
      callback(counts);
    });
  }

  public async loadUserDetails(uid: string): Promise<{
    tapes: TapeData[];
    playCounts: PlayCountData[];
    stats: PlayerStats | null;
  }> {
    const tapesSnap = await getDocs(collection(db, "users", uid, "tapes"));
    const tapes: TapeData[] = [];
    tapesSnap.forEach((d) => tapes.push({ tapeId: d.id, ...d.data() } as TapeData));

    const eventsSnap = await getDocs(query(collection(db, "playEvents"), where("uid", "==", uid)));
    const tapeCounts: Record<string, number> = {};
    eventsSnap.forEach((d) => {
      const data = d.data();
      if (data.tapeId) {
        tapeCounts[data.tapeId] = (tapeCounts[data.tapeId] || 0) + 1;
      }
    });

    const playCounts: PlayCountData[] = Object.entries(tapeCounts).map(([tapeId, count]) => ({
      tapeId,
      count,
    }));

    const statsSnap = await getDoc(doc(db, "users", uid, "stats", "main"));
    const stats = statsSnap.exists() ? (statsSnap.data() as PlayerStats) : null;

    return { tapes, playCounts, stats };
  }

  public async deleteUser(uid: string): Promise<void> {
    const tapesSnap = await getDocs(collection(db, "users", uid, "tapes"));
    await Promise.all(tapesSnap.docs.map((d) => deleteDoc(d.ref)));

    const achSnap = await getDocs(collection(db, "users", uid, "achievements"));
    await Promise.all(achSnap.docs.map((d) => deleteDoc(d.ref)));

    await deleteDoc(doc(db, "users", uid));
  }

  public async updateUserRole(uid: string, data: Partial<UserData>): Promise<void> {
    await updateDoc(doc(db, "users", uid), data);
  }

  public async removeUserTape(uid: string, tapeId: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "tapes", tapeId));
  }

  public async addUserTape(uid: string, tapeId: string): Promise<void> {
    await setDoc(doc(db, "users", uid, "tapes", tapeId), {
      tapeId,
      unlockedAt: serverTimestamp(),
    });
  }

  public async createSyntheticUser(codinome: string, rawPassword: string, role: string): Promise<string> {
    const secondaryApp = initializeApp(
      {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      },
      "secondaryApp_" + Date.now()
    );
    const secondaryAuth = getAuth(secondaryApp);

    const slug = codinome.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const email = `${slug}@runningman.local`;

    const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, email, rawPassword);

    await setDoc(doc(db, "users", newUser.uid), {
      uid: newUser.uid,
      displayName: codinome.trim(),
      username: codinome.trim(),
      email: email,
      role: role,
      createdAt: serverTimestamp(),
    });

    await secondaryAuth.signOut();
    await deleteApp(secondaryApp);

    return newUser.uid;
  }

  public async transferData(sourceUid: string, targetUid: string): Promise<{ tapes: number; achievements: number; events: number }> {
    const tapesSnap = await getDocs(collection(db, "users", sourceUid, "tapes"));
    for (const tapeDoc of tapesSnap.docs) {
      await setDoc(doc(db, "users", targetUid, "tapes", tapeDoc.id), tapeDoc.data());
      await deleteDoc(tapeDoc.ref);
    }

    const achSnap = await getDocs(collection(db, "users", sourceUid, "achievements"));
    for (const achDoc of achSnap.docs) {
      await setDoc(doc(db, "users", targetUid, "achievements", achDoc.id), achDoc.data());
      await deleteDoc(achDoc.ref);
    }

    const statsSnap = await getDoc(doc(db, "users", sourceUid, "stats", "main"));
    if (statsSnap.exists()) {
      await setDoc(doc(db, "users", targetUid, "stats", "main"), statsSnap.data(), { merge: true });
      await deleteDoc(doc(db, "users", sourceUid, "stats", "main"));
    }

    const eventsSnap = await getDocs(query(collection(db, "playEvents"), where("uid", "==", sourceUid)));
    const batch = writeBatch(db);
    eventsSnap.docs.forEach((eventDoc) => {
      batch.update(eventDoc.ref, { uid: targetUid });
    });
    await batch.commit();

    return { tapes: tapesSnap.size, achievements: achSnap.size, events: eventsSnap.size };
  }

  public async resetUserPassword(targetUid: string, newPassword: string): Promise<void> {
    const fn = httpsCallable(functions, 'adminResetPassword');
    const result = await fn({ targetUid, newPassword });
    const data = result.data as { success?: boolean };
    if (!data.success) {
      throw new Error('Falha ao alterar senha.');
    }
  }

  public async generateUserBackup(user: UserData): Promise<string> {
    const tapesSnap = await getDocs(collection(db, "users", user.uid, "tapes"));
    const tapes = tapesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const achSnap = await getDocs(collection(db, "users", user.uid, "achievements"));
    const achievements = achSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const eventsSnap = await getDocs(query(collection(db, "playEvents"), where("uid", "==", user.uid)));
    const playEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const backup = {
      exportedAt: new Date().toISOString(),
      user: {
        ...user,
        lastLogin: user.lastLogin?.toDate?.()?.toISOString?.() || null,
        createdAt: user.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      tapes,
      achievements,
      playEvents,
    };

    return JSON.stringify(backup, null, 2);
  }
}

export const userService = UserService.getInstance();
