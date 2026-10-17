import { traySlots } from './layout.js';
import { SHAPES } from './logic.js';

const MAX_SPAN = Object.values(SHAPES).reduce((max, shape) => Math.max(max, shape.length, shape[0].length), 1);

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

function drawPiece(ctx, piece, originX, originY, cell, alpha = 1) {
  piece.shape.forEach((row, dy) => row.forEach((value, dx) => {
    if (!value) return;
    drawCell(ctx, originX + dx * cell, originY + dy * cell, cell, piece.color, alpha);
  }));
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

function trayCellFor(layout) {
  const slot = traySlots(layout)[0];
  const pad = 12;
  const fit = Math.min(
    (slot.w - pad * 2) / MAX_SPAN,
    (slot.h - pad * 2) / MAX_SPAN,
    layout.cell
  );
  return Math.max(8, Math.floor(fit));
}

function drawTintedSprite(ctx, asset, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (asset?.image) {
    ctx.drawImage(asset.image, x, y, size, size);
    if (asset.grayscale) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
    }
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawScene(ctx, scene) {
  const { layout, board, pieces, registry, drag, ghost, hint, selected, juice } = scene;
  const fx = juice || {};
  const trayCell = trayCellFor(layout);
  ctx.save();
  ctx.translate(fx.shakeX || 0, fx.shakeY || 0);
  ctx.clearRect(-16, -16, layout.canvasWidth + 32, layout.canvasHeight + 32);
  ctx.fillStyle = '#10141d';
  ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);
  ctx.fillStyle = '#121722';
  roundRect(ctx, 0, 0, layout.boardSize, layout.boardSize, 12);
  ctx.fill();

  for (let y = 0; y < layout.grid; y += 1) {
    for (let x = 0; x < layout.grid; x += 1) {
      const color = board[y][x] || registry.get('tile.back.01').color;
      drawCell(ctx, x * layout.cell, y * layout.cell, layout.cell, color, board[y][x] ? 1 : 0.9);
    }
  }

  for (const flash of fx.flashes || []) {
    const asset = registry.get(flash.id || 'fx.flash');
    ctx.save();
    ctx.globalAlpha = 0.55 * flash.alpha;
    ctx.fillStyle = '#ffffff';
    if (asset?.image) {
      for (const y of flash.rows) ctx.drawImage(asset.image, 0, y * layout.cell, layout.boardSize, layout.cell);
      for (const x of flash.cols) ctx.drawImage(asset.image, x * layout.cell, 0, layout.cell, layout.boardSize);
    } else {
      for (const y of flash.rows) ctx.fillRect(0, y * layout.cell, layout.boardSize, layout.cell);
      for (const x of flash.cols) ctx.fillRect(x * layout.cell, 0, layout.cell, layout.boardSize);
    }
    ctx.restore();
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
  const snapIndex = fx.snap?.index;
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
    if (!piece || lifted || snapIndex === index) return;
    const origin = shapeOrigin(slot, piece.shape, trayCell);
    drawPiece(ctx, piece, origin.x, origin.y, trayCell);
  });

  if (fx.snap?.piece) {
    const piece = fx.snap.piece;
    const width = piece.shape[0].length * trayCell;
    const height = piece.shape.length * trayCell;
    drawPiece(ctx, piece, fx.snap.x - width / 2, fx.snap.y - height / 2, trayCell, 0.95);
  }

  for (const particle of fx.particles || []) {
    const asset = registry.get(particle.id);
    const size = particle.size * 2;
    drawTintedSprite(ctx, asset, particle.x - size / 2, particle.y - size / 2, size, particle.color, particle.alpha);
  }

  if (drag?.piece) {
    const cell = layout.cell;
    const width = drag.piece.shape[0].length * cell;
    const height = drag.piece.shape.length * cell;
    const lift = drag.lift || 0;
    drawPiece(
      ctx,
      drag.piece,
      drag.x - width / 2,
      drag.y - lift - height / 2,
      cell,
      0.95
    );
  }

  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const popup of fx.popups || []) {
    const size = 18 + (popup.level || 0) * 4;
    ctx.save();
    ctx.globalAlpha = popup.alpha;
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    ctx.fillStyle = popup.level >= 3 ? '#ff6fae' : popup.level >= 2 ? '#ffc857' : '#f4f7fb';
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.restore();
  }
  ctx.restore();
}
