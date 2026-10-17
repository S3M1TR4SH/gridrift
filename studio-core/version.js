import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.1.0';

export function readVersionFile() {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, 'VERSION'), 'utf8').trim();
}
