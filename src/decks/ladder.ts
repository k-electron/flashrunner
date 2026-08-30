// Pure derivations over an authored deck and the rung ids already completed.
// Mastery is derived here and never stored — a stored boolean is a second source
// of truth that drifts across a config revision (data-model.md § Mastery is
// derived, not stored). No React, no storage, no I/O.

import type { DeckConfig, RungConfig, RungId } from '@/decks/types';

/**
 * A rung is startable exactly when every rung below it has been completed.
 *
 * The point is an unbroken ladder: an early reader should see the levels they can
 * start run from the bottom up to the first one they have not finished, with no
 * gap in the middle to explain (008 FR-006). Progress can be out of order — a run
 * entered by URL is never gated (008 FR-008) — and the weaker "immediate
 * predecessor" rule would open a level above a gap while the levels below it
 * stayed shut.
 *
 * No `index === 0` case: `[].every(…)` is true, so the smallest rung falls out of
 * the expression rather than being written twice.
 *
 * This supersedes 001-deck-runs FR-016 for out-of-order progress only. A rung
 * completed in order — every rung the deck screen can reach — stays startable
 * forever, because the same condition that let it be started reads back the same.
 * A rung completed out of order shuts again until the run below it is unbroken
 * (008 FR-007).
 */
export function isStartable(deck: DeckConfig, completedRungIds: RungId[], index: number): boolean {
  if (index < 0 || index >= deck.rungs.length) {
    return false;
  }
  return deck.rungs.slice(0, index).every((rung) => completedRungIds.includes(rung.id));
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
