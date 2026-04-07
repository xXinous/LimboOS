import React, { useState, useEffect, useCallback } from 'react';
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
import { format } from 'date-fns';
import { useModal } from './ConfirmModal';
import { EVIDENCE_TAPES_FOR_ADMIN, type EvidenceTapeAdmin } from '../../data/tapes';
import { activityLogger } from '../../services/ActivityLogger';

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
}

interface InventoryItem {
  tapeId: string;
  unlockedAt?: any;
  type: 'audio' | 'evidence';
  label: string;
  sublabel?: string;
  icon: string;
}

type AddTabType = 'audio' | 'evidence';

export default function InventoryManager() {
  const { showAlert, modal } = useModal();

  // ── Players ────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');

  // ── Audio catalog ──────────────────────────────────────────────────────────
  const [allAudios, setAllAudios] = useState<AudioData[]>([]);

  // ── Inventory of selected player ───────────────────────────────────────────
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // ── Play counts ────────────────────────────────────────────────────────────
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});

  // ── Confirm remove ─────────────────────────────────────────────────────────
  const [confirmRemove, setConfirmRemove] = useState<InventoryItem | null>(null);

  // ── Add Item modal ─────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<AddTabType>('audio');
  const [addSearch, setAddSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [addLoading, setAddLoading] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  // ── Load users ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserData[] = [];
      snap.forEach((d) => list.push(d.data() as UserData));
      setUsers(list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
    });
    return () => unsub();
  }, []);

  // ── Load audio catalog ─────────────────────────────────────────────────────
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
        });
      });
      setAllAudios(list);
    });
    return () => unsub();
  }, []);

  // ── Load play counts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;
    const q = query(collection(db, 'playEvents'), where('uid', '==', selectedUser.uid));
    getDocs(q).then((snap) => {
      const counts: Record<string, number> = {};
      snap.forEach((d) => {
        const tid = d.data().tapeId;
        if (tid) counts[tid] = (counts[tid] || 0) + 1;
      });
      setPlayCounts(counts);
    });
  }, [selectedUser]);

  // ── Load inventory for selected player ─────────────────────────────────────
  const loadInventory = useCallback(async (uid: string) => {
    setInventoryLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'tapes'));
      const items: InventoryItem[] = [];

      snap.forEach((d) => {
        const tapeId = d.id;
        const data = d.data();

        // Check if it's an evidence tape
        const evidenceTape = EVIDENCE_TAPES_FOR_ADMIN.find((e) => e.id === tapeId);
        if (evidenceTape) {
          items.push({
            tapeId,
            unlockedAt: data.unlockedAt,
            type: 'evidence',
            label: evidenceTape.title,
            sublabel: evidenceTape.chapter,
            icon: evidenceTape.type === 'disk' ? 'save' : 'description',
          });
          return;
        }

        // Otherwise, it's an audio tape — look it up in catalog
        const audio = allAudios.find((a) => a.id === tapeId);
        items.push({
          tapeId,
          unlockedAt: data.unlockedAt,
          type: 'audio',
          label: audio?.title || audio?.originalName || tapeId,
          sublabel: audio?.artist || '',
          icon: 'album',
        });
      });

      // Sort: evidence first, then audio; alphabetically within each group
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'evidence' ? -1 : 1;
        return a.label.localeCompare(b.label);
      });

      setInventory(items);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [allAudios]);

  const handleSelectUser = (user: UserData) => {
    setSelectedUser(user);
    setInventory([]);
    setPlayCounts({});
    loadInventory(user.uid);
  };

  // Reload when allAudios changes and a user is selected
  useEffect(() => {
    if (selectedUser) loadInventory(selectedUser.uid);
  }, [allAudios]); // eslint-disable-line

  // ── Remove item ────────────────────────────────────────────────────────────
  const executeRemove = async (item: InventoryItem) => {
    if (!selectedUser) return;
    setConfirmRemove(null);
    activityLogger.logTrace('gm.mpg', 'inventory_remove_step', `Iniciando remoção do item ${item.tapeId} para o usuário ${selectedUser.uid}...`);
    try {
      await deleteDoc(doc(db, 'users', selectedUser.uid, 'tapes', item.tapeId));
      setInventory((prev) => prev.filter((i) => i.tapeId !== item.tapeId));
      activityLogger.logAdmin('gm.mpg', 'inventory_remove', `Removeu ${item.label} de ${selectedUser.displayName || selectedUser.username}`, { uid: selectedUser.uid, tapeId: item.tapeId, itemLabel: item.label });
    } catch (err) {
      console.error('Error removing item:', err);
      showAlert('Erro', 'Falha ao remover item do inventário.');
    }
  };

  // ── Add items ──────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setShowAddModal(true);
    setAddTab('audio');
    setAddSearch('');
    setSelectedToAdd(new Set());
    setAddFeedback(null);
  };

  const toggleAddSelection = (id: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const executeAddItems = async () => {
    if (!selectedUser || selectedToAdd.size === 0) return;
    const uid = selectedUser.uid; // captured before async so TS knows it's string
    setAddLoading(true);
    setAddFeedback(null);
    activityLogger.logTrace('gm.mpg', 'inventory_add_step', `Iniciando injeção de ${selectedToAdd.size} item(s) no inventário de ${uid}...`);
    try {
      await Promise.all(
        [...selectedToAdd].map((id) =>
          setDoc(doc(db, 'users', uid, 'tapes', id), {
            tapeId: id,
            unlockedAt: serverTimestamp(),
          })
        )
      );
      setAddFeedback(`✓ ${selectedToAdd.size} item(s) adicionado(s) com sucesso.`);
      activityLogger.logAdmin('gm.mpg', 'inventory_add', `Adicionou ${selectedToAdd.size} item(s) para ${selectedUser.displayName || selectedUser.username}`, { uid, items: [...selectedToAdd] });
      setSelectedToAdd(new Set());
      await loadInventory(uid);
    } catch (err) {
      console.error('Error adding items:', err);
      setAddFeedback('ERRO: Falha ao adicionar itens.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const inventoryIds = new Set(inventory.map((i) => i.tapeId));

  const filteredAudiosForAdd = allAudios.filter((a) => {
    const q = addSearch.toLowerCase();
    const matches =
      (a.title || a.originalName || '').toLowerCase().includes(q) ||
      (a.artist || '').toLowerCase().includes(q);
    return matches;
  });

  const filteredEvidenceForAdd = EVIDENCE_TAPES_FOR_ADMIN.filter((e) => {
    const q = addSearch.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.chapter.toLowerCase().includes(q);
  });

  const filteredPlayers = users.filter((u) => {
    const q = playerSearch.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const audioItems = inventory.filter((i) => i.type === 'audio');
  const evidenceItems = inventory.filter((i) => i.type === 'evidence');

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <section className="space-y-0">
      {modal}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-2 h-6 bg-purple-500" />
        <h2 className="font-headline font-bold uppercase tracking-widest text-lg">
          Inventory_Manager
        </h2>
        <span className="text-[10px] font-label text-zinc-500 tracking-wider">
          {users.length} PLAYERS • {allAudios.length} AUDIOS • {EVIDENCE_TAPES_FOR_ADMIN.length} EVIDENCE_ITEMS
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '70vh' }}>

        {/* ── Left: Player list ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 bg-surface-container-lowest border border-zinc-800 machined-edge flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <p className="text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-2">
              Select_Player
            </p>
            <input
              type="text"
              placeholder="SEARCH_PLAYER..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder:text-zinc-700 text-zinc-300 px-3 py-2"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredPlayers.length === 0 ? (
              <div className="p-6 text-center text-zinc-600 font-label text-xs tracking-widest">
                NO_PLAYERS_FOUND
              </div>
            ) : (
              filteredPlayers.map((u) => {
                const isSelected = selectedUser?.uid === u.uid;
                return (
                  <button
                    key={u.uid}
                    onClick={() => handleSelectUser(u)}
                    className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-purple-500/10 border-l-4 border-l-purple-500'
                        : 'hover:bg-zinc-800/40 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-headline text-xs font-bold truncate ${isSelected ? 'text-purple-300' : 'text-zinc-200'}`}>
                        {u.displayName || u.username || 'UNKNOWN'}
                      </p>
                      <p className="text-[9px] font-label text-zinc-600 truncate mt-0.5">{u.email}</p>
                    </div>
                    <span className={`text-[8px] font-label uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${
                      u.role === 'admin'
                        ? 'border-red-500/30 text-red-400/80'
                        : u.role === 'premium'
                          ? 'border-orange-500/30 text-orange-400/80'
                          : 'border-zinc-700 text-zinc-500'
                    }`}>
                      {u.role}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Inventory ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {!selectedUser ? (
            <div className="flex-1 bg-surface-container-lowest border border-zinc-800 machined-edge flex items-center justify-center" style={{ minHeight: '400px' }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-3">inventory_2</span>
                <p className="font-label text-xs uppercase tracking-widest text-zinc-600">
                  Select_a_player_to_manage_inventory
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Player header */}
              <div className="bg-surface-container-lowest border border-zinc-800 machined-edge p-4 flex items-center justify-between">
                <div>
                  <p className="font-headline font-bold text-base text-zinc-100">
                    {selectedUser.displayName || selectedUser.username}
                  </p>
                  <p className="text-[9px] font-label text-zinc-500 mt-0.5">
                    {selectedUser.email} · {inventory.length} ITEM(S)
                  </p>
                </div>
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 bg-purple-900/40 text-purple-300 px-4 py-2 font-label text-[10px] font-bold tracking-widest hover:bg-purple-800/40 transition-all machined-edge border border-purple-700/30"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  ADD_ITEM
                </button>
              </div>

              {inventoryLoading ? (
                <div className="bg-surface-container-lowest border border-zinc-800 machined-edge p-12 text-center">
                  <span className="material-symbols-outlined text-2xl text-zinc-600 animate-spin block mb-2">sync</span>
                  <p className="font-label text-xs text-zinc-600 tracking-widest">LOADING_INVENTORY...</p>
                </div>
              ) : (
                <>
                  {/* Evidence section */}
                  <div className="bg-surface-container-lowest border border-zinc-800 machined-edge">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                      <span className="material-symbols-outlined text-yellow-500 text-sm">save</span>
                      <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">
                        Evidence_Items ({evidenceItems.length})
                      </h3>
                    </div>

                    {evidenceItems.length === 0 ? (
                      <div className="p-6 text-center text-zinc-700 font-label text-xs tracking-widest">
                        NO_EVIDENCE_IN_INVENTORY
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/50">
                        {evidenceItems.map((item) => (
                          <div key={item.tapeId} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors group">
                            <div className="w-8 h-8 bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-yellow-500 text-sm">{item.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-headline text-xs font-bold text-zinc-200 truncate">{item.label}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                {item.sublabel && (
                                  <span className="text-[9px] font-label text-zinc-500">{item.sublabel}</span>
                                )}
                                {item.unlockedAt && (
                                  <span className="text-[8px] font-label text-zinc-700">
                                    {item.unlockedAt?.toDate
                                      ? format(item.unlockedAt.toDate(), 'dd/MM/yy HH:mm')
                                      : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[8px] font-label text-zinc-700 truncate max-w-[100px] hidden sm:block">
                              {item.tapeId}
                            </span>
                            <button
                              onClick={() => setConfirmRemove(item)}
                              className="material-symbols-outlined text-sm text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remover do inventário"
                            >
                              remove_circle
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Audio tapes section */}
                  <div className="bg-surface-container-lowest border border-zinc-800 machined-edge">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                      <span className="material-symbols-outlined text-orange-500 text-sm">album</span>
                      <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">
                        Audio_Tapes ({audioItems.length})
                      </h3>
                    </div>

                    {audioItems.length === 0 ? (
                      <div className="p-6 text-center text-zinc-700 font-label text-xs tracking-widest">
                        NO_AUDIO_TAPES_IN_INVENTORY
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/50">
                        {audioItems.map((item) => {
                          const playCount = playCounts[item.tapeId] || 0;
                          const audioInfo = allAudios.find((a) => a.id === item.tapeId);
                          return (
                            <div key={item.tapeId} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors group">
                              <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-orange-500 text-sm">album</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-headline text-xs font-bold text-zinc-200 truncate">{item.label}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {item.sublabel && (
                                    <span className="text-[9px] font-label text-zinc-500">{item.sublabel}</span>
                                  )}
                                  {audioInfo?.duration ? (
                                    <span className="text-[9px] font-label text-zinc-600">
                                      {formatDuration(audioInfo.duration)}
                                    </span>
                                  ) : null}
                                  {item.unlockedAt && (
                                    <span className="text-[8px] font-label text-zinc-700">
                                      {item.unlockedAt?.toDate
                                        ? format(item.unlockedAt.toDate(), 'dd/MM/yy HH:mm')
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {playCount > 0 && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="material-symbols-outlined text-[10px] text-tertiary">play_circle</span>
                                  <span className="text-[9px] font-label text-tertiary">{playCount}</span>
                                </div>
                              )}
                              <button
                                onClick={() => setConfirmRemove(item)}
                                className="material-symbols-outlined text-sm text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remover do inventário"
                              >
                                remove_circle
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Confirm Remove Modal ──────────────────────────────────────────────── */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-red-500/40 p-6 w-full max-w-sm machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-red-400 text-xl">warning</span>
              <h3 className="font-headline text-lg text-red-400">REMOVE_ITEM</h3>
            </div>
            <p className="font-body text-sm text-zinc-300 mb-2">
              Remover do inventário de{' '}
              <span className="text-purple-300 font-bold">
                {selectedUser?.displayName || selectedUser?.username}
              </span>
              :
            </p>
            <p className="font-headline text-sm text-orange-400 font-bold mb-6">
              {confirmRemove.label}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={() => executeRemove(confirmRemove)}
                className="px-4 py-2 text-xs font-label bg-red-900/60 text-red-300 font-bold tracking-wider hover:bg-red-800/60 transition-all border border-red-700/30"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Modal ────────────────────────────────────────────────────── */}
      {showAddModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-purple-500/30 w-full max-w-xl machined-edge flex flex-col max-h-[85vh]">

            {/* Modal header */}
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-outlined text-purple-400 text-xl">add_circle</span>
                <h3 className="font-headline text-lg text-zinc-200">ADD_ITEM</h3>
              </div>
              <p className="font-body text-xs text-zinc-500">
                Player:{' '}
                <span className="text-purple-300 font-bold">
                  {selectedUser.displayName || selectedUser.username}
                </span>
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              {(['audio', 'evidence'] as AddTabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setAddTab(tab); setAddSearch(''); setSelectedToAdd(new Set()); }}
                  className={`flex-1 py-3 text-[10px] font-label uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    addTab === tab
                      ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/5'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {tab === 'audio' ? 'album' : 'save'}
                  </span>
                  {tab === 'audio' ? 'Audio_Tapes' : 'Evidence_Items'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-zinc-800">
              <input
                type="text"
                placeholder="SEARCH..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder:text-zinc-700 text-zinc-300 px-3 py-2"
              />
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {addTab === 'audio' ? (
                filteredAudiosForAdd.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600 font-label text-xs tracking-widest">NO_AUDIO_FOUND</div>
                ) : (
                  filteredAudiosForAdd.map((a) => {
                    const alreadyHas = inventoryIds.has(a.id);
                    const isSelected = selectedToAdd.has(a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => !alreadyHas && toggleAddSelection(a.id)}
                        className={`flex items-center gap-3 px-5 py-3 border-b border-zinc-800/40 last:border-b-0 transition-all ${
                          alreadyHas
                            ? 'opacity-40 cursor-not-allowed'
                            : isSelected
                              ? 'bg-purple-500/10 cursor-pointer'
                              : 'hover:bg-zinc-800/30 cursor-pointer'
                        }`}
                      >
                        <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                          alreadyHas ? 'border-zinc-700 bg-zinc-800' : isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                        }`}>
                          {alreadyHas ? (
                            <span className="material-symbols-outlined text-zinc-500 text-xs">check</span>
                          ) : isSelected ? (
                            <span className="material-symbols-outlined text-white text-xs">check</span>
                          ) : null}
                        </div>
                        <span className="material-symbols-outlined text-orange-500 text-sm">album</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-headline text-xs font-bold text-zinc-200 truncate">
                            {a.title || a.originalName}
                          </p>
                          <p className="text-[9px] font-label text-zinc-500 truncate">{a.artist || ''}</p>
                        </div>
                        {alreadyHas && (
                          <span className="text-[8px] font-label text-emerald-500 border border-emerald-500/30 px-1.5 py-0.5 shrink-0">
                            IN_INV
                          </span>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                filteredEvidenceForAdd.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600 font-label text-xs tracking-widest">NO_EVIDENCE_FOUND</div>
                ) : (
                  filteredEvidenceForAdd.map((e) => {
                    const alreadyHas = inventoryIds.has(e.id);
                    const isSelected = selectedToAdd.has(e.id);
                    return (
                      <div
                        key={e.id}
                        onClick={() => !alreadyHas && toggleAddSelection(e.id)}
                        className={`flex items-center gap-3 px-5 py-3 border-b border-zinc-800/40 last:border-b-0 transition-all ${
                          alreadyHas
                            ? 'opacity-40 cursor-not-allowed'
                            : isSelected
                              ? 'bg-purple-500/10 cursor-pointer'
                              : 'hover:bg-zinc-800/30 cursor-pointer'
                        }`}
                      >
                        <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                          alreadyHas ? 'border-zinc-700 bg-zinc-800' : isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                        }`}>
                          {alreadyHas ? (
                            <span className="material-symbols-outlined text-zinc-500 text-xs">check</span>
                          ) : isSelected ? (
                            <span className="material-symbols-outlined text-white text-xs">check</span>
                          ) : null}
                        </div>
                        <span className="material-symbols-outlined text-yellow-500 text-sm">
                          {e.type === 'disk' ? 'save' : 'description'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-headline text-xs font-bold text-zinc-200 truncate">{e.title}</p>
                          <p className="text-[9px] font-label text-zinc-500 truncate">{e.chapter}</p>
                        </div>
                        {alreadyHas && (
                          <span className="text-[8px] font-label text-emerald-500 border border-emerald-500/30 px-1.5 py-0.5 shrink-0">
                            IN_INV
                          </span>
                        )}
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-zinc-800">
              {addFeedback && (
                <p className={`text-[10px] font-label tracking-wider mb-3 text-center ${
                  addFeedback.startsWith('ERRO') ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {addFeedback}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-label text-zinc-500 tracking-wider">
                  {selectedToAdd.size} SELECIONADO(S)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAddModal(false); setAddFeedback(null); }}
                    className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
                  >
                    FECHAR
                  </button>
                  <button
                    onClick={executeAddItems}
                    disabled={selectedToAdd.size === 0 || addLoading}
                    className="px-5 py-2 text-xs font-label bg-purple-900/60 text-purple-300 font-bold tracking-wider hover:bg-purple-800/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-purple-700/30"
                  >
                    {addLoading ? 'ADICIONANDO...' : 'ADICIONAR'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
