// Firestore data access layer for player profiles.
//
// Data shape in Firestore:
//   /users/{uid}                   — PlayerMeta document
//   /users/{uid}/tapes/{tapeId}    — UnlockedTape sub-document
//   /users/{uid}/achievements/{id} — UnlockedAchievement sub-document
//   /playEvents/{autoId}           — Play event log

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tape, resolveTapes } from '../data/tapes';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlayerMeta {
  uid: string;
  username: string;
  createdAt: Timestamp | null;
}

export interface PlayerStats {
  totalListenTime: number; // in seconds
  screwClicks: number;
  ejectWithoutPlay: number;
  maxVolumeTime: number; // in seconds
  zeroVolumeTime: number; // in seconds
}

export interface PlayerData extends PlayerMeta {
  unlockedTapeIds: string[];
  achievementIds: string[];
  stats: PlayerStats;
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
  const statsSnap = await getDoc(doc(db, 'users', uid, 'stats', 'main'));

  const defaultStats: PlayerStats = {
    totalListenTime: 0,
    screwClicks: 0,
    ejectWithoutPlay: 0,
    maxVolumeTime: 0,
    zeroVolumeTime: 0,
  };
  const stats = statsSnap.exists() ? { ...defaultStats, ...(statsSnap.data() as Partial<PlayerStats>) } : defaultStats;

  return {
    ...meta,
    uid,
    unlockedTapeIds: tapesSnap.docs.map((d) => d.id),
    achievementIds: achievementsSnap.docs.map((d) => d.id),
    stats,
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

/** Record a play event (for achievements / analytics tracking). Returns the event ID. */
export async function recordPlayEvent(
  uid: string,
  tapeId: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'playEvents'), {
    uid,
    tapeId,
    playedAt: serverTimestamp(),
    completed: false, // Default to not completed
  });
  return docRef.id;
}

/** Mark a play event as completed. */
export async function markPlayEventCompleted(eventId: string): Promise<void> {
  await setDoc(doc(db, 'playEvents', eventId), {
    completed: true,
  }, { merge: true });
}

/** Partially update player stats in Firestore. */
export async function firestoreUpdateStats(uid: string, statsDelta: Partial<PlayerStats>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'stats', 'main'), statsDelta, { merge: true });
}

// ── Remote Audios ────────────────────────────────────────────────────────────

/** Fetch an uploaded audio from the 'audios' collection and map it to a Tape */
export async function fetchAudioTapeById(audioId: string): Promise<Tape | null> {
  const snap = await getDoc(doc(db, 'audios', audioId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    title: (data.originalName || 'Audio').replace(/\.[^/.]+$/, ""),
    artist: data.ownerName || 'Admin',
    npc: '',
    chapter: 'Uploads',
    description: 'Enviado via Terminal',
    audioUrl: data.url,
    duration: 0,
  } as Tape;
}

/** Resolves an array of tape IDs by checking local MASTER_TAPES first, then Firestore */
export async function resolveAllTapesAsync(ids: string[]): Promise<Tape[]> {
  const localTapes = resolveTapes(ids);
  const foundIds = localTapes.map(t => t.id);
  const missingIds = ids.filter(id => !foundIds.includes(id));
  
  if (missingIds.length === 0) return localTapes;

  const remoteTapes = await Promise.all(
    missingIds.map(id => fetchAudioTapeById(id))
  );

  return [...localTapes, ...remoteTapes.filter((t): t is Tape => t !== null)];
}
