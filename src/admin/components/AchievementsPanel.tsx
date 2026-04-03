import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, getDocs, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import type { Achievement } from '../../services/AchievementManager';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRow { uid: string; displayName: string; username?: string; achievementsRevealed?: boolean; }
interface UserAchievement { achievementId: string; unlockedAt?: any; }

// ── Sub-components ────────────────────────────────────────────────────────────

/** Single card for one achievement definition */
const AchCard: React.FC<{ ach: Achievement; count: number }> = ({ ach, count }) => (
  <div className="bg-surface-container-lowest border border-zinc-800 p-4 flex flex-col gap-3 machined-edge">
    <div className="flex items-start gap-3">
      <span className="text-2xl leading-none mt-0.5">{ach.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-headline text-sm font-bold text-zinc-200 truncate">{ach.title}</p>
        <p className="text-[10px] font-label text-zinc-500 mt-0.5">{ach.id}</p>
        <p className="text-[10px] font-body text-zinc-600 mt-1 leading-tight">{ach.description}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xl font-headline font-bold text-secondary">{count}</p>
        <p className="text-[9px] font-label text-zinc-600">players</p>
      </div>
    </div>
    <div className="bg-zinc-900/40 p-2 border border-zinc-800/50 mt-1">
      <p className="text-[8px] font-label text-secondary/80 uppercase tracking-widest mb-1">Condição de Desbloqueio</p>
      <p className="text-[10px] font-body text-zinc-400 leading-tight">{ach.unlockCondition}</p>
    </div>
  </div>
);

/** Row in the per-user achievement editor */
const UserAchRow: React.FC<{
  user: UserRow;
  userAchs: UserAchievement[];
  isSelected: boolean;
  onToggleSelect: (uid: string) => void;
  onGrant: (uid: string) => void;
  onRevoke: (uid: string, achId: string) => Promise<void>;
}> = ({
  user, userAchs, isSelected, onToggleSelect, onGrant, onRevoke,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-800 bg-surface-container-lowest machined-edge overflow-hidden">
      <div className="flex items-center w-full px-4 py-3 hover:bg-zinc-900/50 transition-colors">
        <input 
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(user.uid)}
          className="mr-3 accent-secondary h-4 w-4 bg-zinc-800 border-zinc-600 rounded"
        />
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <span className="material-symbols-outlined text-secondary text-base">person</span>
          <span className="font-headline text-sm text-zinc-200 flex-1">
            {user.displayName || user.username || user.uid}
            {user.achievementsRevealed && (
              <span className="ml-2 px-1.5 py-0.5 bg-green-900/30 text-green-400 border border-green-800/50 text-[8px] uppercase tracking-widest font-label rounded-sm align-middle">
                INFO LIBERADA
              </span>
            )}
          </span>
          <span className="text-[10px] font-label text-secondary">{userAchs.length} conquistas</span>
          <span className="material-symbols-outlined text-zinc-600 text-sm">{open ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
          {/* Granted list */}
          <div className="flex flex-wrap gap-2">
            {userAchs.length === 0 && (
              <span className="text-[10px] font-label text-zinc-600">Nenhuma conquista.</span>
            )}
            {userAchs.map(ua => {
              const def = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
              return (
                <div key={ua.achievementId} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-sm">
                  <span className="text-sm">{def?.icon ?? '🏅'}</span>
                  <span className="text-[10px] font-label text-zinc-300">{def?.title ?? ua.achievementId}</span>
                  {ua.unlockedAt?.toDate && (
                    <span className="text-[9px] text-zinc-600">{format(ua.unlockedAt.toDate(), 'dd/MM/yy')}</span>
                  )}
                  <button
                    onClick={() => onRevoke(user.uid, ua.achievementId)}
                    className="material-symbols-outlined text-xs text-zinc-600 hover:text-error transition-colors"
                  >close</button>
                </div>
              );
            })}
          </div>
          {/* Grant button */}
          <button
            onClick={() => onGrant(user.uid)}
            className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest text-secondary hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xs">add</span>
            Conceder conquista
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function AchievementsPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userAchs, setUserAchs] = useState<Record<string, UserAchievement[]>>({});
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Real-time user list
  useEffect(() => onSnapshot(collection(db, 'users'), snap => {
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserRow)));
  }), []);

  // Load achievements for all users once users list is ready
  const loadAllAchs = useCallback(async (uids: string[]) => {
    const results: Record<string, UserAchievement[]> = {};
    await Promise.all(uids.map(async uid => {
      const snap = await getDocs(collection(db, 'users', uid, 'achievements'));
      results[uid] = snap.docs.map(d => ({ achievementId: d.id, ...d.data() } as UserAchievement));
    }));
    setUserAchs(results);
  }, []);

  useEffect(() => { if (users.length) loadAllAchs(users.map(u => u.uid)); }, [users, loadAllAchs]);

  const handleGrant = async () => {
    if (!grantTarget || !selectedId) return;
    await setDoc(doc(db, 'users', grantTarget, 'achievements', selectedId), {
      achievementId: selectedId, unlockedAt: serverTimestamp(),
    });
    setGrantTarget(null);
    setSelectedId('');
    loadAllAchs(users.map(u => u.uid));
  };

  const handleRevoke = async (uid: string, achId: string) => {
    await deleteDoc(doc(db, 'users', uid, 'achievements', achId));
    loadAllAchs(users.map(u => u.uid));
  };

  // Stats: how many players have each achievement
  const achCounts = ALL_ACHIEVEMENTS.reduce<Record<string, number>>((acc, ach) => {
    acc[ach.id] = (Object.values(userAchs) as UserAchievement[][]).filter(list => list.some(a => a.achievementId === ach.id)).length;
    return acc;
  }, {});

  const totalUnlocked = (Object.values(userAchs) as UserAchievement[][]).reduce((sum, list) => sum + list.length, 0);
  const filteredUsers = users.filter(u =>
    (u.displayName || u.username || u.uid).toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleSelectUser = (uid: string) => {
    setSelectedUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.uid));
    }
  };

  const handleSetRevealed = async (revealed: boolean) => {
    if (selectedUsers.length === 0) return;
    await Promise.all(selectedUsers.map(uid => 
      updateDoc(doc(db, 'users', uid), { achievementsRevealed: revealed })
    ));
    setSelectedUsers([]);
  };

  return (
    <section className="space-y-8">
      {/* Header + stats */}
      <div className="flex items-center gap-6">
        <div className="w-2 h-6 bg-secondary shrink-0" />
        <div>
          <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Achievement_Control</h2>
          <p className="font-label text-[10px] text-zinc-500 tracking-wider">
            {ALL_ACHIEVEMENTS.length} TIPOS · {totalUnlocked} TOTAL DESBLOQUEADO
          </p>
        </div>
      </div>

      {/* Achievement catalog */}
      <div className="bg-surface border border-zinc-800">
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-sm">stars</span>
          <span className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Catálogo de Conquistas</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_ACHIEVEMENTS.map(ach => (
            <AchCard key={ach.id} ach={ach} count={achCounts[ach.id] ?? 0} />
          ))}
        </div>
      </div>

      {/* Per-user editor */}
      <div className="bg-surface border border-zinc-800">
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-sm">manage_accounts</span>
            <span className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Por Jogador</span>
          </div>
          
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-label text-[10px] text-secondary tracking-widest">{selectedUsers.length} SELECIONADOS</span>
              <button onClick={() => handleSetRevealed(true)} className="px-2 py-1 bg-green-900/50 hover:bg-green-800/80 border border-green-800 transition-colors text-[9px] font-label text-green-300 uppercase tracking-widest">
                Revelar Info
              </button>
              <button onClick={() => handleSetRevealed(false)} className="px-2 py-1 bg-red-900/50 hover:bg-red-800/80 border border-red-800 transition-colors text-[9px] font-label text-red-300 uppercase tracking-widest">
                Esconder Info
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="BUSCAR_AGENTE..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-container-lowest border-zinc-800 text-[10px] font-label uppercase tracking-widest w-48 text-zinc-300 px-3 py-1.5 focus:ring-1 focus:ring-secondary focus:outline-none placeholder:text-zinc-700"
          />
        </div>
        <div className="px-6 py-2 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2">
          <input 
            type="checkbox"
            checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length}
            onChange={handleSelectAll}
            className="accent-secondary h-4 w-4 bg-zinc-800 border-zinc-600 rounded"
          />
          <span className="font-label text-[9px] uppercase tracking-widest text-zinc-500 cursor-pointer" onClick={handleSelectAll}>
            Selecionar Todos ({filteredUsers.length})
          </span>
        </div>
        <div className="p-4 space-y-2">
          {filteredUsers.map(user => (
            <UserAchRow
              key={user.uid}
              user={user}
              userAchs={userAchs[user.uid] ?? []}
              isSelected={selectedUsers.includes(user.uid)}
              onToggleSelect={handleToggleSelectUser}
              onGrant={uid => { setGrantTarget(uid); setSelectedId(''); }}
              onRevoke={handleRevoke}
            />
          ))}
          {filteredUsers.length === 0 && (
            <p className="text-zinc-600 text-xs font-label tracking-widest py-4 text-center">NO_RECORDS_FOUND</p>
          )}
        </div>
      </div>

      {/* Grant Modal */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-secondary/30 p-6 w-full max-w-md machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-secondary text-xl">stars</span>
              <h3 className="font-headline text-lg text-zinc-200">CONCEDER_CONQUISTA</h3>
            </div>
            <p className="text-xs font-label text-zinc-500 mb-4">
              Jogador: <span className="text-zinc-300">{users.find(u => u.uid === grantTarget)?.displayName}</span>
            </p>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-3 text-sm focus:border-secondary outline-none mb-4"
            >
              <option value="">-- SELECIONAR_CONQUISTA --</option>
              {ALL_ACHIEVEMENTS
                .filter(a => !(userAchs[grantTarget] ?? []).some(ua => ua.achievementId === a.id))
                .map(a => (
                  <option key={a.id} value={a.id}>{a.icon} {a.title}</option>
                ))}
            </select>
            {selectedId && <p className="text-[9px] font-label text-zinc-600 mb-4">ID: {selectedId}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setGrantTarget(null)} className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 transition-colors">
                CANCELAR
              </button>
              <button onClick={handleGrant} disabled={!selectedId} className="px-4 py-2 text-xs font-label bg-secondary text-black font-bold tracking-wider hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed">
                CONCEDER
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
