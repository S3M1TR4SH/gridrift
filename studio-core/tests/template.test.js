import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateGameConfig } from '../guardrails/validate.js';

const core = dirname(dirname(fileURLToPath(import.meta.url)));
const template = join(core, 'templates', 'new-game');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

test('the new-game template keeps the shared guardrail suites', () => {
  const pkg = JSON.parse(readFileSync(join(template, 'package.json'), 'utf8'));
  for (const file of [
    'tests/guardrails.test.js',
    'tests/pacing.test.js',
    'tests/consent.test.js',
    'tests/ads.test.js',
    'tests/admob.test.js'
  ]) {
    assert.equal(pkg.scripts.test.includes(file), true, file);
  }
  const pacing = JSON.parse(readFileSync(join(template, 'config/pacing.json'), 'utf8'));
  const tuning = JSON.parse(readFileSync(join(template, 'config/tuning.json'), 'utf8'));
  const checked = validateGameConfig({ pacing, tuning });
  assert.equal(checked.ok, true, JSON.stringify(checked.violations));
  const broken = validateGameConfig({
    pacing: { ...pacing, difficulty: { ...pacing.difficulty, failBias: 1 } },
    tuning
  });
  assert.equal(broken.ok, false);
  const testWorkflow = readFileSync(join(template, '.github/workflows/test.yml'), 'utf8');
  const bundleWorkflow = readFileSync(join(template, '.github/workflows/android-aab.yml'), 'utf8');
  assert.match(testWorkflow, /npm test/);
  assert.match(testWorkflow, /templates\/new-game/);
  assert.match(bundleWorkflow, /bundleRelease/);
  assert.match(bundleWorkflow, /bundleDebug/);
});

test('template sources do not name the host game or an ad SDK', () => {
  const files = walk(template).filter((file) => /\.(js|json|gradle|xml|java|md|yml)$/.test(file));
  assert.ok(files.length > 10);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(template, file);
    const body = source.replaceAll('http://schemas.android.com/apk/res/android', '');
    assert.equal(/gridrift/i.test(body), false, rel);
    assert.equal(body.includes('play-services-ads'), false, rel);
    assert.equal(/https?:\/\//i.test(body), false, rel);
  }
  const shell = readFileSync(join(template, 'game/shell.js'), 'utf8');
  assert.match(shell, /from '\.\.\/\.\.\/\.\.\/index\.js'/);
  assert.match(shell, /createNoopAdapter/);
  assert.match(readFileSync(join(template, 'game/genre.js'), 'utf8'), /export function createGenre/);
});
