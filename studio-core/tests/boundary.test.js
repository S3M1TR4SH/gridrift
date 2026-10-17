import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

test('studio-core does not import the host game or outside packages', () => {
  const files = walk(root).filter((file) => file.endsWith('.js') && !file.includes(`${sep}tests${sep}`));
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    assert.equal(/gridrift/i.test(source), false, rel);
    for (const match of source.matchAll(importRe)) {
      const spec = match[1];
      if (spec.startsWith('node:')) continue;
      assert.equal(spec.startsWith('.'), true, `${rel} imports ${spec}`);
      const resolved = join(dirname(file), spec);
      const out = relative(root, resolved);
      assert.equal(out.startsWith('..'), false, `${rel} escapes via ${spec}`);
      assert.equal(out.includes(`${sep}src${sep}`) || out.startsWith(`src${sep}`), false, rel);
      assert.equal(out.startsWith(`config${sep}`), false, rel);
      assert.equal(out.startsWith(`levels${sep}`), false, rel);
      assert.equal(out.startsWith(`branding${sep}`), false, rel);
    }
  }
});
