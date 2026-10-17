const TONES = {
  click: { freq: 520, duration: 0.05, type: 'square', gain: 0.04 },
  place: { freq: 340, duration: 0.08, type: 'triangle', gain: 0.06 },
  error: { freq: 180, duration: 0.12, type: 'sawtooth', gain: 0.03 },
  win: { freq: 660, duration: 0.16, type: 'triangle', gain: 0.05 },
  line_clear: { freq: 480, duration: 0.12, type: 'triangle', gain: 0.06 },
  combo: { freq: 720, duration: 0.18, type: 'square', gain: 0.05 },
  game_over: { freq: 140, duration: 0.22, type: 'sine', gain: 0.05 }
};

export function createAudio(registry) {
  let context = null;
  let muted = false;

  function tone(kind) {
    if (muted || typeof AudioContext === 'undefined') return;
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume();
    const spec = TONES[kind] ?? TONES.click;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = spec.type;
    oscillator.frequency.value = spec.freq;
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
    play(id) {
      const asset = registry.get(id);
      if (!asset || asset.kind !== 'sfx') return;
      tone(asset.synth);
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
