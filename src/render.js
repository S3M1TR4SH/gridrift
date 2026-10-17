import { scorePopupStyle, trayPieceStyle } from './danger.js';
import { dragPieceOrigin, traySlots } from './layout.js';
import { SHAPES, fitsAnywhere } from './logic.js';

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

function desaturate(color) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!match) return '#7f8ea3';
  const hex = Number.parseInt(match[1], 16);
  const red = (hex >> 16) & 255;
  const green = (hex >> 8) & 255;
  const blue = hex & 255;
  const y = red * 0.3 + green * 0.59 + blue * 0.11;
  const mix = Math.round(y * 0.35 + 70);
  return `rgb(${mix}, ${mix + 6}, ${Math.min(255, mix + 28)})`;
}

function drawCell(ctx, x, y, size, color, alpha = 1, hatch = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, Math.max(4, size * 0.18));
  ctx.fillStyle = color;
  ctx.fill();
  if (!hatch) {
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x + 3, y + 3, size * 0.42, Math.max(3, size * 0.16), 4);
    ctx.fill();
  } else {
    ctx.globalAlpha = Math.min(1, alpha + 0.25);
    ctx.strokeStyle = '#d5deea';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + size - 6);
    ctx.lineTo(x + size - 6, y + 4);
    ctx.moveTo(x + size * 0.45, y + size - 5);
    ctx.lineTo(x + size - 5, y + size * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPiece(ctx, piece, originX, originY, cell, style = { alpha: 1 }) {
  const alpha = typeof style === 'number' ? style : style.alpha;
  const hatch = typeof style === 'object' && style.hatch;
  const color = typeof style === 'object' && style.desaturate ? desaturate(piece.color) : piece.color;
  piece.shape.forEach((row, dy) => row.forEach((value, dx) => {
    if (!value) return;
    drawCell(ctx, originX + dx * cell, originY + dy * cell, cell, color, alpha, hatch);
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
  const { layout, board, pieces, registry, drag, ghost, hint, selected, juice, danger } = scene;
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
    drawPiece(ctx, piece, origin.x, origin.y, trayCell, trayPieceStyle(fitsAnywhere(board, piece.shape)));
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
    const origin = dragPieceOrigin(drag, drag.lift || 0);
    drawPiece(ctx, drag.piece, origin.x, origin.y, cell, 0.95);
  }

  if (danger?.level) {
    ctx.save();
    ctx.strokeStyle = danger.level >= 2 ? '#ff5d5d' : '#ffc857';
    ctx.lineWidth = danger.level >= 2 ? 4 : 3;
    ctx.globalAlpha = danger.reduced ? 0.9 : 0.55 + 0.45 * Math.abs(Math.sin((danger.time || 0) / 180));
    roundRect(ctx, 2, 2, layout.boardSize - 4, layout.boardSize - 4, 12);
    ctx.stroke();
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const popup of fx.popups || []) {
    const style = scorePopupStyle(popup.level);
    const size = style.fontPx;
    const margin = size;
    const px = Math.max(margin, Math.min(layout.boardSize - margin, popup.x));
    const py = Math.max(margin + 4, Math.min(layout.boardSize - 8, popup.y));
    ctx.save();
    ctx.globalAlpha = Math.max(0.85, popup.alpha);
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(popup.text, px, py);
    ctx.fillStyle = popup.level >= 2 ? '#ffe08a' : style.fill;
    ctx.fillText(popup.text, px, py);
    ctx.restore();
  }
  ctx.restore();
}
