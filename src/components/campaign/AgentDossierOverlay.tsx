import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Music, MapPin, Search, User as UserIcon, Package, Shield, Crosshair, Radio, Camera, Pencil, Check, Loader2 } from 'lucide-react';
import { updateCodinome, uploadProfilePhoto } from '../../store/firestore';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import type { PlayerData } from '../../types/player';
import type { Campaign } from '../../data/campaigns';
import type { PlayerIntelCollection, IntelItem, AccessLevel } from '../../types/intel';
import { ACCESS_LEVEL_LABELS } from '../../types/intel';

const STATUS_CONFIG = {
  vivo: { label: 'ATIVO', color: 'text-green-500', dot: 'bg-green-500', glow: 'glow-green' },
  morto: { label: 'ELIMINADO', color: 'text-red-500', dot: 'bg-red-500', glow: 'glow-red' },
  desaparecido: { label: 'DESAPARECIDO', color: 'text-yellow-500', dot: 'bg-yellow-500', glow: 'glow-yellow' },
} as const;

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;
const TABS = [
  { id: 'agente', label: 'Agente', Icon: Shield },
  { id: 'intel', label: 'Arquivos', Icon: Radio },
  { id: 'conquistas', label: 'Medalhas', Icon: Trophy },
] as const;

type DossierTab = typeof TABS[number]['id'];

const extractSpotifyEmbedUrl = (url: string) => {
  if (!url) return null;
  const match = url.match(/spotify[:/](playlist|album|track|episode|show)[:/]([a-zA-Z0-9]+)/);
  return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0` : null;
};

interface AgentDossierOverlayProps {
  onClose: () => void;
  playerData: PlayerData;
  campaigns: Campaign[];
  intel: PlayerIntelCollection | null;
}

export const AgentDossierOverlay = ({ onClose, playerData, campaigns, intel }: AgentDossierOverlayProps) => {
  const [activeTab, setActiveTab] = useState<DossierTab>('agente');
  const [selectedIntel, setSelectedIntel] = useState<IntelItem | null>(null);
  const [activeLevel, setActiveLevel] = useState<AccessLevel>(1);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(playerData.character.codinome);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(playerData.character.profilePhotoUrl || '');
  const [currentUsername, setCurrentUsername] = useState(playerData.character.codinome);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => ({
    statusCfg: STATUS_CONFIG[playerData.character.agentStatus || 'vivo'],
    dangerLabel: DANGER_LABELS[playerData.character.dangerLevel || 0],
    lastCampaign: campaigns.find(c => c.id === playerData.character.campaignId),
    earnedIds: new Set(playerData.achievementIds || []),
    embedUrl: extractSpotifyEmbedUrl(playerData.character.spotifyPlaylistUrl || ''),
    initials: currentUsername.split(/[\s\-_]+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  }), [playerData, campaigns, currentUsername]);

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === currentUsername) return setIsEditingName(false);
    setSavingName(true);
    try { await updateCodinome(playerData.uid, playerData.activeCharacterId, trimmed); setCurrentUsername(trimmed); } catch (err) { console.error(err); }
    finally { setSavingName(false); setIsEditingName(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try { const photo = await uploadProfilePhoto(playerData.uid, playerData.activeCharacterId, file); setCurrentPhotoUrl(photo.url); } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  return (
    <div className="w-full h-full bg-surface flex flex-col overflow-hidden touch-none relative rounded-none sm:rounded-[20px] border-0 sm:border-2 border-primary/20">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      <header className="p-6 border-b border-primary/20 flex justify-between items-center bg-surface-container-low/80 backdrop-blur-md relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => fileInputRef.current?.click()} className="relative w-16 h-16 rounded-sm overflow-hidden bg-black border-2 border-primary/30 flex items-center justify-center text-primary font-display font-bold text-xl shadow-lg group">
            {currentPhotoUrl ? <img src={currentPhotoUrl} alt="Perfil" className="w-full h-full object-cover" /> : <span>{stats.initials || '?'}</span>}
            <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-black"><Camera size={20} /></div>
            {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><RetroSpinner size="sm" /></div>}
          </button>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input value={editName} onChange={e => setEditName(e.target.value)} className="font-display text-xl font-bold uppercase tracking-tight text-white bg-transparent border-b-2 border-primary outline-none w-full" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
                <button onClick={handleSaveName} disabled={savingName} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors">{savingName ? <RetroSpinner size="sm" /> : <Check size={16} />}</button>
                <button onClick={() => { setIsEditingName(false); setEditName(currentUsername); }} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="font-display text-xl font-bold uppercase tracking-tight text-white truncate">{currentUsername}</h4>
                <button onClick={() => setIsEditingName(true)} className="p-1 text-primary/30 hover:text-primary transition-colors"><Pencil size={14} /></button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1">
              <div className={`w-2 h-2 rounded-full ${stats.statusCfg.dot} animate-pulse shadow-sm`} />
              <span className={`text-[10px] font-display font-bold tracking-[0.2em] ${stats.statusCfg.color} uppercase`}>{stats.statusCfg.label}</span>
              {playerData.character.agentId && <span className="text-[10px] font-mono text-industrial-silver/30">RM-{playerData.character.agentId}</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-primary/10 rounded-sm transition-all text-primary border border-primary/20 bg-surface group shrink-0"><X size={24} className="group-hover:rotate-90 transition-transform" /></button>
      </header>

      <div className="flex border-b border-primary/10 bg-black/20 shrink-0 relative z-20">
        {[ { val: intel?.counts.total || 0, lab: 'Total Intel' }, { val: stats.earnedIds.size, lab: 'Medalhas' }, { val: intel?.counts.visual || 0, lab: 'Evidências' } ].map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-3 border-r border-primary/10 last:border-r-0">
            <span className="text-primary font-display font-bold text-xl leading-none">{s.val}</span>
            <span className="text-[9px] text-industrial-silver/40 uppercase tracking-[0.2em] font-bold mt-1">{s.lab}</span>
          </div>
        ))}
      </div>

      <nav className="flex bg-surface-container-low/50 shrink-0 relative z-20 border-b border-primary/10">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] uppercase tracking-widest font-display font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-industrial-silver/40 hover:text-industrial-silver/60'}`}>
            <tab.Icon size={14} /> <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'agente' && (
            <motion.div key="agente" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 space-y-6">
              <div className="bg-surface-container-low border border-primary/20 p-6 space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rotate-45 translate-x-8 -translate-y-8 border-b border-primary/10" />
                <div className="text-primary font-display font-bold border-b border-primary/10 pb-3 mb-4 text-xs tracking-[0.3em] uppercase flex justify-between items-center">
                  <span>Dossiê_Classificado</span>
                  <div className="flex gap-1.5"><div className={`w-2 h-2 rounded-full animate-pulse ${stats.statusCfg.dot}`} /><div className="w-2 h-2 bg-primary/20 rounded-full" /></div>
                </div>
                <div className="space-y-3 font-display text-[11px] tracking-wider uppercase">
                  <p><span className="text-industrial-silver/40 font-bold">AGENT_ID:</span> <span className="font-bold text-primary ml-2">RM-{playerData.character.agentId || '...'}</span></p>
                  <p><span className="text-industrial-silver/40 font-bold">CODINOME:</span> <span className="text-white ml-2">{currentUsername}</span></p>
                  <p><span className="text-industrial-silver/40 font-bold">STATUS:</span> <span className={`${stats.statusCfg.color} font-bold ml-2`}>{stats.statusCfg.label}</span></p>
                  <p><span className="text-industrial-silver/40 font-bold">ÚLTIMA_MISSÃO:</span> <span className="text-white ml-2">{stats.lastCampaign?.name || 'SEM REGISTRO'}</span></p>
                  {stats.lastCampaign && <p><span className="text-industrial-silver/40 font-bold">SETOR:</span> <span className="text-white ml-2">{stats.lastCampaign.location}</span></p>}
                </div>
                <div className="pt-4 mt-2 border-t border-primary/5">
                  <div className="flex items-center justify-between mb-2"><span className="text-industrial-silver/40 font-display font-bold text-[10px] tracking-widest uppercase">Periculosidade</span><span className={`font-display font-black text-[10px] tracking-[0.2em] uppercase ${playerData.character.dangerLevel >= 4 ? 'text-red-500' : playerData.character.dangerLevel >= 2 ? 'text-primary' : 'text-industrial-silver/40'}`}>{stats.dangerLabel}</span></div>
                  <div className="flex gap-1.5">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`h-2 flex-1 rounded-sm transition-all duration-700 ${i < (playerData.character.dangerLevel || 0) ? ['bg-green-500', 'bg-yellow-500', 'bg-primary', 'bg-red-500', 'bg-red-700'][i] : 'bg-primary/5 border border-primary/5'}`} />)}</div>
                </div>
              </div>
              {stats.embedUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1"><Music size={14} className="text-[#1DB954]" /><h3 className="text-[#1DB954] text-[10px] font-display font-bold uppercase tracking-[0.3em]">Walkman_do_Agente</h3></div>
                  <iframe src={stats.embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; encrypted-media; fullscreen" loading="lazy" className="rounded-lg shadow-2xl border border-white/5" title="Spotify" />
                </div>
              ) : (
                <div className="bg-surface-container-low border border-primary/5 p-6 text-center opacity-30 flex flex-col items-center gap-3">
                  <Music size={24} className="text-primary" />
                  <p className="text-[10px] font-display font-bold uppercase tracking-[0.2em]">Nenhuma playlist sincronizada</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'intel' && (
            <motion.div key="intel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 space-y-6">
              <div className="flex gap-2 bg-black/20 p-1.5 border border-primary/10 rounded-sm">
                {([1, 2, 3, 4] as AccessLevel[]).map(lvl => (
                  <button key={lvl} onClick={() => setActiveLevel(lvl)} className={`flex-1 py-2 rounded-sm text-[9px] uppercase font-display font-bold tracking-widest transition-all ${activeLevel === lvl ? 'bg-primary text-black' : 'text-primary/40 hover:text-primary/60 hover:bg-primary/5'}`}>
                    {ACCESS_LEVEL_LABELS[lvl]}
                  </button>
                ))}
              </div>
              
              <div className="space-y-3">
                {!intel || intel.byLevel[activeLevel].length === 0 ? (
                  <div className="bg-surface-container-low border border-primary/5 p-10 text-center opacity-20 font-display text-[10px] uppercase tracking-[0.3em] flex flex-col items-center gap-4">
                    <Radio size={32} />
                    Nenhum registro encontrado
                  </div>
                ) : (
                  intel.byLevel[activeLevel].map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} 
                      onClick={() => (item.type === 'VISUAL' || item.type === 'TEXT') && setSelectedIntel(item)} 
                      className={`bg-surface-container-low border border-primary/10 p-4 flex items-center gap-4 transition-all group ${(item.type === 'VISUAL' || item.type === 'TEXT') ? 'cursor-pointer hover:border-primary/40 active:scale-[0.99]' : ''}`}>
                      <div className="w-10 h-10 border border-primary/10 bg-black/40 flex items-center justify-center text-primary group-hover:border-primary/30 transition-colors">
                        {item.type === 'AUDIO' ? <Radio size={18} /> : item.type === 'VISUAL' ? <Camera size={18} /> : <Radio size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-display font-bold text-white group-hover:text-primary transition-colors truncate uppercase tracking-wider">{item.title}</p>
                        <p className="text-[9px] text-industrial-silver/30 uppercase font-display tracking-[0.2em] mt-1">{item.metadata?.npc || 'Sistema de Campo'}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'conquistas' && (
            <motion.div key="conquistas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {ALL_ACHIEVEMENTS.map((ach) => {
                  const earned = stats.earnedIds.has(ach.id);
                  return (
                    <div key={ach.id} className={`bg-surface-container-low border p-4 flex flex-col gap-2 transition-all relative overflow-hidden group ${earned ? 'border-primary/40' : 'border-primary/5 opacity-40'}`}>
                      {earned && <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rotate-45 translate-x-4 -translate-y-4 border-b border-primary/20" />}
                      <span className="text-2xl mb-1">{earned ? ach.icon : '🔒'}</span>
                      <p className={`text-[10px] font-display font-bold uppercase tracking-widest ${earned ? 'text-primary' : 'text-industrial-silver/40'}`}>{earned || playerData.character.achievementsRevealed ? ach.title : '???'}</p>
                      <p className="text-[9px] text-industrial-silver/50 leading-relaxed font-sans">{earned ? (playerData.character.achievementsRevealed ? `${ach.description} (${ach.unlockCondition})` : ach.description) : (playerData.character.achievementsRevealed ? `Condição: ${ach.unlockCondition}` : 'Protocolo não atingido')}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-6 py-4 flex justify-between items-center bg-surface-container-low/80 border-t border-primary/10 shrink-0 relative z-20">
        <div className="flex items-center gap-2 text-[10px] font-display font-bold tracking-[0.2em] opacity-40 uppercase"><div className="w-2 h-2 bg-primary rounded-full animate-pulse" /> Conexão Segura</div>
        <div className="font-display text-[9px] text-industrial-silver/20 tracking-widest uppercase">Grid Node: RM-LINK-84</div>
      </footer>

      <AnimatePresence>
        {selectedIntel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-110 bg-black/98 backdrop-blur-md flex flex-col items-center justify-center p-6" onClick={() => setSelectedIntel(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <div className="bg-surface-container-low border-2 border-primary/30 shadow-2xl overflow-hidden relative">
                <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase z-10">Arquivo_Desbloqueado</div>
                {selectedIntel.type === 'VISUAL' ? (
                  <div className="p-4 pt-8">
                    <div className="border border-primary/20 bg-black/40 overflow-hidden relative">
                      <img src={selectedIntel.mediaUrl} alt={selectedIntel.title} className="w-full max-h-[50vh] object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 pt-10 font-mono text-[11px] text-primary/80 max-h-[60vh] overflow-y-auto custom-scrollbar leading-relaxed">
                    <p className="border-b border-primary/20 pb-3 mb-4 uppercase font-bold text-white tracking-widest">{selectedIntel.title}</p>
                    <p className="whitespace-pre-wrap">{selectedIntel.textContent || selectedIntel.description}</p>
                  </div>
                )}
                <div className="p-6 bg-black/40 border-t border-primary/10">
                  <p className="text-white font-display font-bold text-sm uppercase tracking-tight">{selectedIntel.title}</p>
                  <p className="text-industrial-silver/40 text-[10px] font-display uppercase tracking-widest mt-2 leading-relaxed">{selectedIntel.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedIntel(null)} className="absolute -top-12 right-0 p-2 text-primary hover:text-white transition-all hover:scale-110"><X size={28} /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
