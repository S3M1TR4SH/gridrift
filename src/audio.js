const TONES = {
  click: { freq: 520, duration: 0.05, type: 'square', gain: 0.04 },
  place: { freq: 340, duration: 0.08, type: 'triangle', gain: 0.06 },
  error: { freq: 180, duration: 0.12, type: 'sawtooth', gain: 0.03 },
  win: { freq: 660, duration: 0.16, type: 'triangle', gain: 0.05 },
  line_clear: { freq: 480, duration: 0.12, type: 'triangle', gain: 0.06 },
  combo: { freq: 720, duration: 0.18, type: 'square', gain: 0.05 },
  game_over: { freq: 140, duration: 0.22, type: 'sine', gain: 0.05 },
  clear: { freq: 620, duration: 0.14, type: 'triangle', gain: 0.06 },
  invalid: { freq: 160, duration: 0.12, type: 'sawtooth', gain: 0.03 },
  streak1: { freq: 640, duration: 0.14, type: 'square', gain: 0.045 },
  streak2: { freq: 760, duration: 0.18, type: 'square', gain: 0.05 },
  streak3: { freq: 920, duration: 0.24, type: 'square', gain: 0.055 },
  step: { freq: 580, duration: 0.07, type: 'triangle', gain: 0.04 },
  tap: { freq: 480, duration: 0.04, type: 'square', gain: 0.035 },
  danger: { freq: 220, duration: 0.16, type: 'sine', gain: 0.04 }
};

export function createAudio(registry) {
  let context = null;
  let muted = false;

  function tone(kind, rate = 1) {
    if (muted || typeof AudioContext === 'undefined') return;
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume();
    const spec = TONES[kind] ?? TONES.click;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = spec.type;
    const pitch = Number.isFinite(rate) && rate > 0 ? rate : 1;
    oscillator.frequency.value = spec.freq * pitch;
    gain.gain.value = spec.gain;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const now = context.currentTime;
    gain.gain.setValueAtTime(spec.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);
    oscillator.start(now);
    oscillator.stop(now + spec.duration);
  }

  return {
    play(id, rate = 1) {
      const asset = registry.get(id);
      if (!asset || asset.kind !== 'sfx') return;
      tone(asset.synth, rate);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    unlock() {
      if (typeof AudioContext === 'undefined') return;
      if (!context) context = new AudioContext();
      if (context.state === 'suspended') context.resume();
    }
  };
}
