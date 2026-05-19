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

  return characterId;
}

/**
 * MIGRATION V2: UNIFIED INTEL
 * Consolidates 'tapes' and 'gallery' subcollections into a single 'intel' subcollection
 * for all characters across the database.
 */
export async function migrateToUnifiedIntel(onProgress?: (msg: string) => void): Promise<{ success: boolean; migratedCount: number }> {
  const log = (msg: string) => {
    console.log(`[MIGRATION_INTEL] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  log('Iniciando migração para Sistema Unificado de Intel...');
  let migratedCount = 0;

  try {
    // 1. Fetch all users
    const usersSnap = await getDocs(collection(db, 'users'));
    log(`Encontrados ${usersSnap.size} usuários.`);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      // 2. Fetch all characters for this user
      const charactersSnap = await getDocs(collection(db, 'users', uid, 'characters'));
      
      for (const charDoc of charactersSnap.docs) {
        const charId = charDoc.id;
        const codinome = charDoc.data().codinome || 'Unknown';
        
        log(`Processando Agente: ${codinome} (${charId})`);

        // 3. Migrate Tapes -> Intel
        const tapesSnap = await getDocs(collection(db, 'users', uid, 'characters', charId, 'tapes'));
        if (!tapesSnap.empty) {
          const batch = writeBatch(db);
          tapesSnap.forEach(d => {
            const data = d.data();
            batch.set(doc(db, 'users', uid, 'characters', charId, 'intel', d.id), {
              ...data,
              migratedFrom: 'tapes',
              type: 'AUDIO', // Explicitly marking type during migration
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit();
          log(`  - ${tapesSnap.size} fitas migradas.`);
        }

        // 4. Migrate Gallery -> Intel
        const gallerySnap = await getDocs(collection(db, 'users', uid, 'characters', charId, 'gallery'));
        if (!gallerySnap.empty) {
          const batch = writeBatch(db);
          gallerySnap.forEach(d => {
            const data = d.data();
            batch.set(doc(db, 'users', uid, 'characters', charId, 'intel', d.id), {
              ...data,
              migratedFrom: 'gallery',
              type: 'VISUAL', // Explicitly marking type during migration
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit();
          log(`  - ${gallerySnap.size} itens de galeria migrados.`);
        }

        if (!tapesSnap.empty || !gallerySnap.empty) {
          migratedCount++;
        }
      }
    }

    log(`Migração concluída com sucesso! ${migratedCount} personagens atualizados.`);
    return { success: true, migratedCount };
  } catch (error: any) {
    log(`ERRO CRÍTICO NA MIGRAÇÃO: ${error.message}`);
    return { success: false, migratedCount };
  }
}

export async function needsMigration(uid: string): Promise<boolean> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return false;
  
  const data = userSnap.data();
  
  // Case 1: Legacy fields at root
  if (data.codinome || data.agentId || data.spotifyPlaylistUrl) {
    return true;
  }
  
  // Case 2: Stats at root
  const statsSnap = await getDoc(doc(db, 'users', uid, 'stats', 'main'));
  if (statsSnap.exists()) {
    return true;
  }
  
  // Case 3: Subcollections at root
  const [tapesSnap, achSnap, galSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'tapes'), limit(1))),
    getDocs(query(collection(db, 'users', uid, 'achievements'), limit(1))),
    getDocs(query(collection(db, 'users', uid, 'gallery'), limit(1)))
  ]);

  if (!tapesSnap.empty || !achSnap.empty || !galSnap.empty) {
    return true;
  }

  return false;
}

/**
 * MIGRATION V2-B: PER-USER SILENT INTEL MIGRATION
 * Runs automatically on login. Consolidates 'tapes' and 'gallery' subcollections 
 * into a single 'intel' subcollection for all characters of a specific user.
 * Marks user doc with intelMigrated flag to prevent re-processing.
 */
export async function needsIntelMigration(uid: string): Promise<boolean> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return false;
  return !userSnap.data().intelMigrated;
}

export async function migrateUserToUnifiedIntel(uid: string): Promise<void> {
  console.log(`[MIGRATION_INTEL_V2] Iniciando migração silenciosa para uid: ${uid}`);
  
  try {
    const charactersSnap = await getDocs(collection(db, 'users', uid, 'characters'));
    
    for (const charDoc of charactersSnap.docs) {
      const charId = charDoc.id;
      
      // 1. Migrate Tapes -> Intel
      const tapesSnap = await getDocs(collection(db, 'users', uid, 'characters', charId, 'tapes'));
      if (!tapesSnap.empty) {
        const batch = writeBatch(db);
        tapesSnap.forEach(d => {
          const intelRef = doc(db, 'users', uid, 'characters', charId, 'intel', d.id);
          batch.set(intelRef, {
            ...d.data(),
            migratedFrom: 'tapes',
            type: 'AUDIO',
            updatedAt: serverTimestamp()
          }, { merge: true }); // merge to avoid overwriting if already migrated
        });
        await batch.commit();
        console.log(`[MIGRATION_INTEL_V2] ${tapesSnap.size} tapes migradas para intel (char: ${charId})`);
      }
      
      // 2. Migrate Gallery -> Intel
      const gallerySnap = await getDocs(collection(db, 'users', uid, 'characters', charId, 'gallery'));
      if (!gallerySnap.empty) {
        const batch = writeBatch(db);
        gallerySnap.forEach(d => {
          const intelRef = doc(db, 'users', uid, 'characters', charId, 'intel', d.id);
          batch.set(intelRef, {
            ...d.data(),
            migratedFrom: 'gallery',
            type: 'VISUAL',
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
        console.log(`[MIGRATION_INTEL_V2] ${gallerySnap.size} gallery items migrados para intel (char: ${charId})`);
      }
    }
    
    // 3. Mark user as migrated
    await setDoc(doc(db, 'users', uid), { 
      intelMigrated: true, 
      intelMigratedAt: serverTimestamp() 
    }, { merge: true });
    
    console.log(`[MIGRATION_INTEL_V2] Migração concluída para uid: ${uid}`);
  } catch (error: any) {
    console.error(`[MIGRATION_INTEL_V2] Erro na migração: ${error.message}`);
    // Non-blocking: don't throw, user can still use the app with legacy listeners
  }
}
