import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { firestoreUnlockIntel } from '../store/firestore';
import { analyticsTracker } from './AnalyticsTracker';
import { activityLogger } from './ActivityLogger';

export type RepairPhase = 'idle' | 'reading' | 'corrupted' | 'repairing' | 'success' | 'fail';



class DiskRepairService {
  private diskRepairAllowed = false;
  private unsubscribe: (() => void) | null = null;
  private initialized = false;

  constructor() {}

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    try {
      this.unsubscribe = onSnapshot(doc(db, 'system', 'gameEvents'), (snap) => {
        if (snap.exists()) {
          this.diskRepairAllowed = !!snap.data().diskRepairAllowed;
        }
      }, (error) => {
        if (error.code === 'permission-denied') return;
        console.error("[DiskRepairService] Firestore error:", error);
      });
      this.initialized = true;
    } catch (err) {}
  }

  public stop() {
    if (this.unsubscribe) this.unsubscribe();
  }

  public async startAnalysis(uid: string, characterId: string, onProgress: (p: number) => void): Promise<void> {
    activityLogger.logAction('diskrepair', 'Iniciou análise de disquete');
    analyticsTracker.grantAchievement('ACH-REPAIR-APP');

    return new Promise((resolve) => {
      let p = 0;
      const interval = setInterval(() => {
        p += 15 + Math.random() * 20;
        if (p >= 100) {
          clearInterval(interval);
          analyticsTracker.grantAchievement('ACH-REPAIR-FAIL');
          firestoreUnlockIntel(uid, characterId, 'evidence-disk-01-corrupted').catch(console.error);
          resolve();
        } else {
          onProgress(p);
        }
      }, 400);
    });
  }

  public async startRepair(uid: string, characterId: string, onProgress: (p: number) => void): Promise<boolean> {
    activityLogger.logAction('diskrepair', 'Iniciou processo de reparo/desmagnetização');

    return new Promise((resolve) => {
      let p = 0;
      const interval = setInterval(() => {
        p += 5 + Math.random() * 10;
        if (p >= 100) {
          clearInterval(interval);
          const success = this.diskRepairAllowed;
          if (success) {
            analyticsTracker.grantAchievement('ACH-REPAIR-SUCCESS');
            firestoreUnlockIntel(uid, characterId, 'evidence-disk-01').catch(console.error);
          }
          resolve(success);
        } else {
          onProgress(p);
        }
      }, 300);
    });
  }


}

export const diskRepairService = new DiskRepairService();
