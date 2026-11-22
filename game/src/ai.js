// ai.js — the Warden, Starforge Duel's built-in opponent.
// At the start of each round the Warden commits to a plan: a fixed list of
// cards it will play when its turn comes. The plan is summarised as an
// INTENT (total attack / shield / healing) and shown to the player for the
// whole round, so the player can read it and counter it — shield up before
// a heavy attack lands, or race a healing Warden down. The plan never
// changes mid-round, whatever the player does.
//
// The policy is greedy and readable, in this order:
//   1. finish the player off when a play is lethal through their shield;
//   2. heal when badly hurt (projected health at 9 or less);
//   3. strike with the best damage-per-energy card it can afford;
//   4. burn free tempo cards (energy), unless Overcharge would endanger it;
//   5. raise shield; 6. heal any remaining damage; 7. stop.
// The projection tracks the player's shield as it stood when the plan was
// made, so the intent banner's attack number is the raw strike total —
// shield the player raises afterwards still soaks it, as the banner's
// fine print in the how-to-play puts it: read it, then counter it.

import { MAX_HP, RESONANCE_BONUS, playCard } from './engine.js';

function projectedDamage(card, lastSuit) {
  const resonant = lastSuit === card.suit;
  const perHit = card.amount + (resonant ? RESONANCE_BONUS : 0);
  return { total: perHit + card.amount * ((card.hits ?? 1) - 1), firstHit: perHit };
}

/** Simulate one planned play on the projection; returns the intent deltas. */
function simulatePlay(sim, card) {
  const delta = { attack: 0, shield: 0, heal: 0 };
  sim.energy -= card.cost;
  sim.hand.splice(sim.hand.indexOf(card), 1);
  const resonant = sim.lastSuit === card.suit
    && (card.kind === 'damage' || card.kind === 'shield' || card.kind === 'heal');
  const bonus = resonant ? RESONANCE_BONUS : 0;
  sim.lastSuit = card.suit;

  if (card.kind === 'damage') {
    const { total } = projectedDamage(card, resonant ? card.suit : null);
    const amount = card.amount * (card.hits ?? 1) + bonus;
    delta.attack = amount;
    const blocked = Math.min(sim.foeShield, total);
    sim.foeShield -= blocked;
    sim.foeHp = Math.max(0, sim.foeHp - (total - blocked));
  } else if (card.kind === 'shield') {
    delta.shield = card.amount + bonus;
    sim.shield += delta.shield;
  } else if (card.kind === 'heal') {
    delta.heal = Math.min(MAX_HP - sim.hp, card.amount + bonus);
    sim.hp += delta.heal;
    if (card.shieldAlso) {
      delta.shield += card.shieldAlso;
      sim.shield += card.shieldAlso;
    }
  } else if (card.kind === 'energy') {
    sim.energy += card.amount;
    if (card.selfHarm) sim.hp = Math.max(0, sim.hp - card.selfHarm);
  }
  return delta;
}

function affordable(sim) {
  return sim.hand.filter((card) => card.cost <= sim.energy);
}

function pickLethal(sim) {
  for (const card of affordable(sim)) {
    if (card.kind !== 'damage') continue;
    const { total } = projectedDamage(card, sim.lastSuit === card.suit ? card.suit : null);
    if (total - Math.min(sim.foeShield, total) >= sim.foeHp) return card;
  }
  return null;
}

function pickBest(sim, predicate, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const card of affordable(sim)) {
    if (!predicate(card)) continue;
    const value = score(card);
    if (value > bestScore) {
      bestScore = value;
      best = card;
    }
  }
  return best;
}

function pickNext(sim) {
  const lethal = pickLethal(sim);
  if (lethal) return lethal;
  if (sim.hp <= 9) {
    const heal = pickBest(sim, (c) => c.kind === 'heal', (c) => c.amount);
    if (heal) return heal;
  }
  const strike = pickBest(sim, (c) => c.kind === 'damage', (c) => (c.amount * (c.hits ?? 1)) / Math.max(1, c.cost));
  if (strike) return strike;
  const tempo = pickBest(sim, (c) => c.kind === 'energy' && !(c.selfHarm && sim.hp <= 8), (c) => c.amount);
  if (tempo) return tempo;
  const guard = pickBest(sim, (c) => c.kind === 'shield', (c) => c.amount);
  if (guard) return guard;
  if (sim.hp < MAX_HP) {
    const heal = pickBest(sim, (c) => c.kind === 'heal', (c) => c.amount);
    if (heal) return heal;
  }
  return null;
}

/**
 * Commit the Warden to a plan for this round. Pure projection: the real
 * state is only read, never changed. Returns { plays: [uid], intent }.
 */
export function planWardenTurn(state) {
  const sim = {
    energy: state.warden.energy,
    hp: state.warden.hp,
    shield: state.warden.shield,
    foeHp: state.player.hp,
    foeShield: state.player.shield,
    hand: state.warden.hand.slice(),
    lastSuit: null,
  };
  const plays = [];
  const intent = { attack: 0, shield: 0, heal: 0, cards: 0 };
  for (let guard = 0; guard < 12; guard += 1) {
    const card = pickNext(sim);
    if (!card) break;
    const delta = simulatePlay(sim, card);
    intent.attack += delta.attack;
    intent.shield += delta.shield;
    intent.heal += delta.heal;
    intent.cards += 1;
    plays.push(card.uid);
  }
  return { plays, intent };
}

/**
 * Play a committed plan out on the real state, one card at a time, calling
 * onEvent(card, events) after each. Stops early when the duel ends.
 * Returns every event, flattened.
 */
export function executeWardenPlan(state, plan, onEvent) {
  const all = [];
  for (const uid of plan.plays) {
    if (state.phase !== 'warden') break;
    const card = state.warden.hand.find((c) => c.uid === uid);
    const events = playCard(state, 'warden', uid);
    if (!events) break;
    all.push(...events);
    if (onEvent) onEvent(card, events);
    if (state.phase === 'over') break;
  }
  return all;
}

/** A one-line reading of an intent, for the banner and the log. */
export function describeIntent(intent) {
  if (!intent || intent.cards === 0) return 'The Warden watches and waits.';
  const parts = [];
  if (intent.attack) parts.push(`strikes for ${intent.attack}`);
  if (intent.shield) parts.push(`raises ${intent.shield} shield`);
  if (intent.heal) parts.push(`mends ${intent.heal}`);
  return `The Warden intends: ${parts.join(', ')}.`;
}
