// Firestore data access layer for player profiles.
//
// Data shape in Firestore:
//   /users/{uid}                   — PlayerMeta document
//   /users/{uid}/tapes/{tapeId}    — UnlockedTape sub-document
//   /users/{uid}/achievements/{id} — UnlockedAchievement sub-document

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlayerMeta {
  uid: string;
  username: string;
  createdAt: Timestamp | null;
}

export interface PlayerData extends PlayerMeta {
  unlockedTapeIds: string[];
  achievementIds: string[];
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Load full player data for the authenticated uid. */
export async function loadPlayerData(uid: string): Promise<PlayerData> {
  const metaSnap = await getDoc(doc(db, 'users', uid));
  const meta = metaSnap.exists()
    ? (metaSnap.data() as PlayerMeta)
    : { uid, username: uid, createdAt: null };

  const tapesSnap = await getDocs(collection(db, 'users', uid, 'tapes'));
  const achievementsSnap = await getDocs(collection(db, 'users', uid, 'achievements'));

  return {
    ...meta,
    uid,
    unlockedTapeIds: tapesSnap.docs.map((d) => d.id),
    achievementIds: achievementsSnap.docs.map((d) => d.id),
  };
}

// ── Write ────────────────────────────────────────────────────────────────────

/** Create (or overwrite) the top-level user document. */
export async function createUserDoc(uid: string, username: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
    username,
    createdAt: serverTimestamp(),
  });
}

/** Mark a tape as unlocked for this player (idempotent). */
export async function firestoreUnlockTape(uid: string, tapeId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'tapes', tapeId), {
    tapeId,
    unlockedAt: serverTimestamp(),
  });
}

/** Grant a list of achievements (idempotent). */
export async function firestoreGrantAchievements(
  uid: string,
  achievementIds: string[],
): Promise<void> {
  await Promise.all(
    achievementIds.map((id) =>
      setDoc(doc(db, 'users', uid, 'achievements', id), {
        achievementId: id,
        unlockedAt: serverTimestamp(),
      }),
    ),
  );
}
