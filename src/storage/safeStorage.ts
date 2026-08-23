// The only module in the project permitted to touch `localStorage`
// (constitution Principle II). Storage is treated as hostile: every row of
// specs/001-deck-runs/contracts/storage.md § Hostile storage degrades to a
// working app, and nothing here throws out to a component.

/**
 * Mirrors every write, so a session whose `localStorage` is missing, blocked, or
 * full still behaves consistently for as long as the tab is open.
 */
const memory = new Map<string, string>();

export type WriteResult = { ok: true } | { ok: false; reason: 'quota-exceeded' | 'unavailable' };

/**
 * Reading the property itself throws when cookies are blocked, which is why this
 * is guarded rather than a plain reference.
 */
function backingStore(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The mirror is consulted first, not last. It only ever holds this session's own
 * writes, so it is never older than the backing store: after a write that landed
 * the two agree, and after one that did not — a full store still holding the
 * previous value — it holds the newer of the two. Reading the store first would
 * hand back the value the learner just moved past.
 */
export function readItem(key: string): string | null {
  const mirrored = memory.get(key);
  if (mirrored !== undefined) {
    return mirrored;
  }
  const storage = backingStore();
  if (storage === undefined) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): WriteResult {
  memory.set(key, value);
  const storage = backingStore();
  if (storage === undefined) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaExceeded(error) ? 'quota-exceeded' : 'unavailable' };
  }
}

/** A full disk is a normal condition, not a bug — it is named and surfaced. */
function isQuotaExceeded(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'QuotaExceededError'
  );
}
