import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { startStaticServer } from '../studio-core/sim/static-server.js';

const PACING_URL = '/config/pacing.json';
const TUNING_URL = '/config/tuning.json';

export async function createAdapter({ root = process.cwd() } = {}) {
  const server = await startStaticServer({ root });
  let browser = null;
  let context = null;
  let page = null;
  let clockMs = 0;

  return {
    async start({ seed = 1, variant } = {}) {
      if (variant?.pacingPath) server.setOverride(PACING_URL, resolve(root, variant.pacingPath));
      else server.clearOverride(PACING_URL);
      if (variant?.tuningPath) server.setOverride(TUNING_URL, resolve(root, variant.tuningPath));
      else server.clearOverride(TUNING_URL);
      if (!browser) {
        browser = await chromium.launch({
          headless: true,
          args: ['--disable-dev-shm-usage']
        });
      }
      await context?.close();
      context = await browser.newContext({
        viewport: { width: 420, height: 800 },
        serviceWorkers: 'block'
      });
      page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      clockMs = 1_700_000_000_000 + (Number(seed) * 60_000);
      await page.clock.install({ time: clockMs });
      await page.clock.pauseAt(clockMs);
      await page.goto(`${server.url}/?sim=1`, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForFunction(() => globalThis.__playerSim?.ready === true, null, { timeout: 15000 });
      } catch (error) {
        const boot = await page.locator('#boot-error').textContent().catch(() => '');
        throw new Error(`Sim bridge was not ready. ${boot || ''} ${errors.join(' ')} ${error.message}`.trim());
      }
    },
    async readState() {
      return page.evaluate(() => globalThis.__playerSim.getState());
    },
    async listActions() {
      const state = await this.readState();
      return state.actions ?? [];
    },
    async perform(action) {
      return page.evaluate((next) => globalThis.__playerSim.perform(next), action);
    },
    async isGameOver() {
      return page.evaluate(() => globalThis.__playerSim.isGameOver() === true);
    },
    async advanceTime(ms) {
      clockMs += ms;
      await page.clock.setSystemTime(clockMs);
    },
    async stop() {
      const current = context;
      context = null;
      page = null;
      await current?.close();
    },
    async dispose() {
      await context?.close();
      context = null;
      page = null;
      await browser?.close();
      browser = null;
      await server.close();
    }
  };
}
