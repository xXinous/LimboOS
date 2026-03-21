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
}

// The master list — generated from ID3 metadata of files in public/audio/.
// QR codes should encode the tape \`id\` exactly (e.g. "TAPE-01").
const MASTER_TAPES: Tape[] = [
${tapeEntries.join(',\n')}
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
