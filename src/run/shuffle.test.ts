// Every row of the shuffle contract table in
// specs/002-random-run-order/contracts/run-engine.md, plus SC-002 from the spec.
// These assert guarantees rather than an algorithm: no test pins a particular
// output array for a particular Rng sequence.
//
// One exception, deliberately: the honesty test assumes the back-to-front walk
// that research.md Decision 2 specifies, because "the identity is returned rather
// than re-rolled" cannot be stated without knowing which choice means "leave this
// element alone". A forward-walking Fisher-Yates would be equally correct and
// would fail that one test.
import { describe, expect, it } from 'vitest';
import { shuffle } from '@/run/shuffle';
import type { Rng } from '@/run/types';
import { seededRng } from '@/test/rng';

const FIVE_CARDS = ['c1', 'c2', 'c3', 'c4', 'c5'];

/** The seeds every statistical assertion below runs over. Fixed, so CI cannot flake. */
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

function sorted(items: readonly string[]): string[] {
  return [...items].sort();
}

describe('shuffle — permutation and purity', () => {
  it('returns a permutation of the input — same length, same multiset (FR-004)', () => {
    // A cycle must present exactly the cards it owes the learner: none dropped,
    // none duplicated, none invented. Checked across many seeds rather than one,
    // because a single sample can pass by luck.
    for (const seed of SEEDS) {
      const result = shuffle(FIVE_CARDS, seededRng(seed));
      expect(result).toHaveLength(FIVE_CARDS.length);
      expect(sorted(result)).toEqual(sorted(FIVE_CARDS));
    }
  });

  it('preserves duplicate members rather than collapsing them', () => {
    // The multiset guarantee, not merely a set guarantee. A rung cannot hold the
    // same card twice today, but the contract is stated over multisets and the
    // caller should not have to know which one it got.
    const withDuplicates = ['a', 'a', 'b', 'b', 'b', 'c'];
    expect(sorted(shuffle(withDuplicates, seededRng(7)))).toEqual(sorted(withDuplicates));
  });

  it('leaves the array it was given untouched', () => {
    // The engine hands `shuffle` a rung's cardIds. Mutating them would corrupt the
    // deck config for every later run — the aliasing hazard 001's tests already guard.
    const input = [...FIVE_CARDS];
    shuffle(input, seededRng(1));
    expect(input).toEqual(FIVE_CARDS);
  });

  it('returns a fresh array rather than the one it was given', () => {
    // Purity is about identity too: a caller that pushes onto the result must not
    // reach back into the input.
    const input = [...FIVE_CARDS];
    expect(shuffle(input, seededRng(1))).not.toBe(input);
  });
});

describe('shuffle — totality at the boundaries', () => {
  it('returns an equal array for an empty input', () => {
    // A completed cycle hands over an empty failed list. No throw, no undefined.
    expect(shuffle([], seededRng(1))).toEqual([]);
  });

  it('returns an equal array for a single-element input', () => {
    // The last cycle of most runs is one card. Shuffling it is a no-op that must
    // still return that one card.
    expect(shuffle(['c1'], seededRng(1))).toEqual(['c1']);
  });

  it('never places undefined in the result when the Rng returns exactly 1', () => {
    // `1` is deliberately outside the documented [0, 1) range of an Rng. Math.random
    // never returns it, but a hand-written test Rng easily does, and
    // `Math.floor(rng() * (i + 1))` is then `i + 1` — one past the end. The swap index
    // is clamped so the failure cannot be a silent undefined sitting in a queue.
    const always1: Rng = () => 1;
    // Widened on purpose: the declared return type says string, and the bug this guards
    // against is a hole in the array that the type system cannot see.
    const result: (string | undefined)[] = shuffle(FIVE_CARDS, always1);

    expect(result).toHaveLength(FIVE_CARDS.length);
    expect(result).not.toContain(undefined);
    expect([...result].sort()).toEqual(sorted(FIVE_CARDS));
  });
});

describe('shuffle — honesty', () => {
  it('returns the input order as-is when the Rng picks the identity, without re-rolling', () => {
    // The observable guarantee is the absence of a re-roll, not the algorithm. Given
    // an Rng whose every choice is "leave this element where it is", the honest answer
    // is the input order, and a shuffle that re-rolled to make its output look more
    // random would either return something else or spin forever on this constant Rng.
    //
    // Under the contract's back-to-front walk, `Math.floor(rng() * (i + 1))` is `i` for
    // any value just below 1, so this Rng chooses the identity permutation.
    const alwaysHighest: Rng = () => 0.9999999;
    expect(shuffle(FIVE_CARDS, alwaysHighest)).toEqual(FIVE_CARDS);
  });
});

describe('shuffle — reachability and spread (I11, SC-002)', () => {
  it('places every one of five cards in every one of five positions', () => {
    // FR-005: no card is pinned to a slot. The grid is rows = card, columns = the index
    // it landed at; SC-002 is satisfied only when no cell is empty. Fixed seeds keep the
    // claim deterministic.
    const grid = FIVE_CARDS.map(() => FIVE_CARDS.map(() => 0));

    for (const seed of SEEDS) {
      shuffle(FIVE_CARDS, seededRng(seed)).forEach((card, index) => {
        grid[FIVE_CARDS.indexOf(card)][index] += 1;
      });
    }

    const unreached = grid.flatMap((row, card) =>
      row.flatMap((count, index) =>
        count === 0 ? [`${FIVE_CARDS[card]} never reached ${index}`] : [],
      ),
    );
    expect(unreached).toEqual([]);
  });

  it('reaches most of the possible orders, not a handful of them', () => {
    // Reachability on its own is a low bar: a shuffle that only ever rotated the
    // array would put every card in every position and satisfy the grid above,
    // while emitting 5 of the 120 orders and leaving every card's neighbour fixed.
    // FR-005 forbids exactly that — structural pinning — so count the distinct
    // orders instead of the positions they cover.
    //
    // The same 200 seeds yield 100 distinct orders. Half of 120 is the threshold
    // because it sits far above any rotation- or reflection-shaped family and far
    // below what a real shuffle produces; the seeds are fixed, so it cannot flake.
    const orders = new Set(SEEDS.map((seed) => shuffle(FIVE_CARDS, seededRng(seed)).join(',')));
    expect(orders.size).toBeGreaterThan(60);
  });
});
