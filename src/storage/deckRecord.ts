import type { CardId, DeckConfig, DeckId, RungId } from '@/decks/types';
import { deckKey } from '@/storage/keys';
import { CURRENT_SCHEMA_VERSION, runMigrations } from '@/storage/migrations';
import { readItem, writeItem, type WriteResult } from '@/storage/safeStorage';

/**
 * The unfinished run, as persisted. `status` is not stored because a persisted
 * run is always in progress, and `deckId` is not stored because it is the key.
 */
export type PersistedRun = {
  rungId: RungId;
  cycleIndex: number;
  queue: CardId[];
  position: number;
  failedThisCycle: CardId[];
  passedThisRun: CardId[];
};

export type DeckRecord = {
  schemaVersion: number;
  completedRungIds: RungId[];
  run?: PersistedRun;
};

/**
 * Never rejects a record. Absent, corrupt, and wrong-shaped values all degrade to
 * defaults (G2), and a record is never discarded for age alone (G3).
 */
export function readDeckRecord(deck: DeckConfig): DeckRecord {
  const migrated = runMigrations(parseRaw(readItem(deckKey(deck.id))));
  if (!isRecord(migrated)) {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, completedRungIds: [] };
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    // Unrecognized rung ids are kept — they may belong to a config this build has
    // not caught up to yet (FR-040, FR-041).
    completedRungIds: readRungIds(migrated.completedRungIds),
    run: readRun(migrated.run, deck),
  };
}

/**
 * Read-whole, overlay-known, write-whole: a field this version does not know about
 * survives verbatim (G4/FR-041).
 */
export function writeDeckRecord(deckId: DeckId, record: DeckRecord): WriteResult {
  const key = deckKey(deckId);
  const stored = parseRaw(readItem(key));
  const next = {
    ...(isRecord(stored) ? stored : {}),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    completedRungIds: record.completedRungIds,
    run: record.run,
  };
  return writeItem(key, JSON.stringify(next));
}

function parseRaw(raw: string | null): unknown {
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Salvages, where `readStringArray` rejects. One non-string entry must not cost the
 * learner every rung they earned: the read defaults to `[]` and the very next write
 * persists that `[]` over the stored array, so rejecting the whole array here
 * deletes the good entries from disk permanently. The contract's rule for a
 * wrong-shaped value is to salvage the fields that typecheck (G2).
 *
 * Strictness stays inside `readRun`, where a queue that is only partly valid is
 * genuinely not resumable and dropping the run is the correct answer.
 */
function readRungIds(value: unknown): RungId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is RungId => typeof entry === 'string');
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return undefined;
  }
  return value as string[];
}

/**
 * Drops the run — and only the run — when the deck config has moved out from under
 * it, or when the stored shape does not typecheck. `completedRungIds` survives.
 */
function readRun(value: unknown, deck: DeckConfig): PersistedRun | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { rungId, cycleIndex, position } = value;
  const queue = readStringArray(value.queue);
  const failedThisCycle = readStringArray(value.failedThisCycle);
  const passedThisRun = readStringArray(value.passedThisRun);
  if (
    typeof rungId !== 'string' ||
    typeof cycleIndex !== 'number' ||
    typeof position !== 'number'
  ) {
    return undefined;
  }
  if (queue === undefined || failedThisCycle === undefined || passedThisRun === undefined) {
    return undefined;
  }
  if (!deck.rungs.some((rung) => rung.id === rungId)) {
    return undefined;
  }
  const cardIds = new Set(deck.cards.map((card) => card.id));
  const referenced = [...queue, ...failedThisCycle, ...passedThisRun];
  if (referenced.some((cardId) => !cardIds.has(cardId))) {
    return undefined;
  }
  // `position` indexes the queue and `cycleIndex` counts cycles, so both are
  // integers. A range check alone admits 1.5, and `queue[1.5]` is `undefined` — a
  // run that resumes into a `running` state with no current card.
  if (!Number.isInteger(cycleIndex) || cycleIndex < 0) {
    return undefined;
  }
  if (
    queue.length === 0 ||
    !Number.isInteger(position) ||
    position < 0 ||
    position >= queue.length
  ) {
    return undefined;
  }
  return { rungId, cycleIndex, queue, position, failedThisCycle, passedThisRun };
}
