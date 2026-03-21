import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';

interface PlayEvent {
  uid: string;
  tapeId: string;
  playedAt: any;
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
  const [audiosCount, setAudiosCount] = useState(0);

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
      setAudiosCount(snap.size);
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

    return { activeUsers, mostPlayed, mostActiveUsers, dailyPlaysSorted, maxDailyPlays, weeklyGrowth };
  }, [playEvents, users]);

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total_Users" value={users.length} icon="group" color="text-primary" />
        <KPICard label="Active_7d" value={analytics.activeUsers} icon="trending_up" color="text-tertiary" />
        <KPICard label="Total_Audio_Files" value={audiosCount} icon="library_music" color="text-secondary" />
        <KPICard label="Total_Play_Events" value={playEvents.length} icon="play_circle" color="text-primary-container" />
      </div>

      {/* Activity Timeline */}
      <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
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

      {/* User Growth & Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge lg:col-span-2">
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
                  const maxWeekly = Math.max(...Object.values(analytics.weeklyGrowth), 1);
                  return (
                    <div key={week} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute -top-5 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        W{week.slice(5)} +{count}
                      </div>
                      <div
                        className="w-full bg-secondary/60 hover:bg-secondary/80 transition-colors rounded-t-sm"
                        style={{ height: `${(count / maxWeekly) * 100}%`, minHeight: '4px' }}
                      ></div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Engagement Summary */}
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-orange-500 text-sm">analytics</span>
            <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Engagement_Summary</h3>
          </div>
          <div className="space-y-4">
            <MetricRow label="Avg Plays/User" value={
              users.length > 0 ? (playEvents.length / users.length).toFixed(1) : '0'
            } />
            <MetricRow label="Unique Tapes Played" value={
              new Set(playEvents.map(e => e.tapeId)).size.toString()
            } />
            <MetricRow label="Users w/ Plays" value={
              new Set(playEvents.map(e => e.uid)).size.toString()
            } />
            <MetricRow label="Play Rate" value={
              users.length > 0 
                ? `${((new Set(playEvents.map(e => e.uid)).size / users.length) * 100).toFixed(0)}%`
                : '0%'
            } />
          </div>
        </section>
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
      <span className="font-label text-[9px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="font-headline font-bold text-sm text-on-surface">{value}</span>
    </div>
  );
}
