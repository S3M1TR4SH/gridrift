import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import analytics from '../config/analytics.json' with { type: 'json' };
import { findUnsafeLiterals } from '../studio-core/guardrails/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the public mixpanel token lives in config and not in source', () => {
  assert.equal(analytics.provider, 'mixpanel');
  assert.equal(analytics.token, 'ed836db273f067452e974889de916e74');
  assert.deepEqual(findUnsafeLiterals(analytics, 'analytics.json'), []);

  const adapter = readFileSync(join(root, 'studio-core/analytics/adapters/mixpanel.js'), 'utf8');
  const tracker = readFileSync(join(root, 'studio-core/analytics/tracker.js'), 'utf8');
  const main = readFileSync(join(root, 'src/main.js'), 'utf8');
  for (const source of [adapter, tracker, main]) {
    assert.equal(source.includes('ed836db273f067452e974889de916e74'), false);
  }
  assert.match(main, /createMixpanelAdapter\(\{ token: analyticsConfig\.token \}\)/);
  assert.match(main, /analytics\.json/);
});
