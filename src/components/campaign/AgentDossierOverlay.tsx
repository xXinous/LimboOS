import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Music, MapPin, Search, User as UserIcon, Package, Shield, Crosshair, Radio, Camera, Pencil, Check, Loader2 } from 'lucide-react';
import { generateAgentId, fetchPlayerGalleryImages, uploadProfilePhoto, fetchProfilePhotos, setActiveProfilePhoto, updateUsername } from '../../store/firestore';
import type { ProfilePhoto } from '../../store/firestore';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import type { PlayerData, GalleryImage, GalleryCategory } from '../../types/player';
import type { Campaign } from '../../data/campaigns';
import type { Tape } from '../../data/tapes';
import { tapeManager } from '../../services/TapeManager';

/* ─────── Helpers & Constants ─────── */

const STATUS_CONFIG = {
  vivo: { label: 'ATIVO', color: 'text-analog-green', bg: 'bg-analog-green/10', border: 'border-analog-green/30', dot: 'bg-analog-green', glow: 'shadow-[0_0_8px_#378b44]' },
  morto: { label: 'ELIMINADO', color: 'text-analog-red', bg: 'bg-analog-red/10', border: 'border-analog-red/30', dot: 'bg-analog-red', glow: 'shadow-[0_0_8px_#cc3021]' },
  desaparecido: { label: 'DESAPARECIDO', color: 'text-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500', glow: 'shadow-[0_0_8px_#eab308]' },
} as const;

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;

type DossierTab = 'agente' | 'inventario' | 'conquistas' | 'galeria';

const TABS: { id: DossierTab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'agente', label: 'Agente', Icon: Shield },
  { id: 'inventario', label: 'Arquivos', Icon: Radio },
  { id: 'conquistas', label: 'Medalhas', Icon: Trophy },
  { id: 'galeria', label: 'Galeria', Icon: MapPin },
];

const GALLERY_CATEGORIES: { id: GalleryCategory; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'locais', label: 'Locais', Icon: MapPin },
  { id: 'pistas', label: 'Pistas', Icon: Search },
  { id: 'pessoas', label: 'Pessoas', Icon: UserIcon },
  { id: 'itens', label: 'Itens', Icon: Package },
];

function extractSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes('open.spotify.com/embed')) return url;
  const match = url.match(/open\.spotify\.com\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  const uriMatch = url.match(/spotify:(playlist|album|track|episode|show):([a-zA-Z0-9]+)/);
  if (uriMatch) return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
  return null;
}

/* ─────── Main Component ─────── */

interface AgentDossierOverlayProps {
  onClose: () => void;
  playerData: PlayerData;
  campaigns: Campaign[];
}

export const AgentDossierOverlay = ({ onClose, playerData, campaigns }: AgentDossierOverlayProps) => {
  const [activeTab, setActiveTab] = useState<DossierTab>('agente');
  const [agentCode, setAgentCode] = useState<string | null>(playerData.agentId || null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [ownedTapes, setOwnedTapes] = useState<Tape[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [galleryTab, setGalleryTab] = useState<GalleryCategory>('locais');

  // Profile photo state
  const [savedPhotos, setSavedPhotos] = useState<ProfilePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPhotoSelector, setShowPhotoSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(playerData.username);
  const [savingName, setSavingName] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(playerData.username);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(playerData.profilePhotoUrl || '');

  // Generate agent ID if needed
  useEffect(() => {
    if (!playerData.agentId) {
      generateAgentId(playerData.uid).then(setAgentCode).catch(console.error);
    }
  }, [playerData.uid, playerData.agentId]);

  // Load gallery images
  useEffect(() => {
    if (playerData.unlockedGalleryIds?.length) {
      fetchPlayerGalleryImages(playerData.uid).then(setGalleryImages).catch(console.error);
    }
  }, [playerData.uid, playerData.unlockedGalleryIds]);

  // Load owned tapes
  useEffect(() => {
    if (playerData.unlockedTapeIds?.length) {
      tapeManager.getOwnedTapes(playerData.unlockedTapeIds).then(setOwnedTapes).catch(console.error);
    }
  }, [playerData.unlockedTapeIds]);

  // Load saved profile photos
  useEffect(() => {
    fetchProfilePhotos(playerData.uid).then(setSavedPhotos).catch(console.error);
  }, [playerData.uid]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const photo = await uploadProfilePhoto(playerData.uid, file);
      setCurrentPhotoUrl(photo.url);
      setSavedPhotos(prev => [photo, ...prev].slice(0, 3));
      setShowPhotoSelector(false);
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectPhoto = async (url: string) => {
    await setActiveProfilePhoto(playerData.uid, url);
    setCurrentPhotoUrl(url);
    setShowPhotoSelector(false);
  };

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === currentUsername) { setIsEditingName(false); return; }
    setSavingName(true);
    try {
      await updateUsername(playerData.uid, editName.trim());
      setCurrentUsername(editName.trim());
    } catch (err) { console.error(err); }
    finally { setSavingName(false); setIsEditingName(false); }
  };

  const status = playerData.agentStatus || 'vivo';
  const statusCfg = STATUS_CONFIG[status];
  const dangerLevel = playerData.dangerLevel || 0;
  const dangerLabel = DANGER_LABELS[dangerLevel] || '—';
  const lastCampaign = playerData.campaignId
    ? campaigns.find(c => c.id === playerData.campaignId)
    : null;
  const earnedIds = new Set(playerData.achievementIds || []);
  const embedUrl = extractSpotifyEmbedUrl(playerData.spotifyPlaylistUrl || '');

  const initials = currentUsername
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className="w-full h-full bg-cardboard flex flex-col overflow-hidden touch-none relative"
    >
      {/* CRT overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0 scanlines" />

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {/* ─── Header ─── */}
      <div className="p-5 border-b-2 border-cardboard-dark flex justify-between items-center bg-cardboard relative z-20 shrink-0">
        <div className="flex items-center gap-3">
          {/* Avatar with photo upload */}
          <button
            onClick={() => setShowPhotoSelector(p => !p)}
            className="relative w-14 h-14 rounded-2xl overflow-hidden bg-ink flex items-center justify-center text-white font-oswald font-bold text-lg shadow-lg border-2 border-ink/80 group"
          >
            {currentPhotoUrl ? (
              <img src={currentPhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
            ) : (
              <span>{initials || '?'}</span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={16} className="text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="font-oswald text-lg uppercase tracking-[0.15em] text-ink leading-none bg-transparent border-b-2 border-analog-orange outline-none w-full min-w-0"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
                <button onClick={handleSaveName} disabled={savingName} className="p-1 text-analog-green hover:bg-analog-green/10 rounded">
                  {savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button onClick={() => { setIsEditingName(false); setEditName(currentUsername); }} className="p-1 text-analog-red hover:bg-analog-red/10 rounded">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h4 className="font-oswald text-lg uppercase tracking-[0.15em] text-ink leading-none truncate">{currentUsername}</h4>
                <button onClick={() => { setEditName(currentUsername); setIsEditingName(true); }} className="p-1 text-ink/30 hover:text-analog-orange transition-colors shrink-0">
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${statusCfg.dot} ${statusCfg.glow} animate-pulse`} />
              <span className={`text-[9px] font-mono font-bold tracking-widest ${statusCfg.color}`}>{statusCfg.label}</span>
              {agentCode && (
                <span className="text-[9px] font-mono text-ink/40 tracking-wider">RM-{agentCode}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-3 hover:bg-black/5 active:bg-black/10 rounded-full transition-all text-ink border-2 border-cardboard-dark bg-cardboard shadow-sm group shrink-0"
        >
          <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* ─── Photo Selector Dropdown ─── */}
      <AnimatePresence>
        {showPhotoSelector && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-cardboard-dark/15 border-b border-cardboard-dark/30 overflow-hidden shrink-0 relative z-20"
          >
            <div className="p-3 flex items-center gap-2">
              {savedPhotos.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => handleSelectPhoto(photo.url)}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    currentPhotoUrl === photo.url ? 'border-analog-orange shadow-lg scale-110' : 'border-cardboard-dark hover:border-ink/40'
                  }`}
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-12 h-12 rounded-lg border-2 border-dashed border-ink/20 flex items-center justify-center hover:border-analog-orange hover:bg-analog-orange/5 transition-all shrink-0"
              >
                {uploading ? <Loader2 size={16} className="animate-spin text-ink/30" /> : <Camera size={16} className="text-ink/30" />}
              </button>
              <span className="text-[8px] text-ink/30 font-mono uppercase tracking-wider ml-1">{savedPhotos.length}/3 salvas</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Stats Bar ─── */}
      <div className="flex divide-x divide-cardboard-dark bg-cardboard-dark/10 shrink-0 relative z-20">
        <div className="flex-1 flex flex-col items-center py-2.5">
          <span className="text-analog-orange font-oswald font-bold text-lg">{playerData.unlockedTapeIds?.length || 0}</span>
          <span className="text-[8px] text-ink/40 uppercase tracking-widest font-bold">Provas</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2.5">
          <span className="text-analog-orange font-oswald font-bold text-lg">{playerData.achievementIds?.length || 0}</span>
          <span className="text-[8px] text-ink/40 uppercase tracking-widest font-bold">Conquistas</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2.5">
          <span className="text-analog-orange font-oswald font-bold text-lg">{galleryImages.length}</span>
          <span className="text-[8px] text-ink/40 uppercase tracking-widest font-bold">Intel</span>
        </div>
      </div>

      {/* ─── Tab Bar ─── */}
      <div className="flex bg-cardboard-dark/15 border-b border-cardboard-dark/30 shrink-0 relative z-20">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] uppercase tracking-wider font-bold transition-all border-b-2 ${
                isActive
                  ? 'border-analog-orange text-analog-orange bg-cardboard-dark/10'
                  : 'border-transparent text-ink/40 hover:text-ink/60'
              }`}
            >
              <tab.Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'agente' && (
            <motion.div key="agente" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-5">
              {/* Agent Dossier Card */}
              <div className="indented-box p-5 font-mono text-[11px] space-y-3 text-ink relative">
                <div className="text-analog-orange font-black border-b-2 border-ink/10 pb-2 mb-3 text-sm tracking-widest uppercase flex justify-between items-center">
                  <span>Dossiê_Classificado</span>
                  <div className="flex gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusCfg.dot} ${statusCfg.glow}`} />
                    <div className="w-1.5 h-1.5 bg-analog-orange/30 rounded-full" />
                  </div>
                </div>

                <p><span className="opacity-50 font-bold">AGENT_ID:</span>{' '}
                  <span className="font-black text-analog-orange tracking-[0.2em] text-sm">RM-{agentCode || '...'}</span>
                </p>
                <p><span className="opacity-50 font-bold">CODINOME:</span>{' '}
                  <span className="uppercase font-bold tracking-wider">{currentUsername}</span>
                </p>
                <p><span className="opacity-50 font-bold">STATUS:</span>{' '}
                  <span className={`font-black ${statusCfg.color}`}>{statusCfg.label}</span>
                </p>
                <p><span className="opacity-50 font-bold">ÚLTIMA_MISSÃO:</span>{' '}
                  <span className="uppercase tracking-wide">{lastCampaign?.name || 'SEM REGISTRO'}</span>
                </p>
                {lastCampaign && (
                  <p><span className="opacity-50 font-bold">SETOR:</span>{' '}
                    <span className="uppercase tracking-wide">{lastCampaign.location}</span>
                  </p>
                )}

                {/* Danger Level */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="opacity-50 font-bold">PERICULOSIDADE:</span>
                    <span className={`font-black text-[10px] tracking-widest ${
                      dangerLevel >= 4 ? 'text-analog-red' : dangerLevel >= 2 ? 'text-analog-orange' : 'text-ink/50'
                    }`}>{dangerLabel}</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-3 flex-1 rounded-sm transition-all duration-500 ${
                          i < dangerLevel
                            ? ['bg-analog-green', 'bg-yellow-500', 'bg-analog-orange', 'bg-analog-red', 'bg-red-700'][i]
                            : 'bg-ink/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-3 opacity-60 italic border-t border-ink/10 mt-3 font-chakra leading-snug text-[10px]">
                  "Informação classificada nível OMEGA. Distribuição não autorizada resulta em eliminação imediata."
                </div>
              </div>

              {/* Spotify Section */}
              {embedUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Music size={14} className="text-[#1DB954]" />
                    <h3 className="text-[#1DB954] text-[11px] font-black uppercase tracking-widest font-oswald">Walkman_do_Agente</h3>
                  </div>
                  <div className="rounded-xl overflow-hidden border-2 border-cardboard-dark shadow-lg">
                    <iframe
                      src={embedUrl}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-xl"
                      style={{ borderRadius: '12px' }}
                      title="Spotify Walkman"
                    />
                  </div>
                </div>
              ) : (
                <div className="indented-box p-4 text-center">
                  <Music size={18} className="text-ink/20 mx-auto mb-2" />
                  <p className="text-ink/30 text-[10px] uppercase tracking-widest font-bold">Nenhuma playlist conectada</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'inventario' && (
            <motion.div key="inventario" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Radio size={14} className="text-analog-orange" />
                <h3 className="text-analog-orange text-[11px] font-black uppercase tracking-widest font-oswald">
                  Arquivos_Desbloqueados ({ownedTapes.length})
                </h3>
              </div>

              {ownedTapes.length === 0 ? (
                <div className="indented-box p-6 text-center">
                  <Radio size={22} className="text-ink/20 mx-auto mb-2" />
                  <p className="text-ink/30 text-[10px] uppercase tracking-widest font-bold">Nenhum arquivo desbloqueado</p>
                  <p className="text-ink/20 text-[9px] mt-1">Escaneie QR codes para desbloquear fitas de áudio.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ownedTapes.map((tape, i) => (
                    <motion.div
                      key={tape.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="indented-box p-3 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-analog-orange/15 border border-analog-orange/30 flex items-center justify-center shrink-0">
                        <span className="text-lg">📼</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-ink truncate">{tape.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-ink/40 font-mono uppercase">{tape.npc || tape.artist}</span>
                          {tape.chapter && (
                            <>
                              <span className="text-ink/15">•</span>
                              <span className="text-[9px] text-ink/30 font-mono">{tape.chapter}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {tape.isSecret && (
                        <div className="px-1.5 py-0.5 bg-analog-red/10 border border-analog-red/20 rounded text-[8px] text-analog-red font-bold uppercase tracking-wider shrink-0">
                          Secreto
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'conquistas' && (
            <motion.div key="conquistas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={14} className="text-analog-orange" />
                <h3 className="text-analog-orange text-[11px] font-black uppercase tracking-widest font-oswald">
                  Medalhas ({earnedIds.size}/{ALL_ACHIEVEMENTS.length})
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ALL_ACHIEVEMENTS.map((ach) => {
                  const earned = earnedIds.has(ach.id);
                  const isRevealed = playerData.achievementsRevealed;
                  const title = earned || isRevealed ? ach.title : 'Conquista Bloqueada';
                  const description = earned
                    ? (isRevealed ? `${ach.description} (${ach.unlockCondition})` : ach.description)
                    : (isRevealed ? `Como desbloquear: ${ach.unlockCondition}` : 'Permaneça atento e explore mais.');
                  return (
                    <div
                      key={ach.id}
                      className={`indented-box p-3 flex flex-col gap-1 transition-all ${
                        earned
                          ? 'border-2 border-analog-orange/30 bg-analog-orange/5'
                          : 'opacity-50'
                      }`}
                    >
                      <span className="text-xl">{earned ? ach.icon : '🔒'}</span>
                      <p className={`text-[10px] font-bold leading-tight break-words ${earned ? 'text-analog-orange' : 'text-ink/40'}`}>
                        {title}
                      </p>
                      <p className="text-[8px] text-ink/40 leading-tight break-words">
                        {description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'galeria' && (
            <motion.div key="galeria" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Crosshair size={14} className="text-analog-orange" />
                <h3 className="text-analog-orange text-[11px] font-black uppercase tracking-widest font-oswald">
                  Intel_Coletada ({galleryImages.length})
                </h3>
              </div>

              {galleryImages.length === 0 ? (
                <div className="indented-box p-6 text-center">
                  <MapPin size={22} className="text-ink/20 mx-auto mb-2" />
                  <p className="text-ink/30 text-[10px] uppercase tracking-widest font-bold">Nenhuma intel coletada</p>
                  <p className="text-ink/20 text-[9px] mt-1">Imagens serão liberadas conforme a missão avança.</p>
                </div>
              ) : (
                <>
                  {/* Category tabs */}
                  <div className="flex gap-1 indented-box p-1">
                    {GALLERY_CATEGORIES.map(cat => {
                      const count = galleryImages.filter(i => i.category === cat.id).length;
                      const isActive = galleryTab === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setGalleryTab(cat.id)}
                          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded text-[9px] uppercase tracking-wider font-bold transition-all ${
                            isActive
                              ? 'bg-analog-orange/15 text-analog-orange border border-analog-orange/30'
                              : 'text-ink/30 hover:text-ink/50 border border-transparent'
                          }`}
                        >
                          <cat.Icon size={10} />
                          {count > 0 && (
                            <span className={`text-[8px] px-1 rounded-full ${
                              isActive ? 'bg-analog-orange/20' : 'bg-ink/5'
                            }`}>{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Image grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {galleryImages.filter(img => img.category === galleryTab).map((img, idx) => (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        onClick={() => setSelectedImage(img)}
                        className="relative rounded-lg overflow-hidden border-2 border-cardboard-dark bg-cardboard-dark/20 cursor-pointer group active:scale-95 transition-transform"
                      >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={img.imageUrl}
                            alt={img.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-[10px] font-bold text-white truncate">{img.title}</p>
                        </div>
                      </motion.div>
                    ))}
                    {galleryImages.filter(img => img.category === galleryTab).length === 0 && (
                      <div className="col-span-2 indented-box p-4 text-center">
                        <p className="text-ink/20 text-[10px] uppercase tracking-widest font-bold">Nenhuma intel nesta categoria</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Footer (SINAL_ESTÁVEL) ─── */}
      <footer className="px-5 py-3 flex justify-between items-center bg-cardboard/30 border-t border-cardboard-dark/40 shrink-0 relative z-20">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-[0.2em] uppercase opacity-60">
          <div className="w-2 h-2 bg-analog-green rounded-full animate-pulse shadow-[0_0_8px_#378b44]" /> SINAL_ESTÁVEL
        </div>
        <div className="font-mono text-[9px] font-bold opacity-30">PORT_RM_84</div>
      </footer>

      {/* ─── Image Lightbox ─── */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-110 bg-black/95 flex flex-col items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.title}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
              />
              <div className="mt-3 px-1">
                <p className="text-white font-bold text-sm">{selectedImage.title}</p>
                {selectedImage.description && (
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">{selectedImage.description}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
