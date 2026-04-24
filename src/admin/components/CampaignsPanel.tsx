import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { Campaign, campaigns as initialCampaigns } from '../../data/campaigns';
import { Group, UserData } from '../../types/player';
import { activityLogger } from '../../services/ActivityLogger';
import { useModal } from './ConfirmModal';
import { EVIDENCE_TAPES_FOR_ADMIN } from '../../data/tapes';

export default function CampaignsPanel() {
  const { showAlert, modal } = useModal();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [persistentItems, setPersistentItems] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);

  // Stats for persistent items modal
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list: Campaign[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Campaign));
      
      // Se estiver vazio no banco, inicializa com os dados do arquivo (opcional, mas bom para primeiro uso)
      if (list.length === 0 && initialCampaigns.length > 0) {
        initializeCampaignsFromData();
      }
      
      setCampaigns(list);
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, 'system', 'campaignSettings'), (snap) => {
      if (snap.exists()) {
        setPersistentItems(snap.data().persistentItemIds || []);
      }
    });

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      const list: Group[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Group));
      setGroups(list);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserData[] = [];
      snap.forEach(d => list.push(d.data() as UserData));
      setUsers(list);
    });

    return () => {
      unsubCampaigns();
      unsubSettings();
      unsubGroups();
      unsubUsers();
    };
  }, []);

  const initializeCampaignsFromData = async () => {
    const batch = writeBatch(db);
    initialCampaigns.forEach(c => {
      batch.set(doc(db, 'campaigns', c.id), c);
    });
    await batch.commit();
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign?.name || !editingCampaign?.id) return;

    try {
      await setDoc(doc(db, 'campaigns', editingCampaign.id), {
        ...editingCampaign,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      activityLogger.logAdmin('gm.mpg', 'campaign_saved', `Campanha salva: ${editingCampaign.name}`);
      setIsEditing(false);
      setEditingCampaign(null);
    } catch (error) {
      console.error("Erro ao salvar campanha:", error);
      showAlert("Erro", "Não foi possível salvar a campanha.");
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar esta missão?")) return;
    
    try {
      await deleteDoc(doc(db, 'campaigns', id));
      activityLogger.logAdmin('gm.mpg', 'campaign_deleted', `Campanha removida: ${id}`);
    } catch (error) {
      console.error("Erro ao deletar campanha:", error);
      showAlert("Erro", "Falha ao remover campanha.");
    }
  };

  const togglePersistentItem = async (itemId: string) => {
    const newList = persistentItems.includes(itemId)
      ? persistentItems.filter(id => id !== itemId)
      : [...persistentItems, itemId];
    
    try {
      await setDoc(doc(db, 'system', 'campaignSettings'), {
        persistentItemIds: newList
      }, { merge: true });
      setPersistentItems(newList);
    } catch (error) {
      console.error("Erro ao atualizar itens persistentes:", error);
    }
  };

  const handleAssignToCampaign = async (targetId: string, campaignId: string, type: 'user' | 'group') => {
    try {
      if (type === 'user') {
        await updateDoc(doc(db, 'users', targetId), { campaignId });
        activityLogger.logAdmin('gm.mpg', 'user_assigned', `Usuário atribuído à campanha: ${campaignId}`, { uid: targetId });
      } else {
        const group = groups.find(g => g.id === targetId);
        if (!group) return;
        
        const batch = writeBatch(db);
        batch.update(doc(db, 'groups', targetId), { campaignId });
        
        group.playerUids.forEach(uid => {
          batch.update(doc(db, 'users', uid), { campaignId });
        });
        
        await batch.commit();
        activityLogger.logAdmin('gm.mpg', 'group_assigned', `Grupo atribuído à campanha: ${campaignId}`, { groupId: targetId });
      }
      showAlert("Sucesso", "Atribuição concluída.");
    } catch (error) {
      console.error("Erro na atribuição:", error);
      showAlert("Erro", "Falha na atribuição.");
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">CARREGANDO_MISSOES...</div>;

  return (
    <div className="space-y-8">
      {modal}
      
      {/* Header e Ações Globais */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-6 bg-orange-500" />
          <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Central_de_Comando_de_Missões</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowItemsModal(true)}
            className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-4 py-2 font-label text-[10px] font-bold tracking-widest hover:bg-zinc-700 transition-all border border-zinc-700 machined-edge"
          >
            <span className="material-symbols-outlined text-sm">inventory_2</span>
            ITENS_PERSISTENTES
          </button>
          <button 
            onClick={() => {
              setEditingCampaign({
                id: `new-mission-${Date.now()}`,
                name: '',
                description: '',
                location: '',
                year: '2099',
                visualTheme: 'default',
                rpgSystem: 'Cyberpunk Red',
                status: 'Ativa',
                imageUrl: ''
              });
              setIsEditing(true);
            }}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 font-label text-[10px] font-bold tracking-widest hover:bg-orange-500 transition-all machined-edge shadow-[0_4px_0_#9a3412]"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            CRIAR_MISSÃO
          </button>
        </div>
      </div>

      {/* Grid de Campanhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="bg-surface-container-lowest border border-zinc-800 machined-edge overflow-hidden group">
            <div className="h-32 bg-zinc-900 relative">
              {campaign.imageUrl ? (
                <img src={campaign.imageUrl} alt={campaign.name} className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-800">
                  <span className="material-symbols-outlined text-4xl">map</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <h3 className="font-headline font-bold text-lg text-white">{campaign.name}</h3>
                <p className="text-[10px] font-label text-orange-500 uppercase tracking-widest">{campaign.rpgSystem}</p>
              </div>
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingCampaign(campaign); setIsEditing(true); }}
                  className="w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button 
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-[10px] text-zinc-500 italic line-clamp-2">{campaign.description}</p>
              
              <div className="flex items-center justify-between text-[9px] font-label text-zinc-600 uppercase border-t border-zinc-800/50 pt-4">
                <span>{campaign.location}</span>
                <span>{campaign.year}</span>
                <span className={`px-2 py-0.5 rounded-full border ${
                  campaign.status === 'Ativa' ? 'border-emerald-500/30 text-emerald-500' : 
                  campaign.status === 'Bloqueada' ? 'border-red-500/30 text-red-500' : 'border-zinc-700 text-zinc-500'
                }`}>
                  {campaign.status}
                </span>
              </div>

              {/* Gerenciamento de Membros */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-label text-zinc-500 uppercase tracking-widest">Atribuir_Membros</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[8px] text-zinc-600 uppercase">Grupos</p>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-400 p-1.5 outline-none"
                      onChange={(e) => e.target.value && handleAssignToCampaign(e.target.value, campaign.id, 'group')}
                      value=""
                    >
                      <option value="">Selecionar Grupo...</option>
                      {groups.filter(g => g.campaignId !== campaign.id).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] text-zinc-600 uppercase">Jogadores</p>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-400 p-1.5 outline-none"
                      onChange={(e) => e.target.value && handleAssignToCampaign(e.target.value, campaign.id, 'user')}
                      value=""
                    >
                      <option value="">Selecionar Jogador...</option>
                      {users.filter(u => u.role !== 'admin' && u.campaignId !== campaign.id).map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName || u.username}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lista de Membros Atuais */}
                <div className="flex flex-wrap gap-1 pt-2">
                  {groups.filter(g => g.campaignId === campaign.id).map(g => (
                    <span key={g.id} className="text-[8px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-sm">
                      GRP: {g.name}
                    </span>
                  ))}
                  {users.filter(u => u.campaignId === campaign.id && !groups.some(g => g.campaignId === campaign.id && g.playerUids.includes(u.uid))).map(u => (
                    <span key={u.uid} className="text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded-sm">
                      USR: {u.displayName || u.username}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Edição de Campanha */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl machined-edge overflow-hidden">
            <div className="bg-orange-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-headline font-bold uppercase tracking-widest">Configurar_Instância_de_Missão</h3>
              <button onClick={() => { setIsEditing(false); setEditingCampaign(null); }} className="text-white/70 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveCampaign} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">ID da Missão (Slug)</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.id || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, id: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                      placeholder="ex: neo-sampa-2099"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Nome da Campanha</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.name || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, name: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Sistema de RPG</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.rpgSystem || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, rpgSystem: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Ano</label>
                      <input 
                        type="text" 
                        value={editingCampaign?.year || ''}
                        onChange={e => setEditingCampaign({...editingCampaign, year: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Status</label>
                      <select 
                        value={editingCampaign?.status || 'Ativa'}
                        onChange={e => setEditingCampaign({...editingCampaign, status: e.target.value as any})}
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                      >
                        <option value="Ativa">Ativa</option>
                        <option value="Arquivada">Arquivada</option>
                        <option value="Bloqueada">Bloqueada</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Descrição Curta</label>
                    <textarea 
                      value={editingCampaign?.description || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, description: e.target.value})}
                      className="w-full h-24 bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Localização</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.location || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, location: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">URL da Imagem de Capa</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.imageUrl || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, imageUrl: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-zinc-500 uppercase mb-1">Tema Visual</label>
                    <select 
                      value={editingCampaign?.visualTheme || 'default'}
                      onChange={e => setEditingCampaign({...editingCampaign, visualTheme: e.target.value as any})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                    >
                      <option value="default">Walkman Standard</option>
                      <option value="terminal">BIOS Terminal</option>
                      <option value="macos">System 7 (Mac)</option>
                      <option value="windows95">Windows 95</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => { setIsEditing(false); setEditingCampaign(null); }}
                  className="px-6 py-2 text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-orange-600 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest hover:brightness-110 machined-edge"
                >
                  SALVAR_CONFIGURAÇÕES
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Itens Persistentes */}
      {showItemsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-xl machined-edge flex flex-col max-h-[85vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-headline text-lg text-zinc-200">GESTÃO_DE_ITENS_CROSS_CAMPAIGN</h3>
                <p className="text-[10px] text-zinc-500 font-label uppercase">Itens marcados abaixo serão mantidos no inventário ao trocar de campanha</p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="text-zinc-500 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-4">
              <input 
                type="text" 
                placeholder="BUSCAR_ITEM..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-2">
              <div className="grid grid-cols-1 gap-1">
                {EVIDENCE_TAPES_FOR_ADMIN.filter(i => 
                  i.title.toLowerCase().includes(itemSearch.toLowerCase()) || 
                  i.chapter.toLowerCase().includes(itemSearch.toLowerCase())
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => togglePersistentItem(item.id)}
                    className={`flex items-center justify-between p-3 text-left transition-colors ${
                      persistentItems.includes(item.id) 
                        ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400' 
                        : 'text-zinc-500 hover:bg-zinc-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-sm">
                        {item.type === 'disk' ? 'save' : 'description'}
                      </span>
                      <div>
                        <p className="text-xs font-bold">{item.title}</p>
                        <p className="text-[9px] opacity-60 uppercase">{item.chapter}</p>
                      </div>
                    </div>
                    {persistentItems.includes(item.id) && <span className="material-symbols-outlined text-sm">keep</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setShowItemsModal(false)}
                className="bg-zinc-800 text-zinc-300 px-6 py-2 text-[10px] font-label font-bold tracking-widest hover:bg-zinc-700 machined-edge"
              >
                CONCLUÍDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
