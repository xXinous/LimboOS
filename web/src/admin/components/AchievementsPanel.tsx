import React, { useState } from 'react';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import Screw from '../../components/player/Screw';

export default function AchievementsPanel() {
  const [search, setSearch] = useState('');

  const filteredAchievements = ALL_ACHIEVEMENTS.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="space-y-8 font-chakra">
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-secondary rounded-full animate-pulse shadow-[0_0_10px_rgba(198,198,198,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">Catálogo_Global_de_Conquistas</h2>
      </div>

      <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl flex flex-col h-[550px] shadow-2xl overflow-hidden relative">
        <div className="p-6 border-b-4 border-[#1a1a1a] bg-black/40 flex justify-between items-center relative z-10">
           <div className="relative w-full max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
              <input type="text" placeholder="FILTRAR_CATÁLOGO..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-black/40 border-2 border-white/5 text-[11px] font-black uppercase px-12 py-3 text-white outline-none focus:border-secondary transition-all rounded-sm" />
           </div>
           <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-4">{filteredAchievements.length} MEDALHAS MAPEADAS</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-black/20 custom-scrollbar relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAchievements.length === 0 && (
             <div className="col-span-full p-24 text-center opacity-20 flex flex-col items-center">
                <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhum_Registro_Encontrado</p>
             </div>
          )}
          {filteredAchievements.map(ach => (
            <div key={ach.id} className="bg-black border-2 border-[#1a1a1a] p-6 rounded-xl flex items-start gap-5 group hover:border-secondary/20 transition-all shadow-lg">
               <div className="w-14 h-14 shrink-0 bg-secondary/10 flex items-center justify-center rounded-full border border-secondary/20 text-3xl shadow-inner group-hover:scale-110 transition-transform">
                 {ach.icon}
               </div>
               <div>
                 <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-secondary transition-colors">{ach.title}</h4>
                 <p className="text-[9px] font-mono text-zinc-600 font-bold uppercase mt-1 tracking-widest mb-3">ID: {ach.id}</p>
                 {ach.description && <p className="text-[10px] text-zinc-400 font-bold leading-relaxed">{ach.description}</p>}
               </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
