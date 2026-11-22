// random.js — a tiny seeded random number generator (mulberry32).
// A fixed seed always deals the same game, which keeps the screenshot
// scenes in shots.js reproducible and lets the engine tests in Node play
// whole games deterministically. Seeds are unsigned 32-bit integers; a
// seed of 0 is remapped to 1 inside makeRng, since mulberry32 degenerates
// at an all-zero state.

/** Create a generator function returning floats in [0, 1) from a seed. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle a copy of `items` with the given generator (Fisher–Yates). */
export function shuffled(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** A fresh random seed for a normal (non-screenshot) game. */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
