import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import assetLinks from '../web/.well-known/assetlinks.json' with { type: 'json' };
import twa from '../android/twa-manifest.json' with { type: 'json' };
import vercel from '../vercel.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function section(markdown, heading) {
  const pattern = new RegExp(`## ${heading}\\n+([^\\n]+)`);
  const match = markdown.match(pattern);
  assert.ok(match, heading);
  return match[1].trim();
}

test('the bubblewrap manifest and asset links use placeholders, not a keystore', () => {
  assert.equal(twa.packageId, 'com.gridrift.app');
  assert.equal(twa.host, 'gridrift.vercel.app');
  assert.equal(twa.startUrl, '/');
  const launchUrl = `https://${twa.host}${twa.startUrl}`;
  assert.equal(launchUrl, 'https://gridrift.vercel.app/');
  const strings = readFileSync(join(root, 'android/app/src/main/res/values/strings.xml'), 'utf8');
  assert.match(strings, new RegExp(`<string name="launchUrl">${launchUrl}</string>`));
  assert.match(strings, /<string name="hostName">gridrift\.vercel\.app<\/string>/);
  const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
  assert.equal(gradle.includes('play-services-ads'), false);
  assert.match(gradle, /applicationId 'com\.gridrift\.app'/);
  assert.equal(assetLinks[0].target.package_name, 'com.gridrift.app');
  assert.deepEqual(assetLinks[0].target.sha256_cert_fingerprints, ['REPLACE_WITH_RELEASE_CERT_SHA256']);
  const header = vercel.headers.find((item) => item.source === '/.well-known/assetlinks.json');
  assert.equal(header.headers.some((item) => item.key === 'Content-Type' && item.value === 'application/json'), true);
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /\*\.keystore/);
  assert.equal(existsSync(join(root, 'android/android.keystore')), false);
  for (const name of readdirSync(join(root, 'android'))) {
    assert.equal(name.endsWith('.keystore') || name.endsWith('.jks'), false, name);
  }
});

test('the static build publishes asset links and the workflow skips signing without secrets', () => {
  execFileSync('node', ['scripts/build-static.js'], { cwd: root, stdio: 'pipe' });
  const built = join(root, 'dist/.well-known/assetlinks.json');
  assert.equal(existsSync(built), true);
  assert.deepEqual(JSON.parse(readFileSync(built, 'utf8')), assetLinks);
  const workflow = readFileSync(join(root, '.github/workflows/android-aab.yml'), 'utf8');
  for (const name of ['ANDROID_KEYSTORE_BASE64', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) {
    assert.equal(workflow.includes(name), true, name);
  }
  assert.match(workflow, /bundleDebug/);
  assert.match(workflow, /skipping release signing/);
  assert.equal(workflow.includes('BEGIN '), false);
});

test('store drafts describe this build and are not a submission', () => {
  for (const name of ['data-safety.md', 'content-rating-iarc.md', 'listing.md']) {
    const text = readFileSync(join(root, 'store', name), 'utf8');
    assert.match(text, /Draft only/);
    assert.match(text, /not submitted|Nothing in `store\/` is submitted/i);
  }
  const safety = readFileSync(join(root, 'store/data-safety.md'), 'utf8');
  assert.match(safety, /under 13/i);
  assert.match(safety, /email/i);
  assert.match(safety, /bridge_unavailable|does not transmit/i);
  const rating = readFileSync(join(root, 'store/content-rating-iarc.md'), 'utf8');
  assert.match(rating, /Does the app contain violence\? No/);
  assert.match(rating, /Does the app simulate gambling\? No/);
  const listing = readFileSync(join(root, 'store/listing.md'), 'utf8');
  const title = section(listing, 'Title');
  const short = section(listing, 'Short description');
  assert.equal(title, 'Gridrift');
  assert.ok(title.length <= 30);
  assert.ok(short.length > 0 && short.length <= 80, short);
  assert.match(listing, /icon\.gridrift\.icon-512/);
  assert.match(listing, /fx\.particle\.1/);
  assert.match(listing, /v0\.2\.0/);
});
