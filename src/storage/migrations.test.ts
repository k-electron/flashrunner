import { describe, expect, it } from 'vitest';
import { migrations, runMigrations } from '@/storage/migrations';

// The shipped registry is empty — version 1 is the baseline — so every test that
// needs a real bump injects its own registry and target version. That injection is
// the only reason `runMigrations` takes those parameters: the migration path has to
// be exercised before the first real migration exists, not after it lands
// (constitution Principle IV, specs/001-deck-runs/contracts/storage.md § Migrations).
type Migration = (record: Record<string, unknown>) => Record<string, unknown>;

/**
 * A registry that refuses to be consulted more times than it has migrations. This,
 * not the test timeout below it, is what makes an unbounded loop fail in
 * milliseconds: the loop is synchronous, so it blocks the worker and vitest never
 * gets a turn to time it out. Measured against the unbounded version, the run
 * hangs until CI kills it.
 */
function boundedRegistry(entries: Record<number, Migration>): Record<number, Migration> {
  const limit = Object.keys(entries).length;
  let lookups = 0;
  return new Proxy(entries, {
    get(target, key, receiver) {
      lookups += 1;
      if (lookups > limit) {
        throw new Error(`registry consulted ${lookups} times for ${limit} migration(s)`);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

function bumpTo(version: number, trail: number[]): Migration {
  return (record) => {
    trail.push(version);
    return { ...record, schemaVersion: version, [`from${version}`]: true };
  };
}

describe('runMigrations', () => {
  it('leaves a baseline record untouched, because the shipped registry is empty', () => {
    const record = { schemaVersion: 1, completedRungIds: ['r1'] };

    expect(Object.keys(migrations)).toHaveLength(0);
    expect(runMigrations(record)).toEqual({ schemaVersion: 1, completedRungIds: ['r1'] });
  });

  it('applies a migration to a record written by the previous version', () => {
    const trail: number[] = [];

    const migrated = runMigrations(
      { schemaVersion: 1, completedRungIds: ['r1'] },
      { 2: bumpTo(2, trail) },
      2,
    );

    expect(trail).toEqual([2]);
    expect(migrated).toEqual({ schemaVersion: 2, completedRungIds: ['r1'], from2: true });
  });

  it('applies a two-step bump in ascending order', () => {
    const trail: number[] = [];
    const registry: Record<number, Migration> = {};
    // Registered newest-first, since the order they are applied in must come from
    // the version numbers rather than from how the registry was built up.
    registry[3] = bumpTo(3, trail);
    registry[2] = bumpTo(2, trail);

    const migrated = runMigrations({ schemaVersion: 1 }, registry, 3);

    expect(trail).toEqual([2, 3]);
    expect(migrated).toEqual({ schemaVersion: 3, from2: true, from3: true });
  });

  it('returns a record from a newer build unchanged rather than re-migrating it', () => {
    const trail: number[] = [];

    const migrated = runMigrations(
      { schemaVersion: 7, completedRungIds: ['r1'] },
      { 2: bumpTo(2, trail) },
      2,
    );

    expect(trail).toEqual([]);
    expect(migrated).toEqual({ schemaVersion: 7, completedRungIds: ['r1'] });
  });

  it('treats a record with no schemaVersion as the baseline, not as already current', () => {
    const trail: number[] = [];

    const migrated = runMigrations({ completedRungIds: ['r1'] }, { 2: bumpTo(2, trail) }, 2);

    // Assuming "already current" would skip every migration the moment CURRENT
    // moves past the baseline, silently leaving old records unconverted.
    expect(trail).toEqual([2]);
    expect(migrated).toEqual({ schemaVersion: 2, completedRungIds: ['r1'], from2: true });
  });

  it('returns a value that is not an object unchanged', () => {
    expect(runMigrations(null)).toBeNull();
    expect(runMigrations(undefined)).toBeUndefined();
    expect(runMigrations('not a record')).toBe('not a record');
    expect(runMigrations(7)).toBe(7);
    expect(runMigrations(['r1', 'r2'])).toEqual(['r1', 'r2']);
  });

  it('returns promptly on a poisoned schemaVersion instead of looping forever', () => {
    // `-1e999` parses to -Infinity, and `-Infinity + 1` is still -Infinity, so a
    // loop that counts up from the stored version never terminates. Boot reads a
    // record per deck, and Principle II's "never a blank screen on boot" has no
    // exception for a corrupt value.
    const poisoned = JSON.parse('{"schemaVersion":-1e999,"completedRungIds":["r1"]}') as unknown;
    const trail: number[] = [];

    // The shipped registry, empty as it ships, with a tripwire on it.
    expect(runMigrations(poisoned, boundedRegistry({}))).toEqual({
      schemaVersion: -Infinity,
      completedRungIds: ['r1'],
    });
    // Bounded by the registry, so each migration runs once rather than endlessly.
    expect(runMigrations(poisoned, boundedRegistry({ 2: bumpTo(2, trail) }), 2)).toEqual({
      schemaVersion: 2,
      completedRungIds: ['r1'],
      from2: true,
    });
    expect(trail).toEqual([2]);
  }, 250);
});
