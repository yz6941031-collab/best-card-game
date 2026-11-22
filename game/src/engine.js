// engine.js — the rules of Starforge Duel as a pure state machine.
// No DOM lives here: the renderer (render.js) draws this state, the input
// layer (input.js) calls these functions, the Warden's brain (ai.js) plans
// with them, and the Node test-suite plays whole games against them.
//
// The duel in one breath: two duelists at 30 health. Each round your energy
// refills and grows (3, 4, 5 … up to 8). Play cards for damage, shield,
// healing or tempo; shield soaks damage before health does. Playing a card
// whose suit matches the card you played just before it this turn triggers
// Resonance: +2 to its damage, shield or healing. First to 0 health loses.
//
// Invariants the rest of the game leans on: each duelist's deck, hand and
// discard always hold 30 cards between them; health and shield never go
// negative; energy never exceeds the round's charge plus what tempo cards
// granted. The Node test-suite asserts all of these across whole games.

import { buildDeckList } from './cards.js';
import { makeRng, shuffled } from './random.js';

export const MAX_HP = 30;
export const HAND_LIMIT = 8;
export const OPENING_HAND = 4;
export const ROUND_DRAW = 2;
export const BASE_CHARGE = 3;
export const MAX_CHARGE = 8;
export const RESONANCE_BONUS = 2;

let nextUid = 1;

/** Wrap a card definition in a unique instance that can sit in a hand. */
function instantiate(def) {
  const instance = { ...def, uid: nextUid };
  nextUid += 1;
  return instance;
}

function makeDuelist(name, rng) {
  return {
    name,
    hp: MAX_HP,
    shield: 0,
    energy: 0,
    charge: BASE_CHARGE,
    deck: shuffled(buildDeckList(), rng).map(instantiate),
    hand: [],
    discard: [],
    lastSuit: null,
  };
}

/** A fresh duel. `seed` makes the shuffle reproducible. */
export function createGame(seed) {
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    round: 0,
    phase: 'player', // 'player' | 'warden' | 'over'
    player: makeDuelist('You', rng),
    warden: makeDuelist('The Warden', rng),
    intent: null, // the Warden's declared plan for this round (set by ai.js)
    winner: null, // 'player' | 'warden' once phase is 'over'
    log: [],
    stats: { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, rounds: 0 },
  };
  drawCards(state, 'player', OPENING_HAND);
  drawCards(state, 'warden', OPENING_HAND);
  return state;
}

export function duelistOf(state, who) {
  return who === 'player' ? state.player : state.warden;
}

export function foeOf(state, who) {
  return who === 'player' ? state.warden : state.player;
}

function note(state, line) {
  state.log.push(line);
  if (state.log.length > 40) state.log.shift();
}

/** Draw up to `count` cards, reshuffling the discard pile when needed. */
export function drawCards(state, who, count) {
  const d = duelistOf(state, who);
  let drawn = 0;
  for (let i = 0; i < count; i += 1) {
    if (d.hand.length >= HAND_LIMIT) break;
    if (d.deck.length === 0 && d.discard.length > 0) {
      d.deck = shuffled(d.discard, state.rng);
      d.discard = [];
    }
    if (d.deck.length === 0) break;
    d.hand.push(d.deck.pop());
    drawn += 1;
  }
  return drawn;
}

/**
 * Begin a round: refill and grow energy, draw the round's cards (the
 * opening round skips the draw — both duelists already hold OPENING_HAND),
 * and clear each duelist's Resonance chain.
 */
export function startRound(state) {
  if (state.phase === 'over') return;
  state.round += 1;
  state.stats.rounds = state.round;
  for (const who of ['player', 'warden']) {
    const d = duelistOf(state, who);
    d.charge = Math.min(BASE_CHARGE + state.round - 1, MAX_CHARGE);
    d.energy = d.charge;
    d.lastSuit = null;
    if (state.round > 1) drawCards(state, who, ROUND_DRAW);
  }
  state.phase = 'player';
  note(state, `— Round ${state.round} —`);
}

/** Damage that shield soaks first. Returns { blocked, dealt }. */
export function applyDamage(state, who, amount) {
  const d = duelistOf(state, who);
  const blocked = Math.min(d.shield, amount);
  d.shield -= blocked;
  const dealt = amount - blocked;
  d.hp = Math.max(0, d.hp - dealt);
  return { blocked, dealt };
}

function checkForEnd(state) {
  if (state.warden.hp <= 0 && state.player.hp > 0) {
    state.phase = 'over';
    state.winner = 'player';
  } else if (state.player.hp <= 0) {
    state.phase = 'over';
    state.winner = 'warden';
  }
}

/** Can `who` play this exact card instance right now? */
export function canPlay(state, who, card) {
  if (state.phase !== who) return false;
  if (!card) return false;
  return duelistOf(state, who).energy >= card.cost;
}

/**
 * Play a card from a duelist's hand. Returns a list of event objects the
 * renderer turns into floaters and log lines:
 *   { type: 'damage'|'shield'|'heal'|'energy'|'draw'|'resonance', who, ... }
 * Returns null when the play is not legal.
 */
export function playCard(state, who, uid) {
  const d = duelistOf(state, who);
  const foe = foeOf(state, who);
  const index = d.hand.findIndex((card) => card.uid === uid);
  if (index < 0 || state.phase !== who) return null;
  const card = d.hand[index];
  if (d.energy < card.cost) return null;

  const events = [];
  d.energy -= card.cost;
  d.hand.splice(index, 1);
  d.discard.push(card);
  if (who === 'player') state.stats.cardsPlayed += 1;

  const resonant = d.lastSuit !== null && d.lastSuit === card.suit
    && (card.kind === 'damage' || card.kind === 'shield' || card.kind === 'heal');
  const bonus = resonant ? RESONANCE_BONUS : 0;
  if (resonant) events.push({ type: 'resonance', who, suit: card.suit });
  d.lastSuit = card.suit;

  if (card.kind === 'damage') {
    const hits = card.hits ?? 1;
    for (let hit = 0; hit < hits; hit += 1) {
      const amount = card.amount + (hit === 0 ? bonus : 0);
      const { blocked, dealt } = applyDamage(state, who === 'player' ? 'warden' : 'player', amount);
      events.push({ type: 'damage', who: who === 'player' ? 'warden' : 'player', amount, blocked, dealt });
      if (who === 'player') state.stats.damageDealt += dealt;
      else state.stats.damageTaken += dealt;
      if (foe.hp <= 0) break;
    }
  } else if (card.kind === 'shield') {
    const amount = card.amount + bonus;
    d.shield += amount;
    events.push({ type: 'shield', who, amount });
  } else if (card.kind === 'heal') {
    const healed = Math.min(MAX_HP - d.hp, card.amount + bonus);
    d.hp += healed;
    events.push({ type: 'heal', who, amount: healed });
    if (card.shieldAlso) {
      d.shield += card.shieldAlso;
      events.push({ type: 'shield', who, amount: card.shieldAlso });
    }
  } else if (card.kind === 'energy') {
    d.energy += card.amount;
    events.push({ type: 'energy', who, amount: card.amount });
    if (card.selfHarm) {
      d.hp = Math.max(0, d.hp - card.selfHarm);
      events.push({ type: 'damage', who, amount: card.selfHarm, blocked: 0, dealt: card.selfHarm, self: true });
    }
  }

  if (card.draw) {
    const drawn = drawCards(state, who, card.draw);
    if (drawn > 0) events.push({ type: 'draw', who, amount: drawn });
  }

  note(state, describePlay(state, who, card, events));
  checkForEnd(state);
  return events;
}

/** One human-readable log line for a play, built from its events. */
function describePlay(state, who, card, events) {
  const actor = who === 'player' ? 'You play' : 'Warden plays';
  const parts = [`${actor} ${card.name}`];
  for (const event of events) {
    if (event.type === 'damage' && !event.self) parts.push(`hits for ${event.amount}${event.blocked ? ` (${event.blocked} blocked)` : ''}`);
    if (event.type === 'damage' && event.self) parts.push(`overload burns ${event.who === 'player' ? 'you' : 'the Warden'} for ${event.amount}`);
    if (event.type === 'shield') parts.push(`+${event.amount} shield`);
    if (event.type === 'heal') parts.push(`heals ${event.amount}`);
    if (event.type === 'energy') parts.push(`+${event.amount} energy`);
    if (event.type === 'draw') parts.push(`draws ${event.amount}`);
    if (event.type === 'resonance') parts.push('RESONANCE +2');
  }
  return parts.join(' · ');
}

/** End the player's turn and hand over to the Warden. */
export function endPlayerTurn(state) {
  if (state.phase !== 'player') return;
  state.phase = 'warden';
  state.warden.lastSuit = null;
}
