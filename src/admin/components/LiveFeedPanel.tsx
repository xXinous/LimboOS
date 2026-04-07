import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ActivityEntry {
  id: string;
  uid: string;
  username: string;
  type: 'navigation' | 'action' | 'system' | 'error' | 'admin';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: any;
  source: 'player' | 'admin';
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  navigation: { color: 'text-emerald-400', icon: 'swap_horiz', label: 'NAV' },
  action:     { color: 'text-sky-400',     icon: 'touch_app',  label: 'ACT' },
  system:     { color: 'text-orange-400',  icon: 'settings',   label: 'SYS' },
  error:      { color: 'text-red-400',     icon: 'error',      label: 'ERR' },
  admin:      { color: 'text-purple-400',  icon: 'shield',     label: 'ADM' },
  auth:       { color: 'text-yellow-400',  icon: 'login',      label: 'AUT' },
  trace:      { color: 'text-zinc-600',    icon: 'code',       label: 'TRC' },
};

export default function LiveFeedPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterUser, setFilterUser] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const q = query(
      collection(db, 'activityLog'),
      orderBy('timestamp', 'desc'),
      limit(80)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (pausedRef.current) return;
      const list: ActivityEntry[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<ActivityEntry, 'id'>) });
      });
      setEntries(list);
    });

    return () => unsub();
  }, []);

  // Auto-scroll to top on new entries
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length, paused]);

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterUser && !(e.username || '').toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return '--:--:--';
    const d = ts.toDate();
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-surface-container border border-zinc-800 machined-edge flex flex-col" style={{ height: '42vh', minHeight: '300px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-emerald-500 text-lg">cell_tower</span>
            {!paused && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            )}
          </div>
          <h2 className="font-headline font-bold uppercase tracking-widest text-sm text-on-surface">
            Active_Feed
          </h2>
          <span className="text-[9px] font-label text-zinc-600 tracking-wider">
            {filtered.length} EVENTS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* User filter */}
          <input
            type="text"
            placeholder="FILTER_USER..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 placeholder:text-zinc-700 px-2 py-1 w-28 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">ALL</option>
            <option value="navigation">NAV</option>
            <option value="action">ACT</option>
            <option value="system">SYS</option>
            <option value="auth">AUT</option>
            <option value="error">ERR</option>
            <option value="admin">ADM</option>
            <option value="trace">TRC</option>
          </select>

          {/* Pause/Resume */}
          <button
            onClick={() => setPaused(!paused)}
            className={`px-3 py-1 text-[9px] font-label font-bold uppercase tracking-widest border machined-edge transition-all ${
              paused
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <span className="material-symbols-outlined text-xs align-middle mr-1">
              {paused ? 'play_arrow' : 'pause'}
            </span>
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      </div>

      {/* Feed body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 font-mono text-[11px]">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 font-label text-xs tracking-widest">
            <span className="material-symbols-outlined text-lg mr-2 text-zinc-800">hourglass_empty</span>
            AGUARDANDO_EVENTOS...
          </div>
        ) : (
          filtered.map((entry) => {
            const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.system;
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-2 px-4 py-1.5 border-b border-zinc-900/60 hover:bg-zinc-800/20 transition-colors ${
                  entry.type === 'error' ? 'bg-red-950/10' : ''
                }`}
              >
                {/* Timestamp */}
                <span className="text-zinc-600 shrink-0 w-16 text-right tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>

                {/* Type badge */}
                <span className={`material-symbols-outlined text-xs shrink-0 mt-0.5 ${cfg.color}`}>
                  {cfg.icon}
                </span>
                <span className={`text-[8px] font-label font-bold tracking-wider shrink-0 w-7 mt-0.5 ${cfg.color}`}>
                  {cfg.label}
                </span>

                {/* Username */}
                <span className="text-purple-300 shrink-0 truncate max-w-[100px] font-bold">
                  {entry.username || entry.uid?.slice(0, 8)}
                </span>

                {/* Message */}
                <span className="text-zinc-300 flex-1 truncate">{entry.message}</span>

                {/* Category pill */}
                <span className="text-[7px] font-label text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider">
                  {entry.category}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Paused indicator */}
      {paused && (
        <div className="flex items-center justify-center py-1.5 bg-orange-500/10 border-t border-orange-500/20">
          <span className="text-[9px] font-label text-orange-400 tracking-widest uppercase animate-pulse">
            ▮▮ FEED PAUSADO — Clique RESUME para continuar
          </span>
        </div>
      )}
    </div>
  );
}
