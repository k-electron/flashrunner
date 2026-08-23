// Version 1 is the baseline, so the registry below ships empty. Its purpose today
// is that the first real bump has an obvious home and an established test pattern
// (specs/001-deck-runs/contracts/storage.md § Migrations).

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * What a record written before `schemaVersion` existed is assumed to be. The
 * conservative assumption is the oldest shape, not the newest: guessing "already
 * current" would silently skip every migration the moment CURRENT moves past 1.
 */
const BASELINE_SCHEMA_VERSION = 1;

type Migration = (record: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the schema version each migration produces, applied in ascending order. */
export const migrations: Record<number, Migration> = {};

/**
 * The registry and the target version are parameters so the empty-today registry
 * can still be tested against a real bump. Call sites pass neither.
 *
 * The loop walks the registry rather than counting up from the record's version,
 * so it is bounded by how many migrations exist — a stored `schemaVersion` of
 * `-Infinity`, or any absurd negative, costs one pass over the registry instead of
 * spinning forever on the boot path (constitution Principle II).
 */
export function runMigrations(
  parsed: unknown,
  registry: Record<number, Migration> = migrations,
  current: number = CURRENT_SCHEMA_VERSION,
): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed;
  }
  let record = parsed as Record<string, unknown>;
  const from =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : BASELINE_SCHEMA_VERSION;
  const applicable = Object.keys(registry)
    .map(Number)
    .filter((version) => version > from && version <= current)
    .sort((a, b) => a - b);
  for (const version of applicable) {
    record = registry[version](record);
  }
  return record;
}
