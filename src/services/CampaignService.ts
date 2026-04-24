import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campaign } from '../data/campaigns';

/**
 * CampaignService - Gerencia a lógica de negócios e persistência de missões.
 * Implementa o padrão Singleton para garantir uma única fonte de verdade.
 */
class CampaignService {
  private static instance: CampaignService;
  private readonly collectionName = 'campaigns';

  private constructor() {}

  public static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  /**
   * Subscreve para atualizações de campanhas ativas/bloqueadas.
   */
  public subscribeToActiveCampaigns(callback: (campaigns: Campaign[]) => void): () => void {
    const q = query(
      collection(db, this.collectionName), 
      where('status', 'in', ['Ativa', 'Bloqueada'])
    );

    return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Campaign));
      callback(list);
    }, (error) => {
      console.error("[CampaignService] Subscription error:", error);
      callback([]);
    });
  }
}

export const campaignService = CampaignService.getInstance();
