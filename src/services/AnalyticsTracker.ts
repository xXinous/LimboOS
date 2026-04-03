import type { PlayerData, PlayerStats } from '../store/firestore';
import type { Tape } from '../data/tapes';
import { recordPlayEvent, markPlayEventCompleted, firestoreUpdateStats, firestoreGrantAchievements } from '../store/firestore';
import { checkNewAchievements } from '../data/achievements';
import { resolveTapes } from '../data/tapes';
import type { Toast } from '../components/ToastNotification';

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private listenTimer: number | null = null;
  private syncTimer: number | null = null;
  
  private activePlayEventId: string | null = null;
  private currentVolume: number = 80;

  // States injected from Controller
  private localStats: PlayerStats | null = null;
  private playerData: PlayerData | null = null;
  private onStatsSync: ((stats: PlayerStats, data: PlayerData) => void) | null = null;
  private onToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

  private constructor() {}

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  public init(
    playerData: PlayerData, 
    initialStats: PlayerStats, 
    onStatsSync: (stats: PlayerStats, data: PlayerData) => void,
    onToast: (toast: Omit<Toast, 'id'>) => void
  ) {
    this.playerData = playerData;
    this.localStats = initialStats;
    this.onStatsSync = onStatsSync;
    this.onToast = onToast;

    this.startBackgroundSync();
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
  }

  public updatePlayerData(data: PlayerData) {
    this.playerData = data;
  }

  public incrementStat(key: keyof PlayerStats, amount = 1) {
    if (!this.localStats) return;
    this.localStats[key] = (this.localStats[key] as number) + amount;
    this.syncLocalChanges();
    this.checkAchievements();

    if (key === 'fidgetClicks' && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(50);
      } catch(e) {
        // Ignora erro de permissão ou hardware
      }
    }
  }

  public startPlayback(tape: Tape) {
    if (!this.playerData) return;

    // Record the Play Event
    recordPlayEvent(this.playerData.uid, tape.id)
      .then(id => this.activePlayEventId = id)
      .catch(console.error);

    // Start Tracker Timer
    if (this.listenTimer) clearInterval(this.listenTimer);
    this.listenTimer = window.setInterval(() => this.tick(), 5000);
  }

  public pausePlayback() {
    if (this.listenTimer) clearInterval(this.listenTimer);
  }

  public endPlayback() {
    this.pausePlayback();
    if (this.activePlayEventId) {
      markPlayEventCompleted(this.activePlayEventId).catch(console.error);
      this.activePlayEventId = null;
    }
  }

  private tick() {
    if (!this.localStats || !this.playerData) return;

    this.localStats.totalListenTime += 5;
    if (this.currentVolume === 100) this.localStats.maxVolumeTime += 5;
    if (this.currentVolume === 0) this.localStats.zeroVolumeTime += 5;

    this.syncLocalChanges();
    this.checkAchievements();
  }

  private syncLocalChanges() {
    if (this.onStatsSync && this.localStats && this.playerData) {
      this.onStatsSync({ ...this.localStats }, { ...this.playerData });
    }
  }

  public forceSyncToServer() {
    if (this.playerData && this.localStats) {
      firestoreUpdateStats(this.playerData.uid, this.localStats).catch(console.error);
    }
  }

  private startBackgroundSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = window.setInterval(() => this.forceSyncToServer(), 60000);
  }

  public stopAll() {
    this.pausePlayback();
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.forceSyncToServer();
  }

  // Achievement Check Logic
  public checkAchievements(scanTimes: number[] = []) {
    if (!this.playerData || !this.localStats) return;

    const profile = { ...this.playerData, stats: this.localStats };
    const tapes = resolveTapes(this.playerData.unlockedTapeIds);
    const newAchievements = checkNewAchievements(profile, tapes, scanTimes.length);

    if (newAchievements.length > 0) {
      firestoreGrantAchievements(this.playerData.uid, newAchievements.map(a => a.id));
      this.forceSyncToServer();

      newAchievements.forEach(ach => {
        if (this.onToast) this.onToast({ type: 'achievement', title: 'Conquista!', subtitle: ach.title, icon: ach.icon });
      });

      this.playerData.achievementIds = [...this.playerData.achievementIds, ...newAchievements.map(a => a.id)];
      this.syncLocalChanges();
    }
  }
}

export const analyticsTracker = AnalyticsTracker.getInstance();
