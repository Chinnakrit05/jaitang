#!/usr/bin/env node
// Build the `tabler` icon sprite from the @tabler/icons package.
//
// Companion to build-icon-sprite.mjs, which builds the five hand-drawn
// sets and OWNS the ICON_NAMES list; this one reads that list back and
// fills it with Tabler glyphs. Same contract as build-lucide-sprite.mjs,
// so the three run in order:
//
//     node scripts/build-icon-sprite.mjs     # regenerates ICON_NAMES
//     node scripts/build-lucide-sprite.mjs   # re-adds the lucide style
//     node scripts/build-tabler-sprite.mjs   # re-adds the tabler style
//
// Output: public/icons-tabler.svg, plus the `tabler` entries appended to
// ICON_STYLES / ICON_STYLE_LABELS in icon-names.ts.
//
// Tabler ships ~5,100 outline SVGs, so the substitutions below are a lot
// closer than Lucide's — ramen is an actual bowl with chopsticks, and
// money-bag and ring are the real thing rather than stand-ins.

import { readFile, writeFile } from 'node:fs/promises';
import { EXTRA_ICONS, extraIconNamesSource } from './extra-icons.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMES_TS = join(ROOT, 'src', 'components', 'icons', 'icon-names.ts');
const TABLER_DIR = join(ROOT, 'node_modules', '@tabler', 'icons', 'icons', 'outline');
const OUT_SPRITE = join(ROOT, 'public', 'icons-tabler.svg');
const OUT_EXTRA_TS = join(ROOT, 'src', 'components', 'icons', 'extra-icon-names.ts');

/**
 * App icon name -> Tabler icon name, for the names Tabler doesn't carry
 * verbatim. Three kinds live here: our domain words ("balances",
 * "loans"), drawings Tabler files under another noun ("house" -> "home"),
 * and its own naming conventions ("play" -> "player-play", every device
 * prefixed "device-").
 *
 * Unlike the Lucide map there are no real compromises left — the only
 * loose ones are the abstract domain words, which have no literal glyph
 * in any icon set.
 */
const ALIASES = {
  accounts: 'wallet',
  airplane: 'plane',
  'archive-restore': 'restore',
  atm: 'building-bank',
  balances: 'scale',
  banknote: 'cash-banknote',
  'bar-chart-3': 'chart-bar',
  bitcoin: 'currency-bitcoin',
  bot: 'robot',
  budgets: 'calculator',
  'building-2': 'building',
  bullseye: 'target-arrow',
  'calendar-domain': 'calendar',
  camping: 'tent',
  'cash-stack': 'cash',
  categories: 'category',
  chat: 'message-circle',
  'check-circle-2': 'circle-check',
  'check-square': 'square-check',
  'coin-purse': 'wallet',
  'credit-card-emoji': 'credit-card',
  'cruise-ship': 'ship',
  'file-bar-chart': 'file-analytics',
  'game-controller': 'device-gamepad-2',
  goals: 'flag',
  'gold-coin': 'coin',
  'graduation-cap': 'school',
  'handcoins-domain': 'coins',
  house: 'home',
  import: 'file-import',
  insights: 'bulb',
  landmark: 'building-bank',
  laptop: 'device-laptop',
  layers: 'stack',
  ledgers: 'notebook',
  lightbulb: 'bulb',
  'line-chart-domain': 'chart-line',
  'link-2': 'link',
  loans: 'businessplan',
  mic: 'microphone',
  'money-bag': 'moneybag',
  more: 'dots',
  party: 'confetti',
  pause: 'player-pause',
  'phone-wallet': 'device-mobile-dollar',
  'piggy-bank': 'pig-money',
  'piggybank-domain': 'pig-money',
  'plane-domain': 'plane',
  play: 'player-play',
  'plus-fab': 'plus',
  quick: 'bolt',
  ramen: 'bowl-chopsticks',
  recurring: 'repeat',
  // Tabler's "rings" is the gymnastics apparatus, not jewellery.
  ring: 'diamond',
  'rotate-ccw': 'rotate',
  'scale-domain': 'scale',
  'scan-line': 'scan',
  smartphone: 'device-mobile',
  'target-domain': 'target',
  transactions: 'arrows-exchange',
  trash2: 'trash',
  'trending-flat': 'arrow-right',
  'trending-up-invest': 'trending-up',
  trips: 'luggage',
  'wallet-domain': 'wallet',
  zap: 'bolt',
};

/** Pull the canonical icon list out of the generated types file. */
async function readIconNames() {
  const src = await readFile(NAMES_TS, 'utf8');
  const block = src.split('ICON_NAMES = [')[1]?.split('] as const')[0];
  if (!block) throw new Error('ICON_NAMES not found in icon-names.ts');
  return [...block.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

/**
 * Take the drawing out of a Tabler SVG file.
 *
 * Every file opens with an invisible full-box path that exists to pin the
 * bounding box in design tools. It renders nothing, so it is dropped
 * rather than shipped 137 times over.
 */
async function readTablerNodes(tablerName) {
  const src = await readFile(join(TABLER_DIR, `${tablerName}.svg`), 'utf8');
  const inner = src.split(/<svg[^>]*>/)[1]?.split('</svg>')[0];
  if (!inner) throw new Error(`no <svg> body in ${tablerName}.svg`);
  const nodes = [...inner.matchAll(/<(\w+)\s([^>]*?)\/>/gs)]
    .map(([, tag, attrs]) => `<${tag} ${attrs.replace(/\s+/g, ' ').trim()}/>`)
    .filter((node) => !node.includes('M0 0h24v24H0z'));
  if (nodes.length === 0) throw new Error(`parsed no nodes from ${tablerName}.svg`);
  return nodes.join('');
}

async function main() {
  // The shared 137 first, then the vector-only extras. Both end up in the
  // same sprite; what separates them is that the hand-drawn styles have no
  // symbol for the second group, which is what JtIcon's fallback handles.
  const names = await readIconNames();
  const symbols = [];
  const substitutions = [];

  // Tabler's own 24-unit grid is kept rather than rescaled to the
    // 48-unit box the hand-drawn sprites use — <use> maps the symbol's
    // viewBox onto the host <svg>'s viewport, and stroke-width scales
    // with it, which is what keeps the weight right at every size.
  async function addSymbol(name, sourceName) {
    if (sourceName !== name) substitutions.push(`${name} -> ${sourceName}`);
    let nodes;
    try {
      nodes = await readTablerNodes(sourceName);
    } catch (err) {
      // Fail loudly: a silently missing symbol renders as an empty box.
      throw new Error(`icon "${name}" (tabler "${sourceName}"): ${err.message}`);
    }
    symbols.push(
      `<symbol id="ic-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes}</symbol>`
    );
  }

  for (const name of names) await addSymbol(name, ALIASES[name] ?? name);
  for (const icon of EXTRA_ICONS) await addSymbol(icon.name, icon.tabler ?? icon.name);

  const sprite =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n' +
    '<defs>\n' +
    symbols.join('\n') +
    '\n</defs>\n</svg>\n';
  await writeFile(OUT_SPRITE, sprite, 'utf8');

  // Register the style so the picker in theme-controls renders it.
  let ts = await readFile(NAMES_TS, 'utf8');
  if (!/"tabler"/.test(ts)) {
    ts = ts.replace(/(ICON_STYLES = \[)([\s\S]*?)(\n\] as const;)/, (_m, open, body, close) =>
      `${open}${body},\n  "tabler"${close}`
    );
    ts = ts.replace(/(lucide: 'Lucide',)/, `$1\n  tabler: 'Tabler',`);
    await writeFile(NAMES_TS, ts, 'utf8');
  }

  // Regenerated from extra-icons.mjs alone, so both builders write the
  // same bytes and neither has to run before the other.
  await writeFile(OUT_EXTRA_TS, extraIconNamesSource(), 'utf8');

  console.log(
    `icons-tabler.svg: ${symbols.length} symbols (${names.length} shared + ${EXTRA_ICONS.length} extra)`
  );
  console.log(`aliased: ${substitutions.length}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
