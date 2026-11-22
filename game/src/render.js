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
 * Painted art per suit, drawn large in each card's art panel: a layered
 * flame with sparks, a crystal cluster, a bolt through storm clouds, a
 * rooted sprout. Shapes and colour, never letters — the suits stay told
 * apart even for colour-blind players.
 */
export const CARD_ART = {
  ember: '<svg viewBox="0 0 48 48"><path fill="#ff7847" d="M24 3c1.8 7.8-5.8 10.4-5.8 16.2a5.8 5.8 0 0 0 11.6 0c0-1.8-.8-3.4-.8-3.4s5.8 3.2 5.8 9.6a10.8 10.8 0 0 1-21.6 0C13.2 13.8 21.8 11.4 24 3z"/><path fill="#ffb35c" d="M24 17c1 4.4-3.4 6-3.4 9.6a3.4 3.4 0 0 0 6.8 0c0-2.8-2.4-4.4-3.4-9.6z"/><path fill="#fff3cf" d="M24 27.5c.6 2.4-1.8 3.2-1.8 5.2a1.8 1.8 0 0 0 3.6 0c0-1.6-1.2-2.4-1.8-5.2z"/><circle cx="10" cy="14" r="1.6" fill="#ffd97a"/><circle cx="38" cy="11" r="1.3" fill="#ffd97a"/><circle cx="35" cy="36" r="1.1" fill="#ffb35c"/></svg>',
  frost: '<svg viewBox="0 0 48 48"><path fill="#5ec8ff" d="M24 2 33 17 24 46 15 17Z"/><path fill="#8fd8ff" d="M10 12 17 22 13 38 6 24Z"/><path fill="#8fd8ff" d="M38 12 31 22 35 38 42 24Z"/><path d="M15 17h18M24 2 19.5 17 24 46 28.5 17 24 2" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.3"/><path d="M40 4v6M37 7h6" stroke="#dff4ff" stroke-width="1.6" stroke-linecap="round"/><path d="M7 32v5M4.5 34.5h5" stroke="#dff4ff" stroke-width="1.4" stroke-linecap="round"/></svg>',
  storm: '<svg viewBox="0 0 48 48"><ellipse cx="17" cy="11" rx="9" ry="5" fill="#8a63d2" opacity=".8"/><ellipse cx="31" cy="9" rx="10" ry="5.5" fill="#a86bff" opacity=".75"/><path fill="#ffd97a" d="M27 6 12 29h9.5L17 44 36 19H25.5L27 6z"/><path fill="#c99aff" d="M38 24l-6.5 9.5h4L33 41l8-10.5h-4.5L38 24z"/></svg>',
  grove: '<svg viewBox="0 0 48 48"><path d="M24 44c0-8-1-14 0-22" fill="none" stroke="#7fe08a" stroke-width="3" stroke-linecap="round"/><path fill="#7fe08a" d="M23 24C14 24 8 18 7.5 8.5 17 9 23 14.5 23 24z"/><path fill="#a5ecab" d="M25 20c.5-8 5.5-13 13.5-13.5C38 15.5 33 20.5 25 20z"/><path fill="#5cb96a" d="M23.5 31c-5-.5-8.5-3.5-9.5-8.5 5 .5 8.5 3.5 9.5 8.5z"/><path d="M24 44c-2.5 1.5-5 2-8 1.5M24 44c2.5 1.5 5 2 8 1.5M24 44v3" fill="none" stroke="#b98a4a" stroke-width="2.2" stroke-linecap="round"/><circle cx="38" cy="30" r="1.6" fill="#d8ffd0"/><circle cx="10" cy="36" r="1.3" fill="#d8ffd0"/></svg>',
};

/** The forge emblem stamped on every card back: ring, star, anvil. */
const BACK_EMBLEM = '<svg class="back-emblem" viewBox="0 0 48 48"><circle cx="24" cy="22" r="15.5" fill="none" stroke="#e8a91c" stroke-width="2"/><circle cx="24" cy="22" r="12" fill="none" stroke="rgba(232,169,28,.5)" stroke-width="1"/><path d="M24 11l2.7 7.3L34.5 21l-7.8 2.7L24 31l-2.7-7.3L13.5 21l7.8-2.7Z" fill="#ffd97a"/><path d="M15 40h18l-2.6 3.4H17.6Z" fill="#e8a91c"/><path d="M19.5 40v-2.6h9V40Z" fill="#e8a91c"/></svg>';

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

/** Laurel-and-trophy for a win; a cracked crest for a loss. */
const VICTORY_EMBLEM = `<svg viewBox="0 0 120 120">
  <g fill="#e8a91c">
    <ellipse cx="26" cy="86" rx="5" ry="10" transform="rotate(-38 26 86)"/>
    <ellipse cx="18" cy="66" rx="5" ry="10" transform="rotate(-62 18 66)"/>
    <ellipse cx="18" cy="45" rx="5" ry="10" transform="rotate(-84 18 45)"/>
    <ellipse cx="27" cy="27" rx="5" ry="10" transform="rotate(-112 27 27)"/>
    <ellipse cx="94" cy="86" rx="5" ry="10" transform="rotate(38 94 86)"/>
    <ellipse cx="102" cy="66" rx="5" ry="10" transform="rotate(62 102 66)"/>
    <ellipse cx="102" cy="45" rx="5" ry="10" transform="rotate(84 102 45)"/>
    <ellipse cx="93" cy="27" rx="5" ry="10" transform="rotate(112 93 27)"/>
  </g>
  <path d="M28 98C16 80 14 52 26 30M92 98c12-18 14-46 2-68" fill="none" stroke="#c98412" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 26h40c0 17-8 28-17 31v7h-6v-7C48 54 40 43 40 26z" fill="#f2b93c" stroke="#ffe9a8" stroke-width="2"/>
  <path d="M40 32c-8-1-12-6-12-13h12M80 32c8-1 12-6 12-13H80" fill="none" stroke="#f2b93c" stroke-width="4"/>
  <path d="M60 33l2.2 5.4 5.8.4-4.4 3.8 1.4 5.7-5-3.2-5 3.2 1.4-5.7L52 38.8l5.8-.4z" fill="#fff3cf"/>
  <rect x="52" y="70" width="16" height="6" fill="#f2b93c"/>
  <rect x="42" y="78" width="36" height="7" rx="2.5" fill="#f2b93c" stroke="#ffe9a8" stroke-width="1.5"/>
  <path d="M60 92l3.4 6.8 7.5 1-5.4 5.2 1.3 7.4L60 109l-6.8 3.4 1.3-7.4-5.4-5.2 7.5-1z" fill="#ffd97a"/>
</svg>`;

const DEFEAT_EMBLEM = `<svg viewBox="0 0 120 120">
  <path d="M60 10 98 24v34c0 27-16 42-38 52C38 100 22 85 22 58V24Z" fill="#3d3757" stroke="#8f87ad" stroke-width="2.5"/>
  <path d="M60 24l4.5 9.5 10.4 1.4-7.6 7.2 2 10.2L60 47l-9.3 5.3 2-10.2-7.6-7.2 10.4-1.4z" fill="#8f87ad" opacity=".45"/>
  <path d="M62 14 52 40l11 13-8 17 6 14-3 20" fill="none" stroke="#0b0916" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M62 14 52 40l11 13-8 17 6 14-3 20" fill="none" stroke="rgba(200,190,235,.35)" stroke-width="1.4" stroke-linecap="round" transform="translate(2.5 0)"/>
  <path d="M30 96l-7 9M92 92l8 7" stroke="#8f87ad" stroke-width="4" stroke-linecap="round"/>
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
}
