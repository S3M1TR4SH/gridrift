import { LIMITS } from '../guardrails/limits.js';

export const COPPA_AGE = LIMITS.privacy.coppaAge;
export const CONSENT_STORAGE_KEY = 'studio-core.consent.v1';

export function evaluateAgeGate(answer) {
  if (!answer || (answer.band !== 'under13' && answer.band !== '13plus')) {
    throw new Error('Age gate answer is required');
  }
  if (answer.band === 'under13') {
    return {
      isChild: true,
      analyticsAllowed: false,
      adsAllowed: false,
      personalizedAds: false,
      needsAnalyticsPrompt: false,
      coppaAge: COPPA_AGE
    };
  }
  return {
    isChild: false,
    analyticsAllowed: false,
    adsAllowed: true,
    personalizedAds: false,
    needsAnalyticsPrompt: true,
    coppaAge: COPPA_AGE
  };
}

export function applyAnalyticsChoice(state, choice) {
  if (!state) throw new Error('Consent state is required');
  if (state.isChild) {
    return {
      ...state,
      analyticsAllowed: false,
      adsAllowed: false,
      personalizedAds: false,
      needsAnalyticsPrompt: false
    };
  }
  if (choice !== 'granted' && choice !== 'denied') {
    throw new Error('Analytics choice must be granted or denied');
  }
  return {
    ...state,
    analyticsAllowed: choice === 'granted',
    adsAllowed: true,
    personalizedAds: false,
    needsAnalyticsPrompt: false
  };
}

function lock(state) {
  if (!state || typeof state !== 'object') return null;
  const isChild = Boolean(state.isChild);
  return {
    isChild,
    analyticsAllowed: isChild ? false : Boolean(state.analyticsAllowed),
    adsAllowed: isChild ? false : state.adsAllowed !== false,
    personalizedAds: false,
    needsAnalyticsPrompt: isChild ? false : Boolean(state.needsAnalyticsPrompt),
    coppaAge: COPPA_AGE
  };
}

export function createConsentStore(storage, key = CONSENT_STORAGE_KEY) {
  if (!storage) throw new Error('storage is required');
  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) return null;
      try {
        return lock(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save(state) {
      const safe = lock(state);
      storage.setItem(key, JSON.stringify(safe));
      return safe;
    },
    clear() {
      storage.removeItem(key);
    }
  };
}

export function memoryStorage(initial) {
  const data = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}
