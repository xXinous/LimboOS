import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../lib/firebase';
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { useModal } from './ConfirmModal';
import { intelRegistry } from '../../data/intel_registry';
import { activityLogger } from '../../services/ActivityLogger';
import { userService } from '../../services/UserService';
import type { CharacterData, MasterAccount } from '../../types/player';
import type { IntelItem } from '../../types/intel';
import Screw from '../../components/player/Screw';

export interface AudioData {
  id: string;
  originalName: string;
  title?: string;
  artist?: string;
  chapter?: string;
  duration?: number;
  isSecret?: boolean;
}

export interface InventoryItem {
  id: string;
  unlockedAt: any;
  type: 'audio' | 'text' | 'image' | 'video' | 'unknown';
  label: string;
  sublabel: string;
  icon: string;
}

export type AddTabType = 'audio' | 'evidence';

export default function InventoryManager() {
  const { showAlert, modal } = useModal();
  const [accounts, setAccounts] = useState<MasterAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<MasterAccount | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharacterData | null>(null);
  
  const [playerSearch, setPlayerSearch] = useState('');
  const [allAudios, setAllAudios] = useState<AudioData[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<AddTabType>('audio');
  const [addSearch, setAddSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [addLoading, setAddLoading] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  useEffect(() => {
    return userService.subscribeToUsers(setAccounts);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'audios'), (snap) => {
      const list: AudioData[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          originalName: data.originalName || d.id,
          title: data.title,
          artist: data.artist,
          chapter: data.chapter,
          duration: data.duration,
          isSecret: data.isSecret,
        });
      });
      setAllAudios(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedAccount || !selectedChar) return;
    const q = query(collection(db, 'playEvents'), 
      where('uid', '==', selectedAccount.uid),
      where('characterId', '==', selectedChar.id)
    );
    getDocs(q).then((snap) => {
      const counts: Record<string, number> = {};
      snap.forEach((d) => {
        const tid = d.data().tapeId;
        if (tid) counts[tid] = (counts[tid] || 0) + 1;
      });
      setPlayCounts(counts);
    });
  }, [selectedAccount, selectedChar]);

  const loadInventory = useCallback(async (uid: string, charId: string) => {
    setInventoryLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'characters', charId, 'tapes'));
      const items: InventoryItem[] = [];
      
      snap.forEach((d) => {
        const intelId = d.id;
        const data = d.data();
        const intel = intelRegistry.get(intelId);
        if (intel) {
          items.push({
            id: intelId,
            unlockedAt: data.unlockedAt,
            type: intel.type.toLowerCase() as any,
            label: intel.title,
            sublabel: intel.metadata?.chapter || intel.metadata?.artist || 'REGISTRO_INTEL',
            icon: intel.type === 'AUDIO' ? 'album' : intel.type === 'TEXT' ? 'save' : 'description',
          });
          return;
        }
        const audio = allAudios.find((a) => a.id === intelId);
        if (audio) {
          items.push({
            id: intelId,
            unlockedAt: data.unlockedAt,
            type: 'audio',
            label: audio.title || audio.originalName || intelId,
            sublabel: audio.artist || 'STREAM_LOCAL',
            icon: 'album',
          });
          return;
        }
        items.push({
          id: intelId,
          unlockedAt: data.unlockedAt,
          type: 'audio',
          label: intelId,
          sublabel: 'DADO_NÃO_MAPEADO',
          icon: 'help',
        });
      });
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'text' ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
      setInventory(items);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [allAudios]);

  const handleSelectAccount = async (acc: MasterAccount) => {
    setSelectedAccount(acc);
    setSelectedChar(null);
    setInventory([]);
    setPlayCounts({});
    const chars = await userService.fetchCharactersForUser(acc.uid);
    setCharacters(chars);
    if (chars.length === 1) handleSelectChar(acc.uid, chars[0]);
  };

  const handleSelectChar = (uid: string, char: CharacterData) => {
    setSelectedChar(char);
    loadInventory(uid, char.id);
  };

  const executeRemove = async (item: InventoryItem) => {
    if (!selectedAccount || !selectedChar) return;
    try {
      await userService.removeUserIntel(selectedAccount.uid, selectedChar.id, item.id);
      setInventory((prev) => prev.filter((i) => i.id !== item.id));
      activityLogger.logAdmin('gm.mpg', 'inventory_remove', `Removeu ${item.label} de ${selectedChar.codinome}`, { uid: selectedAccount.uid, charId: selectedChar.id, intelId: item.id });
    } catch (err) {
      console.error('Error removing item:', err);
      showAlert('Erro', 'Falha ao remover item.');
    }
  };

  const executeAddItems = async () => {
    if (!selectedAccount || !selectedChar || selectedToAdd.size === 0) return;
    setAddLoading(true);
    try {
      await Promise.all([...selectedToAdd].map((id) => userService.addUserIntel(selectedAccount.uid, selectedChar.id, id)));
      setAddFeedback(`✓ ${selectedToAdd.size} item(s) vinculados.`);
      activityLogger.logAdmin('gm.mpg', 'inventory_add', `Adicionou ${selectedToAdd.size} itens para ${selectedChar.codinome}`, { uid: selectedAccount.uid, charId: selectedChar.id, items: [...selectedToAdd] });
      setSelectedToAdd(new Set());
      await loadInventory(selectedAccount.uid, selectedChar.id);
    } catch (err) { setAddFeedback('ERRO: Falha na vinculação.'); }
    finally { setAddLoading(false); }
  };

  const inventoryIds = useMemo(() => new Set(inventory.map((i) => i.id)), [inventory]);
  const filteredAudiosForAdd = useMemo(() => allAudios.filter(a => (a.title || a.originalName || '').toLowerCase().includes(addSearch.toLowerCase())), [allAudios, addSearch]);
  const allRegistryIntel = useMemo(() => intelRegistry.getAll(), []);
  const filteredEvidenceForAdd = useMemo(() => allRegistryIntel.filter(i => (i.title || '').toLowerCase().includes(addSearch.toLowerCase()) || (i.id || '').toLowerCase().includes(addSearch.toLowerCase())), [allRegistryIntel, addSearch]);
  const filteredPlayers = useMemo(() => accounts.filter(u => (u.email || u.uid || u.masterName || '').toLowerCase().includes(playerSearch.toLowerCase())), [accounts, playerSearch]);

  return (
    <section className="space-y-8 font-sans">
      {modal}
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-8 bg-tertiary shadow-[0_0_10px_rgba(255,186,56,0.4)]" />
        <div>
          <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">Gestão de Inventário</h2>
          <p className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-[0.2em] uppercase">Mapeamento de Recursos por Agente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Search */}
        <div className="lg:col-span-1 bg-surface-container-low border border-primary/10 flex flex-col h-[650px] shadow-xl overflow-hidden">
          <div className="p-4 border-b border-primary/10 bg-black/20">
             <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-tertiary transition-colors">search</span>
                <input type="text" placeholder="FILTRAR_CONTAS..." value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} className="w-full bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold uppercase pl-10 pr-3 py-3 text-white outline-none focus:border-tertiary/40 transition-all placeholder:text-industrial-silver/10" />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
            {filteredPlayers.map(u => (
              <button key={u.uid} onClick={() => handleSelectAccount(u)} className={`w-full text-left px-5 py-4 border-b border-primary/5 transition-all group ${selectedAccount?.uid === u.uid ? 'bg-tertiary/10 border-l-2 border-l-tertiary' : 'hover:bg-white/5'}`}>
                <p className={`font-display font-bold text-[11px] uppercase truncate ${selectedAccount?.uid === u.uid ? 'text-tertiary' : 'text-industrial-silver/40 group-hover:text-white'}`}>{u.masterName || u.email?.split('@')[0] || "NULL_ACCOUNT"}</p>
                <p className="text-[9px] font-mono text-industrial-silver/20 font-bold truncate mt-1 tracking-widest uppercase">{u.email || "OFFLINE_MODE"}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Character Selection */}
        <div className="lg:col-span-1 bg-surface-container-low border border-primary/10 flex flex-col h-[650px] shadow-xl overflow-hidden">
           <div className="p-4 border-b border-primary/10 bg-black/20">
             <p className="text-[10px] font-display font-bold uppercase text-industrial-silver/40 tracking-widest">Identidades em Campo</p>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
             {!selectedAccount ? (
               <div className="p-12 text-center opacity-10">
                  <span className="material-symbols-outlined text-4xl block mb-2">person_search</span>
                  <p className="text-[9px] font-display font-bold uppercase tracking-widest leading-relaxed">Aguardando Seleção</p>
               </div>
             ) : characters.map(c => (
               <button key={c.id} onClick={() => handleSelectChar(selectedAccount.uid, c)} className={`w-full text-left px-6 py-5 border-b border-primary/5 transition-all group ${selectedChar?.id === c.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-white/5'}`}>
                 <p className={`font-display font-bold text-[11px] uppercase ${selectedChar?.id === c.id ? 'text-primary' : 'text-industrial-silver/40 group-hover:text-white'}`}>{c.codinome}</p>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="text-[8px] font-display font-bold uppercase tracking-widest text-industrial-silver/20 border border-white/5 px-1.5 py-0.5 rounded-sm">ID: {c.id.slice(0,8)}</span>
                    <span className={`text-[8px] font-display font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${c.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>{c.agentStatus}</span>
                 </div>
               </button>
             ))}
           </div>
        </div>

        {/* Inventory View */}
        <div className="lg:col-span-2 flex flex-col h-[650px] gap-6">
          {!selectedChar ? (
            <div className="flex-1 bg-black/10 border border-dashed border-primary/10 rounded-sm flex flex-col items-center justify-center opacity-20">
               <span className="material-symbols-outlined text-6xl mb-4 text-industrial-silver/20">inventory_2</span>
               <p className="text-[11px] font-display font-bold uppercase tracking-[0.4em]">Selecione Agente para Mapeamento</p>
            </div>
          ) : (
            <div className="flex-1 bg-surface-container-low border border-primary/10 flex flex-col overflow-hidden shadow-xl relative">
              <div className="p-6 border-b border-primary/10 flex flex-col sm:flex-row justify-between items-center bg-black/20 gap-4">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-sm flex items-center justify-center text-primary font-display font-bold text-lg">
                      {selectedChar.codinome[0].toUpperCase()}
                   </div>
                   <div>
                     <h3 className="font-display font-bold text-base text-white uppercase tracking-wider">{selectedChar.codinome}</h3>
                     <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-0.5">{inventory.length} Entradas de Inventário</p>
                   </div>
                </div>
                <button onClick={() => setShowAddModal(true)} className="bg-primary hover:bg-primary-container text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest transition-all active:scale-95 glow-orange uppercase flex items-center gap-2 shadow-lg">
                   <span className="material-symbols-outlined text-base">add_box</span> Injetar Dado
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-primary/5 custom-scrollbar bg-black/10">
                {inventory.length === 0 && (
                   <div className="p-24 text-center opacity-10">
                      <p className="text-[10px] font-display font-bold uppercase tracking-[0.4em]">Inventário Vazio</p>
                   </div>
                )}
                {inventory.map(item => (
                  <div key={item.id} className="flex items-center gap-5 px-6 py-4 group hover:bg-primary/5 transition-all">
                    <span className="material-symbols-outlined text-industrial-silver/20 text-xl transition-colors group-hover:text-primary">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-display font-bold text-industrial-silver/60 uppercase truncate group-hover:text-white transition-colors">{item.label}</p>
                      <p className="text-[9px] font-display font-bold text-industrial-silver/20 uppercase tracking-widest mt-1">{item.sublabel}</p>
                    </div>
                    {(playCounts[item.id] || 0) > 0 && (
                      <div className="bg-surface-container-lowest px-2 py-1 rounded-sm border border-white/5 flex items-center gap-2 shadow-inner">
                         <div className="w-1 h-1 bg-tertiary rounded-full animate-pulse glow-yellow" />
                         <span className="text-[8px] font-display font-bold text-tertiary uppercase tracking-tighter">Plays: {playCounts[item.id]}</span>
                      </div>
                    )}
                    <button onClick={() => executeRemove(item)} className="w-10 h-10 flex items-center justify-center text-industrial-silver/20 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100 material-symbols-outlined text-xl">delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && selectedChar && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 w-full max-w-2xl rounded-sm shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              INJEÇÃO-DE-RECURSOS
            </div>
            
            <div className="p-8 border-b border-primary/10 bg-black/40">
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-widest">Injetar Recurso no Vetor</h3>
              <p className="text-[10px] text-industrial-silver/40 font-display font-bold uppercase tracking-widest mt-1">Alvo: <span className="text-primary">{selectedChar.codinome}</span></p>
            </div>
            
            <div className="flex border-b border-primary/10 bg-black/20">
              <button onClick={() => setAddTab('audio')} className={`flex-1 py-4 text-[11px] font-display font-bold uppercase tracking-[0.2em] transition-all ${addTab === 'audio' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-industrial-silver/30 hover:text-industrial-silver/60'}`}>Arquivos Áudio</button>
              <button onClick={() => setAddTab('evidence')} className={`flex-1 py-4 text-[11px] font-display font-bold uppercase tracking-[0.2em] transition-all ${addTab === 'evidence' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-industrial-silver/30 hover:text-industrial-silver/60'}`}>Registros Intel</button>
            </div>
            
            <div className="p-6 border-b border-primary/10 bg-black/40">
               <div className="relative group">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors">search</span>
                 <input type="text" placeholder="LOCALIZAR NO ACERVO..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="w-full bg-surface-container-lowest border border-primary/10 text-[11px] font-display font-bold uppercase px-12 py-4 text-white outline-none focus:border-primary/40 transition-all rounded-sm placeholder:text-industrial-silver/10" />
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(addTab === 'audio' ? filteredAudiosForAdd : filteredEvidenceForAdd).map((item: any) => {
                  const id = item.id;
                  const alreadyHas = inventoryIds.has(id);
                  const isSelected = selectedToAdd.has(id);
                  return (
                    <div 
                      key={id} 
                      onClick={() => !alreadyHas && setSelectedToAdd(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })} 
                      className={`flex items-center gap-4 px-4 py-3 border transition-all ${alreadyHas ? 'opacity-20 grayscale border-transparent cursor-not-allowed' : isSelected ? 'bg-primary/10 border-primary/40' : 'bg-surface-container-lowest border-white/5 hover:bg-white/5 cursor-pointer group'}`}
                    >
                      <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'border-white/10 group-hover:border-white/20'}`}>
                         {isSelected && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-display font-bold uppercase truncate ${isSelected ? 'text-primary' : 'text-industrial-silver/60 group-hover:text-industrial-silver/80'}`}>{item.title || item.originalName}</p>
                        <p className="text-[9px] font-mono text-industrial-silver/20 font-bold uppercase tracking-widest mt-1">ID: {id.slice(0,12)}...</p>
                      </div>
                      {alreadyHas && <span className="text-[8px] font-display font-bold uppercase bg-black/40 text-industrial-silver/30 px-2 py-0.5 border border-white/5 rounded-sm">Presente</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-8 border-t border-primary/10 flex flex-col sm:flex-row justify-between items-center bg-black/40 gap-6">
              <span className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em]">{selectedToAdd.size} Selecionados para Injeção</span>
              <div className="flex gap-4 w-full sm:w-auto">
                <button onClick={() => { setShowAddModal(false); setAddFeedback(null); setSelectedToAdd(new Set()); }} className="flex-1 sm:flex-none px-6 py-4 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white transition-colors uppercase tracking-widest">Fechar</button>
                <button onClick={executeAddItems} disabled={selectedToAdd.size === 0 || addLoading} className="flex-2 sm:flex-none bg-primary hover:bg-primary-container text-black px-10 py-4 rounded-sm font-display font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20 glow-orange shadow-lg">SINCRONIZAR DADOS</button>
              </div>
            </div>
            {addFeedback && <p className="absolute bottom-24 left-0 right-0 text-center text-[10px] font-display font-bold text-emerald-500 uppercase z-20 animate-bounce">{addFeedback}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
