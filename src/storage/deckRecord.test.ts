import { describe, expect, it } from 'vitest';
import { decks } from '@/decks/registry';
import type { CardId, DeckConfig, DeckId, RungId } from '@/decks/types';
import { mark, start } from '@/run/reducer';
import { shuffle } from '@/run/shuffle';
import type { Outcome, RunState } from '@/run/types';
import {
  readDeckRecord,
  writeDeckRecord,
  type DeckRecord,
  type PersistedRun,
} from '@/storage/deckRecord';
import { deckKey } from '@/storage/keys';
import { migrations, runMigrations } from '@/storage/migrations';
import { readItem, writeItem } from '@/storage/safeStorage';
import { seededRng } from '@/test/rng';

// Each test gets its own deck id, so no test can see another's stored record and
// nothing has to be cleared between them.
let counter = 0;

function fixtureDeck(): DeckConfig {
  counter += 1;
  return {
    id: `fixture-${counter}`,
    title: 'Fixture',
    cards: [
      { id: 'a', front: 'a' },
      { id: 'b', front: 'b' },
      { id: 'c', front: 'c' },
    ],
    rungs: [
      { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
      { id: 'r2', label: '3 words', cardIds: ['a', 'b', 'c'] },
    ],
  };
}

function seed(deck: DeckConfig, raw: unknown): void {
  writeItem(deckKey(deck.id), JSON.stringify(raw));
}

function storedJson(deck: DeckConfig): Record<string, unknown> {
  return JSON.parse(readItem(deckKey(deck.id)) ?? '{}');
}

const run = {
  rungId: 'r2',
  cycleIndex: 1,
  queue: ['b', 'c'],
  position: 1,
  failedThisCycle: ['b'],
  passedThisRun: ['a'],
};

describe('readDeckRecord / writeDeckRecord', () => {
  it('reads a deck with no stored record as not started', () => {
    expect(readDeckRecord(fixtureDeck())).toEqual({ schemaVersion: 1, completedRungIds: [] });
  });

  it('round-trips a record unchanged', () => {
    const deck = fixtureDeck();
    const record: DeckRecord = { schemaVersion: 1, completedRungIds: ['r1'], run };

    writeDeckRecord(deck.id, record);

    expect(readDeckRecord(deck)).toEqual(record);
  });

  it('keeps a field it does not know about across a write (G4/FR-041)', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: [], futureThing: 42 });

    const record = readDeckRecord(deck);
    writeDeckRecord(deck.id, { ...record, completedRungIds: [...record.completedRungIds, 'r1'] });

    expect(storedJson(deck).futureThing).toBe(42);
    expect(readDeckRecord(deck).completedRungIds).toEqual(['r1']);
  });

  it('reads a record missing a later-added field as valid, with defaults (G2/FR-039)', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1 });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: [] });
  });

  it('salvages the fields that typecheck and defaults the rest', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: 'r1', run: 'nonsense' });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: [] });
  });

  it('never discards a record for an older schemaVersion alone (G3/FR-040)', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 0, completedRungIds: ['r1'] });

    expect(readDeckRecord(deck).completedRungIds).toEqual(['r1']);
  });

  it('keeps an unrecognized rung id on write rather than pruning it', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1', 'r99'] });

    const record = readDeckRecord(deck);
    writeDeckRecord(deck.id, record);

    expect(storedJson(deck).completedRungIds).toEqual(['r1', 'r99']);
  });

  it('keeps the rung ids that typecheck when one entry does not, on read and on write', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1', 5] });

    const record = readDeckRecord(deck);
    writeDeckRecord(deck.id, record);

    // Rejecting the whole array would default it to [] and then persist that [],
    // erasing an earned rung from disk over one bad entry.
    expect(record.completedRungIds).toEqual(['r1']);
    expect(storedJson(deck).completedRungIds).toEqual(['r1']);
  });

  it('drops a run whose rung the config no longer has, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, {
      schemaVersion: 1,
      completedRungIds: ['r1'],
      run: { ...run, rungId: 'r-removed' },
    });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  it('drops a run referencing a card the config no longer has, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, {
      schemaVersion: 1,
      completedRungIds: ['r1'],
      run: { ...run, passedThisRun: ['a', 'z-removed'] },
    });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  it('drops a run whose position is outside its queue, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1'], run: { ...run, position: 7 } });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  it('drops a run whose position is fractional, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1'], run: { ...run, position: 1.5 } });

    // In range but not an index: queue[1.5] is undefined, which would resume into a
    // running state with no current card.
    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  it('drops a run whose cycleIndex is negative, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1'], run: { ...run, cycleIndex: -3 } });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  it('drops a run whose cycleIndex is fractional, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1'], run: { ...run, cycleIndex: 1.5 } });

    // Non-negative, so the range check alone admits it. A cycle count only ever
    // starts at 0 and goes up by one, so 1.5 is a value no run can have produced.
    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  // The deck still has card "c", so the every-card-in-the-deck check waves this
  // through. Rung r1 does not list it, and a run for r1 that presents it is the
  // spec's "revised deck configuration" edge case (FR-029).
  it('drops a run holding a card its rung does not list, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, {
      schemaVersion: 1,
      completedRungIds: ['r1'],
      run: {
        rungId: 'r1',
        cycleIndex: 0,
        queue: ['a', 'b', 'c'],
        position: 1,
        failedThisCycle: [],
        passedThisRun: ['a'],
      },
    });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  // The other direction, and the costlier one: finishing this run would append r2
  // to completedRungIds having never presented "c" (FR-029).
  it('drops a run missing a card its rung now lists, keeping completedRungIds', () => {
    const deck = fixtureDeck();
    seed(deck, {
      schemaVersion: 1,
      completedRungIds: ['r1'],
      run: {
        rungId: 'r2',
        cycleIndex: 0,
        queue: ['a', 'b'],
        position: 1,
        failedThisCycle: [],
        passedThisRun: ['a'],
      },
    });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  // The same gap on a later cycle, where the queue being a subset of the rung is
  // normal and only the three arrays together give the game away: "c" is in neither,
  // so this run was started before r2 gained it and completing it would mark r2 done
  // without ever presenting it (FR-029).
  it('drops a later cycle that never knew about a card its rung now lists', () => {
    const deck = fixtureDeck();
    seed(deck, {
      schemaVersion: 1,
      completedRungIds: ['r1'],
      run: {
        rungId: 'r2',
        cycleIndex: 1,
        queue: ['b'],
        position: 0,
        failedThisCycle: [],
        passedThisRun: ['a'],
      },
    });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  // From cycle 1 onward the queue is deliberately only what the last cycle failed,
  // so a `queue` -equals- `rung.cardIds` check would discard every resumable run
  // past the first cycle. The rung is covered by the three arrays together.
  it('keeps a later cycle whose queue is only the cards still failing', () => {
    const deck = fixtureDeck();
    const later = {
      rungId: 'r2',
      cycleIndex: 2,
      queue: ['c'],
      position: 0,
      failedThisCycle: [],
      passedThisRun: ['a', 'b'],
    };
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1'], run: later });

    expect(readDeckRecord(deck).run).toEqual(later);
  });

  // FR-030 / SC-009: "c" is still ahead of the cursor and has already been passed,
  // so resuming this run would present it a second time.
  it('drops a run whose cards still to come include one already passed', () => {
    const deck = fixtureDeck();
    seed(deck, {
      schemaVersion: 1,
      completedRungIds: ['r1'],
      run: {
        rungId: 'r2',
        cycleIndex: 0,
        queue: ['a', 'b', 'c'],
        position: 1,
        failedThisCycle: [],
        passedThisRun: ['a', 'c'],
      },
    });

    expect(readDeckRecord(deck)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  // The overlap that is not a fault: within a cycle `mark` leaves the queue alone
  // and only advances `position`, so every card marked so far this cycle is still
  // in the queue *behind* the cursor and in passedThisRun at the same time. Only
  // the tail from `position` on can re-present anything.
  it('keeps a run whose already-marked cards sit behind the cursor', () => {
    const deck = fixtureDeck();
    const midCycle = {
      rungId: 'r2',
      cycleIndex: 0,
      queue: ['a', 'b', 'c'],
      position: 2,
      failedThisCycle: ['b'],
      passedThisRun: ['a'],
    };
    seed(deck, { schemaVersion: 1, completedRungIds: ['r1'], run: midCycle });

    expect(readDeckRecord(deck).run).toEqual(midCycle);
  });

  it('resets a deck whose stored value is not JSON, leaving other decks readable', () => {
    const corrupt = fixtureDeck();
    const healthy = fixtureDeck();
    writeItem(deckKey(corrupt.id), '{ not json at all');
    writeDeckRecord(healthy.id, { schemaVersion: 1, completedRungIds: ['r1'] });

    expect(readDeckRecord(corrupt)).toEqual({ schemaVersion: 1, completedRungIds: [] });
    expect(readDeckRecord(healthy).completedRungIds).toEqual(['r1']);
  });
});

/**
 * The read path's rung-membership and no-re-presentation conditions are only as
 * good as the states they let through: a condition that is too strict shows up
 * not as a failing unit test but as a learner's run vanishing mid-ladder.
 *
 * So rather than assert the invariants on hand-written fixtures, this drives the
 * real reducer through whole runs of every rung of both shipped decks and asserts
 * that every state it produces still reads back — which is the property the app
 * actually depends on.
 */
function toPersistedRun(state: RunState): PersistedRun {
  const { rungId, cycleIndex, queue, position, failedThisCycle, passedThisRun } = state;
  return { rungId, cycleIndex, queue, position, failedThisCycle, passedThisRun };
}

/** A shipped deck under a key of this test's own, so no test can see another's. */
function asFixture(deck: DeckConfig): DeckConfig {
  counter += 1;
  return { ...deck, id: `${deck.id}-${counter}` };
}

describe('readDeckRecord — every state the reducer can reach', () => {
  it('resumes every state of every rung of both shipped decks', () => {
    let checked = 0;
    let deepestCycle = 0;

    for (const shipped of decks) {
      for (const rung of shipped.rungs) {
        // Three failure rhythms per rung: one that fails every other card, and two
        // sparser ones, so runs of several cycles are reached rather than only the
        // clean first-pass case.
        for (const failEvery of [2, 3, 5]) {
          const deck = asFixture(shipped);
          let state = start(deck, rung.id);
          let step = 0;

          while (state.status === 'running') {
            const run = toPersistedRun(state);
            seed(deck, { schemaVersion: 1, completedRungIds: [], run });

            expect(readDeckRecord(deck).run, `${shipped.id}/${rung.id} step ${step}`).toEqual(run);

            deepestCycle = Math.max(deepestCycle, state.cycleIndex);
            checked += 1;
            const outcome: Outcome = step % failEvery === 0 ? 'not-yet' : 'got-it';
            state = mark(state, outcome);
            step += 1;
          }
        }
      }
    }

    // Guards the walk itself: a reducer or deck change that made these runs finish
    // in one cycle would leave the assertions above green while covering nothing.
    expect(checked).toBeGreaterThan(1000);
    expect(deepestCycle).toBeGreaterThan(1);
  });
});

/**
 * Shuffling adds no field. The order lives in `queue`, which has held the run's
 * card order since 001, so the whole of this feature's storage story is that
 * `queue` now holds a permutation of what it used to hold. `readRun` validates the
 * three arrays against the rung with `sameSet` — membership, never sequence — and a
 * permutation preserves membership exactly, so every existing rule still holds
 * (specs/002-random-run-order/data-model.md § The invariant that makes this free).
 *
 * These tests hold that property rather than restate it, which is what lets the
 * storage layer ship unchanged.
 */

/**
 * A real cycle-0 state part-way through: everything before the cursor has been
 * marked, everything from it on has not. Built from whatever order `queue` arrives
 * in, so the same construction serves a shuffled queue and a config-order one.
 */
function midCycleZero(rungId: RungId, queue: CardId[], position: number): PersistedRun {
  const marked = queue.slice(0, position);
  return {
    rungId,
    cycleIndex: 0,
    queue,
    position,
    failedThisCycle: marked.filter((_, index) => index % 3 === 0),
    passedThisRun: marked.filter((_, index) => index % 3 !== 0),
  };
}

/**
 * What the run route does on resume: a record stores neither `status` nor `deckId`,
 * so both come from outside it. The throw is the point — a run the read path
 * discarded comes back `undefined`, and resuming is then impossible.
 */
function resume(record: DeckRecord, deckId: DeckId): RunState {
  if (record.run === undefined) {
    throw new Error(`Deck "${deckId}" read back with no run to resume`);
  }
  return { ...record.run, deckId, status: 'running' };
}

describe('readDeckRecord / writeDeckRecord — a shuffled order is just data', () => {
  it('round-trips a shuffled queue with its order intact (FR-011, FR-014)', () => {
    const shipped = decks[0];
    const rung = shipped.rungs[shipped.rungs.length - 1];
    const orders = new Set<string>();

    for (const seed of [1, 2, 3, 4, 5]) {
      const deck = asFixture(shipped);
      const queue = shuffle(rung.cardIds, seededRng(seed));
      const run = midCycleZero(rung.id, queue, 7);

      writeDeckRecord(deck.id, { schemaVersion: 1, completedRungIds: [], run });

      // The same cards in the same sequence, not merely the same cards. A queue that
      // came back sorted, or re-derived from the config, would still satisfy the
      // read path's set-equality check and would still be wrong: the learner would
      // be served an order other than the one the run recorded.
      expect(readDeckRecord(deck).run).toEqual(run);
      orders.add(queue.join(','));
    }

    // Guards the assertions above: five identical permutations, or five that all
    // happened to be config order, would leave them green against a read path that
    // ignored order entirely.
    expect(orders.size).toBe(5);
    expect(orders.has(rung.cardIds.join(','))).toBe(false);
  });

  it('reads a pre-feature run back unchanged and resumes it (SC-007, FR-021)', () => {
    const shipped = decks[0];
    const rung = shipped.rungs[2];
    const cleared = shipped.rungs[1].id;
    const deck = asFixture(shipped);
    const position = 4;
    // Exactly what the shipped build left on disk: it queued `rung.cardIds` verbatim
    // and the learner marked four cards "Got it" before stopping. Seeded as raw JSON
    // rather than produced by `start`, because the claim is about data written by the
    // *old* build — the current `start` no longer produces this order.
    const preFeature: PersistedRun = {
      rungId: rung.id,
      cycleIndex: 0,
      queue: [...rung.cardIds],
      position,
      failedThisCycle: [],
      passedThisRun: rung.cardIds.slice(0, position),
    };
    seed(deck, { schemaVersion: 1, completedRungIds: [cleared], run: preFeature });

    const record = readDeckRecord(deck);

    // Not discarded — a dropped run reads as `run: undefined` — not reshuffled into
    // this build's order, and not rewritten by a migration.
    expect(record.run).toEqual(preFeature);
    expect(record.completedRungIds).toEqual([cleared]);

    let state = resume(record, deck.id);
    const presented: CardId[] = [];
    while (state.status === 'running') {
      presented.push(state.queue[state.position]);
      state = mark(state, 'got-it');
    }

    // Resumable, in the sense the learner cares about: the cards still to come
    // arrive in the order the old build recorded, nothing already passed comes back,
    // and the run finishes having presented the whole rung.
    expect(presented).toEqual(rung.cardIds.slice(position));
    expect(state.passedThisRun).toEqual(rung.cardIds);
  });

  it('writes schemaVersion 1, and migrating that record is a no-op (FR-020)', () => {
    const shipped = decks[0];
    const rung = shipped.rungs[shipped.rungs.length - 1];
    const deck = asFixture(shipped);
    const run = midCycleZero(rung.id, shuffle(rung.cardIds, seededRng(9)), 6);

    writeDeckRecord(deck.id, {
      schemaVersion: 1,
      completedRungIds: [shipped.rungs[0].id],
      run,
    });
    const raw = readItem(deckKey(deck.id)) ?? '';

    // The shuffled order occupies `queue`, a field version 1 already had, so there is
    // no shape change for a version bump to signal and nothing for a migration to
    // rewrite (FR-020). Stated as behavior: the record a build with this feature
    // writes carries the same version an older build understands, and the migration
    // path returns it byte-identically rather than touching it.
    expect(storedJson(deck).schemaVersion).toBe(1);
    expect(Object.keys(migrations)).toEqual([]);
    expect(JSON.stringify(runMigrations(storedJson(deck)))).toBe(raw);
  });
});
