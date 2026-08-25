// Pure reads over RunState. No new state is allocated here.
// See specs/001-deck-runs/data-model.md § Selectors.

import type { CardId } from '@/decks/types';
import type { RunState } from '@/run/types';

/** The card being presented, or `undefined` once the run is complete (FR-006). */
export function currentCard(state: RunState): CardId | undefined {
  return state.status === 'complete' ? undefined : state.queue[state.position];
}

/** The run cleared every card (FR-010). */
export function isComplete(state: RunState): boolean {
  return state.status === 'complete';
}
