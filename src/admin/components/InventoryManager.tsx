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
    <section className="space-y-8 font-chakra">
      {modal}
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-tertiary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,186,56,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">Logística_de_Inventário_de_Agentes</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Search */}
        <div className="lg:col-span-1 bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col h-[650px] shadow-2xl overflow-hidden">
          <div className="p-4 border-b-4 border-[#1a1a1a] bg-black/40">
             <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-xs">search</span>
                <input type="text" placeholder="FILTRAR_CONTAS..." value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} className="w-full bg-black/40 border border-white/5 text-[10px] font-black uppercase pl-10 pr-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-tertiary transition-all" />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20">
            {filteredPlayers.map(u => (
              <button key={u.uid} onClick={() => handleSelectAccount(u)} className={`w-full text-left px-5 py-4 border-b border-white/5 transition-all group ${selectedAccount?.uid === u.uid ? 'bg-tertiary/10 border-l-4 border-l-tertiary' : 'hover:bg-white/5'}`}>
                <p className={`font-black text-xs uppercase truncate ${selectedAccount?.uid === u.uid ? 'text-tertiary' : 'text-zinc-400 group-hover:text-white'}`}>{u.masterName || u.email?.split('@')[0] || "NULL_ACCOUNT"}</p>
                <p className="text-[9px] font-mono text-zinc-700 font-bold truncate mt-1 tracking-widest uppercase">{u.email || "OFFLINE_MODE"}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Character Selection */}
        <div className="lg:col-span-1 bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col h-[650px] shadow-2xl overflow-hidden">
           <div className="p-4 border-b-4 border-[#1a1a1a] bg-black/40">
             <p className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">Identidades_em_Campo</p>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20">
             {!selectedAccount ? (
               <div className="p-12 text-center opacity-20">
                  <span className="material-symbols-outlined text-4xl block mb-2">person_search</span>
                  <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed">Aguardando Seleção de Canal</p>
               </div>
             ) : characters.map(c => (
               <button key={c.id} onClick={() => handleSelectChar(selectedAccount.uid, c)} className={`w-full text-left px-6 py-5 border-b border-white/5 transition-all group ${selectedChar?.id === c.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-white/5'}`}>
                 <p className={`font-black text-xs uppercase ${selectedChar?.id === c.id ? 'text-primary' : 'text-zinc-400 group-hover:text-white'}`}>{c.codinome}</p>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700 border border-zinc-800 px-1.5 py-0.5 rounded-sm">ID: {c.id.slice(0,8)}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${c.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>{c.agentStatus}</span>
                 </div>
               </button>
             ))}
           </div>
        </div>

        {/* Inventory View */}
        <div className="lg:col-span-2 flex flex-col h-[650px] gap-6">
          {!selectedChar ? (
            <div className="flex-1 bg-black/20 border-4 border-dashed border-[#1a1a1a] rounded-xl flex flex-col items-center justify-center opacity-20">
               <span className="material-symbols-outlined text-6xl mb-4">inventory_2</span>
               <p className="text-[11px] font-black uppercase tracking-[0.4em]">Selecione_Agente_para_Mapeamento</p>
            </div>
          ) : (
            <div className="flex-1 bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col overflow-hidden shadow-2xl relative">
              <div className="p-6 border-b-4 border-[#1a1a1a] flex justify-between items-center bg-black/40">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-primary/10 border-2 border-primary/30 rounded-sm flex items-center justify-center text-primary font-black text-lg">
                      {selectedChar.codinome[0].toUpperCase()}
                   </div>
                   <div>
                     <h3 className="font-black text-sm text-white uppercase tracking-wider">{selectedChar.codinome}</h3>
                     <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Mapeando {inventory.length} Entradas de Inventário</p>
                   </div>
                </div>
                <button onClick={() => setShowAddModal(true)} className="bg-primary text-black px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-primary-container transition-all active:scale-95 glow-orange uppercase flex items-center gap-2">
                   <span className="material-symbols-outlined text-sm">add_box</span> Injetar_Dado
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar bg-black/20">
                {inventory.length === 0 && (
                   <div className="p-24 text-center opacity-20">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em]">Inventário_Vazio</p>
                   </div>
                )}
                {inventory.map(item => (
                  <div key={item.id} className="flex items-center gap-5 px-6 py-4 group hover:bg-primary/5 transition-all">
                    <span className="material-symbols-outlined text-zinc-800 text-lg transition-colors group-hover:text-primary">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-zinc-300 uppercase truncate group-hover:text-white transition-colors">{item.label}</p>
                      <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mt-1">{item.sublabel}</p>
                    </div>
                    {(playCounts[item.id] || 0) > 0 && (
                      <div className="bg-black/60 px-2 py-1 rounded-sm border border-white/5 flex items-center gap-2 shadow-inner">
                         <div className="w-1 h-1 bg-tertiary rounded-full animate-pulse" />
                         <span className="text-[8px] font-black text-tertiary uppercase tracking-tighter">Plays: {playCounts[item.id]}</span>
                      </div>
                    )}
                    <button onClick={() => executeRemove(item)} className="w-10 h-10 flex items-center justify-center text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100 material-symbols-outlined">delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && selectedChar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="p-8 border-b-4 border-[#1a1a1a] bg-black/40 relative z-10">
              <h3 className="font-black text-xl text-white uppercase tracking-widest">Injetar_Recurso_no_Vetor</h3>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Alvo: <span className="text-primary">{selectedChar.codinome}</span></p>
            </div>
            
            <div className="flex border-b-2 border-[#1a1a1a] relative z-10 bg-black/20">
              <button onClick={() => setAddTab('audio')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${addTab === 'audio' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-zinc-700 hover:text-zinc-500'}`}>Arquivos_Áudio</button>
              <button onClick={() => setAddTab('evidence')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${addTab === 'evidence' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-zinc-700 hover:text-zinc-500'}`}>Registros_Intel</button>
            </div>
            
            <div className="p-6 border-b-2 border-[#1a1a1a] relative z-10 bg-black/40">
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
                 <input type="text" placeholder="LOCALIZAR_NO_ACERVO..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[10px] font-black uppercase px-12 py-3 text-white outline-none focus:border-primary transition-all rounded-sm" />
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 relative z-10 custom-scrollbar bg-black/20">
              <div className="grid grid-cols-1 gap-2">
                {(addTab === 'audio' ? filteredAudiosForAdd : filteredEvidenceForAdd).map((item: any) => {
                  const id = item.id;
                  const alreadyHas = inventoryIds.has(id);
                  const isSelected = selectedToAdd.has(id);
                  return (
                    <div 
                      key={id} 
                      onClick={() => !alreadyHas && setSelectedToAdd(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })} 
                      className={`flex items-center gap-4 px-5 py-3 border-2 rounded-xl transition-all ${alreadyHas ? 'opacity-20 grayscale border-transparent cursor-not-allowed' : isSelected ? 'bg-primary/5 border-primary/40' : 'bg-transparent border-transparent hover:bg-white/5 cursor-pointer group'}`}
                    >
                      <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'border-[#1a1a1a] group-hover:border-zinc-700'}`}>
                         {isSelected && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black uppercase truncate ${isSelected ? 'text-primary' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{item.title || item.originalName}</p>
                        <p className="text-[9px] font-mono text-zinc-700 font-bold uppercase tracking-widest mt-1">ID: {id.slice(0,20)}...</p>
                      </div>
                      {alreadyHas && <span className="text-[8px] font-black uppercase bg-zinc-900 text-zinc-600 px-2 py-0.5 border border-zinc-800 rounded-sm">Presente</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-8 border-t-4 border-[#1a1a1a] flex justify-between items-center relative z-10 bg-black/40">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{selectedToAdd.size} Selecionados</span>
              <div className="flex gap-4">
                <button onClick={() => { setShowAddModal(false); setAddFeedback(null); setSelectedToAdd(new Set()); }} className="px-6 py-2 text-[10px] font-black text-zinc-600 hover:text-white transition-colors uppercase tracking-widest">Fechar</button>
                <button onClick={executeAddItems} disabled={selectedToAdd.size === 0 || addLoading} className="bg-primary hover:bg-primary-container text-black px-10 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20 glow-orange shadow-lg">SINCRONIZAR_DADOS</button>
              </div>
            </div>
            {addFeedback && <p className="absolute bottom-24 left-0 right-0 text-center text-[10px] font-black text-emerald-500 uppercase z-20 animate-bounce">{addFeedback}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
