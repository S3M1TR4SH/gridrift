import { LIMITS } from '../studio-core/index.js';

export const INPUT_GUARD_MS = 0;
export const HINT_MIN_PLAY_MS = 120_000;

export function shouldIgnoreInput(now, until) {
  return now < until;
}

export const HINT_MIN_MOVES = 15;

export function canOfferContinue(uses, rewardedAllowed, declined = false) {
  return Boolean(rewardedAllowed) && !declined && uses < LIMITS.rewardedEffects.maxContinueUsesPerMatch;
}

export function continueRewardLabel(rows = 3) {
  return `Watch ad: clear ${rowsForContinue(rows)} rows`;
}

export function canOfferHint({
  elapsedMs = 0,
  stuck = false,
  hintsUsed = 0,
  rewardedAllowed = false,
  moves = 0,
  minMoves = HINT_MIN_MOVES
} = {}) {
  if (!rewardedAllowed || hintsUsed >= 1) return false;
  const floor = Number.isFinite(Number(minMoves)) ? Number(minMoves) : HINT_MIN_MOVES;
  if ((Number(moves) || 0) < floor) return false;
  if (stuck) return true;
  return elapsedMs >= HINT_MIN_PLAY_MS;
}

export const AGE_COPY = 'What year were you born?';

export function bootScreen(consent) {
  if (!consent?.birthYear) return 'age_gate';
  if (consent.needsAnalyticsPrompt) return 'stats_consent';
  return 'play';
}

export function agePrompt() {
  return null;
}

export function restartConfirmCopy({ bestScore = 0 } = {}) {
  return `Back to Round 1. Best ${bestScore} kept. This run's score, board, and round reset.`;
}

export function welcomeCopy(model = {}) {
  const levelName = model.levelName || 'Level';
  const clears = model.clears ?? 0;
  const goal = model.clearsGoal ?? 4;
  const best = model.bestScore ?? 0;
  const streak = model.streak ?? 0;
  return `${levelName}: ${clears}/${goal} clears. Best ${best}. Streak ${streak}.`;
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
      title: AGE_COPY,
      body: '',
      actions: []
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
      body: welcomeCopy(model),
      actions: [
        { id: 'new_game', label: 'New game', slot: 'upper', primary: false },
        { id: 'resume', label: 'Continue level', slot: 'lower', primary: true }
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
    const actions = [];
    if (model.rewarded) {
      actions.push({
        id: 'offer_continue',
        label: continueRewardLabel(model.continueRows ?? 3),
        slot: 'lower',
        primary: false
      });
    }
    if (model.doubleScore) {
      actions.push({ id: 'offer_double', label: 'Double score', slot: 'lower', primary: false });
    }
    actions.push({ id: 'ask_restart', label: 'Restart', slot: 'lower', primary: true });
    return card({
      screen: 'game_over',
      title: 'No moves left',
      body: `Score ${score}. Best ${model.bestScore ?? 0}.`,
      separated: false,
      actions
    });
  }
  if (model.screen === 'restart_confirm') {
    return card({
      screen: 'restart_confirm',
      title: 'Restart this run?',
      body: restartConfirmCopy({ bestScore: model.bestScore ?? 0 }),
      separated: false,
      actions: [
        { id: 'cancel_restart', label: 'Keep this run', slot: 'upper', primary: false },
        { id: 'restart', label: 'Back to Round 1', slot: 'lower', primary: true }
      ]
    });
  }
  if (model.screen === 'stats_consent') {
    return card({
      screen: 'stats_consent',
      title: 'Optional stats',
      body: 'Keep stats on this device?',
      actions: [
        { id: 'analytics_no', label: 'No thanks', slot: 'lower', primary: true },
        { id: 'analytics_yes', label: 'Keep stats', slot: 'upper', primary: false }
      ]
    });
  }
  if (model.screen === 'rewarded_confirm') {
    const reward = model.kind === 'continue' || !model.kind
      ? continueRewardLabel(model.continueRows ?? 3)
      : null;
    const label = reward || REWARD_LABELS[model.kind] || REWARD_LABELS.continue;
    return card({
      screen: 'rewarded_confirm',
      title: 'Optional reward',
      body: reward ? `${reward}. You can decline.` : `Watch a placeholder ad for ${label}? You can decline.`,
      separated: true,
      actions: [
        { id: 'decline', label: 'No thanks', slot: 'lower', primary: true },
        { id: 'watch', label: reward || 'Watch placeholder', slot: 'upper', primary: false }
      ]
    });
  }
  if (model.screen === 'rewarded_play') {
    const reward = model.kind === 'continue' || !model.kind
      ? continueRewardLabel(model.continueRows ?? 3)
      : null;
    return card({
      screen: 'rewarded_play',
      title: reward || 'Rewarded placeholder',
      body: reward
        ? `${reward}. This stand-in does not load an ad network.`
        : 'This stand-in does not load an ad network. Grant the reward when you are ready.',
      adSlot: true,
      separated: true,
      actions: [
        { id: 'decline', label: 'Cancel', slot: 'lower', primary: false },
        { id: 'grant_reward', label: reward || 'Grant reward', slot: 'upper', primary: true }
      ]
    });
  }
  return card({ screen: 'play', title: '', body: '', actions: [] });
}
