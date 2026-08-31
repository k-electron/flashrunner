# Phase 1 Data Model: Deck screen level ladder

**Nothing persisted changes.** No new key, no new field, no `schemaVersion` bump, no
migration. This document exists to say which half of the existing model each
requirement lands in, because getting that wrong is the way this feature would
accidentally become a storage change.

The model itself is defined in `specs/001-deck-runs/data-model.md`. Only the deltas
are recorded here.

## Authored (ships with the app, immutable at runtime)

### `RungConfig` — one level

| Field | Change | Note |
|---|---|---|
| `id` | **none per level** | Stored progress refers to this, so renaming must not touch it (FR-004). One level is removed outright by the FR-020 collapse — see below — but no surviving level's `id` changes. |
| `label` | **value only** | `"5 words"` → `"Level 3"` / `"Full deck"`. Type, role, and every reader unchanged. |
| `cardIds` | **none** | |

`label` is display-only. Nothing derives from it, no validation rule in
`src/decks/validate.ts` inspects it, and it is never written to storage. That is what
makes the rename free of consequence.

**Naming rule** (FR-001, FR-002), applied per deck, in ladder order:

- every level except the highest → `Level N`, `N` counting from 1
- the highest level → `Full deck`, with no number

`N` is the level's position, not its card count, and restarts at 1 in each deck. The
two built-in decks therefore both have a `Level 1`; deck titles already tell them
apart.

| Deck | Levels | Names |
|---|---|---|
| `dolch-prek-5` | 8 (unchanged) | `Level 1`…`Level 7`, `Full deck` (40 cards) |
| `dolch-k-5` | 10 (was 11) | `Level 1`…`Level 9`, `Full deck` (52 cards) |

### The remainder collapse (FR-020, FR-021)

A deck's highest level must not add only a part-step to the level below it. Where it
does, the two are authored as one level holding the whole deck.

`dolch-k-5` was 5, 10 … 45, 50, 52 — a final step of 2 against a regular step of 5. The
`r10` rung (50 cards) is **deleted**; `r11` (52 cards) survives as the highest level and
is labelled `Full deck`. The last step becomes 45 → 52.

`dolch-prek-5` ends 35 → 40, a full step, and is not touched.

This is an edit to the authored data. Nothing collapses anything at runtime — see
research.md D8, including why `r11` is the id that survives.

### `DeckConfig.rungs`

Still ordered smallest → largest. **This is unchanged and must stay unchanged** — it is
the order `isStartable`, `isMastered`, `nextRung`, and validation rules V6/V7 all read.
FR-005 inverts the *display* order only (research.md D3).

## Stored (`localStorage`, per deck)

`DeckRecord` — `schemaVersion`, `completedRungIds`, optional `run` — is **unchanged in
every respect**: shape, meaning, read path, and write path.

Two spec requirements read as if they need storage, and do not:

- **FR-016, "the mark persists through a replay."** `completedRungIds` is append-only:
  `persist()` in `src/routes/Run.tsx` adds an id on completion and never removes one, and
  a replay of an already-completed level appends nothing because the id is already
  present. Permanence is a property the store already has.
- **FR-013, "Start over changes nothing else."** `startOver()` writes the record back
  with `run: undefined` and `completedRungIds` exactly as read. Unchanged from today.

## Derived (computed per render, never stored)

| Derivation | Where | Change |
|---|---|---|
| Is this level startable? | `isStartable` in `src/decks/ladder.ts` | **CHANGED** — "the level below is completed" → "every level below is completed" (FR-006). |
| Has this level ever been completed? | `completedRungIds.includes(rung.id)` | none — now drives the check mark (FR-015) instead of the "Completed" caption. |
| Is the deck mastered? | `isMastered` | none. |
| Highest completed level / next level | `highestCompletedRung`, `nextRung` | none. Both read `completedRungIds` directly and are correct under either unlock rule. |

The first two are now **independent**: a level can be completed and not startable
(FR-007), which is impossible under the old rule and is the whole substance of the
out-of-order case. Any code or test that treats "completed" and "startable" as the same
condition is wrong after this change.

Mastery stays derived rather than stored, as
`specs/001-deck-runs/data-model.md § Mastery is derived, not stored` requires.

## What the collapse does to stored progress

Removing `dolch-k-5`'s `r10` is a deck config revision, not a change to the shape of
anything stored. The existing model already covers every case, with no new code:

| Stored state | What happens | Where that is already handled |
|---|---|---|
| `r10` in `completedRungIds` | Kept in the array, matches no level, counts toward nothing | `readRungIds` keeps unrecognized ids; every ladder derivation matches against `deck.rungs` |
| An unfinished run on `r10` | The run is dropped; `completedRungIds` survives | `readRun` returns `undefined` when `rungId` matches no rung |
| `r11` completed (deck mastered) | Still mastered — `r11` is still the highest level | `isMastered` reads the top of `deck.rungs` |
| `r1`–`r10` completed | `r1`–`r9` are all complete, so `Full deck` is startable | FR-006, unchanged by the collapse |

**No `schemaVersion` bump and no migration.** `specs/001-deck-runs` FR-029, FR-040, and
FR-041 already specify this exact case.

## Superseded

`specs/001-deck-runs` FR-016 — "completed rungs stay startable forever" — no longer
holds unconditionally. It holds for every level earned in order, which is every level
reached without editing the URL. See research.md D2; the doc comments in
`src/decks/ladder.ts` that state the old reasoning are updated in the same commit.
