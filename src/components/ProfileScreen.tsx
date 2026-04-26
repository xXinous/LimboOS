import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, LogOut, Trophy, Music, Pencil, Check, X, ExternalLink, Image, Map } from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '../data/achievements';
import PlayerGallery from './PlayerGallery';
import type { GalleryImage } from '../store/firestore';
interface ProfileData {
  id: string;
  username: string;
  unlockedTapeIds: string[];
  achievementIds: string[];
  achievementsRevealed?: boolean;
  spotifyPlaylistUrl?: string;
  galleryImages?: GalleryImage[];
}
interface ProfileScreenProps {
  profile: ProfileData;
  onBack: () => void;
  onLogout: () => void;
  onUpdateSpotify?: (url: string) => void;
  onChangeMission?: () => void;
}
function extractSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes('open.spotify.com/embed')) return url;
  const match = url.match(/open\.spotify\.com\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) {
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  }
  const uriMatch = url.match(/spotify:(playlist|album|track|episode|show):([a-zA-Z0-9]+)/);
  if (uriMatch) {
    return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
  }
  return null;
}
export default function ProfileScreen({ profile, onBack, onLogout, onUpdateSpotify, onChangeMission }: ProfileScreenProps) {
  const earnedIds = new Set(profile.achievementIds);
  const [isEditingSpotify, setIsEditingSpotify] = useState(false);
  const [spotifyInput, setSpotifyInput] = useState(profile.spotifyPlaylistUrl || '');
  const [spotifyError, setSpotifyError] = useState('');
  const initials = profile.username
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const embedUrl = extractSpotifyEmbedUrl(profile.spotifyPlaylistUrl || '');
  const handleSaveSpotify = () => {
    const trimmed = spotifyInput.trim();
    if (trimmed && !extractSpotifyEmbedUrl(trimmed)) {
      setSpotifyError('Link inválido. Use o link de uma playlist do Spotify.');
      return;
    }
    setSpotifyError('');
    onUpdateSpotify?.(trimmed);
    setIsEditingSpotify(false);
  };
  const handleCancelEdit = () => {
    setSpotifyInput(profile.spotifyPlaylistUrl || '');
    setSpotifyError('');
    setIsEditingSpotify(false);
  };
  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className="relative w-full max-w-sm h-full max-h-[750px] bg-[#1e1e1e] rounded-[32px] border-8 border-[#1a1a1a] flex flex-col overflow-hidden z-50"
    >
      {}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-[#333] shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center hover:bg-[#444] transition-colors"
        >
          <ArrowLeft size={16} className="text-orange-500" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center shadow-lg glow-orange">
            <span className="text-black font-display font-bold text-sm tracking-tight">{initials || '?'}</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight uppercase">{profile.username}</span>
        </div>
        <button
          onClick={onLogout}
          className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center hover:bg-red-900/30 transition-colors"
        >
          <LogOut size={15} className="text-red-500" />
        </button>
      </div>
      {}
      <div className="flex divide-x divide-[#333] bg-[#1a1a1a] shrink-0">
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-orange-500 font-bold text-xl">{profile.unlockedTapeIds.length}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Provas</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-orange-500 font-bold text-xl">{profile.achievementIds.length}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Conquistas</span>
        </div>
      </div>
      {}
      <div className="flex-1 overflow-y-auto">
        {}
        <div className="px-4 py-4 border-b border-[#333]">
          <button 
            onClick={onChangeMission}
            className="w-full flex items-center justify-between p-4 bg-orange-600/10 hover:bg-orange-600/20 active:scale-[0.98] rounded-xl border border-orange-500/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-black shadow-lg">
                <Map size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Alternar Missão</div>
                <div className="text-[9px] text-orange-500/60 font-bold uppercase mt-0.5 tracking-tighter">Trocar Realidade Ativa</div>
              </div>
            </div>
            <ArrowLeft size={16} className="text-orange-500 rotate-180 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
        {}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Music size={14} className="text-[#1DB954]" />
              <h2 className="text-[#1DB954] text-xs font-bold uppercase tracking-widest">Meu Walkman</h2>
            </div>
            {onUpdateSpotify && !isEditingSpotify && (
              <button
                onClick={() => { setIsEditingSpotify(true); setSpotifyInput(profile.spotifyPlaylistUrl || ''); }}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#1DB954] transition-colors"
              >
                <Pencil size={10} />
                <span className="uppercase tracking-wider">{embedUrl ? 'Editar' : 'Conectar'}</span>
              </button>
            )}
          </div>
          <AnimatePresence mode="wait">
            {isEditingSpotify ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                <div className="bg-[#242424] border border-[#333] rounded-lg p-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">
                    Cole o link da sua playlist do Spotify
                  </label>
                  <input
                    type="url"
                    value={spotifyInput}
                    onChange={(e) => { setSpotifyInput(e.target.value); setSpotifyError(''); }}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="w-full bg-[#1a1a1a] border border-[#444] rounded-md px-3 py-2 text-xs text-white placeholder:text-gray-700 focus:border-[#1DB954] focus:outline-none transition-colors"
                    autoFocus
                  />
                  {spotifyError && (
                    <p className="text-red-400 text-[10px] mt-1">{spotifyError}</p>
                  )}
                  <p className="text-[9px] text-gray-600 mt-1.5 leading-relaxed">
                    Abra o Spotify → Playlist → Compartilhar → Copiar link
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#333] text-gray-400 text-[10px] hover:bg-[#444] transition-colors"
                  >
                    <X size={10} /> Cancelar
                  </button>
                  <button
                    onClick={handleSaveSpotify}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1DB954]/20 text-[#1DB954] text-[10px] border border-[#1DB954]/30 hover:bg-[#1DB954]/30 transition-colors"
                  >
                    <Check size={10} /> Salvar
                  </button>
                </div>
              </motion.div>
            ) : embedUrl ? (
              <motion.div
                key="player"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl overflow-hidden border border-[#333] bg-[#121212] shadow-[0_0_30px_rgba(29,185,84,0.08)]"
              >
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="352"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-xl"
                  style={{ borderRadius: '12px' }}
                  title="Spotify Walkman"
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border border-dashed border-[#333] rounded-lg p-6 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center mx-auto mb-3">
                  <Music size={22} className="text-[#1DB954]/60" />
                </div>
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Nenhuma playlist conectada</p>
                <p className="text-gray-700 text-[10px]">Conecte sua playlist do Spotify para personalizar seu Walkman.</p>
                {onUpdateSpotify && (
                  <button
                    onClick={() => setIsEditingSpotify(true)}
                    className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-full bg-[#1DB954]/15 text-[#1DB954] text-[10px] font-bold uppercase tracking-wider border border-[#1DB954]/25 hover:bg-[#1DB954]/25 transition-all"
                  >
                    <ExternalLink size={10} />
                    Conectar Spotify
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <Image size={14} className="text-cyan-400" />
            <h2 className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Galeria</h2>
          </div>
          <PlayerGallery images={profile.galleryImages || []} />
        </div>
        {}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-orange-500" />
            <h2 className="text-orange-500 text-xs font-bold uppercase tracking-widest">Conquistas</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_ACHIEVEMENTS.map((ach) => {
              const earned = earnedIds.has(ach.id);
              const isRevealed = profile.achievementsRevealed;
              const title = earned || isRevealed ? ach.title : 'Conquista Bloqueada';
              const description = earned 
                ? (isRevealed ? `${ach.description} (${ach.unlockCondition})` : ach.description)
                : (isRevealed ? `Como desbloquear: ${ach.unlockCondition}` : 'Permaneça atento e explore mais.');
              return (
                <div
                  key={ach.id}
                  className={`rounded-lg p-3 border flex flex-col gap-1 transition-all ${
                    earned
                      ? 'bg-orange-900/20 border-orange-800/50'
                      : 'bg-[#1a1a1a] border-surface-container-high opacity-50'
                  }`}
                >
                  <span className="text-xl">{earned ? ach.icon : '🔒'}</span>
                  <p className={`text-[11px] font-bold leading-tight wrap-break-word min-w-0 ${earned ? 'text-orange-400' : 'text-gray-600'}`}>
                    {title}
                  </p>
                  <p className="text-[9px] text-gray-500 leading-tight wrap-break-word min-w-0">
                    {description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

