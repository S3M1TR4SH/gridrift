const SAVE_KEY = 'gridrift.run.v1';

function emptySettings() {
  return { reducedMotion: null, haptics: null };
}

function emptyDaily() {
  return { lastCompleted: '', streak: 0, freezes: 0, marks: 0 };
}

function emptySave() {
  return {
    bestScore: 0,
    tutorialSeen: false,
    sessions: 0,
    installDay: '',
    settings: emptySettings(),
    daily: emptyDaily(),
    run: null
  };
}

function day(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function choice(value) {
  if (value === true || value === false) return value;
  return null;
}

function whole(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(1_000_000, Math.floor(number));
}

function playDuration(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(24 * 60 * 60 * 1000, Math.floor(number));
}

function cellValue(cell) {
  if (!cell) return 0;
  if (typeof cell !== 'string') return 0;
  if (cell.length > 32 || /^https?:/i.test(cell)) return 0;
  return cell;
}

function sanitizeRun(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return null;
  if (!Array.isArray(run.board) || run.board.length < 6 || run.board.length > 12) return null;
  const size = run.board.length;
  if (!run.board.every((row) => Array.isArray(row) && row.length === size)) return null;
  if (!Array.isArray(run.pieces)) return null;
  const pieces = run.pieces.slice(0, 3).map((piece) => {
    if (!piece || typeof piece !== 'object') return null;
    if (typeof piece.shapeName !== 'string' || !piece.shapeName || piece.shapeName.length > 32) return null;
    return {
      shapeName: piece.shapeName,
      color: cellValue(piece.color) || '#8b95a8',
      tileId: typeof piece.tileId === 'string' && piece.tileId.startsWith('tile.') ? piece.tileId : 'tile.grey'
    };
  });
  const phase = run.phase === 'round_complete' || run.phase === 'game_over' ? run.phase : 'playing';
  return {
    board: run.board.map((row) => row.map(cellValue)),
    pieces,
    score: whole(run.score),
    streak: whole(run.streak),
    bestStreak: whole(run.bestStreak),
    roundClears: whole(run.roundClears),
    totalClears: whole(run.totalClears),
    targetClears: whole(run.targetClears) || 4,
    levelIndex: whole(run.levelIndex),
    continueUses: whole(run.continueUses),
    hintsUsed: whole(run.hintsUsed) > 0 ? 1 : 0,
    rerollsUsed: whole(run.rerollsUsed) > 0 ? 1 : 0,
    doublesUsed: whole(run.doublesUsed) > 0 ? 1 : 0,
    playMs: playDuration(run.playMs),
    sawStuck: run.sawStuck === true,
    mode: run.mode === 'daily' ? 'daily' : 'arcade',
    phase
  };
}

export function sanitizeSave(data) {
  if (!data || typeof data !== 'object') return emptySave();
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  const daily = data.daily && typeof data.daily === 'object' ? data.daily : {};
  return {
    bestScore: whole(data.bestScore),
    tutorialSeen: data.tutorialSeen === true,
    sessions: whole(data.sessions),
    installDay: day(data.installDay),
    settings: {
      reducedMotion: choice(settings.reducedMotion),
      haptics: choice(settings.haptics)
    },
    daily: {
      lastCompleted: day(daily.lastCompleted),
      streak: whole(daily.streak),
      freezes: Math.min(3, whole(daily.freezes)),
      marks: whole(daily.marks)
    },
    run: sanitizeRun(data.run)
  };
}

export function createSaveStore(storage, key = SAVE_KEY) {
  function load() {
    try {
      const raw = storage.getItem(key);
      if (!raw) return emptySave();
      return sanitizeSave(JSON.parse(raw));
    } catch {
      return emptySave();
    }
  }

  function save(payload) {
    const previous = load();
    const clean = sanitizeSave(payload);
    clean.bestScore = Math.max(previous.bestScore, clean.bestScore);
    storage.setItem(key, JSON.stringify(clean));
    return clean;
  }

  return { load, save, key };
}
