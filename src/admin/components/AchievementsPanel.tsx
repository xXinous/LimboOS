import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, getDocs, setDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import { userService } from '../../services/UserService';
import type { Achievement } from '../../services/AchievementManager';
import type { CharacterData } from '../../types/player';

interface UserRow { uid: string; displayName: string; username?: string; email: string; }
interface UserAchievement { achievementId: string; unlockedAt?: any; }

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
        <p className="text-[9px] font-label text-zinc-600">agentes</p>
      </div>
    </div>
  </div>
);

export default function AchievementsPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharacterData | null>(null);
  const [charAchs, setCharAchs] = useState<UserAchievement[]>([]);
  const [search, setSearch] = useState('');
  const [grantTarget, setGrantTarget] = useState<boolean>(false);
  const [selectedAchId, setSelectedAchId] = useState('');

  useEffect(() => onSnapshot(collection(db, 'users'), snap => {
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserRow)));
  }), []);

  const handleSelectUser = async (user: UserRow) => {
    setSelectedUser(user);
    setSelectedChar(null);
    setCharAchs([]);
    const chars = await userService.fetchCharactersForUser(user.uid);
    setCharacters(chars);
  };

  const handleSelectChar = async (uid: string, char: CharacterData) => {
    setSelectedChar(char);
    const snap = await getDocs(collection(db, 'users', uid, 'characters', char.id, 'achievements'));
    setCharAchs(snap.docs.map(d => ({ achievementId: d.id, ...d.data() } as UserAchievement)));
  };

  const handleGrant = async () => {
    if (!selectedUser || !selectedChar || !selectedAchId) return;
    await setDoc(doc(db, 'users', selectedUser.uid, 'characters', selectedChar.id, 'achievements', selectedAchId), {
      achievementId: selectedAchId, unlockedAt: serverTimestamp(),
    });
    setGrantTarget(false);
    setSelectedAchId('');
    handleSelectChar(selectedUser.uid, selectedChar);
  };

  const handleRevoke = async (achId: string) => {
    if (!selectedUser || !selectedChar) return;
    await deleteDoc(doc(db, 'users', selectedUser.uid, 'characters', selectedChar.id, 'achievements', achId));
    handleSelectChar(selectedUser.uid, selectedChar);
  };

  const filteredUsers = users.filter(u =>
    (u.displayName || u.username || u.email || u.uid).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-2 h-6 bg-secondary" />
        <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Controle_de_Conquistas</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Search */}
        <div className="lg:col-span-1 bg-surface-container-lowest border border-zinc-800 flex flex-col h-[500px] machined-edge">
          <div className="p-4 border-b border-zinc-800">
            <input type="text" placeholder="BUSCAR_AGENTE..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase px-3 py-2 text-zinc-300" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map(u => (
              <button key={u.uid} onClick={() => handleSelectUser(u)} className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 ${selectedUser?.uid === u.uid ? 'bg-secondary/10 border-l-4 border-l-secondary' : ''}`}>
                <p className="font-headline text-xs font-bold text-zinc-200 truncate">{u.displayName || u.email}</p>
                <p className="text-[9px] font-label text-zinc-600 truncate">{u.email}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Character Selection */}
        <div className="lg:col-span-1 bg-surface-container-lowest border border-zinc-800 flex flex-col h-[500px] machined-edge">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
             <p className="text-[10px] font-label uppercase text-zinc-500">Agentes Ativos</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedUser ? (
               <p className="p-6 text-center text-[10px] text-zinc-700 uppercase">Selecione usuário</p>
            ) : characters.map(c => (
               <button key={c.id} onClick={() => handleSelectChar(selectedUser.uid, c)} className={`w-full text-left px-4 py-4 border-b border-zinc-800/50 ${selectedChar?.id === c.id ? 'bg-orange-500/10 border-l-4 border-l-orange-500' : ''}`}>
                 <p className="font-headline text-xs font-bold text-zinc-200">{c.codinome}</p>
               </button>
            ))}
          </div>
        </div>

        {/* Achievements View */}
        <div className="lg:col-span-2 flex flex-col h-[500px] gap-4">
          {!selectedChar ? (
            <div className="flex-1 bg-surface-container-lowest border border-zinc-800 machined-edge flex items-center justify-center">
              <p className="font-label text-xs uppercase text-zinc-600">Selecione um agente</p>
            </div>
          ) : (
            <div className="flex-1 bg-surface-container-lowest border border-zinc-800 machined-edge flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
                <h3 className="font-headline font-bold text-zinc-100 uppercase">{selectedChar.codinome} // Conquistas</h3>
                <button onClick={() => setGrantTarget(true)} className="text-secondary border border-secondary/30 px-3 py-1 text-[10px] font-bold uppercase">Conceder</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {charAchs.map(ua => {
                   const def = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
                   return (
                     <div key={ua.achievementId} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800">
                       <div className="flex items-center gap-3">
                         <span className="text-xl">{def?.icon || '🏅'}</span>
                         <div>
                           <p className="text-xs font-bold text-zinc-200">{def?.title || ua.achievementId}</p>
                           <p className="text-[9px] text-zinc-600 uppercase">{ua.unlockedAt?.toDate ? format(ua.unlockedAt.toDate(), 'dd/MM/yy HH:mm') : ''}</p>
                         </div>
                       </div>
                       <button onClick={() => handleRevoke(ua.achievementId)} className="material-symbols-outlined text-sm text-zinc-700 hover:text-red-500">delete</button>
                     </div>
                   );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {grantTarget && selectedChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-secondary/30 p-6 w-full max-w-md machined-edge">
             <h3 className="font-headline text-lg text-zinc-200 mb-4">CONCEDER_CONQUISTA</h3>
             <select value={selectedAchId} onChange={e => setSelectedAchId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-3 text-sm mb-6">
                <option value="">-- SELECIONAR --</option>
                {ALL_ACHIEVEMENTS.filter(a => !charAchs.some(ua => ua.achievementId === a.id)).map(a => (
                   <option key={a.id} value={a.id}>{a.icon} {a.title}</option>
                ))}
             </select>
             <div className="flex justify-end gap-3">
                <button onClick={() => setGrantTarget(false)} className="text-[10px] font-label text-zinc-500 uppercase">Cancelar</button>
                <button onClick={handleGrant} disabled={!selectedAchId} className="bg-secondary text-black px-6 py-2 text-[10px] font-bold uppercase">Confirmar</button>
             </div>
          </div>
        </div>
      )}
    </section>
  );
}
