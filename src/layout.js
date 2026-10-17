import { LIMITS } from '../studio-core/index.js';

export const CONTROL_GAP_PX = 96;

if (CONTROL_GAP_PX < LIMITS.ads.minControlSeparationPx) {
  throw new Error('control gap is below the ad guardrail');
}

export const BOARD_MAX_PX = 560;

export function computeLayout({ width, height, grid = 10, playHeight } = {}) {
  const gap = 16;
  const trayFloor = 96;
  const trayCap = 180;
  const availW = Math.min(BOARD_MAX_PX, Math.max(grid * 14, width));
  let cell = Math.max(14, Math.floor(availW / grid));
  const limit = playHeight == null ? Infinity : Math.floor(playHeight);
  while (cell > 14) {
    const board = cell * grid;
    const tray = Math.min(trayCap, Math.max(trayFloor, cell * 2 + gap));
    if (board + gap + tray <= limit) break;
    cell -= 1;
  }
  const boardSize = cell * grid;
  const trayHeight = Math.min(trayCap, Math.max(trayFloor, cell * 2 + gap));
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
    maxBoard: BOARD_MAX_PX,
    cellAspect: 1
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
  return pointerToBoard(
    (rect?.left || 0) + local.x,
    (rect?.top || 0) + local.y,
    rect,
    layout
  );
}

export function pointerToBoard(clientX, clientY, rect, layout) {
  const left = rect?.left || 0;
  const top = rect?.top || 0;
  const width = rect?.width > 0 ? rect.width : layout.canvasWidth;
  const height = rect?.height > 0 ? rect.height : layout.canvasHeight;
  return {
    x: (clientX - left) * (layout.canvasWidth / width),
    y: (clientY - top) * (layout.canvasHeight / height)
  };
}

export function dragPieceOrigin(point, lift = 0) {
  return {
    x: point.x,
    y: point.y - (Number(lift) || 0)
  };
}
