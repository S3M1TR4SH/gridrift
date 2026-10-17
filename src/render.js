import { traySlots } from './layout.js';

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCell(ctx, x, y, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, Math.max(4, size * 0.18));
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x + 3, y + 3, size * 0.42, Math.max(3, size * 0.16), 4);
  ctx.fill();
  ctx.restore();
}

function shapeOrigin(slot, shape, cell) {
  const width = shape[0].length * cell;
  const height = shape.length * cell;
  return {
    x: slot.x + (slot.w - width) / 2,
    y: slot.y + (slot.h - height) / 2,
    cell
  };
}

function slotCell(shape, slot) {
  const pad = 14;
  const fit = Math.min(
    (slot.w - pad * 2) / shape[0].length,
    (slot.h - pad * 2) / shape.length
  );
  return Math.max(8, Math.floor(fit));
}

export function drawScene(ctx, scene) {
  const { layout, board, pieces, registry, drag, ghost, hint, selected } = scene;
  const back = registry.get('tile.back.01');
  ctx.clearRect(0, 0, layout.canvasWidth, layout.canvasHeight);
  ctx.fillStyle = '#121722';
  roundRect(ctx, 0, 0, layout.boardSize, layout.boardSize, 12);
  ctx.fill();

  for (let y = 0; y < layout.grid; y += 1) {
    for (let x = 0; x < layout.grid; x += 1) {
      const color = board[y][x] || back.color;
      drawCell(ctx, x * layout.cell, y * layout.cell, layout.cell, color, board[y][x] ? 1 : 0.9);
    }
  }

  if (hint?.shape) {
    hint.shape.forEach((row, dy) => row.forEach((cell, dx) => {
      if (!cell) return;
      const px = (hint.x + dx) * layout.cell;
      const py = (hint.y + dy) * layout.cell;
      drawCell(ctx, px, py, layout.cell, hint.color, 0.28);
      ctx.save();
      ctx.strokeStyle = '#f4f7fb';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(px + 2, py + 2, layout.cell - 4, layout.cell - 4);
      ctx.restore();
    }));
  }

  if (ghost?.shape) {
    ghost.shape.forEach((row, dy) => row.forEach((cell, dx) => {
      if (!cell) return;
      const px = (ghost.x + dx) * layout.cell;
      const py = (ghost.y + dy) * layout.cell;
      drawCell(ctx, px, py, layout.cell, ghost.valid ? ghost.color : '#ff5d5d', ghost.valid ? 0.45 : 0.28);
    }));
  }

  const slots = traySlots(layout);
  slots.forEach((slot, index) => {
    ctx.fillStyle = '#1a2130';
    roundRect(ctx, slot.x + 6, slot.y + 6, slot.w - 12, slot.h - 12, 12);
    ctx.fill();
    if (selected === index) {
      ctx.strokeStyle = registry.get('tile.blue').color;
      ctx.lineWidth = 2;
      roundRect(ctx, slot.x + 6, slot.y + 6, slot.w - 12, slot.h - 12, 12);
      ctx.stroke();
    }
    const piece = pieces[index];
    const lifted = drag && drag.index === index;
    if (!piece || lifted) return;
    const cell = slotCell(piece.shape, slot);
    const origin = shapeOrigin(slot, piece.shape, cell);
    piece.shape.forEach((row, dy) => row.forEach((value, dx) => {
      if (!value) return;
      drawCell(ctx, origin.x + dx * cell, origin.y + dy * cell, cell, piece.color);
    }));
  });

  if (drag?.piece && !ghost) {
    const cell = Math.max(16, layout.cell * 0.72);
    const width = drag.piece.shape[0].length * cell;
    const height = drag.piece.shape.length * cell;
    drag.piece.shape.forEach((row, dy) => row.forEach((value, dx) => {
      if (!value) return;
      drawCell(
        ctx,
        drag.x - width / 2 + dx * cell,
        drag.y - height / 2 + dy * cell,
        cell,
        drag.piece.color,
        0.95
      );
    }));
  }
}
