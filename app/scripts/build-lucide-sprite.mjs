#!/usr/bin/env node
// Build the `lucide` icon sprite from the lucide-react package.
//
// This is a companion to build-icon-sprite.mjs, not a replacement. That
// script builds the five hand-drawn sets from artwork in
// ~/Documents/jaitang-icons-final and OWNS the ICON_NAMES list. This one
// reads that list back and fills it with Lucide glyphs, so the two must
// run in order:
//
//     node scripts/build-icon-sprite.mjs     # regenerates ICON_NAMES
//     node scripts/build-lucide-sprite.mjs   # re-adds the lucide style
//
// Output: public/icons-lucide.svg, plus the `lucide` entries appended to
// ICON_STYLES / ICON_STYLE_LABELS in icon-names.ts.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMES_TS = join(ROOT, 'src', 'components', 'icons', 'icon-names.ts');
const LUCIDE_DIR = join(ROOT, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const OUT_SPRITE = join(ROOT, 'public', 'icons-lucide.svg');

/**
 * App icon name -> Lucide icon name, for the names Lucide doesn't carry
 * verbatim. Two kinds live here: our domain words ("balances", "loans")
 * and drawings Lucide has under another noun ("airplane" -> "plane").
 *
 * Where Lucide has no equivalent at all we pick the closest honest
 * stand-in rather than leave a hole — a missing symbol renders as an
 * empty box with no warning. Ones worth revisiting if Lucide adds them:
 * ramen (using soup), money-bag (coins), ring (gem), trips (luggage).
 */
const ALIASES = {
  accounts: 'wallet-cards',
  airplane: 'plane',
  atm: 'landmark',
  balances: 'scale',
  beach: 'palmtree',
  books: 'library',
  budgets: 'calculator',
  bullseye: 'target',
  'calendar-domain': 'calendar-days',
  camping: 'tent',
  'cash-stack': 'banknote',
  categories: 'layout-grid',
  chat: 'message-circle',
  'coin-purse': 'wallet',
  'credit-card-emoji': 'credit-card',
  'cruise-ship': 'ship',
  'game-controller': 'gamepad-2',
  goals: 'flag',
  'gold-coin': 'circle-dollar-sign',
  'handcoins-domain': 'hand-coins',
  insights: 'lightbulb',
  ledgers: 'notebook-text',
  'line-chart-domain': 'chart-line',
  loans: 'handshake',
  logout: 'log-out',
  'money-bag': 'coins',
  more: 'ellipsis',
  party: 'party-popper',
  'phone-wallet': 'smartphone-nfc',
  'piggybank-domain': 'piggy-bank',
  'plane-domain': 'plane',
  'plus-fab': 'plus',
  quick: 'zap',
  ramen: 'soup',
  recurring: 'repeat',
  refresh: 'refresh-cw',
  ring: 'gem',
  'scale-domain': 'scale',
  'target-domain': 'target',
  transactions: 'arrow-left-right',
  trash2: 'trash-2',
  'trending-flat': 'move-right',
  'trending-up-invest': 'trending-up',
  trips: 'luggage',
  'wallet-domain': 'wallet',
};

/** Pull the canonical icon list out of the generated types file. */
async function readIconNames() {
  const src = await readFile(NAMES_TS, 'utf8');
  const block = src.split('ICON_NAMES = [')[1]?.split('] as const')[0];
  if (!block) throw new Error('ICON_NAMES not found in icon-names.ts');
  return [...block.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

/**
 * Lucide ships each icon as an `__iconNode` array of [tag, attrs] pairs.
 * Long paths are pretty-printed across several lines, so the match has to
 * span newlines — a single-line regex silently drops half of them.
 */
async function readLucideNode(lucideName, depth = 0) {
  const src = await readFile(join(LUCIDE_DIR, `${lucideName}.mjs`), 'utf8');

  // Renamed icons keep a stub file that only re-exports the new name
  // (alert-circle -> circle-alert). Follow the hop rather than treating
  // the stub as a missing icon.
  const reexport = src.match(/export \{ default \} from '\.\/([\w-]+)\.mjs'/);
  if (reexport) {
    if (depth > 3) throw new Error(`alias loop at ${lucideName}`);
    return readLucideNode(reexport[1], depth + 1);
  }

  const body = src.split('__iconNode = [')[1]?.split('\n];')[0];
  if (!body) throw new Error(`no __iconNode in ${lucideName}.mjs`);
  const out = [];
  for (const [, tag, attrs] of body.matchAll(/\[\s*"(\w+)",\s*\{(.*?)\}\s*\]/gs)) {
    const kv = Object.fromEntries([...attrs.matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
    delete kv.key; // react list key, not an SVG attribute
    const serialized = Object.entries(kv)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    out.push(`<${tag} ${serialized}/>`);
  }
  if (out.length === 0) throw new Error(`parsed no nodes from ${lucideName}.mjs`);
  return out.join('');
}

async function main() {
  const names = await readIconNames();
  const symbols = [];
  const substitutions = [];

  for (const name of names) {
    const lucideName = ALIASES[name] ?? name;
    if (lucideName !== name) substitutions.push(`${name} -> ${lucideName}`);
    let nodes;
    try {
      nodes = await readLucideNode(lucideName);
    } catch (err) {
      // Fail loudly: a silently missing symbol renders as an empty box.
      throw new Error(`icon "${name}" (lucide "${lucideName}"): ${err.message}`);
    }
    // Lucide's own 24-unit grid is kept rather than rescaled to the 48-unit
    // box the other sprites use. <use> maps the symbol's viewBox onto the
    // host <svg>'s viewport, so it scales to match — and stroke-width
    // scales with it, which is what keeps the weight right at every size.
    symbols.push(
      `<symbol id="ic-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes}</symbol>`
    );
  }

  const sprite =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n' +
    '<defs>\n' +
    symbols.join('\n') +
    '\n</defs>\n</svg>\n';
  await writeFile(OUT_SPRITE, sprite, 'utf8');

  // Register the style so the picker in theme-controls renders it.
  let ts = await readFile(NAMES_TS, 'utf8');
  if (!/"lucide"/.test(ts)) {
    ts = ts.replace(/(ICON_STYLES = \[)([\s\S]*?)(\n\] as const;)/, (_m, open, body, close) =>
      `${open}${body},\n  "lucide"${close}`
    );
    ts = ts.replace(/(pixel: 'Pixel Art',)/, `$1\n  lucide: 'Lucide',`);
    await writeFile(NAMES_TS, ts, 'utf8');
  }

  console.log(`icons-lucide.svg: ${symbols.length} symbols`);
  console.log(`aliased: ${substitutions.length}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
