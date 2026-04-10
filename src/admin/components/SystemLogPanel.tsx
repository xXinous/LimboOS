import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useModal } from './ConfirmModal';

interface LogEntry {
  id: string;
  uid: string;
  username: string;
  type: 'navigation' | 'action' | 'system' | 'error' | 'admin' | 'auth' | 'trace';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: any;
  source: 'player' | 'admin';
}

const TYPE_COLORS: Record<string, string> = {
  navigation: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  action:     'text-sky-400 bg-sky-500/10 border-sky-500/20',
  system:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  error:      'text-red-400 bg-red-500/10 border-red-500/20',
  admin:      'text-purple-400 bg-purple-500/10 border-purple-500/20',
  auth:       'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  trace:      'text-zinc-500 bg-zinc-800 border-zinc-700/50',
};

const TYPE_ICONS: Record<string, string> = {
  navigation: 'swap_horiz',
  action:     'touch_app',
  system:     'settings',
  error:      'error',
  admin:      'shield',
  auth:       'login',
  trace:      'code',
};

const SEVERITY: Record<string, { label: string; color: string }> = {
  error:  { label: 'ERROR', color: 'text-red-500' },
  system: { label: 'INFO',  color: 'text-zinc-500' },
  admin:  { label: 'ADMIN', color: 'text-purple-500' },
  action: { label: 'INFO',  color: 'text-zinc-500' },
  navigation: { label: 'INFO', color: 'text-zinc-500' },
  auth:   { label: 'AUTH',  color: 'text-yellow-500' },
  trace:  { label: 'TRACE', color: 'text-zinc-600' },
};

export default function SystemLogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [maxEntries, setMaxEntries] = useState(200);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Filters
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchText, setSearchText] = useState('');

  const { showConfirm, showAlert, modal } = useModal();

  useEffect(() => {
    const q = query(
      collection(db, 'activityLog'),
      orderBy('timestamp', 'desc'),
      limit(maxEntries)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: LogEntry[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<LogEntry, 'id'>) });
      });
      setEntries(list);
    });

    return () => unsub();
  }, [maxEntries]);

  // Derived unique values for filter dropdowns
  const uniqueCategories = useMemo(() => {
    const set = new Set(entries.map(e => e.category));
    return Array.from(set).sort();
  }, [entries]);

  const uniqueUsers = useMemo(() => {
    const set = new Set(entries.map(e => e.username).filter(Boolean));
    return Array.from(set).sort();
  }, [entries]);

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      if (filterUser && e.username !== filterUser) return false;
      if (searchText && !e.message.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterSource, filterType, filterCategory, filterUser, searchText]);

  // Error count
  const errorCount = entries.filter(e => e.type === 'error').length;

  const formatTimestamp = (ts: any) => {
    if (!ts?.toDate) return '—';
    const d = ts.toDate();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const snap = await getDocs(collection(db, 'activityLog'));
      let batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
        if (count % 400 === 0) {
          batch.commit();
          batch = writeBatch(db);
        }
      });
      await batch.commit();
      await showAlert('Logs Limpos', `✅ ${count} log(s) removido(s) com sucesso.`);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      await showAlert('Erro', 'Falha ao limpar os logs. Verifique o console.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportJSON = () => {
    const data = filtered.map(e => ({
      timestamp: e.timestamp?.toDate?.()?.toISOString?.() || null,
      type: e.type,
      source: e.source,
      category: e.category,
      uid: e.uid,
      username: e.username,
      message: e.message,
      metadata: e.metadata || null,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_log_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface-container border border-zinc-800 machined-edge flex flex-col" style={{ minHeight: '400px', maxHeight: '55vh' }}>
      {modal}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-orange-500 text-lg">list_alt</span>
          <h2 className="font-headline font-bold uppercase tracking-widest text-sm text-on-surface">
            System_Log
          </h2>
          <span className="text-[9px] font-label text-zinc-600 tracking-wider">
            {filtered.length}/{entries.length}
          </span>
          {errorCount > 0 && (
            <span className="text-[8px] font-label font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">error</span>
              {errorCount} ERRORS
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-1 text-[9px] font-label font-bold uppercase tracking-widest bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition-colors machined-edge flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-xs">download</span>
            EXPORT
          </button>
          <button
            onClick={handleClearLogs}
            disabled={isClearing}
            className={`px-3 py-1 text-[9px] font-label font-bold uppercase tracking-widest border machined-edge transition-colors flex items-center gap-1 ${
              isClearing
                ? 'bg-zinc-800 text-zinc-600 border-zinc-700'
                : 'bg-red-900/20 text-red-500 border-red-500/20 hover:bg-red-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-xs">delete_forever</span>
            {isClearing ? 'LIMPANDO...' : 'LIMPAR'}
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/60 shrink-0 flex-wrap">
        <span className="text-[8px] font-label text-zinc-600 tracking-widest shrink-0">FILTROS:</span>

        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-orange-500"
        >
          <option value="all">SOURCE: ALL</option>
          <option value="player">PLAYER</option>
          <option value="admin">ADMIN</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-orange-500"
        >
          <option value="all">TYPE: ALL</option>
          <option value="navigation">NAV</option>
          <option value="action">ACT</option>
          <option value="system">SYS</option>
          <option value="auth">AUT</option>
          <option value="error">ERR</option>
          <option value="admin">ADM</option>
          <option value="trace">TRC</option>
        </select>

        {uniqueCategories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-orange-500"
          >
            <option value="">CATEGORY: ALL</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
        )}

        {uniqueUsers.length > 0 && (
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-orange-500"
          >
            <option value="">USER: ALL</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        <input
          type="text"
          placeholder="SEARCH_MESSAGE..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest text-zinc-300 placeholder:text-zinc-700 px-2 py-1 w-44 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Log body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 font-label text-xs tracking-widest">
            <span className="material-symbols-outlined text-lg mr-2 text-zinc-800">inbox</span>
            NENHUM_LOG_ENCONTRADO
          </div>
        ) : (
          filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const severity = SEVERITY[entry.type] || SEVERITY.action;
            const typeColor = TYPE_COLORS[entry.type] || TYPE_COLORS.action;
            const typeIcon = TYPE_ICONS[entry.type] || TYPE_ICONS.action;

            return (
              <div key={entry.id} className="border-b border-zinc-900/40">
                {/* Main row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-zinc-800/20 transition-colors ${
                    entry.type === 'error' ? 'bg-red-950/5' : ''
                  }`}
                >
                  {/* Expand indicator */}
                  <span className={`material-symbols-outlined text-xs text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    chevron_right
                  </span>

                  {/* Severity */}
                  <span className={`text-[7px] font-label font-bold tracking-wider w-10 ${severity.color}`}>
                    {severity.label}
                  </span>

                  {/* Timestamp */}
                  <span className="text-[10px] font-mono text-zinc-600 shrink-0 w-28 tabular-nums">
                    {formatTimestamp(entry.timestamp)}
                  </span>

                  {/* Type badge */}
                  <span className={`text-[7px] font-label font-bold px-1.5 py-0.5 border rounded shrink-0 ${typeColor}`}>
                    <span className="material-symbols-outlined text-[8px] align-middle mr-0.5">{typeIcon}</span>
                    {entry.type.toUpperCase()}
                  </span>

                  {/* Source badge */}
                  <span className={`text-[7px] font-label font-bold px-1 py-0.5 border rounded shrink-0 ${
                    entry.source === 'admin' ? 'text-purple-400 border-purple-500/20' : 'text-zinc-500 border-zinc-700'
                  }`}>
                    {entry.source.toUpperCase()}
                  </span>

                  {/* Username */}
                  <span className="text-[10px] font-mono text-purple-300 font-bold shrink-0 truncate max-w-[90px]">
                    {entry.username || entry.uid?.slice(0, 8)}
                  </span>

                  {/* Message */}
                  <span className={`text-[10px] font-mono flex-1 truncate ${
                    entry.type === 'admin' ? 'text-purple-300 font-bold tracking-wide' : 
                    entry.type === 'trace' ? 'text-zinc-500 opacity-80' : 
                    entry.type === 'error' ? 'text-red-300' :
                    'text-zinc-300'
                  }`}>
                    {entry.message}
                  </span>

                  {/* Category */}
                  <span className="text-[7px] font-label text-zinc-700 tracking-wider shrink-0 uppercase">
                    {entry.category}
                  </span>
                </button>

                {/* Expanded metadata */}
                {isExpanded && (
                  <div className="px-12 py-3 bg-zinc-950/40 border-t border-zinc-800/30">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] font-mono mb-3">
                      <div>
                        <span className="text-zinc-600">UID: </span>
                        <span className="text-zinc-400">{entry.uid}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600">USERNAME: </span>
                        <span className="text-zinc-400">{entry.username}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600">CATEGORY: </span>
                        <span className="text-zinc-400">{entry.category}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600">SOURCE: </span>
                        <span className="text-zinc-400">{entry.source}</span>
                      </div>
                    </div>

                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div>
                        <p className="text-[8px] font-label text-zinc-600 uppercase tracking-widest mb-1">METADATA:</p>
                        <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 p-3 rounded overflow-x-auto max-h-40">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 shrink-0">
        <span className="text-[8px] font-label text-zinc-600 tracking-widest">
          MOSTRANDO {filtered.length} DE {entries.length} (LIMITE: {maxEntries})
        </span>
        <div className="flex gap-2">
          {[200, 500, 1000].map((n) => (
            <button
              key={n}
              onClick={() => setMaxEntries(n)}
              className={`px-2 py-0.5 text-[8px] font-label tracking-wider border transition-colors ${
                maxEntries === n
                  ? 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                  : 'text-zinc-600 border-zinc-800 hover:text-zinc-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
