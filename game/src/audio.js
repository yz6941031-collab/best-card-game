// audio.js — a pocket synthesiser for Starforge Duel's sound effects.
// No audio files: every sound is an oscillator blip shaped in code, so the
// game ships zero assets and still clicks, thuds and chimes. The context is
// created lazily on the first user gesture (browsers refuse it earlier),
// and every call is safe when audio is unavailable. The set is deliberately
// small — a play tick, a damage thud, a shield ring, a heal chime, a draw
// flick, and one sting each for victory and defeat — each a few dozen
// milliseconds, none of them looping.

let context = null;

function ensureContext() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return context;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

function blip({ freq = 440, slide = 0, type = 'sine', ms = 120, gain = 0.12, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + ms / 1000);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + ms / 1000 + 0.02);
}

/** Unlock audio from a click or keypress (call from any gesture handler). */
export function unlockAudio() {
  ensureContext();
}

export function soundPlayCard() {
  blip({ freq: 520, slide: 160, type: 'triangle', ms: 90, gain: 0.08 });
}

export function soundDamage(big) {
  blip({ freq: big ? 160 : 220, slide: -110, type: 'sawtooth', ms: big ? 220 : 140, gain: 0.14 });
}

export function soundShield() {
  blip({ freq: 740, slide: 220, type: 'sine', ms: 130, gain: 0.09 });
}

export function soundHeal() {
  blip({ freq: 520, type: 'sine', ms: 110, gain: 0.08 });
  blip({ freq: 780, type: 'sine', ms: 140, gain: 0.08, delay: 0.07 });
}

export function soundDraw() {
  blip({ freq: 980, slide: -300, type: 'triangle', ms: 60, gain: 0.05 });
}

export function soundVictory() {
  [523, 659, 784, 1046].forEach((freq, i) => blip({ freq, type: 'triangle', ms: 220, gain: 0.1, delay: i * 0.11 }));
}

export function soundDefeat() {
  [392, 330, 262, 196].forEach((freq, i) => blip({ freq, type: 'triangle', ms: 240, gain: 0.1, delay: i * 0.13 }));
}
