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
  arrayUnion,
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
  forceMacOpen?: boolean;
  hasMacAccess?: boolean;
  spotifyPlaylistUrl?: string;
}

export interface LimboGlobalState {
  seized: boolean;
  seizedBy?: string | null;
  seizedAt?: Timestamp | null;
  readThreadIds?: string[];
}

export interface GameEventsState {
  diskRepairAllowed: boolean;
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
  try {
    const metaSnap = await getDoc(doc(db, 'users', uid));
    const meta = metaSnap.exists()
      ? (metaSnap.data() as PlayerMeta)
      : { uid, username: uid, createdAt: null, achievementsRevealed: false, forceTerminalOpen: false, hasTerminalAccess: false, forceMacOpen: false, hasMacAccess: false };

    const [tapesSnap, achievementsSnap, statsSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'tapes')),
      getDocs(collection(db, 'users', uid, 'achievements')),
      getDoc(doc(db, 'users', uid, 'stats', 'main'))
    ]);

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
  } catch (error) {
    console.error(`[Firestore] Failed to load player data for ${uid}:`, error);
    throw error; // Re-throw so the caller (Player.tsx) can handle it
  }
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

export async function setMacStateForUsers(uids: string[], forceMacOpen: boolean, grantAccess: boolean): Promise<void> {
  await Promise.all(
    uids.map(uid =>
      setDoc(doc(db, 'users', uid), {
        forceMacOpen,
        hasMacAccess: grantAccess
      }, { merge: true })
    )
  );
}

export async function checkMacClosed(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceMacOpen: false }, { merge: true });
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
    seizedAt: null,
    readThreadIds: []
  }, { merge: true });
}

/** Marca um tópico como lido globalmente e ativa o bloqueio se todos forem lidos. */
export async function firestoreMarkThreadReadGlobal(threadId: string): Promise<void> {
  const TOTAL_THREADS = 11; 
  const docRef = doc(db, 'system', 'limboState');

  // Adiciona o tópico à lista global (sem duplicatas via arrayUnion)
  await setDoc(docRef, {
    readThreadIds: arrayUnion(threadId)
  }, { merge: true });

  // Verifica se o limite foi atingido para disparar o bloqueio automático
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data() as LimboGlobalState;
    const currentReads = data.readThreadIds || [];
    if (currentReads.length >= TOTAL_THREADS && !data.seized) {
      await setDoc(docRef, {
        seized: true,
        seizedBy: 'system_auto',
        seizedAt: serverTimestamp(),
      }, { merge: true });
    }
  }
}

/** Liga ou desliga o bloqueio USArmy global (LIMBO_01) para todos os jogadores — painel admin. */
export async function setLimboMilitarySeizureGlobal(active: boolean): Promise<void> {
  if (!active) {
    await resetLimboSeized();
    return;
  }
  await setDoc(
    doc(db, 'system', 'limboState'),
    {
      seized: true,
      seizedBy: 'admin',
      seizedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchGameEventsState(): Promise<GameEventsState> {
  const snap = await getDoc(doc(db, 'system', 'gameEvents'));
  return snap.exists() ? (snap.data() as GameEventsState) : { diskRepairAllowed: false };
}

export async function setDiskRepairAllowed(allowed: boolean): Promise<void> {
  await setDoc(doc(db, 'system', 'gameEvents'), {
    diskRepairAllowed: allowed
  }, { merge: true });
}

// ── Spotify Integration ──────────────────────────────────────────────────────

export async function firestoreUpdateSpotifyPlaylist(uid: string, url: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { spotifyPlaylistUrl: url }, { merge: true });
}

// ── Remote Audios ────────────────────────────────────────────────────────────

/** Fetch an uploaded audio from the 'audios' collection and map it to a Tape.
 *  All tape fields MUST come exclusively from the audio file's ID3 metadata
 *  that was parsed at upload time — no placeholders or non-metadata fallbacks. */
export async function fetchAudioTapeById(audioId: string): Promise<Tape | null> {
  const snap = await getDoc(doc(db, 'audios', audioId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title ?? '',
    artist: data.artist ?? '',
    npc: data.npc ?? data.artist ?? '',
    chapter: data.chapter ?? '',
    description: data.description ?? '',
    audioUrl: data.url,
    duration: data.duration ?? 0,
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

// ── QR Redirection ───────────────────────────────────────────────────────────

export async function fetchQrRedirect(sourceId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'system', 'qrRedirects', sourceId));
  if (snap.exists()) {
    return snap.data().targetId || null;
  }
  return null;
}

export async function saveQrRedirect(sourceId: string, targetId: string, reason?: string): Promise<void> {
  await setDoc(doc(db, 'system', 'qrRedirects', sourceId), {
    targetId,
    updatedAt: serverTimestamp(),
    reason: reason || ''
  });
}

export async function deleteQrRedirect(sourceId: string): Promise<void> {
  await deleteDoc(doc(db, 'system', 'qrRedirects', sourceId));
}

export async function fetchAllQrRedirects(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'system', 'qrRedirects'));
  return snap.docs.map(d => ({ sourceId: d.id, ...d.data() }));
}
