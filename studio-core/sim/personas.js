import humanCalibration from './calibration/human.json' with { type: 'json' };

const PERSONA_BASE = {
  casual: {
    id: 'casual',
    skill: 0.35,
    frustrationThreshold: 4,
    frustrationDecay: 0.4,
    noFitGain: 1.6,
    failedGain: 1.4,
    boredomMoves: 8,
    adWatchRate: 0.45,
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
    frustrationThreshold: 6,
    frustrationDecay: 0.5,
    noFitGain: 1.5,
    failedGain: 1.5,
    boredomMoves: 14,
    adWatchRate: 0.75,
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
    frustrationThreshold: 2,
    frustrationDecay: 0.5,
    noFitGain: 2.5,
    failedGain: 2,
    boredomMoves: 3,
    adWatchRate: 0.15,
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
    frustrationThreshold: 4,
    frustrationDecay: 0.4,
    noFitGain: 1.6,
    failedGain: 1.4,
    boredomMoves: 8,
    adQuitAfter: 1,
    adWatchRate: 0.05,
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

export const PERSONAS = Object.fromEntries(
  Object.entries(PERSONA_BASE).map(([id, persona]) => [id, { ...persona, ...(humanCalibration[id] ?? {}) }])
);

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

function pickLegacy(moves, persona, rng) {
  const ranked = [...moves].sort(compareMoves);
  if (roll(rng, persona.skill)) return ranked[0];
  const index = Math.floor(rng() * ranked.length);
  return ranked[index];
}

function humanScore(move, persona, rng, lastMove) {
  const look = Number(persona.lookahead) || 0;
  let rest = 0;
  if (look > 0 && roll(rng, persona.lookProb ?? 1)) {
    const value = look >= 2 && move.rest2 != null ? move.rest2 : move.rest1;
    if (value != null) rest = value < 0 ? -1e4 : value * 100;
  }
  let score = (move.lines || 0) * 100 + rest
    + (move.fill || 0) * (persona.wFill ?? 0)
    + (move.contact || 0) * (persona.wContact ?? 0)
    - (move.holes || 0) * (persona.wHoles ?? 0);
  if (lastMove) score -= (persona.wNear ?? 0) * (Math.abs(move.x - lastMove.x) + Math.abs(move.y - lastMove.y));
  return score + (persona.noise ?? 0) * (rng() - 0.5);
}

function pickMove(moves, persona, rng, lastMove) {
  if (persona.placement !== 'human') return pickLegacy(moves, persona, rng);
  const ranked = moves
    .map((move) => ({ move, score: humanScore(move, persona, rng, lastMove) }))
    .sort((left, right) => right.score - left.score || compareMoves(left.move, right.move));
  if (roll(rng, persona.blunderRate)) {
    const k = Math.min(ranked.length, Math.max(1, persona.blunderTopK ?? 3));
    return ranked[Math.floor(rng() * k)].move;
  }
  return ranked[0].move;
}

function round3(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function freshMood() {
  return { frustration: 0, movesSinceClear: 0 };
}

export function tickMood(persona, mood = freshMood(), event) {
  if (event === 'reset') return freshMood();
  const decay = Number(persona.frustrationDecay ?? 0);
  let frustration = Math.max(0, Number(mood.frustration ?? 0) - (Number.isFinite(decay) ? decay : 0));
  if (event === 'noFit') frustration += Number(persona.noFitGain ?? 0);
  if (event === 'failed') frustration += Number(persona.failedGain ?? 0);
  let movesSinceClear = Number(mood.movesSinceClear ?? 0);
  if (event === 'clear') movesSinceClear = 0;
  else if (event === 'move' || event === 'failed') movesSinceClear += 1;
  return { frustration: round3(frustration), movesSinceClear };
}

export function quitReasonForMood(persona, mood = freshMood()) {
  const threshold = Number(persona.frustrationThreshold ?? Infinity);
  if ((mood.frustration ?? 0) >= threshold) return 'frustration';
  const boredom = Number(persona.boredomMoves ?? Infinity);
  if ((mood.movesSinceClear ?? 0) >= boredom) return 'boredom';
  return null;
}

function quit(quitReason, mood, reaction) {
  return { type: 'quit', quitReason, mood, ...(reaction ? { reaction } : {}) };
}

export function chooseAction({ persona, state, rng, mood = freshMood(), gameOver = false, adCount = 0, restarts = 0, lastMove = null }) {
  const actions = state.actions ?? [];
  const button = (id) => uiAction(actions, id);

  if (state.ad) {
    if (Number.isFinite(persona.adQuitAfter) && adCount >= persona.adQuitAfter) {
      return quit('ad', mood, 'quit');
    }
    if (state.ad.kind === 'rewarded') {
      const accept = button('grant_reward') || button('watch');
      if (accept && roll(rng, persona.adWatchRate)) {
        return { type: 'action', action: accept, reaction: 'watch', mood };
      }
      const decline = button('decline');
      if (decline) return { type: 'action', action: decline, reaction: 'decline', mood };
    }
    const close = button('close_ad');
    if (close) return { type: 'action', action: close, reaction: 'close', mood };
    return quit('ad', mood, 'quit');
  }

  if (button('age_13') || button('age_under')) {
    if (persona.ageBand === 'under13' && button('age_under')) {
      return { type: 'action', action: button('age_under'), mood };
    }
    if (button('age_13')) return { type: 'action', action: button('age_13'), mood };
    return { type: 'action', action: button('age_under'), mood };
  }
  if (button('start_play')) return { type: 'action', action: button('start_play'), mood };
  if (button('analytics_yes') || button('analytics_no')) {
    const grant = roll(rng, persona.analyticsGrantRate);
    const action = grant
      ? (button('analytics_yes') || button('analytics_no'))
      : (button('analytics_no') || button('analytics_yes'));
    return { type: 'action', action, mood };
  }
  if (gameOver) {
    if (button('offer_continue') && roll(rng, persona.continueRate)) {
      return { type: 'action', action: button('offer_continue'), mood };
    }
    if (button('restart') && restarts < (persona.maxRestarts ?? 0) && roll(rng, persona.restartRate)) {
      return { type: 'action', action: button('restart'), mood };
    }
    return quit('game_over', mood);
  }
  if (button('next_round')) {
    const reason = quitReasonForMood(persona, mood);
    if (reason) return quit(reason, mood);
    return { type: 'action', action: button('next_round'), mood };
  }
  const bored = quitReasonForMood(persona, mood);
  if (bored) return quit(bored, mood);
  const moves = actions.filter((action) => action.type === 'move');
  if (moves.length === 0) {
    const nextMood = tickMood(persona, mood, 'noFit');
    const reason = quitReasonForMood(persona, nextMood);
    if (reason) return quit(reason, nextMood);
    const other = actions.find((action) => action.type === 'ui');
    if (other) return { type: 'action', action: other, mood: nextMood };
    return { type: 'stall', mood: nextMood };
  }
  if (button('offer_hint') && roll(rng, persona.hintRate)) {
    return { type: 'action', action: button('offer_hint'), mood };
  }
  return { type: 'action', action: pickMove(moves, persona, rng, lastMove), mood };
}
