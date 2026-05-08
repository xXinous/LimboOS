import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { userService } from '../../services/UserService';
import { intelRegistry } from '../../data/intel_registry';
import { db } from '../../lib/firebase';
import RetroSpinner from '../../components/player/RetroSpinner';
import { activityLogger } from '../../services/ActivityLogger';
import { CharacterData, PlayerStats } from '../../types/player';
import GrantIntelModal from './GrantIntelModal';
import { useModal } from './ConfirmModal';
import Screw from '../../components/player/Screw';

interface AgentDossierViewProps {
  uid: string;
  character: CharacterData;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AgentDossierView({ uid, character, onClose, onUpdate }: AgentDossierViewProps) {
  const [details, setDetails] = useState<{
    tapes: { id: string; unlockedAt: any }[];
    playCounts: any[];
    stats: PlayerStats | null;
    achievements: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Partial<CharacterData>>(character);
  const [saveLoading, setSaveLoading] = useState(false);
  const { showConfirm, modal } = useModal();

  useEffect(() => {
    loadDetails();
  }, [uid, character.id]);

  const loadDetails = async () => {
    setLoading(true);
    const data = await userService.loadUserDetails(uid, character.id);
    setDetails(data);
    setLoading(false);
  };

  const handleUpdateChar = async () => {
    setSaveLoading(true);
    try {
      await userService.updateCharacter(uid, character.id, editingChar);
      onUpdate();
    } catch (error) {
      console.error("Error updating character:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteChar = async () => {
    const ok = await showConfirm('Excluir Agente', `AVISO CRÍTICO: Você está prestes a apagar o agente "${character.codinome}" PERMANENTEMENTE. Confirmar?`, 'Excluir');
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.deleteCharacter(uid, character.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error deleting character:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGrantIntel = async (intelId: string) => {
    await userService.addUserIntel(uid, character.id, intelId);
    await loadDetails();
  };

  const handleRemoveIntel = async (intelId: string) => {
    const ok = await showConfirm('Remover Item', "Remover este item do inventário do agente?", 'Remover');
    if (!ok) return;
    await userService.removeUserIntel(uid, character.id, intelId);
    await loadDetails();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RetroSpinner />
    </div>
  );

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/95 p-4 lg:p-8 backdrop-blur-xl overflow-y-auto">
      <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-6xl rounded-[32px] shadow-2xl flex flex-col min-h-[90vh] lg:h-[90vh] relative overflow-hidden font-chakra">
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
        <div className="noise-overlay" /><div className="scanlines" />
        
        {/* Header */}
        <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-start bg-black/40 relative z-10">
          <div className="flex gap-8">
             <div className="w-28 h-28 bg-black border-4 border-[#1a1a1a] rounded-sm flex items-center justify-center overflow-hidden relative group shadow-xl">
                {character.profilePhotoUrl ? (
                  <img src={character.profilePhotoUrl} alt={character.codinome} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-zinc-800">person</span>
                )}
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <div className="space-y-4">
                <div className="flex items-center gap-4">
                   <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{character.codinome}</h2>
                   <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border-2 ${
                     character.agentStatus === 'vivo' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                     character.agentStatus === 'morto' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                     'bg-[#333] text-zinc-500 border-[#444]'
                   }`}>
                     {character.agentStatus}
                   </span>
                </div>
                <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest font-bold">REGISTRO: RM-{character.id} // SINAL_CAPTADO: {character.createdAt ? format(character.createdAt.toDate(), 'yyyy/MM/dd') : '---'}</p>
                
                <div className="flex flex-wrap gap-8 items-end">
                   <div className="space-y-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Nível_de_Ameaça</span>
                      <div className="flex gap-1.5">
                        {[1,2,3,4,5].map(lv => (
                          <div 
                            key={lv} 
                            onClick={() => setEditingChar(prev => ({ ...prev, dangerLevel: lv }))}
                            className={`w-6 h-2.5 rounded-sm cursor-pointer transition-all ${lv <= (editingChar.dangerLevel || 1) ? 'bg-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'bg-black border border-white/5 hover:border-primary/20'}`}
                          />
                        ))}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Status_Identidade</span>
                      <select 
                        value={editingChar.agentStatus} 
                        onChange={(e) => setEditingChar(prev => ({ ...prev, agentStatus: e.target.value as any }))}
                        className="bg-black/60 border-2 border-[#1a1a1a] text-[10px] font-black text-primary px-4 py-2 outline-none uppercase rounded-sm focus:border-primary"
                      >
                        <option value="vivo">ATIVO</option>
                        <option value="morto">ELIMINADO</option>
                        <option value="desaparecido">DESAPARECIDO</option>
                      </select>
                   </div>
                   <div className="flex gap-3">
                      <button 
                        onClick={handleUpdateChar}
                        disabled={saveLoading}
                        className="bg-primary hover:bg-primary-container text-black px-8 py-2.5 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 glow-orange"
                      >
                        {saveLoading ? 'SINC...' : 'ATUALIZAR_REGISTROS'}
                      </button>
                      <button 
                        onClick={handleDeleteChar}
                        disabled={saveLoading}
                        className="bg-red-950/20 text-red-500 border-2 border-red-500/20 px-3 py-2 rounded-sm hover:bg-red-500 hover:text-white transition-all active:scale-95"
                        title="ELIMINAR AGENTE"
                      >
                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                      </button>
                   </div>
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-3 text-zinc-600 hover:text-white hover:bg-white/5 transition-all material-symbols-outlined rounded-sm">close</button>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
          
          {/* Sidebar / Stats */}
          <div className="w-full lg:w-80 border-r-4 border-[#1a1a1a] bg-black/20 p-8 space-y-10 overflow-y-auto custom-scrollbar">
             <div>
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-6 border-b border-white/5 pb-2">Atividade_em_Campo</h3>
                <div className="grid grid-cols-2 gap-4">
                   <StatBox label="Tempo_Escuta" value={formatSecs(details?.stats?.totalListenTime || 0)} />
                   <StatBox label="Fidget_Log" value={details?.stats?.fidgetClicks || 0} />
                   <StatBox label="Screw_Log" value={details?.stats?.screwClicks || 0} />
                   <StatBox label="Pico_Volume" value={formatSecs(details?.stats?.maxVolumeTime || 0)} />
                </div>
             </div>

             <div>
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-6 border-b border-white/5 pb-2">Medalhas_Detectadas</h3>
                <div className="space-y-3">
                   {details?.achievements && details.achievements.length > 0 ? (
                     details.achievements.map(achId => (
                       <div key={achId} className="flex items-center gap-4 p-3 bg-black/40 border border-white/5 rounded-sm group hover:border-primary/20 transition-all">
                          <div className="w-8 h-8 bg-primary/10 text-primary flex items-center justify-center rounded-full border border-primary/20 shadow-lg">
                             <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-primary transition-colors">{achId}</span>
                       </div>
                     ))
                   ) : (
                     <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-sm opacity-20">
                        <p className="text-[9px] font-black uppercase tracking-widest">Nenhuma_Medalha</p>
                     </div>
                   )}
                </div>
             </div>

             <div className="pt-6">
                <button 
                  onClick={() => setShowGrantModal(true)}
                  className="w-full py-4 bg-primary/5 text-primary border-2 border-primary/20 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-primary hover:text-black transition-all flex items-center justify-center gap-3 rounded-sm active:scale-95 shadow-lg"
                >
                  <span className="material-symbols-outlined text-sm">add_box</span> LIBERAR_INTEL
                </button>
             </div>
          </div>

          {/* Main Inventory Grid */}
          <div className="flex-1 bg-black/40 p-8 overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Cofre_de_Evidências</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Registros_Totais: {details?.tapes.length}</span>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {details?.tapes.map(t => {
                  const intel = intelRegistry.get(t.id);
                  return (
                    <div key={t.id} className="group relative bg-[#1a1a1a] border-4 border-[#1a1a1a] p-6 hover:border-primary/30 transition-all rounded-xl shadow-xl overflow-hidden active:scale-98">
                       <div className="absolute top-0 right-0 w-10 h-10 bg-primary/5 rotate-45 translate-x-5 -translate-y-5 border-b border-primary/10" />
                       <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-sm bg-black border border-white/5 text-xs transition-all group-hover:border-primary/20 ${
                            intel?.type === 'AUDIO' ? 'text-amber-500' :
                            intel?.type === 'VISUAL' ? 'text-cyan-500' :
                            intel?.type === 'TEXT' ? 'text-emerald-500' : 'text-primary'
                          }`}>
                             <span className="material-symbols-outlined text-[20px]">
                               {intel?.type === 'AUDIO' ? 'album' : 
                                intel?.type === 'VISUAL' ? 'photo_library' : 
                                intel?.type === 'TEXT' ? 'description' : 'shield'}
                             </span>
                          </div>
                          <button 
                            onClick={() => handleRemoveIntel(t.id)}
                            className="p-1.5 text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                       </div>
                       <h4 className="text-[12px] font-black text-white uppercase truncate mb-1 group-hover:text-primary transition-colors">{intel?.title || t.id}</h4>
                       <p className="font-mono text-[9px] text-zinc-600 font-bold uppercase truncate mb-4">ID: {t.id}</p>
                       <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest border-t border-white/5 pt-4">
                          <span className="truncate max-w-[120px]">{intel?.metadata?.npc || 'SISTEMA'}</span>
                          <span className="text-primary/40">LVL_{intel?.level || 1}</span>
                       </div>
                    </div>
                  );
                })}

                {details?.tapes.length === 0 && (
                  <div className="col-span-full p-32 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20 flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-6xl mb-4">folder_off</span>
                    <p className="text-[12px] font-black uppercase tracking-[0.4em]">Inventário_Inativo</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {showGrantModal && (
          <GrantIntelModal 
            onClose={() => setShowGrantModal(false)} 
            onGrant={handleGrantIntel} 
            title={`Liberar Recurso: ${character.codinome}`}
          />
        )}
        {modal}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-black/60 border border-white/5 p-4 flex flex-col justify-center rounded-sm shadow-inner group hover:border-primary/20 transition-all">
      <span className="text-[8px] uppercase tracking-widest text-zinc-600 mb-2 font-black">{label}</span>
      <span className="font-black text-sm text-zinc-300 group-hover:text-primary transition-colors">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
