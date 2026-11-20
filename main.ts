// token-radar: the entrypoint the grader runs.
//
// One sealed snapshot goes in, one static site comes out: the ranked board as JSON, the data script
// the page reads, the page with its screenshots, and the dossier the judge opens. Only the Node
// standard library is used, nothing is installed, and no clock and no random source is read, so two
// runs over the same snapshot write the same bytes.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boardIssue, buildBoard, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import type { BoardRow, RadarData } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

/** The repository root: dashboard/ and screenshots/ are taken from here. */
const ROOT = dirname(fileURLToPath(import.meta.url));

/** Caps handed to the dossier writer; they can refuse a bad tree, never reshape a good one. */
const DOSSIER_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  dashboard: { max_files: 993, max_bytes: 50_331_648 },
  app_max_files: 993,
  app_max_bytes: 50_331_648,
  app_path_max_bytes: 1_000,
};

/** Where the site lands when MAKEFUN_OUTPUT_DIR says nothing: the mount in the grader, out/ here. */
const FALLBACK_OUT = process.platform === 'win32' ? 'out' : '/output';

/** `--input <file>` and `--input=<file>` both work; null when the flag is absent. */
function inputFlag(argv: readonly string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--input') return argv[i + 1] ?? null;
    if (arg.startsWith('--input=')) return arg.slice('--input='.length);
  }
  return null;
}

/** The first snapshot that exists: the flag, then <repo>/input, then ../input, then the mount. */
function locateSnapshot(flag: string | null): string {
  const candidates: string[] = [];
  if (flag !== null && flag.length > 0) candidates.push(resolve(flag));
  candidates.push(join(ROOT, 'input', 'snapshot.json'));
  candidates.push(resolve(ROOT, '..', 'input', 'snapshot.json'));
  candidates.push('/input/snapshot.json');
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`token-radar: no snapshot.json among ${candidates.join(' | ')}`);
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/** Copy a folder whole: the page ships with the exact names and bytes it has in the repository. */
function copyDir(source: string, target: string): void {
  if (resolve(source) === resolve(target)) throw new Error(`token-radar: refusing to copy ${source} onto itself`);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true, force: true });
}

/** board.json: the ranked rows under one `rows` key, one line, so the file is read as a whole. */
function emitBoard(outDir: string, rows: BoardRow[]): void {
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows })}\n`, 'utf8');
}

/** data.js: the page's data as one assignment, so the page needs no fetch and no network. */
function emitData(outDir: string, radar: RadarData): void {
  writeFileSync(join(outDir, 'data.js'), dataScript(radar), 'utf8');
}

/** dossier.json: the library's canonical bytes over dashboard/ and screenshots/; returns its size. */
function sinkDossier(outDir: string): number {
  const bytes = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), bytes);
  return bytes.length;
}

function main(): void {
  const snapshot = parseSnapshot(readFileSync(locateSnapshot(inputFlag(process.argv.slice(2))), 'utf8'));
  const rows = buildBoard(snapshot);
  const { radar } = buildRadar(snapshot);

  // Refuse to write a board the gate would throw out: the model checked itself before shipping.
  const problem = boardIssue(rows, snapshot);
  if (problem !== null) throw new Error(`token-radar: the board would fail the gate: ${problem}`);

  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || FALLBACK_OUT);
  if (outDir === ROOT) throw new Error('token-radar: the output directory is the repository itself');
  ensureDir(outDir);

  emitBoard(outDir, rows);
  emitData(outDir, radar);
  copyDir(join(ROOT, 'dashboard'), join(outDir, 'dashboard'));
  copyDir(join(ROOT, 'screenshots'), join(outDir, 'screenshots'));
  const dossierBytes = sinkDossier(outDir);

  console.log(`token-radar: ${rows.length} rows, ${radar.live.length} live, dossier ${dossierBytes} bytes -> ${outDir}`);
}

main();
