const TILE_COLORS = {
  'tile.blue': '#3d8bfd',
  'tile.green': '#3ecf8e',
  'tile.orange': '#ff9f43',
  'tile.pink': '#ff6fae',
  'tile.red': '#ff5d5d',
  'tile.yellow': '#ffc857',
  'tile.grey': '#8b95a8',
  'tile.back.01': '#1c2433'
};

const SFX = {
  'sfx.click': 'click',
  'sfx.place': 'place',
  'sfx.error': 'error',
  'sfx.win': 'win',
  'sfx.line_clear': 'line_clear',
  'sfx.combo': 'combo',
  'sfx.game_over': 'game_over',
  'sfx.clear': 'clear',
  'sfx.invalid': 'invalid',
  'sfx.danger': 'danger',
  'sfx.streak.1': 'streak1',
  'sfx.streak.2': 'streak2',
  'sfx.streak.3': 'streak3',
  'sfx.tutorial.step': 'step',
  'sfx.ui.tap': 'tap'
};

export const PLACEHOLDER_FILES = {
  'icon.gridrift.icon-192': 'branding/icon-192.png',
  'icon.gridrift.icon-512': 'branding/icon-512.png',
  'icon.gridrift.icon-512-maskable': 'branding/icon-512-maskable.png',
  'icon.gridrift.apple-touch-icon': 'branding/apple-touch-icon.png',
  'icon.gridrift.favicon-32': 'branding/favicon-32.png',
  'icon.gridrift.favicon-ico': 'branding/favicon.ico'
};

function isRemote(url) {
  const value = String(url).toLowerCase();
  return value.startsWith('http:') || value.startsWith('https:');
}

export function placeholderFor(id) {
  if (id.startsWith('tile.')) {
    return {
      id,
      status: 'placeholder',
      placeholder: true,
      kind: 'tile',
      color: TILE_COLORS[id] ?? '#5ee1b4',
      draw: 'rounded-cell'
    };
  }
  if (id.startsWith('ui.')) {
    return { id, status: 'placeholder', placeholder: true, kind: 'ui', draw: 'shape', color: '#3d8bfd' };
  }
  if (id.startsWith('font.')) {
    return { id, status: 'placeholder', placeholder: true, kind: 'font', family: 'system-ui, sans-serif' };
  }
  if (id.startsWith('sfx.')) {
    return { id, status: 'placeholder', placeholder: true, kind: 'sfx', synth: SFX[id] ?? 'click' };
  }
  if (id.startsWith('fx.particle.')) {
    return {
      id,
      status: 'placeholder',
      placeholder: true,
      kind: 'fx',
      draw: 'particle',
      grayscale: true,
      color: '#ffffff'
    };
  }
  if (id.startsWith('fx.')) {
    return { id, status: 'placeholder', placeholder: true, kind: 'fx', draw: 'flash', color: '#ffffff' };
  }
  if (id.startsWith('icon.')) {
    return {
      id,
      status: 'placeholder',
      placeholder: true,
      kind: 'icon',
      url: PLACEHOLDER_FILES[id] ?? null,
      draw: 'generated-mark'
    };
  }
  return { id, status: 'placeholder', placeholder: true, kind: 'unknown', draw: 'rect', color: '#5ee1b4' };
}

export function loadAssets(manifest, available = {}) {
  if (!manifest?.library?.repo || !manifest?.library?.tag) {
    throw new Error('asset manifest is missing its library pin');
  }
  if (!Array.isArray(manifest.assets)) {
    throw new Error('asset manifest assets must be a list of ids');
  }
  const assets = {};
  for (const id of manifest.assets) {
    if (typeof id !== 'string' || !id) throw new Error('asset id must be a string');
    const local = available[id];
    if (local?.url) {
      if (isRemote(local.url)) throw new Error(`refusing remote asset url for ${id}`);
      if (local.placeholder === false) {
        assets[id] = { id, status: 'ready', kind: placeholderFor(id).kind, url: local.url, placeholder: false };
        continue;
      }
    }
    const placeholder = placeholderFor(id);
    if (local?.url) placeholder.url = local.url;
    assets[id] = placeholder;
  }
  return {
    library: { repo: manifest.library.repo, tag: manifest.library.tag },
    assets,
    get(id) {
      return assets[id] ?? placeholderFor(id);
    },
    tileIds() {
      return manifest.assets.filter((id) => id.startsWith('tile.') && id !== 'tile.back.01');
    }
  };
}
