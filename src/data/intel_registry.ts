import type { IntelItem, AccessLevel, IntelType, VisualCategory } from '../types/intel';
import type { GalleryImage } from '../types/player';

/**
 * intel_registry.ts — Master Database Unificado
 * 
 * Registra todos os itens Intel conhecidos localmente (hardcoded).
 * Itens remotos (do Firebase) são incorporados em runtime pelo IntelService.
 */

// --- Itens locais hardcoded (antigos EVIDENCE_TAPES) ---

const LOCAL_INTEL_ITEMS: IntelItem[] = [
  {
    id: 'evidence-disk-01-corrupted',
    type: 'TEXT',
    level: 3,
    title: 'ARQUIVO_CORROMPIDO',
    description: 'Um disquete ilegível. As trilhas magnéticas estão destruídas.',
    textContent: `S̸e̵ ̸o̸n̵d̴a̷ ̶s̵o̵n̶o̶r̶a̷ ̷a̶t̶i̵n̷g̷e̸ ̴∇̸ ̴∞̵ ̵n̷o̵ ̵m̶i̶l̶i̴s̸s̶e̵g̷u̴n̸d̸o̵ ̴d̵o̵ ̷e̶r̵r̵o̸ ̶t̴e̵m̴p̴o̶r̵a̵l̴.̶.̶.̷
O̵ ̵█̶█̶█̶█̶█̶█̶█̶█̶█̶█̶ ̷n̵ã̷o̵ ̷é̴ ̵l̵i̶n̴h̷a̴.̵ ̶É̸ ̴u̶m̸ ̷l̶o̵o̵p̸ ̷d̵e̴ ̶c̵ó̸d̵i̴g̵o̵.̶
1̷9̶0̶0̶ ̶▒̶░̶▓̶ ̶E̷R̵R̴O̷ ̸S̷I̸N̸T̸A̶X̵E̴ ̴▓̸░̸▒̸ ̶2̶0̶0̶0̵
A̶c̶h̷a̸m̴ ̴q̴u̷e̷ ̵é̶ ̵b̴u̷g̷ ̸c̷a̵l̶e̷n̸d̸á̷r̸i̴o̷.̸ ̵I̵d̴i̷o̷t̶a̵s̸.̵
L̸I̶M̵B̶O̷_̴0̶1̵ ̶é̶ ̶f̵e̵n̶d̴a̷.̸ ̶█̶█̶█̶█̶█̶█̶█̶ ̸v̵i̵v̶e̵ ̵n̷o̴ ̶e̵s̶p̵a̶ç̶o̵ ̷e̷n̷t̸r̵e̷ ̷z̶e̶r̶o̴s̸.̵
S̵e̴ ̶a̶l̴i̵m̵e̵n̴t̶a̸ ̸d̷e̴ ̴s̶i̵n̵a̵l̵.̶ ̶O̴d̴e̷i̴a̸ ̶a̷n̷a̷l̸ó̵g̵i̶c̸o̸.̸ ̷F̸i̵t̸a̸ ̸é̶ ̸â̷n̶c̶o̸r̶a̶.̶
C̷á̴l̶c̶u̵l̸o̸ ̴t̵r̶a̷n̶s̴i̷ç̸ã̶o̴:̷
(̵E̶ ̸≠ ̷h̷*̸f̴)̷ ̶/̵ █̶▓̶▒̶░̵▄̵▀̶▒̵▓̶█̶ ̵∇̵∞̶ ̵∂̷Ω̶∑̸ ̶¥̸§̷ÿ̷¢̶¿̶ ̶█̶▀̶▄̷█̴▓̷▒̷ ̸R̸E̵A̷L̷I̴D̴A̶D̵E̴ ̸O̴U̵T̶R̶A̷ ̵▒̵▓̴█̸▄̵▀̴ ̷█̴▓̷▒̷ ̵S̵Ω̸Λ̷M̷∂̴ ̸█̶█̶█̶█̶█̶█̶█̶█̶ ̶▓̴▒̸░̷ ̶A̸ ̵C̸ ̸E̷ ̸S̴ ̵S̵ ̵O̵ ̶▓̴▒̷█̴▀̸▄̵ ̵█̶▓̶▒̸ ̴S̵Ω̷Λ̸M̸∂̶ ̸░̷▄̶▀̷▒̷▓̵█̸ ̴∇̷∞̴ ̵∂̸Ω̶∑̴ ̸¥̵§̸ÿ̸¢̸¿̵ ̴█̴▀̵▄̵█̴▓̶▒̶ ̷R̷E̸A̷L̵I̴D̴A̴D̵E̴ ̵O̵U̸T̵R̶A̶ ̸▒̸▓̸█̴▄̵▀̴ ̵
S̵e̷ ̴e̷u̷ ̶s̸u̷m̷i̴r̶,̴ ̶f̴r̶e̵q̵u̶ê̵n̵c̵i̶a̶ ̵f̶u̶n̶c̸i̶o̸n̶o̷u̷.̶
M̶e̷ ̷a̵c̵h̴e̶m̷ ̴n̶o̵ ̵z̴e̴r̶o̵.̶`,
    metadata: {
      npc: 'Desconhecido',
      artist: 'Desconhecido',
      chapter: 'Ameaças',
    },
  },
  {
    id: 'evidence-disk-01',
    type: 'TEXT',
    level: 2,
    title: 'DISK_REPAIRED_01',
    description: 'Um disquete magnético recuperado e desmagnetizado.',
    textContent: `A Teoria das Cordas diz que existem 11 dimensões, mas todo mundo está ignorando o óbvio: o zero é a ponte.
Eu percebi que o que está acontecendo agora é uma colisão. É a minha frequência analógica (do walkman mesmo) batendo de frente com esse "reset" digital do Bug do Milênio. Se a onda sonora atingir o infinito no exato milisegundo em que o erro temporal acontecer... a gente vai ver a verdade.
O Multiverso não é uma linha reta, como ensinam na escola. É um loop de código. 1900 foi um erro de sintaxe. 2000 é o próximo.
O LIMBO_01 é a fenda que abriu. E o Malware... ele não é um vírus comum. Ele é algo que vive no espaço "entre" os zeros. Ele se alimenta de sinal, por isso ele odeia tudo o que é analógico. A fita cassete é a minha única âncora aqui.
Cálculo de transição: (E=h⋅f)/Y2K_Bug=ACESSO
Se eu sumir hoje, significa que a frequência funcionou. Não me procurem no futuro. Me achem no zero.`,
    metadata: {
      npc: 'Desconhecido',
      artist: 'Analog_Traveler',
      chapter: 'Evidências',
    },
  },
];

/**
 * IntelRegistry — Singleton que mantém o banco de dados unificado de Intel em memória.
 * Combina itens locais (hardcoded) com itens remotos (Firebase) em runtime.
 */
class IntelRegistry {
  private static instance: IntelRegistry;
  private items: Map<string, IntelItem> = new Map();

  private constructor() {
    // Registra itens locais
    LOCAL_INTEL_ITEMS.forEach(item => this.items.set(item.id, item));
  }

  public static getInstance(): IntelRegistry {
    if (!IntelRegistry.instance) {
      IntelRegistry.instance = new IntelRegistry();
    }
    return IntelRegistry.instance;
  }

  // --- Registro ---

  /** Registra um novo item (ou sobrescreve existente). */
  public register(item: IntelItem): void {
    this.items.set(item.id, item);
  }

  /** Registra múltiplos itens de uma vez. */
  public registerBatch(items: IntelItem[]): void {
    items.forEach(item => this.items.set(item.id, item));
  }

  // --- Consulta ---

  /** Busca um item pelo ID. */
  public get(id: string): IntelItem | undefined {
    return this.items.get(id);
  }

  /** Busca um item pelo ID (case-insensitive). */
  public getByCode(code: string): IntelItem | undefined {
    const normalized = code.trim().toUpperCase();
    for (const item of this.items.values()) {
      if (item.id.toUpperCase() === normalized) return item;
    }
    return undefined;
  }

  /** Retorna todos os itens registrados. */
  public getAll(): IntelItem[] {
    return Array.from(this.items.values());
  }

  /** Filtra por tipo. */
  public getByType(type: IntelType): IntelItem[] {
    return this.getAll().filter(item => item.type === type);
  }

  /** Filtra por nível de acesso. */
  public getByLevel(level: AccessLevel): IntelItem[] {
    return this.getAll().filter(item => item.level === level);
  }

  /** Resolve uma lista de IDs para IntelItems. */
  public resolve(ids: string[]): IntelItem[] {
    return ids
      .map(id => this.items.get(id))
      .filter((item): item is IntelItem => item !== undefined);
  }

  /** Retorna true se o item existe no registro local. */
  public has(id: string): boolean {
    return this.items.has(id);
  }

  // --- Incorporação de dados remotos ---

  /**
   * Converte e registra um áudio remoto do Firebase (coleção `audios`).
   */
  public registerRemoteAudio(data: {
    id: string;
    title?: string;
    artist?: string;
    npc?: string;
    chapter?: string;
    description?: string;
    url?: string;
    duration?: number;
    isSecret?: boolean;
  }): IntelItem {
    const intel: IntelItem = {
      id: data.id,
      type: 'AUDIO',
      level: data.isSecret ? 3 : 1,
      title: data.title || '',
      description: data.description || '',
      mediaUrl: data.url,
      metadata: {
        artist: data.artist || '',
        npc: data.npc || data.artist || '',
        chapter: data.chapter || '',
        duration: data.duration || 0,
        isSecret: data.isSecret,
      },
    };
    this.register(intel);
    return intel;
  }

  /**
   * Converte e registra uma GalleryImage como IntelItem VISUAL.
   */
  public registerGalleryImage(img: GalleryImage): IntelItem {
    const levelMap: Record<string, AccessLevel> = {
      locais: 1,
      pistas: 2,
      pessoas: 2,
      itens: 1,
    };
    const intel: IntelItem = {
      id: img.id,
      type: 'VISUAL',
      level: levelMap[img.category] || 1,
      title: img.title,
      description: img.description,
      mediaUrl: img.imageUrl,
      metadata: {
        visualCategory: img.category,
        imageUrl: img.imageUrl,
      },
    };
    this.register(intel);
    return intel;
  }
}

export const intelRegistry = IntelRegistry.getInstance();

// --- Utilitários de exportação para admin (compatibilidade) ---

export interface EvidenceIntelAdmin {
  id: string;
  title: string;
  chapter: string;
  type: 'audio' | 'disk';
}

export const EVIDENCE_INTEL_FOR_ADMIN: EvidenceIntelAdmin[] = LOCAL_INTEL_ITEMS
  .filter(item => item.type === 'AUDIO' || item.type === 'TEXT')
  .map(item => ({
    id: item.id,
    title: item.title,
    chapter: item.metadata?.chapter || '',
    type: (item.type === 'TEXT' ? 'disk' : 'audio') as 'audio' | 'disk',
  }));
