// cards.js — the Starforge Duel card pool.
// Every card belongs to one of four suits. A suit is told apart by colour AND
// by the shape of its icon (drawn as inline SVG in render.js), never by text
// alone:
//   ember (red flame)    — damage dealt to the other duelist
//   frost (blue shard)   — shield that soaks damage before health
//   storm (violet bolt)  — energy and extra cards, the tempo suit
//   grove (green leaf)   — healing that restores health
//
// A card definition: { id, name, suit, cost, kind, amount, hits, draw,
// energy, selfHarm, text }. `amount` is the card's headline number (damage,
// shield or healing). `hits` splits damage into several strikes, which
// matters against shield. Resonance (engine.js) adds +2 to `amount` when the
// previously played card this turn shared the suit.

export const SUITS = {
  ember: { name: 'Ember', color: '#ff7847', deep: '#b3351d', glow: 'rgba(255,110,60,.55)' },
  frost: { name: 'Frost', color: '#5ec8ff', deep: '#1d5fb3', glow: 'rgba(90,180,255,.55)' },
  storm: { name: 'Storm', color: '#c99aff', deep: '#6d2fb3', glow: 'rgba(180,120,255,.55)' },
  grove: { name: 'Grove', color: '#7fe08a', deep: '#1f7a3d', glow: 'rgba(110,230,140,.5)' },
};

export const CARD_POOL = [
  // — Ember: the damage suit —
  { id: 'spark-jab', name: 'Spark Jab', suit: 'ember', cost: 1, kind: 'damage', amount: 3, copies: 3, text: 'Deal 3 damage.' },
  { id: 'flame-lance', name: 'Flame Lance', suit: 'ember', cost: 2, kind: 'damage', amount: 5, copies: 3, text: 'Deal 5 damage.' },
  { id: 'twin-fangs', name: 'Twin Fangs', suit: 'ember', cost: 2, kind: 'damage', amount: 3, hits: 2, copies: 2, text: 'Deal 3 damage twice.' },
  { id: 'inferno-arc', name: 'Inferno Arc', suit: 'ember', cost: 3, kind: 'damage', amount: 8, copies: 2, text: 'Deal 8 damage.' },
  { id: 'comet-fall', name: 'Comet Fall', suit: 'ember', cost: 4, kind: 'damage', amount: 11, copies: 1, text: 'Deal 11 damage.' },
  // — Frost: the shield suit —
  { id: 'ice-veil', name: 'Ice Veil', suit: 'frost', cost: 1, kind: 'shield', amount: 4, copies: 4, text: 'Gain 4 shield.' },
  { id: 'glacier-wall', name: 'Glacier Wall', suit: 'frost', cost: 2, kind: 'shield', amount: 7, copies: 2, text: 'Gain 7 shield.' },
  { id: 'mirror-frost', name: 'Mirror Frost', suit: 'frost', cost: 2, kind: 'shield', amount: 5, draw: 1, copies: 2, text: 'Gain 5 shield. Draw a card.' },
  // — Storm: the tempo suit —
  { id: 'static-siphon', name: 'Static Siphon', suit: 'storm', cost: 0, kind: 'energy', amount: 1, copies: 2, text: 'Gain 1 energy.' },
  { id: 'overcharge', name: 'Overcharge', suit: 'storm', cost: 0, kind: 'energy', amount: 2, selfHarm: 2, copies: 2, text: 'Gain 2 energy. Take 2 damage.' },
  { id: 'chain-lightning', name: 'Chain Lightning', suit: 'storm', cost: 2, kind: 'damage', amount: 3, draw: 1, copies: 2, text: 'Deal 3 damage. Draw a card.' },
  // — Grove: the healing suit —
  { id: 'moss-salve', name: 'Moss Salve', suit: 'grove', cost: 1, kind: 'heal', amount: 3, copies: 2, text: 'Restore 3 health.' },
  { id: 'renewal-bloom', name: 'Renewal Bloom', suit: 'grove', cost: 2, kind: 'heal', amount: 6, copies: 2, text: 'Restore 6 health.' },
  { id: 'liferoot', name: 'Liferoot', suit: 'grove', cost: 3, kind: 'heal', amount: 5, shieldAlso: 4, copies: 1, text: 'Restore 5 health. Gain 4 shield.' },
];

/** Expand the pool into a full deck list of card definitions (30 cards). */
export function buildDeckList() {
  const list = [];
  for (const card of CARD_POOL) {
    for (let i = 0; i < (card.copies ?? 1); i += 1) list.push(card);
  }
  return list;
}

/** Look up one card definition by id (used by tests and the AI). */
export function cardById(id) {
  return CARD_POOL.find((card) => card.id === id) ?? null;
}
