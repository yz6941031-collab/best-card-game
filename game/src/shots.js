// shots.js — the screenshot scenes behind ?shot=title|table|victory|defeat.
// Each scene drives the real game through the controller main.js exposes:
// real engine, real renderer, real cards. Nothing is composited — a scene
// simply plays a short, seeded game forward to the moment worth showing,
// the same way a player's first minutes would reach it.

import { applyDamage, drawCards } from './engine.js';
import { showPlayedCard } from './render.js';

/** Find a playable damage card in the player's hand, drawing until one shows. */
function drawUntilDamage(state, who) {
  const d = who === 'player' ? state.player : state.warden;
  let guard = 0;
  while (!d.hand.some((card) => card.kind === 'damage' && card.cost <= d.energy) && guard < 16) {
    if (d.hand.length >= 8) {
      // A full hand blocks drawing: shed the first non-damage card.
      const shed = d.hand.findIndex((card) => card.kind !== 'damage');
      if (shed < 0) break;
      d.discard.push(...d.hand.splice(shed, 1));
    }
    if (drawCards(state, who, 1) === 0) break;
    guard += 1;
  }
  return d.hand.find((card) => card.kind === 'damage' && card.cost <= d.energy) ?? null;
}

/**
 * Reduce `who` to exactly `hpLeft` health with no shield, however much
 * shield they had raised: staged damage that burns through the shield
 * first, so a finisher of any size lands the kill.
 */
function bringToBrink(state, who, hpLeft) {
  const side = who === 'player' ? state.player : state.warden;
  const needed = side.shield + side.hp - hpLeft;
  if (needed > 0) applyDamage(state, who, needed);
}

/** Play up to `count` sensible cards: shield first, then the biggest hit. */
function playScriptedCards(ctrl, state, count) {
  for (let n = 0; n < count; n += 1) {
    if (state.phase !== 'player') return;
    const hand = state.player.hand;
    const shield = hand.find((card) => card.kind === 'shield' && card.cost <= state.player.energy);
    const hits = hand
      .filter((card) => card.kind === 'damage' && card.cost <= state.player.energy)
      .sort((a, b) => b.amount * (b.hits ?? 1) - a.amount * (a.hits ?? 1));
    const pick = n === 0 ? (shield ?? hits[0]) : (hits[0] ?? shield);
    if (!pick) return;
    ctrl.playPlayerCard(pick.uid);
  }
}

/**
 * Play a whole player turn the way a decent player would: lethal first,
 * then the biggest affordable hit, shield when bare, heal when hurt,
 * tempo when free. Used to earn the end screens' statistics honestly.
 */
function autoPlayerTurn(ctrl, state, { aggressive = true } = {}) {
  for (let guard = 0; guard < 14 && state.phase === 'player'; guard += 1) {
    const me = state.player;
    const hand = me.hand.filter((card) => card.cost <= me.energy);
    if (!hand.length) return;
    const damage = hand
      .filter((card) => card.kind === 'damage')
      .sort((a, b) => b.amount * (b.hits ?? 1) - a.amount * (a.hits ?? 1));
    const pick = (aggressive && damage[0])
      || (me.shield < 4 && hand.find((card) => card.kind === 'shield'))
      || (me.hp <= 18 && hand.find((card) => card.kind === 'heal'))
      || hand.find((card) => card.kind === 'energy')
      || hand.find((card) => card.kind === 'shield')
      || hand.find((card) => card.kind === 'heal')
      || hand[0];
    if (!pick) return;
    ctrl.playPlayerCard(pick.uid);
  }
}

function stageTitle(ctrl, seed) {
  ctrl.startDuel(seed);
  document.getElementById('title-screen').classList.remove('hidden');
}

function stageTable(ctrl, seed) {
  ctrl.startDuel(seed);
  const state = ctrl.getState();
  playScriptedCards(ctrl, state, 2); // round 1: a shield, a strike
  ctrl.runWardenInstant(); // the Warden answers; round 2 begins
  playScriptedCards(ctrl, state, 3); // round 2: press the attack, keep a hand
  ctrl.runWardenInstant(); // the Warden answers again; round 3 begins
  playScriptedCards(ctrl, state, 1); // one more strike, centre of the table
  ctrl.renderNow();
}

function stageVictory(ctrl, seed) {
  ctrl.startDuel(seed);
  const state = ctrl.getState();
  // Earn it: several real rounds of trading blows before the finish.
  for (let round = 0; round < 6 && state.phase !== 'over' && state.warden.hp > 10; round += 1) {
    autoPlayerTurn(ctrl, state);
    if (state.phase === 'over') break;
    ctrl.runWardenInstant();
  }
  if (state.phase === 'over') { // won outright during the auto-play
    ctrl.showEndNow();
    return;
  }
  bringToBrink(state, 'warden', 3); // burn the shield away, leave 3 health
  drawUntilDamage(state, 'player');
  // The strongest affordable damage card in hand is the killing blow —
  // every damage card in the game deals at least 3, so any of them ends it.
  const finisher = state.player.hand
    .filter((card) => card.kind === 'damage' && card.cost <= state.player.energy)
    .sort((a, b) => b.amount * (b.hits ?? 1) - a.amount * (a.hits ?? 1))[0];
  ctrl.renderNow();
  if (finisher) ctrl.playPlayerCard(finisher.uid);
  if (state.phase === 'over') ctrl.showEndNow();
}

function stageDefeat(ctrl, seed) {
  ctrl.startDuel(seed);
  const state = ctrl.getState();
  // The challenger turtles — shield and healing only — and is ground down
  // over several real rounds before the end.
  for (let round = 0; round < 5 && state.phase !== 'over' && state.player.hp > 9; round += 1) {
    autoPlayerTurn(ctrl, state, { aggressive: false });
    if (state.phase === 'over') break;
    ctrl.runWardenInstant();
  }
  if (state.phase === 'over') { // ground down during the auto-play already
    ctrl.showEndNow();
    return;
  }
  bringToBrink(state, 'player', 3); // no shield left to hide behind
  drawUntilDamage(state, 'warden'); // make sure the Warden holds a finisher
  ctrl.replan(); // and commits to using it
  ctrl.renderNow();
  ctrl.runWardenInstant(); // the plan unfolds and ends the duel
  if (state.phase === 'over') ctrl.showEndNow();
}

/** Stage the named scene ('title' when the name is anything else). */
export function stageShot(name, ctrl, seed) {
  showPlayedCard(null);
  if (name === 'table') stageTable(ctrl, seed);
  else if (name === 'victory') stageVictory(ctrl, seed);
  else if (name === 'defeat') stageDefeat(ctrl, seed);
  else stageTitle(ctrl, seed);
}
