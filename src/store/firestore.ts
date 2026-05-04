import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  deleteDoc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../lib/firebase';
import { Tape, resolveTapes } from '../data/tapes';
import { 
  PlayerData, 
  PlayerStats, 
  UserData, 
  LimboGlobalState, 
  GameEventsState, 
  GalleryImage, 
  GalleryCategory,
  QrRedirect
} from '../types/player';

export type { 
  PlayerData, 
  PlayerStats, 
  UserData, 
  LimboGlobalState, 
  GameEventsState, 
  GalleryImage, 
  GalleryCategory,
  QrRedirect 
};

const DEFAULT_STATS: PlayerStats = {
  totalListenTime: 0,
  screwClicks: 0,
  fidgetClicks: 0,
  ejectWithoutPlay: 0,
  maxVolumeTime: 0,
  zeroVolumeTime: 0,
};

export async function loadPlayerData(uid: string): Promise<PlayerData> {
  const metaSnap = await getDoc(doc(db, 'users', uid));
  const userData = metaSnap.exists()
    ? (metaSnap.data() as UserData)
    : { 
        uid, 
        username: uid, 
        email: '', 
        role: 'player' as const, 
        createdAt: null 
      };

  const [tapesSnap, achievementsSnap, statsSnap, gallerySnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'tapes')),
    getDocs(collection(db, 'users', uid, 'achievements')),
    getDoc(doc(db, 'users', uid, 'stats', 'main')),
    getDocs(collection(db, 'users', uid, 'gallery'))
  ]);

  const stats = statsSnap.exists() ? { ...DEFAULT_STATS, ...(statsSnap.data() as Partial<PlayerStats>) } : DEFAULT_STATS;

  return {
    ...userData,
    uid,
    unlockedTapeIds: tapesSnap.docs.map((d) => d.id),
    achievementIds: achievementsSnap.docs.map((d) => d.id),
    stats,
    unlockedGalleryIds: gallerySnap.docs.map((d) => d.id),
  } as PlayerData;
}

export async function createUserDoc(uid: string, username: string, email: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
    username,
    email,
    role: 'player',
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
  });
}

export async function updateLastLogin(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    lastLogin: serverTimestamp(),
  }, { merge: true });
}

export async function firestoreUnlockTape(uid: string, tapeId: string, campaignId?: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'tapes', tapeId), {
    tapeId,
    unlockedAt: serverTimestamp(),
    campaignId: campaignId || null
  });
}

export async function firestoreGrantAchievements(uid: string, achievementIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  achievementIds.forEach((id) => {
    batch.set(doc(db, 'users', uid, 'achievements', id), {
      achievementId: id,
      unlockedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function firestoreRevokeAchievement(uid: string, achievementId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'achievements', achievementId));
}

export async function recordPlayEvent(uid: string, tapeId: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'playEvents'), {
    uid,
    tapeId,
    playedAt: serverTimestamp(),
    completed: false,
  });
  return docRef.id;
}

export async function markPlayEventCompleted(eventId: string): Promise<void> {
  await setDoc(doc(db, 'playEvents', eventId), { completed: true }, { merge: true });
}

export async function firestoreUpdateStats(uid: string, statsDelta: Partial<PlayerStats>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'stats', 'main'), statsDelta, { merge: true });
}

export async function setTerminalStateForUsers(uids: string[], forceTerminalOpen: boolean, grantAccess: boolean): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach(uid => {
    batch.set(doc(db, 'users', uid), { forceTerminalOpen, hasTerminalAccess: grantAccess }, { merge: true });
  });
  await batch.commit();
}

export async function checkTerminalClosed(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceTerminalOpen: false }, { merge: true });
}

export async function setMacStateForUsers(uids: string[], forceMacOpen: boolean, grantAccess: boolean): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach(uid => {
    batch.set(doc(db, 'users', uid), { forceMacOpen, hasMacAccess: grantAccess }, { merge: true });
  });
  await batch.commit();
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

export async function firestoreMarkThreadReadGlobal(threadId: string): Promise<void> {
  const TOTAL_THREADS = 11;
  const docRef = doc(db, 'system', 'limboState');
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const data = snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false, readThreadIds: [] };
    const readThreadIds = data.readThreadIds || [];
    if (!readThreadIds.includes(threadId)) {
      readThreadIds.push(threadId);
    }
    const updatePayload: Record<string, any> = { readThreadIds };
    if (readThreadIds.length >= TOTAL_THREADS && !data.seized) {
      updatePayload.seized = true;
      updatePayload.seizedBy = 'system_auto';
      updatePayload.seizedAt = serverTimestamp();
    }
    transaction.set(docRef, updatePayload, { merge: true });
  });
}

export async function setLimboMilitarySeizureGlobal(active: boolean): Promise<void> {
  if (!active) {
    await resetLimboSeized();
    return;
  }
  await setDoc(doc(db, 'system', 'limboState'), {
    seized: true,
    seizedBy: 'admin',
    seizedAt: serverTimestamp(),
  }, { merge: true });
}

export async function fetchGameEventsState(): Promise<GameEventsState> {
  const snap = await getDoc(doc(db, 'system', 'gameEvents'));
  return snap.exists() ? (snap.data() as GameEventsState) : { diskRepairAllowed: false };
}

export async function setDiskRepairAllowed(allowed: boolean): Promise<void> {
  await setDoc(doc(db, 'system', 'gameEvents'), { diskRepairAllowed: allowed }, { merge: true });
}

export async function firestoreUpdateSpotifyPlaylist(uid: string, url: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { spotifyPlaylistUrl: url }, { merge: true });
}

export async function firestoreSetCampaign(uid: string, campaignId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { campaignId }, { merge: true });
}

export async function generateAgentId(uid: string): Promise<string> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().agentId) {
    return snap.data().agentId;
  }
  // Generate a unique 6-char hex code (agent-style)
  const agentId = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  await setDoc(userRef, { agentId }, { merge: true });
  return agentId;
}

export async function updateAgentStatus(uid: string, status: 'vivo' | 'morto' | 'desaparecido'): Promise<void> {
  await setDoc(doc(db, 'users', uid), { agentStatus: status }, { merge: true });
}

export async function updateDangerLevel(uid: string, level: number): Promise<void> {
  await setDoc(doc(db, 'users', uid), { dangerLevel: Math.max(1, Math.min(5, level)) }, { merge: true });
}

export async function updateUsername(uid: string, newUsername: string): Promise<void> {
  const trimmed = newUsername.trim();
  if (!trimmed) return;
  await setDoc(doc(db, 'users', uid), { username: trimmed, displayName: trimmed }, { merge: true });
}

export interface ProfilePhoto {
  id: string;
  url: string;
  uploadedAt: any;
}

const MAX_PROFILE_PHOTOS = 3;

export async function uploadProfilePhoto(uid: string, file: File): Promise<ProfilePhoto> {
  const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `profilePhotos/${uid}/${photoId}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await setDoc(doc(db, 'users', uid, 'profilePhotos', photoId), {
    url,
    uploadedAt: serverTimestamp(),
  });

  // Set as active photo
  await setDoc(doc(db, 'users', uid), { profilePhotoUrl: url }, { merge: true });

  // Enforce 3-photo limit: delete oldest if over limit
  const photosSnap = await getDocs(collection(db, 'users', uid, 'profilePhotos'));
  const allPhotos = photosSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as ProfilePhoto))
    .sort((a, b) => {
      const ta = a.uploadedAt?.toMillis?.() || 0;
      const tb = b.uploadedAt?.toMillis?.() || 0;
      return ta - tb; // oldest first
    });

  if (allPhotos.length > MAX_PROFILE_PHOTOS) {
    const toDelete = allPhotos.slice(0, allPhotos.length - MAX_PROFILE_PHOTOS);
    for (const photo of toDelete) {
      try {
        const oldRef = ref(storage, `profilePhotos/${uid}/${photo.id}`);
        await deleteObject(oldRef);
      } catch (_) {}
      await deleteDoc(doc(db, 'users', uid, 'profilePhotos', photo.id));
    }
  }

  return { id: photoId, url, uploadedAt: null };
}

export async function fetchProfilePhotos(uid: string): Promise<ProfilePhoto[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'profilePhotos'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ProfilePhoto))
    .sort((a, b) => {
      const ta = a.uploadedAt?.toMillis?.() || 0;
      const tb = b.uploadedAt?.toMillis?.() || 0;
      return tb - ta; // newest first
    });
}

export async function setActiveProfilePhoto(uid: string, url: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { profilePhotoUrl: url }, { merge: true });
}

export async function removeProfilePhoto(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { profilePhotoUrl: '' }, { merge: true });
}

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

export async function resolveAllTapesAsync(ids: string[]): Promise<Tape[]> {
  const localTapes = resolveTapes(ids);
  const foundIds = localTapes.map(t => t.id);
  const missingIds = ids.filter(id => !foundIds.includes(id));
  if (missingIds.length === 0) return localTapes;
  const remoteTapes = await Promise.all(missingIds.map(id => fetchAudioTapeById(id)));
  return [...localTapes, ...remoteTapes.filter((t): t is Tape => t !== null)];
}

export async function fetchQrRedirect(sourceId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'qrRedirects', sourceId));
  return snap.exists() ? snap.data().targetId || null : null;
}

export async function saveQrRedirect(sourceId: string, targetId: string, reason?: string): Promise<void> {
  await setDoc(doc(db, 'qrRedirects', sourceId), {
    targetId,
    updatedAt: serverTimestamp(),
    reason: reason || ''
  });
}

export async function deleteQrRedirect(sourceId: string): Promise<void> {
  await deleteDoc(doc(db, 'qrRedirects', sourceId));
}

export async function fetchAllQrRedirects(): Promise<QrRedirect[]> {
  const snap = await getDocs(collection(db, 'qrRedirects'));
  return snap.docs.map(d => ({ sourceId: d.id, ...d.data() } as QrRedirect));
}

export async function uploadGalleryImage(
  file: File,
  category: GalleryCategory,
  title: string,
  description: string,
  createdBy: string
): Promise<GalleryImage> {
  const imageId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `gallery/${imageId}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);
  const data = {
    category,
    title,
    description,
    imageUrl,
    createdAt: serverTimestamp(),
    createdBy,
  };
  await setDoc(doc(db, 'gallery', imageId), data);
  return { id: imageId, ...data, imageUrl } as GalleryImage;
}

export async function deleteGalleryImage(imageId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `gallery/${imageId}`);
    await deleteObject(storageRef);
  } catch (_) {}
  const usersSnap = await getDocs(collection(db, 'users'));
  const batch = writeBatch(db);
  for (const userDoc of usersSnap.docs) {
    batch.delete(doc(db, 'users', userDoc.id, 'gallery', imageId));
  }
  batch.delete(doc(db, 'gallery', imageId));
  await batch.commit();
}

export async function fetchAllGalleryImages(): Promise<GalleryImage[]> {
  const snap = await getDocs(collection(db, 'gallery'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryImage));
}

export async function grantGalleryImage(uid: string, imageId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'gallery', imageId), {
    imageId,
    unlockedAt: serverTimestamp(),
  });
}

export async function revokeGalleryImage(uid: string, imageId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'gallery', imageId));
}

export async function grantGalleryImageToMultiple(uids: string[], imageId: string): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach(uid => {
    batch.set(doc(db, 'users', uid, 'gallery', imageId), {
      imageId,
      unlockedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function fetchPlayerGalleryImages(uid: string): Promise<GalleryImage[]> {
  const grantSnap = await getDocs(collection(db, 'users', uid, 'gallery'));
  const imageIds = grantSnap.docs.map(d => d.id);
  if (imageIds.length === 0) return [];
  const images: GalleryImage[] = [];
  for (const id of imageIds) {
    const imgSnap = await getDoc(doc(db, 'gallery', id));
    if (imgSnap.exists()) {
      images.push({ id: imgSnap.id, ...imgSnap.data() } as GalleryImage);
    }
  }
  return images;
}

export async function fetchUserGalleryGrants(imageId: string): Promise<string[]> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const grantedUids: string[] = [];
  for (const userDoc of usersSnap.docs) {
    const grantSnap = await getDoc(doc(db, 'users', userDoc.id, 'gallery', imageId));
    if (grantSnap.exists()) grantedUids.push(userDoc.id);
  }
  return grantedUids;
}
