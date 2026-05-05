import { Timestamp } from 'firebase/firestore';

// --- UI & App State Types ---
export type AppScreen = 'login' | 'characterSelection' | 'player' | 'profile' | 'bios' | 'limbo' | 'diskRepair' | 'macos' | 'windows95' | 'campaignSelection' | 'agentDossier';
export type TapeState = 'empty' | 'loaded' | 'scanning';
export type WalkmanStatus = 'IDLE' | 'LOADING' | 'LOADED' | 'PLAYING' | 'REWINDING' | 'SCANNING';
export type DisplayMode = 'default' | 'title' | 'chapter' | 'type';

// --- Database Models: Master Account ---

export interface MasterAccount {
  uid: string;
  email: string;
  masterName?: string;
  role: 'player' | 'admin';
  createdAt: Timestamp | null;
  lastLogin?: Timestamp | null;
  
  // Account-level flags
  hasTerminalAccess?: boolean;
  hasMacAccess?: boolean;
}

// --- Database Models: Character (Agent) ---

export interface CharacterData {
  id: string;
  codinome: string;
  agentStatus: 'vivo' | 'morto' | 'desaparecido';
  dangerLevel: number; // 1-5
  profilePhotoUrl?: string;
  campaignId?: string;
  createdAt: Timestamp;
  
  // Character-specific game flags
  achievementsRevealed?: boolean;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
  spotifyPlaylistUrl?: string;
  agentId?: string; // Generated RM-XXXX ID
}

export interface PlayerStats {
  totalListenTime: number;
  screwClicks: number;
  fidgetClicks: number;
  ejectWithoutPlay: number;
  maxVolumeTime: number;
  zeroVolumeTime: number;
}

/**
 * PlayerData represents the active session: Account + Active Character + Progress.
 */
export interface PlayerData extends MasterAccount {
  activeCharacterId: string;
  character: CharacterData;
  unlockedTapeIds: string[];
  achievementIds: string[];
  unlockedGalleryIds: string[];
  stats: PlayerStats;
}

// --- System States ---

export interface LimboGlobalState {
  seized: boolean;
  seizedBy?: string | null;
  seizedAt?: Timestamp | null;
  readThreadIds?: string[];
}

export interface GameEventsState {
  diskRepairAllowed: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  playerUids: string[];
  campaignId?: string;
  sessions: string[]; // Lista de datas das sessões
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Gallery & Redirects ---

export type GalleryCategory = 'locais' | 'pistas' | 'pessoas' | 'itens';

export interface GalleryImage {
  id: string;
  category: GalleryCategory;
  title: string;
  description: string;
  imageUrl: string;
  level?: number;
  createdAt?: Timestamp;
  createdBy?: string;
}

export interface QrRedirect {
  sourceId: string;
  targetId: string;
  reason: string;
  updatedAt?: Timestamp;
}

// --- Admin legacy user document shape ---
export interface UserData extends MasterAccount {
  displayName?: string;
  username?: string;
  campaignId?: string;
}
