import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateGameConfig } from '../../../index.js';
import { bootShell } from '../game/shell.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pacing = JSON.parse(readFileSync(join(root, 'config/pacing.json'), 'utf8'));
const tuning = JSON.parse(readFileSync(join(root, 'config/tuning.json'), 'utf8'));

test('the sample genre boots through the public API and refuses an over-limit config', () => {
  const checked = validateGameConfig({ pacing, tuning });
  assert.equal(checked.ok, true);
  const shell = bootShell({ pacing, tuning });
  assert.equal(shell.genre.id, 'sample');
  assert.equal(shell.genre.step({ score: 1 }).score, 2);
  assert.equal(shell.ads.id, 'noop');
  assert.equal(shell.ads.showInterstitial({ breakType: 'game_over' }).shown, false);
  const child = bootShell({ pacing, tuning, answer: { band: 'under13' } });
  assert.equal(child.consent.isChild, true);
  assert.equal(child.ads.showRewarded({ placement: 'continue', optedIn: true }).reason, 'guardrail');
  assert.throws(() => bootShell({
    pacing: { ...pacing, difficulty: { ...pacing.difficulty, failBias: 1 } },
    tuning
  }));
});
