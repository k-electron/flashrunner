// A deterministic pseudo-random generator, for tests only.
//
// TEST-ONLY. No shipped code imports this file — only test files do — and nothing
// it produces is written to localStorage. It stores no state outside the closure
// it returns, so it does not contradict FR-010, which forbids persisting a seed or
// generator state in a learner's run record.
//
// That boundary is a convention, not a checked property: nothing in oxlint, tsc, or
// the build would stop a module under src/run/ from importing this. Said plainly
// here rather than left to a reader who assumes a guard exists.
//
// It exists because SC-002 and SC-003 are distribution claims: they need many
// trials with a reproducible outcome, or CI flakes.
// See specs/002-random-run-order/research.md § Decision 5.

import type { Rng } from '@/run/types';

/**
 * Mulberry32. The same seed always yields the same sequence, and different seeds
 * yield sequences that differ from each other well before the shuffle runs out
 * of elements to place.
 *
 * Chosen for being short enough to read in one sitting and stateless between
 * calls to `seededRng` — two generators from the same seed are independent and
 * identical, which is what lets a test replay a run.
 */
export function seededRng(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
