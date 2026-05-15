import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { intelRegistry } from '../../data/intel_registry';
import { userService } from '../../services/UserService';
import { activityLogger } from '../../services/ActivityLogger';
import { CharacterData } from '../../types/player';
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

export type AddTabType = 'audio' | 'evidence';

interface BulkInventoryModalProps {
  uid?: string;
  character?: CharacterData;
  title?: string;
  existingItemIds?: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
  onExecuteBulk?: (selectedIds: Set<string>) => Promise<void>;
}

export default function BulkInventoryModal({ uid, character, title, existingItemIds = new Set(), onClose, onSuccess, onExecuteBulk }: BulkInventoryModalProps) {
  const [allAudios, setAllAudios] = useState<AudioData[]>([]);
  const [addTab, setAddTab] = useState<AddTabType>('audio');
  const [addSearch, setAddSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [addLoading, setAddLoading] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

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

  const executeAddItems = async () => {
    if (selectedToAdd.size === 0) return;
    setAddLoading(true);
    try {
      if (onExecuteBulk) {
        await onExecuteBulk(selectedToAdd);
      } else {
        if (!uid || !character) throw new Error("Character data missing for default execution");
        await Promise.all([...selectedToAdd].map((id) => userService.addUserIntel(uid, character.id, id)));
      }
      setAddFeedback(`✓ ${selectedToAdd.size} item(s) vinculados.`);
      if (character) {
        activityLogger.logAdmin('gm.mpg', 'inventory_add', `Adicionou ${selectedToAdd.size} itens para ${character.codinome}`, { uid, charId: character.id, items: [...selectedToAdd] });
      }
      setSelectedToAdd(new Set());
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) { 
      setAddFeedback('ERRO: Falha na vinculação.'); 
    } finally { 
      setAddLoading(false); 
    }
  };

  const filteredAudiosForAdd = useMemo(() => allAudios.filter(a => (a.title || a.originalName || '').toLowerCase().includes(addSearch.toLowerCase())), [allAudios, addSearch]);
  const allRegistryIntel = useMemo(() => intelRegistry.getAll(), []);
  const filteredEvidenceForAdd = useMemo(() => allRegistryIntel.filter(i => (i.title || '').toLowerCase().includes(addSearch.toLowerCase()) || (i.id || '').toLowerCase().includes(addSearch.toLowerCase())), [allRegistryIntel, addSearch]);

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => { if (!addLoading) onClose(); }}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="bg-[#222] border-l-8 border-[#1a1a1a] w-full max-w-2xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra" onClick={e => e.stopPropagation()}>
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
        <div className="noise-overlay" /><div className="scanlines" />
        
        <div className="p-8 border-b-4 border-[#1a1a1a] bg-black/40 relative z-10 flex justify-between items-center">
          <div>
            <h3 className="font-black text-xl text-white uppercase tracking-widest">{title || 'Injetar_Recurso_no_Vetor'}</h3>
            {character && <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Alvo: <span className="text-primary">{character.codinome}</span></p>}
          </div>
          <button onClick={onClose} className="p-2 text-zinc-600 hover:text-white transition-all material-symbols-outlined rounded-sm">close</button>
        </div>
        
        <div className="flex border-b-2 border-[#1a1a1a] bg-black/20 relative z-10 shrink-0">
          <button onClick={() => setAddTab('audio')} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${addTab === 'audio' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-zinc-600 hover:text-zinc-400'}`}>Arquivos Áudio</button>
          <button onClick={() => setAddTab('evidence')} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${addTab === 'evidence' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-zinc-600 hover:text-zinc-400'}`}>Registros Intel</button>
        </div>
        
        <div className="p-6 border-b-2 border-[#1a1a1a] bg-black/40 relative z-10 shrink-0">
           <div className="relative group">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
             <input type="text" placeholder="LOCALIZAR NO ACERVO..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold uppercase px-12 py-4 text-white outline-none focus:ring-1 focus:ring-primary transition-all rounded-sm placeholder:text-zinc-800 tracking-widest" />
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/10 relative z-10">
          <div className="grid grid-cols-1 gap-2">
            {(addTab === 'audio' ? filteredAudiosForAdd : filteredEvidenceForAdd).map((item: any) => {
              const id = item.id;
              const alreadyHas = existingItemIds.has(id);
              const isSelected = selectedToAdd.has(id);
              return (
                <div 
                  key={id} 
                  onClick={() => !alreadyHas && setSelectedToAdd(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })} 
                  className={`flex items-center gap-4 px-5 py-4 border-2 transition-all rounded-sm ${alreadyHas ? 'opacity-30 grayscale border-transparent cursor-not-allowed bg-[#111]' : isSelected ? 'bg-primary/10 border-primary/40' : 'bg-[#1a1a1a] border-[#1a1a1a] hover:border-primary/20 hover:bg-white/5 cursor-pointer group'}`}
                >
                  <div className={`w-6 h-6 border-2 rounded-sm flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-primary border-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'border-zinc-800 group-hover:border-zinc-600'}`}>
                     {isSelected && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-black uppercase truncate ${isSelected ? 'text-primary' : 'text-zinc-300 group-hover:text-white'}`}>{item.title || item.originalName}</p>
                    <p className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-widest mt-1">ID: {id}</p>
                  </div>
                  {alreadyHas && <span className="text-[8px] font-black uppercase bg-black/60 text-zinc-500 px-3 py-1 border border-white/5 rounded-sm">PRESENTE</span>}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="p-8 border-t-4 border-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center bg-black/40 gap-6 relative z-10 shrink-0">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{selectedToAdd.size} PENDENTES_PARA_INJEÇÃO</span>
          <div className="flex gap-4 w-full sm:w-auto">
            <button onClick={onClose} disabled={addLoading} className="flex-1 sm:flex-none px-6 py-4 text-[10px] font-black text-zinc-600 hover:text-white transition-colors uppercase tracking-widest disabled:opacity-50">CANCELAR</button>
            <button onClick={executeAddItems} disabled={selectedToAdd.size === 0 || addLoading} className="flex-2 sm:flex-none bg-primary text-black px-10 py-4 rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-primary-container transition-all active:scale-95 disabled:opacity-20 glow-orange shadow-lg">
              {addLoading ? 'SINCRONIZANDO...' : 'SINCRONIZAR_DADOS'}
            </button>
          </div>
        </div>
        {addFeedback && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm border border-emerald-500/50 px-6 py-3 rounded-full text-[10px] font-black text-emerald-400 uppercase z-50 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="material-symbols-outlined text-sm">check_circle</span> {addFeedback}
          </div>
        )}
      </motion.div>
    </div>
  );
}
