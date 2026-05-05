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
import type { CharacterData } from '../../types/player';
import type { IntelItem } from '../../types/intel';

interface UserData {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  role: string;
}

interface AudioData {
  id: string;
  originalName: string;
  title?: string;
  artist?: string;
  chapter?: string;
  duration?: number;
  isSecret?: boolean;
}

interface InventoryItem {
  id: string;
  unlockedAt?: any;
  type: 'audio' | 'text' | 'visual' | 'meta';
  label: string;
  sublabel?: string;
  icon: string;
}

type AddTabType = 'audio' | 'evidence';

export default function InventoryManager() {
  const { showAlert, modal } = useModal();
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
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
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserData[] = [];
      snap.forEach((d) => list.push(d.data() as UserData));
      setUsers(list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
    });
    return () => unsub();
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
    if (!selectedUser || !selectedChar) return;
    const q = query(collection(db, 'playEvents'), 
      where('uid', '==', selectedUser.uid),
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
  }, [selectedUser, selectedChar]);

  const loadInventory = useCallback(async (uid: string, charId: string) => {
    setInventoryLoading(true);
    try {
      // For now, still reading from 'tapes' collection for backward compatibility
      const snap = await getDocs(collection(db, 'users', uid, 'characters', charId, 'tapes'));
      const items: InventoryItem[] = [];
      
      snap.forEach((d) => {
        const intelId = d.id;
        const data = d.data();
        
        // 1. Check Intel Registry (Local or already resolved)
        const intel = intelRegistry.get(intelId);
        if (intel) {
          items.push({
            id: intelId,
            unlockedAt: data.unlockedAt,
            type: intel.type.toLowerCase() as any,
            label: intel.title,
            sublabel: intel.metadata?.chapter || intel.metadata?.artist,
            icon: intel.type === 'AUDIO' ? 'album' : intel.type === 'TEXT' ? 'save' : 'description',
          });
          return;
        }

        // 2. Check Remote Audios
        const audio = allAudios.find((a) => a.id === intelId);
        if (audio) {
          items.push({
            id: intelId,
            unlockedAt: data.unlockedAt,
            type: 'audio',
            label: audio.title || audio.originalName || intelId,
            sublabel: audio.artist || '',
            icon: 'album',
          });
          return;
        }

        // 3. Unknown Fallback
        items.push({
          id: intelId,
          unlockedAt: data.unlockedAt,
          type: 'audio',
          label: intelId,
          sublabel: 'Desconhecido',
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

  const handleSelectUser = async (user: UserData) => {
    setSelectedUser(user);
    setSelectedChar(null);
    setInventory([]);
    setPlayCounts({});
    const chars = await userService.fetchCharactersForUser(user.uid);
    setCharacters(chars);
    if (chars.length === 1) {
      handleSelectChar(user.uid, chars[0]);
    }
  };

  const handleSelectChar = (uid: string, char: CharacterData) => {
    setSelectedChar(char);
    loadInventory(uid, char.id);
  };

  const executeRemove = async (item: InventoryItem) => {
    if (!selectedUser || !selectedChar) return;
    try {
      await deleteDoc(doc(db, 'users', selectedUser.uid, 'characters', selectedChar.id, 'tapes', item.id));
      setInventory((prev) => prev.filter((i) => i.id !== item.id));
      activityLogger.logAdmin('gm.mpg', 'inventory_remove', `Removeu ${item.label} de ${selectedChar.codinome} (${selectedUser.email})`, { uid: selectedUser.uid, charId: selectedChar.id, intelId: item.id });
    } catch (err) {
      console.error('Error removing item:', err);
      showAlert('Erro', 'Falha ao remover item do inventário.');
    }
  };

  const executeAddItems = async () => {
    if (!selectedUser || !selectedChar || selectedToAdd.size === 0) return;
    setAddLoading(true);
    try {
      await Promise.all(
        [...selectedToAdd].map((id) =>
          setDoc(doc(db, 'users', selectedUser.uid, 'characters', selectedChar.id, 'tapes', id), {
            intelId: id,
            unlockedAt: serverTimestamp(),
          })
        )
      );
      setAddFeedback(`✓ ${selectedToAdd.size} item(s) adicionado(s).`);
      activityLogger.logAdmin('gm.mpg', 'inventory_add', `Adicionou ${selectedToAdd.size} itens para ${selectedChar.codinome}`, { uid: selectedUser.uid, charId: selectedChar.id, items: [...selectedToAdd] });
      setSelectedToAdd(new Set());
      await loadInventory(selectedUser.uid, selectedChar.id);
    } catch (err) {
      setAddFeedback('ERRO: Falha ao adicionar.');
    } finally {
      setAddLoading(false);
    }
  };

  const inventoryIds = useMemo(() => new Set(inventory.map((i) => i.id)), [inventory]);
  const filteredAudiosForAdd = useMemo(() => allAudios.filter(a => (a.title || a.originalName || '').toLowerCase().includes(addSearch.toLowerCase())), [allAudios, addSearch]);
  
  const allRegistryIntel = useMemo(() => intelRegistry.getAll(), []);
  const filteredEvidenceForAdd = useMemo(() => allRegistryIntel.filter(i => 
    i.title.toLowerCase().includes(addSearch.toLowerCase()) || 
    i.id.toLowerCase().includes(addSearch.toLowerCase())
  ), [allRegistryIntel, addSearch]);

  const filteredPlayers = useMemo(() => users.filter(u => (u.displayName || u.email || '').toLowerCase().includes(playerSearch.toLowerCase())), [users, playerSearch]);

  return (
    <section className="space-y-6">
      {modal}
      <div className="flex items-center gap-4">
        <div className="w-2 h-6 bg-purple-500" />
        <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Gerenciador_de_Inventário</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Search */}
        <div className="lg:col-span-1 bg-surface-container-lowest border border-zinc-800 flex flex-col h-[600px] machined-edge">
          <div className="p-4 border-b border-zinc-800">
            <input type="text" placeholder="BUSCAR_JOGADOR..." value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase px-3 py-2 text-zinc-300" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredPlayers.map(u => (
              <button key={u.uid} onClick={() => handleSelectUser(u)} className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 ${selectedUser?.uid === u.uid ? 'bg-purple-500/10 border-l-4 border-l-purple-500' : ''}`}>
                <p className="font-headline text-xs font-bold text-zinc-200 truncate">{u.displayName || u.email}</p>
                <p className="text-[9px] font-label text-zinc-600 truncate">{u.email}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Character Selection */}
        <div className="lg:col-span-1 bg-surface-container-lowest border border-zinc-800 flex flex-col h-[600px] machined-edge">
           <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
             <p className="text-[10px] font-label uppercase text-zinc-500">Agentes_do_Usuário</p>
           </div>
           <div className="flex-1 overflow-y-auto">
             {!selectedUser ? (
               <p className="p-6 text-center text-[10px] text-zinc-700 uppercase">Selecione um usuário</p>
             ) : characters.map(c => (
               <button key={c.id} onClick={() => handleSelectChar(selectedUser.uid, c)} className={`w-full text-left px-4 py-4 border-b border-zinc-800/50 ${selectedChar?.id === c.id ? 'bg-orange-500/10 border-l-4 border-l-orange-500' : ''}`}>
                 <p className="font-headline text-xs font-bold text-zinc-200">{c.codinome}</p>
                 <p className="text-[8px] font-mono text-zinc-600 uppercase">Status: {c.agentStatus} // NVL: {c.dangerLevel}</p>
               </button>
             ))}
           </div>
        </div>

        {/* Inventory View */}
        <div className="lg:col-span-2 flex flex-col h-[600px] gap-4">
          {!selectedChar ? (
            <div className="flex-1 bg-surface-container-lowest border border-zinc-800 machined-edge flex items-center justify-center">
              <p className="font-label text-xs uppercase text-zinc-600">Selecione um agente para gerenciar</p>
            </div>
          ) : (
            <div className="flex-1 bg-surface-container-lowest border border-zinc-800 machined-edge flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
                <div>
                  <h3 className="font-headline font-bold text-zinc-100">{selectedChar.codinome}</h3>
                  <p className="text-[9px] font-label text-zinc-500 uppercase">Inventário Ativo // {inventory.length} Itens</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="bg-purple-900/40 text-purple-300 px-4 py-2 text-[10px] font-bold border border-purple-700/30 uppercase hover:bg-purple-800/40">Add Item</button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
                {inventory.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-zinc-800/20">
                    <span className="material-symbols-outlined text-zinc-600 text-sm">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-zinc-300">{item.label}</p>
                      <p className="text-[8px] text-zinc-600 uppercase">{item.sublabel}</p>
                    </div>
                    {playCounts[item.id] > 0 && (
                      <span className="text-[8px] font-mono bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">Plays: {playCounts[item.id]}</span>
                    )}
                    <button onClick={() => executeRemove(item)} className="material-symbols-outlined text-sm text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && selectedChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-purple-500/30 w-full max-w-xl machined-edge flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="font-headline text-lg text-zinc-200 uppercase">Vincular Recurso: {selectedChar.codinome}</h3>
            </div>
            <div className="flex border-b border-zinc-800">
              <button onClick={() => setAddTab('audio')} className={`flex-1 py-3 text-[10px] font-label uppercase ${addTab === 'audio' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-zinc-600'}`}>Arquivos de Áudio</button>
              <button onClick={() => setAddTab('evidence')} className={`flex-1 py-3 text-[10px] font-label uppercase ${addTab === 'evidence' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-zinc-600'}`}>Arquivos Intel</button>
            </div>
            <div className="p-4 border-b border-zinc-800">
              <input type="text" placeholder="BUSCAR..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase px-3 py-2 text-zinc-300" />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {(addTab === 'audio' ? filteredAudiosForAdd : filteredEvidenceForAdd).map((item: any) => {
                const id = item.id;
                const alreadyHas = inventoryIds.has(id);
                const isSelected = selectedToAdd.has(id);
                return (
                  <div key={id} onClick={() => !alreadyHas && setSelectedToAdd(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })} className={`flex items-center gap-3 px-4 py-2 border-b border-zinc-800/30 cursor-pointer ${alreadyHas ? 'opacity-30' : isSelected ? 'bg-purple-500/10' : ''}`}>
                    <div className={`w-3 h-3 border ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-700'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-zinc-300 truncate">{item.title || item.originalName}</p>
                      <p className="text-[8px] text-zinc-600 uppercase font-mono">{id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] text-zinc-600 uppercase">{selectedToAdd.size} Selecionados</span>
              <div className="flex gap-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[10px] font-label text-zinc-500 uppercase">Fechar</button>
                <button onClick={executeAddItems} disabled={selectedToAdd.size === 0 || addLoading} className="bg-purple-700 text-white px-6 py-2 text-[10px] font-label uppercase">Adicionar</button>
              </div>
            </div>
            {addFeedback && <p className="p-4 text-center text-[10px] font-mono text-emerald-500 uppercase">{addFeedback}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
