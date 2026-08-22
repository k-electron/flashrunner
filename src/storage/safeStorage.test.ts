import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  it('round-trips a value when storage works', () => {
    const key = deckKey('works');

    expect(writeItem(key, 'kept')).toEqual({ ok: true });
    expect(readItem(key)).toBe('kept');
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
    replaceGlobalStorage(() => ({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    }));
    const key = deckKey('full');

    expect(writeItem(key, 'not-saved')).toEqual({ ok: false, reason: 'quota-exceeded' });
    // The run continues in memory rather than the learner being silently lied to.
    expect(readItem(key)).toBe('not-saved');
  });

  it('keeps one deck readable when another deck holds a corrupt value', () => {
    writeItem(deckKey('corrupt'), '{ not json at all');
    writeItem(deckKey('healthy'), '{"schemaVersion":1}');

    expect(readItem(deckKey('corrupt'))).toBe('{ not json at all');
    expect(readItem(deckKey('healthy'))).toBe('{"schemaVersion":1}');
  });
});
