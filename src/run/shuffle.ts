// Fisher–Yates, as one pure function. No React, no storage, no default Rng —
// the module exists to be handed a source of randomness.
// See specs/002-random-run-order/research.md § Decision 2.

import type { Rng } from '@/run/types';

/**
 * Returns a fresh array holding the same members as `items`, in a uniformly random
 * order. `items` is never mutated: the engine shuffles a rung's cardIds, and writing
 * through them would corrupt the deck config for every later run.
 *
 * An output equal to the input order is returned as-is. Re-rolling to make the result
 * look more random biases the distribution and breaks FR-005.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    // The clamp is load-bearing, not defensive noise. `Math.floor(rng() * (i + 1))` is
    // `i + 1` for an Rng returning exactly 1 — one past the end — and the failure would
    // be a silent `undefined` sitting in a queue. `Math.random` never returns 1; a
    // hand-written Rng easily does.
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
