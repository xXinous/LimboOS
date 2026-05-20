import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Music, FileText, Settings, User, LogOut, RefreshCw, Volume2 } from 'lucide-react';
import { IntelBase, AudioIntel, VisualIntel, TextIntel, MetaIntel } from '../../services/IntelEngine';
import { audioEngine } from '../../services/AudioEngine';
import type { WalkmanStatus } from '../../types/player';

// Lazy loaded scanner to keep bundle optimized
const QrScanner = React.lazy(() => import('../QrScanner'));

interface NokiaPlayerProps {
  currentIntel: IntelBase | null;
  status: WalkmanStatus;
  isPlaying: boolean;
  volume: number;
  setVolume: (v: number) => void;
  intelItems: IntelBase[];
  currentIntelId: string | null;
  onIntelSelect: (intel: IntelBase) => void;
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
}

type ScreenView = 'home' | 'menu' | 'audios' | 'arquivos' | 'playback' | 'volume';

export default function NokiaPlayer({
  currentIntel,
  status,
  isPlaying,
  volume,
  setVolume,
  intelItems,
  currentIntelId,
  onIntelSelect,
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
}: NokiaPlayerProps) {
  const [currentView, setCurrentView] = useState<ScreenView>('home');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00');
  const [durationTimeStr, setDurationTimeStr] = useState('00:00');
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const [systemTime, setSystemTime] = useState('12:00');

  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter items
  const audioItems = intelItems.filter((item) => item.type === 'AUDIO');
  const fileItems = intelItems.filter((item) => item.type !== 'AUDIO');

  // Sound generator
  const playDTMF = useCallback((digit: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const frequencies: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
        'navi': [980, 0],
        'green': [1150, 0],
        'red': [750, 0],
        'scroll': [880, 0]
      };
      
      const freq = frequencies[digit];
      if (!freq) return;
      
      const duration = 0.07;
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      gainNode.connect(audioCtx.destination);
      
      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq[0], audioCtx.currentTime);
      osc1.connect(gainNode);
      osc1.start();
      osc1.stop(audioCtx.currentTime + duration);
      
      if (freq[1] > 0) {
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq[1], audioCtx.currentTime);
        osc2.connect(gainNode);
        osc2.start();
        osc2.stop(audioCtx.currentTime + duration);
      }
    } catch (e) {
      // Ignore Context error if browser blocks it
    }
  }, []);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setSystemTime(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Track Audio Progress
  useEffect(() => {
    if (isPlaying) {
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
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying]);

  // Adjust view when audio changes state globally (e.g. ejected)
  useEffect(() => {
    if (currentIntel && (status === 'LOADED' || status === 'PLAYING' || status === 'REWINDING')) {
      if (currentView !== 'playback') {
        setCurrentView('playback');
      }
    } else if (!currentIntel && currentView === 'playback') {
      setCurrentView('menu');
      setSelectedIndex(0);
    }
  }, [currentIntel, status]);

  // Menu items list
  const menuItems = [
    { label: '1. PROVAS (AUDIOS)', icon: <Music size={12} />, action: () => { setCurrentView('audios'); setSelectedIndex(0); } },
    { label: '2. PISTAS E DOCS', icon: <FileText size={12} />, action: () => { setCurrentView('arquivos'); setSelectedIndex(0); } },
    { label: '3. ESCANEAR QR', icon: <Camera size={12} />, action: () => { onScanClick(); } },
    ...(hasTerminalAccess && onTerminalOpen ? [{ label: '4. TERMINAL MH-DOS', icon: <Settings size={12} />, action: () => onTerminalOpen() }] : []),
    ...(hasMacAccess && onMacOpen ? [{ label: '5. MAC OS SYSTEM', icon: <Settings size={12} />, action: () => onMacOpen() }] : []),
    { label: '6. DOSSIE AGENTE', icon: <User size={12} />, action: () => onProfileOpen() },
    ...(onCharacterSwitch ? [{ label: '7. TROCAR AGENTE', icon: <RefreshCw size={12} />, action: () => onCharacterSwitch() }] : []),
  ];

  // Handle Scroll Navigation (Up/Down)
  const handleScroll = (direction: 'up' | 'down') => {
    playDTMF('scroll');

    let maxIndex = 0;
    if (currentView === 'menu') maxIndex = menuItems.length - 1;
    else if (currentView === 'audios') maxIndex = audioItems.length - 1;
    else if (currentView === 'arquivos') maxIndex = fileItems.length - 1;
    else if (currentView === 'playback') {
      // Adjust volume in playback view
      adjustVolume(direction === 'up' ? 5 : -5);
      return;
    }

    if (maxIndex <= 0) return;

    if (direction === 'up') {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else {
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }
  };

  // Adjust volume
  const adjustVolume = (delta: number) => {
    const nextVolume = Math.max(0, Math.min(100, volume + delta));
    setVolume(nextVolume);
    setShowVolumeBar(true);

    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeBar(false);
    }, 1500);
  };

  // Handle Select Action (Navi-OK Button / Left Softkey)
  const handleSelect = () => {
    playDTMF('navi');

    if (status === 'SCANNING') return;

    if (currentView === 'home') {
      setCurrentView('menu');
      setSelectedIndex(0);
    } else if (currentView === 'menu') {
      menuItems[selectedIndex]?.action();
    } else if (currentView === 'audios') {
      if (audioItems[selectedIndex]) {
        onIntelSelect(audioItems[selectedIndex]);
        setCurrentView('playback');
      }
    } else if (currentView === 'arquivos') {
      if (fileItems[selectedIndex]) {
        onIntelSelect(fileItems[selectedIndex]);
      }
    } else if (currentView === 'playback') {
      // Toggle play state
      if (currentIntel) {
        audioEngine.setVolume(volume);
        if (isPlaying) {
          audioEngine.pause();
        } else {
          audioEngine.play().catch(() => {});
        }
      }
    }
  };

  // Handle Back/Exit Action (Red Button / Right Softkey)
  const handleBack = () => {
    playDTMF('red');

    if (status === 'SCANNING') {
      onCancelScan();
      return;
    }

    if (currentView === 'playback') {
      if (currentIntel && isPlaying) {
        // Keep playing in background, just return to menu
        setCurrentView('menu');
        setSelectedIndex(0);
      } else {
        onEject();
        setCurrentView('menu');
        setSelectedIndex(0);
      }
    } else if (currentView === 'audios' || currentView === 'arquivos') {
      setCurrentView('menu');
      setSelectedIndex(0);
    } else if (currentView === 'menu') {
      setCurrentView('home');
    }
  };

  // Trigger quick scan or play sound on keypad numbers
  const handleNumberClick = (digit: string) => {
    playDTMF(digit);

    // Number shortcuts in main menu
    if (currentView === 'menu') {
      const idx = parseInt(digit, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < menuItems.length) {
        setSelectedIndex(idx);
        setTimeout(() => {
          menuItems[idx]?.action();
        }, 120);
      }
    } else if (currentView === 'playback') {
      // Key '4' rewinds tape in playback screen
      if (digit === '4' && currentIntel) {
        // Simulate rewind
        audioEngine.stop();
        setTimeout(() => {
          audioEngine.play().catch(() => {});
        }, 1000);
      }
    }
  };

  const isScanning = status === 'SCANNING';
  const displayIntel = currentIntel;

  return (
    <div className="relative w-full max-w-sm mx-auto h-[690px] flex flex-col items-center justify-start bg-transparent p-4 z-10 select-none">
      {/* LCD custom font style injection */}
      <style>{`
        .nokia-lcd-text {
          font-family: 'Space Mono', 'JetBrains Mono', monospace;
          image-rendering: pixelated;
          font-smooth: never;
          -webkit-font-smoothing: none;
        }
        .nokia-lcd-title {
          font-family: 'Space Mono', monospace;
          font-weight: bold;
        }
        .nokia-lcd-body {
          font-family: 'JetBrains Mono', monospace;
        }
        .nokia-lcd-aux {
          font-family: 'Courier Prime', monospace;
        }
        .nokia-key-active:active {
          transform: translateY(2px);
          box-shadow: inset 1px 1px 3px rgba(0,0,0,0.6), 0px 1px 1px rgba(255,255,255,0.1);
        }
        .nokia-keypad-glow {
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
        }
      `}</style>

      {/* Nokia 2280 Azul Body Casing */}
      <div className="relative w-[290px] h-[650px] bg-linear-to-b from-[#183a66] via-[#102a4d] to-[#071933] rounded-[50px] border-4 border-[#0a1524] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center p-3 relative overflow-hidden">
        
        {/* Top Speaker Slits */}
        <div className="flex flex-col gap-1 items-center mt-3 mb-1">
          <div className="w-1.5 h-4 bg-[#0a1524] rounded-full opacity-80" />
          <div className="w-1.5 h-4 bg-[#0a1524] rounded-full opacity-80" />
          <div className="w-1.5 h-4 bg-[#0a1524] rounded-full opacity-80" />
        </div>

        {/* Outer Silver Bezel around Screen */}
        <div className="w-[266px] bg-linear-to-b from-[#bccad6] to-[#8d9db6] rounded-t-3xl rounded-b-xl p-1.5 shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),_0_4px_10px_rgba(0,0,0,0.4)] flex flex-col items-center">
          
          {/* Nokia Logo */}
          <div className="text-[10px] font-black text-[#1e2d42] tracking-[0.2em] mb-1 uppercase font-sans select-none">
            NOKIA
          </div>

          {/* Monochrome LCD Screen Display */}
          <div className="w-[250px] h-[175px] bg-[#edfeed] border-4 border-[#333] shadow-[inset_0_3px_8px_rgba(0,0,0,0.5)] flex flex-col justify-between p-1.5 relative overflow-hidden text-[#161717] nokia-lcd-text select-none rounded-xs">
            {/* Screen backing grid pattern and scanline simulation */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,#161717_1px,transparent_0)] bg-[size:3px_3px] z-10" />
            <div className="absolute inset-0 pointer-events-none bg-linear-to-b from-transparent via-[#161717]/[0.02] to-transparent bg-[size:100%_4px] z-10" />

            {isScanning ? (
              // integrated QR camera scanner screen
              <div className="w-full h-full flex flex-col justify-between bg-black relative rounded-none overflow-hidden border border-[#161717]">
                <div className="absolute top-1 left-2 z-20 text-[#edfeed] font-black text-[9px] uppercase tracking-widest bg-[#161717] px-1 animate-pulse">
                  SCANNER ATIVO
                </div>
                <div className="flex-1 w-full h-full bg-[#222] relative flex items-center justify-center">
                  <React.Suspense fallback={<div className="text-[#edfeed] text-[10px] animate-pulse">INICIANDO CÂMERA...</div>}>
                    <QrScanner onDetected={onQrDetected} onCancel={onCancelScan} />
                  </React.Suspense>
                  {/* Digital Sight Outline overlay */}
                  <div className="absolute w-24 h-24 border border-dashed border-[#edfeed]/40 pointer-events-none flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#edfeed] rounded-full" />
                  </div>
                </div>
                <div className="h-6 bg-[#edfeed] text-[#161717] border-t border-[#161717] px-2 flex items-center justify-between text-[9px] font-bold">
                  <span>[MIRA QR CODE]</span>
                  <span className="animate-pulse">●</span>
                </div>
              </div>
            ) : showVolumeBar ? (
              // volume control indicator screen overlay
              <div className="w-full h-full flex flex-col justify-between py-4 px-2 select-none">
                <div className="text-[12px] font-black uppercase text-center flex items-center justify-center gap-1">
                  <Volume2 size={12} /> VOLUME
                </div>
                <div className="w-full border-2 border-[#161717] p-1 flex gap-1 h-8 items-center bg-[#edfeed]">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 border border-[#161717] ${
                        volume >= (i + 1) * 10 ? 'bg-[#161717]' : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[10px] font-bold text-center uppercase tracking-widest">
                  NÍVEL: {volume}%
                </div>
              </div>
            ) : (
              // Standard Nokia LCD menu workflow
              <>
                {/* 1. Status Bar */}
                <div className="h-5 border-b border-[#161717] flex justify-between items-center text-[9px] font-bold select-none px-0.5">
                  {/* Left Side: HP Signal Strength */}
                  <div className="flex items-end gap-0.5 h-3">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-0.5 border-t border-x border-[#161717] ${
                          level <= 4 ? 'bg-[#161717]' : 'bg-transparent'
                        }`}
                        style={{ height: `${level * 2}px` }}
                      />
                    ))}
                    <span className="text-[7px] font-black uppercase ml-0.5 leading-none">HP</span>
                  </div>
                  
                  {/* Center: System Clock / Header */}
                  <div className="nokia-lcd-title text-[10px] tracking-wide font-black">
                    {currentView === 'home' ? 'RUNNING MAN' : currentView.toUpperCase()}
                  </div>

                  {/* Right Side: Stamina / Mana Battery Indicator */}
                  <div className="flex items-center gap-0.5 h-3 select-none">
                    <span className="text-[7px] font-black uppercase mr-0.5 leading-none">MP</span>
                    <div className="w-5 h-2.5 border border-[#161717] p-0.5 flex gap-0.5 items-center relative">
                      <div className="h-full w-1 bg-[#161717]" />
                      <div className="h-full w-1 bg-[#161717]" />
                      <div className="h-full w-1 bg-[#161717]" />
                      <div className="absolute -right-[2px] top-[2px] w-[2px] h-[4px] bg-[#161717]" />
                    </div>
                  </div>
                </div>

                {/* 2. Main Body Content Display */}
                <div className="flex-1 overflow-y-auto py-1 text-[11px] leading-relaxed relative flex flex-col justify-start select-none">
                  {currentView === 'home' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-1">
                      {displayIntel ? (
                        <>
                          <Music size={20} className="mb-1 animate-pulse" />
                          <div className="text-[12px] font-black uppercase tracking-tight truncate w-full max-w-[200px]">
                            {displayIntel.title}
                          </div>
                          <div className="text-[9px] font-bold opacity-80 uppercase mt-0.5">
                            {status === 'PLAYING' ? 'REPRODUZINDO...' : 'PAUSADO'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl mb-1 select-none animate-bounce">📱</div>
                          <div className="text-[12px] font-black tracking-widest uppercase">
                            NOKIA 2280
                          </div>
                          <div className="text-[9px] font-bold opacity-85 uppercase mt-0.5 tracking-wider">
                            APERTE MENU PARA INICIAR
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {currentView === 'menu' && (
                    <div className="flex flex-col select-none">
                      {menuItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={`px-1.5 py-0.5 flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-tight ${
                            selectedIndex === idx
                              ? 'bg-[#161717] text-[#edfeed]'
                              : ''
                          }`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentView === 'audios' && (
                    <div className="flex flex-col select-none">
                      {audioItems.length === 0 ? (
                        <div className="text-center py-4 font-bold text-[9px] uppercase opacity-70">
                          Nenhum áudio desbloqueado
                        </div>
                      ) : (
                        audioItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`px-1.5 py-0.5 truncate uppercase font-bold text-[10px] tracking-tight ${
                              selectedIndex === idx
                                ? 'bg-[#161717] text-[#edfeed]'
                                : ''
                            }`}
                          >
                            📼 {item.title}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {currentView === 'arquivos' && (
                    <div className="flex flex-col select-none">
                      {fileItems.length === 0 ? (
                        <div className="text-center py-4 font-bold text-[9px] uppercase opacity-70">
                          Nenhum arquivo de prova
                        </div>
                      ) : (
                        fileItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`px-1.5 py-0.5 truncate uppercase font-bold text-[10px] tracking-tight ${
                              selectedIndex === idx
                                ? 'bg-[#161717] text-[#edfeed]'
                                : ''
                            }`}
                          >
                            [{item.type}] {item.title}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {currentView === 'playback' && displayIntel && (
                    <div className="flex-1 flex flex-col justify-between py-0.5 select-none">
                      {/* Pixel Art Cassette Tape spinning */}
                      <div className="flex items-center justify-between px-2 py-1 bg-[#161717]/5 border border-[#161717]/20 rounded-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-[12px] font-black uppercase truncate tracking-tight">
                            {displayIntel.title}
                          </div>
                          <div className="text-[9px] font-bold opacity-75 uppercase truncate">
                            {displayIntel instanceof AudioIntel ? displayIntel.metadata.artist : displayIntel.metadata?.npc}
                          </div>
                        </div>
                        {/* Cassette Graphic with animated reels */}
                        <div className="w-14 h-8 bg-[#161717] rounded-xs border border-[#161717] relative flex items-center justify-between px-2 shrink-0">
                          {[true, false].map((_, ri) => (
                            <div
                              key={ri}
                              className="w-3.5 h-3.5 rounded-full bg-[#edfeed] flex items-center justify-center relative overflow-hidden"
                            >
                              <div
                                className={`w-full h-0.5 bg-[#161717] absolute ${
                                  isPlaying ? 'animate-spin' : ''
                                }`}
                                style={{ animationDuration: '3s' }}
                              />
                              <div
                                className={`w-0.5 h-full bg-[#161717] absolute ${
                                  isPlaying ? 'animate-spin' : ''
                                }`}
                                style={{ animationDuration: '3s' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Timeline/Progress block bars */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[8px] font-black px-0.5 select-none">
                          <span>{currentTimeStr}</span>
                          <span className="uppercase text-[7px] tracking-widest text-[#161717]/60">
                            {status === 'REWINDING' ? '⏪ REWIND...' : (isPlaying ? '▶ REPRODUZINDO' : '⏸ PAUSADO')}
                          </span>
                          <span>{durationTimeStr}</span>
                        </div>
                        <div className="w-full border border-[#161717] h-3 p-[1px] flex gap-[1px] items-center bg-[#edfeed]">
                          {Array.from({ length: 15 }).map((_, i) => {
                            const pct = (i + 1) / 15;
                            const isFilled = audioDuration > 0 && (audioProgress / audioDuration) >= pct;
                            return (
                              <div
                                key={i}
                                className={`h-full flex-1 ${
                                  isFilled ? 'bg-[#161717]' : 'bg-transparent'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Softkeys Label Divider */}
                <div className="h-5 border-t border-[#161717] flex justify-between items-end text-[9px] font-black select-none pt-0.5">
                  {/* Left Label */}
                  <div className="nokia-lcd-title tracking-wider uppercase pl-0.5">
                    {currentView === 'home' ? 'MENU' : 'SELECIONAR'}
                  </div>
                  {/* Right Label */}
                  <div className="nokia-lcd-title tracking-wider uppercase pr-0.5">
                    {currentView === 'home' ? 'SAIR' : 'VOLTAR'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Nokia 2280 Control Pad Panel (Teclas Send/End, Botão Navi e Scroll) */}
        <div className="w-[266px] flex flex-col items-center mt-3 bg-linear-to-b from-[#bccad6] to-[#8d9db6] rounded-xl p-2 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_0_2px_6px_rgba(0,0,0,0.3)]">
          
          {/* 1. Large Wide Navi/Menu Button */}
          <button
            onClick={handleSelect}
            className="nokia-key-active w-[160px] h-[34px] bg-linear-to-b from-[#e3e9f0] to-[#b0c0d0] border border-[#7a8a9a] rounded-full shadow-[0_3px_5px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.6)] flex items-center justify-center cursor-pointer mb-2"
            title="Botão Selecionar / Menu Principal"
          >
            <div className="w-[60px] h-1.5 bg-[#4c5c70] rounded-full shadow-inner opacity-75" />
          </button>

          {/* 2. Send (Left Call) & End (Right End Call) Buttons Row */}
          <div className="w-full flex justify-between items-center px-4 mb-2">
            {/* Green Call Button */}
            <button
              onClick={() => { playDTMF('green'); onProfileOpen(); }}
              className="nokia-key-active w-[54px] h-[28px] bg-linear-to-b from-[#e3e9f0] to-[#b0c0d0] border border-[#7a8a9a] rounded-tl-full rounded-br-2xl shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center cursor-pointer"
              title="Dossiê do Agente (Chamada)"
            >
              <div className="w-2.5 h-2.5 border-2 border-emerald-600 rounded-full flex items-center justify-center transform -rotate-45 relative">
                <div className="w-1.5 h-0.5 bg-emerald-600 absolute bottom-[-1px] left-0.5" />
              </div>
            </button>

            {/* Red End Call Button */}
            <button
              onClick={handleBack}
              className="nokia-key-active w-[54px] h-[28px] bg-linear-to-b from-[#e3e9f0] to-[#b0c0d0] border border-[#7a8a9a] rounded-tr-full rounded-bl-2xl shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center cursor-pointer"
              title="Voltar / Ejetar / Cancelar"
            >
              <div className="w-3.5 h-1.5 bg-red-600 rounded-xs shadow-sm transform rotate-12" />
            </button>
          </div>

          {/* 3. Gray Scroll Navigation Key (Rocker Button) */}
          <div className="w-24 bg-[#5c6c80] rounded-xl p-[2px] shadow-inner flex flex-col items-center">
            {/* Scroll Up */}
            <button
              onClick={() => handleScroll('up')}
              className="nokia-key-active w-full h-[22px] bg-linear-to-b from-[#a3b3c6] to-[#7c8da3] rounded-t-lg flex items-center justify-center text-white/80 cursor-pointer border-b border-[#4d5d71]"
              title="Rolar para Cima / Aumentar Volume"
            >
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white/80" />
            </button>
            {/* Scroll Down */}
            <button
              onClick={() => handleScroll('down')}
              className="nokia-key-active w-full h-[22px] bg-linear-to-b from-[#8c9db3] to-[#65768c] rounded-b-lg flex items-center justify-center text-white/80 cursor-pointer"
              title="Rolar para Baixo / Diminuir Volume"
            >
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white/80" />
            </button>
          </div>

        </div>

        {/* Nokia 2280 Oval Numeric Keypad Panel */}
        <div className="w-[266px] grid grid-cols-3 gap-x-2 gap-y-3.5 px-4 py-4 mt-2">
          {[
            { num: '1', txt: 'oo' },
            { num: '2', txt: 'abc' },
            { num: '3', txt: 'def' },
            { num: '4', txt: 'ghi' },
            { num: '5', txt: 'jkl' },
            { num: '6', txt: 'mno' },
            { num: '7', txt: 'pqrs' },
            { num: '8', txt: 'tuv' },
            { num: '9', txt: 'wxyz' },
            { num: '*', txt: '+' },
            { num: '0', txt: '⊔' },
            { num: '#', txt: '⇧' }
          ].map((key) => (
            <button
              key={key.num}
              onClick={() => handleNumberClick(key.num)}
              className="nokia-key-active h-[38px] bg-linear-to-b from-white to-[#e6e8eb] border border-[#a1a8b0] rounded-full shadow-[0_3px_5px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.8)] flex flex-col items-center justify-center cursor-pointer select-none active:scale-95 transition-transform"
            >
              <span className="text-[14px] font-black text-[#1e2d42] leading-none">
                {key.num}
              </span>
              <span className="text-[7px] font-bold text-[#6a7582] leading-none uppercase mt-0.5 tracking-wide">
                {key.txt}
              </span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
