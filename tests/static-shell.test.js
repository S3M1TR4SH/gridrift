import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import brand from '../branding/brand.json' with { type: 'json' };
import { PRECACHE_URLS } from '../src/precache.js';
import { buildManifest } from '../studio-core/pwa/manifest.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walkImports(relativePosix, seen = new Set()) {
  const abs = join(root, ...relativePosix.split('/'));
  if (seen.has(abs)) return [];
  seen.add(abs);
  const source = readFileSync(abs, 'utf8');
  const found = [relativePosix];
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    let next = posix.normalize(posix.join(posix.dirname(relativePosix), match[1]));
    if (next.startsWith('./')) next = next.slice(2);
    if (!next.endsWith('.js') && !next.endsWith('.json')) next += '.js';
    found.push(...walkImports(next, seen));
  }
  return found;
}

test('web manifest matches the studio-core helper and icons exist', () => {
  const expected = buildManifest(brand);
  const actual = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual(actual, expected);
  for (const icon of actual.icons) {
    assert.equal(existsSync(join(root, icon.src)), true, icon.src);
  }
});

test('precache covers the runtime module graph and placeholder icons', () => {
  const needed = new Set([
    ...walkImports('src/main.js'),
    ...walkImports('sw.js'),
    'index.html',
    'manifest.webmanifest',
    'src/styles.css',
    'branding/favicon-32.png',
    'branding/favicon.ico',
    'branding/apple-touch-icon.png'
  ]);
  const cached = new Set(PRECACHE_URLS.map((url) => url.replace(/^\.\//, '')).filter((url) => url && url !== '.'));
  for (const file of needed) {
    assert.equal(cached.has(file), true, file);
    assert.equal(existsSync(join(root, file)), true, file);
  }
  const main = readFileSync(join(root, 'src/main.js'), 'utf8');
  assert.match(main, /createGuardedAds/);
  assert.equal(main.includes('ads/poki'), false);
  assert.equal(main.includes('ads/crazygames'), false);
  assert.equal(main.includes('ads/gamedistribution'), false);
  assert.equal(main.includes('ads/playgama'), false);
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.equal(html.includes('id="ad"'), false);
  assert.match(html, /rel="manifest"/);
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.equal(vercel.outputDirectory, 'dist');
  assert.equal(vercel.buildCommand, 'npm run build');
});

function pngSize(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.readUInt32BE(0), 0x89504e47);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('generated placeholder icons have the sizes the PWA asks for', () => {
  assert.deepEqual(pngSize(join(root, 'branding/icon-192.png')), { width: 192, height: 192 });
  assert.deepEqual(pngSize(join(root, 'branding/icon-512.png')), { width: 512, height: 512 });
  assert.deepEqual(pngSize(join(root, 'branding/icon-512-maskable.png')), { width: 512, height: 512 });
  assert.deepEqual(pngSize(join(root, 'branding/apple-touch-icon.png')), { width: 180, height: 180 });
  assert.deepEqual(pngSize(join(root, 'branding/favicon-32.png')), { width: 32, height: 32 });
  const ico = readFileSync(join(root, 'branding/favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
});
