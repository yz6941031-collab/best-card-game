// main.js — Starforge Duel's controller: owns the one game state, moves it
// between screens, and choreographs the Warden's turn with timed steps so
// its cards land one by one. The rules live in engine.js, the Warden's
// plans in ai.js, the drawing in render.js, the gestures in input.js.

import { createGame, startRound, playCard, endPlayerTurn } from './engine.js';
import { planWardenTurn, executeWardenPlan } from './ai.js';
import { render, showPlayedCard, floatText, shakeTable, renderEnd, hideEnd, renderTitleFan } from './render.js';
import { attachInput } from './input.js';
import {
  unlockAudio, soundPlayCard, soundDamage, soundShield, soundHeal, soundDraw, soundVictory, soundDefeat,
} from './audio.js';
import { randomSeed } from './random.js';
import { stageShot } from './shots.js';

const WARDEN_STEP_MS = 640;

let state = null;
let plan = null;
let busy = false;
const ui = { dealtRound: 0 };

function presentEvents(who, events) {
  for (const event of events) {
    if (event.type === 'damage') {
      if (event.dealt > 0) floatText(event.who, 'damage', `-${event.dealt}`);
      if (event.blocked > 0) floatText(event.who, 'shield', `${event.blocked} BLOCKED`);
      if (event.dealt >= 8) shakeTable();
      soundDamage(event.dealt >= 8);
    } else if (event.type === 'shield') {
      floatText(event.who, 'shield', `+${event.amount} SHIELD`);
      soundShield();
    } else if (event.type === 'heal') {
      floatText(event.who, 'heal', `+${event.amount}`);
      soundHeal();
    } else if (event.type === 'energy') {
      floatText(event.who, 'energy', `+${event.amount} ENERGY`);
    } else if (event.type === 'resonance') {
      floatText(who, 'resonance', 'RESONANCE +2');
    } else if (event.type === 'draw') {
      soundDraw();
    }
  }
}

function beginRound() {
  startRound(state);
  plan = planWardenTurn(state);
  state.intent = plan.intent;
  ui.dealtRound = state.round;
  render(state, ui);
}

function finishIfOver() {
  if (state.phase !== 'over') return false;
  busy = true;
  render(state, ui);
  setTimeout(() => {
    renderEnd(state);
    if (state.winner === 'player') soundVictory();
    else soundDefeat();
  }, 950);
  return true;
}

function playPlayerCard(uid) {
  if (busy || !state || state.phase !== 'player') return;
  const card = state.player.hand.find((c) => c.uid === uid);
  if (!card) return;
  const events = playCard(state, 'player', uid);
  if (!events) return;
  soundPlayCard();
  showPlayedCard(card);
  presentEvents('player', events);
  render(state, ui);
  finishIfOver();
}

function runWardenTurnAnimated() {
  busy = true;
  const steps = plan ? plan.plays.slice() : [];
  let index = 0;
  const step = () => {
    if (state.phase === 'over') {
      finishIfOver();
      return;
    }
    if (index >= steps.length) {
      busy = false;
      beginRound();
      return;
    }
    const uid = steps[index];
    index += 1;
    const card = state.warden.hand.find((c) => c.uid === uid);
    const events = playCard(state, 'warden', uid);
    if (events && card) {
      soundPlayCard();
      showPlayedCard(card);
      presentEvents('warden', events);
    }
    render(state, ui);
    if (state.phase === 'over') {
      finishIfOver();
      return;
    }
    setTimeout(step, WARDEN_STEP_MS);
  };
  setTimeout(step, 420);
}

function onEndTurn() {
  if (busy || !state || state.phase !== 'player') return;
  endPlayerTurn(state);
  render(state, ui);
  runWardenTurnAnimated();
}

function startDuel(seed) {
  state = createGame(seed);
  plan = null;
  busy = false;
  hideEnd();
  document.getElementById('title-screen').classList.add('hidden');
  showPlayedCard(null);
  beginRound();
}

/** The controller surface shots.js stages its scenes through. */
const controller = {
  getState: () => state,
  startDuel,
  beginRound,
  playPlayerCard,
  /** Play the Warden's whole plan at once (screenshot scenes, tests). */
  runWardenInstant() {
    endPlayerTurn(state);
    executeWardenPlan(state, plan);
    render(state, ui);
    if (state.phase === 'over') {
      renderEnd(state);
      return;
    }
    beginRound();
  },
  showEndNow() {
    renderEnd(state);
  },
  /** Re-commit the Warden to a fresh plan for the current round. */
  replan() {
    plan = planWardenTurn(state);
    state.intent = plan.intent;
    render(state, ui);
  },
  renderNow() {
    render(state, ui);
  },
};

attachInput({
  onCardClicked: (uid) => {
    unlockAudio();
    playPlayerCard(uid);
  },
  onEndTurn: () => {
    unlockAudio();
    onEndTurn();
  },
  onStart: () => {
    unlockAudio();
    startDuel(randomSeed());
  },
  onEnter: () => {
    unlockAudio();
    if (!document.getElementById('title-screen').classList.contains('hidden')) startDuel(randomSeed());
    else if (state && state.phase === 'over') startDuel(randomSeed());
    else onEndTurn();
  },
  onSlotKey: (slot) => {
    unlockAudio();
    if (!state || state.phase !== 'player') return;
    const card = state.player.hand[slot];
    if (card) playPlayerCard(card.uid);
  },
});

// Boot: a ?shot= scene stages itself; otherwise a fresh duel waits behind
// the title screen.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
renderTitleFan();
if (shotName) {
  document.getElementById('title-screen').classList.add('hidden');
  stageShot(shotName, controller, Number(params.get('seed') ?? 1));
} else {
  state = createGame(randomSeed());
  beginRound();
  document.getElementById('title-screen').classList.remove('hidden');
}
