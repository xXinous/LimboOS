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
  query,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../lib/firebase';
import { 
  PlayerData, 
  PlayerStats, 
  MasterAccount,
  CharacterData,
  LimboGlobalState, 
  GalleryImage, 
  GalleryCategory,
  QrRedirect
} from '../types/player';
import type { IntelItem } from '../types/intel';

const DEFAULT_STATS: PlayerStats = {
  totalListenTime: 0,
  screwClicks: 0,
  fidgetClicks: 0,
  ejectWithoutPlay: 0,
  maxVolumeTime: 0,
  zeroVolumeTime: 0,
};

// --- Admin Types ---
export interface PlayerMeta extends MasterAccount {
  username?: string;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
}

// --- Account Management ---

export async function loadMasterAccount(uid: string): Promise<MasterAccount> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    throw new Error('Account not found');
  }
  return snap.data() as MasterAccount;
}

export async function createUserDoc(uid: string, email: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
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

// --- Character Management ---

export async function fetchCharacters(uid: string): Promise<CharacterData[]> {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'users', uid, 'characters'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CharacterData));
}

export async function createCharacter(uid: string, codinome: string): Promise<CharacterData> {
  if (!uid) throw new Error('Cannot create character without UID');
  const charId = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const charData: Omit<CharacterData, 'id'> = {
    codinome,
    agentStatus: 'vivo',
    dangerLevel: 1,
    createdAt: serverTimestamp() as any,
  };
  await setDoc(doc(db, 'users', uid, 'characters', charId), charData);
  return { id: charId, ...charData } as CharacterData;
}

export async function loadPlayerData(uid: string, characterId: string): Promise<PlayerData> {
  if (!uid || !characterId) throw new Error('LoadPlayerData failed: Missing identifiers');
  
  const [accountSnap, charSnap, tapesSnap, achievementsSnap, statsSnap, gallerySnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'users', uid, 'characters', characterId)),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'tapes')),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'achievements')),
    getDoc(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main')),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'gallery'))
  ]);

  if (!accountSnap.exists() || !charSnap.exists()) {
    throw new Error('Data integrity failure: Account or Character missing');
  }

  const account = accountSnap.data() as MasterAccount;
  const character = { id: characterId, ...charSnap.data() } as CharacterData;
  const stats = statsSnap.exists() ? { ...DEFAULT_STATS, ...(statsSnap.data() as Partial<PlayerStats>) } : DEFAULT_STATS;

  return {
    ...account,
    activeCharacterId: characterId,
    character,
    unlockedTapeIds: tapesSnap.docs.map((d) => d.id),
    achievementIds: achievementsSnap.docs.map((d) => d.id),
    stats,
    unlockedGalleryIds: gallerySnap.docs.map((d) => d.id),
  };
}

// --- Character Progress ---

export async function firestoreUnlockTape(uid: string, characterId: string, tapeId: string, campaignId?: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId, 'tapes', tapeId), {
    tapeId,
    unlockedAt: serverTimestamp(),
    campaignId: campaignId || null
  });
}

export async function firestoreGrantAchievements(uid: string, characterId: string, achievementIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  achievementIds.forEach((id) => {
    batch.set(doc(db, 'users', uid, 'characters', characterId, 'achievements', id), {
      achievementId: id,
      unlockedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function firestoreUpdateStats(uid: string, characterId: string, statsDelta: Partial<PlayerStats>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main'), statsDelta, { merge: true });
}

export async function firestoreUpdateSpotifyPlaylist(uid: string, characterId: string, url: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { spotifyPlaylistUrl: url }, { merge: true });
}

export async function firestoreSetCampaign(uid: string, characterId: string, campaignId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { campaignId }, { merge: true });
}

export async function updateAgentStatus(uid: string, characterId: string, status: 'vivo' | 'morto' | 'desaparecido'): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { agentStatus: status }, { merge: true });
}

export async function updateDangerLevel(uid: string, characterId: string, level: number): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { dangerLevel: Math.max(1, Math.min(5, level)) }, { merge: true });
}

export async function updateCodinome(uid: string, characterId: string, newCodinome: string): Promise<void> {
  const trimmed = newCodinome.trim();
  if (!trimmed) return;
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { codinome: trimmed }, { merge: true });
}

// --- Profile Photos ---

export async function uploadProfilePhoto(uid: string, characterId: string, file: File): Promise<{ url: string }> {
  const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `profilePhotos/${uid}/${characterId}/${photoId}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { profilePhotoUrl: url }, { merge: true });
  return { url };
}

// --- Global/Admin System State ---

export async function setTerminalStateForUsers(uids: string[], force: boolean, grant: boolean): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach((uid) => {
    batch.set(doc(db, 'users', uid), { 
      forceTerminalOpen: force,
      hasTerminalAccess: grant 
    }, { merge: true });
  });
  await batch.commit();
}

export async function setMacStateForUsers(uids: string[], force: boolean, grant: boolean): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach((uid) => {
    batch.set(doc(db, 'users', uid), { 
      forceMacOpen: force, 
      hasMacAccess: grant 
    }, { merge: true });
  });
  await batch.commit();
}

export async function checkTerminalClosed(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceTerminalOpen: false }, { merge: true });
}

export async function checkMacClosed(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceMacOpen: false }, { merge: true });
}

export async function setLimboMilitarySeizureGlobal(seized: boolean): Promise<void> {
  await setDoc(doc(db, 'system', 'limboState'), { 
    seized,
    seizedAt: seized ? serverTimestamp() : null
  }, { merge: true });
}

export async function fetchLimboGlobalState(): Promise<LimboGlobalState> {
  const snap = await getDoc(doc(db, 'system', 'limboState'));
  return snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false };
}

export async function firestoreMarkThreadReadGlobal(threadId: string): Promise<void> {
  const limboRef = doc(db, 'system', 'limboState');
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(limboRef);
    const data = snap.exists() ? snap.data() : { seized: false, readThreadIds: [] };
    const readThreadIds = data.readThreadIds || [];
    if (!readThreadIds.includes(threadId)) {
      transaction.set(limboRef, { readThreadIds: [...readThreadIds, threadId] }, { merge: true });
    }
  });
}

// --- Legacy & Shared Utils ---

export async function recordPlayEvent(uid: string, characterId: string, tapeId: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'playEvents'), {
    uid,
    characterId,
    tapeId,
    playedAt: serverTimestamp(),
    completed: false,
  });
  return docRef.id;
}

export async function markPlayEventCompleted(eventId: string): Promise<void> {
  await setDoc(doc(db, 'playEvents', eventId), { completed: true }, { merge: true });
}

export async function generateAgentId(uid: string, characterId: string): Promise<string> {
  const charRef = doc(db, 'users', uid, 'characters', characterId);
  const snap = await getDoc(charRef);
  if (snap.exists() && snap.data().agentId) return snap.data().agentId;
  const agentId = Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  await setDoc(charRef, { agentId }, { merge: true });
  return agentId;
}

export async function fetchAudioTapeById(audioId: string) {
  const snap = await getDoc(doc(db, 'audios', audioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAllAudios() {
  const snap = await getDocs(collection(db, 'audios'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchAllGalleryImages(): Promise<GalleryImage[]> {
  const snap = await getDocs(collection(db, 'gallery'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryImage));
}

/**
 * Persiste alterações de um IntelItem de volta para o Firebase.
 */
export async function updateRemoteIntel(item: IntelItem): Promise<void> {
  const collectionName = item.type === 'AUDIO' ? 'audios' : item.type === 'VISUAL' ? 'gallery' : null;
  if (!collectionName) return;

  const docRef = doc(db, collectionName, item.id);
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) return;

  const updateData: any = {
    level: item.level,
    title: item.title,
    description: item.description,
  };

  if (item.type === 'AUDIO' && item.metadata) {
    if (item.metadata.artist) updateData.artist = item.metadata.artist;
    if (item.metadata.npc) updateData.npc = item.metadata.npc;
    if (item.metadata.chapter) updateData.chapter = item.metadata.chapter;
    if (item.metadata.duration) updateData.duration = item.metadata.duration;
    if (item.metadata.isSecret !== undefined) updateData.isSecret = item.metadata.isSecret;
    if (item.mediaUrl) updateData.url = item.mediaUrl;
  }

  if (item.type === 'VISUAL' && item.metadata) {
    if (item.metadata.visualCategory) updateData.category = item.metadata.visualCategory;
    if (item.metadata.npc) updateData.npc = item.metadata.npc;
    if (item.metadata.chapter) updateData.chapter = item.metadata.chapter;
    if (item.mediaUrl) updateData.imageUrl = item.mediaUrl;
  }

  await setDoc(docRef, updateData, { merge: true });
}

export async function fetchQrRedirect(sourceId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'qrRedirects', sourceId));
  return snap.exists() ? snap.data().targetId || null : null;
}

export async function fetchAllQrRedirects(): Promise<QrRedirect[]> {
  const snap = await getDocs(collection(db, 'qrRedirects'));
  return snap.docs.map(d => ({ sourceId: d.id, ...d.data() } as QrRedirect));
}

export async function saveQrRedirect(sourceId: string, targetId: string, reason?: string): Promise<void> {
  await setDoc(doc(db, 'qrRedirects', sourceId), {
    targetId,
    reason: reason || '',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQrRedirect(sourceId: string): Promise<void> {
  await deleteDoc(doc(db, 'qrRedirects', sourceId));
}

export async function fetchPlayerGalleryImages(uid: string, characterId: string): Promise<GalleryImage[]> {
  const grantSnap = await getDocs(collection(db, 'users', uid, 'characters', characterId, 'gallery'));
  const imageIds = grantSnap.docs.map(d => d.id);
  if (imageIds.length === 0) return [];
  const images: GalleryImage[] = [];
  for (const id of imageIds) {
    const imgSnap = await getDoc(doc(db, 'gallery', id));
    if (imgSnap.exists()) images.push({ id: imgSnap.id, ...imgSnap.data() } as GalleryImage);
  }
  return images;
}

export async function grantGalleryImage(uid: string, characterIdOrImageId: string, imageId?: string): Promise<void> {
  if (imageId) {
    // Character-scoped grant: grantGalleryImage(uid, characterId, imageId)
    await setDoc(doc(db, 'users', uid, 'characters', characterIdOrImageId, 'gallery', imageId), { imageId, unlockedAt: serverTimestamp() });
  } else {
    // Admin global grant: grantGalleryImage(uid, imageId) — stores in galleryGrants collection
    await setDoc(doc(db, 'galleryGrants', `${uid}_${characterIdOrImageId}`), {
      uid,
      imageId: characterIdOrImageId,
      grantedAt: serverTimestamp(),
    });
  }
}

// --- Admin Gallery Functions ---

export async function uploadGalleryImage(
  file: File,
  category: GalleryCategory,
  title: string,
  description: string,
  createdBy: string,
  level: number
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
    level,
    createdAt: serverTimestamp(),
    createdBy,
  };
  await setDoc(doc(db, 'gallery', imageId), data);
  return { id: imageId, ...data } as unknown as GalleryImage;
}

export async function updateGalleryImage(imageId: string, updates: Partial<GalleryImage>): Promise<void> {
  await setDoc(doc(db, 'gallery', imageId), updates, { merge: true });
}

export async function deleteGalleryImage(imageId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `gallery/${imageId}`);
    await deleteObject(storageRef);
  } catch {
    // File may not exist in storage, continue with doc deletion
  }
  await deleteDoc(doc(db, 'gallery', imageId));
}

export async function revokeGalleryImage(uid: string, imageId: string): Promise<void> {
  await deleteDoc(doc(db, 'galleryGrants', `${uid}_${imageId}`));
}

export async function grantGalleryImageToMultiple(uids: string[], imageId: string): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach(uid => {
    batch.set(doc(db, 'galleryGrants', `${uid}_${imageId}`), {
      uid,
      imageId,
      grantedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function fetchUserGalleryGrants(imageId: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'galleryGrants'));
  return snap.docs
    .filter(d => d.data().imageId === imageId)
    .map(d => d.data().uid as string);
}

// Re-export types used by admin panels
export type { GalleryImage, GalleryCategory, LimboGlobalState } from '../types/player';

