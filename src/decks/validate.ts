import type { DeckConfig } from '@/decks/types';

// Rules V1–V8 from specs/001-deck-runs/data-model.md § Validation rules.
// These are checks only. Nothing here derives rung membership.

/**
 * Returns one human-readable message per violation, or an empty array for a valid deck.
 */
export function validateDeck(deck: DeckConfig): string[] {
  const problems: string[] = [];

  // V1 — cards is non-empty and every card.id is unique within the deck.
  if (deck.cards.length === 0) {
    problems.push(`V1: deck "${deck.id}" has no cards`);
  }
  for (const duplicate of duplicates(deck.cards.map((card) => card.id))) {
    problems.push(`V1: deck "${deck.id}" has more than one card with id "${duplicate}"`);
  }

  // V2 — rungs is non-empty.
  if (deck.rungs.length === 0) {
    problems.push(`V2: deck "${deck.id}" has no rungs`);
  }

  // V3 — every rung.id is unique within the deck.
  for (const duplicate of duplicates(deck.rungs.map((rung) => rung.id))) {
    problems.push(`V3: deck "${deck.id}" has more than one rung with id "${duplicate}"`);
  }

  const cardIds = new Set(deck.cards.map((card) => card.id));

  for (const rung of deck.rungs) {
    // V4 — every id in every rung.cardIds exists in cards.
    for (const cardId of rung.cardIds) {
      if (!cardIds.has(cardId)) {
        problems.push(`V4: rung "${rung.id}" lists card "${cardId}", which is not in the deck`);
      }
    }

    // V5 — no rung.cardIds contains a duplicate.
    for (const duplicate of duplicates(rung.cardIds)) {
      problems.push(`V5: rung "${rung.id}" lists card "${duplicate}" more than once`);
    }
  }

  // V6 — for every adjacent pair, rungs[i].cardIds ⊇ rungs[i - 1].cardIds, as sets.
  for (let i = 1; i < deck.rungs.length; i++) {
    const below = deck.rungs[i - 1];
    const above = deck.rungs[i];
    const aboveIds = new Set(above.cardIds);
    for (const cardId of below.cardIds) {
      if (!aboveIds.has(cardId)) {
        problems.push(
          `V6: rung "${above.id}" is missing card "${cardId}" from the rung below it, "${below.id}"`,
        );
      }
    }
  }

  // V7 — the last rung's cardIds equals the full set of card.id, in both directions.
  const top = deck.rungs[deck.rungs.length - 1];
  if (top !== undefined) {
    const topIds = new Set(top.cardIds);
    for (const cardId of cardIds) {
      if (!topIds.has(cardId)) {
        problems.push(`V7: top rung "${top.id}" omits card "${cardId}", so it is unreachable`);
      }
    }
    for (const cardId of topIds) {
      if (!cardIds.has(cardId)) {
        problems.push(`V7: top rung "${top.id}" lists card "${cardId}", which is not in the deck`);
      }
    }
  }

  // V8 — every rung.cardIds is non-empty. An empty rung starts a run whose queue is
  // empty while status is 'running', which invariant I5 forbids.
  for (const rung of deck.rungs) {
    if (rung.cardIds.length === 0) {
      problems.push(`V8: rung "${rung.id}" has no cards`);
    }
  }

  return problems;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      repeated.add(id);
    }
    seen.add(id);
  }
  return [...repeated];
}
