// input.js — mouse and keyboard wiring for Starforge Duel.
// Clicking a card in the player's hand plays it; the END TURN button (or
// Enter) hands over to the Warden; number keys 1–8 play the card in that
// slot of the hand; the title and end screens take a click or Enter too.
// This file only translates gestures into the controller's calls — it does
// not decide whether a play is legal. A click on an unaffordable card is
// passed along like any other, and the controller's refusal (a greyed card
// simply stays in the hand) is the feedback.

export function attachInput(handlers) {
  const hand = document.getElementById('player-hand');
  hand.addEventListener('click', (event) => {
    const cardEl = event.target.closest('.card');
    if (!cardEl || !hand.contains(cardEl)) return;
    handlers.onCardClicked(Number(cardEl.dataset.uid));
  });

  document.getElementById('end-turn').addEventListener('click', () => handlers.onEndTurn());
  document.getElementById('start-duel').addEventListener('click', () => handlers.onStart());
  document.getElementById('duel-again').addEventListener('click', () => handlers.onStart());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handlers.onEnter();
      return;
    }
    const slot = Number.parseInt(event.key, 10);
    if (Number.isInteger(slot) && slot >= 1 && slot <= 8) handlers.onSlotKey(slot - 1);
  });
}
