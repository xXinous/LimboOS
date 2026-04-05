#!/usr/bin/env node
/**
 * generate-tapes.ts
 * -----------------
 * Reads ID3 / AAC metadata from every .mp3 and .m4a file placed
 * inside  public/audio/  and auto-generates  src/data/tapes.ts.
 *
 * Tag → Field mapping
 * -------------------
 *  id          ← filename without extension   (e.g. TAPE-01.mp3 → "TAPE-01")
 *  title       ← ID3 Title   (TIT2)
 *  artist      ← ID3 Artist  (TPE1)
 *  npc         ← ID3 Artist  (same field)
 *  chapter     ← ID3 Album   (TALB)
 *  description ← ID3 Comment (COMM)
 *  duration    ← detected automatically from the audio stream (seconds)
 *  audioUrl    ← /audio/<filename>   (served by Vite from public/)
 *  isSecret    ← ID3 Genre   (TCON) === "Secret"   (case-insensitive)
 *
 * Usage
 * -----
 *  npx tsx scripts/generate-tapes.ts
 *  – or –
 *  npm run generate-tapes
 */

import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.resolve(__dirname, '../public/audio');
const OUTPUT    = path.resolve(__dirname, '../src/data/tapes.ts');

const SUPPORTED = ['.mp3', '.m4a', '.ogg', '.wav', '.flac'];

// ── helpers ──────────────────────────────────────────────────────────────────

function escape(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatDuration(seconds: number): number {
  return Math.round(seconds);
}

/** Returns true if the string looks like a technical iTunes/LAME replay-gain comment. */
function isTechnicalComment(s: string): boolean {
  // replay gain comments look like: " 00000C80 00000C80 000074E2 ..."
  return /^\s*([0-9A-Fa-f]{8}\s*){2,}/.test(s);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(AUDIO_DIR)) {
    console.error(`❌  Pasta de áudio não encontrada: ${AUDIO_DIR}`);
    console.error('    Crie a pasta public/audio/ e coloque seus arquivos lá.');
    process.exit(1);
  }

  const files = fs.readdirSync(AUDIO_DIR)
    .filter((f) => SUPPORTED.includes(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.warn('⚠️  Nenhum arquivo de áudio encontrado em public/audio/');
    console.warn('   O tapes.ts será gerado com lista vazia.');
  }

  console.log(`📼  ${files.length} arquivo(s) encontrado(s) em public/audio/\n`);

  const tapeEntries: string[] = [];

  for (const file of files) {
    const filePath = path.join(AUDIO_DIR, file);
    const ext      = path.extname(file).toLowerCase();
    const id       = path.basename(file, ext);

    let title       = id;
    let artist      = '';
    let chapter     = '';
    let description = '';
    let duration    = 0;
    let isSecret    = false;

    try {
      const meta    = await parseFile(filePath, { skipCovers: true });
      const common  = meta.common;
      const format  = meta.format;

      title       = common.title       || id;
      artist      = common.artist      || '';
      chapter     = common.album       || '';

      // music-metadata returns comment as an array of { language, text } objects
      // Some encoders (iTunes/LAME) embed technical replay-gain data in COMM tags — skip those.
      const rawComment = common.comment;
      if (Array.isArray(rawComment)) {
        for (const c of rawComment) {
          const text = typeof c === 'string' ? c : ((c as any).text ?? '') as string;
          if (text && !isTechnicalComment(text)) {
            description = text.trim();
            break;
          }
        }
      } else if (typeof rawComment === 'string' && !isTechnicalComment(rawComment as string)) {
        description = (rawComment as string).trim();
      }

      duration    = format.duration ? formatDuration(format.duration) : 0;
      isSecret    = (common.genre?.[0] ?? '').trim().toLowerCase() === 'secret';

      const status = [
        `  id: ${id.padEnd(20)}`,
        `title: ${title.substring(0, 30).padEnd(30)}`,
        `artist: ${artist.substring(0, 20)}`,
      ].join('  ');
      console.log(`  ✅  ${status}`);
    } catch (err) {
      console.error(`  ❌  Erro ao ler metadados de "${file}":`, err);
    }

    // URL-encode the filename so spaces and special chars work correctly in <audio src>
    const encodedFile = file.split('/').map(encodeURIComponent).join('/');
    const audioUrl = `/audio/${encodedFile}`;
    const secretLine = isSecret ? `\n    isSecret: true,` : '';

    tapeEntries.push(
      `  {\n` +
      `    id: '${escape(id)}',\n` +
      `    title: '${escape(title)}',\n` +
      `    artist: '${escape(artist)}',\n` +
      `    npc: '${escape(artist)}',\n` +
      `    chapter: '${escape(chapter)}',\n` +
      `    description: '${escape(description)}',\n` +
      `    audioUrl: '${escape(audioUrl)}',\n` +
      `    duration: ${duration},${secretLine}\n` +
      `  }`
    );
  }

  // ── build output file ──────────────────────────────────────────────────────

  const timestamp = new Date().toISOString();

  const output = `// ⚠️  ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE MANUALMENTE
// Gerado em: ${timestamp}
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
  type?: 'audio' | 'disk';
  content?: string;
}

// The master list — generated from ID3 metadata of files in public/audio/.
// QR codes should encode the tape \`id\` exactly (e.g. "TAPE-01").
const MASTER_TAPES: Tape[] = [
${tapeEntries.join(',\n')}
];

const EVIDENCE_TAPES: Tape[] = [
  {
    id: 'evidence-disk-01-corrupted',
    title: 'ARQUIVO_CORROMPIDO',
    artist: 'Desconhecido',
    npc: 'Desconhecido',
    chapter: 'Ameaças',
    description: 'Um disquete ilegível. As trilhas magnéticas estão destruídas.',
    audioUrl: '',
    duration: 0,
    type: 'disk',
    content: \`S̸e̵ ̸o̸n̵d̴a̷ ̶s̵o̵n̶o̶r̶a̷ ̷a̶t̶i̵n̷g̷e̸ ̴∇̸ ̴∞̵ ̵n̷o̵ ̵m̶i̶l̶i̴s̸s̶e̵g̷u̴n̸d̸o̵ ̴d̵o̵ ̷e̶r̵r̵o̸ ̶t̴e̵m̴p̴o̶r̵a̵l̴.̶.̶.̷
O̵ ̵█̶█̶█̶█̶█̶█̶█̶█̶█̶█̶ ̷n̵ã̷o̵ ̷é̴ ̵l̵i̶n̴h̷a̴.̵ ̶É̸ ̴u̶m̸ ̷l̶o̵o̵p̸ ̷d̵e̴ ̶c̵ó̸d̵i̴g̵o̵.̶
1̷9̶0̶0̶ ̶▒̶░̶▓̶ ̶E̷R̵R̴O̷ ̸S̷I̸N̸T̸A̶X̵E̴ ̴▓̸░̸▒̸ ̶2̶0̶0̶0̵
A̶c̶h̷a̸m̴ ̴q̴u̷e̷ ̵é̶ ̵b̴u̷g̷ ̸c̷a̵l̶e̷n̸d̸á̷r̸i̴o̷.̸ ̵I̵d̴i̷o̷t̶a̵s̸.̵
L̸I̶M̵B̶O̷_̴0̶1̵ ̶é̶ ̶f̵e̵n̶d̴a̷.̸ ̶█̶█̶█̶█̶█̶█̶█̶ ̸v̵i̵v̶e̵ ̵n̷o̴ ̶e̵s̶p̵a̶ç̶o̵ ̷e̷n̷t̸r̵e̷ ̷z̶e̶r̶o̴s̸.̵
S̵e̴ ̶a̶l̴i̵m̵e̵n̴t̶a̸ ̸d̷e̴ ̴s̶i̵n̵a̵l̵.̶ ̶O̴d̴e̷i̴a̸ ̶a̷n̷a̷l̸ó̵g̵i̶c̸o̸.̸ ̷F̸i̵t̸a̸ ̸é̶ ̸â̷n̶c̶o̸r̶a̶.̶
C̷á̴l̶c̶u̵l̸o̸ ̴t̵r̶a̷n̶s̴i̷ç̸ã̶o̴:̷
(̵E̶ ̸≠ ̷h̷*̸f̴)̷ ̶/̵ █̶▓̶▒̶░̵▄̵▀̶▒̵▓̶█̶ ̵∇̵∞̶ ̵∂̷Ω̶∑̸ ̶¥̸§̷ÿ̷¢̶¿̶ ̶█̶▀̶▄̷█̴▓̷▒̷ ̸R̸E̵A̷L̷I̴D̴A̶D̵E̴ ̸O̴U̵T̶R̶A̷ ̵▒̵▓̴█̸▄̵▀̴ ̷█̴▓̷▒̷ ̵S̵Ω̸Λ̷M̷∂̴ ̸█̶█̶█̶█̶█̶█̶█̶█̶ ̶▓̴▒̸░̷ ̶A̸ ̵C̸ ̸E̷ ̸S̴ ̵S̵ ̵O̵ ̶▓̴▒̷█̴▀̸▄̵ ̵█̶▓̶▒̸ ̴S̵Ω̷Λ̸M̸∂̶ ̸░̷▄̶▀̷▒̷▓̵█̸ ̴∇̷∞̴ ̵∂̸Ω̶∑̴ ̸¥̵§̸ÿ̸¢̸¿̵ ̴█̴▀̵▄̵█̴▓̶▒̶ ̷R̷E̸A̷L̵I̴D̴A̴D̵E̴ ̵O̵U̸T̵R̶A̶ ̸▒̸▓̸█̴▄̵▀̴ ̵
S̵e̷ ̴e̷u̷ ̶s̸u̷m̷i̴r̶,̴ ̶f̴r̶e̵q̵u̶ê̵n̵c̵i̶a̶ ̵f̶u̶n̶c̸i̶o̸n̶o̷u̷.̶
M̶e̷ ̷a̵c̵h̴e̶m̷ ̴n̶o̵ ̵z̴e̴r̶o̵.̶\`
  },
  {
    id: 'evidence-disk-01',
    title: 'DISK_REPAIRED_01',
    artist: 'Analog_Traveler',
    npc: 'Desconhecido',
    chapter: 'Evidências',
    description: 'Um disquete magnético recuperado e desmagnetizado.',
    audioUrl: '',
    duration: 0,
    type: 'disk',
    content: \`A Teoria das Cordas diz que existem 11 dimensões, mas todo mundo está ignorando o óbvio: o zero é a ponte.
Eu percebi que o que está acontecendo agora é uma colisão. É a minha frequência analógica (do walkman mesmo) batendo de frente com esse "reset" digital do Bug do Milênio. Se a onda sonora atingir o infinito no exato milisegundo em que o erro temporal acontecer... a gente vai ver a verdade.

O Multiverso não é uma linha reta, como ensinam na escola. É um loop de código. 1900 foi um erro de sintaxe. 2000 é o próximo.

O LIMBO_01 é a fenda que abriu. E o Malware... ele não é um vírus comum. Ele é algo que vive no espaço "entre" os zeros. Ele se alimenta de sinal, por isso ele odeia tudo o que é analógico. A fita cassete é a minha única âncora aqui.

Cálculo de transição: (E=h⋅f)/Y2K_Bug=ACESSO

Se eu sumir hoje, significa que a frequência funcionou. Não me procurem no futuro. Me achem no zero.\`
  }
];

const ALL_TAPES = [...MASTER_TAPES, ...EVIDENCE_TAPES];

/** Returns a tape by its QR code value (case-insensitive). */
export function getTapeByCode(code: string): Tape | null {
  const normalized = code.trim().toUpperCase();
  return ALL_TAPES.find((t) => t.id.toUpperCase() === normalized) ?? null;
}

/** Resolve a list of tape IDs into full Tape objects (for the player library). */
export function resolveTapes(ids: string[]): Tape[] {
  return ids
    .map((id) => ALL_TAPES.find((t) => t.id === id))
    .filter((t): t is Tape => t !== undefined);
}

/** Admin-facing minimal shape of an evidence tape item. */
export interface EvidenceTapeAdmin {
  id: string;
  title: string;
  chapter: string;
  type: 'audio' | 'disk';
}

/** Simplified list of all evidence items for the admin Inventory Manager. */
export const EVIDENCE_TAPES_FOR_ADMIN: EvidenceTapeAdmin[] = EVIDENCE_TAPES.map((t) => ({
  id: t.id,
  title: t.title,
  chapter: t.chapter,
  type: (t.type ?? 'audio') as 'audio' | 'disk',
}));
`;

  fs.writeFileSync(OUTPUT, output, 'utf-8');
  console.log(`\n✅  ${OUTPUT} gerado com ${tapeEntries.length} fita(s).`);
  console.log('\n💡  Mapeamento de tags ID3:\n');
  console.log('   Arquivo (nome) → id');
  console.log('   Title          → title + (usado como fallback se vazio)');
  console.log('   Artist         → artist + npc');
  console.log('   Album          → chapter');
  console.log('   Comment        → description');
  console.log('   Genre="Secret" → isSecret: true');
  console.log('   Duration       → (lido automaticamente do áudio)');
}

main().catch((err) => {
  console.error('Falha fatal:', err);
  process.exit(1);
});
