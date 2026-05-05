import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch,
  serverTimestamp,
  deleteField,
  updateDoc,
  deleteDoc,
  query,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CharacterData } from '../types/player';

export async function migrateLegacyUser(uid: string): Promise<string | null> {
  if (!uid) return null;
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  const data = userSnap.data();
  console.log(`[Migration] Starting migration for user ${uid}...`);

  const characterId = 'legacy_default';
  const charRef = doc(db, 'users', uid, 'characters', characterId);

  // 1. Create the character document
  const fallbackCodinome = data.email?.split('@')[0] || 'Agente_Veterano';
  
  const charData: any = {
    codinome: data.codinome || fallbackCodinome,
    agentStatus: data.agentStatus || 'vivo',
    dangerLevel: data.dangerLevel || 1,
    createdAt: data.createdAt || serverTimestamp(),
  };

  if (data.profilePhotoUrl) charData.profilePhotoUrl = data.profilePhotoUrl;
  if (data.campaignId) charData.campaignId = data.campaignId;
  if (data.agentId) charData.agentId = data.agentId;
  if (data.spotifyPlaylistUrl) charData.spotifyPlaylistUrl = data.spotifyPlaylistUrl;

  // Final safety check: remove any undefined fields
  const finalCharData = Object.fromEntries(
    Object.entries(charData).filter(([_, v]) => v !== undefined)
  );

  await setDoc(charRef, finalCharData);

  // 2. Move subcollections
  const subcollections = ['tapes', 'achievements', 'gallery'];
  for (const sub of subcollections) {
    const oldCol = collection(db, 'users', uid, sub);
    const newCol = collection(db, 'users', uid, 'characters', characterId, sub);
    
    const snap = await getDocs(oldCol);
    if (!snap.empty) {
      console.log(`[Migration] Moving ${snap.size} items from ${sub}...`);
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.set(doc(newCol, d.id), d.data());
        batch.delete(d.ref);
      });
      await batch.commit();
    }
  }

  // 3. Move stats/main
  const oldStatsRef = doc(db, 'users', uid, 'stats', 'main');
  const newStatsRef = doc(db, 'users', uid, 'characters', characterId, 'stats', 'main');
  const statsSnap = await getDoc(oldStatsRef);
  if (statsSnap.exists()) {
    console.log(`[Migration] Moving stats...`);
    await setDoc(newStatsRef, statsSnap.data());
    await deleteDoc(oldStatsRef);
  }

  // 4. Cleanup root document fields
  const fieldsToCleanup: any = {
    codinome: deleteField(),
    agentStatus: deleteField(),
    dangerLevel: deleteField(),
    profilePhotoUrl: deleteField(),
    campaignId: deleteField(),
    agentId: deleteField(),
    spotifyPlaylistUrl: deleteField(),
  };

  await updateDoc(userRef, fieldsToCleanup);

  console.log(`[Migration] User ${uid} migrated successfully to character ${characterId}`);
  return characterId;
}

export async function needsMigration(uid: string): Promise<boolean> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return false;
  
  const data = userSnap.data();
  
  // Case 1: Legacy fields at root
  if (data.codinome || data.agentId || data.spotifyPlaylistUrl) {
    console.log(`[MigrationCheck] User ${uid} has legacy root fields.`);
    return true;
  }
  
  // Case 2: Stats at root
  const statsSnap = await getDoc(doc(db, 'users', uid, 'stats', 'main'));
  if (statsSnap.exists()) {
    console.log(`[MigrationCheck] User ${uid} has legacy root stats.`);
    return true;
  }
  
  // Case 3: Subcollections at root
  const [tapesSnap, achSnap, galSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'tapes'), limit(1))),
    getDocs(query(collection(db, 'users', uid, 'achievements'), limit(1))),
    getDocs(query(collection(db, 'users', uid, 'gallery'), limit(1)))
  ]);

  if (!tapesSnap.empty || !achSnap.empty || !galSnap.empty) {
    console.log(`[MigrationCheck] User ${uid} has legacy subcollections.`);
    return true;
  }

  return false;
}
