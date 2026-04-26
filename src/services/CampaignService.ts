import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  DocumentData,
  QuerySnapshot,
  doc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campaign, campaigns as localFallbackCampaigns } from '../data/campaigns';

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
   * Inicializa o banco com dados locais se estiver vazio.
   */
  private async initializeIfEmpty(size: number) {
    if (size > 0 || localFallbackCampaigns.length === 0) return;
    
    console.log("[CampaignService] Banco vazio. Inicializando com dados locais...");
    try {
      const batch = writeBatch(db);
      localFallbackCampaigns.forEach(c => {
        batch.set(doc(db, this.collectionName, c.id), c);
      });
      await batch.commit();
    } catch (err) {
      console.warn("[CampaignService] Falha na auto-inicialização (provavelmente sem permissão de escrita):", err);
    }
  }

  /**
   * Subscreve para atualizações de campanhas ativas/bloqueadas.
   */
  public subscribeToActiveCampaigns(callback: (campaigns: Campaign[]) => void): () => void {
    console.log(`[CampaignService] Iniciando escuta na coleção: ${this.collectionName}`);
    
    const q = query(
      collection(db, this.collectionName), 
      where('status', 'in', ['Ativa', 'Bloqueada'])
    );

    return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      if (snap.empty) {
        console.log(`[CampaignService] Coleção vazia no Firestore. Usando fallback local.`);
        this.initializeIfEmpty(0); // Tenta inicializar em background
        callback(localFallbackCampaigns);
        return;
      }

      console.log(`[CampaignService] Recebidos ${snap.size} documentos do Firestore`);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Campaign));
      callback(list);
    }, (error) => {
      console.error("[CampaignService] Erro de acesso ao Firestore. Usando fallback local:", error.message);
      // Fallback para não travar o usuário
      callback(localFallbackCampaigns);
    });
  }
}

export const campaignService = CampaignService.getInstance();
