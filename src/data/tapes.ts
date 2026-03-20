// Hidden master tape list — never exposed in the UI until unlocked via QR scan.
// QR codes should encode the `id` field exactly (e.g. "TAPE-01").

export interface Tape {
  id: string;
  title: string;
  artist: string; // NPC / narrator
  description: string;
  chapter: string;
  npc: string;
  audioUrl: string; // placeholder URLs — swap for real audio files
  duration: number; // seconds
  isSecret?: boolean;
}

// The master list lives only here; the UI never lists or fetches this directly.
const MASTER_TAPES: Tape[] = [
  {
    id: 'TAPE-01',
    title: 'Mensagem da Resistência',
    artist: 'Comandante Veloz',
    description: 'Uma gravação urgente encontrada num terminal abandonado da zona industrial.',
    chapter: 'Cap. 1 — A Fuga',
    npc: 'Comandante Veloz',
    audioUrl: '',
    duration: 180,
  },
  {
    id: 'TAPE-02',
    title: 'Coordenadas do Setor 7G',
    artist: 'Agente Sombra',
    description: 'Fragmento de comunicação criptografada. Destinatário desconhecido.',
    chapter: 'Cap. 1 — A Fuga',
    npc: 'Agente Sombra',
    audioUrl: '',
    duration: 120,
  },
  {
    id: 'TAPE-03',
    title: 'Depoimento Nº 4',
    artist: 'Anônimo',
    description: 'Um sobrevivente relata o que viu na Noite do Apagão.',
    chapter: 'Cap. 2 — Rastros',
    npc: 'Anônimo',
    audioUrl: '',
    duration: 210,
  },
  {
    id: 'TAPE-04',
    title: 'Protocolo HYDRA',
    artist: 'Dr. Finch',
    description: 'Arquivos de projeto ultra-secreto. Acesso nível 5 necessário.',
    chapter: 'Cap. 2 — Rastros',
    npc: 'Dr. Finch',
    audioUrl: '',
    duration: 95,
  },
  {
    id: 'TAPE-05',
    title: 'Último Contato',
    artist: 'Indústrias Smile',
    description: 'Transmissão de emergência emitida às 03:17. Ninguém respondeu.',
    chapter: 'Cap. 3 — O Silêncio',
    npc: 'Indústrias Smile',
    audioUrl: '',
    duration: 150,
  },
  {
    id: 'TAPE-06',
    title: 'Canção do Exílio',
    artist: 'Marta\u00e9',
    description: 'Uma melodia gravada em vinil, encontrada debaixo das ruínas.',
    chapter: 'Cap. 3 — O Silêncio',
    npc: 'Martaé',
    audioUrl: '',
    duration: 240,
  },
  {
    id: 'TAPE-07',
    title: 'Relatório de Campo — Nó Delta',
    artist: 'Corvus',
    description: 'Observações de reconhecimento do agente Corvus antes do desaparecimento.',
    chapter: 'Cap. 4 — Profundeza',
    npc: 'Corvus',
    audioUrl: '',
    duration: 175,
  },
  {
    id: 'TAPE-08',
    title: 'Frequência Zero',
    artist: 'Sistema',
    description: 'Um ruído estático que, quando filtrado, revela uma contagem regressiva.',
    chapter: 'Cap. 4 — Profundeza',
    npc: 'Sistema',
    audioUrl: '',
    duration: 60,
  },
  {
    id: 'TAPE-09',
    title: 'Confissão do Arquivista',
    artist: 'O Arquivista',
    description: 'Ele sabia de tudo. E não disse nada.',
    chapter: 'Cap. 5 — Revelação',
    npc: 'O Arquivista',
    audioUrl: '',
    duration: 320,
  },
  {
    id: 'TAPE-SECRET',
    title: '///REDACTED///',
    artist: '???',
    description: 'Você não deveria ter encontrado isso.',
    chapter: 'Bonus',
    npc: '???',
    audioUrl: '',
    duration: 33,
    isSecret: true,
  },
];

/** Returns a tape by its QR code value (case-insensitive). */
export function getTapeByCode(code: string): Tape | null {
  const normalized = code.trim().toUpperCase();
  return MASTER_TAPES.find((t) => t.id.toUpperCase() === normalized) ?? null;
}

/** Resolve a list of tape IDs into full Tape objects (for the player library). */
export function resolveTapes(ids: string[]): Tape[] {
  return ids
    .map((id) => MASTER_TAPES.find((t) => t.id === id))
    .filter((t): t is Tape => t !== undefined);
}
