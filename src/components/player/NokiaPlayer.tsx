import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IntelBase, AudioIntel } from '../../services/IntelEngine';
import { audioEngine } from '../../services/AudioEngine';
import type { WalkmanStatus, CharacterData, Group } from '../../types/player';
import { groupService } from '../../services/GroupService';

// Lazy loaded scanner to keep bundle optimized
const QrScanner = React.lazy(() => import('../QrScanner'));

/* ─── PIXEL ART ICONS ─── */
const PixelIcon = {
  Play: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M4 2h2v2H4V2zm2 2h2v2H6V4zm2 2h2v2H8V6zm-2 2h2v2H6V8zm-2 2h2v2H4v-2z" />
    </svg>
  ),
  Pause: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2h3v10H3V2zm5 0h3v10H8V2z" />
    </svg>
  ),
  Rewind: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M10 2h2v10h-2V2zM2 6h2v2H2V6zm2-2h2v2H4V4zm2-2h2v2H6V2zm0 8h2v2H6v-2zm-2-2h2v2H4V8z" />
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 2h2v2H2V2zm2 2h2v2H4V4zm2 2h2v2H6V6zm2 2h2v2H8V8zm2 2h2v2h-2v-2zm-8 8h2v-2H2v2zm2-2h2v-2H4v2zm4-4h2v-2H8v2zm2-2h2v-2h-2v2z" />
    </svg>
  ),
  Volume: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 5h2v4H2V5zm3-2h2v8H5V3zm3 0h1v1H8V3zm2 2h1v1h-1V5zm1 2h1v1h-1V7zm-1 2h1v1h-1V9zm-2 2h1v1H8v-1z" />
    </svg>
  ),
  Camera: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 4h10v8H2V4zm2-2h6v2H4V2zm3 5h2v2H7V7z" />
    </svg>
  ),
  Audio: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 7h2v2H2V7zm2-2h2v2H4V5zm2-2h2v2H6V3zm2 2h2v2H8V5zm2 2h2v2h-2V7z" />
    </svg>
  ),
  Doc: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 1h6l3 3v7H2V1zm1 2v7h7V5H7V2H3zm5 0v2h2L8 3z" />
    </svg>
  ),
  SMS: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M1 2h12v10H1V2zm2 2v2h8V4H3zm0 4v2h5V8H3z" />
    </svg>
  )
};

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
  activeCharacter?: CharacterData;
  uid?: string;
  onUpdatePhoneNumber?: (phoneNumber: string) => void;
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

function generateRandomUSPhoneNumber(): string {
  const areaCode = Math.floor(100 + Math.random() * 900); // 100-999
  const exchangeCode = Math.floor(100 + Math.random() * 900); // 100-999
  const subscriberNumber = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `(${areaCode}) ${exchangeCode}-${subscriberNumber}`;
}

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
  activeCharacter,
  uid,
  onUpdatePhoneNumber,
}: NokiaPlayerProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('TODOS');
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00');
  const [durationTimeStr, setDurationTimeStr] = useState('00:00');
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to character's groups
  useEffect(() => {
    if (!activeCharacter?.id) return;
    const unsub = groupService.subscribeToGroupsForCharacter(activeCharacter.id, (groups) => {
      setUserGroups(groups);
      if (groups.length > 0) {
        setActiveGroupId(prev => {
          if (prev && groups.some(g => g.id === prev)) return prev;
          return groups[0].id;
        });
      } else {
        setActiveGroupId(null);
      }
    });
    return unsub;
  }, [activeCharacter?.id]);

  // Subscribe to group messages
  useEffect(() => {
    if (!activeGroupId) {
      setGroupMessages([]);
      return;
    }
    const unsub = groupService.subscribeToGroupMessages(activeGroupId, (messages) => {
      setGroupMessages(messages);
    });
    return unsub;
  }, [activeGroupId]);

  // Auto-scroll messages list to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupMessages, activeTab]);

  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !activeGroupId || !activeCharacter) return;
    try {
      sfx.playConfirm();
      const text = newMessageText.trim();
      setNewMessageText('');
      await groupService.sendGroupMessage(
        activeGroupId,
        activeCharacter.id,
        activeCharacter.codinome,
        activeCharacter.phoneNumber || '',
        text
      );
    } catch (error) {
      console.error('[NokiaPlayer] Error sending message:', error);
    }
  };

  // Always show back on menu (false = hidden)
  useEffect(() => {
    if (setBackVisible) {
      setBackVisible(false);
    }
  }, [setBackVisible]);

  // Register back button handler
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

  const audioItems = useMemo(() => intelItems.filter((item) => item.type === 'AUDIO'), [intelItems]);
  const fileItems = useMemo(() => intelItems.filter((item) => item.type !== 'AUDIO'), [intelItems]);

  const sortedItems = useMemo(() => {
    if (activeTab === 'AUDIO') {
      return [...audioItems, ...(fileItems.length > 0 ? [{ __divider: true, label: 'PISTAS / DOCS' } as any, ...fileItems] : [])];
    }
    if (activeTab === 'DOCS') {
      return [...fileItems, ...(audioItems.length > 0 ? [{ __divider: true, label: 'PROVAS / AUDIO' } as any, ...audioItems] : [])];
    }
    return [...audioItems, ...(fileItems.length > 0 && audioItems.length > 0 ? [{ __divider: true, label: 'PISTAS / DOCS' } as any] : []), ...fileItems];
  }, [activeTab, audioItems, fileItems]);

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

  const handleItemTap = (item: IntelBase) => {
    sfx.playConfirm();
    onIntelSelect(item);
  };

  const handlePlayToggle = () => {
    sfx.playConfirm();
    if (currentIntel?.type === 'AUDIO') {
      setIsPlaying(!isPlaying);
    }
  };

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

  const handleEject = () => {
    sfx.playBack();
    onEject();
  };

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

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'TODOS', label: 'TUDO', icon: <span>[*]</span> },
    { key: 'AUDIO', label: 'AUD', icon: <PixelIcon.Audio /> },
    { key: 'DOCS', label: 'DOC', icon: <PixelIcon.Doc /> },
    { key: 'SMS', label: 'SMS', icon: <PixelIcon.SMS /> },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden relative select-none">
      <div className="flex-grow overflow-hidden relative flex flex-col">
        {isScanning ? (
          <div className="w-full h-full flex flex-col justify-between bg-black relative overflow-hidden flex-grow">
            <div className="absolute top-1 left-2 z-20 text-[#edfeed] font-black text-[9px] uppercase tracking-widest bg-[#111e14] px-1 animate-pulse">
              SCANNER ATIVO
            </div>
            <div className="flex-grow w-full bg-[#222] relative flex items-center justify-center min-h-0">
              <React.Suspense fallback={<div className="text-[#edfeed] text-[10px] animate-pulse">INICIANDO CAMERA...</div>}>
                <QrScanner onDetected={onQrDetected} onCancel={onCancelScan} />
              </React.Suspense>
              {/* ASCII Crosshair */}
              <div className="absolute w-32 h-32 border border-dashed border-[#edfeed]/40 pointer-events-none flex items-center justify-center opacity-50">
                <div className="absolute inset-0 flex items-center justify-center text-[#edfeed] text-[20px] font-mono">
                  +
                </div>
                <div className="absolute top-0 left-0">┌</div>
                <div className="absolute top-0 right-0">┐</div>
                <div className="absolute bottom-0 left-0">└</div>
                <div className="absolute bottom-0 right-0">┘</div>
              </div>
            </div>
            <div className="h-10 bg-[#edfeed] text-[#111e14] border-t-2 border-[#111e14] px-3 flex items-center justify-between text-[11px] font-black shrink-0">
              <span className="flex items-center gap-2"><PixelIcon.Camera /> ALINHE O CÓDIGO</span>
              <button onClick={onCancelScan} className="uppercase px-2 py-1 border border-[#111e14] active:bg-[#111e14] active:text-[#edfeed]">SAIR</button>
            </div>
          </div>
        ) : showVolumeBar ? (
          <div className="w-full h-full flex flex-col justify-center items-center gap-6 px-4 select-none bg-[#edfeed] flex-grow">
            <div className="text-[14px] font-black uppercase flex flex-col items-center gap-2">
              <PixelIcon.Volume />
              <span>VOLUME</span>
            </div>
            <div className="w-full border-2 border-[#111e14] p-1.5 flex gap-1 h-12 items-center bg-[#edfeed] shadow-[2px_2px_0px_#111e14]">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => handleVolumeChange((i + 1) * 10)}
                  className={`h-full flex-1 border border-[#111e14] cursor-pointer transition-all active:scale-90 ${
                    volume >= (i + 1) * 10 ? 'bg-[#111e14]' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <div className="text-[12px] font-black uppercase tracking-[0.2em]">
              NIVEL: {volume}%
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-[#edfeed] p-1 px-2 flex-grow min-h-0">
            {/* ─── TOP AREA: QR SCAN or INLINE PLAYER ─── */}
            <div className="shrink-0 mb-2 mt-1">
              <AnimatePresence mode="wait">
                {hasActiveIntel && currentIntel ? (
                  <motion.div
                    key="player-inline"
                    initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="border-2 border-[#111e14] p-2 bg-[#edfeed] shadow-[2px_2px_0px_#111e14]"
                  >
                    <div className="text-center mb-2">
                      <div className="text-[13px] font-black uppercase truncate leading-none mb-1">
                        {currentIntel.title}
                      </div>
                      <div className="text-[9px] font-bold opacity-70 uppercase truncate">
                        {currentIntel instanceof AudioIntel ? currentIntel.metadata.artist : currentIntel.metadata?.npc}
                      </div>
                    </div>

                    {/* Pixel Cassette */}
                    <div className="flex justify-center mb-2">
                      <div className="w-28 h-12 bg-[#edfeed] border-2 border-[#111e14] relative flex items-center justify-around px-4">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 border-b-2 border-[#111e14]" />
                        {[0, 1].map((ri) => (
                          <div
                            key={ri}
                            className="w-6 h-6 border-2 border-[#111e14] flex items-center justify-center relative bg-white/20"
                          >
                            <div
                              className={`w-full h-0.5 bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`}
                              style={{ animationDuration: '4s' }}
                            />
                            <div
                              className={`w-0.5 h-full bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`}
                              style={{ animationDuration: '4s' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-2">
                      <div className="flex justify-between items-center text-[9px] font-black px-0.5 mb-1">
                        <span>{currentTimeStr}</span>
                        <span className="uppercase tracking-[0.2em] text-[8px]">
                          {status === 'REWINDING' ? '<< REW' : isPlaying ? 'PLAYING' : 'PAUSED'}
                        </span>
                        <span>{durationTimeStr}</span>
                      </div>
                      <div className="w-full border-2 border-[#111e14] h-4 p-[1px] flex gap-[1px] items-center bg-[#edfeed]">
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

                    {/* Controls */}
                    <div className="flex justify-center items-center gap-3">
                      <button
                        onClick={handleRewindLocal}
                        className={`w-10 h-9 border-2 border-[#111e14] flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] shadow-[1px_1px_0px_#111e14] ${status === 'REWINDING' ? 'bg-[#111e14] text-[#edfeed]' : ''}`}
                      >
                        <PixelIcon.Rewind />
                      </button>
                      <button
                        onClick={handlePlayToggle}
                        className="w-12 h-10 border-2 border-[#111e14] flex items-center justify-center bg-[#111e14] text-[#edfeed] shadow-[1px_1px_0px_#111e14] active:translate-y-[1px] active:shadow-none"
                      >
                        {isPlaying ? <PixelIcon.Pause /> : <PixelIcon.Play />}
                      </button>
                      <button
                        onClick={handleEject}
                        className="w-10 h-9 border-2 border-[#111e14] flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] shadow-[1px_1px_0px_#111e14]"
                      >
                        <PixelIcon.Close />
                      </button>
                      <button
                        onClick={handleVolumeTap}
                        className="w-10 h-9 border-2 border-[#111e14] flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] shadow-[1px_1px_0px_#111e14]"
                      >
                        <PixelIcon.Volume />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="qr-scan"
                    initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    onClick={onScanClick}
                    className="border-2 border-dashed border-[#111e14] p-4 flex flex-col justify-center items-center cursor-pointer hover:bg-[#111e14]/5 active:bg-[#111e14]/10 gap-2 transition-colors"
                  >
                    <PixelIcon.Camera />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">ESCANEAR CÓDIGO</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ─── FILTER TABS ─── */}
            <div className="flex border-2 border-[#111e14] shrink-0 mb-2 overflow-hidden shadow-[1px_1px_0px_#111e14] bg-[#edfeed]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#111e14] text-[#edfeed]'
                      : 'bg-[#edfeed] text-[#111e14] hover:bg-[#111e14]/5'
                  }`}
                >
                  <div className="scale-75">{tab.icon}</div>
                  <span className="text-[8px] font-black uppercase tracking-tighter">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ─── UNIFIED INTEL LIST ─── */}
            <div className="flex-grow overflow-y-auto min-h-0 px-0.5 custom-nokia-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {activeTab === 'SMS' ? (
                <div className="flex flex-col flex-grow min-h-0 h-full">
                  {!activeCharacter?.phoneNumber ? (
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-[#111e14] bg-[#edfeed] gap-3 text-center my-2 shadow-[1px_1px_0px_#111e14]">
                      <div className="scale-125"><PixelIcon.SMS /></div>
                      <span className="font-black text-[10px] uppercase">REGISTRO DE NÚMERO</span>
                      <p className="text-[9px] opacity-80 leading-normal font-bold">
                        VOCÊ PRECISA DE UM NÚMERO DE TELEFONE US PARA ENVIAR MENSAGENS NO GRUPO.
                      </p>
                      <button
                        onClick={() => {
                          const num = generateRandomUSPhoneNumber();
                          onUpdatePhoneNumber?.(num);
                        }}
                        className="w-full py-2 border-2 border-[#111e14] bg-[#111e14] text-[#edfeed] font-black uppercase active:bg-[#edfeed] active:text-[#111e14] text-[10px] tracking-wider"
                      >
                        [GERAR NÚMERO]
                      </button>
                    </div>
                  ) : userGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40 gap-2">
                      <PixelIcon.SMS />
                      <span className="font-black text-[9px] uppercase">NENHUM GRUPO ATIVO</span>
                      <p className="text-[8px]">VOCÊ NÃO PERTENCE A NENHUM GRUPO DE AGENTES.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-grow min-h-0 h-full">
                      {/* Active Group info & selector if multiple */}
                      <div className="flex justify-between items-center bg-[#111e14]/5 border-b border-[#111e14]/20 p-1.5 text-[9px] font-black shrink-0 mb-1.5">
                        <div className="flex items-center gap-1">
                          <span className="opacity-60">DE:</span>
                          <span className="font-mono">{activeCharacter.phoneNumber}</span>
                        </div>
                        {userGroups.length > 1 ? (
                          <select
                            value={activeGroupId || ''}
                            onChange={(e) => {
                              sfx.playBeep();
                              setActiveGroupId(e.target.value);
                            }}
                            className="bg-[#edfeed] border border-[#111e14] text-[8px] p-0.5 font-bold uppercase focus:outline-none"
                          >
                            {userGroups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="truncate max-w-[120px] uppercase font-bold">{userGroups[0].name}</span>
                        )}
                      </div>

                      {/* Messages Container */}
                      <div className="flex-grow overflow-y-auto min-h-0 px-0.5 space-y-1.5 custom-nokia-scrollbar">
                        {groupMessages.map((msg) => {
                          const isMe = msg.senderId === activeCharacter.id;
                          const dateStr = msg.createdAt?.toDate 
                            ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Agora';
                          return (
                            <div
                              key={msg.id}
                              className={`text-[11px] p-2 border-2 border-[#111e14] flex flex-col gap-0.5 shadow-[1px_1px_0px_#111e14] ${
                                isMe 
                                  ? 'bg-[#111e14] text-[#edfeed] ml-6' 
                                  : 'bg-[#edfeed] mr-6'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[8px] font-black opacity-70">
                                <span>{isMe ? 'VOCÊ' : `${msg.senderName} (${msg.senderNumber})`}</span>
                                <span>{dateStr}</span>
                              </div>
                              <div className="leading-tight font-bold break-words whitespace-pre-wrap">
                                {msg.text}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                        {groupMessages.length === 0 && (
                          <div className="py-8 text-center opacity-30 text-[9px] font-black">
                            SEM MENSAGENS NO GRUPO
                          </div>
                        )}
                      </div>

                      {/* Composer input */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="flex gap-1.5 mt-2 pt-1 border-t border-[#111e14]/25 shrink-0"
                      >
                        <input
                          type="text"
                          value={newMessageText}
                          onChange={(e) => setNewMessageText(e.target.value)}
                          placeholder="MENSAGEM..."
                          className="flex-1 bg-[#edfeed] border-2 border-[#111e14] px-1.5 py-1 text-[10px] text-[#111e14] placeholder:text-[#111e14]/50 focus:outline-none font-bold uppercase"
                        />
                        <button
                          type="submit"
                          disabled={!newMessageText.trim()}
                          className="border-2 border-[#111e14] bg-[#111e14] text-[#edfeed] font-black px-3 py-1 text-[10px] active:bg-[#edfeed] active:text-[#111e14] disabled:opacity-40"
                        >
                          [ENVIAR]
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30">
                  <div className="mb-2 scale-150"><PixelIcon.Doc /></div>
                  <div className="text-[11px] font-black uppercase">
                    VAZIO
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sortedItems.map((item, idx) => {
                    if (item.__divider) {
                      return (
                        <div key={`div-${idx}`} className="flex items-center gap-2 py-2 px-1">
                          <div className="flex-1 border-t-2 border-[#111e14]/20 border-dotted" />
                          <span className="text-[9px] font-black opacity-50 uppercase tracking-[0.2em] shrink-0">{item.label}</span>
                          <div className="flex-1 border-t-2 border-[#111e14]/20 border-dotted" />
                        </div>
                      );
                    }

                    const isAudio = item.type === 'AUDIO';
                    const isCurrent = item.id === currentIntelId;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemTap(item)}
                        className={`text-[12px] py-2 px-3 cursor-pointer flex items-center gap-3 font-bold transition-all border-2 shadow-[1px_1px_0px_#111e14] active:translate-y-[1px] active:shadow-none ${
                          isCurrent
                            ? 'bg-[#111e14] text-[#edfeed] border-[#111e14]'
                            : 'bg-[#edfeed] text-[#111e14] border-[#111e14] hover:bg-[#111e14]/5'
                        }`}
                      >
                        <div className="shrink-0 scale-90">
                          {isAudio ? <PixelIcon.Audio /> : <PixelIcon.Doc />}
                        </div>
                        <span className="truncate uppercase tracking-tight">{item.title}</span>
                        {isCurrent && (
                          <div className="ml-auto shrink-0 flex items-center gap-1">
                            {isPlaying ? (
                              <div className="flex gap-[1px]">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className={`w-1 h-3 bg-current animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px]">&gt;&gt;</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
