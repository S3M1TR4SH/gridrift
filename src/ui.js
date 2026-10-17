export function createUi(doc = document) {
  const overlay = doc.querySelector('#overlay');
  const score = doc.querySelector('#score');
  const streak = doc.querySelector('#streak');
  const round = doc.querySelector('#round');
  const clears = doc.querySelector('#clears');
  const combo = doc.querySelector('#combo');
  const hint = doc.querySelector('#hint');
  const install = doc.querySelector('#install');
  const stats = doc.querySelector('#stats-opt-out');
  const mute = doc.querySelector('#mute');
  const title = doc.querySelector('#title');
  let onAction = () => {};

  overlay.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    onAction(button.dataset.action);
  });
  hint.addEventListener('click', () => onAction('offer_hint'));
  install.addEventListener('click', () => onAction('install'));
  if (stats) stats.addEventListener('click', () => onAction('analytics_revoke'));
  mute.addEventListener('click', () => onAction('mute'));

  function button(action) {
    const node = doc.createElement('button');
    node.type = 'button';
    node.dataset.action = action.id;
    node.dataset.slot = action.slot;
    node.textContent = action.label;
    return node;
  }

  return {
    onAction(handler) {
      onAction = handler;
    },
    setBrand(name) {
      title.textContent = name;
    },
    setHud(hud) {
      score.textContent = String(hud.score);
      streak.textContent = String(hud.streak);
      round.textContent = hud.round;
      clears.textContent = `${hud.clears}/${hud.target}`;
      combo.hidden = !(hud.combo >= 2);
      combo.textContent = hud.combo >= 2 ? `Combo ${hud.combo}` : '';
      hint.hidden = !hud.hint;
      install.hidden = !hud.install;
      if (stats) stats.hidden = !hud.stats;
      mute.textContent = hud.muted ? 'Unmute' : 'Mute';
      mute.setAttribute('aria-pressed', hud.muted ? 'true' : 'false');
    },
    setOverlay(view) {
      if (!view || view.screen === 'play') {
        overlay.hidden = true;
        overlay.replaceChildren();
        return;
      }
      const panel = doc.createElement('div');
      panel.className = 'panel';
      const heading = doc.createElement('h2');
      heading.textContent = view.title;
      const copy = doc.createElement('p');
      copy.textContent = view.body;
      panel.append(heading, copy);
      const upper = doc.createElement('div');
      upper.className = 'slot-upper';
      const lower = doc.createElement('div');
      lower.className = 'slot-lower';
      for (const action of view.actions) {
        (action.slot === 'lower' ? lower : upper).append(button(action));
      }
      if (upper.childElementCount) panel.append(upper);
      if (view.adSlot) {
        const slot = doc.createElement('div');
        slot.className = 'ad-slot';
        slot.setAttribute('role', 'img');
        slot.setAttribute('aria-label', 'Advertisement placeholder');
        slot.textContent = 'Advertisement placeholder';
        panel.append(slot);
      }
      if (lower.childElementCount) panel.append(lower);
      overlay.hidden = false;
      overlay.replaceChildren(panel);
    }
  };
}
