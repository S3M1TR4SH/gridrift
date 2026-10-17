import { LIMITS } from '../studio-core/index.js';

export const CONTROL_GAP_PX = 96;

if (CONTROL_GAP_PX < LIMITS.ads.minControlSeparationPx) {
  throw new Error('control gap is below the ad guardrail');
}

export const BOARD_MAX_PX = 560;

export function computeLayout({ width, height, grid = 10, playHeight } = {}) {
  const gap = 8;
  const trayFloor = 96;
  const trayCap = 180;
  const availW = Math.min(BOARD_MAX_PX, Math.max(grid * 14, width));
  let cell = Math.max(14, Math.floor(availW / grid));
  let boardSize = cell * grid;
  let trayHeight = Math.min(trayCap, Math.max(trayFloor, cell * 2));
  if (playHeight != null) {
    const room = Math.floor(playHeight) - boardSize - gap;
    if (room >= trayFloor) trayHeight = Math.min(trayCap, room);
  }
  const trayTop = boardSize + gap;
  return {
    cell,
    grid,
    gap,
    boardSize,
    trayHeight,
    trayTop,
    canvasWidth: boardSize,
    canvasHeight: trayTop + trayHeight,
    anchor: 'upper',
    maxBoard: BOARD_MAX_PX
  };
}

export function snapOrigin(localX, localY, cell) {
  return {
    x: Math.floor(localX / cell),
    y: Math.floor(localY / cell)
  };
}

export function traySlots(layout) {
  const top = layout.trayTop ?? (layout.boardSize + layout.gap);
  const slotW = layout.boardSize / 3;
  return [0, 1, 2].map((index) => ({
    index,
    x: index * slotW,
    y: top,
    w: slotW,
    h: layout.trayHeight
  }));
}

export function hitTray(x, y, layout) {
  const slot = traySlots(layout).find((entry) => x >= entry.x && x < entry.x + entry.w && y >= entry.y && y < entry.y + entry.h);
  return slot ? slot.index : -1;
}

export function pointerScale(local, rect, layout) {
  const width = rect?.width || layout.canvasWidth;
  const height = rect?.height || layout.canvasHeight;
  return {
    x: local.x * (layout.canvasWidth / width),
    y: local.y * (layout.canvasHeight / height)
  };
}
