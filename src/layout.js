import { LIMITS } from '../studio-core/index.js';

export const CONTROL_GAP_PX = 96;

if (CONTROL_GAP_PX < LIMITS.ads.minControlSeparationPx) {
  throw new Error('control gap is below the ad guardrail');
}

export function computeLayout({ width, height, grid = 10, playHeight } = {}) {
  const chrome = height > width ? 220 : 150;
  const gap = 8;
  const availW = Math.max(220, width);
  const budget = playHeight == null ? Math.max(280, height - chrome) : Math.max(280, playHeight);
  const trayFloor = 88;
  const trayCap = 140;
  let trayHeight = Math.max(trayFloor, Math.min(trayCap, Math.floor(budget * 0.22)));
  let boardMax = Math.max(grid * 14, budget - trayHeight - gap);
  let cell = Math.max(14, Math.floor(Math.min(availW / grid, boardMax / grid)));
  let boardSize = cell * grid;
  let canvasHeight = boardSize + gap + trayHeight;
  let trayTop = boardSize + gap;
  if (playHeight != null) {
    canvasHeight = Math.floor(budget);
    const room = canvasHeight - boardSize - gap;
    if (room >= trayFloor) {
      trayHeight = Math.min(trayCap, room);
      trayTop = canvasHeight - trayHeight;
    } else {
      trayHeight = Math.max(48, Math.floor(room));
      const boardRoom = Math.max(grid * 14, canvasHeight - trayHeight - gap);
      cell = Math.max(14, Math.floor(Math.min(availW / grid, boardRoom / grid)));
      boardSize = cell * grid;
      trayHeight = Math.max(48, canvasHeight - boardSize - gap);
      trayTop = canvasHeight - trayHeight;
    }
  }
  return {
    cell,
    grid,
    gap,
    boardSize,
    trayHeight,
    trayTop,
    canvasWidth: boardSize,
    canvasHeight,
    anchor: 'upper'
  };
}

export function snapOrigin(localX, localY, cell, shape) {
  const width = shape[0].length;
  const height = shape.length;
  return {
    x: Math.round(localX / cell - width / 2),
    y: Math.round(localY / cell - height / 2)
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
