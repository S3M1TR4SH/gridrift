export { VERSION } from './version.js';
export { LIMITS } from './guardrails/limits.js';
export {
  findUnsafeLiterals,
  validateGameConfig,
  validatePacing,
  validateTuning
} from './guardrails/validate.js';
export { createPacer, neutralizePacing } from './pacing/pacer.js';
export { createGuardedAds } from './ads/guard.js';
export { createNoopAdapter } from './ads/noop.js';
export { createPlaceholderAdapter } from './ads/placeholder.js';
export { createH5GamesAdsAdapter } from './ads/h5/adapter.js';
export { createAdMobAdapter } from './ads/admob/adapter.js';
export { createCapacitorAdMobBridge } from './ads/admob/capacitor.js';
export { createWebAdBridge } from './ads/bridge.js';
export { GOOGLE_TEST_ADS } from './ads/admob/demo-units.js';
export { createMixpanelAdapter } from './analytics/adapters/mixpanel.js';
export { ANALYTICS_SCHEMA_VERSION, EVENT_NAMES, createEvent } from './analytics/schema.js';
export { createTracker } from './analytics/tracker.js';
export {
  COPPA_AGE,
  CONSENT_STORAGE_KEY,
  ageFromBirthYear,
  applyAnalyticsChoice,
  canNotify,
  consentFromBirthYear,
  createConsentStore,
  evaluateAgeGate,
  memoryStorage
} from './consent/age-gate.js';
export { celebrationLevel, createFeedback } from './juice/feedback.js';
export { createInstallController } from './pwa/install.js';
export { buildManifest } from './pwa/manifest.js';
export { registerRoutes } from './pwa/sw.js';
