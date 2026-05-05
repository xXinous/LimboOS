import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, getDocs, setDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import { userService } from '../../services/UserService';
import type { Achievement } from '../../services/AchievementManager';
import type { CharacterData } from '../../types/player';
import Screw from '../../components/player/Screw';

interface UserRow { uid: string; displayName: string; username?: string; email: string; }
interface UserAchievement { achievementId: string; unlockedAt?: any; }

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
    (u.displayName || u.username || u.email || u.uid || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="space-y-8 font-chakra">
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-secondary rounded-full animate-pulse shadow-[0_0_10px_rgba(198,198,198,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">Interface_de_Gestão_de_Conquistas</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Search */}
        <div className="lg:col-span-1 bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col h-[550px] shadow-2xl overflow-hidden">
          <div className="p-4 border-b-4 border-[#1a1a1a] bg-black/40">
             <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-xs">search</span>
                <input type="text" placeholder="FILTRAR_USUÁRIO..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/5 text-[10px] font-black uppercase pl-10 pr-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-secondary transition-all" />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20">
            {filteredUsers.map(u => (
              <button key={u.uid} onClick={() => handleSelectUser(u)} className={`w-full text-left px-5 py-4 border-b border-white/5 transition-all group ${selectedUser?.uid === u.uid ? 'bg-secondary/10 border-l-4 border-l-secondary' : 'hover:bg-white/5'}`}>
                <p className={`font-black text-xs uppercase truncate ${selectedUser?.uid === u.uid ? 'text-secondary' : 'text-zinc-400 group-hover:text-white'}`}>{u.displayName || u.email?.split('@')[0] || "NULL_USER"}</p>
                <p className="text-[9px] font-mono text-zinc-700 font-bold truncate mt-1 tracking-widest uppercase">{u.email || "OFFLINE_RECORD"}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Character Selection */}
        <div className="lg:col-span-1 bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col h-[550px] shadow-2xl overflow-hidden">
           <div className="p-4 border-b-4 border-[#1a1a1a] bg-black/40">
             <p className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">Identidades_Vinculadas</p>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20">
             {!selectedUser ? (
                <div className="p-12 text-center opacity-20">
                   <p className="text-[9px] font-black uppercase tracking-widest">Selecione_Canal</p>
                </div>
             ) : characters.map(c => (
                <button key={c.id} onClick={() => handleSelectChar(selectedUser.uid, c)} className={`w-full text-left px-6 py-5 border-b border-white/5 transition-all group ${selectedChar?.id === c.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-white/5'}`}>
                  <p className={`font-black text-xs uppercase ${selectedChar?.id === c.id ? 'text-primary' : 'text-zinc-400 group-hover:text-white'}`}>{c.codinome}</p>
                  <p className="text-[8px] font-mono text-zinc-700 font-bold uppercase mt-1 tracking-widest">ID: {c.id.slice(0,8)}</p>
                </button>
             ))}
           </div>
        </div>

        {/* Achievements View */}
        <div className="lg:col-span-2 flex flex-col h-[550px] gap-6">
          {!selectedChar ? (
            <div className="flex-1 bg-black/20 border-4 border-dashed border-[#1a1a1a] rounded-xl flex flex-col items-center justify-center opacity-20">
               <span className="material-symbols-outlined text-6xl mb-4">workspace_premium</span>
               <p className="text-[11px] font-black uppercase tracking-[0.4em]">Selecione_Agente</p>
            </div>
          ) : (
            <div className="flex-1 bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col overflow-hidden shadow-2xl relative">
              <div className="p-6 border-b-4 border-[#1a1a1a] flex justify-between items-center bg-black/40">
                <div>
                   <h3 className="font-black text-sm text-white uppercase tracking-wider">{selectedChar.codinome}</h3>
                   <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Medalhas e Honrarias_de_Campo</p>
                </div>
                <button onClick={() => setGrantTarget(true)} className="bg-secondary text-black px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-white transition-all active:scale-95 uppercase flex items-center gap-2">
                   <span className="material-symbols-outlined text-sm">military_tech</span> CONCEDER
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-black/20">
                {charAchs.length === 0 && (
                   <div className="p-24 text-center opacity-20">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhuma_Honraria_Detectada</p>
                   </div>
                )}
                {charAchs.map(ua => {
                   const def = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
                   return (
                     <div key={ua.achievementId} className="flex items-center justify-between p-4 bg-black border-2 border-[#1a1a1a] group hover:border-secondary/20 transition-all rounded-sm shadow-lg">
                       <div className="flex items-center gap-4">
                         <span className="text-3xl grayscale group-hover:grayscale-0 transition-all duration-500">{def?.icon || '🏅'}</span>
                         <div>
                           <p className="text-xs font-black text-zinc-300 uppercase tracking-tight group-hover:text-white transition-colors">{def?.title || ua.achievementId}</p>
                           <p className="text-[9px] font-mono text-zinc-700 font-bold uppercase mt-1 tracking-widest">SINC: {ua.unlockedAt?.toDate ? format(ua.unlockedAt.toDate(), 'dd/MM/yy HH:mm') : '---'}</p>
                         </div>
                       </div>
                       <button onClick={() => handleRevoke(ua.achievementId)} className="w-10 h-10 flex items-center justify-center text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100 material-symbols-outlined">delete</button>
                     </div>
                   );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {grantTarget && selectedChar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] p-10 w-full max-w-md rounded-[32px] shadow-2xl relative overflow-hidden flex flex-col">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
             <h3 className="font-black text-xl text-white uppercase tracking-widest mb-8 border-b-4 border-[#1a1a1a] pb-6 relative z-10">Liberar_Honraria</h3>
             
             <div className="space-y-6 relative z-10 mb-10">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Selecione_Medalha_para_Sincronização:</p>
                <select value={selectedAchId} onChange={e => setSelectedAchId(e.target.value)} className="w-full bg-black/60 border-2 border-[#1a1a1a] text-primary text-[10px] font-black px-4 py-4 outline-none focus:border-secondary uppercase rounded-sm">
                   <option value="">-- SELECIONAR_CONQUISTA --</option>
                   {ALL_ACHIEVEMENTS.filter(a => !charAchs.some(ua => ua.achievementId === a.id)).map(a => (
                      <option key={a.id} value={a.id}>{a.icon} {a.title.toUpperCase()}</option>
                   ))}
                </select>
             </div>

             <div className="flex justify-end gap-6 relative z-10">
                <button onClick={() => setGrantTarget(false)} className="px-6 py-2 text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">ABORTAR</button>
                <button onClick={handleGrant} disabled={!selectedAchId} className="bg-secondary hover:bg-white text-black px-10 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 shadow-lg">CONFIRMAR_INJEÇÃO</button>
             </div>
          </div>
        </div>
      )}
    </section>
  );
}
