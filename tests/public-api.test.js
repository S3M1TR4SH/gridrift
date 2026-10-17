import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createAdMobAdapter,
  createCapacitorAdMobBridge,
  createH5GamesAdsAdapter,
  createNoopAdapter,
  VERSION
} from '../studio-core/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith('.js')) files.push(full);
  }
  return files;
}

test('the host imports studio-core only through its public entries', () => {
  const files = [
    ...walk(join(root, 'src')),
    ...walk(join(root, 'scripts')),
    ...walk(join(root, 'sim')),
    ...walk(join(root, 'tests')),
    join(root, 'sw.js')
  ];
  const importRe = /from\s+['"]([^'"]*studio-core[^'"]*)['"]/g;
  assert.ok(files.length > 10);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(importRe)) {
      const spec = match[1];
      const allowed = spec.endsWith('studio-core/index.js') || spec.endsWith('studio-core/sim/index.js');
      assert.equal(allowed, true, `${relative(root, file)} imports ${spec}`);
    }
  }
  const bundle = readFileSync(join(root, '.github/workflows/studio-shell-aab.yml'), 'utf8');
  assert.match(bundle, /studio-core\/templates\/new-game\/android/);
  assert.match(bundle, /bundleRelease/);
  assert.match(bundle, /bundleDebug/);
  assert.equal(VERSION, '0.2.0');
  assert.equal(createNoopAdapter().id, 'noop');
  assert.equal(createH5GamesAdsAdapter().id, 'h5-games-ads');
  assert.equal(createAdMobAdapter({ bridge: createCapacitorAdMobBridge({}) }).id, 'admob');
});
