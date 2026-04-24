import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../../lib/firebase';
import {
  collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc,
  serverTimestamp, query, orderBy, getDocs, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useModal } from './ConfirmModal';

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
  const [isUploading, setIsUploading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytApiReady = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  /* ── Upload audio file ───────────────────────────────── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      await showAlert('Arquivo Grande', 'Máximo 50MB.');
      return;
    }
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `jukebox/${Date.now()}_${file.name}`);
      await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      const maxOrder = tracks.length > 0 ? Math.max(...tracks.map(t => t.order)) + 1 : 0;
      await addDoc(collection(db, 'jukeboxTracks'), {
        type: 'audio',
        title: titleInput.trim() || file.name.replace(/\.[^/.]+$/, ''),
        url: downloadURL,
        storagePath: storageRef.fullPath,
        order: maxOrder,
        createdAt: serverTimestamp(),
      });
      setTitleInput('');
    } catch (err) {
      console.error(err);
      await showAlert('Erro', 'Falha no upload do áudio.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    <section className="space-y-6">
      {modal}
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-6 bg-orange-500"></div>
          <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Jukebox</h2>
          <span className="text-[10px] font-label text-zinc-500 tracking-wider">{tracks.length} FAIXAS</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 border text-[10px] font-label uppercase tracking-widest ${
          isPlaying ? 'border-orange-500/40 text-orange-400 bg-orange-500/5' :
          isLooping ? 'border-amber-500/40 text-amber-400 bg-amber-500/5' :
          'border-zinc-700 text-zinc-500'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-700'}`}></span>
          {statusLabel}
        </div>
      </div>

      {/* Player Area */}
      <div className="bg-surface-container-lowest border border-zinc-800 machined-edge overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-orange-500">music_note</span>
            <div>
              <p className="font-headline font-bold text-sm tracking-tight text-zinc-200">
                {currentTrack ? currentTrack.title : 'NENHUMA_FAIXA_SELECIONADA'}
              </p>
              <p className="text-[9px] font-label uppercase text-zinc-600 tracking-widest">
                {currentTrack ? (currentTrack.type === 'youtube' ? 'YOUTUBE' : 'ÁUDIO_LOCAL') : '—'}
              </p>
            </div>
          </div>
          {/* Transport Controls */}
          <div className="flex items-center gap-2">
            <button onClick={togglePause} disabled={!currentTrack}
              className="w-9 h-9 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-orange-500 hover:border-orange-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onClick={stopPlayback} disabled={!currentTrack}
              className="w-9 h-9 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
            </button>
            <button onClick={() => setIsLooping(!isLooping)}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                isLooping ? 'border-amber-500 text-amber-400 bg-amber-500/10 animate-pulse' : 'border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50'
              }`} title="Loop contínuo">
              <span className="material-symbols-outlined text-lg">repeat_one</span>
            </button>
          </div>
        </div>

        {/* YouTube / Audio display */}
        <div className="relative bg-black" style={{ minHeight: currentTrack?.type === 'youtube' ? 320 : 80 }}>
          {currentTrack?.type === 'youtube' ? (
            <div ref={ytContainerRef} className="w-full" style={{ height: 320 }} />
          ) : currentTrack?.type === 'audio' ? (
            <div className="flex items-center justify-center h-20 gap-3">
              {/* VU meter bars */}
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className={`w-1.5 rounded-sm transition-all duration-150 ${isPlaying ? 'bg-orange-500' : 'bg-zinc-800'}`}
                  style={{ height: isPlaying ? `${12 + Math.random() * 40}px` : '8px', animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-zinc-700 text-[10px] font-label uppercase tracking-widest">
              SELECIONE_UMA_FAIXA_PARA_REPRODUZIR
            </div>
          )}
        </div>
      </div>

      {/* Add Track Form */}
      <div className="bg-surface-container-low border border-zinc-800 p-4 machined-edge space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-zinc-500 text-sm">add_circle</span>
          <p className="font-label text-[10px] uppercase tracking-widest text-zinc-400">ADICIONAR_FAIXA</p>
        </div>

        <div className="flex gap-3">
          <input type="text" placeholder="TÍTULO (OPCIONAL)" value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            className="flex-1 bg-surface-container-lowest border border-zinc-800 text-[10px] font-label uppercase tracking-widest text-zinc-300 px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder:text-zinc-700" />
        </div>

        <div className="flex gap-3">
          <input type="text" placeholder="COLE_UM_LINK_DO_YOUTUBE..." value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
            className="flex-1 bg-surface-container-lowest border border-zinc-800 text-[10px] font-label uppercase tracking-widest text-zinc-300 px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder:text-zinc-700" />
          <button onClick={handleAddLink}
            className="px-4 py-2 bg-red-900/40 text-red-300 border border-red-800/40 text-[10px] font-label font-bold tracking-widest hover:bg-red-800/40 transition-all machined-edge flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">smart_display</span>
            YOUTUBE
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
            className="px-4 py-2 bg-secondary-container text-on-secondary-container border border-zinc-700 text-[10px] font-label font-bold tracking-widest hover:bg-zinc-700 transition-all machined-edge flex items-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-sm">{isUploading ? 'sync' : 'upload_file'}</span>
            {isUploading ? 'ENVIANDO...' : 'UPLOAD_ÁUDIO'}
          </button>
        </div>
      </div>

      {/* Playlist */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-zinc-500 text-sm">playlist_play</span>
          <p className="font-label text-[10px] uppercase tracking-widest text-zinc-400">FILA_DE_REPRODUÇÃO</p>
        </div>

        {tracks.length === 0 ? (
          <div className="bg-surface-container-low p-8 text-center border-l-2 border-zinc-800 machined-edge">
            <p className="text-zinc-500 font-label text-xs tracking-widest">NENHUMA_FAIXA_NA_JUKEBOX</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {tracks.map((track, idx) => {
              const isActive = currentTrack?.id === track.id;
              return (
                <div key={track.id} className={`bg-surface-container-low p-3 flex items-center justify-between machined-edge border-l-2 transition-all ${
                  isActive ? 'border-orange-500 bg-orange-500/5 shadow-[0_0_15px_rgba(255,140,0,0.08)]' : idx % 2 === 0 ? 'border-zinc-700' : 'border-zinc-800'
                }`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`font-label text-[10px] w-6 text-center ${isActive ? 'text-orange-500 font-bold' : 'text-zinc-600'}`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <button onClick={() => playTrackAtIndex(idx)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all hover:scale-110 active:scale-90 ${
                        isActive ? 'bg-orange-500/20 text-orange-500 border-orange-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-orange-400 hover:border-orange-500/30'
                      }`}>
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isActive && isPlaying ? 'equalizer' : 'play_arrow'}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-headline font-bold text-sm tracking-tight truncate ${isActive ? 'text-orange-400' : 'text-zinc-200'}`}>
                        {track.title}
                      </p>
                      <p className="text-[9px] font-label uppercase text-zinc-600 tracking-widest">
                        {track.type === 'youtube' ? '▶ YOUTUBE' : '♫ ÁUDIO'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* VU dots */}
                    {isActive && isPlaying && (
                      <div className="flex gap-0.5 mr-3">
                        {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-orange-500 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
                      </div>
                    )}
                    <button onClick={() => moveTrack(idx, -1)} disabled={idx === 0}
                      className="material-symbols-outlined text-zinc-600 hover:text-zinc-300 text-sm p-1 disabled:opacity-20">
                      arrow_upward
                    </button>
                    <button onClick={() => moveTrack(idx, 1)} disabled={idx === tracks.length - 1}
                      className="material-symbols-outlined text-zinc-600 hover:text-zinc-300 text-sm p-1 disabled:opacity-20">
                      arrow_downward
                    </button>
                    <button onClick={() => handleDelete(track)}
                      className="material-symbols-outlined text-zinc-600 hover:text-red-400 text-sm p-1 transition-colors ml-1">
                      delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-surface-container-lowest border border-zinc-800 px-4 py-2 machined-edge">
        <span className="text-[9px] font-label uppercase tracking-widest text-zinc-600">
          FAIXA {currentIndex >= 0 ? currentIndex + 1 : '—'} / {tracks.length}
        </span>
        <div className="flex items-center gap-3">
          {isLooping && <span className="text-[9px] font-label uppercase tracking-widest text-amber-500 animate-pulse">⟳ LOOP</span>}
          <span className={`text-[9px] font-label uppercase tracking-widest ${isPlaying ? 'text-orange-500' : 'text-zinc-600'}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </section>
  );
}
