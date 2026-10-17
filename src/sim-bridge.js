import { applyClears, canPlace, cellCount, findClears, paint } from './logic.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function moveFeatures(board, shape, x, y) {
  const size = board.length;
  const painted = paint(board, shape, x, y, 1);
  let fill = 0;
  let contact = 0;
  shape.forEach((row, dy) => row.forEach((cell, dx) => {
    if (!cell) return;
    const cy = y + dy;
    const cx = x + dx;
    fill = Math.max(fill, painted[cy].filter(Boolean).length, painted.filter((line) => line[cx]).length);
    for (const [ox, oy] of N4) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || board[ny][nx]) contact += 1;
    }
  }));
  const after = applyClears(painted, findClears(painted));
  let holes = 0;
  for (let yy = 0; yy < size; yy += 1) {
    for (let xx = 0; xx < size; xx += 1) {
      if (after[yy][xx]) continue;
      const enclosed = N4.every(([ox, oy]) => {
        const nx = xx + ox;
        const ny = yy + oy;
        return nx < 0 || ny < 0 || nx >= size || ny >= size || after[ny][nx];
      });
      if (enclosed) holes += 1;
    }
  }
  return { fill, contact, holes, after };
}

function restValue(board, pieces, used, depth) {
  const rest = pieces.map((piece, index) => index).filter((index) => pieces[index] && !used.includes(index));
  if (!rest.length || depth <= 0) return 0;
  let best = -1;
  for (const index of rest) {
    const shape = pieces[index].shape;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        if (!canPlace(board, shape, x, y)) continue;
        const painted = paint(board, shape, x, y, 1);
        const found = findClears(painted);
        const next = restValue(applyClears(painted, found), pieces, [...used, index], depth - 1);
        if (next >= 0) best = Math.max(best, found.rows.length + found.cols.length + next);
      }
    }
  }
  return best;
}

export function listMoves(board, pieces, { lookahead = 2 } = {}) {
  const moves = [];
  pieces.forEach((piece, pieceIndex) => {
    const shape = piece?.shape;
    if (!shape?.length || !shape[0]?.length) return;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        if (!canPlace(board, shape, x, y)) continue;
        const painted = paint(board, shape, x, y, 1);
        const found = findClears(painted);
        const feat = moveFeatures(board, shape, x, y);
        moves.push({
          type: 'move',
          id: `move-${pieceIndex}-${x}-${y}`,
          pieceIndex,
          x,
          y,
          lines: found.rows.length + found.cols.length,
          cells: cellCount(shape),
          fill: feat.fill,
          contact: feat.contact,
          holes: feat.holes,
          rest1: restValue(feat.after, pieces, [pieceIndex], 1),
          rest2: lookahead >= 2 ? restValue(feat.after, pieces, [pieceIndex], 2) : null
        });
      }
    }
  });
  return moves;
}

export function boardNearMiss(board) {
  if (!board?.length) return false;
  const size = board.length;
  for (let index = 0; index < size; index += 1) {
    if (board[index].filter((cell) => !cell).length === 1) return true;
    let empty = 0;
    for (let y = 0; y < size; y += 1) if (!board[y][index]) empty += 1;
    if (empty === 1) return true;
  }
  return false;
}

const OFFER_PLACEMENT = {
  offer_continue: 'continue',
  offer_hint: 'hint',
  offer_reroll: 'reroll',
  offer_double: 'double_score'
};

export function describeAd(view, rewardKind, breakAfter) {
  if (view?.screen === 'ad_break') {
    return { kind: 'interstitial', screen: 'ad_break', placement: breakAfter || 'interstitial' };
  }
  if (view?.screen === 'rewarded_confirm' || view?.screen === 'rewarded_play') {
    return { kind: 'rewarded', screen: view.screen, placement: rewardKind || 'rewarded' };
  }
  const offer = (view?.actions || []).find((action) => OFFER_PLACEMENT[action.id]);
  if (!offer) return null;
  return { kind: 'rewarded', screen: view.screen || '', placement: OFFER_PLACEMENT[offer.id] };
}

export function detectGameOver(phase, screen) {
  return phase === 'game_over' || screen === 'game_over';
}

export function attachSimBridge(api) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('sim')) return;

  function getState() {
    const match = api.getMatch();
    const view = api.getView();
    const playing = view.screen === 'play';
    const actions = [];
    if (view.screen === 'age_gate') {
      actions.push(
        { type: 'ui', id: 'age_13', uiId: 'age_13', label: 'Year' },
        { type: 'ui', id: 'age_under', uiId: 'age_under', label: 'Year' }
      );
    }
    if (playing) {
      actions.push(...listMoves(match.board, match.pieces));
      if (api.canHint()) {
        actions.push({ type: 'ui', id: 'offer_hint', uiId: 'offer_hint', label: 'Hint' });
      }
    } else if (view.screen !== 'age_gate') {
      for (const action of view.actions) {
        actions.push({ type: 'ui', id: action.id, uiId: action.id, label: action.label });
      }
    }
    return {
      screen: view.screen,
      score: match.score,
      clears: match.totalClears,
      roundClears: match.roundClears,
      combo: match.combo,
      streak: match.streak,
      failed: match.phase === 'game_over' || view.screen === 'game_over',
      gameOver: detectGameOver(match.phase, view.screen),
      ended: false,
      nearMiss: boardNearMiss(match.board),
      ad: describeAd({ ...view, actions }, api.getRewardKind(), api.getBreak()),
      actions,
      round: api.getRound(),
      roundNumber: Number(api.getRoundNumber?.() ?? 0) || null,
      playMs: Number(api.getPlayMs?.() ?? 0) || 0
    };
  }

  function perform(action) {
    if (!action || typeof action !== 'object') return { ok: false, reason: 'bad_action' };
    if (action.type === 'ui') {
      api.performUi(action.uiId || action.id);
      return { ok: true };
    }
    if (action.type === 'move') return api.performMove(action.pieceIndex, action.x, action.y) ?? { ok: false };
    return { ok: false, reason: 'unknown' };
  }

  const bridge = {
    ready: false,
    getState,
    perform,
    isGameOver() {
      const match = api.getMatch();
      const view = api.getView();
      return detectGameOver(match.phase, view.screen);
    },
    advancePlay(ms) {
      return api.advancePlay?.(ms) ?? 0;
    }
  };
  window.__playerSim = bridge;
  bridge.ready = true;
}
