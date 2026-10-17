import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function normalizePath(pathname) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

export function startStaticServer({ root, port = 0, overrides = {} } = {}) {
  const directory = resolve(root);
  const map = new Map(Object.entries(overrides).map(([key, value]) => [normalizePath(key), value]));
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const override = map.get(url.pathname);
    if (override) {
      if (!existsSync(override) || !statSync(override).isFile()) {
        send(res, 404, 'Not found');
        return;
      }
      send(res, 200, readFileSync(override), TYPES[extname(override)] ?? 'application/octet-stream');
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const relativePath = pathname.replace(/^[/\\]+/, '');
    const target = resolve(directory, relativePath);
    const outside = relative(directory, target);
    if (outside.startsWith('..') || isAbsolute(outside)) {
      send(res, 404, 'Not found');
      return;
    }
    if (!existsSync(target) || !statSync(target).isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    send(res, 200, readFileSync(target), TYPES[extname(target)] ?? 'application/octet-stream');
  });

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolvePromise({
        url: `http://127.0.0.1:${address.port}`,
        setOverride(pathname, file) {
          map.set(normalizePath(pathname), file);
        },
        clearOverride(pathname) {
          map.delete(normalizePath(pathname));
        },
        close() {
          return new Promise((done) => server.close(() => done()));
        }
      });
    });
  });
}
