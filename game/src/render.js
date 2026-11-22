// render.js — draws Starforge Duel's state into the DOM.
// The engine (engine.js) owns the truth; this file only reads it. Cards are
// DOM elements (not canvas) so their numbers stay crisp at any size: a big
// cost gem, a suit icon drawn as inline SVG, a headline value, the name and
// the effect line. Suits are told apart by colour and by icon shape, so the
// game stays readable for colour-blind players too. The floating combat
// numbers and the table shake are presentations of engine events — they
// are thrown after the state has already changed, never instead of it.

import { SUITS, cardById } from './cards.js';
import { MAX_HP } from './engine.js';
import { describeIntent } from './ai.js';

const $ = (id) => document.getElementById(id);

/**
 * Etched art per suit, drawn large in each card's art window (v3,
 * reference-led): copperplate line work in pale gold and suit-tinted ink
 * on deep navy — a flame spirit, a crystal wyrm, a lightning serpent, an
 * antlered stag. Shapes and scenes, never letters — the suits stay told
 * apart even for colour-blind players.
 */
export const CARD_ART = {
  ember: '<svg viewBox="0 0 64 72" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M32 3c2.5 8 10.5 12 10.5 22.5a10.5 11 0 1 1-21 0C21.5 15 29.5 11 32 3Z" fill="#2a1408" stroke="#e8b07a" stroke-width="1.8"/><path d="M32 20c1.4 4.4 5.4 6.4 5.4 11.4a5.4 5.6 0 1 1-10.8 0c0-5 4-7 5.4-11.4Z" fill="#3d1c0a" stroke="#f2cd8f" stroke-width="1.4"/><path d="M28.6 30.5h.1M35.3 30.5h.1" stroke="#ffe9b0" stroke-width="2.6"/><path d="M30.4 35.5c1 1 2.2 1 3.2 0" stroke="#f2cd8f" stroke-width="1.2"/><path d="M21.5 40c-5 1-8.5-2-8-6 .4-3.2 4-4.8 6.2-3.2M42.5 40c5 1 8.5-2 8-6-.4-3.2-4-4.8-6.2-3.2" stroke="#e8b07a" stroke-width="1.5"/><path d="M17 63l28-7M19 56l26 8" stroke="#8a5f30" stroke-width="1.7"/><path d="M12 8l1.6 3.4L17 13l-3.4 1.6L12 18l-1.6-3.4L7 13l3.4-1.6Z" fill="#f2cd8f"/><path d="M53 20l1.2 2.6 2.6 1.2-2.6 1.2L53 27.6l-1.2-2.6-2.6-1.2 2.6-1.2Z" fill="#f2cd8f"/><path d="M15 69h34" stroke="#7a5226" stroke-width="1.2" stroke-dasharray="3 3"/></svg>',
  frost: '<svg viewBox="0 0 64 72" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 66V38l7 9v19Z" fill="#12283e" stroke="#8fbde6" stroke-width="1.5"/><path d="M55 66V42l-7 7v17Z" fill="#12283e" stroke="#8fbde6" stroke-width="1.5"/><path d="M14 62c16 0 30-9 29-21-.7-10-13-10-14.5-18C27.4 16.6 34 10 42 12l-3 4c-4-1-7 2-6.4 6 .8 6 13 6.6 13.6 16 .8 13-14 24-32 24Z" fill="#1d324e" stroke="#cfe6fb" stroke-width="1.9"/><path d="M23 56l3.5 3M31 51l3.5 3M37.5 43l3.5 2.4M37 33l4 1.2" stroke="#8fbde6" stroke-width="1.2"/><path d="M44.5 9.5 51 4M46.5 13 54 11" stroke="#bcd9f5" stroke-width="1.6"/><circle cx="41.5" cy="13.5" r="1.5" fill="#eaf6ff"/><path d="M39.5 18.5 46 21l-5.5 2" stroke="#bcd9f5" stroke-width="1.3"/><path d="M11 10v7M7.5 13.5h7M53 25v7M49.5 28.5h7" stroke="#dff2ff" stroke-width="1.3"/><path d="M7 68h50" stroke="#5b84a8" stroke-width="1.2" stroke-dasharray="3 3"/></svg>',
  storm: '<svg viewBox="0 0 64 72" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19c-1-6 4-10 8.5-9C16 5.5 22.5 3.5 26.5 7 29.5 3.8 36.5 4 39 8.5c4.5-1.2 9.5 1 11 5 4 .5 7.5 3.5 6.5 7.5" fill="#1b1430" stroke="#c3aef0" stroke-width="1.6"/><path d="M34 23 21.5 39h8.5L19 57l17.5-21.5h-9L38 23Z" fill="#2c1c4e" stroke="#ecd28a" stroke-width="1.6"/><circle cx="23.5" cy="52.5" r="1.4" fill="#fff3cf"/><path d="M18.5 57.5 14 61M18.5 57.5 17.5 62" stroke="#e08a5a" stroke-width="1.2"/><path d="M49 27l-6.5 9.5h4.5L42 45l9.5-11H47l5.5-7Z" fill="#2c1c4e" stroke="#b39ddb" stroke-width="1.3"/><path d="M10 31l-3 6M16.5 33l-3 6M53 35l-3 6M59 31l-3 6" stroke="#8fbde6" stroke-width="1.2"/><path d="M9 68h46" stroke="#6a5a9e" stroke-width="1.2" stroke-dasharray="3 3"/></svg>',
  grove: '<svg viewBox="0 0 64 72" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M26 23C20 17 17 10 18 3M26 23c-5.5-2-9.5-6.5-10.5-12M23.5 16c-3.2 0-6.2-1.6-7.8-4.2M38 23c6-6 9-13 8-20M38 23c5.5-2 9.5-6.5 10.5-12M40.5 16c3.2 0 6.2-1.6 7.8-4.2" stroke="#d9c491" stroke-width="1.7"/><path d="M24 21c0-3.2 3-5.2 8-5.2s8 2 8 5.2c0 6-1 10.4-2.5 14.4-1.2 3.4-3 6.2-5.5 6.2s-4.3-2.8-5.5-6.2C25 31.4 24 27 24 21Z" fill="#14260f" stroke="#cfe3b0" stroke-width="1.6"/><path d="M24.2 25c-4.2-1-7.4-4.2-8.4-8.4 4.2.2 7.4 2.4 9 5.6M39.8 25c4.2-1 7.4-4.2 8.4-8.4-4.2.2-7.4 2.4-9 5.6" fill="#14260f" stroke="#cfe3b0" stroke-width="1.4"/><circle cx="28.5" cy="28" r="1.4" fill="#ffe9b0"/><circle cx="35.5" cy="28" r="1.4" fill="#ffe9b0"/><path d="M29.5 39.5c1.5 1.2 3.5 1.2 5 0M32 35v3.2" stroke="#cfe3b0" stroke-width="1.2"/><path d="M25.5 45l3.2 4.2L32 45l3.3 4.2L38.5 45M24.5 52l4 4 3.5-4.2L35.5 56l4-4" stroke="#a9d69a" stroke-width="1.3"/><path d="M9 45c4-1.2 7.4.8 8.6 4.2C14.2 50.4 10.8 48.8 9 45ZM55 45c-4-1.2-7.4.8-8.6 4.2 3.4 1.2 6.8-.4 8.6-4.2Z" fill="#1d3316" stroke="#a9d69a" stroke-width="1.2"/><path d="M11 68h42" stroke="#5f7f4a" stroke-width="1.2" stroke-dasharray="3 3"/></svg>',
};

/** Small etched icons for the card's bottom corners: kind at left, suit at right. */
const KIND_ICONS = {
  damage: '<svg viewBox="0 0 24 24" fill="none" stroke="#ecd28a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 16.5 7.5M15 4c1.8-.8 4.2-.2 5.4 1.4l-1.2 3.4-3.4 1.2C14.2 8.8 13.8 6.2 15 4Z"/><path d="M7.5 13.5 10.5 16.5M5.5 11.5l5 5M3.5 20.5 6 18"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="#ecd28a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 2.4v5.4c0 4.8-3 8.4-7 10.2-4-1.8-7-5.4-7-10.2V5.4Z"/><path d="M12 6.8v10.4" opacity=".55"/></svg>',
  heal: '<svg viewBox="0 0 24 24" fill="rgba(236,210,138,.22)" stroke="#ecd28a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5S4 15.5 4 9.9C4 7 6 5 8.6 5c1.5 0 2.8.8 3.4 2 .6-1.2 1.9-2 3.4-2C18 5 20 7 20 9.9c0 5.6-8 10.6-8 10.6Z"/></svg>',
  energy: '<svg viewBox="0 0 24 24" fill="none" stroke="#ecd28a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l2.1 6.9 6.9-2.7-4.2 5.3 4.2 5.3-6.9-2.7L12 21.5l-2.1-6.9L3 17.3l4.2-5.3L3 6.7l6.9 2.7Z"/></svg>',
};

const SUIT_ICONS = {
  ember: '<svg viewBox="0 0 24 24" fill="none" stroke="#e8b07a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 4.5-3.5 6-3.5 10a3.5 3.5 0 0 0 7 0c0-1-.5-2-.5-2s3 2 3 5.5A6 6 0 0 1 6 16.5C6 10 11 8 12 3Z"/></svg>',
  frost: '<svg viewBox="0 0 24 24" fill="none" stroke="#8fbde6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l4.5 7L12 22 7.5 9Z"/><path d="M7.5 9h9"/></svg>',
  storm: '<svg viewBox="0 0 24 24" fill="none" stroke="#c3aef0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 5 13.5h5L8.5 22 19 9.5h-5.5Z"/></svg>',
  grove: '<svg viewBox="0 0 24 24" fill="none" stroke="#a9d69a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15"/><path d="M5 19c2-5 5-8.5 9.5-10.5"/></svg>',
};

/** The all-seeing eye stamped on every card back, gold on navy (v3). */
const BACK_EMBLEM = '<svg class="back-emblem" viewBox="0 0 48 48" fill="none" stroke-linecap="round"><circle cx="24" cy="24" r="21.5" stroke="#c9a24b" stroke-width="1.6"/><circle cx="24" cy="24" r="18.5" stroke="#c9a24b" stroke-width=".8" opacity=".6"/><path d="M7 24c5-7.5 11-11 17-11s12 3.5 17 11c-5 7.5-11 11-17 11S12 31.5 7 24Z" stroke="#ecd28a" stroke-width="1.7"/><circle cx="24" cy="24" r="6.4" stroke="#ecd28a" stroke-width="1.6"/><circle cx="24" cy="24" r="2.6" fill="#ecd28a" stroke="none"/><path d="M24 2v3.2M15.2 3.8l1.2 3M32.8 3.8l-1.2 3M8.8 7.8l2 2.6M39.2 7.8l-2 2.6M24 42.8V46M15.2 44.2l1.2-3M32.8 44.2l-1.2-3" stroke="#c9a24b" stroke-width="1.4"/></svg>';

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
  let html = `<div class="cost${card.cost === 0 ? ' free' : ''}"><span>${card.cost}</span></div>`;
  if (options.resonanceArmed) html += '<div class="resonance-badge">+2</div>';
  html += `<div class="art">${CARD_ART[card.suit]}</div>`;
  html += `<div class="value-row"><span class="value">${big}</span><span class="value-label">${label}</span></div>`;
  html += `<div class="card-name">${card.name}</div><div class="card-text">${card.text}</div>`;
  html += `<div class="corner corner-l" title="${label}">${KIND_ICONS[card.kind]}</div>`;
  html += `<div class="corner corner-r">${SUIT_ICONS[card.suit]}</div>`;
  html += `<div class="suit-name">${SUITS[card.suit].name.toUpperCase()}</div>`;
  el.innerHTML = html;
  if (options.playable) el.classList.add('playable');
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
  el.innerHTML = BACK_EMBLEM;
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
  const bar = fill.parentElement;
  const prevHp = fill.dataset.prev === undefined ? null : Number(fill.dataset.prev);
  if (prevHp !== null && d.hp < prevHp) {
    bar.classList.remove('hit');
    void bar.offsetWidth;
    bar.classList.add('hit');
  }
  fill.dataset.prev = String(d.hp);
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

/** Refresh one duelist's deck stack and discard pile at the arena's edge. */
function renderPiles(state, who) {
  const d = who === 'player' ? state.player : state.warden;
  $(`${who}-deck-count`).textContent = String(d.deck.length);
  $(`${who}-discard-count`).textContent = String(d.discard.length);
  const top = $(`${who}-discard-pile`);
  const topCard = d.discard[d.discard.length - 1];
  if (topCard) {
    const suit = SUITS[topCard.suit];
    top.className = `pile-stack discard-stack has-card suit-${topCard.suit}`;
    top.style.borderColor = suit.color;
    top.style.background = `linear-gradient(165deg, ${suit.deep}33, rgba(14,10,28,.85))`;
    top.innerHTML = `<span class="mini-value" style="color:${suit.color}">${topCard.amount}</span><span class="mini-label">${topCard.name.toUpperCase()}</span>`;
  } else {
    top.className = 'pile-stack discard-stack';
    top.style.borderColor = '';
    top.style.background = '';
    top.innerHTML = '';
  }
}

/**
 * Draw the whole table. `ui` carries presentation-only facts:
 * { dealtRound } — when it equals state.round, hand cards animate in.
 */
export function render(state, ui = {}) {
  renderDuelist(state, 'player');
  renderDuelist(state, 'warden');
  renderPiles(state, 'player');
  renderPiles(state, 'warden');
  $('round-banner').textContent = `ROUND ${state.round}`;

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

/** Winged crown over a shield for a win (v3, etched gold on navy). */
const VICTORY_EMBLEM = `<svg viewBox="0 0 200 120" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="#c9a24b" stroke-width="1" opacity=".45"><path d="M100 52 38 8M100 52 68 2M100 52 100 0M100 52 132 2M100 52 162 8"/></g>
  <g transform="translate(100 66) scale(.9) translate(-100 -66)"><path d="M98 66C76 44 46 34 16 40c10 6 16 10 22 16C24 54 12 60 4 70c12 2 20 5 28 10-8 0-14 3-20 8 16 4 30 3 44-2 16-5.5 30-12 42-20Z" fill="rgba(202,161,79,.3)" stroke="#ecd28a" stroke-width="1.8"/>
  <path d="M102 66c22-22 52-32 82-26-10 6-16 10-22 16 14-2 26 4 34 14-12 2-20 5-28 10 8 0 14 3 20 8-16 4-30 3-44-2-16-5.5-30-12-42-20Z" fill="rgba(202,161,79,.3)" stroke="#ecd28a" stroke-width="1.8"/>
  <path d="M84 62C64 50 44 44 26 46M80 73C60 65 40 63 22 67M116 62c20-12 40-18 58-16M120 73c20-8 40-10 58-6" stroke="#c9a24b" stroke-width="1.1" opacity=".8"/></g>
  <path d="M78 32l4.5 11 8-14 6 12 3.5-9 3.5 9 6-12 8 14 4.5-11-2.5 21h-39Z" fill="rgba(202,161,79,.45)" stroke="#ecd28a" stroke-width="1.8"/>
  <path d="M79.5 56.5h41" stroke="#ecd28a" stroke-width="2"/>
  <circle cx="88" cy="47" r="1.9" fill="#ecd28a"/><circle cx="100" cy="42" r="2.2" fill="#ecd28a"/><circle cx="112" cy="47" r="1.9" fill="#ecd28a"/>
  <circle cx="100" cy="80" r="19" fill="#16233c" stroke="#ecd28a" stroke-width="2"/>
  <circle cx="100" cy="80" r="13.5" stroke="#c9a24b" stroke-width="1" opacity=".7"/>
  <circle cx="100" cy="80" r="4.5" fill="#ecd28a"/>
  <path d="M83 92c4 6 10 9 17 9.5M117 92c-4 6-10 9-17 9.5" stroke="#c9a24b" stroke-width="1.6"/>
  <path d="M30 20l1.8 4.2L36 26l-4.2 1.8L30 32l-1.8-4.2L24 26l4.2-1.8ZM170 18l1.6 3.8 3.8 1.6-3.8 1.6L170 28.8l-1.6-3.8-3.8-1.6 3.8-1.6ZM52 98l1.4 3.2 3.2 1.4-3.2 1.4L52 107.2l-1.4-3.2-3.2-1.4 3.2-1.4ZM150 100l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4Z" fill="#ecd28a"/>
</svg>`;

/** The still life of a loss: broken shield, snuffed candle, toppled hourglass (v3). */
const DEFEAT_EMBLEM = `<svg viewBox="0 0 200 120" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M52 55c-4.5-4.5 3-7.5 0-12-2.2-3.2-6.5-2.2-6.5-6.5" stroke="#8b93a5" stroke-width="1.5"/>
  <path d="M47 91V65c0-3 2-4.5 5-4.5s5 1.5 5 4.5v26" fill="#2a3247" stroke="#9aa3b5" stroke-width="1.6"/>
  <path d="M47 71c2 3.2 1 6 0 8.5M57 75c-1.5 3-1 5.5 0 8" stroke="#9aa3b5" stroke-width="1.2"/>
  <path d="M52 60.5V56" stroke="#c9a24b" stroke-width="1.6"/><circle cx="52" cy="58" r="1.3" fill="#e08a5a"/>
  <path d="M33 97h38M39.5 97c0-4 3-6.5 6.5-6.5h12c3.5 0 6.5 2.5 6.5 6.5" stroke="#9aa3b5" stroke-width="1.6"/>
  <path d="M104 33 82 41v26c0 16.5 8.5 27 22 35Z" fill="#232c40" stroke="#a8b0c2" stroke-width="1.8"/>
  <path d="M109 35l20 7v25c0 15.5-7.5 25-20.5 33Z" fill="#1d2536" stroke="#8b93a5" stroke-width="1.8" transform="rotate(4 109 62)"/>
  <path d="M105.5 35l-4 14.5 6.5 10-5.5 12.5 3.5 13" stroke="#05070c" stroke-width="2.6"/>
  <path d="M102 55l2 4.4 4.8.6-3.5 3.3 1 4.7-4.3-2.4-4.3 2.4 1-4.7-3.5-3.3 4.8-.6Z" fill="#a8b0c2" opacity=".32"/>
  <g transform="rotate(68 158 80)" stroke="#9aa3b5" stroke-width="1.6" fill="#232c40"><path d="M146 60h24M146 100h24M149 60c0 10 6 12.5 6 20s-6 10-6 20M167 60c0 10-6 12.5-6 20s6 10 6 20"/></g>
  <path d="M138 109h34" stroke="#c9a24b" stroke-width="1.4" stroke-dasharray="2 3.5"/>
  <path d="M20 105c4.5-1.2 7.5 1 8.8 4.4-3.6 1.2-7-.4-8.8-4.4Z" stroke="#7d7460" stroke-width="1.3"/>
  <path d="M178 106c-4.5-1.2-7.5 1-8.8 4.4 3.6 1.2 7-.4 8.8-4.4Z" stroke="#7d7460" stroke-width="1.3"/>
</svg>`;

/** Fan five real cards across the title screen, one per suit and a finisher. */
export function renderTitleFan() {
  const fan = $('title-fan');
  if (!fan || fan.childElementCount > 0) return;
  const picks = ['twin-fangs', 'glacier-wall', 'comet-fall', 'chain-lightning', 'liferoot'];
  let uid = 9000;
  for (const id of picks) {
    const def = cardById(id);
    if (!def) continue;
    uid += 1;
    fan.appendChild(cardElement({ ...def, uid }));
  }
}

/** Fill and reveal the end screen from a finished state. */
export function renderEnd(state) {
  const victory = state.winner === 'player';
  // The ornate frame answers the ending: laurel for a win, thorns for a loss.
  $('stage').dataset.end = victory ? 'victory' : 'defeat';
  const screen = $('end-screen');
  screen.classList.toggle('victory', victory);
  screen.classList.toggle('defeat', !victory);
  $('end-emblem').innerHTML = victory ? VICTORY_EMBLEM : DEFEAT_EMBLEM;
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
  delete $('stage').dataset.end;
}
