const PARTICLE_IDS = [
  'fx.particle.1',
  'fx.particle.2',
  'fx.particle.3',
  'fx.particle.4',
  'fx.particle.5',
  'fx.particle.6',
  'fx.particle.7',
  'fx.particle.8'
];

const STREAK_IDS = ['sfx.streak.1', 'sfx.streak.2', 'sfx.streak.3'];

const MAX_EFFECT_MS = 399;

const JUICE_DEFAULTS = {
  flashMs: 180,
  particleCount: 12,
  particleLifeMs: 360,
  popupMs: 320,
  shakeMs: 240,
  shakePx: 5,
  invalidShakeMs: 200,
  invalidShakePx: 7,
  snapBackMs: 180,
  dragLiftPx: 76,
  streakSteps: [2, 4, 6],
  sounds: {
    clear: 'sfx.clear',
    combo: 'sfx.combo',
    invalid: 'sfx.invalid',
    streak: STREAK_IDS.slice(),
    tap: 'sfx.ui.tap',
    tutorial: 'sfx.tutorial.step'
  },
  particleIds: PARTICLE_IDS.slice(),
  flashId: 'fx.flash'
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function effectMs(value, fallback) {
  return clamp(value, 0, MAX_EFFECT_MS, Math.min(fallback, MAX_EFFECT_MS));
}

function assetId(value, fallback) {
  if (typeof value !== 'string' || !value || /https?:/i.test(value) || value.includes('://')) return fallback;
  return value;
}

function idList(value, fallback, limit) {
  if (!Array.isArray(value)) return fallback.slice();
  const clean = value.map((id) => assetId(id, '')).filter(Boolean).slice(0, limit);
  return clean.length ? clean : fallback.slice();
}

export function resolveJuice(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const sounds = source.sounds && typeof source.sounds === 'object' ? source.sounds : {};
  const steps = Array.isArray(source.streakSteps) && source.streakSteps.length
    ? source.streakSteps
      .map((step) => Math.max(1, Math.floor(Number(step) || 1)))
      .slice(0, 8)
    : JUICE_DEFAULTS.streakSteps.slice();
  return {
    flashMs: effectMs(source.flashMs, JUICE_DEFAULTS.flashMs),
    particleCount: Math.round(clamp(source.particleCount, 0, 40, JUICE_DEFAULTS.particleCount)),
    particleLifeMs: effectMs(source.particleLifeMs, JUICE_DEFAULTS.particleLifeMs),
    popupMs: effectMs(source.popupMs, JUICE_DEFAULTS.popupMs),
    shakeMs: effectMs(source.shakeMs, JUICE_DEFAULTS.shakeMs),
    shakePx: clamp(source.shakePx, 0, 16, JUICE_DEFAULTS.shakePx),
    invalidShakeMs: effectMs(source.invalidShakeMs, JUICE_DEFAULTS.invalidShakeMs),
    invalidShakePx: clamp(source.invalidShakePx, 0, 16, JUICE_DEFAULTS.invalidShakePx),
    snapBackMs: effectMs(source.snapBackMs, JUICE_DEFAULTS.snapBackMs),
    dragLiftPx: clamp(source.dragLiftPx, 0, 160, JUICE_DEFAULTS.dragLiftPx),
    streakSteps: steps,
    sounds: {
      clear: assetId(sounds.clear, JUICE_DEFAULTS.sounds.clear),
      combo: assetId(sounds.combo, JUICE_DEFAULTS.sounds.combo),
      invalid: assetId(sounds.invalid, JUICE_DEFAULTS.sounds.invalid),
      streak: idList(sounds.streak, STREAK_IDS, 3),
      tap: assetId(sounds.tap, JUICE_DEFAULTS.sounds.tap),
      tutorial: assetId(sounds.tutorial, JUICE_DEFAULTS.sounds.tutorial)
    },
    particleIds: idList(source.particleIds, PARTICLE_IDS, 8),
    flashId: assetId(source.flashId, JUICE_DEFAULTS.flashId)
  };
}

export function celebrationLevel(streak, steps = JUICE_DEFAULTS.streakSteps) {
  let level = 0;
  for (const step of steps) {
    if (streak >= step) level += 1;
  }
  return level;
}

function streakSound(sounds, level) {
  if (level < 1) return null;
  const list = sounds.streak;
  const index = Math.min(list.length, level) - 1;
  return list[Math.max(0, index)] || null;
}

export function createFeedback({
  config,
  now = () => 0,
  random = Math.random,
  reducedMotion = false
} = {}) {
  const juice = resolveJuice(config);
  const effects = [];
  let reduced = Boolean(reducedMotion);

  function particleId() {
    const ids = juice.particleIds;
    return ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
  }

  function clear(event = {}) {
    const born = now();
    const rows = Array.isArray(event.rows) ? event.rows : [];
    const cols = Array.isArray(event.cols) ? event.cols : [];
    const lines = rows.length + cols.length;
    const intensity = Math.max(1, lines);
    const pitch = 1 + Math.max(0, lines - 1) * 0.12;
    const level = celebrationLevel(event.streak || 0, juice.streakSteps);
    const sounds = [];
    if (lines > 0) sounds.push(juice.sounds.clear);
    if (lines >= 2) sounds.push(juice.sounds.combo);
    const streakId = streakSound(juice.sounds, level);
    if (streakId) sounds.push(streakId);
    const cell = event.cell || 1;
    const grid = event.grid || 1;
    const count = reduced
      ? 0
      : Math.min(40, Math.round(juice.particleCount * (lines <= 1 ? 1 : lines)));
    const shakeScale = lines >= 2 ? 1 + Math.max(0, lines - 2) * 0.25 : 0.35;
    const particles = [];
    for (let i = 0; i < count; i += 1) {
      const useRow = rows.length && (i % 2 === 0 || !cols.length);
      let x = event.popupX || 0;
      let y = event.popupY || 0;
      if (useRow) {
        x = random() * grid * cell;
        y = (rows[i % rows.length] + 0.5) * cell;
      } else if (cols.length) {
        x = (cols[i % cols.length] + 0.5) * cell;
        y = random() * grid * cell;
      }
      const angle = random() * Math.PI * 2;
      const speed = 40 + random() * 90 * (1 + level * 0.25);
      particles.push({
        id: particleId(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born,
        life: juice.particleLifeMs,
        color: event.color || '#ffffff',
        size: 3 + random() * 4
      });
    }
    effects.push({
      kind: 'clear',
      born,
      flashUntil: born + juice.flashMs,
      shakeUntil: born + (reduced ? 0 : juice.shakeMs),
      popupUntil: born + juice.popupMs,
      shakePx: reduced ? 0 : juice.shakePx * shakeScale * (1 + Math.max(0, level - 1) * 0.35),
      rows,
      cols,
      color: event.color || '#ffffff',
      points: event.points || 0,
      popupText: event.popupText || '',
      streak: event.streak || 0,
      popupX: event.popupX || 0,
      popupY: event.popupY || 0,
      particles,
      level
    });
    return {
      sounds,
      level,
      pitch,
      intensity,
      flashId: juice.flashId,
      particleIds: juice.particleIds.slice()
    };
  }

  function invalid(event = {}) {
    const born = now();
    effects.push({
      kind: 'invalid',
      born,
      shakeUntil: born + (reduced ? 0 : juice.invalidShakeMs),
      shakePx: reduced ? 0 : juice.invalidShakePx,
      snapUntil: born + juice.snapBackMs,
      fromX: event.fromX || 0,
      fromY: event.fromY || 0,
      toX: event.toX || 0,
      toY: event.toY || 0,
      piece: event.piece || null,
      index: event.index
    });
    return { sounds: [juice.sounds.invalid] };
  }

  function levelComplete(event = {}) {
    return clear({
      ...event,
      points: event.points || 0,
      popupText: 'Level clear',
      rows: event.rows?.length ? event.rows : [0],
      cols: event.cols || []
    });
  }

  function sample(time) {
    const alive = [];
    const flashes = [];
    const particles = [];
    const popups = [];
    let shakeX = 0;
    let shakeY = 0;
    let snap = null;
    for (const effect of effects) {
      if (effect.kind === 'clear') {
        const flashLeft = effect.flashUntil - time;
        const shakeLeft = effect.shakeUntil - time;
        const popupLeft = effect.popupUntil - time;
        const particleAlive = effect.particles.some((particle) => time - particle.born < particle.life);
        if (flashLeft <= 0 && shakeLeft <= 0 && popupLeft <= 0 && !particleAlive) continue;
        alive.push(effect);
        if (flashLeft > 0) {
          const span = Math.max(1, effect.flashUntil - effect.born);
          flashes.push({
            id: juice.flashId,
            rows: effect.rows,
            cols: effect.cols,
            color: effect.color,
            alpha: flashLeft / span
          });
        }
        if (shakeLeft > 0) {
          const span = Math.max(1, effect.shakeUntil - effect.born);
          const amp = effect.shakePx * (shakeLeft / span);
          const phase = (time - effect.born) / 30;
          shakeX += Math.sin(phase) * amp;
          shakeY += Math.cos(phase * 1.3) * amp * 0.35;
        }
        if (popupLeft > 0) {
          const span = Math.max(1, effect.popupUntil - effect.born);
          popups.push({
            text: effect.popupText || `+${effect.points}`,
            x: effect.popupX,
            y: effect.popupY - (1 - popupLeft / span) * 28,
            alpha: Math.min(1, popupLeft / span),
            level: effect.level
          });
          if ((effect.streak || 0) >= 2 && !effect.popupText) {
            popups.push({
              text: `Streak x${effect.streak}`,
              x: effect.popupX,
              y: effect.popupY - 36 - (1 - popupLeft / span) * 28,
              alpha: Math.min(1, popupLeft / span),
              level: effect.level
            });
          }
        }
        for (const particle of effect.particles) {
          const age = time - particle.born;
          if (age < 0 || age >= particle.life) continue;
          const seconds = age / 1000;
          particles.push({
            id: particle.id,
            x: particle.x + particle.vx * seconds,
            y: particle.y + particle.vy * seconds,
            alpha: 1 - age / particle.life,
            size: particle.size,
            color: particle.color
          });
        }
      } else if (effect.kind === 'invalid') {
        const shakeLeft = effect.shakeUntil - time;
        const snapLeft = effect.snapUntil - time;
        if (shakeLeft <= 0 && snapLeft <= 0) continue;
        alive.push(effect);
        if (shakeLeft > 0) {
          const span = Math.max(1, effect.shakeUntil - effect.born);
          const amp = effect.shakePx * (shakeLeft / span);
          shakeX += Math.sin((time - effect.born) / 16) * amp;
        }
        if (snapLeft > 0 && effect.piece) {
          const span = Math.max(1, effect.snapUntil - effect.born);
          const progress = 1 - snapLeft / span;
          const ease = progress * progress * (3 - 2 * progress);
          snap = {
            piece: effect.piece,
            index: effect.index,
            x: effect.fromX + (effect.toX - effect.fromX) * ease,
            y: effect.fromY + (effect.toY - effect.fromY) * ease
          };
        }
      }
    }
    effects.length = 0;
    effects.push(...alive);
    return {
      flashes,
      particles,
      popups,
      shakeX,
      shakeY,
      snap,
      flashId: juice.flashId,
      dragLiftPx: juice.dragLiftPx
    };
  }

  return {
    get config() {
      return juice;
    },
    setReducedMotion(value) {
      reduced = Boolean(value);
    },
    clear,
    invalid,
    levelComplete,
    sample
  };
}
