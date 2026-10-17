export const PERSONAS = {
  casual: {
    id: 'casual',
    skill: 0.35,
    quitChance: 0.015,
    patience: 30,
    adWatchRate: 0.45,
    quitOnAd: 0.08,
    continueRate: 0.35,
    restartRate: 0.55,
    maxRestarts: 1,
    analyticsGrantRate: 0.5,
    hintRate: 0.05,
    thinkMs: 1200,
    adAversion: 0.35,
    ageBand: '13plus'
  },
  skilled: {
    id: 'skilled',
    skill: 0.92,
    quitChance: 0.002,
    patience: 60,
    adWatchRate: 0.75,
    quitOnAd: 0.02,
    continueRate: 0.9,
    restartRate: 0.8,
    maxRestarts: 1,
    analyticsGrantRate: 0.7,
    hintRate: 0.12,
    thinkMs: 700,
    adAversion: 0.2,
    ageBand: '13plus'
  },
  quitter: {
    id: 'quitter',
    skill: 0.4,
    quitChance: 0.12,
    patience: 8,
    adWatchRate: 0.15,
    quitOnAd: 0.65,
    continueRate: 0.05,
    restartRate: 0,
    maxRestarts: 0,
    analyticsGrantRate: 0.25,
    hintRate: 0,
    thinkMs: 900,
    adAversion: 0.7,
    ageBand: '13plus'
  },
  'ad-averse': {
    id: 'ad-averse',
    skill: 0.6,
    quitChance: 0.03,
    patience: 36,
    adWatchRate: 0.05,
    quitOnAd: 0.5,
    continueRate: 0.05,
    restartRate: 0.4,
    maxRestarts: 1,
    analyticsGrantRate: 0.4,
    hintRate: 0,
    thinkMs: 1000,
    adAversion: 0.95,
    ageBand: '13plus'
  }
};

export function resolvePersona(input, overrides = {}) {
  const base = typeof input === 'string' ? PERSONAS[input] : input;
  if (!base?.id) {
    throw new Error(`unknown persona ${typeof input === 'string' ? input : ''}`.trim());
  }
  return { ...base, ...overrides, id: overrides.id || base.id };
}

function roll(rng, probability) {
  const chance = Number(probability);
  if (!Number.isFinite(chance) || chance <= 0) return false;
  if (chance >= 1) return true;
  return rng() < chance;
}

function uiAction(actions, id) {
  return actions.find((action) => action.type === 'ui' && (action.uiId === id || action.id === id));
}

function compareMoves(left, right) {
  return right.lines - left.lines
    || right.cells - left.cells
    || left.pieceIndex - right.pieceIndex
    || left.y - right.y
    || left.x - right.x
    || String(left.id).localeCompare(String(right.id));
}

function pickMove(moves, persona, rng) {
  const ranked = [...moves].sort(compareMoves);
  if (roll(rng, persona.skill)) return ranked[0];
  const index = Math.floor(rng() * ranked.length);
  return ranked[index];
}

export function chooseAction({ persona, state, rng, step, restarts }) {
  const actions = state.actions ?? [];
  const button = (id) => uiAction(actions, id);

  if (state.ad) {
    if (roll(rng, persona.quitOnAd)) return { type: 'quit', reaction: 'quit' };
    if (state.ad.kind === 'rewarded') {
      const accept = button('grant_reward') || button('watch');
      if (accept && roll(rng, persona.adWatchRate)) {
        return { type: 'action', action: accept, reaction: 'watch' };
      }
      const decline = button('decline');
      if (decline) return { type: 'action', action: decline, reaction: 'decline' };
    }
    const close = button('close_ad');
    if (close) return { type: 'action', action: close, reaction: 'close' };
    return { type: 'quit', reaction: 'quit' };
  }

  if (button('age_13') || button('age_under')) {
    if (persona.ageBand === 'under13' && button('age_under')) {
      return { type: 'action', action: button('age_under') };
    }
    if (button('age_13')) return { type: 'action', action: button('age_13') };
    return { type: 'action', action: button('age_under') };
  }
  if (button('start_play')) return { type: 'action', action: button('start_play') };
  if (button('analytics_yes') || button('analytics_no')) {
    const grant = roll(rng, persona.analyticsGrantRate);
    const action = grant
      ? (button('analytics_yes') || button('analytics_no'))
      : (button('analytics_no') || button('analytics_yes'));
    return { type: 'action', action };
  }
  if (button('next_round')) {
    if (roll(rng, persona.quitChance)) return { type: 'quit' };
    return { type: 'action', action: button('next_round') };
  }
  if (state.failed || state.screen === 'game_over') {
    if (button('offer_continue') && roll(rng, persona.continueRate)) {
      return { type: 'action', action: button('offer_continue') };
    }
    if (button('restart') && restarts < (persona.maxRestarts ?? 0) && roll(rng, persona.restartRate)) {
      return { type: 'action', action: button('restart') };
    }
    return { type: 'quit' };
  }
  if (step >= persona.patience || roll(rng, persona.quitChance)) return { type: 'quit' };
  if (button('offer_hint') && roll(rng, persona.hintRate)) {
    return { type: 'action', action: button('offer_hint') };
  }
  const moves = actions.filter((action) => action.type === 'move');
  if (moves.length === 0) return { type: 'quit' };
  return { type: 'action', action: pickMove(moves, persona, rng) };
}
