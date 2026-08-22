// Version 1 is the baseline, so the registry below ships empty. Its purpose today
// is that the first real bump has an obvious home and an established test pattern
// (specs/001-deck-runs/contracts/storage.md § Migrations).

export const CURRENT_SCHEMA_VERSION = 1;

type Migration = (record: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the schema version each migration produces, applied in ascending order. */
export const migrations: Record<number, Migration> = {};

export function runMigrations(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed;
  }
  let record = parsed as Record<string, unknown>;
  const from =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : CURRENT_SCHEMA_VERSION;
  for (let version = from + 1; version <= CURRENT_SCHEMA_VERSION; version++) {
    const migration = migrations[version];
    if (migration !== undefined) {
      record = migration(record);
    }
  }
  return record;
}
