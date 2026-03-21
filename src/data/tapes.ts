// ⚠️  ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE MANUALMENTE
// Gerado em: 2026-03-21T04:16:26.146Z
// Para atualizar: adicione/edite os metadados dos arquivos em public/audio/
//                 e rode:  npm run generate-tapes

export interface Tape {
  id: string;
  title: string;
  artist: string;
  npc: string;
  chapter: string;
  description: string;
  audioUrl: string;
  duration: number; // seconds
  isSecret?: boolean;
}

// The master list — generated from ID3 metadata of files in public/audio/.
// QR codes should encode the tape `id` exactly (e.g. "TAPE-01").
const MASTER_TAPES: Tape[] = [
  {
    id: 'DEMO Deserto Eletrico + ____',
    title: 'DEMO Deserto Elétrico + ????',
    artist: 'Analog Leviathan',
    npc: 'Analog Leviathan',
    chapter: 'Analog Leviathan',
    description: '',
    audioUrl: '/audio/DEMO%20Deserto%20Eletrico%20%2B%20____.mp3',
    duration: 219,
  },
  {
    id: 'TESTE PARA NIL _<3',
    title: 'TESTE PARA NIL <3',
    artist: 'Emily',
    npc: 'Emily',
    chapter: '',
    description: '',
    audioUrl: '/audio/TESTE%20PARA%20NIL%20_%3C3.mp3',
    duration: 78,
  }
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
