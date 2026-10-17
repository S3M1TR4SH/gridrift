import { createBoard } from './logic.js';

const PIECE = { shapeName: 'dot', color: '#3d8bfd', tileId: 'tile.blue' };

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export function scriptedBoards() {
  const line = createBoard(6);
  for (let x = 0; x < 5; x += 1) line[0][x] = '#8b95a8';
  const column = createBoard(6);
  for (let y = 0; y < 5; y += 1) column[y][0] = '#8b95a8';
  const tray = [PIECE, { ...PIECE }, { ...PIECE }];
  return [
    {
      prompt: 'Fill this line',
      board: line,
      pieces: tray,
      moves: [{ index: 0, x: 5, y: 0 }]
    },
    {
      prompt: 'Fill this column',
      board: column,
      pieces: tray.map((piece) => ({ ...piece })),
      moves: [{ index: 0, x: 0, y: 5 }]
    }
  ];
}

export function coachMarks(clearsGoal = 4) {
  const goal = Math.max(1, Math.floor(Number(clearsGoal) || 4));
  return [
    { target: 'tray', text: 'Drag a block onto the grid' },
    { target: 'board', text: 'Fill a row or column to clear it' },
    { target: 'clearsGoal', text: `Clear ${goal} lines to finish the level` }
  ];
}

export function openingBoard(grid = 6) {
  const board = createBoard(grid);
  for (let x = 0; x < grid - 3; x += 1) board[0][x] = '#8b95a8';
  const colors = ['#3d8bfd', '#5ee1b4', '#ffb020'];
  const pieces = colors.map((color) => ({
    shapeName: 'line3',
    color,
    tileId: 'tile.blue'
  }));
  return { board, pieces, prompt: 'Fill this line' };
}

export function shouldSkipOnboarding(progress = {}) {
  if (progress.tutorialSeen === true) return true;
  if ((progress.sessions || 0) > 0) return true;
  if ((progress.bestScore || 0) > 0) return true;
  if (progress.run) return true;
  return false;
}
