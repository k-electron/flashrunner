// The learning mechanic, as three pure transitions. No React, no storage, no I/O —
// which is what lets the whole loop be tested without rendering anything.
// Transcribed from specs/001-deck-runs/data-model.md § Transitions.

import type { DeckConfig, RungId } from '@/decks/types';
import type { Outcome, RunState } from '@/run/types';

/**
 * Begins cycle 0 with the rung's cards in config order — no shuffle.
 *
 * Throws on a rung the deck does not have. Callers resolve the rung first: the run
 * route renders an in-app message for an unknown id rather than starting a run.
 */
export function start(deck: DeckConfig, rungId: RungId): RunState {
  const rung = deck.rungs.find((entry) => entry.id === rungId);
  if (rung === undefined) {
    throw new Error(`Deck "${deck.id}" has no rung "${rungId}"`);
  }
  return {
    deckId: deck.id,
    rungId: rung.id,
    cycleIndex: 0,
    queue: [...rung.cardIds],
    position: 0,
    failedThisCycle: [],
    passedThisRun: [],
    status: 'running',
  };
}

/**
 * The whole mechanic, in one function. Records the current card's outcome and
 * advances; at the end of a cycle either the run completes (FR-010) or the next
 * cycle becomes exactly the cards failed in this one (FR-008), nothing else.
 *
 * Marking a complete run changes nothing — there is no card to mark.
 */
export function mark(state: RunState, outcome: Outcome): RunState {
  if (state.status === 'complete') {
    return state;
  }

  const card = state.queue[state.position];
  const passedThisRun = outcome === 'got-it' ? [...state.passedThisRun, card] : state.passedThisRun;
  const failedThisCycle =
    outcome === 'not-yet' ? [...state.failedThisCycle, card] : state.failedThisCycle;
  const position = state.position + 1;

  if (position < state.queue.length) {
    return { ...state, position, passedThisRun, failedThisCycle };
  }

  // Cycle exhausted.
  if (failedThisCycle.length === 0) {
    return { ...state, position, passedThisRun, failedThisCycle, status: 'complete' };
  }
  return {
    ...state,
    cycleIndex: state.cycleIndex + 1,
    queue: failedThisCycle,
    position: 0,
    failedThisCycle: [],
    passedThisRun,
  };
}

/**
 * A fresh run of the same rung. Discards this run only — nothing outside it is
 * touched (FR-032, FR-033).
 */
export function restart(deck: DeckConfig, state: RunState): RunState {
  return start(deck, state.rungId);
}
