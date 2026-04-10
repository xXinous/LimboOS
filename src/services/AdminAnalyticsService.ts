import { db } from "../lib/firebase";
import { collection, onSnapshot, getDocs, collectionGroup, writeBatch, doc } from "firebase/firestore";
import { ALL_ACHIEVEMENTS } from "../data/achievements";

export interface PlayEvent {
  uid: string;
  tapeId: string;
  playedAt: any;
  completed?: boolean;
}

export interface AudioMetadata {
  id: string;
  size: number;
  title?: string;
  originalName?: string;
}

export interface UserAchievement {
  achievementId: string;
}

export interface PlayerStats {
  totalListenTime?: number;
  screwClicks?: number;
  ejectWithoutPlay?: number;
  maxVolumeTime?: number;
  zeroVolumeTime?: number;
}

export interface UserData {
  uid: string;
  displayName?: string;
  username?: string;
  email?: string;
  createdAt?: any;
  lastLogin?: any;
}

export class AdminAnalyticsService {
  private static instance: AdminAnalyticsService;

  private constructor() {}

  public static getInstance(): AdminAnalyticsService {
    if (!AdminAnalyticsService.instance) {
      AdminAnalyticsService.instance = new AdminAnalyticsService();
    }
    return AdminAnalyticsService.instance;
  }

  public subscribeToRawData(callback: (data: {
    playEvents: PlayEvent[];
    users: UserData[];
    audios: AudioMetadata[];
    unlockedAchievements: UserAchievement[];
    stats: PlayerStats[];
  }) => void): () => void {
    let playEvents: PlayEvent[] = [];
    let users: UserData[] = [];
    let audios: AudioMetadata[] = [];
    let unlockedAchievements: UserAchievement[] = [];
    let stats: PlayerStats[] = [];

    const notify = () => {
      callback({ playEvents, users, audios, unlockedAchievements, stats });
    };

    const unsubs = [
      onSnapshot(collection(db, "playEvents"), 
        (snap) => {
          playEvents = snap.docs.map(d => d.data() as PlayEvent);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] playEvents listener error:', err)
      ),
      onSnapshot(collection(db, "users"), 
        (snap) => {
          users = snap.docs.map(d => d.data() as UserData);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] users listener error:', err)
      ),
      onSnapshot(collection(db, "audios"), 
        (snap) => {
          audios = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] audios listener error:', err)
      ),
      onSnapshot(collectionGroup(db, "achievements"), 
        (snap) => {
          unlockedAchievements = snap.docs.map(d => d.data() as UserAchievement);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] achievements listener error:', err)
      ),
      onSnapshot(collectionGroup(db, "stats"), 
        (snap) => {
          stats = snap.docs.map(d => d.data() as PlayerStats);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] stats listener error:', err)
      )
    ];

    return () => unsubs.forEach(u => u());
  }

  public async resetAnalytics(): Promise<void> {
    const playEventsSnap = await getDocs(collection(db, 'playEvents'));
    let batch = writeBatch(db);
    let count = 0;
    
    playEventsSnap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        batch.commit();
        batch = writeBatch(db);
      }
    });
    await batch.commit();

    const usersSnap = await getDocs(collection(db, 'users'));
    batch = writeBatch(db);
    count = 0;
    usersSnap.docs.forEach((userDoc) => {
      const statsRef = doc(db, 'users', userDoc.id, 'stats', 'main');
      batch.set(statsRef, {
        totalListenTime: 0,
        screwClicks: 0,
        ejectWithoutPlay: 0,
        maxVolumeTime: 0,
        zeroVolumeTime: 0,
      }, { merge: true });
      count++;
      if (count % 400 === 0) {
        batch.commit();
        batch = writeBatch(db);
      }
    });
    await batch.commit();
  }

  public computeAnalytics(
    playEvents: PlayEvent[],
    users: UserData[],
    audios: AudioMetadata[],
    unlockedAchievements: UserAchievement[],
    stats: PlayerStats[]
  ) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeUsers = users.filter((u) => {
      if (!u.lastLogin?.toDate) return false;
      return u.lastLogin.toDate() >= sevenDaysAgo;
    }).length;

    const tapePlayMap: Record<string, number> = {};
    playEvents.forEach((e) => {
      tapePlayMap[e.tapeId] = (tapePlayMap[e.tapeId] || 0) + 1;
    });
    const mostPlayed = Object.entries(tapePlayMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const userPlayMap: Record<string, number> = {};
    playEvents.forEach((e) => {
      userPlayMap[e.uid] = (userPlayMap[e.uid] || 0) + 1;
    });
    const mostActiveUsers = Object.entries(userPlayMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uid, count]) => {
        const user = users.find((u) => u.uid === uid);
        return { uid, name: user?.displayName || user?.username || uid.slice(0, 8), count };
      });

    const dailyPlays: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyPlays[key] = 0;
    }
    playEvents.forEach((e) => {
      if (e.playedAt?.toDate) {
        const key = e.playedAt.toDate().toISOString().slice(0, 10);
        if (dailyPlays[key] !== undefined) {
          dailyPlays[key]++;
        }
      }
    });
    const dailyPlaysSorted = Object.entries(dailyPlays).sort(([a], [b]) => a.localeCompare(b));
    const maxDailyPlays = Math.max(...Object.values(dailyPlays), 1);

    const weeklyGrowth: Record<string, number> = {};
    users.forEach((u) => {
      if (u.createdAt?.toDate) {
        const d = u.createdAt.toDate();
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weeklyGrowth[key] = (weeklyGrowth[key] || 0) + 1;
      }
    });

    const achCountMap: Record<string, number> = {};
    unlockedAchievements.forEach(a => {
      achCountMap[a.achievementId] = (achCountMap[a.achievementId] || 0) + 1;
    });
    const rarityList = ALL_ACHIEVEMENTS.map(a => ({
      ...a,
      count: achCountMap[a.id] || 0,
      percentage: users.length > 0 ? ((achCountMap[a.id] || 0) / users.length) * 100 : 0
    })).sort((a, b) => a.count - b.count);

    const hourMap: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourMap[i] = 0;
    playEvents.forEach(e => {
      if (e.playedAt?.toDate) {
        const hour = e.playedAt.toDate().getHours();
        hourMap[hour]++;
      }
    });
    const peakHours = Object.entries(hourMap).map(([h, count]) => ({ hour: parseInt(h), count }));
    const maxHourCount = Math.max(...Object.values(hourMap), 1);

    const completedPlays = playEvents.filter(e => e.completed).length;
    const completionRate = playEvents.length > 0 ? (completedPlays / playEvents.length) * 100 : 0;

    const totalStorageSize = audios.reduce((acc, a) => acc + (a.size || 0), 0);
    const storageLimit = 5 * 1024 * 1024 * 1024;
    const storagePercentage = (totalStorageSize / storageLimit) * 100;

    const totalListenSecs = stats.reduce((acc, s) => acc + (s.totalListenTime || 0), 0);
    const avgListenSecs = users.length > 0 ? totalListenSecs / users.length : 0;
    const totalScrews = stats.reduce((acc, s) => acc + (s.screwClicks || 0), 0);
    const totalEjects = stats.reduce((acc, s) => acc + (s.ejectWithoutPlay || 0), 0);
    const totalMacVolSecs = stats.reduce((acc, s) => acc + (s.maxVolumeTime || 0), 0);
    const totalZeroVolSecs = stats.reduce((acc, s) => acc + (s.zeroVolumeTime || 0), 0);
    
    let maxObsessionCount = 0;
    const userTapePlays: Record<string, number> = {};
    playEvents.forEach(e => {
       const key = `${e.uid}_${e.tapeId}`;
       userTapePlays[key] = (userTapePlays[key] || 0) + 1;
       if (userTapePlays[key] > maxObsessionCount) maxObsessionCount = userTapePlays[key];
    });

    return { 
      activeUsers, 
      mostPlayed, 
      mostActiveUsers, 
      dailyPlaysSorted, 
      maxDailyPlays, 
      weeklyGrowth,
      rarityList,
      peakHours,
      maxHourCount,
      completionRate,
      totalStorageSize,
      storagePercentage,
      totalListenSecs,
      avgListenSecs,
      totalScrews,
      totalEjects,
      totalMacVolSecs,
      totalZeroVolSecs,
      maxObsessionCount,
      abandonRate: playEvents.length > 0 ? ((playEvents.length - completedPlays) / playEvents.length) * 100 : 0,
      totalAchievements: unlockedAchievements.length,
    };
  }
}

export const adminAnalyticsService = AdminAnalyticsService.getInstance();
