# Contract: localStorage Records

**Serves**: FR-019, FR-021, FR-022, FR-028, FR-036, FR-038–FR-042, SC-006, SC-011, SC-012, SC-013

Governed by constitution Principle II. One module, `src/storage/`, is the only code in the
project permitted to call `localStorage` directly.

---

## Keys

| Key | Holds |
|---|---|
| `flashrunner:deck:<deckId>` | one deck's earned progress and its unfinished run |

One record per deck (FR-036). No global blob, no index key — deck ids come from the registry, so
discovery is a lookup per known deck rather than a scan. A record for a deck that no longer
exists is simply never read (FR-022).

## Record

```jsonc
{
  "schemaVersion": 1,
  "completedRungIds": ["r1", "r2"],
  "run": {                          // present only while a run is unfinished
    "rungId": "r3",
    "cycleIndex": 1,
    "queue": ["go", "my", "can"],
    "position": 1,
    "failedThisCycle": ["go"],
    "passedThisRun": ["a", "i", "the", "and", "to", "is", "it", "in", "up", "me", "we", "see"]
  }
}
```

Mastery is **not** a stored field — it is `completedRungIds.includes(lastRung.id)`. See
[data-model.md](../data-model.md#mastery-is-derived-not-stored).

## Write points

The record is written after **every** card is marked (FR-028), and on start, restart, and
completion. Writes are small — a few hundred bytes — and synchronous, so an interruption at any
moment leaves at most one card's worth of position unrecorded (SC-009).

On completion: `run` is deleted and `rungId` is appended to `completedRungIds` if not already
there. Repeating a completed rung therefore adds nothing and cannot reduce progress (FR-018).

---

## Growth rules

These four are what make the format additive rather than versioned-in-lockstep.

**G1 — New fields are additive.** Adding a field never invalidates a record written before it
existed (FR-038).

**G2 — Absent means default, not invalid.** Reading fills missing fields from defaults:
`completedRungIds → []`, `run → undefined`. A record missing a field added after it was written
is a valid record (FR-039).

**G3 — Never discard on age alone.** An older `schemaVersion` is a reason to migrate, never a
reason to delete (FR-040).

**G4 — Unknown fields survive a write.** Read the whole parsed object, overlay the fields this
version knows, write the whole object back (FR-041):

```ts
const stored = parse(raw) ?? {};
const next = { ...stored, schemaVersion: 1, completedRungIds, run };
write(key, next);
```

A version that predates a field must not destroy it — otherwise a learner who opens an older
build once loses data written by a newer one.

**Consequence (SC-012):** adding a field needs no migration and no `schemaVersion` bump. A bump
is required only when the *meaning* of an existing field changes, and then Principle II requires
a migration plus a test starting from real prior-version data.

---

## Limits of the growth rules

Both of these follow from the format above rather than contradicting it. They are written down
because neither is visible from G1–G4 alone.

**G4 is top-level only.** `run` is overwritten whole on every write, never merged, so an
unrecognised field nested *inside* `run` does not survive. A newer build's `run.startedAt` is gone
the moment an older build marks a single card. Only unknown fields sitting alongside
`schemaVersion` are carried across.

A blanket nested merge would be a worse rule, not a safer one. A run is a unit: it is deleted on
completion, and dropped whole when it references a rung or card the config no longer has. Merging
into whatever `run` was stored would let a fresh run inherit the dropped run's keys — a stale
`position` or `failedThisCycle` pointing into a queue that no longer exists, which is a worse
outcome than a lost `startedAt`. A field that has to survive an older build therefore belongs at
the top level, where G4 already covers it.

**A record from a newer build gets stamped as older.** G3 and G4 address records written by
*older* builds. Read a `schemaVersion: 7` record with a build whose current version is 1 and its
unknown fields do survive (G4) — but the write stamps `schemaVersion: 1`, because a build knows
only its own version and has no way to tell a downgrade from corruption. The record is now
labelled older than it is, so the next open in the newer build re-runs every migration from 1 to 7
over data that has already been through them.

This is a known limitation of carrying a single version stamp, and it is accepted rather than
solved: detecting it needs a second "written by" field plus a rule for what to do when it is
ahead, which is machinery for a case a single-device localStorage app reaches only by rolling a
deployment back. What it costs instead is a standing requirement on future work: **every migration
MUST be idempotent** — applying it twice to the same record must leave the same result as applying
it once — and the Principle II test that starts from real prior-version data must assert that.

---

## Hostile storage

Principle II: storage is never assumed to work. Every case below degrades to a working app on
defaults — never a blank screen, never a thrown error reaching the user.

| Condition | Behaviour |
|---|---|
| `localStorage` absent or throws on access (private mode, blocked cookies) | App runs in memory for the session. Progress is not saved. |
| Key not present | Deck reads as not started (FR-021) |
| Value is not valid JSON | That deck's record resets to defaults. Other decks are unaffected — the reason records are per-deck. |
| Value is JSON but the wrong shape | Salvage known fields that typecheck, default the rest (G2) |
| `QuotaExceededError` on write | Caught explicitly and surfaced. The run continues in memory; the learner is told progress is not being saved rather than being silently lied to. |
| `run` references a rung or card the config no longer has | Drop `run` only. `completedRungIds` survives. |

## Migrations

`src/storage/migrations.ts` holds an ordered registry keyed by version. Version 1 is the
baseline, so the registry ships empty — its purpose is that the first real bump has an obvious
home and an established test pattern, not to migrate anything today.

Read path: parse → if `schemaVersion` < current, run each migration in order → validate → use.
The loop walks the registry rather than counting up from the stored version, so a corrupt
`schemaVersion` — `-Infinity`, or an absurd negative — costs one pass over the registry
instead of hanging the boot path.

Per Principle II, any future bump ships with a test that starts from a real record written by the
previous version. That migration must also be idempotent, for the reason given under
[Limits of the growth rules](#limits-of-the-growth-rules).
