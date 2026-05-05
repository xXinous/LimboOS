import React, { useState, useEffect, useMemo } from 'react';
import { useModal } from './ConfirmModal';
import { adminAnalyticsService, PlayEvent, AudioMetadata, UserAchievement, PlayerStats, UserData } from '../../services/AdminAnalyticsService';
import { intelRegistry } from '../../data/intel_registry';
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
    <div className="space-y-8 font-chakra">
      {modal}
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className={`px-6 py-3 ${isResetting ? 'bg-[#1a1a1a] text-zinc-600' : 'bg-red-950/20 text-red-500 hover:bg-red-900/40 hover:text-red-400'} border-4 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-3 rounded-lg active:scale-95`}
        >
          <span className="material-symbols-outlined text-sm">delete_forever</span>
          {isResetting ? 'Executando Reset...' : 'Zerar Banco de Dados BI'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Usuários_Ativos" value={users.length} icon="group" color="text-primary" />
        <KPICard label="Ativos_7d" value={analytics.activeUsers} icon="trending_up" color="text-tertiary" />
        <KPICard label="Arquivos_Áudio" value={audios.length} icon="library_music" color="text-secondary" />
        <KPICard label="Eventos_Play" value={playEvents.length} icon="play_circle" color="text-primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-sm">cloud_done</span>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Armazenamento_Firebase</h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-500">{(analytics.totalStorageSize / (1024 * 1024)).toFixed(1)} MB / 5 GB</span>
          </div>
          <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border-2 border-[#1a1a1a]">
            <div className="h-full bg-secondary shadow-[0_0_10px_rgba(198,198,198,0.3)] transition-all" style={{ width: `${Math.min(analytics.storagePercentage, 100)}%` }} />
          </div>
        </section>

        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Taxa_de_Conclusão</h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-500">{analytics.completionRate.toFixed(1)}% Concluído</span>
          </div>
          <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border-2 border-[#1a1a1a]">
            <div className="h-full bg-primary shadow-[0_0_10px_rgba(255,140,0,0.3)] transition-all" style={{ width: `${analytics.completionRate}%` }} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] lg:col-span-2">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-primary text-sm">timeline</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Atividade_Temporal (30d)</h3></div>
          <div className="flex items-end gap-1 h-32">
            {analytics.dailyPlaysSorted.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-8 bg-[#333] border border-[#1a1a1a] text-primary text-[8px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">{date.slice(5)} : {count}</div>
                <div className="w-full bg-primary/60 hover:bg-primary transition-all rounded-t-sm" style={{ height: `${(count / analytics.maxDailyPlays) * 100}%`, minHeight: count > 0 ? '4px' : '1px' }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-[9px] font-bold text-zinc-600 tracking-widest">
            <span>{analytics.dailyPlaysSorted[0]?.[0]?.slice(5) || ''}</span>
            <span>{analytics.dailyPlaysSorted[analytics.dailyPlaysSorted.length - 1]?.[0]?.slice(5) || ''}</span>
          </div>
        </section>

        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-primary text-sm">schedule</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Horários_Pico</h3></div>
          <div className="grid grid-cols-6 gap-2">
            {analytics.peakHours.map(({ hour, count }) => (
              <div key={hour} className="flex flex-col items-center group relative">
                <div className="absolute -top-8 bg-[#333] border border-[#1a1a1a] text-primary text-[8px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">{hour}h: {count}</div>
                <div className="w-full aspect-square rounded-sm border border-white/5 transition-all group-hover:scale-110" style={{ backgroundColor: count === 0 ? '#111' : `rgba(255, 183, 125, ${0.1 + (count / analytics.maxHourCount) * 0.9})`, boxShadow: count > 0 ? `0 0 10px rgba(255, 183, 125, ${(count / analytics.maxHourCount) * 0.4})` : 'none' }} />
                <span className="text-[7px] text-zinc-600 mt-1 font-bold">{hour}h</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-primary text-sm">leaderboard</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Top_Arquivos</h3></div>
          <div className="space-y-4">
            {analytics.mostPlayed.length === 0 ? (<p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">SEM_DADOS_REGISTRADOS</p>) : (
              analytics.mostPlayed.map(([tapeId, count], idx) => {
                const maxCount = analytics.mostPlayed[0][1] as number;
                const intel = intelRegistry.get(tapeId);
                const remoteTape = audios.find((a) => a.id === tapeId);
                const tapeName = intel?.title || remoteTape?.title || remoteTape?.originalName || tapeId;
                return (
                  <div key={tapeId} className="flex items-center gap-4 group">
                    <span className={`font-black text-sm w-6 text-right ${idx < 3 ? 'text-primary' : 'text-zinc-600'}`}>#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-zinc-200 truncate uppercase tracking-wide group-hover:text-primary transition-colors">{tapeName}</span>
                        <span className="text-[10px] font-bold text-primary ml-2">{count}×</span>
                      </div>
                      <div className="h-2 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden">
                        <div className="h-full bg-primary/80 shadow-[0_0_8px_rgba(255,140,0,0.3)] transition-all" style={{ width: `${(count / maxCount) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-primary text-sm">person_play</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Agentes_Mais_Ativos</h3></div>
          <div className="space-y-4">
            {analytics.mostActiveUsers.length === 0 ? (<p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">SEM_DADOS_REGISTRADOS</p>) : (
              analytics.mostActiveUsers.map((user, idx) => {
                const maxCount = analytics.mostActiveUsers[0].count;
                return (
                  <div key={user.uid} className="flex items-center gap-4 group">
                    <div className={`w-9 h-9 border-2 flex items-center justify-center text-xs font-black transition-all ${idx < 3 ? 'border-primary bg-primary/10 text-primary' : 'border-zinc-800 bg-zinc-900 text-zinc-600 group-hover:border-zinc-700'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-zinc-200 truncate uppercase tracking-wide group-hover:text-primary transition-colors">{user.name}</span>
                        <span className="text-[10px] font-bold text-tertiary ml-2">{user.count} plays</span>
                      </div>
                      <div className="h-2 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden">
                        <div className="h-full bg-tertiary/60 transition-all" style={{ width: `${(user.count / maxCount) * 100}%` }}></div>
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
        <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-primary text-sm">stars</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Conquistas_Raras</h3></div>
          <div className="space-y-5">
            {analytics.rarityList.slice(0, 5).map((ach) => (
              <div key={ach.id} className="flex items-center gap-4 group">
                <div className="text-2xl w-12 h-12 bg-black/60 border-2 border-[#1a1a1a] flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors shadow-lg">{ach.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1.5">
                    <h4 className="text-[11px] font-black text-zinc-200 truncate uppercase tracking-tight group-hover:text-primary transition-colors">{ach.title}</h4>
                    <span className="text-[8px] font-bold px-2 py-0.5 bg-black/40 text-primary/60 border border-primary/10 rounded-sm">{ach.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary/60" style={{ width: `${ach.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-8">
          <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-primary text-sm">group_add</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Crescimento_Semanal</h3></div>
            {Object.keys(analytics.weeklyGrowth).length === 0 ? (<p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">SEM_DADOS_REGISTRADOS</p>) : (
              <div className="flex items-end gap-2 h-24">
                {Object.entries(analytics.weeklyGrowth).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, count]) => {
                  const maxWeekly = Math.max(...(Object.values(analytics.weeklyGrowth) as number[]), 1);
                  return (
                    <div key={week} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute -top-8 bg-[#333] border border-[#1a1a1a] text-secondary text-[8px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">W{week.slice(5)} +{count}</div>
                      <div className="w-full bg-secondary/40 hover:bg-secondary/80 transition-all rounded-t-sm" style={{ height: `${((count as number) / maxWeekly) * 100}%`, minHeight: '4px' }}></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-[#222] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3 mb-5"><span className="material-symbols-outlined text-primary text-sm">analytics</span><h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Métricas_Operacionais</h3></div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <MetricRow label="Média de Plays" value={users.length > 0 ? (playEvents.length / users.length).toFixed(1) : '0'} />
              <MetricRow label="Fitas Únicas" value={new Set(playEvents.map(e => e.tapeId)).size.toString()} />
              <MetricRow label="Tempo de Audição" value={formatSecs(analytics.totalListenSecs)} />
              <MetricRow label="Taxa de Abandono" value={`${analytics.abandonRate.toFixed(1)}%`} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-[#222] border-4 border-[#1a1a1a] p-5 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] relative overflow-hidden group">
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 mb-2">{label}</p>
          <p className={`text-3xl font-black tracking-tighter ${color}`}>{value}</p>
        </div>
        <span className={`material-symbols-outlined text-4xl opacity-10 group-hover:opacity-30 transition-opacity ${color}`}>{icon}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">{label}</span>
      <span className="text-xs font-black text-white tracking-widest">{value}</span>
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
