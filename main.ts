// main.ts — Starforge Duel's make.fun entry program.
//
// What it does, in order:
//   1. finds the output directory (MAKEFUN_OUTPUT_DIR, else /output);
//   2. copies this repository's game/ and screenshots/ into it, so the
//      output holds exactly the playable game and its renders;
//   3. writes dossier.json there, built by the kit's own buildDossier
//      (vendor/makefun-game.ts, copied verbatim) with the bounty's caps,
//      so the dossier fails here exactly where the scorer would refuse it.
//
// Plain Node 22 standard library only; the file is TypeScript in the
// same no-build style as the vendor module, so `node main.ts` runs it
// as-is — no flags, no install, no network.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = import.meta.dirname;
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly and early when the entry is incomplete: buildDossier would
// refuse these too, but with a colder error than a missing piece deserves.
for (const needed of ['game/index.html', 'screenshots']) {
  if (!existsSync(join(repoRoot, needed))) {
    throw new Error(`Starforge Duel entry is incomplete: ${needed} is missing from ${repoRoot}.`);
  }
}

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  cpSync(join(repoRoot, name), join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Starforge Duel: game/ and screenshots/ copied to ${outDir}; dossier.json written (${dossier.length} bytes).`);
