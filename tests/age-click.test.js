import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { startStaticServer } from '../studio-core/sim/index.js';

test('the age screen continue button accepts the first click', async () => {
  const server = await startStaticServer({ root: new URL('..', import.meta.url).pathname });
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${server.url}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#birth-year');
    const before = await page.locator('#overlay h2').innerText();
    assert.equal(before, 'What year were you born?');
    const button = page.locator('#overlay button');
    assert.equal(await button.isDisabled(), true);
    await button.click({ force: true });
    assert.equal(await page.locator('#overlay h2').innerText(), 'What year were you born?');
    await page.selectOption('#birth-year', '1990');
    assert.equal(await button.isDisabled(), false);
    assert.equal(await button.getAttribute('data-action'), 'birth_year:1990');
    await button.click();
    await page.waitForFunction(() => {
      const heading = document.querySelector('#overlay h2');
      return heading?.textContent !== 'What year were you born?';
    });
    const after = await page.locator('#overlay h2').innerText();
    assert.notEqual(after, 'What year were you born?');
  } finally {
    await browser.close();
    await server.close();
  }
});
