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

export function shouldSkipOnboarding(progress = {}) {
  if (progress.tutorialSeen === true) return true;
  if ((progress.sessions || 0) > 0) return true;
  if ((progress.bestScore || 0) > 0) return true;
  if (progress.run) return true;
  return false;
}
