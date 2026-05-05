import type { IntelItem, PlayerIntelCollection, IntelType, AccessLevel } from '../types/intel';
import type { PlayerData } from '../types/player';
import type { GalleryImage } from '../types/player';
import { intelRegistry } from '../data/intel_registry';
import { 
  fetchAudioTapeById, 
  fetchQrRedirect, 
  firestoreUnlockTape,
  firestoreGrantAchievements,
  fetchPlayerGalleryImages,
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
    const remote = remoteTape as any;
      return intelRegistry.registerRemoteAudio({
        id: remote.id,
        title: remote.title,
        artist: remote.artist,
        npc: remote.npc,
        chapter: remote.chapter,
        description: remote.description,
        url: remote.audioUrl,
        duration: remote.duration,
        isSecret: remote.isSecret,
        level: remote.level,
      });
    }

    return null;
  }

  // --- Desbloqueio ---

  /**
   * Desbloqueia um IntelItem para o jogador.
   * Lógica unificada que substitui firestoreUnlockTape para todos os tipos.
   * 
   * Nota: Achievements usam firestoreGrantAchievements (lógica separada de avaliação).
   * Gallery images usam grantGalleryImage (admin-controlled).
   * Tapes usam firestoreUnlockTape.
   * 
   * Esta função é o ponto de entrada unificado.
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
        const r = remoteTape as any;
        intelRegistry.registerRemoteAudio({
          id: r.id,
          title: r.title,
          artist: r.artist,
          npc: r.npc,
          chapter: r.chapter,
          description: r.description,
          url: r.audioUrl,
          duration: r.duration,
          isSecret: r.isSecret,
          level: r.level,
        });
      }
    });

    // Agora todos os itens (locais + novos remotos) devem estar no registry
    const resolvedItems: IntelItem[] = playerData.unlockedTapeIds
      .map(id => intelRegistry.get(id))
      .filter((item): item is IntelItem => !!item);

    // 2. Incorpora gallery images como VISUAL intel
    for (const img of galleryImages) {
      const visualIntel = intelRegistry.registerGalleryImage(img);
      resolvedItems.push(visualIntel);
    }

    // 3. Monta estrutura organizada
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
          const r = remoteTape as any;
          intelRegistry.registerRemoteAudio({
            id: r.id,
            title: r.title,
            artist: r.artist,
            npc: r.npc,
            chapter: r.chapter,
            description: r.description,
            url: r.audioUrl,
            duration: r.duration,
            isSecret: r.isSecret,
            level: r.level,
          });
        }
      });
    }

    return ids
      .map(id => intelRegistry.get(id))
      .filter((item): item is IntelItem => !!item);
  }
}

export const intelService = IntelService.getInstance();
