import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COPPA_AGE,
  applyAnalyticsChoice,
  canNotify,
  consentFromBirthYear,
  createConsentStore,
  evaluateAgeGate,
  memoryStorage
} from '../consent/age-gate.js';

test('under 13 gets non-personalized ads and no analytics or notifications', () => {
  const state = evaluateAgeGate({ band: 'under13' });
  assert.equal(COPPA_AGE, 13);
  assert.equal(state.isChild, true);
  assert.equal(state.analyticsAllowed, false);
  assert.equal(state.adsAllowed, true);
  assert.equal(state.personalizedAds, false);
  assert.equal(state.nonPersonalizedAds, true);
  assert.equal(state.childDirected, true);
  assert.equal(state.needsAnalyticsPrompt, false);
  assert.equal(state.notificationsAllowed, false);
  assert.equal(canNotify(state), false);
  const forced = applyAnalyticsChoice(state, 'granted');
  assert.equal(forced.analyticsAllowed, false);
  assert.equal(forced.notificationsAllowed, false);
  assert.equal(forced.personalizedAds, false);
  assert.equal(forced.adsAllowed, true);
});

test('13 or older stays opted out until an explicit grant', () => {
  const state = evaluateAgeGate({ band: '13plus' });
  assert.equal(state.isChild, false);
  assert.equal(state.analyticsAllowed, false);
  assert.equal(state.adsAllowed, true);
  assert.equal(state.personalizedAds, false);
  assert.equal(state.needsAnalyticsPrompt, true);
  const denied = applyAnalyticsChoice(state, 'denied');
  assert.equal(denied.analyticsAllowed, false);
  assert.equal(denied.needsAnalyticsPrompt, false);
  const granted = applyAnalyticsChoice(state, 'granted');
  assert.equal(granted.analyticsAllowed, true);
});

test('stored child consent cannot be tampered back on', () => {
  const storage = memoryStorage();
  const store = createConsentStore(storage);
  store.save(evaluateAgeGate({ band: 'under13' }));
  const raw = JSON.parse(storage.getItem('studio-core.consent.v1'));
  raw.analyticsAllowed = true;
  raw.adsAllowed = false;
  raw.personalizedAds = true;
  raw.notificationsAllowed = true;
  raw.nonPersonalizedAds = false;
  raw.childDirected = false;
  storage.setItem('studio-core.consent.v1', JSON.stringify(raw));
  const loaded = store.load();
  assert.equal(loaded.isChild, true);
  assert.equal(loaded.analyticsAllowed, false);
  assert.equal(loaded.adsAllowed, true);
  assert.equal(loaded.personalizedAds, false);
  assert.equal(loaded.nonPersonalizedAds, true);
  assert.equal(loaded.childDirected, true);
  assert.equal(loaded.notificationsAllowed, false);
  assert.equal(canNotify(loaded), false);
});

test('a birth year is remembered and under 13 gets non-personalized ads only', () => {
  const now = new Date('2026-10-17T00:00:00Z');
  const child = consentFromBirthYear(2018, now);
  assert.equal(child.birthYear, 2018);
  assert.equal(child.isChild, true);
  assert.equal(child.adsAllowed, true);
  assert.equal(child.personalizedAds, false);
  assert.equal(child.nonPersonalizedAds, true);
  assert.equal(child.analyticsAllowed, false);
  assert.equal(child.notificationsAllowed, false);
  assert.equal(child.needsAnalyticsPrompt, false);
  assert.equal(canNotify(child), false);
  const adult = consentFromBirthYear(1990, now);
  assert.equal(adult.isChild, false);
  assert.equal(adult.adsAllowed, true);
  assert.equal(adult.analyticsAllowed, false);
  assert.equal(adult.needsAnalyticsPrompt, true);
  assert.equal(adult.notificationsAllowed, true);
  assert.equal(canNotify(adult), true);
  const storage = memoryStorage();
  const store = createConsentStore(storage);
  const saved = store.save(child);
  assert.equal(store.load().birthYear, saved.birthYear);
  assert.equal(store.load().isChild, true);
});

test('age gate rejects a missing answer', () => {
  assert.throws(() => evaluateAgeGate({}));
  assert.throws(() => evaluateAgeGate(null));
});
