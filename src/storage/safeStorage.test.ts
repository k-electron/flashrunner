import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deckKey } from '@/storage/keys';
import { readItem, writeItem } from '@/storage/safeStorage';

// This is the one file that stands the global up and knocks it down, because the
// conditions under test — storage working, absent, throwing on access, or full —
// only exist at that level. It never reads or writes through the global itself;
// every assertion goes through safeStorage.
//
// The global is installed rather than assumed: under Node 26 the runtime's own
// `localStorage` getter shadows jsdom's and yields `undefined` unless the process
// was started with `--localstorage-file`, so there is no ambient store to lean on.
const realLocalStorage: unknown = globalThis.localStorage;

function replaceGlobalStorage(get: () => unknown): void {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get });
}

function workingStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/**
 * A full store, as a real one behaves: it refuses writes but reads back everything
 * already in it. A double whose `getItem` always returns `null` would hide the case
 * where the store still holds an older value than the one this session just wrote.
 */
function fullStorage(seeded: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const entries = new Map<string, string>(Object.entries(seeded));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError');
    },
  };
}

beforeEach(() => {
  const storage = workingStorage();
  replaceGlobalStorage(() => storage);
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: realLocalStorage,
  });
});

describe('safeStorage', () => {
  it('puts the value in the backing store, not only in the memory mirror', () => {
    const storage = workingStorage();
    replaceGlobalStorage(() => storage);
    const key = deckKey('write-through');

    expect(writeItem(key, 'kept')).toEqual({ ok: true });

    // Asserted on the double rather than through `readItem`, which the mirror
    // answers before the store is ever consulted — so a read-back assertion here
    // passes just as well for a write that stored the wrong value or none at all.
    expect(storage.getItem(key)).toBe('kept');
  });

  it('serves a read from the backing store once the mirror no longer holds the key', async () => {
    const storage = workingStorage();
    replaceGlobalStorage(() => storage);
    const key = deckKey('store-served-read');

    // Re-importing the module is what clears the mirror: it is module-private, so
    // this is the only way to get past `readItem`'s mirror-first short-circuit from
    // outside. The write and the read run on separate instances, leaving the
    // backing store as the sole route the value can take between them.
    vi.resetModules();
    const writer = await import('@/storage/safeStorage');
    expect(writer.writeItem(key, 'landed')).toEqual({ ok: true });

    vi.resetModules();
    const reader = await import('@/storage/safeStorage');
    expect(reader.readItem(key)).toBe('landed');
  });

  it('reports a key that was never written as absent', () => {
    expect(readItem(deckKey('never-written'))).toBeNull();
  });

  it('degrades to memory when localStorage is absent, and the session keeps working', () => {
    replaceGlobalStorage(() => undefined);
    const key = deckKey('absent');

    expect(writeItem(key, 'in-memory')).toEqual({ ok: false, reason: 'unavailable' });
    expect(readItem(key)).toBe('in-memory');
  });

  it('degrades to memory when reading localStorage itself throws', () => {
    replaceGlobalStorage(() => {
      throw new Error('cookies are blocked');
    });
    const key = deckKey('blocked');

    expect(() => writeItem(key, 'in-memory')).not.toThrow();
    expect(readItem(key)).toBe('in-memory');
  });

  it('catches and surfaces QuotaExceededError instead of throwing at the caller', () => {
    const storage = fullStorage();
    replaceGlobalStorage(() => storage);
    const key = deckKey('full');

    expect(writeItem(key, 'not-saved')).toEqual({ ok: false, reason: 'quota-exceeded' });
    // The run continues in memory rather than the learner being silently lied to.
    expect(readItem(key)).toBe('not-saved');
  });

  it('reads back the newest value when a quota-failed write left it only in memory', () => {
    const key = deckKey('full-with-stale-value');
    // The store is full *and* already holds an older value under this key — the
    // ordinary case, since a store only fills up after it has been written to.
    const storage = fullStorage({ [key]: 'OLD' });
    replaceGlobalStorage(() => storage);

    expect(writeItem(key, 'NEW')).toEqual({ ok: false, reason: 'quota-exceeded' });
    // This session's own last write wins. Returning 'OLD' would hand the learner a
    // rewound run and make the memory mirror dead weight in the case it exists for.
    expect(readItem(key)).toBe('NEW');
  });
});
