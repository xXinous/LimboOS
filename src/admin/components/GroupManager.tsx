import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Group, UserData } from '../../types/player';
import { Campaign } from '../../data/campaigns';
import { groupService } from '../../services/GroupService';
import { userService } from '../../services/UserService';
import { activityLogger } from '../../services/ActivityLogger';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useModal } from './ConfirmModal';
import Screw from '../../components/player/Screw';

interface GroupManagerProps {
  isAdmin: boolean;
}

export default function GroupManager({ isAdmin }: GroupManagerProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const { showConfirm, modal } = useModal();
  
  // Form State
  const [groupName, setGroupName] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessions, setSessions] = useState<string[]>([]);

  useEffect(() => {
    const unsubGroups = groupService.subscribeToGroups(setGroups);
    const unsubUsers = userService.subscribeToUsers(setUsers);
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list: Campaign[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Campaign));
      setCampaigns(list);
    });

    return () => {
      unsubGroups();
      unsubUsers();
      unsubCampaigns();
    };
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedPlayers.length === 0) return;

    try {
      await groupService.createGroup(groupName, selectedPlayers, sessions);
      activityLogger.logAdmin('gm.mpg', 'group_created', `Grupo criado: ${groupName}`, { players: selectedPlayers.length });
      resetForm();
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !groupName.trim()) return;

    try {
      await groupService.updateGroup(editingGroup.id, {
        name: groupName,
        playerUids: selectedPlayers,
        campaignId: selectedCampaign,
        sessions: sessions
      });
      activityLogger.logAdmin('gm.mpg', 'group_updated', `Grupo atualizado: ${groupName}`);
      resetForm();
    } catch (error) {
      console.error("Erro ao atualizar grupo:", error);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const ok = await showConfirm('Excluir Grupo', "Tem certeza que deseja excluir este esquadrão PERMANENTEMENTE?", 'Excluir');
    if (!ok) return;
    try {
      await groupService.deleteGroup(id);
      activityLogger.logAdmin('gm.mpg', 'group_deleted', `Grupo excluído: ${id}`);
    } catch (error) {
      console.error("Erro ao excluir grupo:", error);
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingGroup(null);
    setGroupName("");
    setSelectedPlayers([]);
    setSelectedCampaign("");
    setSessions([]);
    setSessionDate("");
  };

  const startEdit = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedPlayers(group.playerUids);
    setSelectedCampaign(group.campaignId || "");
    setSessions(group.sessions || []);
    setIsCreating(true);
  };

  const addSession = () => {
    if (!sessionDate || sessions.includes(sessionDate)) return;
    setSessions([...sessions, sessionDate].sort());
    setSessionDate("");
  };

  const removeSession = (date: string) => {
    setSessions(sessions.filter(s => s !== date));
  };

  const togglePlayer = (uid: string) => {
    setSelectedPlayers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div className="space-y-8 font-chakra">
      {/* Cabeçalho de Grupos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
           <h3 className="text-zinc-600 font-black text-[10px] uppercase tracking-[0.3em]">Gerenciamento_de_Esquadrões_RPG</h3>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary px-6 py-2 rounded-sm font-black text-[10px] tracking-widest border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 glow-orange uppercase"
          >
            <span className="material-symbols-outlined text-sm">group_add</span>
            NOVO_ESQUADRÃO
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-8 rounded-xl shadow-2xl relative overflow-hidden">
          <div className="noise-overlay" /><div className="scanlines" />
          <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Coluna 1: Info Básica */}
              <div className="space-y-6">
                <div>
                  <label className="block font-black text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Identificador_do_Grupo (Mesa)</label>
                  <input 
                    type="text" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="EX: NÉVOA_DE_RAVENLOFT"
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block font-black text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Nó_de_Missão_Vinculado</label>
                  <select 
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-primary text-[10px] font-black px-4 py-3 outline-none focus:border-primary uppercase rounded-sm transition-all"
                  >
                    <option value="">-- SEM_VÍNCULO_DIRETO --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <label className="block font-black text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Registros_de_Sessão</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="date" 
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="flex-1 bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[10px] font-bold focus:border-primary outline-none rounded-sm"
                    />
                    <button 
                      type="button"
                      onClick={addSession}
                      className="bg-[#333] hover:bg-[#444] text-white px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm"
                    >
                      ADD_DATA
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px] bg-black/40 p-3 rounded-sm border border-[#1a1a1a]">
                    {sessions.map(date => (
                      <span key={date} className="bg-black border border-white/10 text-primary px-3 py-1.5 rounded-sm text-[9px] font-mono font-black flex items-center gap-3 shadow-lg">
                        {date}
                        <button type="button" onClick={() => removeSession(date)} className="text-zinc-600 hover:text-red-500 transition-colors">×</button>
                      </span>
                    ))}
                    {sessions.length === 0 && <p className="text-zinc-800 text-[9px] font-black uppercase tracking-widest italic pt-1">Nenhum Registro Temporal</p>}
                  </div>
                </div>
              </div>

              {/* Coluna 2: Seleção de Jogadores */}
              <div>
                <label className="block font-black text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Vincular_Agentes_ao_Vetor ({selectedPlayers.length})</label>
                <div className="bg-black/60 border-2 border-[#1a1a1a] h-72 overflow-y-auto p-3 space-y-1 custom-scrollbar rounded-sm">
                  {users.filter(u => u.role !== 'admin').map(user => (
                    <button
                      key={user.uid}
                      type="button"
                      onClick={() => togglePlayer(user.uid)}
                      className={`w-full flex items-center justify-between p-3 text-left transition-all border-2 rounded-sm group ${
                        selectedPlayers.includes(user.uid) 
                          ? 'bg-primary/5 border-primary/30 text-primary shadow-inner' 
                          : 'bg-transparent border-transparent text-zinc-700 hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0">
                         <p className={`font-black text-[11px] uppercase truncate ${selectedPlayers.includes(user.uid) ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                           {user.displayName || user.username || user.email?.split('@')[0]}
                         </p>
                         <p className="text-[8px] font-mono text-zinc-800 font-bold uppercase tracking-tighter mt-0.5">UID: {user.uid.slice(0,12)}</p>
                      </div>
                      <div className={`w-4 h-4 border-2 rounded-sm transition-all flex items-center justify-center ${selectedPlayers.includes(user.uid) ? 'bg-primary border-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'border-zinc-900 group-hover:border-zinc-700'}`}>
                         {selectedPlayers.includes(user.uid) && <span className="material-symbols-outlined text-black text-[12px] font-black">check</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-6 pt-8 border-t-4 border-[#1a1a1a]">
              <button type="button" onClick={resetForm} className="px-8 py-3 text-[10px] font-black text-zinc-600 hover:text-white uppercase tracking-widest transition-colors">ABORTAR</button>
              <button 
                type="submit" 
                className="bg-primary hover:bg-primary-container text-black px-12 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg"
              >
                {editingGroup ? 'SINCRONIZAR_ALTERAÇÕES' : 'CONFIRMAR_REGISTRO'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <div key={group.id} className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-6 group hover:border-primary/20 transition-all rounded-xl shadow-xl relative overflow-hidden active:scale-[0.99]">
              <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rotate-45 translate-x-6 -translate-y-6 border-b border-primary/10" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-black text-white text-base uppercase tracking-tighter group-hover:text-primary transition-colors">{group.name}</h4>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-sm border border-white/5 shadow-inner">
                       <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                       <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                         {group.playerUids.length} ATIVOS
                       </p>
                    </div>
                    {group.campaignId && (
                      <span className="text-[8px] font-black bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                        {campaigns.find(c => c.id === group.campaignId)?.name || group.campaignId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => startEdit(group)} className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-zinc-600 hover:text-emerald-400 transition-all active:scale-90"><span className="material-symbols-outlined text-sm">edit</span></button>
                  <button onClick={() => handleDeleteGroup(group.id)} className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-zinc-600 hover:text-red-500 transition-all active:scale-90"><span className="material-symbols-outlined text-sm">delete</span></button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {group.sessions?.slice(0, 4).map(date => (
                    <span key={date} className="text-[8px] font-mono bg-black text-zinc-600 px-2 py-1 rounded-sm border border-white/5 font-bold tracking-widest uppercase shadow-sm">
                      {date}
                    </span>
                  ))}
                  {group.sessions?.length > 4 && <span className="text-[8px] font-black text-zinc-800 self-center">+{group.sessions.length - 4}</span>}
                </div>
                
                <div className="flex -space-x-3 pt-2">
                  {group.playerUids.slice(0, 6).map(uid => {
                    const player = users.find(u => u.uid === uid);
                    const label = (player?.displayName || player?.username || 'A').charAt(0).toUpperCase();
                    return (
                      <div key={uid} className="w-8 h-8 rounded-full bg-black border-2 border-[#1a1a1a] flex items-center justify-center text-[10px] font-black text-primary shadow-lg ring-2 ring-black/40" title={player?.displayName || 'Agente'}>
                        {label}
                      </div>
                    );
                  })}
                  {group.playerUids.length > 6 && (
                    <div className="w-8 h-8 rounded-full bg-[#333] border-2 border-[#1a1a1a] flex items-center justify-center text-[9px] font-black text-zinc-500 shadow-lg">
                       +{group.playerUids.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full py-24 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-zinc-800 mb-4">groups_2</span>
              <p className="text-zinc-700 font-black text-sm uppercase tracking-[0.4em]">Nenhum_Esquadrão_Sincronizado</p>
            </div>
          )}
        </div>
      )}
      {modal}
    </div>
  );
}
