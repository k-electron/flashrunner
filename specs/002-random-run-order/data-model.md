# Phase 1 Data Model: Random Run Order

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

The short version: **no persisted shape changes**. One type is added, one field changes meaning, and
nothing on disk moves. This document exists mostly to show why that is true rather than hoped for.

---

## What is added

```ts
/** A source of randomness: a number in [0, 1). `Math.random` satisfies it. */
export type Rng = () => number;
```

In `src/run/types.ts`, beside `Outcome` and `RunState`.

---

## What changes meaning

`RunState.queue` is unchanged in type, position, and persistence. Its **contents** change:

| | Before | After |
|---|---|---|
| Cycle 0 | `rung.cardIds`, config order | a shuffle of `rung.cardIds` |
| Cycle *n+1* | `failedThisCycle`, fail order | a shuffle of `failedThisCycle` |

`RunState` gains no field. `PersistedRun` — `Omit<RunState, 'status' \| 'deckId'>` — therefore gains
none either.

```ts
type RunState = {
  deckId: DeckId;
  rungId: RungId;
  cycleIndex: number;
  queue: CardId[];            // now shuffled; still the run's presentation order
  position: number;
  failedThisCycle: CardId[];  // still fail order — it is a record, not a queue
  passedThisRun: CardId[];
  status: 'running' | 'complete';
};
```

`failedThisCycle` deliberately keeps fail order. It is the accumulator, not the thing presented; the
shuffle happens when it *becomes* the next queue. Shuffling it on write as well would randomize
twice for no gain and make FR-003's test harder to state.

---

## The invariant that makes this free

`readRun` (`src/storage/deckRecord.ts`) validates a stored run against the deck with:

```ts
sameSet([...queue, ...failedThisCycle, ...passedThisRun], rung.cardIds)
```

Set equality. Not order, not prefix. A shuffle is a permutation, and a permutation preserves the
set exactly. So every existing validation rule holds unchanged:

| Check in `readRun` | Survives shuffling? | Why |
|---|---|---|
| `sameSet(referenced, rung.cardIds)` | Yes | Permutation preserves membership. |
| every referenced id exists in `deck.cards` | Yes | Same ids, reordered. |
| `0 ≤ position < queue.length`, integer | Yes | Length is unchanged by permutation. |
| `queue.slice(position)` disjoint from `passedThisRun` | Yes | Holds per cycle regardless of order: within a cycle the cards ahead of the cursor have not been marked yet. |
| `queue.length > 0` | Yes | Permutation preserves length. |

**Consequences, all of them requirements:**

- **FR-020** — no new field, so `schemaVersion` stays at 1 and `migrations` stays empty.
- **FR-021** — a run written by the current build has `queue` in config order. Afterwards, that is
  simply one permutation among many. It validates, resumes, and finishes normally. No detection, no
  branch, no upgrade path.
- **FR-022** — `completedRungIds` is never touched by any of this.

---

## Where the shuffle happens

Two places, both already the moment a cycle begins.

**`start(deck, rungId, rng)`** — cycle 0:

```
queue = shuffle(rung.cardIds, rng)     # was: [...rung.cardIds]
```

**`mark(state, outcome, rng)`** — at the cycle boundary only:

```
if position === queue.length:
    if failedThisCycle is empty:  status = 'complete'
    else:
        cycleIndex += 1
        queue       = shuffle(failedThisCycle, rng)   # was: [...failedThisCycle]
        position    = 0
```

`rng` is untouched on every other call. Marking a card mid-cycle consumes no randomness.

**`restart(deck, state, rng)`** stays `start(deck, state.rungId, rng)`, which is FR-017 and FR-018
for free — a restart is a fresh `start`, so it is a fresh shuffle.

---

## The shuffle contract

```ts
export function shuffle<T>(items: readonly T[], rng: Rng): T[];
```

| Rule | Requirement |
|---|---|
| Returns a new array; never mutates `items` | 001's no-aliasing tests |
| Output is a permutation of the input — same members, same length, no additions | FR-004 |
| Every element can reach every index over repeated calls | FR-005 |
| A result equal to the input order is returned as-is, never re-rolled | Spec edge cases |
| `rng()` returning exactly `1` must not index off the end | see below |
| `[]` and single-element inputs return an equal array | Edge cases: a one-card cycle |

The clamp is not defensive noise. `Math.floor(rng() * (i + 1))` gives `i + 1` when `rng()` returns
`1`, and `undefined` would land in a queue silently. `Math.random` never returns `1`; a hand-written
test `Rng` returning a constant `1` is the realistic source, and there is a test for it.

---

## Invariants added to the engine's test list

Numbered on from 001's I1–I6, which all still hold and are all still tested.

| # | Invariant | Requirement |
|---|---|---|
| **I7** | Every cycle's `queue` is a permutation of the cards that cycle should contain — cycle 0 of `rung.cardIds`, cycle *n+1* of cycle *n*'s `failedThisCycle` | FR-001, FR-004, SC-004 |
| **I8** | `queue` does not change while a cycle is in progress; only `position` advances | FR-007, FR-013 |
| **I9** | Given the same `Rng` sequence and the same rung, a run produces an identical sequence of cards | FR-010, SC-005 |
| **I10** | A run reconstituted from its persisted form presents the same remaining cards, in the same order, as the run it was written from | FR-011, FR-014, SC-005, SC-006 |
| **I11** | Over many runs, every card of a cycle appears at every position | FR-005, SC-002 |

I9 is what "deterministic through resumes" reduces to once no seed is stored: determinism is a
property of the recorded order, and the engine only has to not disturb it.

I2 from 001 — *"cycle n+1's queue equals cycle n's failedThisCycle exactly, same members, same
order"* — is the one prior invariant this feature amends. It becomes **same members, permuted
order**, which is FR-003. Its test is rewritten, not deleted.
