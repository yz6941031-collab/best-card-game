// render.js — draws Starforge Duel's state into the DOM.
// The engine (engine.js) owns the truth; this file only reads it. Cards are
// DOM elements (not canvas) so their numbers stay crisp at any size: a big
// cost gem, a suit icon drawn as inline SVG, a headline value, the name and
// the effect line. Suits are told apart by colour and by icon shape, so the
// game stays readable for colour-blind players too. The floating combat
// numbers and the table shake are presentations of engine events — they
// are thrown after the state has already changed, never instead of it.

import { SUITS } from './cards.js';
import { MAX_HP } from './engine.js';
import { describeIntent } from './ai.js';

const $ = (id) => document.getElementById(id);

/** Inline SVG per suit: flame, shard, bolt, leaf — shapes, never letters. */
export const SUIT_ICONS = {
  ember: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.8c.9 3.9-2.9 5.2-2.9 8.1a2.9 2.9 0 0 0 5.8 0c0-.9-.4-1.7-.4-1.7s2.9 1.6 2.9 4.8a5.4 5.4 0 0 1-10.8 0C6.6 6.9 10.9 5.7 12 1.8z"/></svg>',
  frost: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.5 19.5 9 12 22.5 4.5 9Z"/><path d="M4.5 9h15M12 1.5 8.8 9 12 22.5 15.2 9 12 1.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.1"/></svg>',
  storm: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 1.5 4.5 13.8h5.7L8.2 22.5l9.5-13h-5.9L13 1.5z"/></svg>',
  grove: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.5 3.5C11 3.5 4 10 3.8 20.2 14 20 20.5 13 20.5 3.5Z"/><path d="M4.2 19.8C7.6 13.4 13 8 19.8 4.2" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/></svg>',
};

const VALUE_LABELS = { damage: 'DAMAGE', shield: 'SHIELD', heal: 'HEAL', energy: 'ENERGY' };

function valueMarkup(card) {
  if (card.kind === 'energy') return { big: `+${card.amount}`, label: 'ENERGY' };
  const hits = card.hits && card.hits > 1 ? `<small>×${card.hits}</small>` : '';
  return { big: `${card.amount}${hits}`, label: VALUE_LABELS[card.kind] };
}

/**
 * Build one card element. Options: { playable, resonanceArmed, dealtIndex }
 * — dealtIndex, when set, staggers the deal-in animation.
 */
export function cardElement(card, options = {}) {
  const el = document.createElement('div');
  el.className = `card suit-${card.suit}`;
  el.dataset.uid = String(card.uid);
  const { big, label } = valueMarkup(card);
  let html = `<div class="cost${card.cost === 0 ? ' free' : ''}">${card.cost}</div>`;
  if (options.resonanceArmed) html += '<div class="resonance-badge">+2</div>';
  html += `<div class="suit-icon" style="color:${SUITS[card.suit].deep}">${SUIT_ICONS[card.suit]}</div>`;
  html += `<div class="value">${big}</div><div class="value-label">${label}</div>`;
  html += `<div class="card-name">${card.name}</div><div class="card-text">${card.text}</div>`;
  el.innerHTML = html;
  if (options.playable === false) el.classList.add('unplayable');
  if (options.dealtIndex !== undefined && options.dealtIndex !== null) {
    el.classList.add('dealt');
    el.style.setProperty('--deal-delay', `${options.dealtIndex * 0.07}s`);
  }
  return el;
}

/** A face-down card for the Warden's hand. */
export function cardBackElement(tiltDeg) {
  const el = document.createElement('div');
  el.className = 'card back';
  el.style.setProperty('--tilt', `${tiltDeg}deg`);
  el.innerHTML = '<svg class="back-star" viewBox="0 0 48 48"><path d="M24 5l4.8 13.2L43 23l-14.2 4.8L24 41l-4.8-13.2L5 23l14.2-4.8Z" fill="#c99aff" opacity="0.85"/></svg>';
  return el;
}

function fanTilt(index, count) {
  if (count <= 1) return 0;
  return (index - (count - 1) / 2) * 2.4;
}

function renderDuelist(state, who) {
  const d = who === 'player' ? state.player : state.warden;
  const fill = $(`${who}-hp-fill`);
  const pct = Math.max(0, (d.hp / MAX_HP) * 100);
  fill.style.width = `${pct}%`;
  fill.className = `hp-fill${pct <= 30 ? ' low' : pct <= 60 ? ' mid' : ''}`;
  $(`${who}-hp-text`).textContent = `${d.hp} / ${MAX_HP} HP`;
  const shield = $(`${who}-shield`);
  shield.textContent = `SHIELD ${d.shield}`;
  shield.classList.toggle('on', d.shield > 0);
  const pips = $(`${who}-energy`);
  pips.innerHTML = '';
  for (let i = 0; i < d.charge; i += 1) {
    const pip = document.createElement('span');
    pip.className = `pip${i < d.energy ? ' full' : ''}`;
    pips.appendChild(pip);
  }
  $(`${who}-piles`).textContent = `Deck ${d.deck.length} · Discard ${d.discard.length} · Hand ${d.hand.length}`;
}

/**
 * Draw the whole table. `ui` carries presentation-only facts:
 * { dealtRound } — when it equals state.round, hand cards animate in.
 */
export function render(state, ui = {}) {
  renderDuelist(state, 'player');
  renderDuelist(state, 'warden');

  const wardenHand = $('warden-hand');
  wardenHand.innerHTML = '';
  state.warden.hand.forEach((card, i) => {
    wardenHand.appendChild(cardBackElement(fanTilt(i, state.warden.hand.length)));
  });

  const hand = $('player-hand');
  hand.innerHTML = '';
  const myTurn = state.phase === 'player';
  state.player.hand.forEach((card, i) => {
    const playable = myTurn && state.player.energy >= card.cost;
    const resonanceArmed = myTurn && state.player.lastSuit === card.suit
      && (card.kind === 'damage' || card.kind === 'shield' || card.kind === 'heal');
    const el = cardElement(card, {
      playable,
      resonanceArmed,
      dealtIndex: ui.dealtRound === state.round ? i : null,
    });
    el.style.setProperty('--tilt', `${fanTilt(i, state.player.hand.length)}deg`);
    el.style.setProperty('--lift', `${Math.abs(fanTilt(i, state.player.hand.length)) * 1.6}px`);
    hand.appendChild(el);
  });

  const banner = $('intent-banner');
  if (state.phase === 'player' && state.intent) {
    banner.innerHTML = `<span><b>WARDEN'S INTENT</b><br>${describeIntent(state.intent)}</span>`;
    banner.style.visibility = 'visible';
  } else if (state.phase === 'warden') {
    banner.innerHTML = '<span><b>THE WARDEN ACTS</b><br>Its declared plan unfolds…</span>';
    banner.style.visibility = 'visible';
  } else {
    banner.style.visibility = 'hidden';
  }

  const tag = $('resonance-tag');
  if (state.phase === 'player' && state.player.lastSuit) {
    tag.textContent = `RESONANCE ARMED — ${SUITS[state.player.lastSuit].name} +2`;
  } else {
    tag.textContent = '';
  }

  const log = $('battle-log');
  log.innerHTML = state.log.slice(-2).map((line) => `<div class="log-line">${line}</div>`).join('');

  $('end-turn').disabled = state.phase !== 'player';
}

/** Show a just-played card at the centre of the table. */
export function showPlayedCard(card) {
  const slot = $('last-played');
  slot.innerHTML = '';
  if (card) slot.appendChild(cardElement(card));
}

/** A floating combat number over a duelist's zone. */
export function floatText(who, kind, text) {
  const zone = $(who === 'player' ? 'player-zone' : 'warden-zone');
  const stage = $('stage');
  const zr = zone.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `floater ${kind}`;
  el.textContent = text;
  el.style.left = `${zr.left - sr.left + zr.width * (0.32 + Math.random() * 0.3)}px`;
  el.style.top = `${zr.top - sr.top + (who === 'player' ? -6 : 26)}px`;
  $('floaters').appendChild(el);
  setTimeout(() => el.remove(), 1250);
}

/** Shake the table on a heavy hit. */
export function shakeTable() {
  const stage = $('stage');
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}

/** Fill and reveal the end screen from a finished state. */
export function renderEnd(state) {
  const victory = state.winner === 'player';
  const title = $('end-title');
  title.textContent = victory ? 'VICTORY' : 'DEFEAT';
  title.className = victory ? 'victory' : 'defeat';
  $('end-flavor').textContent = victory
    ? 'The Warden\'s crest cracks. The Starforge is yours, and the sky-anvil rings your name.'
    : 'Your crest shatters on the anvil stone. The Warden banks the forge-fire and waits for the next challenger.';
  const stats = [
    [state.stats.rounds, 'ROUNDS'],
    [state.stats.damageDealt, 'DAMAGE DEALT'],
    [state.stats.cardsPlayed, 'CARDS PLAYED'],
    [state.stats.damageTaken, 'DAMAGE TAKEN'],
  ];
  $('end-stats').innerHTML = stats
    .map(([value, label]) => `<div class="stat-box"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`)
    .join('');
  $('end-screen').classList.remove('hidden');
}

export function hideEnd() {
  $('end-screen').classList.add('hidden');
}
