import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../../lib/firebase';
import {
  collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc,
  serverTimestamp, query, orderBy, getDocs, writeBatch
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import MediaSelectorModal from './MediaSelectorModal';
import { MediaAsset } from '../../types/media';
import { useModal } from './ConfirmModal';
import Screw from '../../components/player/Screw';

/* ── Types ─────────────────────────────────────────────── */
interface JukeboxTrack {
  id: string;
  type: 'youtube' | 'audio';
  title: string;
  url: string;
  storagePath?: string;
  order: number;
  createdAt: any;
}

/* ── YouTube helpers ───────────────────────────────────── */
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isYoutubeUrl(url: string): boolean {
  return extractYoutubeId(url) !== null;
}

/* ── Component ─────────────────────────────────────────── */
export default function JukeboxPanel() {
  const [tracks, setTracks] = useState<JukeboxTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytApiReady = useRef(false);
  const { showAlert, showConfirm, modal } = useModal();

  const currentTrack = currentIndex >= 0 && currentIndex < tracks.length ? tracks[currentIndex] : null;

  /* ── Firestore listener ──────────────────────────────── */
  useEffect(() => {
    const q = query(collection(db, 'jukeboxTracks'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data: JukeboxTrack[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() } as JukeboxTrack));
      setTracks(data);
    });
    return () => unsub();
  }, []);

  /* ── YouTube IFrame API ──────────────────────────────── */
  useEffect(() => {
    if ((window as any).YT && (window as any).YT.Player) {
      ytApiReady.current = true;
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => {
      ytApiReady.current = true;
    };
  }, []);

  /* ── Advance to next track ───────────────────────────── */
  const advanceTrack = useCallback(() => {
    if (isLooping && currentIndex >= 0) {
      // replay same
      const track = tracks[currentIndex];
      if (track.type === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(0);
        ytPlayerRef.current.playVideo();
      } else if (track.type === 'audio' && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }
    const next = currentIndex + 1;
    if (next < tracks.length) {
      playTrackAtIndex(next);
    } else {
      setIsPlaying(false);
      setCurrentIndex(-1);
      destroyYtPlayer();
    }
  }, [isLooping, currentIndex, tracks]);

  /* ── Destroy YT player ───────────────────────────────── */
  const destroyYtPlayer = useCallback(() => {
    try { ytPlayerRef.current?.destroy(); } catch {}
    ytPlayerRef.current = null;
  }, []);

  /* ── Play a track at index ───────────────────────────── */
  const playTrackAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= tracks.length) return;
    const track = tracks[idx];
    setCurrentIndex(idx);
    setIsPlaying(true);

    // Stop audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (track.type === 'youtube') {
      const videoId = extractYoutubeId(track.url);
      if (!videoId) return;

      // Destroy previous player
      destroyYtPlayer();

      const waitForApi = () => {
        if (!ytApiReady.current || !ytContainerRef.current) {
          setTimeout(waitForApi, 200);
          return;
        }
        ytPlayerRef.current = new (window as any).YT.Player(ytContainerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
          events: {
            onStateChange: (e: any) => {
              if (e.data === (window as any).YT.PlayerState.ENDED) {
                advanceTrack();
              }
            },
          },
        });
      };
      waitForApi();
    } else {
      destroyYtPlayer();
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play().catch(console.error);
      }
    }
  }, [tracks, destroyYtPlayer, advanceTrack]);

  /* ── Audio ended handler ─────────────────────────────── */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const handler = () => advanceTrack();
    el.addEventListener('ended', handler);
    return () => el.removeEventListener('ended', handler);
  }, [advanceTrack]);

  /* ── Add YouTube link ────────────────────────────────── */
  const handleAddLink = async () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!isYoutubeUrl(url)) {
      await showAlert('URL Inválida', 'Insira uma URL válida do YouTube.');
      return;
    }
    const title = titleInput.trim() || `YouTube — ${extractYoutubeId(url)}`;
    const maxOrder = tracks.length > 0 ? Math.max(...tracks.map(t => t.order)) + 1 : 0;
    await addDoc(collection(db, 'jukeboxTracks'), {
      type: 'youtube',
      title,
      url,
      order: maxOrder,
      createdAt: serverTimestamp(),
    });
    setLinkInput('');
    setTitleInput('');
  };

  /* ── Media Selector handler ──────────────────────────── */
  const handleMediaSelect = async (asset: MediaAsset) => {
    try {
      const maxOrder = tracks.length > 0 ? Math.max(...tracks.map(t => t.order)) + 1 : 0;
      await addDoc(collection(db, 'jukeboxTracks'), {
        type: 'audio',
        title: titleInput.trim() || asset.metadata.title || asset.filename,
        url: asset.url,
        storagePath: asset.storagePath,
        order: maxOrder,
        createdAt: serverTimestamp(),
      });
      setTitleInput('');
    } catch (err) {
      console.error(err);
      await showAlert('Erro', 'Falha ao adicionar áudio à jukebox.');
    }
  };

  /* ── Delete track ────────────────────────────────────── */
  const handleDelete = async (track: JukeboxTrack) => {
    const ok = await showConfirm('Atenção', `Remover "${track.title}" da jukebox?`, 'Remover');
    if (!ok) return;
    if (track.storagePath) {
      try { await deleteObject(ref(storage, track.storagePath)); } catch {}
    }
    await deleteDoc(doc(db, 'jukeboxTracks', track.id));
    if (currentTrack?.id === track.id) {
      setCurrentIndex(-1);
      setIsPlaying(false);
      destroyYtPlayer();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    }
  };

  /* ── Reorder ─────────────────────────────────────────── */
  const moveTrack = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= tracks.length) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'jukeboxTracks', tracks[idx].id), { order: tracks[swapIdx].order });
    batch.update(doc(db, 'jukeboxTracks', tracks[swapIdx].id), { order: tracks[idx].order });
    await batch.commit();
  };

  /* ── Stop playback ───────────────────────────────────── */
  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentIndex(-1);
    destroyYtPlayer();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
  };

  /* ── Pause / Resume ──────────────────────────────────── */
  const togglePause = () => {
    if (!currentTrack) return;
    if (currentTrack.type === 'youtube' && ytPlayerRef.current) {
      if (isPlaying) ytPlayerRef.current.pauseVideo(); else ytPlayerRef.current.playVideo();
    } else if (audioRef.current) {
      if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const statusLabel = !currentTrack ? 'PARADO' : isLooping ? 'LOOP_ATIVO' : isPlaying ? 'TOCANDO' : 'PAUSADO';

  /* ── Render ──────────────────────────────────────────── */
  return (
    <section className="space-y-6 font-chakra">
      {modal}
      <audio ref={audioRef} preload="auto" className="hidden" />

      <MediaSelectorModal 
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={handleMediaSelect}
        title="Selecionar Áudio para Jukebox"
        allowedTypes={['audio']}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <h2 className="font-black uppercase tracking-widest text-lg text-white">Interface_de_Broadcast_Jukebox</h2>
          <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">{tracks.length} FAIXAS NO BUFFER</span>
        </div>
        <div className={`flex items-center gap-3 px-4 py-1.5 border-2 text-[10px] font-black uppercase tracking-widest rounded-sm ${
          isPlaying ? 'border-primary/40 text-primary bg-primary/5 shadow-[0_0_15px_rgba(255,140,0,0.1)]' :
          isLooping ? 'border-amber-500/40 text-amber-400 bg-amber-500/5' :
          'border-[#1a1a1a] text-zinc-600'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-primary animate-pulse shadow-[0_0_5px_rgba(255,140,0,0.8)]' : 'bg-zinc-800'}`} />
          {statusLabel}
        </div>
      </div>

      {/* Player Area */}
      <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl relative">
        <div className="p-6 border-b-4 border-[#1a1a1a] bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-sm border border-primary/20">
               <span className="material-symbols-outlined text-primary text-xl">music_note</span>
            </div>
            <div>
              <p className="font-black text-sm tracking-tight text-white uppercase group-hover:text-primary transition-colors">
                {currentTrack ? currentTrack.title : 'BUFFER_AGUARDANDO_SINAL'}
              </p>
              <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mt-1">
                {currentTrack ? (currentTrack.type === 'youtube' ? 'TRANSMISSÃO_YOUTUBE' : 'STREAM_ÁUDIO_LOCAL') : '---'}
              </p>
            </div>
          </div>
          {/* Transport Controls */}
          <div className="flex items-center gap-4">
            <button onClick={togglePause} disabled={!currentTrack}
              className="w-12 h-12 rounded-sm border-2 border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-black transition-all disabled:opacity-10 active:scale-90 shadow-lg">
              <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onClick={stopPlayback} disabled={!currentTrack}
              className="w-12 h-12 rounded-sm border-2 border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-10 active:scale-90 shadow-lg">
              <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
            </button>
            <button onClick={() => setIsLooping(!isLooping)}
              className={`w-12 h-12 rounded-sm border-2 flex items-center justify-center transition-all active:scale-90 ${
                isLooping ? 'border-amber-500 text-amber-400 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-[#1a1a1a] text-zinc-700 hover:text-amber-400 hover:border-amber-500/40'
              }`} title="Loop de Frequência">
              <span className="material-symbols-outlined text-2xl">repeat_one</span>
            </button>
          </div>
        </div>

        {/* YouTube / Audio display */}
        <div className="relative bg-black" style={{ minHeight: currentTrack?.type === 'youtube' ? 360 : 120 }}>
          <div className="noise-overlay" /><div className="scanlines" />
          {currentTrack?.type === 'youtube' ? (
            <div ref={ytContainerRef} className="w-full relative z-10" style={{ height: 360 }} />
          ) : currentTrack?.type === 'audio' ? (
            <div className="flex items-center justify-center h-32 gap-3 relative z-10">
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className={`w-1.5 rounded-full transition-all duration-150 ${isPlaying ? 'bg-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'bg-zinc-900'}`}
                  style={{ height: isPlaying ? `${15 + Math.random() * 60}px` : '10px', animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-zinc-800 text-[11px] font-black uppercase tracking-[0.4em] relative z-10">
              SELECIONE_FAIXA_PARA_INICIAR_TRANSMISSÃO
            </div>
          )}
        </div>
      </div>

      {/* Add Track Form */}
      <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-6 rounded-xl shadow-xl space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-zinc-700 text-lg">add_circle</span>
          <p className="font-black text-[10px] uppercase tracking-widest text-zinc-500">Injetar_Novo_Sinal_na_Playlist</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <input type="text" placeholder="IDENTIFICADOR_DA_FAIXA (OPCIONAL)" value={titleInput}
             onChange={(e) => setTitleInput(e.target.value)}
             className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[10px] font-black uppercase tracking-widest text-white px-4 py-3 focus:border-primary outline-none rounded-sm placeholder:text-zinc-800 transition-all" />
           <div className="flex gap-2">
             <input type="text" placeholder="URL_DO_YOUTUBE..." value={linkInput}
               onChange={(e) => setLinkInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
               className="flex-1 bg-black/60 border-2 border-[#1a1a1a] text-[10px] font-black uppercase tracking-widest text-white px-4 py-3 focus:border-red-500 outline-none rounded-sm placeholder:text-zinc-800 transition-all" />
             <button onClick={handleAddLink}
               className="px-6 py-3 bg-red-950/20 text-red-500 border-2 border-red-500/20 text-[10px] font-black tracking-widest hover:bg-red-500 hover:text-white transition-all rounded-sm active:scale-95">
               YOUTUBE
             </button>
           </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">OU</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        <div className="flex justify-center">
          <button onClick={() => setIsMediaSelectorOpen(true)}
            className="flex items-center gap-3 px-10 py-3.5 bg-primary/10 text-primary border-2 border-primary/20 text-[10px] font-black tracking-widest hover:bg-primary/20 transition-all rounded-sm active:scale-95 glow-orange">
            <span className="material-symbols-outlined text-sm">perm_media</span>
            ADICIONAR_DO_ACERVO_DE_MÍDIA
          </button>
        </div>
      </div>

      {/* Playlist */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2 px-2">
          <span className="material-symbols-outlined text-zinc-700 text-lg">playlist_play</span>
          <p className="font-black text-[10px] uppercase tracking-widest text-zinc-500">Sequência_de_Frequências_Ativas</p>
        </div>

        {tracks.length === 0 ? (
          <div className="bg-black/20 p-24 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20">
            <p className="text-zinc-700 font-black text-[12px] uppercase tracking-[0.4em]">LISTA_DE_REPRODUÇÃO_VAZIA</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tracks.map((track, idx) => {
              const isActive = currentTrack?.id === track.id;
              return (
                <div key={track.id} className={`bg-[#1a1a1a] border-4 p-4 flex items-center justify-between rounded-xl shadow-lg transition-all group ${
                  isActive ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(255,140,0,0.1)]' : 'border-[#1a1a1a] hover:border-white/5'
                }`}>
                  <div className="flex items-center gap-5 min-w-0 flex-1">
                    <span className={`font-black text-[11px] w-8 text-right font-mono ${isActive ? 'text-primary' : 'text-zinc-800'}`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <button onClick={() => playTrackAtIndex(idx)}
                      className={`w-10 h-10 rounded-sm flex items-center justify-center border-2 transition-all active:scale-90 ${
                        isActive ? 'bg-primary text-black border-primary' : 'bg-black text-zinc-600 border-[#1a1a1a] group-hover:border-zinc-700 hover:text-white'
                      }`}>
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isActive && isPlaying ? 'equalizer' : 'play_arrow'}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-black text-sm tracking-tight truncate uppercase ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                        {track.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                         <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${
                           track.type === 'youtube' ? 'border-red-500/20 text-red-500/60' : 'border-emerald-500/20 text-emerald-500/60'
                         }`}>
                           {track.type === 'youtube' ? 'YOUTUBE' : 'ÁUDIO_LOCAL'}
                         </span>
                         {isActive && isPlaying && (
                           <div className="flex gap-0.5">
                             {[1,2,3,4].map(i => <div key={i} className="w-1 h-2.5 bg-primary animate-pulse rounded-full" style={{ animationDelay: `${i * 100}ms` }} />)}
                           </div>
                         )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                       <button onClick={() => moveTrack(idx, -1)} disabled={idx === 0}
                         className="material-symbols-outlined text-zinc-800 hover:text-primary text-lg disabled:opacity-5 transition-all">
                         keyboard_arrow_up
                       </button>
                       <button onClick={() => moveTrack(idx, 1)} disabled={idx === tracks.length - 1}
                         className="material-symbols-outlined text-zinc-800 hover:text-primary text-lg disabled:opacity-5 transition-all">
                         keyboard_arrow_down
                       </button>
                    </div>
                    <button onClick={() => handleDelete(track)}
                      className="w-10 h-10 bg-black/40 border border-white/5 flex items-center justify-center text-zinc-800 hover:text-red-500 hover:border-red-500/30 transition-all rounded-sm group/del ml-2">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer / Status Bar */}
      <div className="flex items-center justify-between bg-black/40 border-4 border-[#1a1a1a] rounded-xl px-8 py-4 shadow-inner">
        <div className="flex items-center gap-4">
           <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
             FAIXA_ATUAL: {currentIndex >= 0 ? `${currentIndex + 1} / ${tracks.length}` : 'TRANSMISSÃO_INATIVA'}
           </span>
        </div>
        <div className="flex items-center gap-6">
          {isLooping && (
            <div className="flex items-center gap-2 text-amber-500/60">
               <span className="material-symbols-outlined text-sm animate-spin-slow">sync</span>
               <span className="text-[9px] font-black uppercase tracking-widest">REDUNDÂNCIA_ATIVA</span>
            </div>
          )}
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isPlaying ? 'text-primary' : 'text-zinc-800'}`}>
            ESTADO: {statusLabel}
          </span>
        </div>
      </div>
    </section>
  );
}
