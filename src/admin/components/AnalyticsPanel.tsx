import React, { useState, useEffect, useMemo } from 'react';
import { useModal } from './ConfirmModal';
import { adminAnalyticsService, PlayEvent, AudioMetadata, UserAchievement, PlayerStats, UserData } from '../../services/AdminAnalyticsService';
import { resolveTapes } from '../../data/tapes';
import { activityLogger } from '../../services/ActivityLogger';

export default function AnalyticsPanel() {
  const [playEvents, setPlayEvents] = useState<PlayEvent[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [audios, setAudios] = useState<AudioMetadata[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const { showConfirm, showAlert, modal } = useModal();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await adminAnalyticsService.resetAnalytics();
      activityLogger.logAdmin('gm.mpg', 'bi_reset', 'Resetou painel de BI (play events + stats)');
      await showAlert('Reset Concluído', '✅ Painel de BI resetado com sucesso!');
    } catch (e) {
      console.error('Falha ao resetar BI', e);
      await showAlert('Erro', 'Falha ao resetar os dados. Verifique o console.');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const unsub = adminAnalyticsService.subscribeToRawData((data) => {
      setPlayEvents(data.playEvents);
      setUsers(data.users);
      setAudios(data.audios);
      setUnlockedAchievements(data.unlockedAchievements);
      setStats(data.stats);
    });
    return unsub;
  }, []);

  const analytics = useMemo(() => {
    return adminAnalyticsService.computeAnalytics(playEvents, users, audios, unlockedAchievements, stats);
  }, [playEvents, users, audios, unlockedAchievements, stats]);

  return (
    <div className="space-y-8">
      {modal}
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className={`px-4 py-2 ${isResetting ? 'bg-zinc-800 text-zinc-500' : 'bg-red-900/20 text-red-500 hover:bg-red-900/50 hover:text-red-400'} border border-red-500/20 text-[10px] font-label font-bold uppercase tracking-widest transition-colors flex items-center gap-2`}
        >
          <span className="material-symbols-outlined text-sm">delete_forever</span>
          {isResetting ? 'Aplicando Reset...' : 'Zerar Painel BI'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total_Users" value={users.length} icon="group" color="text-primary" />
        <KPICard label="Active_7d" value={analytics.activeUsers} icon="trending_up" color="text-tertiary" />
        <KPICard label="Total_Audio_Files" value={audios.length} icon="library_music" color="text-secondary" />
        <KPICard label="Total_Play_Events" value={playEvents.length} icon="play_circle" color="text-primary-container" />
      </div>

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
            <div className="h-full bg-secondary transition-all" style={{ width: `${Math.min(analytics.storagePercentage, 100)}%` }} />
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
            <div className="h-full bg-primary transition-all" style={{ width: `${analytics.completionRate}%` }} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge lg:col-span-2">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-sm">timeline</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Play_Activity_Timeline (30d)</h3></div>
          <div className="flex items-end gap-1 h-32">
            {analytics.dailyPlaysSorted.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-6 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{date.slice(5)} : {count}</div>
                <div className="w-full bg-orange-500/80 hover:bg-orange-400 transition-colors rounded-t-sm" style={{ height: `${(count / analytics.maxDailyPlays) * 100}%`, minHeight: count > 0 ? '4px' : '1px' }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[8px] font-label text-zinc-600">
            <span>{analytics.dailyPlaysSorted[0]?.[0]?.slice(5) || ''}</span>
            <span>{analytics.dailyPlaysSorted[analytics.dailyPlaysSorted.length - 1]?.[0]?.slice(5) || ''}</span>
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-sm">schedule</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Peak_Activity_Hours</h3></div>
          <div className="grid grid-cols-6 gap-2">
            {analytics.peakHours.map(({ hour, count }) => (
              <div key={hour} className="flex flex-col items-center group relative">
                <div className="absolute -top-6 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{hour}h: {count}</div>
                <div className="w-full aspect-square rounded-xs transition-colors" style={{ backgroundColor: count === 0 ? '#18181b' : `rgba(249, 115, 22, ${0.2 + (count / analytics.maxHourCount) * 0.8})` }} />
                <span className="text-[6px] text-zinc-700 mt-1">{hour}h</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-sm">leaderboard</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Top_Played_Tapes</h3></div>
          <div className="space-y-3">
            {analytics.mostPlayed.length === 0 ? (<p className="text-zinc-600 text-xs font-label tracking-widest">NO_PLAY_DATA_YET</p>) : (
              analytics.mostPlayed.map(([tapeId, count], idx) => {
                const maxCount = analytics.mostPlayed[0][1] as number;
                const localTape = resolveTapes([tapeId])[0];
                const remoteTape = audios.find((a) => a.id === tapeId);
                const tapeName = localTape?.title || remoteTape?.title || remoteTape?.originalName || tapeId;

                return (
                  <div key={tapeId} className="flex items-center gap-3">
                    <span className={`font-headline font-bold text-sm w-6 text-right ${idx < 3 ? 'text-orange-500' : 'text-zinc-500'}`}>#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-headline text-xs font-bold text-zinc-200 truncate">{tapeName}</span>
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

        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-sm">person_play</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Most_Active_Users</h3></div>
          <div className="space-y-3">
            {analytics.mostActiveUsers.length === 0 ? (<p className="text-zinc-600 text-xs font-label tracking-widest">NO_PLAY_DATA_YET</p>) : (
              analytics.mostActiveUsers.map((user, idx) => {
                const maxCount = analytics.mostActiveUsers[0].count;
                return (
                  <div key={user.uid} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx < 3 ? 'bg-orange-600/20 text-orange-500 border border-orange-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
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
        <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-sm">stars</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Rarest_Achievements</h3></div>
          <div className="space-y-4">
            {analytics.rarityList.slice(0, 5).map((ach) => (
              <div key={ach.id} className="flex items-center gap-3">
                <div className="text-xl w-10 h-10 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center shrink-0">{ach.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-headline font-bold text-xs text-zinc-200 truncate">{ach.title}</h4>
                    <span className="font-label text-[8px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{ach.percentage.toFixed(1)}% OWNED</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${ach.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-8">
          <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
            <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-sm">group_add</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">User_Growth_Weekly</h3></div>
            {Object.keys(analytics.weeklyGrowth).length === 0 ? (<p className="text-zinc-600 text-xs font-label tracking-widest">NO_GROWTH_DATA</p>) : (
              <div className="flex items-end gap-2 h-24">
                {Object.entries(analytics.weeklyGrowth).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, count]) => {
                  const maxWeekly = Math.max(...(Object.values(analytics.weeklyGrowth) as number[]), 1);
                  return (
                    <div key={week} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute -top-5 bg-zinc-800 text-zinc-300 text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">W{week.slice(5)} +{count}</div>
                      <div className="w-full bg-secondary/60 hover:bg-secondary/80 transition-colors rounded-t-sm" style={{ height: `${((count as number) / maxWeekly) * 100}%`, minHeight: '4px' }}></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
            <div className="flex items-center gap-3 mb-4"><span className="material-symbols-outlined text-orange-500 text-sm">analytics</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Quick_Metrics</h3></div>
            <div className="grid grid-cols-2 gap-4">
              <MetricRow label="Avg Plays/User" value={users.length > 0 ? (playEvents.length / users.length).toFixed(1) : '0'} />
              <MetricRow label="Unique Tapes" value={new Set(playEvents.map(e => e.tapeId)).size.toString()} />
              <MetricRow label="Total Listen Time" value={formatSecs(analytics.totalListenSecs)} />
              <MetricRow label="Abandon Rate" value={`${analytics.abandonRate.toFixed(1)}%`} title="Percentage of plays not completed" />
              <MetricRow label="Total Achievements" value={analytics.totalAchievements.toString()} />
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge mt-8">
            <div className="flex items-center gap-3 mb-4"><span className="material-symbols-outlined text-orange-500 text-sm">explore</span><h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Behavioral_Metrics</h3></div>
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
