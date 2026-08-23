// The learning mechanic, as three pure transitions. No React, no storage, no I/O —
// which is what lets the whole loop be tested without rendering anything.
// Transcribed from specs/001-deck-runs/data-model.md § Transitions, then amended by
// specs/002-random-run-order/data-model.md § Where the shuffle happens.

import type { DeckConfig, RungId } from '@/decks/types';
import { shuffle } from '@/run/shuffle';
import type { Outcome, Rng, RunState } from '@/run/types';

/**
 * Begins cycle 0 with the rung's cards in a fresh random order (FR-001, FR-002).
 * Membership is untouched — the shuffle reorders the rung and nothing else (FR-006).
 *
 * `rng` is a parameter rather than a reach for `Math.random` so a test can replay a
 * run; it defaults to `Math.random` so no caller has to supply one.
 *
 * Throws on a rung the deck does not have. Callers resolve the rung first: the run
 * route renders an in-app message for an unknown id rather than starting a run.
 */
export function start(deck: DeckConfig, rungId: RungId, rng: Rng = Math.random): RunState {
  const rung = deck.rungs.find((entry) => entry.id === rungId);
  if (rung === undefined) {
    throw new Error(`Deck "${deck.id}" has no rung "${rungId}"`);
  }
  return {
    deckId: deck.id,
    rungId: rung.id,
    cycleIndex: 0,
    queue: shuffle(rung.cardIds, rng),
    position: 0,
    failedThisCycle: [],
    passedThisRun: [],
    status: 'running',
  };
}

/**
 * The whole mechanic, in one function. Records the current card's outcome and
 * advances; at the end of a cycle either the run completes (FR-010) or the next
 * cycle becomes exactly the cards failed in this one (FR-008), shuffled.
 *
 * Randomness is drawn at the cycle boundary only. Advancing mid-cycle leaves `queue`
 * alone, which is what fixes an order for the whole cycle (FR-007); completing draws
 * nothing, and neither does marking a complete run — there is no card to mark.
 */
export function mark(state: RunState, outcome: Outcome, rng: Rng = Math.random): RunState {
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
    // The same set, a new order: a repeat cycle must not replay the fail order (FR-003).
    // `failedThisCycle` itself stays in fail order — it is the accumulator, and shuffling
    // it on write would randomise twice for no gain. `shuffle` copies, so the next queue
    // is never an alias of it.
    queue: shuffle(failedThisCycle, rng),
    position: 0,
    failedThisCycle: [],
    passedThisRun,
  };
}

/**
 * A fresh run of the same rung, in a fresh order (FR-017, FR-018). Discards this run
 * only — nothing outside it is touched (FR-032, FR-033).
 *
 * Delegating to `start` is what makes the reshuffle fall out; reimplementing it here
 * would be the way to lose it.
 */
export function restart(deck: DeckConfig, state: RunState, rng: Rng = Math.random): RunState {
  return start(deck, state.rungId, rng);
}
