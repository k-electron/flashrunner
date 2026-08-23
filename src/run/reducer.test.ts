// Invariants I1–I6 from specs/001-deck-runs/data-model.md plus every row of the
// run-engine scenario table in specs/001-deck-runs/quickstart.md, and I7–I9 plus
// SC-001, SC-003 and SC-010 from specs/002-random-run-order/. Plain function calls —
// the mechanic is testable without rendering anything.
//
// Since 002 the presented order is a shuffle, so no test here names a card by the
// position it occupies. Tests that need a particular card to fail answer by card
// identity (`failOnly`, `learnsAfterOneMiss`) rather than by position, and no test
// pins the array a given seed produces — that would fix the algorithm rather than
// the guarantee.
import { describe, expect, it } from 'vitest';
import type { CardId, DeckConfig } from '@/decks/types';
import { mark, restart, start } from '@/run/reducer';
import { currentCard, isComplete, remainingInCycle } from '@/run/selectors';
import type { Outcome, Rng, RunState } from '@/run/types';
import { seededRng } from '@/test/rng';

const FIVE_CARDS = ['c1', 'c2', 'c3', 'c4', 'c5'];

/** The seeds every distribution assertion below runs over. Fixed, so CI cannot flake. */
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

const deck: DeckConfig = {
  id: 'fixture',
  title: 'Fixture',
  cards: FIVE_CARDS.map((id) => ({ id, front: id })),
  rungs: [{ id: 'r1', label: '5 cards', cardIds: [...FIVE_CARDS] }],
};

function sorted(items: readonly CardId[]): CardId[] {
  return [...items].sort();
}

/** Applies a sequence of outcomes, oldest first. */
function applyAll(state: RunState, outcomes: Outcome[], rng?: Rng): RunState {
  return outcomes.reduce<RunState>((current, outcome) => mark(current, outcome, rng), state);
}

function pass(times: number): Outcome[] {
  return Array.from({ length: times }, () => 'got-it' as const);
}

function fail(times: number): Outcome[] {
  return Array.from({ length: times }, () => 'not-yet' as const);
}

/** What a learner answers when shown `card` in `state`. */
type Answer = (card: CardId, state: RunState) => Outcome;

/** Answers "Not yet" to the named cards and "Got it" to the rest, every cycle. */
function failOnly(cards: readonly CardId[]): Answer {
  return (card) => (cards.includes(card) ? 'not-yet' : 'got-it');
}

/** A learner who misses the named cards once and has them by the next cycle. */
function learnsAfterOneMiss(cards: readonly CardId[]): Answer {
  return (card, state) => (state.cycleIndex === 0 && cards.includes(card) ? 'not-yet' : 'got-it');
}

/**
 * Marks every card left in the current cycle, answering by identity rather than
 * position, and reports the fail order the cycle accumulated on the way. Loops a
 * fixed number of times: at the boundary `position` resets and a length test would
 * run on into the next cycle.
 */
function closeCycle(
  state: RunState,
  answer: Answer,
  rng: Rng,
): { next: RunState; failOrder: CardId[] } {
  const marks = state.queue.length - state.position;
  const failOrder: CardId[] = [];
  let next = state;
  for (let step = 0; step < marks; step += 1) {
    const card = next.queue[next.position];
    const outcome = answer(card, next);
    if (outcome === 'not-yet') {
      failOrder.push(card);
    }
    next = mark(next, outcome, rng);
  }
  return { next, failOrder };
}

/**
 * Plays a whole run, recording each card as it was presented. The mark cap is a
 * guard against a run that never completes hanging the suite, not a behavior claim —
 * callers assert completion so the cap cannot pass silently.
 */
function playRun(
  rng: Rng,
  answer: Answer,
): { state: RunState; shown: CardId[]; outcomes: Outcome[] } {
  let state = start(deck, 'r1', rng);
  const shown: CardId[] = [];
  const outcomes: Outcome[] = [];
  while (!isComplete(state) && shown.length < 100) {
    const card = state.queue[state.position];
    const outcome = answer(card, state);
    shown.push(card);
    outcomes.push(outcome);
    state = mark(state, outcome, rng);
  }
  return { state, shown, outcomes };
}

/** Replays a fixed answer sequence without looking at the cards — the SC-010 learner. */
function replayBlind(rng: Rng, outcomes: readonly Outcome[]): { state: RunState; shown: CardId[] } {
  let state = start(deck, 'r1', rng);
  const shown: CardId[] = [];
  for (const outcome of outcomes) {
    if (isComplete(state)) {
      break;
    }
    shown.push(state.queue[state.position]);
    state = mark(state, outcome, rng);
  }
  return { state, shown };
}

describe('start', () => {
  it('seeds cycle 0 with the rung cards, in some order (SC-004)', () => {
    // Was an equality against FIVE_CARDS. The membership claim is the one SC-004
    // rests on and is unchanged — cycle 0 owes the learner exactly the rung, none
    // added, none dropped. Config order is no longer part of the claim, so the
    // queue is folded back into the expected object and checked separately as a
    // permutation; every other field is still pinned exactly.
    const state = start(deck, 'r1', seededRng(1));
    expect(sorted(state.queue)).toEqual(sorted(FIVE_CARDS));
    expect(state).toEqual({
      deckId: 'fixture',
      rungId: 'r1',
      cycleIndex: 0,
      queue: state.queue,
      position: 0,
      failedThisCycle: [],
      passedThisRun: [],
      status: 'running',
    });
  });

  it('rejects a rung the deck does not have', () => {
    expect(() => start(deck, 'nope')).toThrow('no rung');
  });

  it('does not alias the rung cardIds it was given', () => {
    const state = start(deck, 'r1');
    state.queue.push('c6');
    expect(deck.rungs[0].cardIds).toEqual(FIVE_CARDS);
  });
});

describe('mark — the scenario table', () => {
  it('completes immediately when all five pass on cycle 0, never leaving cycle 0', () => {
    let state = start(deck, 'r1');
    for (const outcome of pass(5)) {
      state = mark(state, outcome);
      expect(state.cycleIndex).toBe(0);
    }
    expect(isComplete(state)).toBe(true);
    expect(currentCard(state)).toBeUndefined();
  });

  it('opens cycle 1 with exactly the two failed cards, in some order (SC-004)', () => {
    // Was an equality against ['c2', 'c4'], described as fail order. "Exactly the
    // two failed cards" is still the claim and is still what SC-004 rests on; "in
    // fail order" is the part 002 removes, and FR-003 now forbids it as a guarantee.
    // The outcomes are chosen by card rather than by position because position no
    // longer says which card is on screen.
    const rng = seededRng(1);
    const { next: state } = closeCycle(start(deck, 'r1', rng), failOnly(['c2', 'c4']), rng);
    expect(state.cycleIndex).toBe(1);
    expect(sorted(state.queue)).toEqual(['c2', 'c4']);
    expect(state.position).toBe(0);
    expect(state.failedThisCycle).toEqual([]);
    expect(isComplete(state)).toBe(false);
  });

  it('narrows a cycle of two to the one card still failed', () => {
    // Was driven by position — pass, fail, pass, fail, pass — which named c4 only
    // because cycle 0 used to be config order. Same run, chosen by card instead: c2
    // and c4 miss on cycle 0, then c2 lands and c4 misses again, wherever the two
    // turn up in the shuffled cycle.
    const rng = seededRng(1);
    const { next: cycleOne } = closeCycle(start(deck, 'r1', rng), failOnly(['c2', 'c4']), rng);
    const { next: cycleTwo } = closeCycle(cycleOne, failOnly(['c4']), rng);
    expect(cycleTwo.cycleIndex).toBe(2);
    expect(cycleTwo.queue).toEqual(['c4']);
    expect(isComplete(cycleTwo)).toBe(false);
  });

  it('completes when the last remaining failed card is passed', () => {
    // The single miss is now named rather than left to fall on the last position.
    // Cycle 1 is still exactly one card and passing it still ends the run.
    const rng = seededRng(2);
    const { next: cycleOne } = closeCycle(start(deck, 'r1', rng), failOnly(['c5']), rng);
    expect(cycleOne.queue).toEqual(['c5']);
    const done = mark(cycleOne, 'got-it', rng);
    expect(isComplete(done)).toBe(true);
  });

  it('never re-presents a card passed in cycle 0 (I1)', () => {
    // Whichever card cycle 0 opens on passes; everything else fails for several
    // cycles. Was hard-coded to c1, which is only the opener when nothing shuffles.
    const rng = seededRng(3);
    const opening = start(deck, 'r1', rng);
    const learned = opening.queue[0];
    let state = applyAll(opening, ['got-it', ...fail(4)], rng);
    for (let cycle = 0; cycle < 5; cycle += 1) {
      expect(state.queue).not.toContain(learned);
      expect(state.passedThisRun).toContain(learned);
      state = applyAll(state, fail(state.queue.length), rng);
    }
  });

  it('runs 50 cycles of total failure without erroring or capping', () => {
    // Every cycle still owes all five cards; the equality against FIVE_CARDS was a
    // membership claim that config order happened to satisfy as a sequence too.
    const rng = seededRng(4);
    let state = start(deck, 'r1', rng);
    for (let cycle = 0; cycle < 50; cycle += 1) {
      state = applyAll(state, fail(5), rng);
      expect(sorted(state.queue)).toEqual(sorted(FIVE_CARDS));
      expect(state.queue).toHaveLength(FIVE_CARDS.length);
      expect(state.status).toBe('running');
    }
    expect(state.cycleIndex).toBe(50);
    expect(state.passedThisRun).toEqual([]);
  });

  it('holds the rung’s whole card set in passedThisRun on completion (I3)', () => {
    const state = applyAll(start(deck, 'r1'), [
      'got-it',
      'not-yet',
      'got-it',
      'not-yet',
      'got-it',
      'got-it',
      'got-it',
    ]);
    expect(isComplete(state)).toBe(true);
    expect([...state.passedThisRun].sort()).toEqual([...FIVE_CARDS].sort());
  });
});

describe('mark — invariants', () => {
  it('I2: each cycle’s queue is the previous cycle’s failedThisCycle, exactly and permuted', () => {
    // 001 stated I2 as "same members, same order". 002 amends it to "same members,
    // permuted order" (FR-003); the membership half is untouched. See
    // specs/002-random-run-order/data-model.md § Invariants added to the engine's test list.
    const rng = seededRng(1);
    let state = start(deck, 'r1', rng);
    // Fail the back half of every cycle so the boundary is observable twice.
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const size = state.queue.length;
      const passes = Math.floor(size / 2);
      let before = state;
      for (const outcome of [...pass(passes), ...fail(size - passes)]) {
        before = state;
        state = mark(state, outcome, rng);
      }
      const failedAtBoundary = [...before.failedThisCycle, before.queue[before.position]];
      expect(sorted(state.queue)).toEqual(sorted(failedAtBoundary));
      expect(state.queue).toHaveLength(failedAtBoundary.length);
      expect(state.cycleIndex).toBe(cycle + 1);
    }
  });

  it('I3: status is complete only once every rung card has passed', () => {
    let state = start(deck, 'r1');
    for (const outcome of pass(4)) {
      state = mark(state, outcome);
      expect(isComplete(state)).toBe(false);
      expect(state.passedThisRun.length).toBeLessThan(FIVE_CARDS.length);
    }
    state = mark(state, 'got-it');
    expect(isComplete(state)).toBe(true);
    expect(state.passedThisRun).toHaveLength(FIVE_CARDS.length);
  });

  it('I5 and I6 hold after every single mark of a long mixed run', () => {
    let state = start(deck, 'r1');
    const outcomes: Outcome[] = ['got-it', 'not-yet', 'not-yet', 'got-it', 'not-yet'];
    for (let step = 0; step < 60; step += 1) {
      state = mark(state, outcomes[step % outcomes.length]);
      if (!isComplete(state)) {
        // I5
        expect(state.queue.length).toBeGreaterThan(0);
        expect(state.position).toBeGreaterThanOrEqual(0);
        expect(state.position).toBeLessThan(state.queue.length);
      }
      // I6
      expect(new Set(state.passedThisRun).size).toBe(state.passedThisRun.length);
      expect(new Set(state.failedThisCycle).size).toBe(state.failedThisCycle.length);
    }
  });

  it('leaves the state it was given untouched', () => {
    const state = start(deck, 'r1');
    const before = structuredClone(state);
    mark(state, 'not-yet');
    expect(state).toEqual(before);
  });

  it('does not alias the previous state’s failedThisCycle as the next cycle’s queue', () => {
    // The last card of the cycle passes, so the failed list is carried over untouched —
    // that is the path where the two arrays could end up being the same object.
    const rng = seededRng(5);
    const opening = start(deck, 'r1', rng);
    const missed = opening.queue[0];
    const prev = applyAll(opening, ['not-yet', ...pass(3)], rng);
    expect(prev.failedThisCycle).toEqual([missed]);

    const next = mark(prev, 'got-it', rng);
    expect(next.queue).toEqual([missed]);
    expect(next.queue).not.toBe(prev.failedThisCycle);
  });

  it('changes nothing when a complete run is marked again', () => {
    const done = applyAll(start(deck, 'r1'), pass(5));
    expect(mark(done, 'not-yet')).toBe(done);
  });
});

describe('mark — ordering invariants (I7–I9)', () => {
  it('I7: every cycle’s queue is a permutation of the cards that cycle owes', () => {
    // Cycle 0 owes the rung; cycle n+1 owes exactly what cycle n failed. Shuffling
    // is allowed to reorder that set and nothing else — no card added, dropped, or
    // duplicated at any boundary (FR-001, FR-004, SC-004).
    const rng = seededRng(9);
    let state = start(deck, 'r1', rng);
    expect(sorted(state.queue)).toEqual(sorted(deck.rungs[0].cardIds));

    // Fail four cards on cycle 0, then three of those, then two, so the invariant is
    // checked at three successive boundaries with a shrinking set each time.
    for (const failing of [
      ['c2', 'c3', 'c4', 'c5'],
      ['c3', 'c4', 'c5'],
      ['c4', 'c5'],
    ]) {
      const owed = state.queue.filter((card) => failing.includes(card));
      const { next, failOrder } = closeCycle(state, failOnly(failing), rng);
      expect(failOrder).toEqual(owed);
      expect(sorted(next.queue)).toEqual(sorted(owed));
      expect(next.queue).toHaveLength(owed.length);
      state = next;
    }
    expect(state.cycleIndex).toBe(3);
  });

  it('I8: the queue is fixed once a cycle opens — only position advances', () => {
    // FR-007 and FR-013: an order is decided when the cycle begins and is not
    // recomputed per card. Checked on cycle 0 and again on a repeat cycle, because
    // the two queues are built at different points in `mark`.
    const rng = seededRng(17);
    let state = start(deck, 'r1', rng);

    for (const cycle of [0, 1]) {
      const opening = [...state.queue];
      for (let step = 0; step < opening.length; step += 1) {
        expect(state.queue).toEqual(opening);
        expect(state.position).toBe(step);
        // Fail everything, so cycle 1 is the same size as cycle 0 and the second pass
        // through this loop has something to observe.
        state = mark(state, 'not-yet', rng);
      }
      expect(state.cycleIndex).toBe(cycle + 1);
      expect(state.position).toBe(0);
    }
  });

  it('I9: the same seed and the same rung replay an identical sequence of cards', () => {
    // FR-010 and SC-005 reduce to this: nothing is stored to make a run repeatable,
    // so determinism is a property of the Rng and the engine only has to not disturb
    // it. Two generators from one seed are independent and identical, so the second
    // run is a genuine replay rather than the same object read twice.
    const answer = learnsAfterOneMiss(['c2', 'c4', 'c5']);
    const first = playRun(seededRng(23), answer);
    const second = playRun(seededRng(23), answer);

    expect(isComplete(first.state)).toBe(true);
    // More marks than the rung has cards, so the replay spans a cycle boundary —
    // where the second shuffle happens — and not just the opening deal.
    expect(first.shown.length).toBeGreaterThan(FIVE_CARDS.length);
    expect(second.shown).toEqual(first.shown);
    expect(second.state).toEqual(first.state);
  });

  it('I9: a different seed is free to produce a different sequence', () => {
    // The companion half. I9 says one seed replays; it must not say every seed
    // agrees, which would be the fixed order this feature removes. Stated as a
    // property of the seeds actually used, so it cannot flake.
    const answer = learnsAfterOneMiss(['c2', 'c4', 'c5']);
    const sequences = new Set(
      SEEDS.map((seed) => playRun(seededRng(seed), answer).shown.join(',')),
    );
    // Measured: 179 distinct sequences over these 200 seeds. A fixed-order engine
    // produces exactly 1.
    expect(sequences.size).toBeGreaterThan(1);
  });
});

describe('order — distribution across runs (SC-001, SC-003, SC-010)', () => {
  it('SC-001: twenty fresh runs do not all open on the same card', () => {
    // The weakest claim the spec makes, and the one a learner notices first. Measured:
    // seeds 1–20 open on all five cards, so the bound of "more than one" has the whole
    // rung in hand. A fixed-order engine scores exactly 1.
    const firstCards = new Set(
      Array.from({ length: 20 }, (_, index) => start(deck, 'r1', seededRng(index + 1)).queue[0]),
    );
    expect(firstCards.size).toBeGreaterThan(1);
  });

  it('SC-003: a repeat cycle reproduces its fail order about as often as chance', () => {
    // FR-003. Four of five cards fail, so the repeat cycle has k = 4 members and the
    // fail order is 1 of 4! = 24 equally likely orders — chance is 4.2%.
    //
    // Measured over these 200 fixed seeds: 7 matches, 3.5%. The bound is 20%, roughly
    // five times the measured share and five times chance, and a fixed-order engine
    // scores 100% — so there is room for a different but still correct shuffle to
    // pass, and none for no shuffle at all.
    //
    // A chance match is legitimate per the spec's edge cases: 7 of these 200 runs do
    // reproduce the fail order and that is the expected result, not a failure. Hence a
    // bound on the share rather than a claim that no run ever matches.
    const failing = ['c2', 'c3', 'c4', 'c5'];
    let matchedFailOrder = 0;

    for (const seed of SEEDS) {
      const rng = seededRng(seed);
      const { next, failOrder } = closeCycle(start(deck, 'r1', rng), failOnly(failing), rng);
      expect(next.cycleIndex).toBe(1);
      expect(sorted(next.queue)).toEqual(sorted(failing));
      if (next.queue.join(',') === failOrder.join(',')) {
        matchedFailOrder += 1;
      }
    }

    expect(matchedFailOrder / SEEDS.length).toBeLessThan(0.2);
  });

  it('SC-010: a memorised answer sequence lands on different cards in a second run', () => {
    // A learner clears the rung knowing c1–c3 and missing c4 and c5 once each, then
    // repeats it by replaying those answers from memory without reading the cards.
    //
    // The engine records outcomes rather than judging them, so the rote run still
    // reaches `complete`: completion depends only on the shape of the answer sequence,
    // which is the same under any order. What the new order breaks is the pairing —
    // at least one "Got it" from the first cycle now lands on a card this learner does
    // not know, so clearing the run is no longer evidence of knowing the rung. Measured
    // with these seeds: c5 is claimed blind. A fixed-order engine pairs the answers
    // with the same cards both times and claims nothing.
    const known = ['c1', 'c2', 'c3'];
    const cleared = playRun(seededRng(1), learnsAfterOneMiss(['c4', 'c5']));
    expect(isComplete(cleared.state)).toBe(true);

    const rote = replayBlind(seededRng(2), cleared.outcomes);
    const claimedBlind = rote.shown
      .slice(0, FIVE_CARDS.length)
      .filter((card, index) => cleared.outcomes[index] === 'got-it' && !known.includes(card));

    expect(claimedBlind).not.toEqual([]);
  });
});

describe('selectors', () => {
  it('reports the current card and the cards left in this cycle', () => {
    // The claim is that the selectors track the opening order as position advances.
    // c1 then c2 was that order before the shuffle; the order the cycle actually
    // opened with is captured up front and the same two steps are checked against it.
    const rng = seededRng(6);
    let state = start(deck, 'r1', rng);
    const dealt = [...state.queue];
    expect(currentCard(state)).toBe(dealt[0]);
    expect(remainingInCycle(state)).toBe(5);

    state = mark(state, 'got-it', rng);
    expect(currentCard(state)).toBe(dealt[1]);
    expect(remainingInCycle(state)).toBe(4);
  });

  it('reports no current card and nothing remaining once complete', () => {
    const done = applyAll(start(deck, 'r1'), pass(5));
    expect(currentCard(done)).toBeUndefined();
    expect(remainingInCycle(done)).toBe(0);
  });
});

describe('restart', () => {
  it('returns a fresh run of the same rung', () => {
    // Deep equality against a `start` of the same rung is still the claim. It needs a
    // shared seed now: two generators from one seed are independent and identical, so
    // the two calls shuffle alike and any difference left is `restart`'s doing.
    const midRun = applyAll(start(deck, 'r1', seededRng(7)), ['got-it', 'not-yet']);
    expect(restart(deck, midRun, seededRng(8))).toEqual(start(deck, 'r1', seededRng(8)));
  });

  it('discards only the run it was given', () => {
    const midRun = applyAll(start(deck, 'r1'), ['got-it', 'not-yet']);
    const before = structuredClone(midRun);
    restart(deck, midRun);
    expect(midRun).toEqual(before);
  });
});
