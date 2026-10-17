import { appendFile, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function appendHistory(file, entry) {
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function readHistory(target) {
  let info;
  try {
    info = await stat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = info.isDirectory()
    ? (await readdir(target)).filter((name) => name.endsWith('.jsonl')).sort().map((name) => join(target, name))
    : [target];
  const entries = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      entries.push(JSON.parse(line));
    }
  }
  entries.sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
  return entries;
}
