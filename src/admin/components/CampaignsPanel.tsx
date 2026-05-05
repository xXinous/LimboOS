import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { Campaign, campaigns as initialCampaigns } from '../../data/campaigns';
import { Group, UserData } from '../../types/player';
import { activityLogger } from '../../services/ActivityLogger';
import { useModal } from './ConfirmModal';
import { intelRegistry } from '../../data/intel_registry';
import Screw from '../../components/player/Screw';

export default function CampaignsPanel() {
  const { showAlert, showConfirm, modal } = useModal();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [persistentItems, setPersistentItems] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);

  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list: Campaign[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Campaign));
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
    const ok = await showConfirm('Apagar Missão', "Tem certeza que deseja apagar esta missão?", 'Apagar');
    if (!ok) return;
    
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

  if (loading) return <div className="p-24 text-center animate-pulse font-chakra font-black text-primary text-xs uppercase tracking-[0.4em]">Sincronizando_Missões...</div>;

  const allRegistryIntel = intelRegistry.getAll();

  return (
    <div className="space-y-8 font-chakra">
      {modal}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <h2 className="font-black uppercase tracking-widest text-lg text-white">Central_de_Comando_de_Missões</h2>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowItemsModal(true)}
            className="flex items-center gap-2 bg-[#333] text-zinc-300 px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-[#444] transition-all border border-white/5 active:scale-95"
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
                year: '2026',
                visualTheme: 'default',
                rpgSystem: 'Cyberpunk Red',
                status: 'Ativa',
                imageUrl: ''
              });
              setIsEditing(true);
            }}
            className="flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-primary-container transition-all active:scale-95 glow-orange"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            NOVA_MISSÃO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl overflow-hidden group hover:border-primary/20 transition-all shadow-xl active:scale-[0.995] relative">
            <div className="h-40 bg-black relative overflow-hidden">
              {campaign.imageUrl ? (
                <img src={campaign.imageUrl} alt={campaign.name} className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-900">
                  <span className="material-symbols-outlined text-6xl">map</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6">
                <h3 className="font-black text-2xl text-white uppercase tracking-tighter group-hover:text-primary transition-colors">{campaign.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest">{campaign.rpgSystem}</p>
                </div>
              </div>
              <div className="absolute top-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <button 
                  onClick={() => { setEditingCampaign(campaign); setIsEditing(true); }}
                  className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-sm flex items-center justify-center text-zinc-400 hover:text-primary transition-all active:scale-90"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button 
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-sm flex items-center justify-center text-zinc-400 hover:text-red-500 transition-all active:scale-90"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-[11px] text-zinc-500 italic line-clamp-2 leading-relaxed font-sans">{campaign.description}</p>
              
              <div className="flex items-center justify-between text-[10px] font-black text-zinc-600 uppercase border-t border-white/5 pt-5">
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-xs">location_on</span> {campaign.location}</div>
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-xs">schedule</span> {campaign.year}</div>
                <span className={`px-3 py-1 rounded-sm border-2 font-black ${
                  campaign.status === 'Ativa' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 
                  campaign.status === 'Bloqueada' ? 'border-red-500/20 text-red-500 bg-red-500/5' : 'border-[#333] text-zinc-600'
                }`}>
                  {campaign.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-4 pt-4 bg-black/20 p-5 rounded-lg border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sincronização_de_Membros</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[8px] text-zinc-700 font-black uppercase tracking-widest">ESQUADRÕES</p>
                    <select 
                      className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold text-primary p-2.5 outline-none rounded-sm focus:border-primary transition-all"
                      onChange={(e) => e.target.value && handleAssignToCampaign(e.target.value, campaign.id, 'group')}
                      value=""
                    >
                      <option value="">Ligar Grupo...</option>
                      {groups.filter(g => g.campaignId !== campaign.id).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[8px] text-zinc-700 font-black uppercase tracking-widest">AGENTES_SOLO</p>
                    <select 
                      className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold text-primary p-2.5 outline-none rounded-sm focus:border-primary transition-all"
                      onChange={(e) => e.target.value && handleAssignToCampaign(e.target.value, campaign.id, 'user')}
                      value=""
                    >
                      <option value="">Ligar Agente...</option>
                      {users.filter(u => u.role !== 'admin' && u.campaignId !== campaign.id).map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName || u.username}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {groups.filter(g => g.campaignId === campaign.id).map(g => (
                    <span key={g.id} className="text-[9px] font-black bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-sm uppercase tracking-tighter">
                      GRP: {g.name}
                    </span>
                  ))}
                  {users.filter(u => u.campaignId === campaign.id && !groups.some(g => g.campaignId === campaign.id && g.playerUids.includes(u.uid))).map(u => (
                    <span key={u.uid} className="text-[9px] font-black bg-[#333] text-zinc-400 border border-white/5 px-2.5 py-1 rounded-sm uppercase tracking-tighter">
                      AGT: {u.displayName || u.username}
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden relative">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="bg-black/40 p-8 flex justify-between items-center border-b-4 border-[#1a1a1a] relative z-10">
              <h3 className="text-white font-black text-xl uppercase tracking-[0.2em]">Configurar_Instância_de_Missão</h3>
              <button onClick={() => { setIsEditing(false); setEditingCampaign(null); }} className="p-2 hover:bg-white/5 text-zinc-600 hover:text-white transition-all rounded-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveCampaign} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Identificador_da_Missão (Slug)</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.id || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, id: e.target.value})}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-mono focus:border-primary outline-none rounded-sm uppercase"
                      placeholder="ex: neo-sampa-2099"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nome_Operacional</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.name || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, name: e.target.value})}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Sistema_de_Operação</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.rpgSystem || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, rpgSystem: e.target.value})}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Registro_Temporal</label>
                      <input 
                        type="text" 
                        value={editingCampaign?.year || ''}
                        onChange={e => setEditingCampaign({...editingCampaign, year: e.target.value})}
                        className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Estado_de_Acesso</label>
                      <select 
                        value={editingCampaign?.status || 'Ativa'}
                        onChange={e => setEditingCampaign({...editingCampaign, status: e.target.value as any})}
                        className="w-full bg-black/60 border-2 border-[#1a1a1a] text-primary text-[10px] font-black px-4 py-3.5 outline-none focus:border-primary uppercase rounded-sm"
                      >
                        <option value="Ativa">ATIVA</option>
                        <option value="Arquivada">ARQUIVADA</option>
                        <option value="Bloqueada">BLOQUEADA</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Descrição_do_Setor</label>
                    <textarea 
                      value={editingCampaign?.description || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, description: e.target.value})}
                      className="w-full h-28 bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none resize-none rounded-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Localização_Geográfica</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.location || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, location: e.target.value})}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Frequência_Visual (URL da Imagem)</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.imageUrl || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, imageUrl: e.target.value})}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-mono focus:border-primary outline-none rounded-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Protocolo_Visual (Tema)</label>
                    <select 
                      value={editingCampaign?.visualTheme || 'default'}
                      onChange={e => setEditingCampaign({...editingCampaign, visualTheme: e.target.value as any})}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-primary text-[10px] font-black px-4 py-3.5 outline-none focus:border-primary uppercase rounded-sm"
                    >
                      <option value="default">WALKMAN STANDARD</option>
                      <option value="terminal">BIOS TERMINAL</option>
                      <option value="macos">SYSTEM 7 (MAC)</option>
                      <option value="windows95">WINDOWS 95</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-6 pt-10 border-t-4 border-[#1a1a1a]">
                <button 
                  type="button" 
                  onClick={() => { setIsEditing(false); setEditingCampaign(null); }}
                  className="px-8 py-3 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
                >
                  ABORTAR
                </button>
                <button 
                  type="submit" 
                  className="bg-primary hover:bg-primary-container text-black px-12 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 glow-orange"
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="px-10 pt-10 pb-6 border-b-4 border-[#1a1a1a] flex justify-between items-start relative z-10 bg-black/40">
              <div>
                <h3 className="font-black text-xl text-white uppercase tracking-[0.2em]">Cofre_Cross-Campaign</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Sinalize itens para retenção permanente no inventário</p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="p-2 hover:bg-white/5 text-zinc-600 hover:text-white transition-all rounded-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-8 relative z-10">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
                <input 
                  type="text" 
                  placeholder="BUSCAR_ITEM_NO_ACERVO..."
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-12 py-4 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase tracking-widest transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-8 pb-8 relative z-10 custom-scrollbar">
              <div className="grid grid-cols-1 gap-2">
                {allRegistryIntel.filter(i => 
                  (i.title || '').toLowerCase().includes(itemSearch.toLowerCase()) || 
                  (i.metadata?.chapter || '').toLowerCase().includes(itemSearch.toLowerCase())
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => togglePersistentItem(item.id)}
                    className={`flex items-center justify-between p-4 text-left transition-all border-2 rounded-xl group ${
                      persistentItems.includes(item.id) 
                        ? 'bg-primary/5 border-primary/30 text-primary shadow-[inset_0_0_15px_rgba(255,140,0,0.1)]' 
                        : 'bg-black/20 border-transparent text-zinc-600 hover:bg-white/5 hover:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-sm bg-black border transition-all ${persistentItems.includes(item.id) ? 'border-primary/40' : 'border-white/5'}`}>
                        <span className="material-symbols-outlined text-sm">
                          {item.type === 'AUDIO' ? 'album' : item.type === 'TEXT' ? 'save' : 'description'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-tight">{item.title}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${persistentItems.includes(item.id) ? 'text-primary/40' : 'text-zinc-800'}`}>{item.metadata?.chapter}</p>
                      </div>
                    </div>
                    {persistentItems.includes(item.id) && (
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.6)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 border-t-4 border-[#1a1a1a] flex justify-end relative z-10 bg-black/40">
              <button 
                onClick={() => setShowItemsModal(false)}
                className="bg-[#333] hover:bg-[#444] text-white px-12 py-4 text-[10px] font-black tracking-widest hover:bg-zinc-700 transition-all rounded-sm uppercase active:scale-95 shadow-lg"
              >
                Concluir_Operação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
