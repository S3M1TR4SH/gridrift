export const SHAPES = {
  dot: [[1]],
  line2: [[1, 1]],
  line2v: [[1], [1]],
  line3: [[1, 1, 1]],
  line3v: [[1], [1], [1]],
  line4: [[1, 1, 1, 1]],
  line4v: [[1], [1], [1], [1]],
  line5: [[1, 1, 1, 1, 1]],
  square: [[1, 1], [1, 1]],
  s: [[1, 1, 0], [0, 1, 1]],
  z: [[0, 1, 1], [1, 1, 0]],
  l: [[1, 0], [1, 0], [1, 1]],
  j: [[0, 1], [0, 1], [1, 1]],
  t: [[1, 1, 1], [0, 1, 0]],
  corner: [[1, 1], [1, 0]],
  plus: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
  u: [[1, 0, 1], [1, 1, 1]],
  rect: [[1, 1, 1], [1, 1, 1]],
  corner3: [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
  sTall: [[1, 0], [1, 1], [0, 1]],
  zTall: [[0, 1], [1, 1], [1, 0]]
};

const SAFE_SHAPES = ['dot', 'line2', 'square'];

export function usablePool(names) {
  const known = (names ?? []).filter((name) => SHAPES[name]);
  return known.length ? known.slice() : SAFE_SHAPES.slice();
}

export function createBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cellCount(shape) {
  return shape.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + (cell ? 1 : 0), 0), 0);
}

export function canPlace(board, shape, x, y) {
  const height = board.length;
  const width = board[0].length;
  return shape.every((row, dy) => row.every((cell, dx) => {
    if (!cell) return true;
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < width && ny < height && !board[ny][nx];
  }));
}

export function paint(board, shape, x, y, color) {
  const next = board.map((row) => row.slice());
  shape.forEach((row, dy) => row.forEach((cell, dx) => {
    if (cell) next[y + dy][x + dx] = color;
  }));
  return next;
}

export function findClears(board) {
  const size = board.length;
  const rows = [];
  const cols = [];
  for (let i = 0; i < size; i += 1) {
    if (board[i].every(Boolean)) rows.push(i);
    if (board.every((row) => row[i])) cols.push(i);
  }
  return { rows, cols };
}

export function applyClears(board, { rows = [], cols = [] }) {
  const next = board.map((row) => row.slice());
  for (const y of rows) next[y] = next[y].map(() => 0);
  for (const x of cols) {
    for (const row of next) row[x] = 0;
  }
  return next;
}

export function fitsAnywhere(board, shape) {
  for (let y = 0; y <= board.length - shape.length; y += 1) {
    for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
      if (canPlace(board, shape, x, y)) return true;
    }
  }
  return false;
}

export function hasAnyMove(board, pieces) {
  return pieces.some((piece) => piece && fitsAnywhere(board, piece.shape));
}

function outlook(board, shape, x, y) {
  if (!canPlace(board, shape, x, y)) return null;
  const painted = paint(board, shape, x, y, 1);
  const found = findClears(painted);
  let bestFill = 0;
  const rows = new Set();
  const cols = new Set();
  shape.forEach((row, dy) => row.forEach((cell, dx) => {
    if (!cell) return;
    rows.add(y + dy);
    cols.add(x + dx);
  }));
  for (const row of rows) bestFill = Math.max(bestFill, painted[row].filter(Boolean).length);
  for (const col of cols) {
    let filled = 0;
    for (const line of painted) if (line[col]) filled += 1;
    bestFill = Math.max(bestFill, filled);
  }
  return { lines: found.rows.length + found.cols.length, bestFill };
}

function filledCount(board) {
  return board.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

export function hasGoodMove(board, pieces) {
  const almost = board.length - 1;
  return pieces.some((piece) => {
    const shape = piece?.shape;
    if (!shape?.length) return false;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        const result = outlook(board, shape, x, y);
        if (result && (result.lines > 0 || result.bestFill >= almost)) return true;
      }
    }
    return false;
  });
}

export function isStuck(board, pieces) {
  if (!hasAnyMove(board, pieces)) return false;
  if (filledCount(board) < board.length * 2) return false;
  return !hasGoodMove(board, pieces);
}

export function placementValue(board, shape, x, y) {
  if (!canPlace(board, shape, x, y)) return Number.NEGATIVE_INFINITY;
  const painted = paint(board, shape, x, y, 1);
  const found = findClears(painted);
  const lines = found.rows.length + found.cols.length;
  let contact = 0;
  shape.forEach((row, dy) => row.forEach((cell, dx) => {
    if (!cell) return;
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ox, oy] of neighbors) {
      const cx = x + dx + ox;
      const cy = y + dy + oy;
      if (cy >= 0 && cx >= 0 && cy < board.length && cx < board[0].length && board[cy][cx]) contact += 1;
    }
  }));
  const corner = x === 0 && y === 0 ? 1 : 0;
  return lines * 1000 + contact * 2 - corner;
}

export function findSmartHint(board, shape) {
  let best = null;
  for (let y = 0; y <= board.length - shape.length; y += 1) {
    for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
      const value = placementValue(board, shape, x, y);
      if (!Number.isFinite(value)) continue;
      if (!best || value > best.value) best = { x, y, value };
    }
  }
  return best;
}

export function findHint(board, shape) {
  const spot = findSmartHint(board, shape);
  return spot ? { x: spot.x, y: spot.y } : null;
}

export function chainPayoff(table, length) {
  if (!Array.isArray(table) || length <= 0) return 0;
  let total = 0;
  const last = Number(table[table.length - 1]) || 0;
  for (let step = 1; step <= length; step += 1) {
    const marginal = step < table.length ? Number(table[step]) || 0 : last;
    total += marginal;
  }
  return total;
}

export function nextScoreGoal(score, goals = [40, 100, 200, 360, 600, 1000]) {
  const list = (Array.isArray(goals) ? goals : []).filter((goal) => typeof goal === 'number' && goal > 0).sort((a, b) => a - b);
  const current = Number(score) || 0;
  const found = list.find((goal) => goal > current);
  if (found) return found;
  const last = list[list.length - 1] || 40;
  const prev = list.length > 1 ? list[list.length - 2] : 0;
  const step = Math.max(1, last - prev);
  return last + step * (Math.floor(Math.max(0, current - last) / step) + 1);
}

export function scorePlacement({ cells, lines, streak, tuning }) {
  const place = cells * tuning.place;
  if (lines <= 0) return place;
  const linePoints = lines * tuning.line;
  const comboBonus = Math.max(0, lines - 1) * tuning.comboBonusPerExtraLine;
  const multiplier = Math.min(
    tuning.maxStreakMultiplier,
    1 + Math.max(0, streak - 1) * tuning.streakMultiplierStep
  );
  const stepBonus = Math.max(0, streak) * (Number(tuning.bonusPerStep) || 0);
  const chains = chainPayoff(tuning.comboChain, lines) + chainPayoff(tuning.streakChain, streak);
  return place + Math.round((linePoints + comboBonus) * multiplier) + stepBonus + chains;
}

export function clearFullestRows(board, count) {
  const ranked = board
    .map((row, y) => ({ y, fill: row.filter(Boolean).length }))
    .sort((a, b) => b.fill - a.fill || a.y - b.y);
  const rows = ranked.slice(0, Math.max(0, count)).map((entry) => entry.y);
  return applyClears(board, { rows, cols: [] });
}

export function dealPieces({ board, pool, count, rng, palette }) {
  const names = usablePool(pool);
  const colors = palette?.length ? palette : [{ id: 'tile.grey', color: '#8b95a8' }];
  const placeable = names.filter((name) => fitsAnywhere(board, SHAPES[name]));
  const make = (name) => {
    const color = colors[Math.floor(rng() * colors.length) % colors.length];
    return {
      shapeName: name,
      shape: SHAPES[name],
      color: color.color,
      tileId: color.id
    };
  };
  const pieces = [];
  if (placeable.length === 0) {
    for (let i = 0; i < count; i += 1) pieces.push(make(names[Math.floor(rng() * names.length)]));
    return { pieces, gameOver: true };
  }
  pieces.push(make(placeable[Math.floor(rng() * placeable.length)]));
  for (let i = 1; i < count; i += 1) pieces.push(make(names[Math.floor(rng() * names.length)]));
  return { pieces, gameOver: false };
}

function hydratePiece(piece) {
  if (!piece || typeof piece.shapeName !== 'string' || !SHAPES[piece.shapeName]) return null;
  return {
    shapeName: piece.shapeName,
    shape: SHAPES[piece.shapeName],
    color: typeof piece.color === 'string' ? piece.color : '#8b95a8',
    tileId: typeof piece.tileId === 'string' ? piece.tileId : 'tile.grey'
  };
}

function emptySlots(traySize) {
  return Array.from({ length: traySize }, () => null);
}

export function createMatch({
  grid = 10,
  traySize = 3,
  score,
  rng = Math.random,
  targetClears = 4,
  poolFor = () => SAFE_SHAPES,
  palette = [],
  saved = null,
  generator = null
}) {
  let board = createBoard(grid);
  let pieces = emptySlots(traySize);
  let points = 0;
  let streak = 0;
  let bestStreak = 0;
  let combo = 0;
  let roundClears = 0;
  let totalClears = 0;
  let phase = 'playing';
  let hint = null;
  let doubled = false;
  let dryMoves = 0;

  function deal() {
    if (generator) {
      const colors = palette?.length ? palette : [{ id: 'tile.grey', color: '#8b95a8' }];
      const out = generator(board, { score: points, totalClears }, rng);
      const names = Array.isArray(out?.names) ? out.names : [];
      pieces = emptySlots(traySize).map((_, index) => {
        const name = names[index];
        if (!name || !SHAPES[name]) return null;
        const color = colors[Math.floor(rng() * colors.length) % colors.length];
        return { shapeName: name, shape: SHAPES[name], color: color.color, tileId: color.id };
      });
      if (out?.gameOver || !hasAnyMove(board, pieces)) phase = 'game_over';
      return;
    }
    const dealt = dealPieces({
      board,
      pool: poolFor(totalClears, points),
      count: traySize,
      rng,
      palette
    });
    pieces = dealt.pieces;
    if (dealt.gameOver || !hasAnyMove(board, pieces)) phase = 'game_over';
  }

  function trayIsEmpty() {
    return pieces.every((piece) => !piece);
  }

  if (saved && Array.isArray(saved.board) && saved.board.length === grid && saved.board.every((row) => row.length === grid)) {
    board = saved.board.map((row) => row.slice());
    points = Number(saved.score) || 0;
    streak = Number(saved.streak) || 0;
    bestStreak = Number(saved.bestStreak) || 0;
    roundClears = Number(saved.roundClears) || 0;
    totalClears = Number(saved.totalClears) || 0;
    if (saved.targetClears) targetClears = saved.targetClears;
    phase = saved.phase === 'round_complete' || saved.phase === 'game_over' ? saved.phase : 'playing';
    dryMoves = Number(saved.dryMoves) || 0;
    const incoming = Array.isArray(saved.pieces) ? saved.pieces : [];
    pieces = emptySlots(traySize).map((_, index) => hydratePiece(incoming[index]));
    if (phase === 'playing' && trayIsEmpty()) deal();
    else if (phase === 'playing' && !hasAnyMove(board, pieces)) phase = 'game_over';
  } else {
    deal();
  }

  function snapshot() {
    return {
      board,
      pieces,
      score: points,
      streak,
      bestStreak,
      combo,
      roundClears,
      totalClears,
      targetClears,
      phase,
      hint,
      grid,
      dryMoves
    };
  }

  function placed(gained, lines, found, color, roundComplete) {
    return {
      ok: true,
      gained,
      lines,
      combo,
      rows: found.rows,
      cols: found.cols,
      color,
      roundComplete,
      gameOver: phase === 'game_over'
    };
  }

  return {
    get state() {
      return snapshot();
    },
    place(index, x, y) {
      if (phase !== 'playing') return { ok: false, reason: 'not_playing' };
      const piece = pieces[index];
      if (!piece) return { ok: false, reason: 'no_piece' };
      if (!canPlace(board, piece.shape, x, y)) return { ok: false, reason: 'blocked' };
      const color = piece.color;
      board = paint(board, piece.shape, x, y, color);
      const found = findClears(board);
      const lines = found.rows.length + found.cols.length;
      board = applyClears(board, found);
      const grace = Math.max(0, Math.floor(Number(score?.graceMoves) || 0));
      if (lines > 0) {
        streak += 1;
        dryMoves = 0;
      } else {
        dryMoves += 1;
        if (dryMoves > grace) {
          streak = 0;
          dryMoves = 0;
        }
      }
      bestStreak = Math.max(bestStreak, streak);
      combo = lines >= 2 ? lines : 0;
      const gained = scorePlacement({
        cells: cellCount(piece.shape),
        lines,
        streak,
        tuning: score
      });
      points += gained;
      roundClears += lines;
      totalClears += lines;
      hint = null;
      pieces = pieces.slice();
      pieces[index] = null;
      if (roundClears >= targetClears) {
        phase = 'round_complete';
        return placed(gained, lines, found, color, true);
      }
      if (trayIsEmpty()) deal();
      else if (!hasAnyMove(board, pieces)) phase = 'game_over';
      return placed(gained, lines, found, color, false);
    },
    continueRun(rows) {
      board = clearFullestRows(board, rows);
      streak = 0;
      dryMoves = 0;
      combo = 0;
      hint = null;
      phase = 'playing';
      deal();
      return { gameOver: phase === 'game_over', score: points };
    },
    reroll() {
      if (phase !== 'playing') return { ok: false, gameOver: phase === 'game_over' };
      hint = null;
      deal();
      return { ok: true, gameOver: phase === 'game_over' };
    },
    doubleScore() {
      if (doubled) return { ok: false, score: points };
      doubled = true;
      points *= 2;
      return { ok: true, score: points };
    },
    showHint() {
      let best = null;
      for (const piece of pieces) {
        if (!piece) continue;
        const spot = findSmartHint(board, piece.shape);
        if (!spot) continue;
        if (!best || spot.value > best.value) {
          best = {
            tileId: piece.tileId,
            color: piece.color,
            shape: piece.shape,
            x: spot.x,
            y: spot.y,
            label: spot.value >= 1000 ? 'Clears a line' : 'Fits here'
          };
        }
      }
      hint = best;
      return hint;
    },
    restart(nextTarget = targetClears) {
      board = createBoard(grid);
      points = 0;
      streak = 0;
      dryMoves = 0;
      bestStreak = 0;
      combo = 0;
      roundClears = 0;
      totalClears = 0;
      hint = null;
      targetClears = nextTarget;
      phase = 'playing';
      deal();
      return snapshot();
    },
    nextRound(nextTarget) {
      roundClears = 0;
      combo = 0;
      hint = null;
      targetClears = nextTarget;
      phase = 'playing';
      if (trayIsEmpty() || !hasAnyMove(board, pieces)) deal();
      return snapshot();
    }
  };
}
