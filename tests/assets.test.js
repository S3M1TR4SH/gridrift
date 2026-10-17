import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import manifest from '../assets.manifest.json' with { type: 'json' };
import { loadAssets, placeholderFor } from '../src/assets.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('the shipped manifest keeps the asset-library pin and string ids', () => {
  const raw = readFileSync(join(root, 'assets.manifest.json'), 'utf8');
  assert.equal(raw.includes('https://'), false);
  assert.equal(manifest.library.repo, 'S3M1TR4SH/asset-library');
  assert.equal(manifest.library.tag, 'v0.2.0');
  for (const id of ['sfx.clear', 'sfx.combo', 'sfx.streak.1', 'sfx.streak.2', 'sfx.streak.3', 'sfx.invalid', 'sfx.tutorial.step', 'sfx.ui.tap', 'fx.flash']) {
    assert.ok(manifest.assets.includes(id), id);
  }
  for (let i = 1; i <= 8; i += 1) assert.ok(manifest.assets.includes(`fx.particle.${i}`));
  assert.ok(manifest.assets.includes('sfx.place'));
  assert.ok(manifest.assets.includes('icon.gridrift.icon-192'));
  assert.ok(manifest.assets.includes('icon.gridrift.icon-512'));
  assert.ok(manifest.assets.every((id) => typeof id === 'string'));
});

test('missing library files resolve to drawn placeholders', () => {
  const registry = loadAssets(manifest);
  assert.equal(registry.library.tag, 'v0.2.0');
  for (const id of manifest.assets) {
    const asset = registry.get(id);
    assert.equal(asset.placeholder, true, id);
    assert.equal(asset.status, 'placeholder');
    assert.notEqual(asset.kind, 'unknown', id);
  }
  assert.equal(registry.get('sfx.place').synth, 'place');
  assert.equal(registry.get('sfx.clear').synth, 'clear');
  assert.equal(registry.get('sfx.streak.3').synth, 'streak3');
  assert.equal(registry.get('fx.particle.1').grayscale, true);
  assert.equal(registry.get('fx.particle.8').kind, 'fx');
  assert.equal(registry.get('fx.flash').draw, 'flash');
  assert.equal(registry.get('tile.blue').draw, 'rounded-cell');
  assert.equal(registry.get('font.kenney-future').family.includes('system-ui'), true);
  assert.equal(registry.tileIds().includes('tile.back.01'), false);
  assert.equal(registry.get('icon.gridrift.icon-192').url, 'branding/icon-192.png');
  assert.equal(registry.get('icon.gridrift.icon-512').url, 'branding/icon-512.png');
  assert.equal(placeholderFor('not.in.manifest').status, 'placeholder');
});

test('a local library file can replace a placeholder, a remote url cannot', () => {
  const registry = loadAssets(manifest, {
    'tile.blue': { url: 'vendor/tile.blue.png', placeholder: false }
  });
  assert.equal(registry.get('tile.blue').placeholder, false);
  assert.equal(registry.get('tile.blue').url, 'vendor/tile.blue.png');
  assert.throws(() => loadAssets(manifest, {
    'sfx.place': { url: 'https://cdn.example/sfx.place.wav', placeholder: false }
  }));
});
