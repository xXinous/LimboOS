import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PlayerData } from '../../types/player';
import type { Campaign } from '../../data/campaigns';
import {
  firestoreUpdateSpotifyPlaylist,
  firestoreUpdatePhoneNumber,
  firestoreSetCampaign,
} from '../../store/firestore';

export function useProfileUpdates(
  playerData: PlayerData | null,
  setPlayerData: Dispatch<SetStateAction<PlayerData | null>>
) {
  const updateSpotify = useCallback(
    async (url: string) => {
      if (!playerData) return;
      await firestoreUpdateSpotifyPlaylist(playerData.uid, playerData.activeCharacterId, url);
      setPlayerData({
        ...playerData,
        character: { ...playerData.character, spotifyPlaylistUrl: url },
      });
    },
    [playerData, setPlayerData]
  );

  const updatePhone = useCallback(
    async (num: string) => {
      if (!playerData) return;
      await firestoreUpdatePhoneNumber(playerData.uid, playerData.activeCharacterId, num);
      setPlayerData({
        ...playerData,
        character: { ...playerData.character, phoneNumber: num },
      });
    },
    [playerData, setPlayerData]
  );

  const selectCampaign = useCallback(
    async (campaign: Campaign) => {
      if (!playerData) return;
      await firestoreSetCampaign(playerData.uid, playerData.activeCharacterId, campaign.id);
      setPlayerData({
        ...playerData,
        character: { ...playerData.character, campaignId: campaign.id },
      });
    },
    [playerData, setPlayerData]
  );

  return { updateSpotify, updatePhone, selectCampaign };
}
