import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSwipeable } from 'react-swipeable';
import ToastNotification from './components/ToastNotification';
import type { Toast } from './components/ToastNotification';
import CassetteVisor from './components/player/CassetteVisor';
import TapeLibrary from './components/player/TapeLibrary';
import SideControls from './components/player/SideControls';
import BottomControls from './components/player/BottomControls';
import Screw from './components/player/Screw';
import RetroLoading from './components/player/RetroLoading';

const LoginScreen = React.lazy(() => import('./components/LoginScreen'));
const ProfileScreen = React.lazy(() => import('./components/ProfileScreen'));
const CharacterSelectionScreen = React.lazy(() => import('./components/CharacterSelectionScreen'));
const BiosTerminal = React.lazy(() => import('./components/BiosTerminal'));
const LimboBoard = React.lazy(() => import('./components/LimboBoard'));
const DiskRepairApp = React.lazy(() => import('./components/DiskRepairApp'));
const MacOsApp = React.lazy(() => import('./components/MacOsApp'));
const Windows95App = React.lazy(() => import('./components/Windows95App'));
const EvidenceReader = React.lazy(() => import('./components/EvidenceReader'));
const CampaignSelection = React.lazy(() => import('./components/CampaignSelection'));
const AgentDossierOverlay = React.lazy(() => import('./components/campaign/AgentDossierOverlay').then(m => ({ default: m.AgentDossierOverlay })));
import { audioEngine } from './services/AudioEngine';
import { analyticsTracker } from './services/AnalyticsTracker';
import { activityLogger } from './services/ActivityLogger';
import { intelService } from './services/IntelService';
import { playerSyncService } from './services/PlayerSyncService';
import { onAuthStateChanged, logout } from './store/profile';
import type { MasterAccount, CharacterData, PlayerData, PlayerStats, LimboGlobalState, GalleryImage } from './types/player';
import { 
  loadMasterAccount,
  loadPlayerData, 
  firestoreUpdateSpotifyPlaylist, 
  fetchPlayerGalleryImages,
  firestoreSetCampaign
} from './store/firestore';
import type { IntelItem, PlayerIntelCollection } from './types/intel';
import type { AppScreen, WalkmanStatus, DisplayMode } from './types/player';

const EMPTY_ARRAY: any[] = [];

export default function Player() {
  const [masterAccount, setMasterAccount] = useState<MasterAccount | null | undefined>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [localStats, setLocalStats] = useState<PlayerStats | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');
  
  // Unified Intel Collection State
  const [intelCollection, setIntelCollection] = useState<PlayerIntelCollection | null>(null);
  
  // State Machine: Centralized status
  const [walkmanStatus, setWalkmanStatus] = useState<WalkmanStatus>('IDLE');
  const [currentIntel, setCurrentIntel] = useState<IntelItem | null>(null);
  const [volume, setVolume] = useState(80);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scanTimes, setScanTimes] = useState<number[]>([]);
  const [limboStatus, setLimboStatus] = useState<LimboGlobalState>({ seized: false });
  const [activeEvidence, setActiveEvidence] = useState<IntelItem | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  
  const hasPlayedCurrentTape = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isInitialIntelLoad = useRef(true);
  
  // Estabiliza o playerData para callbacks sem quebrar o memo
  const playerDataRef = useRef<PlayerData | null>(null);
  useEffect(() => {
    playerDataRef.current = playerData;
  }, [playerData]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  
  // Derived states
  const isPlaying = walkmanStatus === 'PLAYING';

  // --- Auth & Initial Load ---
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      try {
        if (user) {
          if (user.email === 'gm.mpg@runningman.local') {
            window.location.href = '/admin';
            return;
          }

          // Check for legacy migration
          const { needsMigration, migrateLegacyUser } = await import('./store/migration');
          if (await needsMigration(user.uid)) {
            await migrateLegacyUser(user.uid);
          }

          const account = await loadMasterAccount(user.uid);
          setMasterAccount(account);
          setScreen('characterSelection');
          activityLogger.logAuth('login', `Terminal acessado via ${account.email}`);
        } else {
          setMasterAccount(undefined);
          setPlayerData(null);
          setLocalStats(null);
          activityLogger.clearUser();
          setScreen('login');
        }
      } catch (err) {
        console.warn('[Auth] Error:', err);
        setMasterAccount(undefined);
        setScreen('login');
      }
    });
    return unsub;
  }, []);

  // --- Character-Specific Initialization ---
  const handleCharacterSelect = async (char: CharacterData) => {
    if (!masterAccount) return;
    try {
      const data = await loadPlayerData(masterAccount.uid, char.id);
      setPlayerData(data);
      setLocalStats(data.stats);
      
      activityLogger.setUser(masterAccount.uid, data.character.codinome, data.activeCharacterId);
      activityLogger.logAction('character_select', `Agente ${data.character.codinome} ativado`);

      setScreen('campaignSelection');
    } catch (err) {
      console.error('[CharacterSelect] Error:', err);
    }
  };

  useEffect(() => {
    if (playerData && localStats) {
      analyticsTracker.init(playerData, localStats, 
        (stats, data) => { setLocalStats(stats); setPlayerData(data); },
        (toast) => addToast(toast)
      );

      playerSyncService.subscribeToPlayerData(playerData.uid, playerData.activeCharacterId,
        (updatedData) => {
          setPlayerData((prev) => prev ? { ...prev, ...updatedData } : prev);
        },
        setScreen,
        setLimboStatus
      );
    }
    return () => {
      analyticsTracker.stopAll();
      playerSyncService.stopAll();
    };
  }, [playerData?.activeCharacterId]);

const tapeIdsKey = playerData?.unlockedTapeIds?.join(',') ?? '';
const galleryIdsKey = playerData?.unlockedGalleryIds?.join(',') ?? '';

// Unified Intel Fetching (Adding debug logs and loading state management)
useEffect(() => {
  if (!playerData) return;
  const fetchIntel = async () => {
    if (isInitialIntelLoad.current) {
      setWalkmanStatus('LOADING'); // Indicate background work only on first load
    }
    try {
      const gallery = playerData.unlockedGalleryIds.length ? await fetchPlayerGalleryImages(playerData.uid, playerData.activeCharacterId) : [];
      setGalleryImages(gallery);
      const collection = await intelService.getCollection(playerData, gallery);
      setIntelCollection(collection);
    } catch (error) {
        console.error('[Player DEBUG] Error during Intel Fetch:', error);
    } finally {
        if (isInitialIntelLoad.current) {
          setWalkmanStatus('LOADED'); // Restore state when done
          isInitialIntelLoad.current = false;
        }
    }
  };
  fetchIntel();
}, [tapeIdsKey, galleryIdsKey]);

  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);



  // Audio Engine interactions
  useEffect(() => {
    audioEngine.setOnEnded(() => { setWalkmanStatus('LOADED'); analyticsTracker.endPlayback(); });
  }, []);

  useEffect(() => {
    if (currentIntel?.type === 'AUDIO' && currentIntel.mediaUrl) {
      audioEngine.loadTrack(currentIntel.mediaUrl);
      analyticsTracker.pausePlayback();
    } else if (!currentIntel) {
      audioEngine.clearTrack();
      analyticsTracker.stopAll();
    }
    return () => audioEngine.clearTrack();
  }, [currentIntel?.id]);

  useEffect(() => {
    if (walkmanStatus === 'PLAYING') {
      hasPlayedCurrentTape.current = true;
      audioEngine.play();
      if (currentIntel) analyticsTracker.startPlayback(currentIntel);
    } else if (walkmanStatus === 'REWINDING') {
      audioEngine.stop();
      analyticsTracker.pausePlayback();
    } else {
      audioEngine.pause();
      analyticsTracker.pausePlayback();
    }
  }, [walkmanStatus, currentIntel?.id]);

  // Handlers
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const handleQrDetected = useCallback(async (code: string) => {
    const currentPD = playerDataRef.current;
    if (!currentPD || !localStats) return addToast({ type: 'error', title: 'Aguarde', subtitle: 'Perfil carregando...', icon: '⏳' });
    setWalkmanStatus('IDLE');
    
    try {
      const intel = await intelService.resolve(code);
      if (!intel) return addToast({ type: 'error', title: 'Código Desconhecido', subtitle: code, icon: '❌' });
      
      const { alreadyOwned, updatedIds } = await intelService.unlock(currentPD, intel.id);
      const now = Date.now();
      const recentScans = [...scanTimes.filter(t => now - t < 300000), now];
      setScanTimes(recentScans);
      analyticsTracker.checkAchievements(recentScans);
      setPlayerData({ ...currentPD, unlockedTapeIds: updatedIds });
      
      hasPlayedCurrentTape.current = false;
      setWalkmanStatus('LOADING');
      timerRef.current = setTimeout(() => { setCurrentIntel(intel); setWalkmanStatus('LOADED'); addToast({ type: 'tape', title: alreadyOwned ? 'Intel Inserida' : 'Intel Desbloqueada!', subtitle: intel.title, icon: '📼' }); }, 400);
      activityLogger.logAction(alreadyOwned ? 'tape_insert' : 'tape_unlock', `${alreadyOwned ? 'Inseriu' : 'Desbloqueou'}: ${intel.title}`, { tapeId: intel.id });
    } catch (err) { addToast({ type: 'error', title: 'Erro QR', subtitle: 'Tente dnv', icon: '⚠️' }); }
  }, [localStats, scanTimes, addToast]);

  const handleIntelSelect = useCallback((intel: IntelItem) => {
    if (!playerDataRef.current) return;
    if (intel.type === 'VISUAL' || intel.type === 'TEXT') {
      setActiveEvidence(intel);
      activityLogger.logAction(intel.type === 'VISUAL' ? 'pista_open' : 'evidence_open', `Abriu: ${intel.title}`, { intelId: intel.id });
    } else if (intel.type === 'AUDIO') {
      if (intel.id === currentIntel?.id) return;
      if (!hasPlayedCurrentTape.current && currentIntel) analyticsTracker.incrementStat('ejectWithoutPlay');
      hasPlayedCurrentTape.current = false;
      setWalkmanStatus('LOADING');
      timerRef.current = setTimeout(() => { setCurrentIntel(intel); setWalkmanStatus('LOADED'); }, 400);
      activityLogger.logAction('tape_select', `Selecionou: ${intel.title}`, { intelId: intel.id });
    }
  }, [currentIntel]);

  const handleCharacterSwitch = useCallback(() => {
    if (playerDataRef.current) activityLogger.logAction('character_switch', `Agente ${playerDataRef.current.character.codinome} desativado para troca`);
    analyticsTracker.stopAll(false); // Force sync before switching
    playerSyncService.stopAll();
    setPlayerData(null);
    setLocalStats(null);
    setIntelCollection(null);
    setScreen('characterSelection');
  }, []);

  const handleLogout = useCallback(async () => {
    if (playerDataRef.current) activityLogger.logAuth('logout', `${playerDataRef.current.character.codinome} saiu`);
    // Stop services BEFORE invalidating auth to avoid permission errors on final sync
    analyticsTracker.stopAll(true);
    playerSyncService.stopAll();
    await logout();
    setMasterAccount(undefined);
    setPlayerData(null);
    setCurrentIntel(null);
    setWalkmanStatus('IDLE');
    setScreen('login');
  }, []);

  const handleEject = useCallback(() => { 
    if (!hasPlayedCurrentTape.current && currentIntel) analyticsTracker.incrementStat('ejectWithoutPlay'); 
    setWalkmanStatus('IDLE'); setCurrentIntel(null); 
  }, [currentIntel]);

  const handleScanClick = useCallback(() => setWalkmanStatus('SCANNING'), []);
  const handleCancelScan = useCallback(() => setWalkmanStatus('IDLE'), []);
  
  const handleSetIsPlaying = useCallback((p: boolean) => setWalkmanStatus(p ? 'PLAYING' : 'LOADED'), []);
  const handleRewind = useCallback(() => { 
    setWalkmanStatus('REWINDING'); 
    if (timerRef.current) clearTimeout(timerRef.current); 
    timerRef.current = setTimeout(() => setWalkmanStatus('LOADED'), 1500); 
  }, []);

  const handleModeChange = useCallback((dir: 'up' | 'down') => {
    setDisplayMode(prev => {
      const modes: DisplayMode[] = ['default', 'title', 'chapter', 'type']; 
      return modes[(modes.indexOf(prev) + (dir === 'up' ? 1 : -1) + modes.length) % modes.length];
    });
  }, []);

  const handleProfileOpen = useCallback(() => setScreen('profile'), []);
  const handleTerminalOpen = useCallback(() => setScreen('bios'), []);
  const handleMacOpen = useCallback(() => setScreen('macos'), []);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => screen === 'player' && playerDataRef.current && setScreen('profile'),
    onSwipedRight: () => screen === 'profile' && playerDataRef.current && setScreen('player'),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  if (masterAccount === null) return (
    <RetroLoading fullScreen message="AUTENTICANDO..." subMessage="Validando credenciais de acesso" />
  );

  return (
    <div {...swipeHandlers} className="fixed inset-0 bg-surface flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none touch-none">
      <div className="noise-overlay" /><div className="scanlines" /><div className="vignette" />
      
      <AnimatePresence mode="wait">
        {screen === 'login' || !masterAccount ? (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center">
            <React.Suspense fallback={<RetroLoading message="CARREGANDO LOGIN..." />}>
              <LoginScreen onLogin={(acc) => { setMasterAccount(acc); setScreen('characterSelection'); }} />
            </React.Suspense>
          </motion.div>
        ) : (screen === 'characterSelection' && masterAccount) ? (
          <motion.div key="charSelect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center">
            <React.Suspense fallback={<RetroLoading message="LISTANDO AGENTES..." />}>
              <CharacterSelectionScreen account={masterAccount} onSelect={handleCharacterSelect} onLogout={handleLogout} />
            </React.Suspense>
          </motion.div>
        ) : playerData === null ? (
          <RetroLoading message="SINCRONIZANDO..." subMessage="Recuperando dossiê do agente" />
        ) : screen === 'profile' ? (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center">
            <React.Suspense fallback={<RetroLoading message="ACESSANDO PERFIL..." />}>
              <ProfileScreen profile={{ ...playerData, galleryImages }} onBack={() => setScreen('player')} onLogout={handleLogout} onChangeMission={() => setScreen('campaignSelection')} onChangeCharacter={handleCharacterSwitch} onUpdateSpotify={async (url) => { await firestoreUpdateSpotifyPlaylist(playerData.uid, playerData.activeCharacterId, url); setPlayerData({ ...playerData, character: { ...playerData.character, spotifyPlaylistUrl: url } }); }} />
            </React.Suspense>
          </motion.div>
        ) : screen === 'agentDossier' ? (
          <motion.div key="agentDossier" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center p-0 sm:p-4">
            <div className="w-full h-full max-w-[520px] rounded-none sm:rounded-[20px] shadow-[0_35px_100px_rgba(0,0,0,0.9)] border-0 sm:border-2 border-primary/20 relative flex flex-col mx-auto overflow-hidden bg-surface">
              <React.Suspense fallback={<RetroLoading message="ABRINDO DOSSIÊ..." />}>
                <AgentDossierOverlay onClose={() => setScreen('campaignSelection')} playerData={playerData} intel={intelCollection} />
              </React.Suspense>
            </div>
          </motion.div>
        ) : screen === 'campaignSelection' ? (
          <motion.div key="campaignSelection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center p-0 sm:p-4">
            <React.Suspense fallback={<RetroLoading message="SELECIONANDO MISSÃO..." />}>
              <CampaignSelection onSelect={async (c) => { await firestoreSetCampaign(playerData.uid, playerData.activeCharacterId, c.id); setPlayerData({ ...playerData, character: { ...playerData.character, campaignId: c.id } }); setScreen('player'); }} onLogout={handleLogout} onShowProfile={() => setScreen('agentDossier')} onChangeCharacter={handleCharacterSwitch} playerData={playerData} />
            </React.Suspense>
          </motion.div>
        ) : screen === 'player' ? (
          <motion.div key="player" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-sm h-full max-h-[750px] bg-surface-container-high rounded-[32px] border-8 border-[#1a1a1a] shadow-2xl flex flex-col p-3 sm:p-4 overflow-hidden z-10">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <CassetteVisor currentIntel={currentIntel} status={walkmanStatus} onEject={handleEject} onScanClick={handleScanClick} onCancelScan={handleCancelScan} onQrDetected={handleQrDetected} />
            <TapeLibrary intelItems={intelCollection?.items || EMPTY_ARRAY} currentIntelId={currentIntel?.id ?? null} isPlaying={isPlaying} displayMode={displayMode} onIntelSelect={handleIntelSelect} />
            <SideControls volume={volume} setVolume={setVolume} onModeChange={handleModeChange} onProfileOpen={handleProfileOpen} onCharacterSwitch={handleCharacterSwitch} />
            <BottomControls status={walkmanStatus} setIsPlaying={handleSetIsPlaying} hasTape={!!currentIntel} onRewind={handleRewind} hasTerminalAccess={playerData.hasTerminalAccess} onTerminalOpen={handleTerminalOpen} hasMacAccess={playerData.hasMacAccess} onMacOpen={handleMacOpen} />
          </motion.div>
        ) : (
          <motion.div key="apps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
            <React.Suspense fallback={<RetroLoading fullScreen message="INICIALIZANDO SISTEMA..." subMessage="Carregando interface de baixo nível" />}>
              {screen === 'bios' && <BiosTerminal uid={playerData.uid} username={playerData.character.codinome} onIpDetected={() => setScreen('limbo')} onClose={() => setScreen('player')} onAppLaunch={(app) => app === 'diskRepair' && setScreen('diskRepair')} onBootSystem={() => setScreen('windows95')} />}
              {screen === 'limbo' && <LimboBoard uid={playerData.uid} characterId={playerData.activeCharacterId} onClose={() => setScreen('player')} onBackToTerminal={() => setScreen('bios')} globalSeizedStatus={limboStatus.seized} readThreadIds={limboStatus.readThreadIds || []} />}
              {screen === 'diskRepair' && <DiskRepairApp uid={playerData.uid} characterId={playerData.activeCharacterId} onClose={() => setScreen('player')} onBackToTerminal={() => setScreen('bios')} />}
              {screen === 'macos' && <MacOsApp uid={playerData.uid} onClose={() => setScreen('player')} />}
              {screen === 'windows95' && <Windows95App uid={playerData.uid} onClose={() => setScreen('player')} />}
            </React.Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeEvidence && (
          <React.Suspense fallback={null}>
            <EvidenceReader evidence={activeEvidence} onClose={() => setActiveEvidence(null)} />
          </React.Suspense>
        )}
      </AnimatePresence>
      <ToastNotification toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
