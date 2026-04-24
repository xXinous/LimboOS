import { Timestamp } from 'firebase/firestore';

// --- UI & App State Types ---
export type AppScreen = 'login' | 'player' | 'profile' | 'bios' | 'limbo' | 'diskRepair' | 'macos' | 'windows95' | 'campaignSelection';
export type TapeState = 'empty' | 'loaded' | 'scanning';
export type WalkmanStatus = 'IDLE' | 'LOADING' | 'LOADED' | 'PLAYING' | 'REWINDING' | 'SCANNING';
export type DisplayMode = 'default' | 'title' | 'chapter' | 'type';

// --- Database Models ---

export interface PlayerStats {
  totalListenTime: number;
  screwClicks: number;
  fidgetClicks: number;
  ejectWithoutPlay: number;
  maxVolumeTime: number;
  zeroVolumeTime: number;
}

export interface UserData {
  uid: string;
  username: string;
  displayName?: string;
  email: string;
  role: 'player' | 'admin';
  createdAt: Timestamp | null;
  lastLogin?: Timestamp | null;
  campaignId?: string;
  
  // Game Flags
  achievementsRevealed?: boolean;
  forceTerminalOpen?: boolean;
  hasTerminalAccess?: boolean;
  forceMacOpen?: boolean;
  hasMacAccess?: boolean;
  spotifyPlaylistUrl?: string;
}

export interface TapeData {
  tapeId: string;
  unlockedAt: Timestamp;
}

export interface AchievementData {
  achievementId: string;
  unlockedAt: Timestamp;
}

export interface PlayerData extends UserData {
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
  createdAt?: Timestamp;
  createdBy?: string;
}

export interface QrRedirect {
  sourceId: string;
  targetId: string;
  reason: string;
  updatedAt?: Timestamp;
}
