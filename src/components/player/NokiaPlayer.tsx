import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, Volume2, Play, Pause, X, Rewind, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IntelBase, AudioIntel } from '../../services/IntelEngine';
import { audioEngine } from '../../services/AudioEngine';
import type { WalkmanStatus } from '../../types/player';

// Lazy loaded scanner to keep bundle optimized
const QrScanner = React.lazy(() => import('../QrScanner'));

interface NokiaPlayerProps {
  currentIntel: IntelBase | null;
  status: WalkmanStatus;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  intelItems: IntelBase[];
  currentIntelId: string | null;
  onIntelSelect: (intel: IntelBase) => void;
  onRewind?: () => void;
  onEject: () => void;
  onScanClick: () => void;
  onCancelScan: () => void;
  onQrDetected: (code: string) => void;
  hasTerminalAccess?: boolean;
  onTerminalOpen?: () => void;
  hasMacAccess?: boolean;
  onMacOpen?: () => void;
  onProfileOpen: () => void;
  onCharacterSwitch?: () => void;
  registerBackHandler?: (handler: (() => boolean) | null) => void;
  setBackVisible?: (v: boolean) => void;
}

type FilterTab = 'TODOS' | 'AUDIO' | 'DOCS' | 'SMS';

const placeholderMessages = [
  { id: '1', sender: 'DESCONHECIDO', text: 'Você ainda está aí?', time: '10:42', read: false },
  { id: '2', sender: 'AGENTE K', text: 'O pacote foi entregue no ponto de encontro.', time: 'Ontem', read: true },
  { id: '3', sender: 'SISTEMA', text: 'Nova pista detectada na zona sul.', time: 'Segunda', read: true },
  { id: '4', sender: 'OPERADOR', text: 'Mantenha silêncio de rádio até novas ordens.', time: '23/05', read: true },
];

// Retro square-wave audio feedback engine
class NokiaAudioFeedback {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      } catch (e) { /* fallback silently */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, durationMs: number, gainVal: number = 0.03) {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationMs / 1000);
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + durationMs / 1000);
    } catch (e) { /* ignore */ }
  }

  playBeep() { this.playTone(880, 45); }
  playConfirm() {
    this.playTone(880, 60, 0.04);
    setTimeout(() => this.playTone(1320, 80, 0.04), 60);
  }
  playBack() {
    this.playTone(1100, 60, 0.04);
    setTimeout(() => this.playTone(660, 100, 0.04), 60);
  }
}

const sfx = new NokiaAudioFeedback();

export default function NokiaPlayer({
  currentIntel,
  status,
  isPlaying,
  setIsPlaying,
  volume,
  setVolume,
  intelItems,
  currentIntelId,
  onIntelSelect,
  onRewind,
  onEject,
  onScanClick,
  onCancelScan,
  onQrDetected,
  hasTerminalAccess = false,
  onTerminalOpen,
  hasMacAccess = false,
  onMacOpen,
  onProfileOpen,
  onCharacterSwitch,
  registerBackHandler,
  setBackVisible,
}: NokiaPlayerProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('TODOS');
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00');
  const [durationTimeStr, setDurationTimeStr] = useState('00:00');
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always show back on menu (false = hidden). Since we no longer have a separate playback view,
  // the back button in the wrapper is never needed on the main menu.
  useEffect(() => {
    if (setBackVisible) {
      setBackVisible(false);
    }
  }, [setBackVisible]);

  // Register back button handler in the parent wrapper
  useEffect(() => {
    if (registerBackHandler) {
      registerBackHandler(() => {
        if (status === 'SCANNING') {
          onCancelScan();
          return true;
        }
        if (showVolumeBar) {
          setShowVolumeBar(false);
          return true;
        }
        return false;
      });
    }
    return () => {
      if (registerBackHandler) registerBackHandler(null);
    };
  }, [registerBackHandler, status, showVolumeBar, onCancelScan]);

  // Filter items
  const audioItems = useMemo(() => intelItems.filter((item) => item.type === 'AUDIO'), [intelItems]);
  const fileItems = useMemo(() => intelItems.filter((item) => item.type !== 'AUDIO'), [intelItems]);

  // Sorted items based on active tab
  const sortedItems = useMemo(() => {
    if (activeTab === 'AUDIO') {
      return [...audioItems, ...(fileItems.length > 0 ? [{ __divider: true, label: 'PISTAS / DOCS' } as any, ...fileItems] : [])];
    }
    if (activeTab === 'DOCS') {
      return [...fileItems, ...(audioItems.length > 0 ? [{ __divider: true, label: 'PROVAS / AUDIO' } as any, ...audioItems] : [])];
    }
    return [...audioItems, ...(fileItems.length > 0 && audioItems.length > 0 ? [{ __divider: true, label: 'PISTAS / DOCS' } as any] : []), ...fileItems];
  }, [activeTab, audioItems, fileItems]);

  // Track Audio Progress
  useEffect(() => {
    progressIntervalRef.current = setInterval(() => {
      const current = audioEngine.getCurrentTime();
      const duration = audioEngine.getDuration();
      setAudioProgress(current);
      setAudioDuration(duration);

      const formatTime = (time: number) => {
        if (isNaN(time) || time < 0) return '00:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };

      setCurrentTimeStr(formatTime(current));
      setDurationTimeStr(formatTime(duration));
    }, 250);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Handle item tap (audio or file)
  const handleItemTap = (item: IntelBase) => {
    sfx.playConfirm();
    onIntelSelect(item);
  };

  // Toggle play/pause
  const handlePlayToggle = () => {
    sfx.playConfirm();
    if (currentIntel?.type === 'AUDIO') {
      setIsPlaying(!isPlaying);
    }
  };

  // Rewind
  const handleRewindLocal = () => {
    if (onRewind) {
      onRewind();
    } else {
      sfx.playBeep();
      if (currentIntel) {
        audioEngine.stop();
        setTimeout(() => {
          audioEngine.play().catch(() => {});
        }, 1000);
      }
    }
  };

  // Eject
  const handleEject = () => {
    sfx.playBack();
    onEject();
  };

  // Volume toggle
  const handleVolumeTap = () => {
    sfx.playConfirm();
    if (showVolumeBar) {
      setShowVolumeBar(false);
    } else {
      setShowVolumeBar(true);
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
      volumeTimeoutRef.current = setTimeout(() => setShowVolumeBar(false), 4000);
    }
  };

  // Volume adjust
  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolume(clamped);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumeBar(false), 4000);
  };

  const handleTabChange = (tab: FilterTab) => {
    sfx.playBeep();
    setActiveTab(tab);
  };

  const isScanning = status === 'SCANNING';
  const hasActiveIntel = !!currentIntel && (status === 'LOADED' || status === 'PLAYING' || status === 'REWINDING');

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'TODOS', label: 'TODOS' },
    { key: 'AUDIO', label: 'AUDIO' },
    { key: 'DOCS', label: 'DOCS' },
    { key: 'SMS', label: 'SMS' },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden relative select-none">
      <div className="flex-grow overflow-hidden relative flex flex-col">
        {isScanning ? (
          /* ─── SCANNER FULLSCREEN ─── */
          <div className="w-full h-full flex flex-col justify-between bg-black relative overflow-hidden flex-grow">
            <div className="absolute top-1 left-2 z-20 text-[#edfeed] font-black text-[9px] uppercase tracking-widest bg-[#111e14] px-1 animate-pulse">
              SCANNER ATIVO
            </div>
            <div className="flex-grow w-full bg-[#222] relative flex items-center justify-center min-h-0">
              <React.Suspense fallback={<div className="text-[#edfeed] text-[10px] animate-pulse">INICIANDO CAMERA...</div>}>
                <QrScanner onDetected={onQrDetected} onCancel={onCancelScan} />
              </React.Suspense>
              <div className="absolute w-24 h-24 border border-dashed border-[#edfeed]/40 pointer-events-none flex items-center justify-center">
                <div className="w-2 h-2 bg-[#edfeed] rounded-full" />
              </div>
            </div>
            <div className="h-8 bg-[#edfeed] text-[#111e14] border-t border-[#111e14] px-3 flex items-center justify-between text-[10px] font-bold shrink-0">
              <span>[MIRA QR CODE]</span>
              <button onClick={onCancelScan} className="uppercase hover:underline active:scale-95">[Cancelar]</button>
            </div>
          </div>
        ) : showVolumeBar ? (
          /* ─── VOLUME OVERLAY ─── */
          <div className="w-full h-full flex flex-col justify-center items-center gap-4 px-4 select-none bg-[#edfeed] flex-grow">
            <div className="text-[12px] font-black uppercase flex items-center gap-1.5">
              <Volume2 size={14} /> VOLUME
            </div>
            <div className="w-full border-2 border-[#111e14] p-1.5 flex gap-1 h-10 items-center bg-[#edfeed]">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => handleVolumeChange((i + 1) * 10)}
                  className={`h-full flex-1 border border-[#111e14] cursor-pointer transition-all active:scale-90 ${
                    volume >= (i + 1) * 10 ? 'bg-[#111e14]' : 'bg-transparent hover:bg-[#111e14]/10'
                  }`}
                />
              ))}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-widest">
              NIVEL: {volume}%
            </div>
          </div>
        ) : (
          /* ─── MAIN MENU (always visible) ─── */
          <div className="flex flex-col h-full bg-[#edfeed] p-1 px-2 flex-grow min-h-0">

            {/* ─── TOP AREA: QR SCAN or INLINE PLAYER ─── */}
            <div className="shrink-0 mb-1">
              <AnimatePresence mode="wait">
                {hasActiveIntel && currentIntel ? (
                  /* ─── INLINE PLAYER (materializes in place of QR) ─── */
                  <motion.div
                    key="player-inline"
                    initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="border border-[#111e14] p-2 bg-[#111e14]/5"
                  >
                    {/* Track info */}
                    <div className="text-center mb-1.5">
                      <div className="text-[12px] font-black uppercase tracking-tight truncate leading-tight">
                        {currentIntel.title}
                      </div>
                      <div className="text-[9px] font-bold opacity-60 uppercase truncate mt-0.5">
                        {currentIntel instanceof AudioIntel ? currentIntel.metadata.artist : currentIntel.metadata?.npc}
                      </div>
                    </div>

                    {/* Cassette Graphic */}
                    <div className="flex justify-center mb-1.5">
                      <div className="w-24 h-12 bg-[#111e14] rounded border-2 border-[#111e14] relative flex items-center justify-between px-4">
                        {[0, 1].map((ri) => (
                          <div
                            key={ri}
                            className="w-5 h-5 rounded-full bg-[#edfeed] flex items-center justify-center relative overflow-hidden"
                          >
                            <div
                              className={`w-full h-0.5 bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`}
                              style={{ animationDuration: '3s' }}
                            />
                            <div
                              className={`w-0.5 h-full bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`}
                              style={{ animationDuration: '3s' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-1.5">
                      <div className="flex justify-between items-center text-[8px] font-black px-0.5 mb-0.5">
                        <span>{currentTimeStr}</span>
                        <span className="uppercase tracking-widest text-[#111e14]/50">
                          {status === 'REWINDING' ? 'REWINDING' : ''}
                        </span>
                        <span>{durationTimeStr}</span>
                      </div>
                      <div className="w-full border border-[#111e14] h-3 p-[1px] flex gap-[1px] items-center bg-[#edfeed]">
                        {Array.from({ length: 20 }).map((_, i) => {
                          const pct = (i + 1) / 20;
                          const isFilled = audioDuration > 0 && (audioProgress / audioDuration) >= pct;
                          return (
                            <div
                              key={i}
                              className={`h-full flex-1 ${isFilled ? 'bg-[#111e14]' : 'bg-transparent'}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Playback controls */}
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={handleRewindLocal}
                        className={`w-8 h-8 border border-[#111e14] rounded flex items-center justify-center transition-all active:scale-90 ${
                          status === 'REWINDING'
                            ? 'bg-[#111e14] text-[#edfeed]'
                            : 'text-[#111e14] active:bg-[#111e14] active:text-[#edfeed] hover:bg-[#111e14]/10'
                        }`}
                      >
                        <Rewind size={14} fill="currentColor" />
                      </button>
                      <button
                        onClick={handlePlayToggle}
                        className="w-10 h-10 border-2 border-[#111e14] rounded-full flex items-center justify-center bg-[#111e14] text-[#edfeed] active:scale-90 transition-all"
                      >
                        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                      </button>
                      <button
                        onClick={handleEject}
                        className="w-8 h-8 border border-[#111e14] rounded flex items-center justify-center text-[#111e14] active:bg-[#111e14] active:text-[#edfeed] transition-all active:scale-90 hover:bg-[#111e14]/10"
                      >
                        <X size={16} strokeWidth={3} />
                      </button>
                      <div className="w-[1px] h-6 bg-[#111e14]/30 mx-0.5" />
                      <button
                        onClick={handleVolumeTap}
                        className="w-8 h-8 border border-[#111e14] rounded flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] transition-all active:scale-90 hover:bg-[#111e14]/10"
                      >
                        <Volume2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* ─── QR SCAN BUTTON ─── */
                  <motion.div
                    key="qr-scan"
                    initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    onClick={onScanClick}
                    className="border border-dashed border-[#111e14] p-3 flex justify-center items-center cursor-pointer hover:bg-[#111e14]/10 active:scale-95 gap-2"
                  >
                    <Camera size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">ESCANEAR CODIGO QR</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ─── FILTER TABS ─── */}
            <div className="flex border border-[#111e14] shrink-0 mb-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#111e14] text-[#edfeed]'
                      : 'bg-transparent text-[#111e14] hover:bg-[#111e14]/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── UNIFIED INTEL LIST ─── */}
            <div className="flex-grow overflow-y-auto min-h-0" style={{ scrollbarWidth: 'none' }}>
              {activeTab === 'SMS' ? (
                <div className="flex flex-col">
                  {placeholderMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="text-[11px] py-2 px-2 border-b border-[#111e14]/10 flex flex-col gap-0.5 hover:bg-[#111e14]/5 cursor-pointer active:bg-[#111e14]/10 transition-colors"
                      onClick={() => sfx.playConfirm()}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          {!msg.read && <div className="w-1.5 h-1.5 bg-[#111e14] rounded-full animate-pulse" />}
                          <span className="font-black uppercase text-[9px] tracking-tight">{msg.sender}</span>
                        </div>
                        <span className="text-[8px] opacity-60 font-black">{msg.time}</span>
                      </div>
                      <div className="truncate opacity-80 text-[10px] leading-tight">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div className="py-4 flex justify-center opacity-30">
                    <MessageSquare size={16} />
                  </div>
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-[10px] font-bold uppercase opacity-70">
                    Nenhum intel desbloqueado
                  </div>
                  <div className="text-[8px] opacity-50 mt-1 uppercase">
                    Escaneie um QR code para comecar
                  </div>
                </div>
              ) : (
                sortedItems.map((item, idx) => {
                  // Divider row
                  if (item.__divider) {
                    return (
                      <div key={`div-${idx}`} className="flex items-center gap-2 py-1.5 px-1 select-none">
                        <div className="flex-1 border-t border-[#111e14]/30" />
                        <span className="text-[8px] font-bold opacity-50 uppercase tracking-widest shrink-0">{item.label}</span>
                        <div className="flex-1 border-t border-[#111e14]/30" />
                      </div>
                    );
                  }

                  const isAudio = item.type === 'AUDIO';
                  const isCurrent = item.id === currentIntelId;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemTap(item)}
                      className={`text-[11px] py-1.5 px-2 cursor-pointer flex items-center gap-2 font-medium truncate transition-all border border-transparent rounded mb-0.5 ${
                        isCurrent
                          ? 'bg-[#111e14] text-[#edfeed] font-bold border-[#111e14]'
                          : 'hover:bg-[#111e14]/10'
                      }`}
                    >
                      {isAudio ? (
                        <span className="text-[9px] shrink-0 border border-current px-1 rounded font-black leading-tight">AUD</span>
                      ) : (
                        <span className="text-[9px] shrink-0 border border-current px-1 rounded font-black leading-tight">{item.type === 'VISUAL' ? 'VIS' : item.type === 'TEXT' ? 'TXT' : 'DOC'}</span>
                      )}
                      <span className="truncate">{item.title}</span>
                      {isCurrent && isPlaying && (
                        <span className="text-[8px] ml-auto shrink-0 animate-pulse">{'|>'}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
