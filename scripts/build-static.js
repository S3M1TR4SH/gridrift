import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pacing from '../config/pacing.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { PRECACHE_URLS } from '../src/precache.js';
import { validateGameConfig } from '../studio-core/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = validateGameConfig({ pacing, tuning });
if (!result.ok) {
  console.error('Refusing to build. Game config exceeds studio-core guardrails.');
  console.error(JSON.stringify(result.violations, null, 2));
  process.exit(1);
}

const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const url of PRECACHE_URLS) {
  if (url === './') continue;
  const relative = url.replace(/^\.\//, '');
  const target = join(dist, relative);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, relative), target);
}

const assetLinks = join(root, 'web/.well-known/assetlinks.json');
const assetTarget = join(dist, '.well-known/assetlinks.json');
mkdirSync(dirname(assetTarget), { recursive: true });
cpSync(assetLinks, assetTarget);

console.log(`Static build wrote ${PRECACHE_URLS.length - 1} files to dist/.`);
