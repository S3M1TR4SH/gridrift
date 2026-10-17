import { canPlace } from './logic.js';

export function placementCount(board, pieces) {
  let count = 0;
  for (const piece of pieces) {
    const shape = piece?.shape;
    if (!shape?.length) continue;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        if (canPlace(board, shape, x, y)) count += 1;
      }
    }
  }
  return count;
}

export function trayPieceAlpha(fits) {
  return trayPieceStyle(fits).alpha;
}

export function trayPieceStyle(fits) {
  if (fits) return { alpha: 1, desaturate: false, hatch: false };
  return { alpha: 0.55, desaturate: true, hatch: true };
}

export function scorePopupStyle(level = 0) {
  const step = Math.max(0, Math.floor(Number(level) || 0));
  return {
    fontPx: Math.max(24, 24 + step * 4),
    fill: '#ffffff',
    stroke: '#10141d'
  };
}

export function dangerCue(count, thresholds = {}) {
  const few = Number(thresholds.fewPlacements) || 8;
  const critical = Number(thresholds.criticalPlacements) || 4;
  if (!Number.isFinite(count) || count <= 0 || count > few) return null;
  return {
    level: count <= critical ? 2 : 1,
    label: 'Low space',
    sound: count <= critical ? 'sfx.danger' : null
  };
}

export function roundClearedNotice() {
  return {
    text: 'Round cleared',
    blocking: false,
    pointerEvents: 'none',
    dismissMs: 900
  };
}

export function dropFeedback(effect, hit) {
  if (effect?.type === 'cancel' && effect.moved && hit?.overBoard && !hit?.ghostValid) return 'sfx.invalid';
  return null;
}
