import { assertAdapter } from './adapter.js';
import { chooseAction } from './personas.js';
import { wouldReturn } from './retention.js';
import { mulberry32 } from './rng.js';

function thinkTime(persona) {
  const value = Number(persona.thinkMs);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function sameAd(left, right) {
  if (!left || !right) return false;
  return left.kind === right.kind && left.screen === right.screen && left.placement === right.placement;
}

function observe(log, prev, state, step) {
  const previousClears = prev?.clears ?? 0;
  if ((state.clears ?? 0) > previousClears) {
    const delta = state.clears - previousClears;
    log.clearEvents.push({ step, delta, total: state.clears });
    log.clears += delta;
    if ((state.combo ?? 0) >= 2) log.combos.push({ step, lines: state.combo });
  }
  if (state.failed && !prev?.failed) {
    log.failPoints.push({
      step,
      score: state.score ?? 0,
      clears: state.clears ?? 0,
      screen: state.screen ?? ''
    });
  }
  if (state.ad && !sameAd(prev?.ad, state.ad)) {
    log.adMoments.push({
      step,
      kind: state.ad.kind,
      placement: state.ad.placement ?? null,
      screen: state.ad.screen ?? '',
      reaction: null
    });
  }
  log.peakScore = Math.max(log.peakScore, state.score ?? 0);
  log.finalScore = state.score ?? 0;
}

function applyReaction(log, reaction) {
  if (!reaction) return;
  const open = [...log.adMoments].reverse().find((item) => item.reaction == null);
  if (open) open.reaction = reaction;
}

async function snapshot(adapter) {
  const state = await adapter.readState();
  const actions = await adapter.listActions();
  return { ...state, actions };
}

export async function runSession({ adapter, persona, seed, maxSteps = 40, variant }) {
  assertAdapter(adapter);
  const rng = mulberry32(seed >>> 0);
  const variantId = typeof variant === 'string' ? variant : variant?.id ?? 'default';
  const log = {
    persona: persona.id,
    seed,
    variant: variantId,
    sessionLengthMs: 0,
    steps: 0,
    endReason: null,
    finalScore: 0,
    peakScore: 0,
    clears: 0,
    clearEvents: [],
    combos: [],
    failPoints: [],
    adMoments: [],
    retention: null
  };
  let restarts = 0;
  let misses = 0;
  await adapter.start({ seed, variant, persona: persona.id });
  try {
    let state = await snapshot(adapter);
    observe(log, null, state, 0);
    while (log.steps < maxSteps && !log.endReason) {
      if (state.ended) {
        log.endReason = 'ended';
        break;
      }
      const decision = chooseAction({
        persona,
        state,
        rng,
        step: log.steps,
        restarts
      });
      const elapsed = thinkTime(persona);
      log.sessionLengthMs += elapsed;
      if (typeof adapter.advanceTime === 'function') await adapter.advanceTime(elapsed);
      applyReaction(log, decision.reaction);
      if (decision.type === 'quit') {
        log.endReason = 'quit';
        break;
      }
      const outcome = await adapter.perform(decision.action);
      if (decision.action?.uiId === 'restart' || decision.action?.id === 'restart') restarts += 1;
      log.steps += 1;
      const next = await snapshot(adapter);
      observe(log, state, next, log.steps);
      state = next;
      if (outcome && outcome.ok === false) {
        misses += 1;
        if (misses >= 3) log.endReason = 'stuck';
      } else {
        misses = 0;
      }
      if (state.ended) log.endReason = 'ended';
    }
    if (!log.endReason) log.endReason = 'max_steps';
  } finally {
    await adapter.stop();
  }
  log.retention = { wouldReturn: wouldReturn({ persona, log }) };
  return log;
}
