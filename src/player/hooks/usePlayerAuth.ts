import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { activityLogger } from '../../services/ActivityLogger';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { playerSyncService } from '../../services/PlayerSyncService';
import { onAuthStateChanged, logout } from '../../store/profile';
import { loadMasterAccount, loadPlayerData } from '../../store/firestore';
import type {
  MasterAccount,
  CharacterData,
  PlayerData,
  PlayerStats,
  AppScreen,
  LimboGlobalState,
} from '../../types/player';
import type { PlayerIntelCollection } from '../../types/intel';
import type { Toast } from '../../components/ToastNotification';

const ADMIN_UID = '5TZK6YHmOOTe5padFPqCbXuavPu1';

export interface UsePlayerAuthOptions {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  onLogoutPlaybackReset: () => void;
}

export function usePlayerAuth(options: UsePlayerAuthOptions) {
  const { onLogoutPlaybackReset } = options;

  const [masterAccount, setMasterAccount] = useState<MasterAccount | null | undefined>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [localStats, setLocalStats] = useState<PlayerStats | null>(null);
  const [screen, setScreen] = useState<AppScreen>('login');
  const [limboStatus, setLimboStatus] = useState<LimboGlobalState>({ seized: false });
  const [intelCollection, setIntelCollection] = useState<PlayerIntelCollection | null>(null);

  const playerDataRef = useRef<PlayerData | null>(null);
  useEffect(() => {
    playerDataRef.current = playerData;
  }, [playerData]);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      try {
        if (user) {
          if (user.uid === ADMIN_UID) {
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

  const handleCharacterSelect = useCallback(
    async (char: CharacterData) => {
      if (!masterAccount) return;
      const data = await loadPlayerData(masterAccount.uid, char.id);
      setPlayerData(data);
      setLocalStats(data.stats);

      activityLogger.setUser(masterAccount.uid, data.character.codinome, data.activeCharacterId);
      activityLogger.logAction('character_select', `Agente ${data.character.codinome} ativado`);

      setScreen(data.character.campaignId ? 'player' : 'campaignSelection');
    },
    [masterAccount]
  );

  const handleCharacterSwitch = useCallback(() => {
    if (playerDataRef.current) {
      activityLogger.logAction(
        'character_switch',
        `Agente ${playerDataRef.current.character.codinome} desativado para troca`
      );
    }
    analyticsTracker.stopAll(false);
    playerSyncService.stopAll();
    setPlayerData(null);
    setLocalStats(null);
    setIntelCollection(null);
    setScreen('characterSelection');
  }, []);

  const handleLogout = useCallback(async () => {
    if (playerDataRef.current) {
      activityLogger.logAuth('logout', `${playerDataRef.current.character.codinome} saiu`);
    }
    analyticsTracker.stopAll(true);
    playerSyncService.stopAll();

    setPlayerData(null);
    setMasterAccount(undefined);
    onLogoutPlaybackReset();
    setScreen('login');

    await logout();
  }, [onLogoutPlaybackReset]);

  return {
    masterAccount,
    setMasterAccount,
    playerData,
    setPlayerData,
    localStats,
    setLocalStats,
    screen,
    setScreen,
    limboStatus,
    setLimboStatus,
    intelCollection,
    setIntelCollection,
    playerDataRef,
    handleCharacterSelect,
    handleCharacterSwitch,
    handleLogout,
  };
}

export type PlayerAuthState = ReturnType<typeof usePlayerAuth>;

export function usePlayerAuthLoginHandler(
  setMasterAccount: Dispatch<SetStateAction<MasterAccount | null | undefined>>,
  setScreen: Dispatch<SetStateAction<AppScreen>>
) {
  return useCallback(
    (acc: MasterAccount) => {
      setMasterAccount(acc);
      setScreen('characterSelection');
    },
    [setMasterAccount, setScreen]
  );
}
