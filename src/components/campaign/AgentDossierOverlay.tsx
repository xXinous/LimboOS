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
  vivo: { label: 'ATIVO', color: 'text-analog-green', dot: 'bg-analog-green', glow: 'shadow-[0_0_8px_#378b44]' },
  morto: { label: 'ELIMINADO', color: 'text-analog-red', dot: 'bg-analog-red', glow: 'shadow-[0_0_8px_#cc3021]' },
  desaparecido: { label: 'DESAPARECIDO', color: 'text-yellow-600', dot: 'bg-yellow-500', glow: 'shadow-[0_0_8px_#eab308]' },
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
    <div className="w-full h-full bg-cardboard flex flex-col overflow-hidden touch-none relative rounded-none sm:rounded-[20px] border-0 sm:border-2 border-cardboard-dark">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0 scanlines" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      <header className="p-5 border-b-2 border-cardboard-dark flex justify-between items-center bg-cardboard relative z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="relative w-14 h-14 rounded-2xl overflow-hidden bg-ink flex items-center justify-center text-white font-oswald font-bold text-lg shadow-lg border-2 border-ink/80 group">
            {currentPhotoUrl ? <img src={currentPhotoUrl} alt="Perfil" className="w-full h-full object-cover" /> : <span>{stats.initials || '?'}</span>}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={16} /></div>
            {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-white" /></div>}
          </button>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input value={editName} onChange={e => setEditName(e.target.value)} className="font-oswald text-lg uppercase tracking-[0.15em] text-ink bg-transparent border-b-2 border-analog-orange outline-none w-full" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
                <button onClick={handleSaveName} disabled={savingName} className="p-1 text-analog-green">{savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
                <button onClick={() => { setIsEditingName(false); setEditName(currentUsername); }} className="p-1 text-analog-red"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h4 className="font-oswald text-lg uppercase tracking-[0.15em] text-ink truncate">{currentUsername}</h4>
                <button onClick={() => setIsEditingName(true)} className="p-1 text-ink/30 hover:text-analog-orange transition-colors"><Pencil size={12} /></button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${stats.statusCfg.dot} ${stats.statusCfg.glow} animate-pulse`} />
              <span className={`text-[9px] font-mono font-bold tracking-widest ${stats.statusCfg.color}`}>{stats.statusCfg.label}</span>
              {playerData.character.agentId && <span className="text-[9px] font-mono text-ink/40">RM-{playerData.character.agentId}</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-black/5 rounded-full transition-all text-ink border-2 border-cardboard-dark bg-cardboard group shrink-0"><X size={24} className="group-hover:rotate-90 transition-transform" /></button>
      </header>

      <div className="flex divide-x divide-cardboard-dark bg-cardboard-dark/10 shrink-0 relative z-20">
        {[ { val: intel?.counts.total || 0, lab: 'Total Intel' }, { val: stats.earnedIds.size, lab: 'Medalhas' }, { val: intel?.counts.visual || 0, lab: 'Evidências' } ].map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-2.5"><span className="text-analog-orange font-oswald font-bold text-lg">{s.val}</span><span className="text-[8px] text-ink/40 uppercase tracking-widest font-bold">{s.lab}</span></div>
        ))}
      </div>

      <nav className="flex bg-cardboard-dark/15 border-b border-cardboard-dark/30 shrink-0 relative z-20">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] uppercase tracking-wider font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-analog-orange text-analog-orange bg-cardboard-dark/10' : 'border-transparent text-ink/40 hover:text-ink/60'}`}>
            <tab.Icon size={13} /> <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'agente' && (
            <motion.div key="agente" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-5">
              <div className="indented-box p-5 font-mono text-[11px] space-y-3 text-ink relative">
                <div className="text-analog-orange font-black border-b-2 border-ink/10 pb-2 mb-3 text-sm tracking-widest uppercase flex justify-between items-center">
                  <span>Dossiê_Classificado</span>
                  <div className="flex gap-1"><div className={`w-1.5 h-1.5 rounded-full animate-pulse ${stats.statusCfg.dot} ${stats.statusCfg.glow}`} /><div className="w-1.5 h-1.5 bg-analog-orange/30 rounded-full" /></div>
                </div>
                <p><span className="opacity-50 font-bold">AGENT_ID:</span> <span className="font-black text-analog-orange tracking-[0.2em] text-sm">RM-{playerData.character.agentId || '...'}</span></p>
                <p><span className="opacity-50 font-bold">CODINOME:</span> <span className="uppercase font-bold">{currentUsername}</span></p>
                <p><span className="opacity-50 font-bold">STATUS:</span> <span className={`font-black ${stats.statusCfg.color}`}>{stats.statusCfg.label}</span></p>
                <p><span className="opacity-50 font-bold">ÚLTIMA_MISSÃO:</span> <span className="uppercase">{stats.lastCampaign?.name || 'SEM REGISTRO'}</span></p>
                {stats.lastCampaign && <p><span className="opacity-50 font-bold">SETOR:</span> <span className="uppercase">{stats.lastCampaign.location}</span></p>}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5"><span className="opacity-50 font-bold">PERICULOSIDADE:</span><span className={`font-black text-[10px] tracking-widest ${playerData.character.dangerLevel >= 4 ? 'text-analog-red' : playerData.character.dangerLevel >= 2 ? 'text-analog-orange' : 'text-ink/50'}`}>{stats.dangerLabel}</span></div>
                  <div className="flex gap-1">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`h-3 flex-1 rounded-sm transition-all duration-500 ${i < (playerData.character.dangerLevel || 0) ? ['bg-analog-green', 'bg-yellow-500', 'bg-analog-orange', 'bg-analog-red', 'bg-red-700'][i] : 'bg-ink/10'}`} />)}</div>
                </div>
              </div>
              {stats.embedUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Music size={14} className="text-[#1DB954]" /><h3 className="text-[#1DB954] text-[11px] font-black uppercase tracking-widest font-oswald">Walkman_do_Agente</h3></div>
                  <iframe src={stats.embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; encrypted-media; fullscreen" loading="lazy" className="rounded-xl shadow-lg" title="Spotify" />
                </div>
              ) : <div className="indented-box p-4 text-center"><Music size={18} className="text-ink/20 mx-auto mb-2" /><p className="text-ink/30 text-[10px] uppercase font-bold">Nenhuma playlist conectada</p></div>}
            </motion.div>
          )}

          {activeTab === 'intel' && (
            <motion.div key="intel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-4">
              <div className="flex gap-1 indented-box p-1">
                {([1, 2, 3, 4] as AccessLevel[]).map(lvl => (
                  <button key={lvl} onClick={() => setActiveLevel(lvl)} className={`flex-1 py-2 rounded text-[9px] uppercase font-bold transition-all ${activeLevel === lvl ? 'bg-analog-orange/15 text-analog-orange border border-analog-orange/30' : 'text-ink/30 border border-transparent'}`}>
                    {ACCESS_LEVEL_LABELS[lvl]}
                  </button>
                ))}
              </div>
              
              <div className="space-y-2">
                {!intel || intel.byLevel[activeLevel].length === 0 ? (
                  <div className="indented-box p-8 text-center opacity-40 font-mono text-[10px] uppercase">Nenhuma Intel de nível {activeLevel} encontrada</div>
                ) : (
                  intel.byLevel[activeLevel].map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} onClick={() => (item.type === 'VISUAL' || item.type === 'TEXT') && setSelectedIntel(item)} className={`indented-box p-3 flex items-center gap-3 transition-transform ${(item.type === 'VISUAL' || item.type === 'TEXT') ? 'cursor-pointer active:scale-98' : ''}`}>
                      <div className="w-9 h-9 rounded-lg bg-analog-orange/15 border border-analog-orange/30 flex items-center justify-center text-lg">
                        {item.type === 'AUDIO' ? '📼' : item.type === 'VISUAL' ? '📷' : '💾'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-ink truncate">{item.title}</p>
                        <p className="text-[9px] text-ink/40 uppercase font-mono">{item.metadata?.npc || 'Sistema'}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'conquistas' && (
            <motion.div key="conquistas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {ALL_ACHIEVEMENTS.map((ach) => {
                  const earned = stats.earnedIds.has(ach.id);
                  const revealed = playerData.character.achievementsRevealed;
                  return (
                    <div key={ach.id} className={`indented-box p-3 flex flex-col gap-1 transition-all ${earned ? 'border-2 border-analog-orange/30 bg-analog-orange/5' : 'opacity-40'}`}>
                      <span className="text-xl">{earned ? ach.icon : '🔒'}</span>
                      <p className={`text-[10px] font-bold ${earned ? 'text-analog-orange' : 'text-ink/40'}`}>{earned || playerData.character.achievementsRevealed ? ach.title : '???'}</p>
                      <p className="text-[8px] text-ink/40 leading-tight">{earned ? (playerData.character.achievementsRevealed ? `${ach.description} (${ach.unlockCondition})` : ach.description) : (playerData.character.achievementsRevealed ? `Falta: ${ach.unlockCondition}` : 'Bloqueado')}</p>
                    </div>

                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-5 py-3 flex justify-between items-center bg-cardboard/30 border-t border-cardboard-dark/40 shrink-0 relative z-20">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest opacity-60"><div className="w-2 h-2 bg-analog-green rounded-full animate-pulse shadow-[0_0_8px_#378b44]" /> SINAL_ESTÁVEL</div>
        <div className="font-mono text-[9px] opacity-30">PORT_RM_84</div>
      </footer>

      <AnimatePresence>
        {selectedIntel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-110 bg-black/95 flex flex-col items-center justify-center p-4" onClick={() => setSelectedIntel(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
              {selectedIntel.type === 'VISUAL' ? (
                <img src={selectedIntel.mediaUrl} alt={selectedIntel.title} className="w-full max-h-[60vh] object-contain rounded-lg shadow-2xl" />
              ) : (
                <div className="bg-ink p-6 rounded-lg border-2 border-analog-green font-mono text-[12px] text-analog-green max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <p className="border-b border-analog-green/30 pb-2 mb-4 uppercase font-black">{selectedIntel.title}</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{selectedIntel.textContent || selectedIntel.description}</p>
                </div>
              )}
              <div className="mt-4"><p className="text-white font-bold text-sm">{selectedIntel.title}</p><p className="text-gray-400 text-xs mt-1 leading-relaxed">{selectedIntel.description}</p></div>
              <button onClick={() => setSelectedIntel(null)} className="absolute -top-10 right-0 p-2 text-white/50 hover:text-white transition-colors"><X size={24} /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
