import { describe, expect, it } from 'vitest';
import type { DeckConfig } from '@/decks/types';
import { readDeckRecord, writeDeckRecord, type DeckRecord } from '@/storage/deckRecord';
import { deckKey } from '@/storage/keys';
import { readItem, writeItem } from '@/storage/safeStorage';

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

  it('resets a deck whose stored value is not JSON, leaving other decks readable', () => {
    const corrupt = fixtureDeck();
    const healthy = fixtureDeck();
    writeItem(deckKey(corrupt.id), '{ not json at all');
    writeDeckRecord(healthy.id, { schemaVersion: 1, completedRungIds: ['r1'] });

    expect(readDeckRecord(corrupt)).toEqual({ schemaVersion: 1, completedRungIds: [] });
    expect(readDeckRecord(healthy).completedRungIds).toEqual(['r1']);
  });
});
