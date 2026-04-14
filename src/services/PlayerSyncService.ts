import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { analyticsTracker } from './AnalyticsTracker';
import { activityLogger } from './ActivityLogger';
import type { PlayerData, LimboGlobalState } from '../store/firestore';
import type { AppScreen } from '../types/player';
export class PlayerSyncService {
  private static instance: PlayerSyncService;
  private unsubs: (() => void)[] = [];
  private constructor() {}
  public static getInstance(): PlayerSyncService {
    if (!PlayerSyncService.instance) {
      PlayerSyncService.instance = new PlayerSyncService();
    }
    return PlayerSyncService.instance;
  }
  public subscribeToPlayerData(
    uid: string | undefined,
    onPlayerDataUpdate: (data: Partial<PlayerData>) => void,
    onScreenChange: (screenSetter: (prev: AppScreen) => AppScreen) => void,
    onLimboUpdate: (limboStatus: LimboGlobalState) => void
  ) {
    this.stopAll();
    if (!uid) return;
    const unsubTapes = onSnapshot(collection(db, 'users', uid, 'tapes'), 
      (snapshot) => {
        const tapeIds = snapshot.docs.map((d) => d.id).sort();
        onPlayerDataUpdate({ unlockedTapeIds: tapeIds });
      },
      (error) => {
        console.warn('[PlayerSyncService] Tapes listener error:', error);
      }
    );
    const unsubUser = onSnapshot(doc(db, 'users', uid), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.forceTerminalOpen) {
            onScreenChange((prev) => {
              if (prev !== 'bios' && prev !== 'limbo' && prev !== 'diskRepair') {
                activityLogger.logSystem(uid, data.username || uid, 'sync', 'Terminal forçado pelo servidor', { triggeredBy: 'forceTerminalOpen' });
                return 'bios';
              }
              return prev;
            });
          } else if (data.forceMacOpen) {
            onScreenChange((prev) => {
              if (prev !== 'macos') {
                activityLogger.logSystem(uid, data.username || uid, 'sync', 'MacOS forçado pelo servidor', { triggeredBy: 'forceMacOpen' });
                return 'macos';
              }
              return prev;
            });
          } else {
            onScreenChange((prev) => {
              if (['bios', 'limbo', 'diskRepair', 'macos'].includes(prev)) {
                 activityLogger.logSystem(uid, data.username || uid, 'sync', 'Acesso remoto encerrado pelo servidor', { triggeredBy: 'forceOpenRemoved' });
                 return 'player';
              }
              return prev;
            });
          }
          const updatedData: Partial<PlayerData> = {
            hasTerminalAccess: !!data.hasTerminalAccess,
            hasMacAccess: !!data.hasMacAccess,
            forceTerminalOpen: !!data.forceTerminalOpen,
            forceMacOpen: !!data.forceMacOpen,
            username: data.username,
            achievementsRevealed: !!data.achievementsRevealed,
          };
          onPlayerDataUpdate(updatedData);
        }
      },
      (error) => {
        console.warn('[PlayerSyncService] User listener error:', error);
      }
    );
    const unsubLimbo = onSnapshot(doc(db, 'system', 'limboState'), 
      (snap) => {
        const lState: LimboGlobalState = snap.exists()
          ? (snap.data() as LimboGlobalState)
          : { seized: false };
        onLimboUpdate(lState);
        if (lState.seized) {
          onScreenChange((prev) => (prev === 'limbo' ? 'limbo' : prev));
        }
      },
      (error) => {
        console.warn('[PlayerSyncService] Limbo listener error:', error);
      }
    );
    this.unsubs.push(unsubTapes, unsubUser, unsubLimbo);
  }
  public stopAll() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  }
}
export const playerSyncService = PlayerSyncService.getInstance();
