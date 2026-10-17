import { SHAPES, canPlace, paint, findClears, fitsAnywhere } from './logic.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const ALLOWED_RUN_STATE_KEYS = ['moves', 'elapsedMs', 'score', 'totalClears', 'assistDealsLeft'];

export function readRunState(run) {
  const source = run && typeof run === 'object' ? run : {};
  return Object.fromEntries(ALLOWED_RUN_STATE_KEYS.map((key) => [key, Number(source[key]) || 0]));
}

export const MERCY_SHIFT_S = 30;

export function easedRun(run, { mercy = false, cfg = null } = {}) {
  const state = readRunState(run);
  if (!mercy) return state;
  const startRaw = Number(cfg?.ramp?.startS);
  const startS = Number.isFinite(startRaw) ? startRaw : 60;
  const perMove = fallbackSecondsPerMove(cfg);
  const liveClock = state.elapsedMs > 0;
  const seconds = liveClock ? state.elapsedMs / 1000 : state.moves * perMove;
  let shifted = Math.max(0, seconds - MERCY_SHIFT_S);
  if (seconds > startS) shifted = Math.max(shifted, startS + 0.001);
  return {
    ...state,
    elapsedMs: liveClock ? shifted * 1000 : state.elapsedMs,
    moves: liveClock ? state.moves : shifted / perMove,
    mercyTierCap: 1
  };
}

function fallbackSecondsPerMove(cfg) {
  const perMove = Number(cfg?.timeModel?.secondsPerMove);
  return Number.isFinite(perMove) && perMove > 0 ? perMove : 2.5;
}

export function runSeconds(run, cfg) {
  const state = readRunState(run);
  if (state.elapsedMs > 0) return state.elapsedMs / 1000;
  return state.moves * fallbackSecondsPerMove(cfg);
}

export function intensity(run, cfg) {
  const ramp = cfg.ramp;
  const time = clamp01((runSeconds(run, cfg) - ramp.startS) / (ramp.fullS - ramp.startS));
  const state = readRunState(run);
  const score = clamp01((state.score - ramp.scoreStart) / (ramp.scoreFull - ramp.scoreStart));
  const raw = Math.max(time, score * ramp.scoreWeight);
  return clamp01(Math.pow(raw, ramp.curveExponent));
}

export function gridForRound(round, cfg) {
  const spec = cfg?.gridSize || { opening: 6, fromRound: 2, size: 8 };
  const number = Math.max(1, Math.floor(Number(round) || 1));
  return number >= spec.fromRound ? spec.size : spec.opening;
}

export function goalForRound(round, cfg) {
  const goals = Array.isArray(cfg?.goals) && cfg.goals.length ? cfg.goals : [4, 6, 10, 14];
  const index = Math.max(0, Math.floor(Number(round) || 1) - 1);
  return goals[Math.min(index, goals.length - 1)];
}

function canClear(board, shape) {
  for (let y = 0; y <= board.length - shape.length; y += 1) {
    for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
      if (!canPlace(board, shape, x, y)) continue;
      const found = findClears(paint(board, shape, x, y, 1));
      if (found.rows.length + found.cols.length) return true;
    }
  }
  return false;
}

function weighted(entries, rng) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [name, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return name;
  }
  return entries[entries.length - 1][0];
}

function blend(left, right, fraction) {
  const weights = {};
  for (const [name, weight] of Object.entries(left)) weights[name] = (weights[name] || 0) + weight * (1 - fraction);
  for (const [name, weight] of Object.entries(right)) weights[name] = (weights[name] || 0) + weight * fraction;
  return Object.entries(weights).filter(([name, weight]) => weight > 0 && SHAPES[name]);
}

export function generateTray({ board, run, cfg, rng, count = 3 }) {
  const state = readRunState(run);
  const tierCap = Math.max(0, Math.floor(Number(run?.mercyTierCap) || 0));
  const assist = state.assistDealsLeft > 0;
  const level = intensity(state, cfg);
  const tiers = cfg.tiers;
  const maxIndex = Math.max(0, tiers.length - 1 - tierCap);
  let index = 0;
  while (index < maxIndex && level >= tiers[index + 1].at) index += 1;
  const low = tiers[index];
  const high = index >= maxIndex ? low : tiers[Math.min(index + 1, tiers.length - 1)];
  const fraction = high === low ? 0 : clamp01((level - low.at) / (high.at - low.at));
  const entries = assist
    ? cfg.assist.assistShapes.filter((name) => SHAPES[name]).map((name) => [name, 1])
    : blend(low.shapes, high.shapes, fraction);
  const generosity = cfg.generosity;
  const clearBias = assist
    ? cfg.assist.assistClearBias
    : generosity.lateClearBias + (generosity.earlyClearBias - generosity.lateClearBias) * (1 - level);
  const fitting = entries.filter(([name]) => fitsAnywhere(board, SHAPES[name]));
  const clearing = fitting.filter(([name]) => canClear(board, SHAPES[name]));
  const names = [];
  for (let slot = 0; slot < count; slot += 1) {
    let pool = entries;
    const roll = rng();
    if (clearing.length && roll < clearBias) pool = clearing;
    else if (fitting.length && (slot === 0 || level < generosity.fitAllBelowIntensity)) pool = fitting;
    names.push(weighted(pool, rng));
  }
  const gameOver = !names.some((name) => fitsAnywhere(board, SHAPES[name]));
  return { names, gameOver, intensity: level, assist };
}
