import React, { useState } from 'react';
import { intelRegistry } from '../../data/intel_registry';
import { IntelType } from '../../types/intel';
import Screw from '../../components/player/Screw';

interface GrantIntelModalProps {
  onClose: () => void;
  onGrant: (intelId: string) => Promise<void>;
  title?: string;
}

export default function GrantIntelModal({ onClose, onGrant, title = "LIBERAR_RECURSO_PARA_IDENTIDADE" }: GrantIntelModalProps) {
  const [activeType, setActiveType] = useState<IntelType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const allItems = intelRegistry.getAll();
  const filteredItems = allItems.filter(item => {
    const matchesType = activeType === 'ALL' || item.type === activeType;
    const matchesSearch = item.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (item.metadata?.npc || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleGrant = async (id: string) => {
    setLoading(true);
    try {
      await onGrant(id);
      onClose();
    } catch (error) {
      console.error("Error granting intel:", error);
    } finally {
      setLoading(false);
    }
  };

  const typeIcons: Record<string, string> = {
    AUDIO: 'album',
    VISUAL: 'photo_library',
    TEXT: 'description',
    META: 'workspace_premium',
    ALL: 'grid_view'
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
      <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden font-chakra">
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
        <div className="noise-overlay" /><div className="scanlines" />

        <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-center bg-black/40 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-6 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.5)]" />
            <h3 className="font-black text-lg text-white uppercase tracking-[0.2em]">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-600 hover:text-white transition-all material-symbols-outlined rounded-sm">close</button>
        </div>

        <div className="p-6 bg-black/40 flex flex-wrap gap-3 border-b-2 border-[#1a1a1a] relative z-10">
          {(['ALL', 'AUDIO', 'VISUAL', 'TEXT', 'META'] as const).map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-sm font-black text-[10px] tracking-widest transition-all border-2 uppercase ${
                activeType === type 
                ? 'bg-primary text-black border-primary' 
                : 'text-zinc-600 border-[#1a1a1a] hover:text-zinc-400 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{typeIcons[type]}</span>
              {type}
            </button>
          ))}
        </div>

        <div className="p-6 bg-black/20 border-b-2 border-[#1a1a1a] relative z-10">
           <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
              <input 
                type="text" 
                placeholder="BUSCAR_POR_ID_TITULO_OU_NPC..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-12 py-4 text-[10px] focus:ring-1 focus:ring-primary outline-none uppercase tracking-widest font-black rounded-sm"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-black/20 relative z-10">
          {filteredItems.length > 0 ? (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                className="group flex items-center justify-between p-5 bg-[#1a1a1a] border-2 border-[#1a1a1a] hover:border-primary/40 transition-all rounded-xl shadow-lg active:scale-[0.99]"
              >
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-sm bg-black border-2 border-[#1a1a1a] text-xs transition-all group-hover:border-primary/20 ${
                    item.type === 'AUDIO' ? 'text-amber-500' :
                    item.type === 'VISUAL' ? 'text-cyan-500' :
                    item.type === 'TEXT' ? 'text-emerald-500' : 'text-primary'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{typeIcons[item.type]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black text-zinc-200 uppercase truncate group-hover:text-white transition-colors">{item.title}</div>
                    <div className="text-[8px] font-mono text-zinc-700 font-bold uppercase tracking-widest mt-1">ID: {item.id.slice(0,24)}... // LVL: {item.level}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleGrant(item.id)}
                  disabled={loading}
                  className="bg-primary/10 text-primary border-2 border-primary/20 px-6 py-2 rounded-sm font-black text-[9px] tracking-widest uppercase hover:bg-primary hover:text-black transition-all active:scale-95 disabled:opacity-10 glow-orange"
                >
                  {loading ? 'SINC...' : 'VINCULAR'}
                </button>
              </div>
            ))
          ) : (
            <div className="p-24 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20">
               <p className="text-[10px] font-black uppercase tracking-[0.4em]">Acervo_Não_Identificado</p>
            </div>
          )}
        </div>

        <div className="p-8 border-t-4 border-[#1a1a1a] bg-black/40 flex justify-between items-center relative z-10 shrink-0">
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{filteredItems.length} ENTRADAS MAPEADAS</span>
          <button onClick={onClose} className="px-10 py-3 bg-[#333] hover:bg-[#444] text-white text-[10px] font-black uppercase tracking-widest transition-all rounded-sm">ENCERRAR</button>
        </div>
      </div>
    </div>
  );
}
