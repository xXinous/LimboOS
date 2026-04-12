import type { Tape } from '../data/tapes';
import type { PlayerData } from '../store/firestore';
import { getTapeByCode } from '../data/tapes';
import { fetchAudioTapeById, resolveAllTapesAsync, firestoreUnlockTape, fetchQrRedirect } from '../store/firestore';

export class TapeManager {
  private static instance: TapeManager;

  private constructor() {}

  public static getInstance(): TapeManager {
    if (!TapeManager.instance) {
      TapeManager.instance = new TapeManager();
    }
    return TapeManager.instance;
  }

  /**
   * Resolves a tape configuration from a local static database or remote Firestore.
   */
  public async resolveTape(code: string): Promise<Tape | null> {
    const redirectedId = await fetchQrRedirect(code);
    const finalCode = redirectedId || code;

    let tape = getTapeByCode(finalCode);
    if (!tape) {
      tape = await fetchAudioTapeById(finalCode);
    }
    return tape;
  }

  /**
   * Unlocks a tape in Firestore.
   */
  public async unlockTape(playerData: PlayerData, tapeId: string): Promise<{
    alreadyOwned: boolean;
    updatedTapeIds: string[];
  }> {
    const alreadyOwned = playerData.unlockedTapeIds.includes(tapeId);
    
    // Save to server
    await firestoreUnlockTape(playerData.uid, tapeId);

    // Compute updated array
    const updatedTapeIds = alreadyOwned
      ? playerData.unlockedTapeIds
      : [...playerData.unlockedTapeIds, tapeId];

    return { alreadyOwned, updatedTapeIds };
  }

  /**
   * Resolves completely all the tapes owned by a player by their IDs.
   */
  public async getOwnedTapes(unlockedTapeIds: string[]): Promise<Tape[]> {
    return resolveAllTapesAsync(unlockedTapeIds);
  }
}

export const tapeManager = TapeManager.getInstance();
