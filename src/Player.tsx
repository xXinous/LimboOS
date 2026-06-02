import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
const NokiaPlayer = React.lazy(() => import('./components/player/NokiaPlayer'));
import { Campaign } from './data/campaigns';
import { campaignService } from './services/CampaignService';
import { audioEngine } from './services/AudioEngine';
import { analyticsTracker } from './services/AnalyticsTracker';
import { activityLogger } from './services/ActivityLogger';
import { firebaseAnalytics } from './services/FirebaseAnalyticsService';
import { intelService } from './services/IntelService';
import { PlayerSyncService, playerSyncService } from './services/PlayerSyncService';
import { IntelManager, IntelBase, AudioIntel, VisualIntel, TextIntel, MetaIntel, IntelFactory } from './services/IntelEngine';
import { onAuthStateChanged, logout } from './store/profile';
import type { MasterAccount, CharacterData, PlayerData, PlayerStats, LimboGlobalState, GalleryImage } from './types/player';
import { 
  loadMasterAccount,
  loadPlayerData, 
  firestoreUpdateSpotifyPlaylist,
  firestoreUpdatePhoneNumber,
  firestoreSetCampaign
} from './store/firestore';
import type { IntelItem, PlayerIntelCollection } from './types/intel';
import type { AppScreen, WalkmanStatus, DisplayMode } from './types/player';

const EMPTY_ARRAY: any[] = [];

interface NokiaDeviceWrapperProps {
  children: React.ReactNode;
  status: WalkmanStatus;
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  backVisible?: boolean;
  onProfileOpen?: () => void;
}

function NokiaDeviceWrapper({
  children,
  status,
  volume,
  isMuted,
  onToggleMute,
  onBack,
  screen,
  setScreen,
  backVisible,
  onProfileOpen,
}: NokiaDeviceWrapperProps) {
  const [systemTime, setSystemTime] = useState('12:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const isScanning = status === 'SCANNING';
  const signalBarsCount = Math.ceil((volume / 100) * 5);

  return (
    <div className="absolute inset-0 w-full h-full bg-[#edfeed] p-2 sm:p-4 z-50 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full bg-[#edfeed] rounded-xl border-[4px] border-[#111e14] relative shadow-[inset_0_4px_16px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col max-w-4xl mx-auto">
        {/* Inner Screen with Nokia LCD effects (CSS pseudo-elements) */}
        <div
          id="nokia-lcd-screen-inner"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className="w-full h-full bg-[#edfeed] text-[#111e14] flex flex-col justify-between overflow-hidden relative select-none nokia-theme-active"
        >
          {/* 1px Inner Screen Bezel Border */}
          <div className="absolute inset-0 border border-[#111e14]/15 pointer-events-none z-20" />

          {/* ─── STATUS BAR ─── */}
          {!isScanning && (
            <div className="flex justify-between items-center bg-[#edfeed] px-2 border-b border-[#111e14] py-1 text-[12px] font-bold h-[24px] select-none z-10 leading-none shrink-0">
              {/* Signal HP indicator */}
              <div className="flex items-end gap-[1px] h-[10px]" title="Signal">
                <span className="text-[10px] leading-none pr-[2px] font-black">HP</span>
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`w-[2px] ${signalBarsCount >= level ? 'bg-[#111e14]' : 'bg-[#111e14]/10'}`}
                    style={{ height: `${level * 2 + 2}px` }}
                  />
                ))}
              </div>

              {/* Center Clock */}
              <span className="tracking-wide text-[12px] tabular-nums">{systemTime}</span>

              {/* Battery MP indicator */}
              <div className="flex items-center gap-[2px]">
                <span className="text-[10px] pr-[2px] font-black">MP</span>
                <div className="flex items-center border border-[#111e14] p-[1px] rounded-[1px] w-[18px] h-[10px]">
                  <div className="bg-[#111e14] h-full w-[75%]" />
                </div>
                <div className="w-[1px] h-[4px] bg-[#111e14] -ml-[1px]" />
              </div>
            </div>
          )}

          {/* ─── MAIN CONTENT VIEWPORT ─── */}
          <div className="flex-grow overflow-y-auto relative p-2 flex flex-col min-h-0 custom-nokia-scrollbar">
            {children}
          </div>

          {/* ─── BOTTOM TOUCH NAVIGATION BAR ─── */}
          {!isScanning && (
            <div className="flex justify-around items-center bg-[#edfeed] border-t-2 border-[#111e14] py-2 text-[12px] font-bold z-20 h-[44px] select-none text-[#111e14] shrink-0">
              {backVisible !== false ? (
                <button
                  onClick={onBack}
                  className="px-4 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="text-[10px] font-black">&lt;-</span> <span className="text-[10px] tracking-tight uppercase">Voltar</span>
                </button>
              ) : (
                <div className="px-4 py-1.5 opacity-0 pointer-events-none flex items-center gap-1.5">
                  <span className="text-[10px] font-black">&lt;-</span> <span className="text-[10px] tracking-tight uppercase">Voltar</span>
                </div>
              )}

              <button
                onClick={() => setScreen('player')}
                disabled={screen === 'player'}
                className={`px-4 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1.5 ${
                  screen === 'player' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span className="text-[10px] font-black">[*]</span> <span className="text-[10px] tracking-tight uppercase">Inicio</span>
              </button>

              <button
                onClick={onToggleMute}
                className="px-3 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span className="text-[10px] font-black">{isMuted ? '[X]' : '[~]'}</span>
                <span className="text-[10px] tracking-tight uppercase">{isMuted ? 'Mudo' : 'Som'}</span>
              </button>

              {onProfileOpen && (
                <button
                  onClick={onProfileOpen}
                  className="px-3 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span className="text-[10px] font-black">[#]</span>
                  <span className="text-[10px] tracking-tight uppercase">Dossie</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Player() {
  const [masterAccount, setMasterAccount] = useState<MasterAccount | null | undefined>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [localStats, setLocalStats] = useState<PlayerStats | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');
  const previousScreenRef = useRef<AppScreen | null>(null);
  const [nokiaBackVisible, setNokiaBackVisible] = useState(true);
  
  // Unified Intel Collection State
  const [intelCollection, setIntelCollection] = useState<PlayerIntelCollection | null>(null);
  
  // OOP Intel Manager Engine
  const intelManager = useMemo(() => {
    if (!intelCollection?.items) return null;
    return new IntelManager(intelCollection.items);
  }, [intelCollection]);

  // State Machine: Centralized status
  const [walkmanStatus, setWalkmanStatus] = useState<WalkmanStatus>('IDLE');
  const [currentIntel, setCurrentIntel] = useState<IntelBase | null>(null);
  const [volume, setVolume] = useState(80);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scanTimes, setScanTimes] = useState<number[]>([]);
  const [limboStatus, setLimboStatus] = useState<LimboGlobalState>({ seized: false });
  const [activeEvidence, setActiveEvidence] = useState<IntelBase | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  
  const hasPlayedCurrentTape = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isInitialIntelLoad = useRef(true);
  
  // Estabiliza o playerData para callbacks sem quebrar o memo
  const playerDataRef = useRef<PlayerData | null>(null);
  useEffect(() => {
    playerDataRef.current = playerData;
  }, [playerData]);

  // Sincroniza campanha ativa do jogador
  useEffect(() => {
    if (!playerData?.character?.campaignId) {
      setActiveCampaign(null);
      return;
    }
    return campaignService.subscribeToActiveCampaigns((list) => {
      const found = list.find(c => c.id === playerData.character.campaignId);
      if (found) {
        setActiveCampaign(found);
      }
    });
  }, [playerData?.character?.campaignId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  
  // Derived states
  const isPlaying = walkmanStatus === 'PLAYING';

  // ─── Firebase Analytics: Screen View Tracking ───
  useEffect(() => {
    firebaseAnalytics.init().then(() => {
      firebaseAnalytics.logScreenView(screen, previousScreenRef.current || undefined);
      previousScreenRef.current = screen;
    });
  }, [screen]);

  // --- Auth & Initial Load ---
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      try {
        if (user) {
          if (user.uid === '5TZK6YHmOOTe5padFPqCbXuavPu1') {
            window.location.href = '/admin';
            return;
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
      throw err;
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
      analyticsTracker.stopAll(true);
      playerSyncService.stopAll();
    };
  }, [playerData?.activeCharacterId]);

const intelIdsKey = playerData?.unlockedIntelIds?.join(',') ?? '';

// Unified Intel Fetching (Adding debug logs and loading state management)
useEffect(() => {
  if (!playerData) return;
  const fetchIntel = async () => {
    if (isInitialIntelLoad.current) {
      setWalkmanStatus('LOADING'); // Indicate background work only on first load
    }
    try {
      const collection = await intelService.getCollection(playerData);
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
}, [intelIdsKey]);

  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);



  // Audio Engine interactions
  useEffect(() => {
    audioEngine.setOnEnded(() => { setWalkmanStatus('LOADED'); analyticsTracker.endPlayback(); });
  }, []);

  useEffect(() => {
    if (currentIntel instanceof AudioIntel && currentIntel.mediaUrl) {
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
      if (currentIntel) analyticsTracker.startPlayback(currentIntel as any); // Cast for legacy analytics
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
    if (!currentPD || !localStats) return addToast({ type: 'error', title: 'Aguarde', subtitle: 'Perfil carregando...', icon: '[..]' });
    setWalkmanStatus('IDLE');
    
    try {
      const rawIntel = await intelService.resolve(code);
      if (!rawIntel) {
        firebaseAnalytics.logQrScan('fail');
        return addToast({ type: 'error', title: 'Código Desconhecido', subtitle: code, icon: '[X]' });
      }
      
      const intel = IntelFactory.getInstance().create(rawIntel);
      const { alreadyOwned, updatedIds } = await intelService.unlock(currentPD, intel.id);
      
      // Firebase Analytics: QR scan result
      firebaseAnalytics.logQrScan(alreadyOwned ? 'duplicate' : 'success');
      
      const now = Date.now();
      const recentScans = [...scanTimes.filter(t => now - t < 300000), now];
      setScanTimes(recentScans);
      analyticsTracker.checkAchievements(recentScans);
      setPlayerData({ ...currentPD, unlockedIntelIds: updatedIds });
      
      hasPlayedCurrentTape.current = false;
      setWalkmanStatus('LOADING');
      timerRef.current = setTimeout(() => { 
        setCurrentIntel(intel); 
        setWalkmanStatus('LOADED'); 
        addToast({ type: 'tape', title: alreadyOwned ? 'Intel Inserida' : 'Intel Desbloqueada!', subtitle: intel.title, icon: '[=]' }); 
      }, 400);
      activityLogger.logAction(alreadyOwned ? 'tape_insert' : 'tape_unlock', `${alreadyOwned ? 'Inseriu' : 'Desbloqueou'}: ${intel.title}`, { tapeId: intel.id });
    } catch (err) { addToast({ type: 'error', title: 'Erro QR', subtitle: 'Tente dnv', icon: '[!]' }); }
  }, [localStats, scanTimes, addToast]);

  const handleIntelSelect = useCallback((intel: IntelBase) => {
    if (!playerDataRef.current) return;
    if (intel instanceof VisualIntel || intel instanceof TextIntel || intel instanceof MetaIntel) {
      setActiveEvidence(intel);
      activityLogger.logAction(intel.type === 'VISUAL' ? 'pista_open' : 'evidence_open', `Abriu: ${intel.title}`, { intelId: intel.id });
      // Firebase Analytics: evidence engagement
      firebaseAnalytics.logEvidenceViewed(intel.id, intel.type);
    } else if (intel instanceof AudioIntel) {
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
    
    // Clear states first to unmount components and unsubscribe from listeners
    setPlayerData(null);
    setMasterAccount(undefined);
    setCurrentIntel(null);
    setWalkmanStatus('IDLE');
    setScreen('login');
    
    // Now safely log out of Firebase auth
    await logout();
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
      const currentIndex = modes.indexOf(prev);
      const nextIndex = (currentIndex + (dir === 'up' ? 1 : -1) + modes.length) % modes.length;
      return modes[nextIndex] ?? 'default';
    });
  }, []);

  const handleProfileOpen = useCallback(() => setScreen('profile'), []);
  const handleTerminalOpen = useCallback(() => setScreen('bios'), []);
  const handleMacOpen = useCallback(() => setScreen('macos'), []);

  // Nokia Theme States and Helpers
  const [isMuted, setIsMuted] = useState(false);
  const [preMuteVolume, setPreMuteVolume] = useState(80);
  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(preMuteVolume);
      setIsMuted(false);
    } else {
      setPreMuteVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, preMuteVolume]);

  const nokiaBackHandlerRef = useRef<(() => boolean) | null>(null);
  const registerNokiaBackHandler = useCallback((handler: (() => boolean) | null) => {
    nokiaBackHandlerRef.current = handler;
  }, []);

  const handleNokiaBack = useCallback(() => {
    if (nokiaBackHandlerRef.current) {
      const handled = nokiaBackHandlerRef.current();
      if (handled) return;
    }
    if (screen !== 'player') {
      setScreen('player');
    }
  }, [screen]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => screen === 'player' && playerDataRef.current && setScreen('profile'),
    onSwipedRight: () => screen === 'profile' && playerDataRef.current && setScreen('player'),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const visualGalleryImages = useMemo(() => {
    return intelManager?.getAll()
      .filter((i): i is VisualIntel => i.type === 'VISUAL')
      .map(i => ({
        id: i.id,
        title: i.title,
        description: i.description || '',
        imageUrl: i.mediaUrl,
        category: 'pistas',
        level: i.level || 1
      } as GalleryImage)) || [];
  }, [intelManager]);

  const isNokiaTheme = playerData !== null && activeCampaign?.playerType === 'nokia';
  const showNokiaShell = isNokiaTheme && (screen === 'player' || screen === 'profile');

  if (masterAccount === null) return (
    <RetroLoading fullScreen message="AUTENTICANDO..." subMessage="Validando credenciais de acesso" />
  );

  return (
    <div
      onMouseDown={swipeHandlers.onMouseDown}
      ref={swipeHandlers.ref}
      className="fixed inset-0 bg-surface flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none touch-none"
    >
      <div className="noise-overlay" /><div className="scanlines" /><div className="vignette" />
      
      {showNokiaShell ? (
        <NokiaDeviceWrapper
          status={walkmanStatus}
          volume={volume}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onBack={handleNokiaBack}
          screen={screen}
          setScreen={setScreen}
          backVisible={screen === 'player' ? nokiaBackVisible : true}
          onProfileOpen={handleProfileOpen}
        >
          <AnimatePresence mode="wait">
            {screen === 'player' && (
              <motion.div key="nokiaPlayer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col flex-grow min-h-0">
                <React.Suspense fallback={<RetroLoading message="CARREGANDO NOKIA..." />}>
                  <NokiaPlayer
                    currentIntel={currentIntel}
                    status={walkmanStatus}
                    isPlaying={isPlaying}
                    setIsPlaying={handleSetIsPlaying}
                    volume={volume}
                    setVolume={setVolume}
                    intelItems={intelManager?.getAll() || EMPTY_ARRAY}
                    currentIntelId={currentIntel?.id ?? null}
                    onIntelSelect={handleIntelSelect}
                    onRewind={handleRewind}
                    onEject={handleEject}
                    onScanClick={handleScanClick}
                    onCancelScan={handleCancelScan}
                    onQrDetected={handleQrDetected}
                    hasTerminalAccess={playerData.hasTerminalAccess}
                    onTerminalOpen={handleTerminalOpen}
                    hasMacAccess={playerData.hasMacAccess}
                    onMacOpen={handleMacOpen}
                    onProfileOpen={handleProfileOpen}
                    onCharacterSwitch={handleCharacterSwitch}
                    registerBackHandler={registerNokiaBackHandler}
                    setBackVisible={setNokiaBackVisible}
                    activeCharacter={playerData.character}
                    uid={playerData.uid}
                    onUpdatePhoneNumber={async (num) => {
                      await firestoreUpdatePhoneNumber(playerData.uid, playerData.activeCharacterId, num);
                      setPlayerData({ ...playerData, character: { ...playerData.character, phoneNumber: num } });
                    }}
                  />
                </React.Suspense>
              </motion.div>
            )}
            {screen === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col flex-grow min-h-0">
                <React.Suspense fallback={<RetroLoading message="ACESSANDO PERFIL..." />}>
                  <ProfileScreen
                    profile={playerData}
                    galleryImages={visualGalleryImages}
                    onBack={() => setScreen('player')}
                    onLogout={handleLogout}
                    onChangeMission={() => setScreen('campaignSelection')}
                    onChangeCharacter={handleCharacterSwitch}
                    onUpdateSpotify={async (url) => {
                      await firestoreUpdateSpotifyPlaylist(playerData.uid, playerData.activeCharacterId, url);
                      setPlayerData({ ...playerData, character: { ...playerData.character, spotifyPlaylistUrl: url } });
                    }}
                    onUpdatePhoneNumber={async (num) => {
                      await firestoreUpdatePhoneNumber(playerData.uid, playerData.activeCharacterId, num);
                      setPlayerData({ ...playerData, character: { ...playerData.character, phoneNumber: num } });
                    }}
                    variant="nokia"
                  />
                </React.Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </NokiaDeviceWrapper>
      ) : (
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
                <ProfileScreen 
                  profile={playerData} 
                  galleryImages={visualGalleryImages} 
                  onBack={() => setScreen('player')} 
                  onLogout={handleLogout} 
                  onChangeMission={() => setScreen('campaignSelection')} 
                  onChangeCharacter={handleCharacterSwitch} 
                  onUpdateSpotify={async (url) => { 
                    await firestoreUpdateSpotifyPlaylist(playerData.uid, playerData.activeCharacterId, url); 
                    setPlayerData({ ...playerData, character: { ...playerData.character, spotifyPlaylistUrl: url } }); 
                  }} 
                  onUpdatePhoneNumber={async (num) => {
                    await firestoreUpdatePhoneNumber(playerData.uid, playerData.activeCharacterId, num);
                    setPlayerData({ ...playerData, character: { ...playerData.character, phoneNumber: num } });
                  }}
                />
              </React.Suspense>
            </motion.div>
          ) : screen === 'agentDossier' ? (
            <motion.div key="agentDossier" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center p-0 sm:p-4">
              <div className="w-full h-full max-w-[520px] rounded-none sm:rounded-[20px] shadow-[0_35px_100px_rgba(0,0,0,0.9)] border-0 sm:border-2 border-primary/20 relative flex flex-col mx-auto overflow-hidden bg-surface">
                <React.Suspense fallback={<RetroLoading message="ABRINDO DOSSIÊ..." />}>
                  <AgentDossierOverlay onClose={() => setScreen('campaignSelection')} playerData={playerData} intelManager={intelManager} />
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
              <TapeLibrary intelItems={intelManager?.getAll() || EMPTY_ARRAY} currentIntelId={currentIntel?.id ?? null} isPlaying={isPlaying} displayMode={displayMode} onIntelSelect={handleIntelSelect} />
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
      )}

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
