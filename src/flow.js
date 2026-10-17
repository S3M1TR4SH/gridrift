import { LIMITS } from '../studio-core/guardrails/limits.js';

export const INPUT_GUARD_MS = 400;

export function shouldIgnoreInput(now, until) {
  return now < until;
}

export function canOfferContinue(uses, rewardedAllowed) {
  return Boolean(rewardedAllowed) && uses < LIMITS.rewardedEffects.maxContinueUsesPerMatch;
}

export function rowsForContinue(requested) {
  const count = Number(requested) || 1;
  return Math.min(LIMITS.rewardedEffects.maxContinueRowsCleared, Math.max(1, Math.floor(count)));
}

export function planBreak({ type, interstitialAllowed, rewardedAllowed, continueUsed }) {
  if (type === 'between_rounds') return 'round_card';
  if (type === 'game_over') {
    if (rewardedAllowed && !continueUsed) return 'results_with_rewarded';
    if (interstitialAllowed) return 'ad_then_results';
    return 'results';
  }
  throw new Error(`unsupported break ${type}`);
}

export function planRoundAdvance({ interstitialAllowed }) {
  return interstitialAllowed ? 'ad_then_next' : 'next';
}

export function viewModel(model) {
  const score = model.score ?? 0;
  const best = model.bestStreak ?? 0;
  if (model.screen === 'age_gate') {
    return {
      screen: 'age_gate',
      title: 'How old are you?',
      body: 'Gridrift uses this only to decide ads and stats. It stays on this device.',
      adSlot: false,
      actions: [
        { id: 'age_under', label: "I'm under 13", slot: 'upper' },
        { id: 'age_13', label: "I'm 13 or older", slot: 'lower' }
      ]
    };
  }
  if (model.screen === 'kid_mode') {
    return {
      screen: 'kid_mode',
      title: 'Kid mode',
      body: 'No ads and no analytics. Have fun with the puzzle.',
      adSlot: false,
      actions: [{ id: 'start_play', label: 'Play', slot: 'lower' }]
    };
  }
  if (model.screen === 'analytics_consent') {
    return {
      screen: 'analytics_consent',
      title: 'Keep stats on this device?',
      body: 'Optional anonymous play counts. Mixpanel loads only if you allow it. No name or email is sent.',
      adSlot: false,
      actions: [
        { id: 'analytics_yes', label: 'Allow on this device', slot: 'upper' },
        { id: 'analytics_no', label: 'No thanks', slot: 'lower' }
      ]
    };
  }
  if (model.screen === 'ad_break') {
    return {
      screen: 'ad_break',
      title: 'Advertisement',
      body: 'Placeholder. This does not contact an ad network.',
      adSlot: true,
      actions: [{ id: 'close_ad', label: 'Close advertisement', slot: 'upper' }]
    };
  }
  if (model.screen === 'round_complete') {
    return {
      screen: 'round_complete',
      title: `${model.roundName ?? 'Round'} cleared`,
      body: `Score ${score}. Best streak ${best}.`,
      adSlot: false,
      actions: [{ id: 'next_round', label: 'Next', slot: 'lower' }]
    };
  }
  if (model.screen === 'game_over') {
    const actions = [{ id: 'restart', label: 'Restart', slot: 'lower' }];
    if (model.rewarded) {
      actions.unshift({ id: 'offer_continue', label: 'Continue', slot: 'upper' });
    }
    return {
      screen: 'game_over',
      title: 'No moves left',
      body: `Score ${score}. Best streak ${best}. Restart is always available.`,
      adSlot: false,
      actions
    };
  }
  if (model.screen === 'rewarded_confirm') {
    const label = model.kind === 'hint' ? 'a hint' : 'a continue';
    return {
      screen: 'rewarded_confirm',
      title: 'Optional reward',
      body: `Watch a placeholder ad for ${label}? You can decline.`,
      adSlot: false,
      actions: [
        { id: 'decline', label: 'No thanks', slot: 'upper' },
        { id: 'watch', label: 'Watch placeholder', slot: 'lower' }
      ]
    };
  }
  if (model.screen === 'rewarded_play') {
    return {
      screen: 'rewarded_play',
      title: 'Rewarded placeholder',
      body: 'This stand-in does not load an ad network. Grant the reward when you are ready.',
      adSlot: true,
      actions: [
        { id: 'decline', label: 'Cancel', slot: 'upper' },
        { id: 'grant_reward', label: 'Grant reward', slot: 'lower' }
      ]
    };
  }
  return { screen: 'play', title: '', body: '', adSlot: false, actions: [] };
}
