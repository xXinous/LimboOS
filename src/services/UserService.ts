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
import { MasterAccount, CharacterData, PlayerStats } from "../types/player";

export interface PlayCountData {
  tapeId: string;
  count: number;
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

  public subscribeToUsers(callback: (users: MasterAccount[]) => void): () => void {
    return onSnapshot(collection(db, "users"), 
      (snapshot) => {
        const users: MasterAccount[] = [];
        snapshot.forEach((doc) => {
          users.push({ uid: doc.id, ...doc.data() } as MasterAccount);
        });
        callback(users);
      },
      (err) => console.warn('[UserService] users listener error:', err)
    );
  }

  public async fetchCharactersForUser(uid: string): Promise<CharacterData[]> {
    if (!uid) return [];
    const snap = await getDocs(collection(db, "users", uid, "characters"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CharacterData));
  }

  public subscribeToUserTotalPlays(callback: (counts: Record<string, number>) => void): () => void {
    return onSnapshot(collection(db, "playEvents"), 
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.uid) {
            counts[data.uid] = (counts[data.uid] || 0) + 1;
          }
        });
        callback(counts);
      },
      (err) => console.warn('[UserService] playEvents listener error:', err)
    );
  }

  public async loadUserDetails(uid: string, characterId: string): Promise<{
    tapes: { id: string; unlockedAt: any }[];
    playCounts: PlayCountData[];
    stats: PlayerStats | null;
    achievements: string[];
  }> {
    try {
      const [tapesSnap, eventsSnap, statsSnap, achSnap] = await Promise.all([
        getDocs(collection(db, "users", uid, "characters", characterId, "tapes")),
        getDocs(query(collection(db, "playEvents"), where("uid", "==", uid), where("characterId", "==", characterId))),
        getDoc(doc(db, "users", uid, "characters", characterId, "stats", "main")),
        getDocs(collection(db, "users", uid, "characters", characterId, "achievements"))
      ]);

      const tapes = tapesSnap.docs.map(d => ({ 
        id: d.id, 
        unlockedAt: d.data().unlockedAt 
      }));

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

      const stats = statsSnap.exists() ? (statsSnap.data() as PlayerStats) : null;
      const achievements = achSnap.docs.map(d => d.id);

      return { tapes, playCounts, stats, achievements };
    } catch (error) {
      console.error('[UserService] Error loading user details:', error);
      return { tapes: [], playCounts: [], stats: null, achievements: [] };
    }
  }

  public async deleteUser(uid: string): Promise<void> {
    // Delete master account document
    await deleteDoc(doc(db, "users", uid));
    // Note: Recursive delete for sub-collections might be needed via Cloud Function for production
  }

  public async updateMasterAccount(uid: string, data: Partial<MasterAccount>): Promise<void> {
    await updateDoc(doc(db, "users", uid), data as any);
  }

  public async updateCharacter(uid: string, characterId: string, data: Partial<CharacterData>): Promise<void> {
    await updateDoc(doc(db, "users", uid, "characters", characterId), data as any);
  }

  public async deleteCharacter(uid: string, characterId: string): Promise<void> {
    const tapesSnap = await getDocs(collection(db, "users", uid, "characters", characterId, "tapes"));
    await Promise.all(tapesSnap.docs.map((d) => deleteDoc(d.ref)));
    const achSnap = await getDocs(collection(db, "users", uid, "characters", characterId, "achievements"));
    await Promise.all(achSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "users", uid, "characters", characterId));
  }

  public async updateUserRole(uid: string, role: 'player' | 'admin'): Promise<void> {
    await updateDoc(doc(db, "users", uid), { role });
  }

  public async removeUserIntel(uid: string, characterId: string, intelId: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "characters", characterId, "tapes", intelId));
  }

  public async addUserIntel(uid: string, characterId: string, intelId: string): Promise<void> {
    await setDoc(doc(db, "users", uid, "characters", characterId, "tapes", intelId), {
      tapeId: intelId,
      unlockedAt: serverTimestamp(),
    });
  }

  public async createSyntheticUser(masterId: string, rawPassword: string, role: 'player' | 'admin'): Promise<{ uid: string; characterId: string }> {
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
    const slug = masterId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const email = `${slug}@runningman.local`;

    const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, email, rawPassword);
    
    // Create Master Account
    await setDoc(doc(db, "users", newUser.uid), {
      uid: newUser.uid,
      email: email,
      role: role,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });

    // Create Initial Character
    const charId = `initial_${Date.now()}`;
    await setDoc(doc(db, "users", newUser.uid, "characters", charId), {
      codinome: masterId.trim(),
      agentStatus: 'vivo',
      dangerLevel: 1,
      createdAt: serverTimestamp(),
    });

    await secondaryAuth.signOut();
    await deleteApp(secondaryApp);
    return { uid: newUser.uid, characterId: charId };
  }

  public async resetUserPassword(targetUid: string, newPassword: string): Promise<void> {
    const fn = httpsCallable(functions, 'adminResetPassword');
    const result = await fn({ targetUid, newPassword });
    const data = result.data as { success?: boolean };
    if (!data.success) throw new Error('Falha ao alterar senha.');
  }

  public async generateUserBackup(account: MasterAccount, character: CharacterData): Promise<string> {
    const details = await this.loadUserDetails(account.uid, character.id);
    
    const achSnap = await getDocs(collection(db, "users", account.uid, "characters", character.id, "achievements"));
    const achievements = achSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const backup = {
      exportedAt: new Date().toISOString(),
      account: {
        ...account,
        lastLogin: account.lastLogin?.toDate?.()?.toISOString?.() || null,
        createdAt: account.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      character: {
        ...character,
        createdAt: character.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      tapes: details.tapes,
      achievements,
      playEvents: details.playCounts,
      stats: details.stats
    };

    return JSON.stringify(backup, null, 2);
  }
}

export const userService = UserService.getInstance();
