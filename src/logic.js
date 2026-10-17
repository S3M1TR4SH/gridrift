export const SHAPES = {
  dot: [[1]],
  line2: [[1, 1]],
  line3: [[1, 1, 1]],
  line3v: [[1], [1], [1]],
  line4: [[1, 1, 1, 1]],
  line5: [[1, 1, 1, 1, 1]],
  square: [[1, 1], [1, 1]],
  s: [[1, 1, 0], [0, 1, 1]],
  z: [[0, 1, 1], [1, 1, 0]],
  l: [[1, 0], [1, 0], [1, 1]],
  j: [[0, 1], [0, 1], [1, 1]],
  t: [[1, 1, 1], [0, 1, 0]],
  corner: [[1, 1], [1, 0]]
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
  return pieces.some((piece) => fitsAnywhere(board, piece.shape));
}

export function findHint(board, shape) {
  for (let y = 0; y <= board.length - shape.length; y += 1) {
    for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
      if (canPlace(board, shape, x, y)) return { x, y };
    }
  }
  return null;
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
  return place + Math.round((linePoints + comboBonus) * multiplier);
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

export function createMatch({
  grid = 10,
  traySize = 3,
  score,
  rng = Math.random,
  targetClears = 4,
  poolFor = () => SAFE_SHAPES,
  palette = []
}) {
  let board = createBoard(grid);
  let pieces = [];
  let points = 0;
  let streak = 0;
  let bestStreak = 0;
  let combo = 0;
  let roundClears = 0;
  let totalClears = 0;
  let phase = 'playing';
  let hint = null;

  function deal() {
    const dealt = dealPieces({
      board,
      pool: poolFor(totalClears),
      count: traySize,
      rng,
      palette
    });
    pieces = dealt.pieces;
    if (dealt.gameOver || !hasAnyMove(board, pieces)) phase = 'game_over';
  }

  deal();

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
      grid
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
      board = paint(board, piece.shape, x, y, piece.color);
      const found = findClears(board);
      const lines = found.rows.length + found.cols.length;
      board = applyClears(board, found);
      streak = lines > 0 ? streak + 1 : 0;
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
      pieces = pieces.filter((_, pieceIndex) => pieceIndex !== index);
      if (roundClears >= targetClears) {
        phase = 'round_complete';
        return { ok: true, gained, lines, combo, roundComplete: true, gameOver: false };
      }
      if (pieces.length === 0) deal();
      else if (!hasAnyMove(board, pieces)) phase = 'game_over';
      return { ok: true, gained, lines, combo, roundComplete: false, gameOver: phase === 'game_over' };
    },
    continueRun(rows) {
      board = clearFullestRows(board, rows);
      streak = 0;
      combo = 0;
      hint = null;
      phase = 'playing';
      deal();
      return { gameOver: phase === 'game_over', score: points };
    },
    showHint() {
      const piece = pieces.find((candidate) => fitsAnywhere(board, candidate.shape)) ?? pieces[0];
      if (!piece) return null;
      hint = { tileId: piece.tileId, color: piece.color, shape: piece.shape, ...findHint(board, piece.shape) };
      if (hint.x == null) hint = null;
      return hint;
    },
    restart(nextTarget = targetClears) {
      board = createBoard(grid);
      points = 0;
      streak = 0;
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
      if (pieces.length === 0 || !hasAnyMove(board, pieces)) deal();
      return snapshot();
    }
  };
}
