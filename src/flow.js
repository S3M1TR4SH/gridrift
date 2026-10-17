import { LIMITS } from '../studio-core/guardrails/limits.js';

export const INPUT_GUARD_MS = 400;

const TUTORIAL_STEPS = [
  {
    title: 'Drag a piece',
    body: 'Touch a piece in the tray and drop it on the board. It snaps to the cells.'
  },
  {
    title: 'Clear a line',
    body: 'Fill a whole row or a whole column. Those cells clear and you score.'
  },
  {
    title: 'Finish the round',
    body: 'Clear the lines shown at the top to finish the round. Your best score stays on this device.'
  }
];

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
      body: 'Optional. Counts stay in this browser. Nothing is sent over the network.',
      actions: [
        { id: 'analytics_yes', label: 'Allow on this device', slot: 'upper', primary: false },
        { id: 'analytics_no', label: 'No thanks', slot: 'lower', primary: true }
      ]
    });
  }
  if (model.screen === 'tutorial') {
    const index = Math.min(TUTORIAL_STEPS.length - 1, Math.max(0, model.step || 0));
    const step = TUTORIAL_STEPS[index];
    const last = index === TUTORIAL_STEPS.length - 1;
    return card({
      screen: 'tutorial',
      title: step.title,
      body: step.body,
      stepLabel: `${index + 1} of ${TUTORIAL_STEPS.length}`,
      actions: [{ id: 'tutorial_next', label: last ? 'Play' : 'Next', slot: 'lower', primary: true }]
    });
  }
  if (model.screen === 'welcome_back') {
    return card({
      screen: 'welcome_back',
      title: 'Welcome back',
      body: `Best score ${model.bestScore ?? 0}. Continue your run or start fresh.`,
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
    return card({
      screen: 'round_complete',
      title: `${model.roundName ?? 'Round'} cleared`,
      body: `Score ${score}. Best streak ${best}.`,
      actions: [{ id: 'next_round', label: 'Next', slot: 'lower', primary: true }]
    });
  }
  if (model.screen === 'game_over') {
    const actions = [{ id: 'restart', label: 'Restart', slot: 'lower', primary: true }];
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
    const label = model.kind === 'hint' ? 'a hint' : 'a continue';
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
