import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSwipeable } from 'react-swipeable';
import LoginScreen from './components/LoginScreen';
import ProfileScreen from './components/ProfileScreen';
import ToastNotification from './components/ToastNotification';
import type { Toast } from './components/ToastNotification';
import CassetteVisor from './components/player/CassetteVisor';
import TapeLibrary from './components/player/TapeLibrary';
import SideControls from './components/player/SideControls';
import BottomControls from './components/player/BottomControls';
import Screw from './components/player/Screw';
import BiosTerminal from './components/BiosTerminal';
import LimboBoard from './components/LimboBoard';
import DiskRepairApp from './components/DiskRepairApp';
import MacOsApp from './components/MacOsApp';
import Windows95App from './components/Windows95App';
import EvidenceReader from './components/EvidenceReader';
import { audioEngine } from './services/AudioEngine';
import { analyticsTracker } from './services/AnalyticsTracker';
import { activityLogger } from './services/ActivityLogger';
import { tapeManager } from './services/TapeManager';
import { playerSyncService } from './services/PlayerSyncService';
import { onAuthStateChanged, logout } from './store/profile';
import type { PlayerData, PlayerStats, LimboGlobalState, GalleryImage } from './store/firestore';
import { loadPlayerData, firestoreUpdateSpotifyPlaylist, fetchPlayerGalleryImages } from './store/firestore';
import type { Tape } from './data/tapes';
import type { AppScreen, WalkmanStatus, DisplayMode } from './types/player';

export default function Player() {
  const [playerData, setPlayerData] = useState<PlayerData | null | undefined>(null);
  const [localStats, setLocalStats] = useState<PlayerStats | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');
  
  // State Machine: Centralized status
  const [walkmanStatus, setWalkmanStatus] = useState<WalkmanStatus>('IDLE');
  
  const [currentTape, setCurrentTape] = useState<Tape | null>(null);
  const [volume, setVolume] = useState(80);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scanTimes, setScanTimes] = useState<number[]>([]);
  const [ownedTapes, setOwnedTapes] = useState<Tape[]>([]);
  const [limboStatus, setLimboStatus] = useState<LimboGlobalState>({ seized: false });
  const [activeEvidence, setActiveEvidence] = useState<Tape | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  
  const hasPlayedCurrentTape = useRef(false);
  
  // Derived states for compatibility with child components
  const isPlaying = walkmanStatus === 'PLAYING';
  const isRewinding = walkmanStatus === 'REWINDING';
  const isChangingTape = walkmanStatus === 'LOADING';
  const tapeState = walkmanStatus === 'SCANNING' ? 'scanning' : (currentTape ? 'loaded' : 'empty');

  // --- Auth & Sync ---
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      try {
        if (user) {
          if (user.email === 'gm.mpg@runningman.local') {
            window.location.href = '/admin';
            return;
          }
          const data = await loadPlayerData(user.uid);
          setPlayerData(data);
          setLocalStats(data.stats);
          setScreen('player');
          activityLogger.logAuth(data.uid, data.username, 'login', `${data.username} entrou no sistema`);
        } else {
          setPlayerData(undefined);
          setLocalStats(null);
          setScreen('login');
        }
      } catch (err) {
        console.warn('[Auth] Error:', err);
        setPlayerData(undefined);
        setScreen('login');
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (playerData && localStats) {
      analyticsTracker.init(playerData, localStats, 
        (stats, data) => { setLocalStats(stats); setPlayerData(data); },
        (toast) => addToast(toast)
      );
    }
    return () => analyticsTracker.stopAll();
  }, [playerData?.uid]);

  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    playerSyncService.subscribeToPlayerData(playerData?.uid,
      (updatedData) => {
        setPlayerData((prev) => {
          if (!prev) return prev;
          const merged = { ...prev, ...updatedData };
          analyticsTracker.updatePlayerData(merged);
          return merged;
        });
      },
      setScreen,
      setLimboStatus
    );
    return () => playerSyncService.stopAll();
  }, [playerData?.uid]);

  useEffect(() => {
    if (playerData) {
      tapeManager.getOwnedTapes(playerData.unlockedTapeIds).then(setOwnedTapes).catch(console.error);
    } else {
      setOwnedTapes([]);
    }
  }, [playerData?.unlockedTapeIds]);

  useEffect(() => {
    if (playerData?.unlockedGalleryIds?.length) {
      fetchPlayerGalleryImages(playerData.uid).then(setGalleryImages).catch(console.error);
    } else {
      setGalleryImages([]);
    }
  }, [playerData?.unlockedGalleryIds]);

  const allTapesWithPistas = useMemo(() => {
    const pistaTapes: Tape[] = galleryImages
      .filter(img => img.category === 'pistas')
      .map(img => ({
        id: `gallery-pista-${img.id}`,
        title: img.title,
        artist: 'Pista',
        npc: 'Pista',
        chapter: 'Pistas',
        description: img.description,
        audioUrl: '',
        duration: 0,
        type: 'gallery-pista' as const,
        imageUrl: img.imageUrl,
      }));
    return [...ownedTapes, ...pistaTapes];
  }, [ownedTapes, galleryImages]);

  // --- Audio Engine Interactions ---
  useEffect(() => {
    audioEngine.setOnEnded(() => {
      setWalkmanStatus('LOADED');
      analyticsTracker.endPlayback();
    });
  }, []);

  useEffect(() => {
    if (currentTape) {
      audioEngine.loadTrack(currentTape.audioUrl);
      analyticsTracker.pausePlayback();
    } else {
      audioEngine.clearTrack();
      analyticsTracker.stopAll();
    }
    return () => audioEngine.clearTrack();
  }, [currentTape?.id]);

  useEffect(() => {
    if (walkmanStatus === 'PLAYING') {
      hasPlayedCurrentTape.current = true;
      audioEngine.play();
      if (currentTape) analyticsTracker.startPlayback(currentTape);
    } else if (walkmanStatus === 'REWINDING') {
      audioEngine.stop();
      analyticsTracker.pausePlayback();
    } else {
      audioEngine.pause();
      analyticsTracker.pausePlayback();
    }
  }, [walkmanStatus, currentTape?.id]);

  // --- Handlers ---
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleQrDetected = useCallback(async (code: string) => {
    if (!playerData || !localStats) {
      addToast({ type: 'error', title: 'Aguarde', subtitle: 'Perfil carregando...', icon: '⏳' });
      return;
    }
    setWalkmanStatus('IDLE');
    activityLogger.logAction(playerData.uid, playerData.username, 'qr_scan', `QR: ${code}`, { code });
    
    try {
      const tape = await tapeManager.resolveTape(code);
      if (!tape) {
        addToast({ type: 'error', title: 'Código Desconhecido', subtitle: code, icon: '❌' });
        return;
      }
      const { alreadyOwned, updatedTapeIds } = await tapeManager.unlockTape(playerData, tape.id);
      const now = Date.now();
      const recentScans = [...scanTimes.filter(t => now - t < 300000), now];
      setScanTimes(recentScans);
      analyticsTracker.checkAchievements(recentScans);
      setPlayerData({ ...playerData, unlockedTapeIds: updatedTapeIds });
      
      hasPlayedCurrentTape.current = false;
      setWalkmanStatus('LOADING');
      
      setTimeout(() => {
        setCurrentTape(tape);
        setWalkmanStatus('LOADED');
        addToast({ type: 'tape', title: alreadyOwned ? 'Fita Inserida' : 'Fita Desbloqueada!', subtitle: tape.title, icon: '📼' });
      }, 400);
      
      activityLogger.logAction(playerData.uid, playerData.username, alreadyOwned ? 'tape_insert' : 'tape_unlock', `${alreadyOwned ? 'Inseriu' : 'Desbloqueou'}: ${tape.title}`, { tapeId: tape.id });
    } catch (err) {
      addToast({ type: 'error', title: 'Erro QR', subtitle: 'Tente dnv', icon: '⚠️' });
    }
  }, [playerData, localStats, scanTimes, addToast]);

  const handlePlayPause = (play: boolean) => {
    if (!currentTape) return;
    setWalkmanStatus(play ? 'PLAYING' : 'LOADED');
  };

  const handleRewind = () => {
    if (!currentTape || walkmanStatus === 'REWINDING') return;
    setWalkmanStatus('REWINDING');
    setTimeout(() => setWalkmanStatus('LOADED'), 1500);
  };

  const handleEject = () => { 
    if (!hasPlayedCurrentTape.current && currentTape) analyticsTracker.incrementStat('ejectWithoutPlay');
    if (playerData && currentTape) activityLogger.logAction(playerData.uid, playerData.username, 'tape_eject', `Ejetou: ${currentTape.title}`, { tapeId: currentTape.id });
    
    setWalkmanStatus('IDLE');
    setCurrentTape(null); 
    analyticsTracker.forceSyncToServer();
  };

  const handleTapeSelect = (tape: Tape) => {
    if (tape.type === 'gallery-pista') {
      const pistaImg = galleryImages.find(img => `gallery-pista-${img.id}` === tape.id);
      if (pistaImg) {
        setActiveEvidence({ ...tape, content: pistaImg.description, imageUrl: pistaImg.imageUrl });
        if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'pista_open', `Abriu pista: ${tape.title}`, { tapeId: tape.id });
      }
      return;
    }
    if (tape.type === 'disk') {
      setActiveEvidence(tape);
      if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'evidence_open', `Abriu: ${tape.title}`, { tapeId: tape.id });
      return;
    }
    if (tape.id === currentTape?.id) return;
    
    if (!hasPlayedCurrentTape.current && currentTape) analyticsTracker.incrementStat('ejectWithoutPlay');
    
    hasPlayedCurrentTape.current = false;
    setWalkmanStatus('LOADING');
    setTimeout(() => { 
      setCurrentTape(tape); 
      setWalkmanStatus('LOADED'); 
    }, 400);
    
    if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'tape_select', `Selecionou: ${tape.title}`, { tapeId: tape.id });
  };

  const handleModeChange = (dir: 'up' | 'down') => {
    const modes: DisplayMode[] = ['default', 'title', 'chapter', 'type'];
    const idx = modes.indexOf(displayMode);
    setDisplayMode(modes[(idx + (dir === 'up' ? 1 : -1) + modes.length) % modes.length]);
  };

  const handleLogout = async () => {
    if (playerData) activityLogger.logAuth(playerData.uid, playerData.username, 'logout', `${playerData.username} saiu`);
    analyticsTracker.stopAll();
    await logout();
    setCurrentTape(null);
    setWalkmanStatus('IDLE');
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => screen === 'player' && playerData && setScreen('profile'),
    onSwipedRight: () => screen === 'profile' && playerData && setScreen('player'),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  if (playerData === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface">
        <div className="noise-overlay" /><div className="scanlines" />
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
          className="text-orange-500 font-mono text-sm tracking-widest font-black uppercase">SINTONIZANDO...</motion.div>
      </div>
    );
  }

  return (
    <div {...swipeHandlers} className="fixed inset-0 bg-surface flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none touch-none">
      <div className="noise-overlay" /><div className="scanlines" /><div className="vignette" />
      
      <AnimatePresence mode="wait">
        {screen === 'login' || playerData === undefined ? (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center">
            <LoginScreen onLogin={(data) => { setPlayerData(data); setLocalStats(data.stats); setScreen('player'); }} />
          </motion.div>
        ) : screen === 'profile' ? (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center">
            <ProfileScreen 
              profile={{ ...playerData, galleryImages }} 
              onBack={() => setScreen('player')} 
              onLogout={handleLogout} 
              onUpdateSpotify={async (url) => { 
                if (playerData) { 
                  await firestoreUpdateSpotifyPlaylist(playerData.uid, url); 
                  setPlayerData({ ...playerData, spotifyPlaylistUrl: url }); 
                } 
              }} 
            />
          </motion.div>
        ) : screen === 'bios' ? (
          <motion.div key="bios" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <BiosTerminal uid={playerData.uid} username={playerData.username}
              onIpDetected={() => setScreen('limbo')} onClose={() => setScreen('player')} 
              onAppLaunch={(app) => app === 'diskRepair' && setScreen('diskRepair')} 
              onBootSystem={() => setScreen('windows95')}
            />
          </motion.div>
        ) : screen === 'limbo' ? (
          <motion.div key="limbo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <LimboBoard uid={playerData.uid} onClose={() => setScreen('player')} 
              onBackToTerminal={() => setScreen('bios')} globalSeizedStatus={limboStatus.seized}
              readThreadIds={limboStatus.readThreadIds || []}
            />
          </motion.div>
        ) : screen === 'diskRepair' ? (
          <motion.div key="diskRepair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <DiskRepairApp uid={playerData.uid} onClose={() => setScreen('player')} onBackToTerminal={() => setScreen('bios')} />
          </motion.div>
        ) : screen === 'macos' ? (
          <motion.div key="macos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <MacOsApp uid={playerData.uid} onClose={() => setScreen('player')} />
          </motion.div>
        ) : screen === 'windows95' ? (
          <motion.div key="windows95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <Windows95App uid={playerData.uid} onClose={() => setScreen('player')} />
          </motion.div>
        ) : (
          <motion.div 
            key="player" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm h-full max-h-[750px] bg-surface-container-high rounded-[32px] border-8 border-[#1a1a1a] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)] flex flex-col p-3 sm:p-4 overflow-hidden z-10"
          >
            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMjIiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDIgMk0yIDBMMCAyIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-30 pointer-events-none mix-blend-overlay" />
            
            <Screw className="top-4 left-4" />
            <Screw className="top-4 right-4 -rotate-90" />
            <Screw className="bottom-4 left-4 -rotate-90" />
            <Screw className="bottom-4 right-4" />
            
            <CassetteVisor 
              currentTape={currentTape} 
              status={walkmanStatus}
              onEject={handleEject} 
              onScanClick={() => setWalkmanStatus('SCANNING')} 
              onCancelScan={() => setWalkmanStatus('IDLE')} 
              onQrDetected={handleQrDetected} 
            />
            
            <TapeLibrary 
              tapes={allTapesWithPistas} 
              currentTapeId={currentTape?.id ?? null}
              isPlaying={isPlaying} 
              displayMode={displayMode} 
              onTapeSelect={handleTapeSelect} 
            />
            
            <SideControls 
              volume={volume} 
              setVolume={setVolume} 
              onModeChange={handleModeChange}
              onProfileOpen={() => setScreen('profile')} 
            />
            
            <BottomControls 
              status={walkmanStatus}
              setIsPlaying={handlePlayPause} 
              hasTape={!!currentTape} 
              onRewind={handleRewind} 
              hasTerminalAccess={playerData.hasTerminalAccess} 
              onTerminalOpen={() => setScreen('bios')}
              hasMacAccess={playerData.hasMacAccess} 
              onMacOpen={() => setScreen('macos')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeEvidence && <EvidenceReader evidence={activeEvidence} onClose={() => setActiveEvidence(null)} />}
      </AnimatePresence>
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
