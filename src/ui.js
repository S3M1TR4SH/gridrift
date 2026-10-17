import { ageChoice } from './flow.js';

export function createUi(doc = document) {
  const overlay = doc.querySelector('#overlay');
  const score = doc.querySelector('#score');
  const nextGoal = doc.querySelector('#next-goal');
  const lowSpace = doc.querySelector('#low-space');
  const roundNotice = doc.querySelector('#round-notice');
  const best = doc.querySelector('#best');
  const streak = doc.querySelector('#streak');
  const round = doc.querySelector('#round');
  const clears = doc.querySelector('#clears');
  const combo = doc.querySelector('#combo');
  const hint = doc.querySelector('#hint');
  const hintNote = doc.querySelector('#hint-note');
  const reroll = doc.querySelector('#reroll');
  const daily = doc.querySelector('#daily');
  const motion = doc.querySelector('#motion');
  const haptics = doc.querySelector('#haptics');
  const install = doc.querySelector('#install');
  const stats = doc.querySelector('#stats-opt-out');
  const mute = doc.querySelector('#mute');
  const title = doc.querySelector('#title');
  const goal = doc.querySelector('#goal');
  const meter = doc.querySelector('#streak-meter');
  const meterFill = doc.querySelector('#streak-fill');
  const goalMeter = doc.querySelector('#goal-meter');
  const goalFill = doc.querySelector('#goal-fill');
  const banner = doc.querySelector('#banner');
  let onAction = () => {};

  function onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    onAction(button.dataset.action);
  }
  overlay.addEventListener('click', onClick);
  banner?.addEventListener('click', onClick);
  hint.addEventListener('click', () => {
    if (hint.disabled) return;
    onAction('offer_hint');
  });
  reroll.addEventListener('click', () => onAction('offer_reroll'));
  daily.addEventListener('click', () => onAction('daily'));
  motion.addEventListener('click', () => onAction('motion'));
  haptics.addEventListener('click', () => onAction('haptics'));
  install.addEventListener('click', () => onAction('install'));
  if (stats) stats.addEventListener('click', () => onAction('analytics_revoke'));
  mute.addEventListener('click', () => onAction('mute'));

  function button(action) {
    const node = doc.createElement('button');
    node.type = 'button';
    node.dataset.action = action.id;
    node.dataset.slot = action.slot;
    node.className = action.primary ? 'primary' : 'secondary';
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
      if (nextGoal) nextGoal.textContent = String(hud.nextGoal ?? '');
      if (lowSpace) {
        lowSpace.hidden = !hud.lowSpace;
        lowSpace.textContent = hud.lowSpace || '';
      }
      if (best) best.textContent = String(hud.best ?? 0);
      streak.textContent = String(hud.streak);
      round.textContent = hud.round;
      clears.textContent = `${hud.clears}/${hud.target}`;
      if (goal) goal.textContent = hud.goal || 'Clear 4 lines';
      combo.hidden = !(hud.combo >= 2);
      combo.textContent = hud.combo >= 2 ? `Combo ${hud.combo}` : '';
      if (hintNote) {
        hintNote.hidden = !hud.hintNote;
        hintNote.textContent = hud.hintNote || '';
      }
      if (meter && meterFill) {
        const amount = Math.max(0, Math.min(1, hud.meter || 0));
        meterFill.style.width = `${Math.round(amount * 100)}%`;
        meter.dataset.level = String(hud.celebrate || 0);
        meter.setAttribute('aria-valuenow', String(hud.streak));
        meter.setAttribute('aria-valuemax', String(hud.meterMax || 6));
      }
      if (goalMeter && goalFill) {
        const target = Math.max(1, hud.target || 1);
        const amount = Math.max(0, Math.min(1, (hud.clears || 0) / target));
        goalFill.style.width = `${Math.round(amount * 100)}%`;
        goalMeter.setAttribute('aria-valuenow', String(hud.clears || 0));
        goalMeter.setAttribute('aria-valuemax', String(target));
      }
      if (hud.hint === 'off') {
        hint.hidden = true;
      } else {
        hint.hidden = false;
        hint.disabled = hud.hint === 'soon';
        hint.textContent = hud.hint === 'soon' ? 'Hint soon' : 'Hint';
      }
      if (reroll) reroll.hidden = hud.reroll !== 'ready';
      if (daily) {
        daily.textContent = hud.dailyLabel || 'Daily';
        daily.setAttribute('aria-pressed', hud.dailyOn ? 'true' : 'false');
        daily.classList.toggle('badged', Boolean(hud.dailyBadge));
      }
      if (motion) {
        motion.textContent = hud.reducedMotion ? 'Reduced motion' : 'Motion';
        motion.setAttribute('aria-pressed', hud.reducedMotion ? 'true' : 'false');
      }
      if (haptics) {
        haptics.textContent = hud.haptics ? 'Haptics' : 'Haptics off';
        haptics.setAttribute('aria-pressed', hud.haptics ? 'true' : 'false');
      }
      install.hidden = !hud.install;
      if (stats) stats.hidden = !hud.stats;
      mute.textContent = hud.muted ? 'Unmute' : 'Mute';
      mute.setAttribute('aria-pressed', hud.muted ? 'true' : 'false');
    },
    setBanner(model) {
      if (!banner) return;
      const key = model ? JSON.stringify(model) : '';
      if (banner.dataset.model === key) return;
      banner.dataset.model = key;
      if (!model) {
        banner.hidden = true;
        banner.replaceChildren();
        return;
      }
      banner.hidden = false;
      banner.replaceChildren();
      const copy = doc.createElement('p');
      copy.textContent = model.body || '';
      const row = doc.createElement('div');
      row.className = 'banner-actions';
      for (const action of model.actions || []) {
        const node = button({ ...action, primary: action.primary === true });
        if (!action.primary) node.className = 'secondary';
        row.append(node);
      }
      banner.append(copy, row);
    },
    setOverlay(view) {
      if (overlay.dataset.gate === 'age' && view?.screen !== 'age_gate') delete overlay.dataset.gate;
      if (!view || view.screen === 'play') {
        overlay.hidden = true;
        overlay.replaceChildren();
        return;
      }
      const panel = doc.createElement('div');
      panel.className = view.separated ? 'panel separated' : 'panel';
      const heading = doc.createElement('h2');
      heading.textContent = view.title;
      const copy = doc.createElement('p');
      copy.textContent = view.body;
      panel.append(heading);
      if (view.stepLabel) {
        const step = doc.createElement('p');
        step.className = 'step';
        step.textContent = view.stepLabel;
        panel.append(step);
      }
      panel.append(copy);
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
    },
    setAgeGate({ years, copy }) {
      if (overlay.dataset.gate === 'age') return;
      overlay.dataset.gate = 'age';
      const panel = doc.createElement('div');
      panel.className = 'panel';
      const heading = doc.createElement('h2');
      heading.textContent = copy;
      const select = doc.createElement('select');
      select.id = 'birth-year';
      const placeholder = doc.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Year';
      select.append(placeholder);
      for (const year of years) {
        const option = doc.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        select.append(option);
      }
      const action = doc.createElement('button');
      action.type = 'button';
      action.textContent = 'Continue';
      function syncYear() {
        const choice = ageChoice(select.value);
        action.disabled = choice.disabled;
        if (choice.action) action.dataset.action = choice.action;
        else delete action.dataset.action;
      }
      syncYear();
      select.addEventListener('change', syncYear);
      select.addEventListener('input', syncYear);
      panel.append(heading, select, action);
      overlay.hidden = false;
      overlay.replaceChildren(panel);
    },
    clearAgeGate() {
      if (overlay.dataset.gate !== 'age') return;
      delete overlay.dataset.gate;
    },
    setRoundNotice(text) {
      if (!roundNotice) return;
      if (!text) {
        roundNotice.hidden = true;
        return;
      }
      roundNotice.hidden = false;
      roundNotice.textContent = text;
    }
  };
}
