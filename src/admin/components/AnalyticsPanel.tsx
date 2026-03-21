import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, collectionGroup } from 'firebase/firestore';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';

interface PlayEvent {
  uid: string;
  tapeId: string;
  playedAt: any;
  completed?: boolean;
}

interface AudioMetadata {
  size: number;
}

interface UserAchievement {
  achievementId: string;
}

interface PlayerStats {
  totalListenTime?: number;
  screwClicks?: number;
  ejectWithoutPlay?: number;
  maxVolumeTime?: number;
  zeroVolumeTime?: number;
}

interface UserData {
  uid: string;
  displayName?: string;
  username?: string;
  email?: string;
  createdAt?: any;
  lastLogin?: any;
}

export default function AnalyticsPanel() {
  const [playEvents, setPlayEvents] = useState<PlayEvent[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [audios, setAudios] = useState<AudioMetadata[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(collection(db, 'playEvents'), (snap) => {
      const events: PlayEvent[] = [];
      snap.forEach((d) => events.push(d.data() as PlayEvent));
      setPlayEvents(events);
    }));

    unsubs.push(onSnapshot(collection(db, 'users'), (snap) => {
      const u: UserData[] = [];
      snap.forEach((d) => u.push(d.data() as UserData));
      setUsers(u);
    }));

    unsubs.push(onSnapshot(collection(db, 'audios'), (snap) => {
      const a: AudioMetadata[] = [];
      snap.forEach(d => a.push(d.data() as AudioMetadata));
      setAudios(a);
    }));

    unsubs.push(onSnapshot(collectionGroup(db, 'achievements'), (snap) => {
      const achs: UserAchievement[] = [];
      snap.forEach(d => achs.push(d.data() as UserAchievement));
      setUnlockedAchievements(achs);
    }));

    unsubs.push(onSnapshot(collectionGroup(db, 'stats'), (snap) => {
      const s: PlayerStats[] = [];
      snap.forEach(d => s.push(d.data() as PlayerStats));
      setStats(s);
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // Compute analytics data
  const analytics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Active users (last 7 days)
    const activeUsers = users.filter((u) => {
      if (!u.lastLogin?.toDate) return false;
      return u.lastLogin.toDate() >= sevenDaysAgo;
    }).length;

    // Most played tapes
    const tapePlayMap: Record<string, number> = {};
    playEvents.forEach((e) => {
      tapePlayMap[e.tapeId] = (tapePlayMap[e.tapeId] || 0) + 1;
    });
    const mostPlayed = Object.entries(tapePlayMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // Most active users
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

    // Daily plays (last 30 days)
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

    // User growth (new registrations by week)
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

    // Achievement Rarity
    const achCountMap: Record<string, number> = {};
    unlockedAchievements.forEach(a => {
      achCountMap[a.achievementId] = (achCountMap[a.achievementId] || 0) + 1;
    });
    const rarityList = ALL_ACHIEVEMENTS.map(a => ({
      ...a,
      count: achCountMap[a.id] || 0,
      percentage: users.length > 0 ? ((achCountMap[a.id] || 0) / users.length) * 100 : 0
    })).sort((a, b) => a.count - b.count); // Rarest first

    // Peak Activity Hours
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

    // Audio Completion Rate
    const completedPlays = playEvents.filter(e => e.completed).length;
    const completionRate = playEvents.length > 0 ? (completedPlays / playEvents.length) * 100 : 0;

    // Storage Usage
    const totalStorageSize = audios.reduce((acc, a) => acc + (a.size || 0), 0);
    const storageLimit = 5 * 1024 * 1024 * 1024; // 5GB Free Tier
    const storagePercentage = (totalStorageSize / storageLimit) * 100;

    // Aggregated Behavioral Stats
    const totalListenSecs = stats.reduce((acc, s) => acc + (s.totalListenTime || 0), 0);
    const avgListenSecs = users.length > 0 ? totalListenSecs / users.length : 0;
    const totalScrews = stats.reduce((acc, s) => acc + (s.screwClicks || 0), 0);
    const totalEjects = stats.reduce((acc, s) => acc + (s.ejectWithoutPlay || 0), 0);
    const totalMacVolSecs = stats.reduce((acc, s) => acc + (s.maxVolumeTime || 0), 0);
    const totalZeroVolSecs = stats.reduce((acc, s) => acc + (s.zeroVolumeTime || 0), 0);
    
    // Tape Obsession
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
  }, [playEvents, users, audios, unlockedAchievements, stats]);

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total_Users" value={users.length} icon="group" color="text-primary" />
        <KPICard label="Active_7d" value={analytics.activeUsers} icon="trending_up" color="text-tertiary" />
        <KPICard label="Total_Audio_Files" value={audios.length} icon="library_music" color="text-secondary" />
        <KPICard label="Total_Play_Events" value={playEvents.length} icon="play_circle" color="text-primary-container" />
      </div>

      {/* Storage Usage & Completion Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-sm">cloud_done</span>
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Firebase_Storage_Usage</h3>
            </div>
            <span className="text-[10px] font-label text-zinc-500">{(analytics.totalStorageSize / (1024 * 1024)).toFixed(1)} MB / 5 GB</span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div 
              className="h-full bg-secondary transition-all" 
              style={{ width: `${Math.min(analytics.storagePercentage, 100)}%` }}
            />
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Playback_Completion_Rate</h3>
            </div>
            <span className="text-[10px] font-label text-zinc-500">{analytics.completionRate.toFixed(1)}% Completed</span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${analytics.completionRate}%` }}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Timeline */}
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-orange-500 text-sm">timeline</span>
            <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Play_Activity_Timeline (30d)</h3>
          </div>
          <div className="flex items-end gap-1 h-32">
            {analytics.dailyPlaysSorted.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-6 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {date.slice(5)} : {count}
                </div>
                <div
                  className="w-full bg-orange-500/80 hover:bg-orange-400 transition-colors rounded-t-sm"
                  style={{ height: `${(count / analytics.maxDailyPlays) * 100}%`, minHeight: count > 0 ? '4px' : '1px' }}
                ></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[8px] font-label text-zinc-600">
            <span>{analytics.dailyPlaysSorted[0]?.[0]?.slice(5) || ''}</span>
            <span>{analytics.dailyPlaysSorted[analytics.dailyPlaysSorted.length - 1]?.[0]?.slice(5) || ''}</span>
          </div>
        </section>

        {/* Peak Hours (Heatmap) */}
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-orange-500 text-sm">schedule</span>
            <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Peak_Activity_Hours</h3>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {analytics.peakHours.map(({ hour, count }) => (
              <div key={hour} className="flex flex-col items-center group relative">
                <div className="absolute -top-6 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {hour}h: {count}
                </div>
                <div 
                  className="w-full aspect-square rounded-xs transition-colors"
                  style={{ 
                    backgroundColor: count === 0 ? '#18181b' : `rgba(249, 115, 22, ${0.2 + (count / analytics.maxHourCount) * 0.8})` 
                  }}
                />
                <span className="text-[6px] text-zinc-700 mt-1">{hour}h</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most Played Tapes */}
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-orange-500 text-sm">leaderboard</span>
            <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Top_Played_Tapes</h3>
          </div>
          <div className="space-y-3">
            {analytics.mostPlayed.length === 0 ? (
              <p className="text-zinc-600 text-xs font-label tracking-widest">NO_PLAY_DATA_YET</p>
            ) : (
              analytics.mostPlayed.map(([tapeId, count], idx) => {
                const maxCount = analytics.mostPlayed[0][1] as number;
                return (
                  <div key={tapeId} className="flex items-center gap-3">
                    <span className={`font-headline font-bold text-sm w-6 text-right ${idx < 3 ? 'text-orange-500' : 'text-zinc-500'}`}>
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-headline text-xs font-bold text-zinc-200 truncate">{tapeId}</span>
                        <span className="font-label text-[10px] text-orange-500 ml-2">{count}×</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded">
                        <div className="h-full bg-orange-600 rounded transition-all" style={{ width: `${(count / maxCount) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Most Active Users */}
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-orange-500 text-sm">person_play</span>
            <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Most_Active_Users</h3>
          </div>
          <div className="space-y-3">
            {analytics.mostActiveUsers.length === 0 ? (
              <p className="text-zinc-600 text-xs font-label tracking-widest">NO_PLAY_DATA_YET</p>
            ) : (
              analytics.mostActiveUsers.map((user, idx) => {
                const maxCount = analytics.mostActiveUsers[0].count;
                return (
                  <div key={user.uid} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                      idx < 3 ? 'bg-orange-600/20 text-orange-500 border border-orange-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-headline text-xs font-bold text-zinc-200 truncate">{user.name}</span>
                        <span className="font-label text-[10px] text-tertiary ml-2">{user.count} plays</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded">
                        <div className="h-full bg-tertiary/60 rounded transition-all" style={{ width: `${(user.count / maxCount) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Achievement Rarity */}
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-orange-500 text-sm">stars</span>
            <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Rarest_Achievements</h3>
          </div>
          <div className="space-y-4">
            {analytics.rarityList.slice(0, 5).map((ach) => (
              <div key={ach.id} className="flex items-center gap-3">
                <div className="text-xl w-10 h-10 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center shrink-0">
                  {ach.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-headline font-bold text-xs text-zinc-200 truncate">{ach.title}</h4>
                    <span className="font-label text-[8px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                      {ach.percentage.toFixed(1)}% OWNED
                    </span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500" 
                      style={{ width: `${ach.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* User Growth & Engagement Summary Combined */}
        <div className="space-y-8">
          <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-orange-500 text-sm">group_add</span>
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">User_Growth_Weekly</h3>
            </div>
            {Object.keys(analytics.weeklyGrowth).length === 0 ? (
              <p className="text-zinc-600 text-xs font-label tracking-widest">NO_GROWTH_DATA</p>
            ) : (
              <div className="flex items-end gap-2 h-24">
                {Object.entries(analytics.weeklyGrowth)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(-12)
                  .map(([week, count]) => {
                    const c = count as number;
                    const maxWeekly = Math.max(...(Object.values(analytics.weeklyGrowth) as number[]), 1);
                    return (
                      <div key={week} className="flex-1 flex flex-col items-center group relative">
                        <div className="absolute -top-5 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          W{week.slice(5)} +{c}
                        </div>
                        <div
                          className="w-full bg-secondary/60 hover:bg-secondary/80 transition-colors rounded-t-sm"
                          style={{ height: `${(c / maxWeekly) * 100}%`, minHeight: '4px' }}
                        ></div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-500 text-sm">analytics</span>
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Quick_Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricRow label="Avg Plays/User" value={users.length > 0 ? (playEvents.length / users.length).toFixed(1) : '0'} />
              <MetricRow label="Unique Tapes" value={new Set(playEvents.map(e => e.tapeId)).size.toString()} />
              <MetricRow label="Total Listen Time" value={formatSecs(analytics.totalListenSecs)} />
              <MetricRow label="Abandon Rate" value={`${analytics.abandonRate.toFixed(1)}%`} title="Percentage of plays not completed" />
              <MetricRow label="Total Achievements" value={analytics.totalAchievements.toString()} />
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge mt-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-500 text-sm">explore</span>
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Behavioral_Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricRow label="Avg Listen Time" value={formatSecs(analytics.avgListenSecs)} />
              <MetricRow label="Max Vol Time" value={formatSecs(analytics.totalMacVolSecs)} />
              <MetricRow label="0% Vol Time" value={formatSecs(analytics.totalZeroVolSecs)} />
              <MetricRow label="Screws Tampered" value={analytics.totalScrews.toString()} />
              <MetricRow label="Anxious Ejects" value={analytics.totalEjects.toString()} />
              <MetricRow label="Highest Obsession" value={`${analytics.maxObsessionCount} plays`} title="Most times a single user played the same tape" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest border border-zinc-800 p-5 machined-edge relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
          <p className={`text-3xl font-headline font-bold tracking-tighter ${color}`}>{value}</p>
        </div>
        <span className={`material-symbols-outlined text-3xl opacity-20 ${color}`}>{icon}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2" title={title}>
      <span className="font-label text-[9px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="font-headline font-bold text-sm text-on-surface">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
