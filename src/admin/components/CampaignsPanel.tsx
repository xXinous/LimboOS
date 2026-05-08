import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../lib/firebase';
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Campaign, campaigns as initialCampaigns } from '../../data/campaigns';
import { Group, UserData } from '../../types/player';
import { activityLogger } from '../../services/ActivityLogger';
import { useModal } from './ConfirmModal';
import { intelRegistry } from '../../data/intel_registry';

export default function CampaignsPanel() {
  const { showAlert, showConfirm, modal } = useModal();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [persistentItems, setPersistentItems] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (loading) return <div className="p-24 text-center animate-pulse font-display font-bold text-primary text-xs uppercase tracking-[0.4em]">Sincronizando Missões...</div>;

  const allRegistryIntel = intelRegistry.getAll();

  const handleFileUpload = async (file: File) => {
    if (!editingCampaign?.id) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      showAlert('Formato Inválido', 'Apenas imagens JPG, PNG, WebP e GIF são aceitas.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showAlert('Arquivo Grande', 'O arquivo deve ter no máximo 5MB.');
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `campaigns/covers/${editingCampaign.id}_${Date.now()}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setEditingCampaign(prev => ({ ...prev, imageUrl: url }));
      activityLogger.logAdmin('gm.mpg', 'campaign_cover_uploaded', `Cover uploaded for: ${editingCampaign.id}`);
    } catch (error) {
      console.error('Erro no upload:', error);
      showAlert('Erro', 'Não foi possível enviar a imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {modal}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">Centro de Comando</h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">Gestão de Instâncias e Missões Ativas</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowItemsModal(true)}
            className="flex items-center gap-3 bg-surface-container-high text-industrial-silver/60 px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest hover:bg-white/5 transition-all border border-white/5 active:scale-95 uppercase"
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            Itens Persistentes
          </button>
          <button 
            onClick={() => {
              setEditingCampaign({
                id: `new-mission-${Date.now()}`,
                name: '',
                description: '',
                location: '',
                year: '2026',
                rpgSystem: 'Cyberpunk Red',
                status: 'Ativa',
                imageUrl: ''
              });
              setIsEditing(true);
            }}
            className="flex items-center gap-3 bg-primary text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest hover:bg-primary-container transition-all active:scale-95 glow-orange shadow-lg uppercase"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Nova Missão
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="bg-surface-container-low border border-primary/10 overflow-hidden group hover:border-primary/30 transition-all shadow-2xl relative">
            <div className="h-48 bg-black relative overflow-hidden">
              {campaign.imageUrl ? (
                <img src={campaign.imageUrl} alt={campaign.name} className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-industrial-silver/5 bg-surface-container-high">
                  <span className="material-symbols-outlined text-7xl">map</span>
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-surface-container-low via-surface-container-low/20 to-transparent" />
              
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse glow-orange" />
                   <p className="text-[10px] font-display font-bold text-primary/70 uppercase tracking-[0.2em]">{campaign.rpgSystem}</p>
                </div>
                <h3 className="font-display font-bold text-3xl text-white uppercase tracking-tighter group-hover:text-primary transition-colors leading-none">{campaign.name}</h3>
              </div>
              
              <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <button 
                  onClick={() => { setEditingCampaign(campaign); setIsEditing(true); }}
                  className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-sm flex items-center justify-center text-industrial-silver/40 hover:text-primary transition-all active:scale-90"
                >
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </button>
                <button 
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-sm flex items-center justify-center text-industrial-silver/40 hover:text-red-500 transition-all active:scale-90"
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <p className="text-[12px] text-industrial-silver/50 italic line-clamp-2 leading-relaxed font-sans">{campaign.description}</p>
              
              <div className="flex items-center justify-between text-[10px] font-display font-bold text-industrial-silver/30 uppercase border-y border-white/5 py-4 tracking-widest">
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-industrial-silver/20">location_on</span> {campaign.location}</div>
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-industrial-silver/20">schedule</span> {campaign.year}</div>
                <span className={`px-3 py-1 rounded-sm border font-display font-bold ${
                  campaign.status === 'Ativa' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 
                  campaign.status === 'Bloqueada' ? 'border-red-500/20 text-red-500 bg-red-500/5' : 'border-white/5 text-industrial-silver/30'
                }`}>
                  {campaign.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[9px] font-display font-bold text-industrial-silver/20 uppercase tracking-[0.3em]">Vínculos de Rede</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest">Esquadrões</p>
                    <select 
                      className="w-full bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold text-primary p-3 outline-none rounded-sm focus:border-primary/40 transition-all appearance-none cursor-pointer shadow-inner"
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
                    <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest">Agentes Solo</p>
                    <select 
                      className="w-full bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold text-primary p-3 outline-none rounded-sm focus:border-primary/40 transition-all appearance-none cursor-pointer shadow-inner"
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

                <div className="flex flex-wrap gap-2">
                  {groups.filter(g => g.campaignId === campaign.id).map(g => (
                    <span key={g.id} className="text-[9px] font-display font-bold bg-primary/5 text-primary/60 border border-primary/10 px-3 py-1 rounded-sm uppercase tracking-wider">
                      GRP: {g.name}
                    </span>
                  ))}
                  {users.filter(u => u.campaignId === campaign.id && !groups.some(g => g.campaignId === campaign.id && g.playerUids.includes(u.uid))).map(u => (
                    <span key={u.uid} className="text-[9px] font-display font-bold bg-white/5 text-industrial-silver/40 border border-white/5 px-3 py-1 rounded-sm uppercase tracking-wider">
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
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              {editingCampaign?.id?.includes('new') ? 'INSTALAÇÃO-DE-MISSÃO' : 'RECONFIGURAÇÃO-DE-SETOR'}
            </div>
            
            <div className="bg-black/40 p-8 flex justify-between items-center border-b border-white/5">
              <div className="mt-2">
                <h3 className="text-white font-display font-bold text-2xl uppercase tracking-tighter">Parâmetros da <span className="text-primary">Instância</span></h3>
                <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">Definição de diretrizes operacionais e RPG</p>
              </div>
              <button onClick={() => { setIsEditing(false); setEditingCampaign(null); }} className="p-3 text-industrial-silver/20 hover:text-white transition-all material-symbols-outlined rounded-sm">
                close
              </button>
            </div>
            
            <form onSubmit={handleSaveCampaign} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="group">
                    <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Identificador Slug</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.id || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, id: e.target.value})}
                      className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-mono outline-none rounded-sm uppercase shadow-inner"
                      placeholder="ex: neo-sampa-2099"
                      required
                      disabled={!editingCampaign?.id?.includes('new')}
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Nome Operacional</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.name || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, name: e.target.value})}
                      className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
                      required
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Sistema de Regras</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.rpgSystem || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, rpgSystem: e.target.value})}
                      className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Ano</label>
                      <input 
                        type="text" 
                        value={editingCampaign?.year || ''}
                        onChange={e => setEditingCampaign({...editingCampaign, year: e.target.value})}
                        className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
                      />
                      <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                    </div>
                    <div className="group">
                      <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Acesso</label>
                      <select 
                        value={editingCampaign?.status || 'Ativa'}
                        onChange={e => setEditingCampaign({...editingCampaign, status: e.target.value as any})}
                        className="w-full bg-surface-container-lowest border-none text-primary text-[10px] font-display font-bold px-4 py-4 outline-none rounded-sm uppercase cursor-pointer shadow-inner appearance-none"
                      >
                        <option value="Ativa">ATIVA</option>
                        <option value="Arquivada">ARQUIVADA</option>
                        <option value="Bloqueada">BLOQUEADA</option>
                      </select>
                      <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="group">
                    <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Descrição do Setor</label>
                    <textarea 
                      value={editingCampaign?.description || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, description: e.target.value})}
                      className="w-full h-28 bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-sans outline-none resize-none rounded-sm shadow-inner leading-relaxed"
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Localização</label>
                    <input 
                      type="text" 
                      value={editingCampaign?.location || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, location: e.target.value})}
                      className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">Frequência Visual (Capa)</label>
                    
                    {/* Image preview */}
                    {editingCampaign?.imageUrl && (
                      <div className="relative mb-4 rounded-sm overflow-hidden border border-primary/20 group/preview">
                        <img src={editingCampaign.imageUrl} alt="Preview" className="w-full h-32 object-cover opacity-60 group-hover/preview:opacity-80 transition-opacity" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                        <button
                          type="button"
                          onClick={() => setEditingCampaign({...editingCampaign, imageUrl: ''})}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/70 border border-white/10 rounded-sm flex items-center justify-center text-red-500/70 hover:text-red-500 transition-all hover:border-red-500/30"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                        <p className="absolute bottom-2 left-3 text-[8px] font-display font-bold text-white/50 uppercase tracking-widest">PREVIEW_ATIVA</p>
                      </div>
                    )}

                    {/* Upload area */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full border-2 border-dashed border-primary/15 hover:border-primary/40 bg-surface-container-lowest/50 hover:bg-primary/5 rounded-sm py-5 flex flex-col items-center gap-2 transition-all group/upload cursor-pointer disabled:opacity-40 disabled:cursor-wait"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-display font-bold text-primary/60 uppercase tracking-widest">Enviando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-2xl text-industrial-silver/20 group-hover/upload:text-primary/60 transition-colors">cloud_upload</span>
                          <span className="text-[10px] font-display font-bold text-industrial-silver/30 group-hover/upload:text-primary/50 uppercase tracking-widest transition-colors">Enviar Imagem</span>
                          <span className="text-[8px] font-display text-industrial-silver/15 uppercase tracking-wider">JPG, PNG, WebP, GIF • Max 5MB</span>
                        </>
                      )}
                    </button>

                    {/* URL fallback */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="h-px flex-1 bg-white/5" />
                      <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">ou cole URL</span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <input 
                      type="text" 
                      value={editingCampaign?.imageUrl || ''}
                      onChange={e => setEditingCampaign({...editingCampaign, imageUrl: e.target.value})}
                      className="w-full bg-surface-container-lowest border-none text-white px-4 py-3 text-[11px] font-mono outline-none rounded-sm shadow-inner mt-2"
                      placeholder="https://..."
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>

                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => { setIsEditing(false); setEditingCampaign(null); }}
                  className="px-8 py-4 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-[0.3em] transition-all"
                >
                  Abortar Missão
                </button>
                <button 
                  type="submit" 
                  className="bg-primary hover:bg-primary-container text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Itens Persistentes */}
      {showItemsModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 w-full max-w-xl rounded-sm shadow-2xl flex flex-col max-h-[85vh] relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              COFRE-CROSS-CAMPAIGN
            </div>
            
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="mt-2">
                <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter">Retenção de <span className="text-primary">Recursos</span></h3>
                <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">Itens disponíveis em todas as missões</p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="p-3 text-industrial-silver/20 hover:text-white transition-all material-symbols-outlined rounded-sm">
                close
              </button>
            </div>
            
            <div className="p-6 bg-black/20">
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors">search</span>
                <input 
                  type="text" 
                  placeholder="LOCALIZAR ITEM NO ACERVO..."
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/5 text-[11px] font-display font-bold px-12 py-4 text-white outline-none rounded-sm uppercase tracking-widest transition-all shadow-inner placeholder:text-industrial-silver/10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/10">
              <div className="grid grid-cols-1 gap-2">
                {allRegistryIntel.filter(i => 
                  (i.title || '').toLowerCase().includes(itemSearch.toLowerCase()) || 
                  (i.metadata?.chapter || '').toLowerCase().includes(itemSearch.toLowerCase())
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => togglePersistentItem(item.id)}
                    className={`flex items-center justify-between p-4 text-left transition-all border rounded-sm group ${
                      persistentItems.includes(item.id) 
                        ? 'bg-primary/5 border-primary/30 text-primary shadow-inner' 
                        : 'bg-surface-container-lowest border-white/5 text-industrial-silver/30 hover:bg-white/5 hover:text-industrial-silver/60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-sm bg-black/40 border flex items-center justify-center transition-all ${persistentItems.includes(item.id) ? 'border-primary/40 text-primary shadow-[0_0_10px_rgba(255,140,0,0.1)]' : 'border-white/5 text-industrial-silver/20'}`}>
                        <span className="material-symbols-outlined text-xl">
                          {item.type === 'AUDIO' ? 'album' : item.type === 'TEXT' ? 'save' : 'description'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-display font-bold uppercase tracking-wider">{item.title}</p>
                        <p className={`text-[9px] font-display font-bold uppercase tracking-widest mt-0.5 ${persistentItems.includes(item.id) ? 'text-primary/40' : 'text-industrial-silver/10'}`}>{item.metadata?.chapter || 'REGISTRO GERAL'}</p>
                      </div>
                    </div>
                    {persistentItems.includes(item.id) && (
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse glow-orange" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-white/5 flex justify-end bg-black/40">
              <button 
                onClick={() => setShowItemsModal(false)}
                className="bg-surface-container-high hover:bg-white/5 text-industrial-silver/60 hover:text-white px-12 py-4 text-[10px] font-display font-bold tracking-widest transition-all rounded-sm uppercase active:scale-95 border border-white/5"
              >
                Concluir Operação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
