// Pure derivations over an authored deck and the rung ids already completed.
// Mastery is derived here and never stored — a stored boolean is a second source
// of truth that drifts across a config revision (data-model.md § Mastery is
// derived, not stored). No React, no storage, no I/O.

import type { DeckConfig, RungConfig, RungId } from '@/decks/types';

/**
 * A rung is startable exactly when its immediate predecessor has been completed.
 * The smallest rung is always startable (FR-015).
 *
 * Deliberately *not* "above the highest completed rung": completing rung 1 makes
 * rung 1 the highest completed one, so that formulation would report rung 2 as
 * locked and leave the deck unfinishable.
 *
 * Completed rungs therefore stay startable forever (FR-016) — completing a rung
 * required its predecessor, which is the same condition read back.
 */
export function isStartable(deck: DeckConfig, completedRungIds: RungId[], index: number): boolean {
  if (index < 0 || index >= deck.rungs.length) {
    return false;
  }
  return index === 0 || completedRungIds.includes(deck.rungs[index - 1].id);
}

/** The top rung is the whole deck, so completing it is mastery (FR-017). */
export function isMastered(deck: DeckConfig, completedRungIds: RungId[]): boolean {
  const top = deck.rungs.at(-1);
  return top !== undefined && completedRungIds.includes(top.id);
}

/**
 * The furthest rung up the ladder that has been completed, in ladder order rather
 * than the order the ids happen to be stored in (FR-019). An id this build does
 * not recognize matches no rung and so contributes nothing.
 */
export function highestCompletedRung(
  deck: DeckConfig,
  completedRungIds: RungId[],
): RungConfig | undefined {
  return deck.rungs.filter((rung) => completedRungIds.includes(rung.id)).at(-1);
}

/** The rung one step up, or `undefined` at the top of the ladder (FR-014). */
export function nextRung(deck: DeckConfig, rungId: RungId): RungConfig | undefined {
  const index = deck.rungs.findIndex((rung) => rung.id === rungId);
  return index === -1 ? undefined : deck.rungs.at(index + 1);
}
