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
  return fits ? 1 : 0.32;
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
