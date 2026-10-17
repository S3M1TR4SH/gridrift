import { createGuardedAds } from '../ads/guard.js';
import { createPacer } from '../pacing/pacer.js';

function testAdapter() {
  return {
    id: 'h5-games-ads',
    testMode: true,
    showInterstitial() {
      return { shown: true, rewarded: false, reason: 'h5_test' };
    },
    showRewarded() {
      return { shown: true, rewarded: true, reason: 'h5_test' };
    }
  };
}

export function sessionNumberForSim({ variant, seed } = {}) {
  const path = String(variant?.pacingPath || '');
  const gate = variant?.id === 'gate' || path.includes('gate-ads-on');
  if (!gate) return 1;
  const number = Math.floor(Number(seed) || 1);
  return number <= 1 ? 1 : Math.min(8, number);
}

export function runAdSessions({
  pacing,
  sessions = 4,
  thinkMs = 3000,
  movesPerRound = 8,
  rounds = 2,
  adapter
} = {}) {
  const inner = adapter ?? testAdapter();
  const rows = [];
  let clock = 1_700_000_000_000;
  const now = () => clock;
  for (let sessionNumber = 1; sessionNumber <= sessions; sessionNumber += 1) {
    const pacer = createPacer({
      pacing,
      now,
      sessionNumber,
      isChild: () => false
    });
    const ads = createGuardedAds({ pacer, adapter: inner });
    const row = {
      sessionNumber,
      interstitials: 0,
      rewardedOffers: 0,
      midMoveAds: 0,
      cooldownBreaks: 0
    };
    for (let round = 1; round <= rounds; round += 1) {
      for (let move = 0; move < movesPerRound; move += 1) {
        const mid = ads.showInterstitial({ breakType: 'gameplay' });
        if (mid.shown) row.midMoveAds += 1;
        clock += thinkMs;
      }
      pacer.recordRoundEnded();
      const breakType = round < rounds ? 'between_rounds' : 'game_over';
      const shown = ads.showInterstitial({ breakType });
      if (shown.shown) {
        row.interstitials += 1;
        const rushed = ads.showInterstitial({ breakType: 'between_rounds' });
        if (rushed.shown) row.cooldownBreaks += 1;
      }
      if (breakType === 'game_over' && ads.canOfferRewarded('continue')) row.rewardedOffers += 1;
    }
    rows.push(row);
  }
  const total = (key) => rows.reduce((sum, row) => sum + row[key], 0);
  return {
    sessions: rows,
    interstitials: total('interstitials'),
    rewardedOffers: total('rewardedOffers'),
    midMoveAds: total('midMoveAds'),
    cooldownBreaks: total('cooldownBreaks'),
    firstSessionInterstitials: rows[0]?.interstitials ?? 0
  };
}
