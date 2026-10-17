import { canPlace, cellCount, findClears, paint } from './logic.js';

export function listMoves(board, pieces) {
  const moves = [];
  pieces.forEach((piece, pieceIndex) => {
    const shape = piece?.shape;
    if (!shape?.length || !shape[0]?.length) return;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        if (!canPlace(board, shape, x, y)) continue;
        const found = findClears(paint(board, shape, x, y, 1));
        moves.push({
          type: 'move',
          id: `move-${pieceIndex}-${x}-${y}`,
          pieceIndex,
          x,
          y,
          lines: found.rows.length + found.cols.length,
          cells: cellCount(shape)
        });
      }
    }
  });
  return moves;
}

function currentAd(view, rewardKind, breakAfter) {
  if (view.screen === 'ad_break') {
    return { kind: 'interstitial', screen: 'ad_break', placement: breakAfter || 'interstitial' };
  }
  if (view.screen === 'rewarded_confirm' || view.screen === 'rewarded_play') {
    return { kind: 'rewarded', screen: view.screen, placement: rewardKind || 'rewarded' };
  }
  return null;
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
    if (playing) {
      actions.push(...listMoves(match.board, match.pieces));
      if (api.canHint()) {
        actions.push({ type: 'ui', id: 'offer_hint', uiId: 'offer_hint', label: 'Hint' });
      }
    } else {
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
      ended: false,
      ad: currentAd(view, api.getRewardKind(), api.getBreak()),
      actions,
      round: api.getRound()
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

  const bridge = { ready: false, getState, perform };
  window.__playerSim = bridge;
  bridge.ready = true;
}
