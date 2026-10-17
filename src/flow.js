import { LIMITS } from '../studio-core/guardrails/limits.js';

export const INPUT_GUARD_MS = 400;
export const HINT_MIN_PLAY_MS = 120_000;

export function shouldIgnoreInput(now, until) {
  return now < until;
}

export function canOfferContinue(uses, rewardedAllowed) {
  return Boolean(rewardedAllowed) && uses < LIMITS.rewardedEffects.maxContinueUsesPerMatch;
}

export function canOfferHint({ elapsedMs = 0, stuck = false, hintsUsed = 0, rewardedAllowed = false } = {}) {
  if (!rewardedAllowed || hintsUsed >= 1) return false;
  if (stuck) return true;
  return elapsedMs >= HINT_MIN_PLAY_MS;
}

export function canOfferReroll({ stuck = false, rerollsUsed = 0, rewardedAllowed = false } = {}) {
  return Boolean(rewardedAllowed) && Boolean(stuck) && rerollsUsed < 1;
}

export function canOfferDouble({ doublesUsed = 0, rewardedAllowed = false } = {}) {
  return Boolean(rewardedAllowed) && doublesUsed < 1;
}

const REWARD_LABELS = {
  hint: 'a hint',
  continue: 'a continue',
  reroll: 'a new tray',
  double_score: 'a doubled score'
};

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

function card({ screen, title, body, actions, adSlot = false, separated = false, stepLabel = '' }) {
  return { screen, title, body, adSlot, separated, stepLabel, actions };
}

export function viewModel(model) {
  const score = model.score ?? 0;
  const best = model.bestStreak ?? 0;
  if (model.screen === 'age_gate') {
    return card({
      screen: 'age_gate',
      title: 'How old are you?',
      body: 'Gridrift uses this only to decide ads and stats. It stays on this device.',
      actions: [
        { id: 'age_under', label: "I'm under 13", slot: 'upper', primary: false },
        { id: 'age_13', label: "I'm 13 or older", slot: 'lower', primary: true }
      ]
    });
  }
  if (model.screen === 'kid_mode') {
    return card({
      screen: 'kid_mode',
      title: 'Kid mode',
      body: 'No ads and no analytics. Have fun with the puzzle.',
      actions: [{ id: 'start_play', label: 'Play', slot: 'lower', primary: true }]
    });
  }
  if (model.screen === 'analytics_consent') {
    return card({
      screen: 'analytics_consent',
      title: 'Keep stats on this device?',
      body: 'Optional anonymous play counts. Mixpanel loads only if you allow it. No name or email is sent.',
      adSlot: false,
      actions: [
        { id: 'analytics_yes', label: 'Allow on this device', slot: 'upper', primary: false },
        { id: 'analytics_no', label: 'No thanks', slot: 'lower', primary: true }
      ]
    });
  }
  if (model.screen === 'welcome_back') {
    return card({
      screen: 'welcome_back',
      title: 'Welcome back',
      body: `Best score ${model.bestScore ?? 0}. Streak ${model.streak ?? 0}. Continue your run or start fresh.`,
      actions: [
        { id: 'new_game', label: 'New game', slot: 'upper', primary: false },
        { id: 'resume', label: 'Continue run', slot: 'lower', primary: true }
      ]
    });
  }
  if (model.screen === 'ad_break') {
    return card({
      screen: 'ad_break',
      title: 'Advertisement',
      body: 'Placeholder. This does not contact an ad network.',
      adSlot: true,
      separated: true,
      actions: [{ id: 'close_ad', label: 'Close advertisement', slot: 'upper', primary: true }]
    });
  }
  if (model.screen === 'round_complete') {
    const actions = [{ id: 'next_round', label: 'Next', slot: 'lower', primary: true }];
    if (model.doubleScore) {
      actions.unshift({ id: 'offer_double', label: 'Double score', slot: 'upper', primary: false });
    }
    return card({
      screen: 'round_complete',
      title: `${model.roundName ?? 'Round'} cleared`,
      body: `Score ${score}. Best streak ${best}.`,
      actions
    });
  }
  if (model.screen === 'game_over') {
    const actions = [{ id: 'restart', label: 'Restart', slot: 'lower', primary: true }];
    if (model.doubleScore) {
      actions.unshift({ id: 'offer_double', label: 'Double score', slot: 'upper', primary: false });
    }
    if (model.rewarded) {
      actions.unshift({ id: 'offer_continue', label: 'Continue', slot: 'upper', primary: false });
    }
    return card({
      screen: 'game_over',
      title: 'No moves left',
      body: `Score ${score}. Best streak ${best}. Restart is always available.`,
      separated: Boolean(model.rewarded),
      actions
    });
  }
  if (model.screen === 'rewarded_confirm') {
    const label = REWARD_LABELS[model.kind] || REWARD_LABELS.continue;
    return card({
      screen: 'rewarded_confirm',
      title: 'Optional reward',
      body: `Watch a placeholder ad for ${label}? You can decline.`,
      separated: true,
      actions: [
        { id: 'decline', label: 'No thanks', slot: 'upper', primary: true },
        { id: 'watch', label: 'Watch placeholder', slot: 'lower', primary: false }
      ]
    });
  }
  if (model.screen === 'rewarded_play') {
    return card({
      screen: 'rewarded_play',
      title: 'Rewarded placeholder',
      body: 'This stand-in does not load an ad network. Grant the reward when you are ready.',
      adSlot: true,
      separated: true,
      actions: [
        { id: 'decline', label: 'Cancel', slot: 'upper', primary: false },
        { id: 'grant_reward', label: 'Grant reward', slot: 'lower', primary: true }
      ]
    });
  }
  return card({ screen: 'play', title: '', body: '', actions: [] });
}
