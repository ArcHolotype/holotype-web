import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// Typography guard for the site. Every string in app/ ends up rendered to a visitor, and
// the surface is English-only, so the only non-ASCII glyphs allowed are the marks we
// deliberately typeset with: arrows, dashes, middots, quotes, maths, degrees. Anything
// else — a stray glyph or prose pasted from another locale — fails here rather than
// shipping in a build that looks fine locally.
const APPROVED_GLYPHS = new Set([
  '—','–','·','•','…','§','×','−','≈','≠','≤','≥','°',
  '→','←','↑','↓','↔','⇒',
  '✓','✗','⚠','™',
  '“','”','‘','’',
]);

const site = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SELF = path.basename(new URL(import.meta.url).pathname);
const TEXT_EXT = new Set(['.ts','.tsx','.js','.jsx','.mjs','.css','.html','.json','.md']);
const SKIP_DIRS = new Set(['node_modules','dist','.next','.wrangler','.git']);
const SCANNED = ['app','tests'].map((dir) => path.join(site, dir));

function* walk(target) {
  if (!existsSync(target)) return;
  if (!statSync(target).isDirectory()) { yield target; return; }
  for (const entry of readdirSync(target)) {
    if (SKIP_DIRS.has(entry)) continue;
    yield* walk(path.join(target, entry));
  }
}

const files = () => SCANNED.flatMap((t) => [...walk(t)])
  .filter((f) => TEXT_EXT.has(path.extname(f)) && path.basename(f) !== SELF);

const unexpected = () => {
  const found = [];
  for (const file of files()) {
    const rel = path.relative(site, file);
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const ch of line) {
        if (ch.charCodeAt(0) > 127 && !APPROVED_GLYPHS.has(ch)) {
          found.push(`${rel}:${i + 1} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
        }
      }
    });
  }
  return found;
};

test('site sources use only the approved typographic glyphs', () => {
  assert.deepEqual(unexpected(), [], 'unexpected characters in visitor-facing sources — retype in ASCII, or add the glyph to APPROVED_GLYPHS if it is a deliberate typesetting choice');
});

test('the typography scan still covers the surfaces it claims to', () => {
  const scanned = files();
  assert.ok(scanned.length >= 15, `only scanned ${scanned.length} files — the SCANNED paths above are probably wrong`);
  for (const expected of ['living-holo.tsx','records.tsx','nectar.tsx','fly-habitat.tsx','demo-workflow.ts']) {
    assert.ok(scanned.some((f) => f.endsWith(expected)), `${expected} is no longer scanned`);
  }
});
