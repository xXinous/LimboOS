import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import type { PlayerData, PlayerStats, LimboGlobalState } from './store/firestore';
import { loadPlayerData, firestoreUpdateSpotifyPlaylist } from './store/firestore';
import type { Tape } from './data/tapes';

import type { AppScreen, TapeState, DisplayMode } from './types/player';

export default function App() {
  const [playerData, setPlayerData] = useState<PlayerData | null | undefined>(null);
  const [localStats, setLocalStats] = useState<PlayerStats | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');

  const [tapeState, setTapeState]     = useState<TapeState>('empty');
  const [currentTape, setCurrentTape] = useState<Tape | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [volume, setVolume]           = useState(80);
  const [isChangingTape, setIsChangingTape] = useState(false);
  const [isRewinding, setIsRewinding] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const [scanTimes, setScanTimes]     = useState<number[]>([]);
  const [ownedTapes, setOwnedTapes]   = useState<Tape[]>([]);
  
  const [limboStatus, setLimboStatus] = useState<LimboGlobalState>({ seized: false });
  const [activeEvidence, setActiveEvidence] = useState<Tape | null>(null);

  const hasPlayedCurrentTape = useRef(false);
  const prevScreenRef = useRef<AppScreen>('login');

  // ── Auth & Data Loading ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
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
    });
    return unsub;
  }, []);

  // ── Analytics Tracker Initialization ─────────────────────────────────────
  useEffect(() => {
    if (playerData && localStats) {
      analyticsTracker.init(
        playerData,
        localStats,
        (stats, data) => { setLocalStats(stats); setPlayerData(data); },
        (toast) => addToast(toast)
      );
    }
    return () => { analyticsTracker.stopAll(); };
  }, [playerData?.uid]);

  // Update volume in Engine & Tracker
  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);

  // ── Real-time Player Sync Service ─────────────────────────────────────────
  useEffect(() => {
    playerSyncService.subscribeToPlayerData(
      playerData?.uid,
      (updatedData) => {
        setPlayerData((prev) => {
          if (!prev) return prev;
          const merged = { ...prev, ...updatedData };
          // Ensure tracker knows about new tapes/flags
          analyticsTracker.updatePlayerData(merged);
          return merged;
        });
      },
      (screenSetter) => setScreen(screenSetter),
      (lState) => setLimboStatus(lState)
    );

    return () => playerSyncService.stopAll();
  }, [playerData?.uid]);

  // ── Tape resolving (Local & Remote) ──────────────────────────────────────
  useEffect(() => {
    if (playerData) {
      tapeManager.getOwnedTapes(playerData.unlockedTapeIds)
        .then(setOwnedTapes)
        .catch(console.error);
    } else {
      setOwnedTapes([]);
    }
  }, [playerData?.unlockedTapeIds]);

  // ── Audio Engine Hooks ───────────────────────────────────────────────────
  useEffect(() => {
    audioEngine.setOnEnded(() => {
      setIsPlaying(false);
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
    if (isPlaying) {
      hasPlayedCurrentTape.current = true;
      audioEngine.play();
      if (currentTape) analyticsTracker.startPlayback(currentTape);
    } else {
      audioEngine.pause();
      analyticsTracker.pausePlayback();
    }
  }, [isPlaying, currentTape?.id]);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── QR detection  ─────────────────────────────────────────────────────────
  const handleQrDetected = useCallback(async (code: string) => {
    if (!playerData || !localStats) {
      addToast({ type: 'error', title: 'Aguarde', subtitle: 'Perfil ainda carregando. Tente de novo.', icon: '⏳' });
      return;
    }

    setTapeState('empty');

    activityLogger.logAction(playerData.uid, playerData.username, 'qr_scan', `QR escaneado: ${code}`, { code });

    try {
      const tape = await tapeManager.resolveTape(code);
      if (!tape) {
        addToast({ type: 'error', title: 'Código Desconhecido', subtitle: `"${code}"`, icon: '❌' });
        activityLogger.logError(playerData.uid, playerData.username, `QR desconhecido: ${code}`, undefined, { code });
        return;
      }

      const { alreadyOwned, updatedTapeIds } = await tapeManager.unlockTape(playerData, tape.id);

      const now = Date.now();
      const recentScans = [...scanTimes.filter(t => now - t < 5 * 60 * 1000), now];
      setScanTimes(recentScans);

      analyticsTracker.checkAchievements(recentScans);
      setPlayerData({ ...playerData, unlockedTapeIds: updatedTapeIds });

      hasPlayedCurrentTape.current = false;
      setIsChangingTape(true);
      setIsPlaying(false);
      
      setTimeout(() => {
        setCurrentTape(tape);
        setTapeState('loaded');
        setIsChangingTape(false);
        addToast({ type: 'tape', title: alreadyOwned ? 'Fita Inserida' : 'Fita Desbloqueada!', subtitle: tape.title, icon: '📼' });
      }, 400);

      activityLogger.logAction(playerData.uid, playerData.username, alreadyOwned ? 'tape_insert' : 'tape_unlock', `${alreadyOwned ? 'Inseriu' : 'Desbloqueou'} fita: ${tape.title}`, { tapeId: tape.id, tapeTitle: tape.title, alreadyOwned });

    } catch (err) {
      console.error('QR error:', err);
      addToast({ type: 'error', title: 'Erro ao analisar fita', subtitle: 'Tente dnv', icon: '⚠️' });
      activityLogger.logError(playerData.uid, playerData.username, `Erro QR: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);
    }
  }, [playerData, localStats, scanTimes, addToast]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const checkEjectWithoutPlay = useCallback(() => {
    if (!hasPlayedCurrentTape.current && currentTape) {
      analyticsTracker.incrementStat('ejectWithoutPlay');
    }
  }, [currentTape]);

  const handleRewind = () => {
    if (!currentTape || isRewinding) return;
    setIsRewinding(true);
    setIsPlaying(false);
    audioEngine.stop();

    setTimeout(() => {
      setIsRewinding(false);
    }, 1500);
  };

  const handleEject = () => { 
    checkEjectWithoutPlay();
    if (playerData && currentTape) {
      activityLogger.logAction(playerData.uid, playerData.username, 'tape_eject', `Ejetou fita: ${currentTape.title}`, { tapeId: currentTape.id });
    }
    setIsPlaying(false); setTapeState('empty'); setCurrentTape(null); 
    analyticsTracker.forceSyncToServer();
  };

  const handleTapeSelect = (tape: Tape) => {
    if (tape.type === 'disk') {
      setActiveEvidence(tape);
      if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'evidence_open', `Abriu evidência: ${tape.title}`, { tapeId: tape.id });
      return;
    }
    if (tape.id === currentTape?.id) return;
    checkEjectWithoutPlay();
    hasPlayedCurrentTape.current = false;
    setIsChangingTape(true); setIsPlaying(false); setTapeState('empty');
    setTimeout(() => { setCurrentTape(tape); setTapeState('loaded'); setIsChangingTape(false); }, 400);
    if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'tape_select', `Selecionou fita: ${tape.title}`, { tapeId: tape.id });
  };

  const handleModeChange = (dir: 'up' | 'down') => {
    const modes: DisplayMode[] = ['default', 'title', 'chapter'];
    const idx = modes.indexOf(displayMode);
    setDisplayMode(modes[(idx + (dir === 'up' ? 1 : -1) + modes.length) % modes.length]);
  };

  const handleLogout = async () => {
    if (playerData) activityLogger.logAuth(playerData.uid, playerData.username, 'logout', `${playerData.username} desconectou do sistema`);
    analyticsTracker.stopAll();
    await logout();
    setCurrentTape(null); setTapeState('empty'); setIsPlaying(false);
  };

  // ── Swipe Gestures ────────────────────────────────────────────────────────
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (screen === 'player' && playerData) {
        activityLogger.logNavigation(playerData.uid, playerData.username, 'player', 'profile');
        analyticsTracker.forceSyncToServer();
        setScreen('profile');
      }
    },
    onSwipedRight: () => {
      if (screen === 'profile' && playerData) {
        activityLogger.logNavigation(playerData.uid, playerData.username, 'profile', 'player');
        setScreen('player');
      }
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  // ── UI Loading / Nav ──────────────────────────────────────────────────────
  if (playerData === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface">
        <div className="noise-overlay" /><div className="scanlines" />
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
          className="text-orange-500 font-mono text-sm tracking-widest font-black uppercase">SINTONIZANDO...</motion.div>
      </div>
    );
  }

  // ── Renderer ──────────────────────────────────────────────────────────────
  return (
    <div {...swipeHandlers} className="fixed inset-0 bg-surface flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none touch-none">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="vignette" />

      <AnimatePresence mode="wait">
        {screen === 'login' || playerData === undefined ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center"
          >
            <LoginScreen onLogin={(data) => { activityLogger.logNavigation(data.uid, data.username, 'login', 'player'); setPlayerData(data); setLocalStats(data.stats); setScreen('player') }} />
          </motion.div>
        ) : screen === 'profile' ? (
          <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center"
          >
            <ProfileScreen 
              profile={playerData} 
              onBack={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'profile', 'player'); setScreen('player'); }} 
              onLogout={handleLogout} 
              onUpdateSpotify={async (url) => { 
                if (playerData) { 
                  activityLogger.logAction(playerData.uid, playerData.username, 'profile', `Atualizou playlist Spotify: ${url}`, { url });
                  await firestoreUpdateSpotifyPlaylist(playerData.uid, url); 
                  setPlayerData({ ...playerData, spotifyPlaylistUrl: url }); 
                } 
              }} 
            />
          </motion.div>
        ) : screen === 'bios' ? (
          <motion.div key="bios" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <BiosTerminal 
              uid={playerData.uid} 
              username={playerData.username}
              onIpDetected={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'bios', 'limbo'); setScreen('limbo'); }} 
              onClose={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'bios', 'player'); setScreen('player'); }} 
              onAppLaunch={(app) => { if(app === 'diskRepair') { activityLogger.logNavigation(playerData.uid, playerData.username, 'bios', 'diskRepair'); setScreen('diskRepair'); } }} 
              onBootSystem={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'bios', 'windows95'); setScreen('windows95'); }}
            />
          </motion.div>
        ) : screen === 'limbo' ? (
          <motion.div key="limbo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <LimboBoard uid={playerData.uid} onClose={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'limbo', 'player'); setScreen('player'); }} onBackToTerminal={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'limbo', 'bios'); setScreen('bios'); }} globalSeizedStatus={limboStatus.seized} />
          </motion.div>
        ) : screen === 'diskRepair' ? (
          <motion.div key="diskRepair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <DiskRepairApp uid={playerData.uid} onClose={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'diskRepair', 'player'); setScreen('player'); }} onBackToTerminal={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'diskRepair', 'bios'); setScreen('bios'); }} />
          </motion.div>
        ) : screen === 'macos' ? (
          <motion.div key="macos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <MacOsApp uid={playerData.uid} onClose={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'macos', 'player'); setScreen('player'); }} />
          </motion.div>
        ) : screen === 'windows95' ? (
          <motion.div key="windows95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <Windows95App uid={playerData.uid} onClose={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'windows95', 'player'); setScreen('player'); }} />
          </motion.div>
        ) : (
          <motion.div 
            key="player"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm h-full max-h-[750px] bg-surface-container-high rounded-[32px] border-8 border-[#1a1a1a] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)] flex flex-col p-3 sm:p-4 overflow-hidden z-10"
          >
            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMjIiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDIgMk0yIDBMMCAyIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-30 pointer-events-none mix-blend-overlay" />

            <Screw className="top-4 left-4" uid={playerData.uid} username={playerData.username} />
            <Screw className="top-4 right-4 -rotate-90" uid={playerData.uid} username={playerData.username} />
            <Screw className="bottom-4 left-4 -rotate-90" uid={playerData.uid} username={playerData.username} />
            <Screw className="bottom-4 right-4" uid={playerData.uid} username={playerData.username} />

            <CassetteVisor 
              currentTape={currentTape} 
              isPlaying={isPlaying} 
              volume={volume} 
              tapeState={tapeState}
              onEject={handleEject} 
              onScanClick={() => {
                if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'qr_scan', 'Iniciou escaneamento QR');
                setTapeState('scanning');
              }} 
              onCancelScan={() => {
                if (playerData) activityLogger.logAction(playerData.uid, playerData.username, 'qr_scan', 'Cancelou escaneamento QR');
                setTapeState('empty');
              }} 
              isChangingTape={isChangingTape}
              onQrDetected={handleQrDetected} 
              isRewinding={isRewinding} 
              uid={playerData.uid}
              username={playerData.username}
            />

            <TapeLibrary 
              tapes={ownedTapes} 
              currentTapeId={currentTape?.id ?? null}
              isPlaying={isPlaying} 
              displayMode={displayMode} 
              onTapeSelect={handleTapeSelect} 
              uid={playerData.uid}
              username={playerData.username}
            />

            <SideControls 
              volume={volume} 
              setVolume={setVolume} 
              onModeChange={handleModeChange}
              onProfileOpen={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'player', 'profile'); analyticsTracker.forceSyncToServer(); setScreen('profile'); }} 
              uid={playerData.uid}
              username={playerData.username}
            />

            <BottomControls 
              isPlaying={isPlaying} 
              setIsPlaying={setIsPlaying} 
              hasTape={!!currentTape} 
              onRewind={handleRewind} 
              isRewinding={isRewinding} 
              hasTerminalAccess={playerData.hasTerminalAccess} 
              onTerminalOpen={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'player', 'bios'); setScreen('bios'); }}
              hasMacAccess={playerData.hasMacAccess}
              onMacOpen={() => { activityLogger.logNavigation(playerData.uid, playerData.username, 'player', 'macos'); setScreen('macos'); }}
              uid={playerData.uid}
              username={playerData.username}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeEvidence && (
          <EvidenceReader evidence={activeEvidence} onClose={() => setActiveEvidence(null)} />
        )}
      </AnimatePresence>

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
