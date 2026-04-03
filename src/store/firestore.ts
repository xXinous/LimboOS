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
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tape, resolveTapes } from '../data/tapes';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlayerMeta {
  uid: string;
  username: string;
  createdAt: Timestamp | null;
  achievementsRevealed?: boolean;
  forceTerminalOpen?: boolean;
  hasTerminalAccess?: boolean;
}

export interface LimboGlobalState {
  seized: boolean;
  seizedBy?: string;
  seizedAt?: Timestamp;
}

export interface PlayerStats {
  totalListenTime: number; // in seconds
  screwClicks: number;
  fidgetClicks: number;
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
    : { uid, username: uid, createdAt: null, achievementsRevealed: false, forceTerminalOpen: false, hasTerminalAccess: false };

  const tapesSnap = await getDocs(collection(db, 'users', uid, 'tapes'));
  const achievementsSnap = await getDocs(collection(db, 'users', uid, 'achievements'));
  const statsSnap = await getDoc(doc(db, 'users', uid, 'stats', 'main'));

  const defaultStats: PlayerStats = {
    totalListenTime: 0,
    screwClicks: 0,
    fidgetClicks: 0,
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

/** Revoke an achievement. */
export async function firestoreRevokeAchievement(uid: string, achievementId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'achievements', achievementId));
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

// ── Terminal / Limbo Controls ────────────────────────────────────────────────

export async function setTerminalStateForUsers(uids: string[], forceTerminalOpen: boolean, grantAccess: boolean): Promise<void> {
  await Promise.all(
    uids.map(uid =>
      setDoc(doc(db, 'users', uid), {
        forceTerminalOpen,
        hasTerminalAccess: grantAccess
      }, { merge: true })
    )
  );
}

export async function checkTerminalClosed(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceTerminalOpen: false }, { merge: true });
}

export async function fetchLimboGlobalState(): Promise<LimboGlobalState> {
  const snap = await getDoc(doc(db, 'system', 'limboState'));
  return snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false };
}

export async function setLimboSeized(uid: string): Promise<void> {
  await setDoc(doc(db, 'system', 'limboState'), {
    seized: true,
    seizedBy: uid,
    seizedAt: serverTimestamp()
  }, { merge: true });
}

export async function resetLimboSeized(): Promise<void> {
  await setDoc(doc(db, 'system', 'limboState'), {
    seized: false,
    seizedBy: null,
    seizedAt: null
  }, { merge: true });
}

// ── Remote Audios ────────────────────────────────────────────────────────────

/** Fetch an uploaded audio from the 'audios' collection and map it to a Tape */
export async function fetchAudioTapeById(audioId: string): Promise<Tape | null> {
  const snap = await getDoc(doc(db, 'audios', audioId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title || (data.originalName || 'Audio').replace(/\.[^/.]+$/, ""),
    artist: data.artist || data.ownerName || 'Admin',
    npc: data.npc || data.artist || '',
    chapter: data.chapter || 'Uploads',
    description: data.description || 'Enviado via Terminal',
    audioUrl: data.url,
    duration: data.duration || 0,
    isSecret: Boolean(data.isSecret),
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
