import { useState, useEffect, useMemo } from 'react';
import { campaignService } from '../../services/CampaignService';
import type { Campaign } from '../../data/campaigns';
import type { PlayerData } from '../../types/player';

export function useActiveCampaign(playerData: PlayerData | null) {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!playerData?.character?.campaignId) {
      setActiveCampaign(null);
      return;
    }
    return campaignService.subscribeToActiveCampaigns((list) => {
      const found = list.find((c) => c.id === playerData.character.campaignId);
      if (found) {
        setActiveCampaign(found);
      }
    });
  }, [playerData?.character?.campaignId]);

  const isNokiaTheme = playerData !== null && activeCampaign?.playerType === 'nokia';

  return { activeCampaign, isNokiaTheme };
}

export function useShowNokiaShell(isNokiaTheme: boolean, screen: string) {
  return useMemo(
    () => isNokiaTheme && (screen === 'player' || screen === 'profile'),
    [isNokiaTheme, screen]
  );
}
