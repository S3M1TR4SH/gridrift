import { LIMITS } from '../studio-core/guardrails/limits.js';

export const CONTROL_GAP_PX = 96;

if (CONTROL_GAP_PX < LIMITS.ads.minControlSeparationPx) {
  throw new Error('control gap is below the ad guardrail');
}

export function computeLayout({ width, height, grid = 10 }) {
  const chrome = 104;
  const pad = 16;
  const gap = 8;
  const availW = Math.max(220, width - pad * 2);
  const availH = Math.max(280, height - chrome);
  const trayHeight = Math.max(96, Math.min(150, Math.floor(availH * 0.24)));
  const boardMax = Math.max(grid * 14, availH - trayHeight - gap);
  const cell = Math.max(14, Math.floor(Math.min(availW / grid, boardMax / grid)));
  const boardSize = cell * grid;
  return {
    cell,
    grid,
    gap,
    boardSize,
    trayHeight,
    canvasWidth: boardSize,
    canvasHeight: boardSize + gap + trayHeight
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
  const top = layout.boardSize + layout.gap;
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
