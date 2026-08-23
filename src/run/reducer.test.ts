// Invariants I1–I6 from specs/001-deck-runs/data-model.md plus every row of the
// run-engine scenario table in specs/001-deck-runs/quickstart.md. Plain function
// calls — the mechanic is testable without rendering anything.
import { describe, expect, it } from 'vitest';
import type { DeckConfig } from '@/decks/types';
import { mark, restart, start } from '@/run/reducer';
import { currentCard, isComplete, remainingInCycle } from '@/run/selectors';
import type { Outcome, RunState } from '@/run/types';

const FIVE_CARDS = ['c1', 'c2', 'c3', 'c4', 'c5'];

const deck: DeckConfig = {
  id: 'fixture',
  title: 'Fixture',
  cards: FIVE_CARDS.map((id) => ({ id, front: id })),
  rungs: [{ id: 'r1', label: '5 cards', cardIds: [...FIVE_CARDS] }],
};

/** Applies a sequence of outcomes, oldest first. */
function applyAll(state: RunState, outcomes: Outcome[]): RunState {
  return outcomes.reduce<RunState>((current, outcome) => mark(current, outcome), state);
}

function pass(times: number): Outcome[] {
  return Array.from({ length: times }, () => 'got-it' as const);
}

function fail(times: number): Outcome[] {
  return Array.from({ length: times }, () => 'not-yet' as const);
}

describe('start', () => {
  it('seeds cycle 0 with the rung cards in config order', () => {
    expect(start(deck, 'r1')).toEqual({
      deckId: 'fixture',
      rungId: 'r1',
      cycleIndex: 0,
      queue: FIVE_CARDS,
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

  it('opens cycle 1 with exactly the two failed cards, in fail order', () => {
    const state = applyAll(start(deck, 'r1'), [
      'got-it',
      'not-yet', // c2
      'got-it',
      'not-yet', // c4
      'got-it',
    ]);
    expect(state.cycleIndex).toBe(1);
    expect(state.queue).toEqual(['c2', 'c4']);
    expect(state.position).toBe(0);
    expect(state.failedThisCycle).toEqual([]);
    expect(isComplete(state)).toBe(false);
  });

  it('narrows a cycle of two to the one card still failed', () => {
    const cycleOne = applyAll(start(deck, 'r1'), [
      'got-it',
      'not-yet',
      'got-it',
      'not-yet',
      'got-it',
    ]);
    const cycleTwo = applyAll(cycleOne, ['got-it', 'not-yet']);
    expect(cycleTwo.cycleIndex).toBe(2);
    expect(cycleTwo.queue).toEqual(['c4']);
    expect(isComplete(cycleTwo)).toBe(false);
  });

  it('completes when the last remaining failed card is passed', () => {
    const cycleOne = applyAll(start(deck, 'r1'), [...pass(4), 'not-yet']);
    expect(cycleOne.queue).toEqual(['c5']);
    const done = mark(cycleOne, 'got-it');
    expect(isComplete(done)).toBe(true);
  });

  it('never re-presents a card passed in cycle 0 (I1)', () => {
    // c1 passes on cycle 0; everything else fails for several cycles.
    let state = applyAll(start(deck, 'r1'), ['got-it', ...fail(4)]);
    for (let cycle = 0; cycle < 5; cycle += 1) {
      expect(state.queue).not.toContain('c1');
      expect(state.passedThisRun).toContain('c1');
      state = applyAll(state, fail(state.queue.length));
    }
  });

  it('runs 50 cycles of total failure without erroring or capping', () => {
    let state = start(deck, 'r1');
    for (let cycle = 0; cycle < 50; cycle += 1) {
      state = applyAll(state, fail(5));
      expect(state.queue).toEqual(FIVE_CARDS);
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
  it('I2: each cycle’s queue is the previous cycle’s failedThisCycle, exactly and in order', () => {
    let state = start(deck, 'r1');
    // Fail the back half of every cycle so the boundary is observable twice.
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const size = state.queue.length;
      const passes = Math.floor(size / 2);
      let before = state;
      for (const outcome of [...pass(passes), ...fail(size - passes)]) {
        before = state;
        state = mark(state, outcome);
      }
      const failedAtBoundary = [...before.failedThisCycle, before.queue[before.position]];
      expect(state.queue).toEqual(failedAtBoundary);
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
    const prev = applyAll(start(deck, 'r1'), ['not-yet', ...pass(3)]);
    expect(prev.failedThisCycle).toEqual(['c1']);

    const next = mark(prev, 'got-it');
    expect(next.queue).toEqual(['c1']);
    expect(next.queue).not.toBe(prev.failedThisCycle);
  });

  it('changes nothing when a complete run is marked again', () => {
    const done = applyAll(start(deck, 'r1'), pass(5));
    expect(mark(done, 'not-yet')).toBe(done);
  });
});

describe('selectors', () => {
  it('reports the current card and the cards left in this cycle', () => {
    let state = start(deck, 'r1');
    expect(currentCard(state)).toBe('c1');
    expect(remainingInCycle(state)).toBe(5);

    state = mark(state, 'got-it');
    expect(currentCard(state)).toBe('c2');
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
    const midRun = applyAll(start(deck, 'r1'), ['got-it', 'not-yet']);
    expect(restart(deck, midRun)).toEqual(start(deck, 'r1'));
  });

  it('discards only the run it was given', () => {
    const midRun = applyAll(start(deck, 'r1'), ['got-it', 'not-yet']);
    const before = structuredClone(midRun);
    restart(deck, midRun);
    expect(midRun).toEqual(before);
  });
});
