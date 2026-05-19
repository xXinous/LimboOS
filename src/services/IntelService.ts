import type { IntelItem, PlayerIntelCollection, IntelType, AccessLevel } from '../types/intel';
import type { PlayerData } from '../types/player';
import type { GalleryImage } from '../types/player';
import { intelRegistry } from '../data/intel_registry';
import { 
  fetchAudioTapeById, 
  fetchAudioTapesByIds,
  fetchAllAudios,
  fetchAllGalleryImages,
  fetchQrRedirect, 
  firestoreUnlockTape,
  firestoreGrantAchievements,
  fetchPlayerGalleryImages,
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

  private registerRemoteAudioFromFirebase(raw: Record<string, any>): IntelItem {
    return intelRegistry.registerRemoteAudio({
      id: raw.id,
      title: raw.title,
      artist: raw.artist,
      npc: raw.npc,
      chapter: raw.chapter,
      description: raw.description,
      url: raw.audioUrl || raw.url,
      duration: raw.duration,
      isSecret: raw.isSecret,
      level: raw.level,
    });
  }

  /**
   * Sincroniza o registro local com o Firebase.
   * Útil para o painel administrativo ver todos os itens remotos.
   */
  public async syncRegistryWithFirebase(): Promise<void> {
    const [audios, gallery] = await Promise.all([
      fetchAllAudios(),
      fetchAllGalleryImages(),
    ]);

    audios.forEach(audio => {
      this.registerRemoteAudioFromFirebase(audio);
    });

    gallery.forEach(img => {
      intelRegistry.registerGalleryImage(img);
    });
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

    // Step 3: Try Firebase audio
    const remoteTape = await fetchAudioTapeById(finalCode);
    if (remoteTape) {
      // Registra no registry para cache local
      return this.registerRemoteAudioFromFirebase(remoteTape);
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
    const alreadyOwned = playerData.unlockedTapeIds.includes(intelId);

    // Persiste no Firestore (subcollection tapes — retrocompatível)
    await firestoreUnlockTape(playerData.uid, playerData.activeCharacterId, intelId, playerData.character.campaignId);

    const updatedIds = alreadyOwned
      ? playerData.unlockedTapeIds
      : [...playerData.unlockedTapeIds, intelId];

    return { alreadyOwned, updatedIds };
  }

  // --- Coleção do Jogador ---

  /**
   * Monta a coleção completa de Intel do jogador,
   * combinando tapes desbloqueados + gallery images.
   */
  public async getCollection(
    playerData: PlayerData,
    galleryImages: GalleryImage[] = []
  ): Promise<PlayerIntelCollection> {
    // 1. Resolve tapes desbloqueados em paralelo
    const tapeIdsToFetch = playerData.unlockedTapeIds.filter(id => !intelRegistry.get(id));
    
    // Busca remota apenas para o que não está no registry
    const remoteTapesResults = await Promise.all(
      tapeIdsToFetch.map(id => fetchAudioTapeById(id))
    );

    // Registra os novos itens remotos
    remoteTapesResults.forEach(remoteTape => {
      if (remoteTape) {
        this.registerRemoteAudioFromFirebase(remoteTape);
      }
    });

    // Agora todos os itens (locais + novos remotos) devem estar no registry
    let resolvedItems: IntelItem[] = playerData.unlockedTapeIds
      .map(id => intelRegistry.get(id))
      .filter((item): item is IntelItem => !!item);

    // 2. Incorpora gallery images como VISUAL intel
    for (const img of galleryImages) {
      const visualIntel = intelRegistry.registerGalleryImage(img);
      resolvedItems.push(visualIntel);
    }

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
      const remoteTapesResults = await fetchAudioTapesByIds(idsToFetch);

      remoteTapesResults.forEach(remoteTape => {
        if (remoteTape) {
          this.registerRemoteAudioFromFirebase(remoteTape);
        }
      });
    }

    return ids
      .map(id => intelRegistry.get(id))
      .filter((item): item is IntelItem => !!item);
  }
}

export const intelService = IntelService.getInstance();
