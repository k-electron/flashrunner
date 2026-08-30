import { describe, expect, it } from 'vitest';
import { highestCompletedRung, isMastered, isStartable, nextRung } from '@/decks/ladder';
import type { DeckConfig } from '@/decks/types';

// Four rungs is the smallest ladder that can tell the two candidate unlocking
// rules apart: with only r1 completed, "immediate predecessor" opens r2 and
// leaves r3 shut, while "above the highest completed rung" would shut r2 too.
const deck: DeckConfig = {
  id: 'fixture',
  title: 'Fixture',
  cards: [
    { id: 'a', front: 'a' },
    { id: 'b', front: 'b' },
    { id: 'c', front: 'c' },
    { id: 'd', front: 'd' },
  ],
  rungs: [
    { id: 'r1', label: '1 word', cardIds: ['a'] },
    { id: 'r2', label: '2 words', cardIds: ['a', 'b'] },
    { id: 'r3', label: '3 words', cardIds: ['a', 'b', 'c'] },
    { id: 'r4', label: '4 words', cardIds: ['a', 'b', 'c', 'd'] },
  ],
};

describe('isStartable', () => {
  it('always offers the smallest rung, with no progress at all', () => {
    expect(isStartable(deck, [], 0)).toBe(true);
  });

  it('shuts every rung above the smallest when nothing has been completed', () => {
    expect(isStartable(deck, [], 1)).toBe(false);
    expect(isStartable(deck, [], 2)).toBe(false);
    expect(isStartable(deck, [], 3)).toBe(false);
  });

  it('opens the rung directly above a completed one and no further (FR-015)', () => {
    // The case a plausible-but-wrong "above the highest completed rung" rule
    // fails: it would lock r2 the moment r1 was completed.
    expect(isStartable(deck, ['r1'], 1)).toBe(true);
    expect(isStartable(deck, ['r1'], 2)).toBe(false);
    expect(isStartable(deck, ['r1'], 3)).toBe(false);
  });

  it('opens each next rung in turn as the ladder is climbed', () => {
    expect(isStartable(deck, ['r1', 'r2'], 2)).toBe(true);
    expect(isStartable(deck, ['r1', 'r2'], 3)).toBe(false);
    expect(isStartable(deck, ['r1', 'r2', 'r3'], 3)).toBe(true);
  });

  // All four of these seed r3 alone: finished out of order, with r1 and r2 still
  // unfinished. That is the only shape in which the two candidate rules disagree.
  it('opens nothing above a level completed out of order (FR-006)', () => {
    // Not startable even though its immediate predecessor r3 is done — the run
    // below it is broken, so the ladder would show a gap.
    expect(isStartable(deck, ['r3'], 3)).toBe(false);
  });

  it('shuts a level completed out of order until the run below it is unbroken (FR-007)', () => {
    expect(isStartable(deck, ['r3'], 2)).toBe(false);
  });

  it('does not treat out-of-order progress as reaching the level below it', () => {
    // Tempting to read r2 as "next"; it is not. r1 is unfinished and the rule has
    // no clause that says otherwise.
    expect(isStartable(deck, ['r3'], 1)).toBe(false);
  });

  it('still opens the next level when the run below it is unbroken', () => {
    // Without this the suite would pass for an isStartable that locks everything
    // above the smallest level.
    expect(isStartable(deck, ['r1', 'r2', 'r3'], 3)).toBe(true);
  });

  // Narrower than it was: 001-deck-runs FR-016 promised a completed rung stayed
  // startable unconditionally. It stays startable when it was completed *in
  // order*, which is every rung reachable from the deck screen. 008 FR-007
  // supersedes the rest.
  it('keeps rungs completed in order startable forever (001 FR-016, 008 FR-007)', () => {
    const completed = ['r1', 'r2', 'r3', 'r4'];

    expect(isStartable(deck, completed, 0)).toBe(true);
    expect(isStartable(deck, completed, 1)).toBe(true);
    expect(isStartable(deck, completed, 2)).toBe(true);
    expect(isStartable(deck, completed, 3)).toBe(true);
  });

  it('does not depend on the order ids were stored in', () => {
    expect(isStartable(deck, ['r2', 'r1'], 2)).toBe(true);
  });

  it('unlocks nothing on an id the deck does not have', () => {
    expect(isStartable(deck, ['r99'], 1)).toBe(false);
    expect(isStartable(deck, ['r1', 'r99'], 2)).toBe(false);
  });

  it('reports false rather than throwing for an index outside the ladder', () => {
    expect(isStartable(deck, ['r1'], -1)).toBe(false);
    expect(isStartable(deck, ['r1'], 4)).toBe(false);
  });
});

describe('repeating a completed rung', () => {
  it('changes no derivation, so progress cannot go backwards (FR-018)', () => {
    // Completion appends only what is missing, so a repeat leaves the list as it
    // was; even a duplicate id would derive identically.
    const before = ['r1', 'r2'];
    const after = ['r1', 'r2', 'r1'];

    expect(isStartable(deck, after, 1)).toBe(isStartable(deck, before, 1));
    expect(isStartable(deck, after, 2)).toBe(isStartable(deck, before, 2));
    expect(isMastered(deck, after)).toBe(isMastered(deck, before));
    expect(highestCompletedRung(deck, after)).toEqual(highestCompletedRung(deck, before));
  });
});

describe('isMastered', () => {
  it('is false with no progress', () => {
    expect(isMastered(deck, [])).toBe(false);
  });

  it('stays false until the top rung itself is completed', () => {
    expect(isMastered(deck, ['r1', 'r2', 'r3'])).toBe(false);
  });

  it('flips on the top rung id (FR-017)', () => {
    expect(isMastered(deck, ['r1', 'r2', 'r3', 'r4'])).toBe(true);
  });

  it('is derived from the top rung alone, not from how many rungs are listed', () => {
    expect(isMastered(deck, ['r4'])).toBe(true);
  });

  it('is not fooled by an id the deck does not have', () => {
    expect(isMastered(deck, ['r99'])).toBe(false);
  });
});

describe('highestCompletedRung', () => {
  it('is undefined for a deck that has never been run', () => {
    expect(highestCompletedRung(deck, [])).toBeUndefined();
  });

  it('returns the furthest rung up the ladder, whatever order the ids are in', () => {
    expect(highestCompletedRung(deck, ['r3', 'r1', 'r2'])?.id).toBe('r3');
  });

  it('ignores ids the deck does not have', () => {
    expect(highestCompletedRung(deck, ['r99'])).toBeUndefined();
    expect(highestCompletedRung(deck, ['r1', 'r99'])?.id).toBe('r1');
  });
});

describe('nextRung', () => {
  it('returns the rung one step up', () => {
    expect(nextRung(deck, 'r1')?.id).toBe('r2');
    expect(nextRung(deck, 'r3')?.id).toBe('r4');
  });

  it('returns undefined at the top of the ladder', () => {
    expect(nextRung(deck, 'r4')).toBeUndefined();
  });

  it('returns undefined for a rung the deck does not have', () => {
    expect(nextRung(deck, 'r99')).toBeUndefined();
  });
});
