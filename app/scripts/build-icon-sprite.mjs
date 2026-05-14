#!/usr/bin/env node
// Build SVG sprites for every icon style (Sticker / Doodle / Watercolor /
// Geometric / Pixel). The style switcher in the app loads the sprite for the
// active style; symbol ids are normalized to `ic-{name}` so the same JtIcon
// call (`<JtIcon name="home" />`) resolves correctly no matter which sprite
// is loaded.
//
// Source: ~/Documents/jaitang-icons-final/{style}/0[1-6]-*.html
// Output: public/icons-{style}.svg + src/components/icons/icon-names.ts

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_BASE = join(homedir(), 'Documents', 'jaitang-icons-final');
const OUT_TYPES = join(ROOT, 'src', 'components', 'icons', 'icon-names.ts');

const STYLES = ['sticker', 'doodle', 'watercolor', 'geometric', 'pixel'];

// Symbol ids in source files include the style suffix for the non-Sticker
// sets (e.g. `ic-home-doodle`). Normalize to bare `ic-home` so the same
// JtIcon call works against every sprite.
function normalizeSymbolId(id, style) {
  // Match `ic-<name>` or `ic-<name>-<style>`. Strip trailing `-{style}` if
  // present so all styles produce the same lookup id.
  const suffix = `-${style}`;
  if (id.endsWith(suffix)) return id.slice(0, -suffix.length);
  return id;
}

// Some Section 5 mini files in the geometric/pixel sets re-emit shared icons
// (e.g. airplane in goal palette) under alias ids like `ic-airplane-goal`.
// They're not real icon names the app calls into — drop them so the
// generated IconName union only holds the canonical names.
const ALIAS_SUFFIXES = ['-goal', '-cat'];
function isAlias(normalizedId) {
  return ALIAS_SUFFIXES.some((s) => normalizedId.endsWith(s));
}

// Per-source naming drift: a few icons ended up under different names in
// different style folders. Map them to one canonical name so the app can
// call `<JtIcon name="game-controller" />` regardless of active style.
const RENAME = {
  gamepad: 'game-controller',
};
function canonical(id) {
  const bare = id.replace(/^ic-/, '');
  if (RENAME[bare]) return `ic-${RENAME[bare]}`;
  return id;
}

function namespaceInternalIds(block, symbolId) {
  // Each symbol may define internal gradient ids (`bell-body`) reused across
  // symbols; collide if left as-is in one sprite. Suffix them with the symbol
  // id so they stay unique inside the combined document.
  const internalIds = [];
  const idRe = /\bid="([a-zA-Z][\w-]*)"/g;
  let m;
  while ((m = idRe.exec(block)) !== null) {
    if (m[1] !== symbolId) internalIds.push(m[1]);
  }
  let out = block;
  for (const id of internalIds) {
    const ns = `${id}__${symbolId.replace(/^ic-/, '')}`;
    out = out
      .replaceAll(`id="${id}"`, `id="${ns}"`)
      .replaceAll(`url(#${id})`, `url(#${ns})`)
      .replaceAll(`href="#${id}"`, `href="#${ns}"`)
      .replaceAll(`xlink:href="#${id}"`, `xlink:href="#${ns}"`);
  }
  return out;
}

async function buildOne(style) {
  const srcDir = join(ICONS_BASE, style);
  const files = (await readdir(srcDir))
    .filter((f) => /^0[1-6][^.]*\.html$/.test(f))
    // Sticker has per-pair mini files for Section 5; non-Sticker styles use
    // either one combined file or per-section minis. Globbing every 0[1-6]*
    // covers all of them.
    .sort();

  // Build a regex tolerant of both bare ids (`ic-home`) and style-suffixed
  // ones (`ic-home-doodle`).
  const symbolRe = /<symbol\s+id="(ic-[a-z0-9-]+)"[\s\S]*?<\/symbol>/g;

  const symbols = [];
  const names = new Set();
  const collisions = [];

  for (const file of files) {
    const path = join(srcDir, file);
    const html = await readFile(path, 'utf8');
    let match;
    let count = 0;
    while ((match = symbolRe.exec(html)) !== null) {
      const [rawBlock, rawId] = match;
      const stripped = normalizeSymbolId(rawId, style);
      if (isAlias(stripped)) continue; // drop reuse-marker symbols
      const id = canonical(stripped);
      if (names.has(id)) {
        collisions.push(`${id} (in ${file})`);
        continue;
      }
      // Rewrite the symbol id in the actual block too so the normalized id
      // is what ends up in the sprite.
      const block = rawBlock.replace(rawId, id);
      names.add(id);
      symbols.push(namespaceInternalIds(block, id));
      count++;
    }
  }

  const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<defs>
${symbols.join('\n')}
</defs>
</svg>
`;
  const outPath = join(ROOT, 'public', `icons-${style}.svg`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, sprite, 'utf8');
  const bytes = (await readFile(outPath)).length;
  const skipped = collisions.length ? ` · skipped ${collisions.length}` : '';
  console.log(
    `  ${style.padEnd(11)}: ${String(symbols.length).padStart(3)} symbols → ${basename(outPath)} (${(bytes / 1024).toFixed(0)} KB)${skipped}`,
  );
  return names;
}

const allNames = new Set();
for (const style of STYLES) {
  const names = await buildOne(style);
  names.forEach((n) => allNames.add(n));
}

const iconNames = [...allNames].map((id) => id.replace(/^ic-/, '')).sort();
const types = `// Auto-generated by scripts/build-icon-sprite.mjs — do not edit by hand.
// ${iconNames.length} icons (union of all icon styles).

export const ICON_NAMES = ${JSON.stringify(iconNames, null, 2)} as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_STYLES = ${JSON.stringify(STYLES, null, 2)} as const;

export type IconStyle = (typeof ICON_STYLES)[number];

export const ICON_STYLE_LABELS: Record<IconStyle, string> = {
  sticker: 'Sticker Pop',
  doodle: 'Doodle',
  watercolor: 'Watercolor',
  geometric: 'Geometric',
  pixel: 'Pixel Art',
};
`;
await mkdir(dirname(OUT_TYPES), { recursive: true });
await writeFile(OUT_TYPES, types, 'utf8');
console.log(`\n✅ ${iconNames.length} icon names (union) → ${OUT_TYPES}`);
