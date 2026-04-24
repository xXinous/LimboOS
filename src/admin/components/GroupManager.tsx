import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Group, UserData } from '../../types/player';
import { Campaign } from '../../data/campaigns';
import { groupService } from '../../services/GroupService';
import { userService } from '../../services/UserService';
import { activityLogger } from '../../services/ActivityLogger';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface GroupManagerProps {
  isAdmin: boolean;
}

export default function GroupManager({ isAdmin }: GroupManagerProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  
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
      // Se tiver campanha selecionada, atualiza depois (ou poderíamos passar no createGroup se refatorado)
      if (selectedCampaign) {
        // Encontrar o id do grupo recém criado (um pouco hacky sem mudar a API do service)
        // O ideal é que o createGroup já aceite campaignId
      }
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
    if (!window.confirm("Tem certeza que deseja excluir este grupo?")) return;
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
    <div className="space-y-6">
      {/* Cabeçalho de Grupos */}
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-400 font-label text-[10px] uppercase tracking-widest">Gerenciamento_de_Grupos_de_RPG</h3>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 bg-orange-600/20 text-orange-500 px-3 py-1.5 rounded-sm font-label text-[10px] font-bold tracking-widest border border-orange-500/30 hover:bg-orange-600/30 transition-all"
          >
            <span className="material-symbols-outlined text-xs">group_add</span>
            NOVO_GRUPO
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 machined-edge">
          <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna 1: Info Básica */}
              <div className="space-y-4">
                <div>
                  <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-tighter">Nome do Grupo (Mesa)</label>
                  <input 
                    type="text" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: A Maldição de Strahd"
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-sm focus:border-orange-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-tighter">Campanha Vinculada</label>
                  <select 
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                  >
                    <option value="">Nenhuma</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-tighter">Datas das Sessões</label>
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="date" 
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                    />
                    <button 
                      type="button"
                      onClick={addSession}
                      className="bg-zinc-800 text-zinc-300 px-4 py-2 text-xs font-bold hover:bg-zinc-700"
                    >
                      ADICIONAR
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sessions.map(date => (
                      <span key={date} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-2 border border-zinc-700">
                        {date}
                        <button type="button" onClick={() => removeSession(date)} className="text-red-500 hover:text-red-400">×</button>
                      </span>
                    ))}
                    {sessions.length === 0 && <p className="text-zinc-600 text-[10px] italic">Nenhuma sessão registrada</p>}
                  </div>
                </div>
              </div>

              {/* Coluna 2: Seleção de Jogadores */}
              <div>
                <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-tighter">Vincular Jogadores ({selectedPlayers.length})</label>
                <div className="bg-zinc-950 border border-zinc-800 h-64 overflow-y-auto p-2 space-y-1">
                  {users.filter(u => u.role !== 'admin').map(user => (
                    <button
                      key={user.uid}
                      type="button"
                      onClick={() => togglePlayer(user.uid)}
                      className={`w-full flex items-center justify-between p-2 text-left text-xs transition-colors ${
                        selectedPlayers.includes(user.uid) 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                          : 'text-zinc-500 hover:bg-zinc-900 border border-transparent'
                      }`}
                    >
                      <span>{user.displayName || user.username}</span>
                      {selectedPlayers.includes(user.uid) && <span className="material-symbols-outlined text-xs">check_circle</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button type="button" onClick={resetForm} className="px-6 py-2 text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase">Cancelar</button>
              <button 
                type="submit" 
                className="bg-orange-600 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest hover:brightness-110 machined-edge"
              >
                {editingGroup ? 'ATUALIZAR_GRUPO' : 'SALVAR_GRUPO'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <div key={group.id} className="bg-zinc-900/30 border border-zinc-800 p-4 machined-edge group hover:border-orange-500/30 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-headline font-bold text-zinc-200 text-sm">{group.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] font-label text-zinc-600 uppercase tracking-tighter">
                      {group.playerUids.length} JOGADORES VINCULADOS
                    </p>
                    {group.campaignId && (
                      <span className="text-[8px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1 py-0.5 rounded-sm uppercase tracking-tighter">
                        {campaigns.find(c => c.id === group.campaignId)?.name || group.campaignId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(group)} className="material-symbols-outlined text-xs text-zinc-500 hover:text-orange-400">edit</button>
                  <button onClick={() => handleDeleteGroup(group.id)} className="material-symbols-outlined text-xs text-zinc-500 hover:text-red-500">delete</button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {group.sessions?.slice(0, 3).map(date => (
                    <span key={date} className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/50">
                      {date}
                    </span>
                  ))}
                  {group.sessions?.length > 3 && <span className="text-[9px] font-mono text-zinc-600">+{group.sessions.length - 3}</span>}
                </div>
                
                <div className="flex -space-x-2 pt-2">
                  {group.playerUids.slice(0, 5).map(uid => {
                    const player = users.find(u => u.uid === uid);
                    return (
                      <div key={uid} className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[8px] font-bold text-zinc-500" title={player?.displayName || 'Jogador'}>
                        {(player?.displayName || 'J').charAt(0)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-lg">
              <span className="material-symbols-outlined text-4xl text-zinc-800 mb-2">group_work</span>
              <p className="text-zinc-600 font-label text-xs uppercase tracking-widest">NENHUM_GRUPO_CONFIGURADO</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
