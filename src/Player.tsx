import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
import EvidenceReader from './components/EvidenceReader';

import { audioEngine } from './services/AudioEngine';
import { analyticsTracker } from './services/AnalyticsTracker';
import { tapeManager } from './services/TapeManager';

import { onAuthStateChanged, logout } from './store/profile';
import type { PlayerData, PlayerStats, LimboGlobalState } from './store/firestore';
import { loadPlayerData } from './store/firestore';
import { collection, doc, onSnapshot as firestoreOnSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
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
  }, [playerData?.uid]); // Init on proper uid once

  // Update volume in Engine & Tracker
  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);

  // ── Real-time tape listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!playerData?.uid) return;
    const unsubTapes = firestoreOnSnapshot(
      collection(db, 'users', playerData.uid, 'tapes'),
      (snapshot) => {
        const tapeIds = snapshot.docs.map((d) => d.id);
        setPlayerData((prev) => {
          if (!prev) return prev;
          const prevIds = prev.unlockedTapeIds.slice().sort().join(',');
          const newIds = tapeIds.slice().sort().join(',');
          if (prevIds === newIds) return prev;
          const updated = { ...prev, unlockedTapeIds: tapeIds };
          analyticsTracker.updatePlayerData(updated);
          return updated;
        });
      }
    );

    const unsubUser = firestoreOnSnapshot(doc(db, 'users', playerData.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.forceTerminalOpen) {
          setScreen(prev => {
            if (prev !== 'bios' && prev !== 'limbo' && prev !== 'diskRepair') return 'bios';
            return prev;
          });
        } else if (data.forceMacOpen) {
          setScreen(prev => (prev !== 'macos' ? 'macos' : prev));
        } else {
          setScreen(prev => (prev === 'bios' || prev === 'limbo' || prev === 'diskRepair' || prev === 'macos') ? 'player' : prev);
        }
        setPlayerData(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            hasTerminalAccess: data.hasTerminalAccess !== undefined ? !!data.hasTerminalAccess : prev.hasTerminalAccess,
            hasMacAccess: data.hasMacAccess !== undefined ? !!data.hasMacAccess : prev.hasMacAccess,
            forceTerminalOpen: data.forceTerminalOpen !== undefined ? !!data.forceTerminalOpen : prev.forceTerminalOpen,
            forceMacOpen: data.forceMacOpen !== undefined ? !!data.forceMacOpen : prev.forceMacOpen,
            username: data.username || prev.username,
            achievementsRevealed: data.achievementsRevealed !== undefined ? !!data.achievementsRevealed : prev.achievementsRevealed
          };
          // Sync tracker immediately to prevent stale stats overwriting our access flags later
          analyticsTracker.updatePlayerData(updated);
          return updated;
        });
      }
    });

    const unsubLimbo = firestoreOnSnapshot(doc(db, 'system', 'limboState'), (snap) => {
      if (snap.exists()) {
        const lState = snap.data() as LimboGlobalState;
        setLimboStatus(lState);
        if (lState.seized) {
          setScreen('limbo');
        }
      }
    });

    return () => { unsubTapes(); unsubUser(); unsubLimbo(); };
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
      analyticsTracker.pausePlayback(); // Paused initially until Play clicked
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
    setTapeState('empty');
    if (!playerData || !localStats) return;

    try {
      const tape = await tapeManager.resolveTape(code);
      if (!tape) {
        addToast({ type: 'error', title: 'Código Desconhecido', subtitle: `"${code}"`, icon: '❌' });
        return;
      }

      const { alreadyOwned, updatedTapeIds } = await tapeManager.unlockTape(playerData, tape.id);

      const now = Date.now();
      const recentScans = [...scanTimes.filter(t => now - t < 5 * 60 * 1000), now];
      setScanTimes(recentScans);

      // Verify achievements context
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

    } catch (err) {
      console.error('QR error:', err);
      addToast({ type: 'error', title: 'Erro ao analisar fita', subtitle: 'Tente dnv', icon: '⚠️' });
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
    audioEngine.stop(); // Resets time to 0

    // Play visual rewind animation
    setTimeout(() => {
      setIsRewinding(false);
    }, 1500);
  };

  const handleEject = () => { 
    checkEjectWithoutPlay();
    setIsPlaying(false); setTapeState('empty'); setCurrentTape(null); 
    analyticsTracker.forceSyncToServer();
  };

  const handleTapeSelect = (tape: Tape) => {
    if (tape.type === 'disk') {
      setActiveEvidence(tape);
      return;
    }
    if (tape.id === currentTape?.id) return;
    checkEjectWithoutPlay();
    hasPlayedCurrentTape.current = false;
    setIsChangingTape(true); setIsPlaying(false); setTapeState('empty');
    setTimeout(() => { setCurrentTape(tape); setTapeState('loaded'); setIsChangingTape(false); }, 400);
  };

  const handleModeChange = (dir: 'up' | 'down') => {
    const modes: DisplayMode[] = ['default', 'title', 'chapter'];
    const idx = modes.indexOf(displayMode);
    setDisplayMode(modes[(idx + (dir === 'up' ? 1 : -1) + modes.length) % modes.length]);
  };

  const handleLogout = async () => {
    analyticsTracker.stopAll();
    await logout();
    setCurrentTape(null); setTapeState('empty'); setIsPlaying(false);
  };

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
    <div className="fixed inset-0 bg-surface flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none touch-none">
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
            <LoginScreen onLogin={(data) => { setPlayerData(data); setLocalStats(data.stats); setScreen('player') }} />
          </motion.div>
        ) : screen === 'profile' ? (
          <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center"
          >
            <ProfileScreen profile={playerData} onBack={() => setScreen('player')} onLogout={handleLogout} />
          </motion.div>
        ) : screen === 'bios' ? (
          <motion.div key="bios" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <BiosTerminal uid={playerData.uid} onIpDetected={() => setScreen('limbo')} onClose={() => setScreen('player')} onAppLaunch={(app) => { if(app === 'diskRepair') setScreen('diskRepair'); }} />
          </motion.div>
        ) : screen === 'limbo' ? (
          <motion.div key="limbo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <LimboBoard uid={playerData.uid} onClose={() => setScreen('player')} onBackToTerminal={() => setScreen('bios')} globalSeizedStatus={limboStatus.seized} />
          </motion.div>
        ) : screen === 'diskRepair' ? (
          <motion.div key="diskRepair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <DiskRepairApp uid={playerData.uid} onClose={() => setScreen('player')} onBackToTerminal={() => setScreen('bios')} />
          </motion.div>
        ) : screen === 'macos' ? (
          <motion.div key="macos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <MacOsApp uid={playerData.uid} onClose={() => setScreen('player')} />
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

            <Screw className="top-4 left-4" />
            <Screw className="top-4 right-4 -rotate-90" />
            <Screw className="bottom-4 left-4 -rotate-90" />
            <Screw className="bottom-4 right-4" />

            <CassetteVisor currentTape={currentTape} isPlaying={isPlaying} volume={volume} tapeState={tapeState}
              onEject={handleEject} onScanClick={() => setTapeState('scanning')}
              onCancelScan={() => setTapeState('empty')} isChangingTape={isChangingTape}
              onQrDetected={handleQrDetected} isRewinding={isRewinding} />

            <TapeLibrary tapes={ownedTapes} currentTapeId={currentTape?.id ?? null}
              isPlaying={isPlaying} displayMode={displayMode} onTapeSelect={handleTapeSelect} />

            <SideControls volume={volume} setVolume={setVolume} onModeChange={handleModeChange}
              onProfileOpen={() => { analyticsTracker.forceSyncToServer(); setScreen('profile'); }} />

            <BottomControls 
              isPlaying={isPlaying} 
              setIsPlaying={setIsPlaying} 
              hasTape={!!currentTape} 
              onRewind={handleRewind} 
              isRewinding={isRewinding} 
              hasTerminalAccess={playerData.hasTerminalAccess} 
              onTerminalOpen={() => setScreen('bios')}
              hasMacAccess={playerData.hasMacAccess}
              onMacOpen={() => setScreen('macos')}
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
