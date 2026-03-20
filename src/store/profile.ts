// localStorage-based player profile system.
// Each profile is stored under key: "runningman:profile:<id>"
// The session (current logged-in profile) is NOT persisted — users log in each time.

export interface PlayerProfile {
  id: string;
  username: string;
  passwordHash: string;
  unlockedTapeIds: string[];
  achievementIds: string[];
  listenSeconds: number;
  createdAt: string;
}

const STORAGE_PREFIX = 'runningman:profile:';

/** Very simple deterministic hash — NOT cryptographic. Just for local profile separation. */
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

function profileKey(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

/** Generate a stable profile ID from username (so same username = same slot). */
function usernameToId(username: string): string {
  return simpleHash(username.toLowerCase().trim());
}

export function loginOrCreate(username: string, password: string): PlayerProfile | 'wrong_password' {
  const id = usernameToId(username);
  const key = profileKey(id);
  const stored = localStorage.getItem(key);

  if (stored) {
    const profile: PlayerProfile = JSON.parse(stored);
    const hash = simpleHash(password);
    if (profile.passwordHash !== hash) return 'wrong_password';
    return profile;
  }

  // New player — create profile
  const newProfile: PlayerProfile = {
    id,
    username: username.trim(),
    passwordHash: simpleHash(password),
    unlockedTapeIds: [],
    achievementIds: [],
    listenSeconds: 0,
    createdAt: new Date().toISOString(),
  };
  saveProfile(newProfile);
  return newProfile;
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(profileKey(profile.id), JSON.stringify(profile));
}

export function loadProfile(id: string): PlayerProfile | null {
  const stored = localStorage.getItem(profileKey(id));
  return stored ? JSON.parse(stored) : null;
}

/** Unlock a tape for a profile (idempotent). Returns updated profile. */
export function unlockTape(profile: PlayerProfile, tapeId: string): PlayerProfile {
  if (profile.unlockedTapeIds.includes(tapeId)) return profile;
  const updated: PlayerProfile = {
    ...profile,
    unlockedTapeIds: [...profile.unlockedTapeIds, tapeId],
  };
  saveProfile(updated);
  return updated;
}

/** Add achievement IDs to profile. Returns updated profile. */
export function grantAchievements(profile: PlayerProfile, achievementIds: string[]): PlayerProfile {
  const merged = Array.from(new Set([...profile.achievementIds, ...achievementIds]));
  const updated: PlayerProfile = { ...profile, achievementIds: merged };
  saveProfile(updated);
  return updated;
}

/** Update listen time. Returns updated profile. */
export function addListenSeconds(profile: PlayerProfile, seconds: number): PlayerProfile {
  const updated: PlayerProfile = { ...profile, listenSeconds: profile.listenSeconds + seconds };
  saveProfile(updated);
  return updated;
}
