import { assertAdapter } from './adapter.js';
import { chooseAction, freshMood, quitReasonForMood, tickMood } from './personas.js';
import { wouldReturn } from './retention.js';
import { mulberry32 } from './rng.js';

export const SAFETY_CAP = 500;

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

function finishQuit(log, quitReason) {
  log.quitReason = quitReason ?? null;
  log.endReason = quitReason === 'game_over' ? 'game_over' : 'quit';
}

export async function runSession({ adapter, persona, seed, maxSteps = SAFETY_CAP, variant }) {
  assertAdapter(adapter);
  const safetyCap = Number.isInteger(maxSteps) && maxSteps > 0 ? maxSteps : SAFETY_CAP;
  const rng = mulberry32(seed >>> 0);
  const variantId = typeof variant === 'string' ? variant : variant?.id ?? 'default';
  const log = {
    persona: persona.id,
    seed,
    variant: variantId,
    sessionLengthMs: 0,
    steps: 0,
    endReason: null,
    quitReason: null,
    anomaly: null,
    frustration: 0,
    movesSinceClear: 0,
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
  let mood = freshMood();
  await adapter.start({ seed, variant, persona: persona.id });
  try {
    let state = await snapshot(adapter);
    observe(log, null, state, 0);
    while (log.steps < safetyCap && !log.endReason) {
      if (state.ended) {
        log.endReason = 'ended';
        break;
      }
      const gameOver = await adapter.isGameOver();
      const decision = chooseAction({
        persona,
        state,
        rng,
        mood,
        gameOver: gameOver === true,
        adCount: log.adMoments.length,
        restarts
      });
      mood = decision.mood ?? mood;
      const elapsed = thinkTime(persona);
      log.sessionLengthMs += elapsed;
      if (typeof adapter.advanceTime === 'function') await adapter.advanceTime(elapsed);
      applyReaction(log, decision.reaction);
      if (decision.type === 'quit') {
        finishQuit(log, decision.quitReason);
        break;
      }
      if (decision.type === 'stall') {
        log.steps += 1;
        continue;
      }
      const outcome = await adapter.perform(decision.action);
      const restarted = decision.action?.uiId === 'restart' || decision.action?.id === 'restart';
      if (restarted) {
        restarts += 1;
        mood = tickMood(persona, mood, 'reset');
      }
      log.steps += 1;
      const next = await snapshot(adapter);
      if (!restarted && state.failed && !next.failed) mood = tickMood(persona, mood, 'reset');
      else if (decision.action?.type === 'move') {
        if (outcome && outcome.ok === false) mood = tickMood(persona, mood, 'failed');
        else if ((next.clears ?? 0) > (state.clears ?? 0)) mood = tickMood(persona, mood, 'clear');
        else mood = tickMood(persona, mood, 'move');
      }
      observe(log, state, next, log.steps);
      state = next;
      if (state.ended) {
        log.endReason = 'ended';
        log.quitReason = null;
      } else if (quitReasonForMood(persona, mood) && !(await adapter.isGameOver())) {
        finishQuit(log, quitReasonForMood(persona, mood));
      }
    }
    if (!log.endReason) {
      log.endReason = 'anomaly';
      log.anomaly = 'safety_cap';
      log.quitReason = null;
    }
  } finally {
    log.frustration = mood.frustration;
    log.movesSinceClear = mood.movesSinceClear;
    await adapter.stop();
  }
  log.retention = { wouldReturn: wouldReturn({ persona, log }) };
  return log;
}
