import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Play, Pause, RotateCcw, Battery, Camera, User } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import QrScanner from './components/QrScanner';
import ProfileScreen from './components/ProfileScreen';
import ToastNotification from './components/ToastNotification';
import type { Toast } from './components/ToastNotification';

import { onAuthStateChanged, logout } from './store/profile';
import type { PlayerData } from './store/profile';
import { loadPlayerData, firestoreUnlockTape, firestoreGrantAchievements, recordPlayEvent } from './store/firestore';
import { getTapeByCode, resolveTapes } from './data/tapes';
import type { Tape } from './data/tapes';
import { checkNewAchievements } from './data/achievements';

// ─── Types ───────────────────────────────────────────────────────────────────

type AppScreen = 'login' | 'player' | 'profile';
type TapeState  = 'empty' | 'loaded' | 'scanning';
type DisplayMode = 'default' | 'title' | 'chapter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Screw = ({ className }: { className?: string }) => (
  <div className={`absolute w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center ${className}`}>
    <div className="w-2 h-0.5 bg-[#3a3a3a] rotate-45" />
  </div>
);

// ─── Cassette Visor ──────────────────────────────────────────────────────────

const CassetteVisor = ({
  currentTape, isPlaying, volume, tapeState,
  onEject, onScanClick, onCancelScan, isChangingTape,
}: {
  currentTape: Tape | null; isPlaying: boolean; volume: number;
  tapeState: TapeState; onEject: () => void; onScanClick: () => void;
  onCancelScan: () => void; isChangingTape: boolean;
}) => (
  <div className="mt-4 mx-auto w-[310px] h-[190px] bg-[#222] rounded-xl border-4 border-[#1a1a1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] flex flex-col items-center relative overflow-hidden shrink-0">
    {/* Corner screws */}
    {([['top-2 left-2',''],['top-2 right-2','-rotate-45'],['bottom-2 left-2','rotate-90'],['bottom-2 right-2','']] as const).map(([pos, rot], i) => (
      <div key={i} className={`absolute ${pos} w-2.5 h-2.5 rounded-full bg-[#111] flex items-center justify-center`}>
        <div className={`w-1.5 h-px bg-[#333] ${rot}`} />
      </div>
    ))}

    <AnimatePresence mode="wait">
      {tapeState === 'loaded' && currentTape ? (
        <motion.div key="cassette" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onClick={onEject} className="w-full h-full flex flex-col items-center cursor-pointer group">
          {/* Label */}
          <div className="mt-4 w-[280px] h-[130px] bg-[#f4f1ea] rounded-md shadow-sm relative flex flex-col p-3 border-t-12 border-orange-600 transition-transform group-hover:scale-[1.01]">
            <div className="flex justify-between items-start text-[9px] font-bold text-gray-500 mb-1">
              <div className="flex items-center gap-1">
                {isPlaying && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.8)]" />}
                <span className="uppercase tracking-tighter">{isPlaying ? 'PLAY' : 'STOP'}</span>
              </div>
              <div className="tracking-widest text-orange-600/80 font-black">TYPE I</div>
              <div className="flex items-center gap-1"><span>{volume}%</span><Battery size={12} /></div>
            </div>
            <div className="text-[8px] font-bold flex justify-center gap-4 text-gray-500 mb-2 border-b border-gray-300/50 pb-1">
              <span>{currentTape.chapter}</span><span>{currentTape.npc}</span>
            </div>
            <div className="flex-1 flex flex-col text-center px-2">
              <div className="text-[13px] font-black uppercase tracking-tight text-gray-800 truncate leading-tight">{currentTape.title}</div>
              <div className="text-[10px] font-bold text-gray-600 truncate mt-0.5">{currentTape.artist}</div>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[180px] h-[50px] bg-[#222] rounded-t-lg border-t-2 border-l-2 border-r-2 border-[#111]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm">CLICK TO EJECT</div>
          </div>
          {/* Spools */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[170px] h-[46px] bg-black/40 rounded-md flex items-center justify-between px-4 border border-white/5">
            {[true, false].map((_, si) => (
              <motion.div key={si} animate={{ rotate: isPlaying ? 360 : 0 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="w-10 h-10 rounded-full bg-[#d4d4d4] flex items-center justify-center relative shadow-md">
                <div className="absolute inset-0 rounded-full border-[6px] border-[#111] opacity-90" />
                <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center z-10">
                  <div className="w-full h-0.5 bg-[#d4d4d4] absolute" /><div className="w-0.5 h-full bg-[#d4d4d4] absolute" />
                  <div className="w-full h-0.5 bg-[#d4d4d4] absolute rotate-45" /><div className="w-0.5 h-full bg-[#d4d4d4] absolute rotate-45" />
                </div>
              </motion.div>
            ))}
            <div className="absolute bottom-1 left-8 right-8 h-[3px] bg-[#111]" />
          </div>
        </motion.div>
      ) : (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="w-full h-full flex flex-col items-center justify-center p-4">
          {tapeState === 'scanning' ? (
            <QrScanner
              onDetected={(code) => { (window as any).__qrDetected?.(code); }}
              onCancel={onCancelScan}
            />
          ) : (
            <div onClick={!isChangingTape ? onScanClick : undefined}
              className={`w-[280px] h-[130px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all ${isChangingTape ? 'border-[#222] cursor-default' : 'border-[#444] hover:bg-white/5 cursor-pointer group'}`}>
              {!isChangingTape && (<>
                <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="text-gray-500 group-hover:text-orange-500 transition-colors" size={24} />
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">Compartimento Vazio</p>
                  <p className="text-orange-500 text-[9px] font-bold uppercase tracking-tighter mt-1">Escaneie QR para Inserir Fita</p>
                </div>
              </>)}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ─── Tape Library ─────────────────────────────────────────────────────────────

const TapeLibrary = ({ tapes, currentTapeId, isPlaying, displayMode, onTapeSelect }: {
  tapes: Tape[]; currentTapeId: string | null; isPlaying: boolean; displayMode: DisplayMode;
  onTapeSelect: (tape: Tape) => void;
}) => {
  const sorted = React.useMemo(() => {
    if (displayMode === 'title') return [...tapes].sort((a, b) => a.title.localeCompare(b.title));
    if (displayMode === 'chapter') return [...tapes].sort((a, b) => a.chapter.localeCompare(b.chapter));
    return tapes;
  }, [tapes, displayMode]);

  return (
    <div className="mt-6 flex-1 bg-[#1a1a1a] rounded-2xl border-2 border-[#333] overflow-hidden flex flex-col mr-[76px]">
      <div className="p-3 border-b border-[#333] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center"><span className="text-white font-black text-sm italic">R.</span></div>
          <h2 className="text-orange-500 text-sm font-bold tracking-tight">Fitas</h2>
        </div>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
          {displayMode === 'default' ? 'Original' : displayMode === 'title' ? 'A-Z' : 'Cap.'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <style>{`.tape-scroll::-webkit-scrollbar{width:4px}.tape-scroll::-webkit-scrollbar-track{background:#1a1a1a}.tape-scroll::-webkit-scrollbar-thumb{background:#ea580c;border-radius:4px}`}</style>
        <div className="tape-scroll overflow-y-auto h-full">
          {tapes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <span className="text-3xl mb-2">📼</span>
              <p className="text-gray-600 text-xs uppercase tracking-widest">Nenhuma fita</p>
              <p className="text-gray-700 text-[10px] mt-1">Escaneie um QR code para começar</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {sorted.map((tape) => (
                <motion.div layout key={tape.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => onTapeSelect(tape)}
                  className={`p-2 border-b border-[#222] cursor-pointer transition-colors flex justify-between items-center ${tape.id === currentTapeId ? 'bg-orange-900/20 border-orange-500/50' : 'hover:bg-[#222]'}`}>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-xs font-bold truncate ${tape.id === currentTapeId ? 'text-orange-500' : 'text-gray-200'}`}>{tape.title}</span>
                    <span className="text-[10px] text-orange-400 opacity-80 truncate">{tape.chapter}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tape.id === currentTapeId && isPlaying && (
                      <motion.div animate={{ opacity: [0, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}
                        className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-orange-500 border-b-4 border-b-transparent" />
                    )}
                    <div className="w-8 h-8 bg-[#222] rounded border border-[#333] flex items-center justify-center text-sm">📼</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Side Controls ────────────────────────────────────────────────────────────

const SideControls = ({ volume, setVolume, onModeChange, onProfileOpen }: {
  volume: number; setVolume: (v: number) => void;
  onModeChange: (dir: 'up' | 'down') => void; onProfileOpen: () => void;
}) => (
  <div className="absolute right-2 top-[240px] bottom-20 flex flex-col items-center justify-center gap-6 w-16">
    <button onClick={onProfileOpen} className="w-10 h-10 rounded-full bg-[#333] border-2 border-[#1a1a1a] flex items-center justify-center hover:bg-orange-900/30 transition-colors shrink-0">
      <User size={16} className="text-orange-500" />
    </button>
    <motion.div drag="y" dragConstraints={{ top: -20, bottom: 20 }} dragElastic={0.1}
      onDragEnd={(_, info) => { if (info.offset.y < -10) onModeChange('up'); else if (info.offset.y > 10) onModeChange('down'); }}
      dragSnapToOrigin className="relative w-14 h-14 rounded-full bg-[#333] border-4 border-[#1a1a1a] shadow-lg flex items-center justify-center group cursor-ns-resize shrink-0 z-20">
      <div className="absolute inset-0 rounded-full border border-white/10" />
      <div className="w-10 h-10 rounded-full bg-[#444] border-2 border-[#222] flex items-center justify-center shadow-inner pointer-events-none">
        <div className="w-5 h-5 rounded-full bg-orange-600 border-2 border-[#1a1a1a]" />
      </div>
      <div className="absolute -top-4 text-gray-500 group-hover:text-orange-500 pointer-events-none"><div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-[6px] border-b-current" /></div>
      <div className="absolute -bottom-4 text-gray-500 group-hover:text-orange-500 pointer-events-none"><div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-[6px] border-t-current" /></div>
    </motion.div>
    <div className="w-8 flex-1 max-h-40 bg-[#1a1a1a] rounded-full border-2 border-[#333] relative flex flex-col items-center py-2 shrink-0">
      <span className="text-[10px] text-gray-500 font-bold mb-1">+</span>
      <div className="flex-1 w-1 bg-[#222] rounded-full relative overflow-visible">
        <motion.div className="absolute bottom-0 w-full bg-orange-600 rounded-full" style={{ height: `${volume}%` }} />
        <motion.div className="absolute left-1/2 -translate-x-1/2 w-6 h-8 bg-linear-to-b from-stone-200 to-stone-400 rounded border-2 border-stone-600 shadow-lg cursor-ns-resize flex flex-col justify-center items-center gap-0.5 z-10"
          style={{ bottom: `calc(${volume}% - 16px)` }}
          onPointerDown={(e) => {
            const startY = e.clientY, startVol = volume;
            const onMove = (me: PointerEvent) => setVolume(Math.max(0, Math.min(100, Math.round(startVol + ((startY - me.clientY) / 80) * 100))));
            const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
            window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
          }}>
          {[0,1,2].map(i => <div key={i} className="w-3 h-0.5 bg-stone-500 rounded-full" />)}
        </motion.div>
      </div>
      <span className="text-[10px] text-gray-500 font-bold mt-1">-</span>
    </div>
  </div>
);

// ─── Bottom Controls ──────────────────────────────────────────────────────────

const BottomControls = ({ isPlaying, setIsPlaying, hasTape }: { isPlaying: boolean; setIsPlaying: (v: boolean) => void; hasTape: boolean }) => (
  <div className="mt-4 flex justify-between items-center px-2 shrink-0">
    <button className="w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center active:bg-[#444] transition-all">
      <RotateCcw size={18} className="text-orange-500" />
    </button>
    <button onClick={() => hasTape && setIsPlaying(!isPlaying)}
      className={`w-20 h-12 bg-[#333] rounded-xl border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center gap-1 transition-all ${hasTape ? 'active:bg-[#444] active:shadow-inner' : 'opacity-40 cursor-not-allowed'}`}>
      {isPlaying ? <Pause size={22} className="text-orange-500 fill-orange-500" /> : <Play size={22} className="text-orange-500 fill-orange-500" />}
    </button>
    <button className="w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center opacity-40">
      <span className="text-orange-500 text-xs font-bold">EQ</span>
    </button>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  // null = checking, undefined = not logged in
  const [playerData, setPlayerData] = useState<PlayerData | null | undefined>(null);
  const [screen, setScreen] = useState<AppScreen>('login');

  // ── Player state ──────────────────────────────────────────────────────────
  const [tapeState, setTapeState]     = useState<TapeState>('empty');
  const [currentTape, setCurrentTape] = useState<Tape | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [volume, setVolume]           = useState(80);
  const [isChangingTape, setIsChangingTape] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [toasts, setToasts]           = useState<Toast[]>([]);

  const listenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Firebase Auth listener ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      if (user) {
        if (user.email === 'gm.mpg@runningman.local') {
          window.location.href = '/admin';
          return;
        }
        const data = await loadPlayerData(user.uid);
        setPlayerData(data);
        setScreen('player');
      } else {
        setPlayerData(undefined);
        setScreen('login');
      }
    });
    return unsub;
  }, []);

  // ── Listen timer  ─────────────────────────────────────────────────────────
  // (Achievement ACH-LISTENER hooks here — placeholder for future full tracking)
  useEffect(() => {
    if (isPlaying) {
      // Record play event for analytics/achievements
      if (currentTape && playerData) {
        recordPlayEvent(playerData.uid, currentTape.id).catch(console.error);
      }
      listenTimerRef.current = setInterval(() => {/* extend later */}, 5000);
    } else {
      if (listenTimerRef.current) clearInterval(listenTimerRef.current);
    }
    return () => { if (listenTimerRef.current) clearInterval(listenTimerRef.current); };
  }, [isPlaying]);

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
    if (!playerData) return;
    setTapeState('empty');

    const tape = getTapeByCode(code);
    if (!tape) {
      addToast({ type: 'error', title: 'Código Desconhecido', subtitle: `"${code}"`, icon: '❌' });
      return;
    }

    const alreadyOwned = playerData.unlockedTapeIds.includes(tape.id);

    // Persist to Firestore
    await firestoreUnlockTape(playerData.uid, tape.id);

    // Build updated local state for achievement check
    const updatedTapeIds = alreadyOwned
      ? playerData.unlockedTapeIds
      : [...playerData.unlockedTapeIds, tape.id];

    const fakeProfile = { ...playerData, unlockedTapeIds: updatedTapeIds };
    const newAchievements = checkNewAchievements(fakeProfile);

    if (newAchievements.length > 0) {
      await firestoreGrantAchievements(playerData.uid, newAchievements.map(a => a.id));
      newAchievements.forEach(ach => addToast({ type: 'achievement', title: 'Conquista!', subtitle: ach.title, icon: ach.icon }));
    }

    // Update local player data
    setPlayerData({
      ...playerData,
      unlockedTapeIds: updatedTapeIds,
      achievementIds: [...playerData.achievementIds, ...newAchievements.map(a => a.id)],
    });

    // Animate cassette insert
    setIsChangingTape(true);
    setIsPlaying(false);
    setTimeout(() => {
      setCurrentTape(tape);
      setTapeState('loaded');
      setIsChangingTape(false);
      addToast({ type: 'tape', title: alreadyOwned ? 'Fita Inserida' : 'Fita Desbloqueada!', subtitle: tape.title, icon: '📼' });
    }, 400);
  }, [playerData, addToast]);

  useEffect(() => {
    (window as any).__qrDetected = handleQrDetected;
    return () => { delete (window as any).__qrDetected; };
  }, [handleQrDetected]);

  // ── Tape actions ──────────────────────────────────────────────────────────
  const handleEject = () => { setIsPlaying(false); setTapeState('empty'); setCurrentTape(null); };

  const handleTapeSelect = (tape: Tape) => {
    if (tape.id === currentTape?.id) return;
    setIsChangingTape(true); setIsPlaying(false); setTapeState('empty');
    setTimeout(() => { setCurrentTape(tape); setTapeState('loaded'); setIsChangingTape(false); }, 400);
  };

  const handleModeChange = (dir: 'up' | 'down') => {
    const modes: DisplayMode[] = ['default', 'title', 'chapter'];
    const idx = modes.indexOf(displayMode);
    setDisplayMode(modes[(idx + (dir === 'up' ? 1 : -1) + modes.length) % modes.length]);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentTape(null); setTapeState('empty'); setIsPlaying(false);
    // onAuthStateChanged will fire and set screen back to 'login'
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (playerData === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="noise-overlay" /><div className="scanlines" />
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
          className="text-primary font-display text-xs uppercase tracking-[0.3em]">
          Inicializando sistema...
        </motion.div>
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <>
        <LoginScreen onLogin={(data) => { 
          if (data?.username?.toLowerCase() === 'gm.mpg') {
            window.location.href = '/admin';
            return;
          }
          setPlayerData(data); 
          setScreen('player'); 
        }} />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const ownedTapes = playerData ? resolveTapes(playerData.unlockedTapeIds) : [];

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-900 font-mono select-none overflow-hidden">
      <div className="relative w-[min(380px,90vw)] h-[min(680px,92vh)] bg-[#2a2a2a] rounded-[40px] shadow-2xl border-4 border-[#1a1a1a] flex flex-col p-4 overflow-hidden">
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" />
        <Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />

        <CassetteVisor currentTape={currentTape} isPlaying={isPlaying} volume={volume} tapeState={tapeState}
          onEject={handleEject} onScanClick={() => setTapeState('scanning')}
          onCancelScan={() => setTapeState('empty')} isChangingTape={isChangingTape} />

        <TapeLibrary tapes={ownedTapes} currentTapeId={currentTape?.id ?? null}
          isPlaying={isPlaying} displayMode={displayMode} onTapeSelect={handleTapeSelect} />

        <SideControls volume={volume} setVolume={setVolume} onModeChange={handleModeChange}
          onProfileOpen={() => setScreen('profile')} />

        <BottomControls isPlaying={isPlaying} setIsPlaying={setIsPlaying} hasTape={tapeState === 'loaded'} />

        <div className="mt-auto pt-3 flex items-center justify-center gap-2 opacity-40 shrink-0">
          <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 tracking-widest">RunningMan</span>
        </div>

        <AnimatePresence>
          {screen === 'profile' && playerData && (
            <ProfileScreen
              profile={{
                id: playerData.uid,
                username: playerData.username,
                unlockedTapeIds: playerData.unlockedTapeIds,
                achievementIds: playerData.achievementIds,
              }}
              onBack={() => setScreen('player')}
              onLogout={handleLogout}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="fixed inset-0 pointer-events-none opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-orange-500 via-transparent to-transparent" />
      </div>

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
