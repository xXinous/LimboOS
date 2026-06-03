import type { IntelItem, PlayerIntelCollection, IntelType, AccessLevel } from '../types/intel';
import type { PlayerData } from '../types/player';
import type { GalleryImage } from '../types/player';
import { intelRegistry } from '../data/intel_registry';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  fetchAudioTapeById, 
  fetchAudioTapesByIds,
  fetchAllMediaAssets,
  fetchQrRedirect, 
  firestoreUnlockIntel,
  firestoreGrantAchievements,
  updateRemoteIntel,
} from '../store/firestore';

/**
 * IntelService — Serviço unificado para gerenciar todas as operações 
 * do sistema de colecionáveis/Intel.
 *
 * Substitui: TapeManager (resolução + unlock) + lógica espalhada de gallery + conversões ad-hoc.
 */
class IntelService {
  private static instance: IntelService;

  private constructor() {}

  public static getInstance(): IntelService {
    if (!IntelService.instance) {
      IntelService.instance = new IntelService();
    }
    return IntelService.instance;
  }

  // --- Sincronização ---

  private registerMediaAssetAsIntel(raw: Record<string, any>): IntelItem | null {
    if (raw.type === 'audio') {
      return intelRegistry.registerRemoteAudio({
        id: raw.id,
        title: raw.metadata?.title || raw.filename,
        artist: raw.metadata?.artist,
        npc: raw.metadata?.npc,
        chapter: raw.metadata?.chapter,
        description: raw.metadata?.description,
        url: raw.url,
        duration: raw.metadata?.duration,
        isSecret: raw.metadata?.isSecret,
        level: raw.metadata?.level || 1,
        campaignId: raw.campaignId,
      });
    } else if (raw.type === 'image' || raw.type === 'video') {
      return intelRegistry.registerGalleryImage({
        id: raw.id,
        title: raw.metadata?.title || raw.filename,
        description: raw.metadata?.description || '',
        imageUrl: raw.url,
        category: raw.metadata?.category || 'pistas',
        level: raw.metadata?.level || 1,
        campaignId: raw.campaignId,
      } as any);
    } else if (raw.type === 'text' || raw.type === 'document') {
      const intel: IntelItem = {
        id: raw.id,
        campaignId: raw.campaignId,
        type: 'TEXT',
        level: (raw.metadata?.level || 1) as AccessLevel,
        title: raw.metadata?.title || raw.filename || '',
        description: raw.metadata?.description || raw.description || '',
        textContent: raw.textContent || raw.metadata?.textContent || '',
        metadata: {
          npc: raw.metadata?.npc || '',
          artist: raw.metadata?.artist || '',
          chapter: raw.metadata?.chapter || '',
          hint: raw.metadata?.hint || '',
        }
      };
      intelRegistry.register(intel);
      return intel;
    } else if (raw.type === 'meta' || raw.type === 'achievement') {
      const intel: IntelItem = {
        id: raw.id,
        campaignId: raw.campaignId,
        type: 'META',
        level: (raw.metadata?.level || 1) as AccessLevel,
        title: raw.metadata?.title || raw.filename || '',
        description: raw.metadata?.description || raw.description || '',
        metadata: {
          npc: raw.metadata?.npc || '',
          artist: raw.metadata?.artist || '',
          chapter: raw.metadata?.chapter || '',
          icon: raw.metadata?.icon || '',
          hint: raw.metadata?.hint || '',
          unlockCondition: raw.metadata?.unlockCondition || '',
          achievementRuleId: raw.metadata?.achievementRuleId || '',
        }
      };
      intelRegistry.register(intel);
      return intel;
    }
    return null;
  }

  /**
   * Sincroniza o registro local com o Firebase.
   * Útil para o painel administrativo ver todos os itens remotos.
   */
  public async syncRegistryWithFirebase(): Promise<void> {
    const media = await fetchAllMediaAssets();

    media.forEach(m => {
      this.registerMediaAssetAsIntel(m);
    });
  }

  public subscribeToIntelRegistry(onUpdate: (items: IntelItem[]) => void): () => void {
    const unsubMedia = onSnapshot(collection(db, 'mediaAssets'), (snapshot) => {
      snapshot.forEach((doc) => {
        this.registerMediaAssetAsIntel({ id: doc.id, ...doc.data() });
      });
      onUpdate(intelRegistry.getAll());
    }, (err) => console.warn('[IntelService] subscribeToMediaAssets error:', err));

    return () => {
      unsubMedia();
    };
  }

  /**
   * Persiste as alterações de um IntelItem tanto localmente quanto no Firebase.
   */
  public async persistChanges(item: IntelItem): Promise<void> {
    // 1. Atualiza no registro em memória
    intelRegistry.register(item);

    // 2. Persiste no Firebase (se for item remoto)
    await updateRemoteIntel(item);
  }

  // --- Resolução ---

  /**
   * Resolve um código QR/ID para um IntelItem.
   * 1. Verifica redirecionamentos QR
   * 2. Busca no registro local
   * 3. Tenta buscar do Firebase como áudio remoto
   */
  public async resolve(code: string): Promise<IntelItem | null> {
    // Step 1: Check for QR redirect
    const redirectedId = await fetchQrRedirect(code);
    const finalCode = redirectedId || code;

    // Step 2: Check local registry
    const local = intelRegistry.getByCode(finalCode);
    if (local) return local;

    // Step 3: Try Firebase mediaAsset
    const remoteMedia = await fetchAudioTapeById(finalCode);
    if (remoteMedia) {
      // Registra no registry para cache local
      return this.registerMediaAssetAsIntel(remoteMedia);
    }

    return null;
  }

  // --- Desbloqueio ---

  /**
   * Desbloqueia um IntelItem para o jogador.
   * Ponto de entrada unificado para todos os tipos de Intel (AUDIO, VISUAL, TEXT, META).
   * 
   * Nota: Achievements usam firestoreGrantAchievements (lógica separada de avaliação).
   * Todos os outros tipos passam por aqui via firestoreUnlockIntel (dual-write tapes+intel).
   */
  public async unlock(
    playerData: PlayerData,
    intelId: string
  ): Promise<{ alreadyOwned: boolean; updatedIds: string[] }> {
    const alreadyOwned = playerData.unlockedIntelIds.includes(intelId);

    // Persiste no Firestore na nova subcoleção 'intel'
    await firestoreUnlockIntel(playerData.uid, playerData.activeCharacterId, intelId, playerData.character.campaignId);

    const updatedIds = alreadyOwned
      ? playerData.unlockedIntelIds
      : [...playerData.unlockedIntelIds, intelId];

    return { alreadyOwned, updatedIds };
  }

  // --- Coleção do Jogador ---

  /**
   * Monta a coleção completa de Intel do jogador,
   * combinando tapes desbloqueados + gallery images.
   */
  public async getCollection(
    playerData: PlayerData
  ): Promise<PlayerIntelCollection> {
    // 1. Resolve itens desbloqueados
    const idsToFetch = playerData.unlockedIntelIds.filter(id => !intelRegistry.get(id));
    
    // Batch fetch remote items (max 30 per query via Firestore 'in' operator)
    if (idsToFetch.length > 0) {
      const remoteMediaResults = await fetchAudioTapesByIds(idsToFetch);

      // Registra os novos itens remotos
      remoteMediaResults.forEach(remoteMedia => {
        if (remoteMedia) {
          this.registerMediaAssetAsIntel(remoteMedia);
        }
      });
    }

    // Agora todos os itens (locais + novos remotos) devem estar no registry
    let resolvedItems: IntelItem[] = playerData.unlockedIntelIds
      .map(id => intelRegistry.get(id))
      .filter((item): item is IntelItem => !!item);

    // 3. ISOLAMENTO DE INVENTÁRIO (INSTÂNCIAS)
    // Filtra apenas itens da campanha ativa ou itens globais (sem campaignId)
    const activeCampaignId = playerData.character.campaignId;
    resolvedItems = resolvedItems.filter(item => 
      !item.campaignId || item.campaignId === activeCampaignId
    );

    // 4. Monta estrutura organizada
    const byType: Record<IntelType, IntelItem[]> = {
      AUDIO: [],
      VISUAL: [],
      TEXT: [],
      META: [],
    };

    const byLevel: Record<AccessLevel, IntelItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
    };

    for (const item of resolvedItems) {
      byType[item.type].push(item);
      byLevel[item.level].push(item);
    }

    return {
      items: resolvedItems,
      byType,
      byLevel,
      unlockedIds: resolvedItems.map(i => i.id),
      counts: {
        total: resolvedItems.length,
        audio: byType.AUDIO.length,
        visual: byType.VISUAL.length,
        text: byType.TEXT.length,
        meta: byType.META.length,
      },
    };
  }

  /**
   * Resolve todos os IntelItems a partir de IDs (versão síncrona para
   * itens que já estão no registry).
   */
  public resolveFromRegistry(ids: string[]): IntelItem[] {
    return intelRegistry.resolve(ids);
  }

  /**
   * Resolve todos os IDs, incluindo busca assíncrona de itens remotos.
   */
  public async resolveAll(ids: string[]): Promise<IntelItem[]> {
    const idsToFetch = ids.filter(id => !intelRegistry.get(id));
    
    if (idsToFetch.length > 0) {
      const remoteTapesResults = await Promise.all(
        idsToFetch.map(id => fetchAudioTapeById(id))
      );

      remoteTapesResults.forEach(remoteTape => {
        if (remoteTape) {
          this.registerMediaAssetAsIntel(remoteTape);
        }
      });
    }

    return ids
      .map(id => intelRegistry.get(id))
      .filter((item): item is IntelItem => !!item);
  }
}

export const intelService = IntelService.getInstance();
