import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const requested = process.argv[2] ?? '.';
const root = resolve(here, '..', requested);
const port = Number(process.env.PORT) || 4173;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function fileFor(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  let pathname = decoded.replace(/^[/\\]+/, '');
  if (pathname === '' || decoded.endsWith('/')) pathname = `${pathname}index.html`;
  const target = resolve(root, pathname);
  const outside = relative(root, target);
  if (outside.startsWith('..') || isAbsolute(outside)) return null;
  return target;
}

const server = createServer((req, res) => {
  const target = fileFor(req.url || '/');
  if (!target || !existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const type = types[extname(target)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(readFileSync(target));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Gridrift at http://127.0.0.1:${port}`);
  console.log(`Serving ${root}`);
});
