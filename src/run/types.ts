// The run state machine's shape. Pure — nothing under src/run/ imports React,
// storage, or anything else with I/O.
// See specs/001-deck-runs/data-model.md § Earned: the run state machine.

import type { CardId, DeckId, RungId } from '@/decks/types';

/** Labelled "Got it" / "Not yet" on screen (FR-027). */
export type Outcome = 'got-it' | 'not-yet';

/**
 * A source of randomness yielding a number in [0, 1). `Math.random` satisfies it.
 *
 * The engine takes one as a parameter rather than reaching for `Math.random`
 * itself, so a test can assert what a given sequence produces (FR-005, SC-002).
 */
export type Rng = () => number;

export type RunState = {
  deckId: DeckId;
  rungId: RungId;
  cycleIndex: number; // 0-based; cycle 0 is the full rung
  queue: CardId[]; // cards to present this cycle, in order
  position: number; // index into queue of the current card
  failedThisCycle: CardId[]; // accumulating, in the order they were failed
  passedThisRun: CardId[]; // never shrinks (FR-009)
  status: 'running' | 'complete';
};
