import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInstallController } from '../pwa/install.js';
import { buildManifest } from '../pwa/manifest.js';
import { registerRoutes } from '../pwa/sw.js';

test('manifest helper emits an installable standalone app', () => {
  const manifest = buildManifest({
    name: 'Gridrift',
    shortName: 'Gridrift',
    description: 'Puzzle',
    startUrl: './',
    scope: './',
    themeColor: '#12141c',
    backgroundColor: '#12141c',
    icons: [
      { src: 'branding/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'branding/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  });
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.icons.length, 2);
  assert.equal(manifest.icons[0].sizes, '192x192');
});

test('install prompt waits for a user gesture', async () => {
  let prompted = false;
  const event = {
    preventDefault() {
      this.prevented = true;
    },
    async prompt() {
      prompted = true;
    },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  };
  const controller = createInstallController();
  assert.equal(controller.available, false);
  controller.capture(event);
  assert.equal(event.prevented, true);
  assert.equal(prompted, false);
  assert.equal(controller.available, true);
  const choice = await controller.prompt();
  assert.equal(prompted, true);
  assert.equal(choice.outcome, 'accepted');
  assert.equal(controller.available, false);
});

function mockScope() {
  const listeners = {};
  const stored = new Map();
  const cache = {
    added: null,
    async match(request) {
      return stored.get(request.url) ?? null;
    },
    async put(request, response) {
      stored.set(request.url, response);
    },
    async addAll(urls) {
      this.added = urls;
    }
  };
  const scope = {
    listeners,
    cache,
    stored,
    deleted: [],
    skipped: false,
    claimed: false,
    fetches: [],
    caches: {
      async open() {
        return cache;
      },
      async keys() {
        return ['stale-cache'];
      },
      async delete(key) {
        scope.deleted.push(key);
      }
    },
    async fetch(request) {
      scope.fetches.push(request.url);
      return {
        ok: true,
        url: request.url,
        clone() {
          return { ok: true, url: request.url, cloned: true };
        }
      };
    },
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
    async skipWaiting() {
      scope.skipped = true;
    },
    clients: {
      async claim() {
        scope.claimed = true;
      }
    }
  };
  return scope;
}

test('service worker precaches same-origin files and ignores everyone else', async () => {
  const scope = mockScope();
  registerRoutes(scope, {
    cacheName: 'gridrift-test',
    urls: ['./index.html', './src/main.js'],
    origin: 'https://gridrift.example'
  });

  const install = { waitUntil(promise) { this.done = promise; } };
  scope.listeners.install(install);
  await install.done;
  assert.deepEqual(scope.cache.added, ['./index.html', './src/main.js']);
  assert.equal(scope.skipped, true);

  const activate = { waitUntil(promise) { this.done = promise; } };
  scope.listeners.activate(activate);
  await activate.done;
  assert.deepEqual(scope.deleted, ['stale-cache']);
  assert.equal(scope.claimed, true);

  let responded = false;
  scope.listeners.fetch({
    request: { method: 'GET', url: 'https://ads.example/banner.js' },
    respondWith() {
      responded = true;
    }
  });
  assert.equal(responded, false);
  assert.deepEqual(scope.fetches, []);

  const hit = {
    request: { method: 'GET', url: 'https://gridrift.example/index.html' },
    respondWith(promise) { this.done = promise; }
  };
  scope.listeners.fetch(hit);
  const response = await hit.done;
  assert.equal(response.url, 'https://gridrift.example/index.html');
  assert.equal(scope.fetches.length, 1);
  assert.equal(scope.stored.size, 1);

  scope.fetches.length = 0;
  const cached = {
    request: { method: 'GET', url: 'https://gridrift.example/index.html' },
    respondWith(promise) { this.done = promise; }
  };
  scope.listeners.fetch(cached);
  const second = await cached.done;
  assert.equal(second.url, 'https://gridrift.example/index.html');
  assert.deepEqual(scope.fetches, []);
});
