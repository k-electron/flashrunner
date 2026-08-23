# Phase 1 Data Model: Deck Runs

**Date**: 2026-08-22 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Two families of data, kept deliberately separate:

- **Authored** — deck configs. Ship with the app, immutable at runtime, never written to storage.
- **Earned** — per-deck progress and run state. Written to `localStorage`, must survive upgrades.

The engine reads authored data and writes earned data. It never derives one from the other's
shape, which is what keeps a deck config editable without a migration.

---

## Authored: deck configuration

```ts
type CardId = string;
type RungId = string;
type DeckId = string;

type DeckConfig = {
  id: DeckId;              // stable forever — storage keys hang off this
  title: string;           // "Dolch Pre-K · Steps of 5"
  cards: CardConfig[];     // every card in the deck
  rungs: RungConfig[];     // ordered smallest → largest
};

type CardConfig = {
  id: CardId;              // stable within the deck
  front: string;           // the visible face (FR-023)
  back?: string;           // absent for single-sided decks (FR-024)
};

type RungConfig = {
  id: RungId;              // stable — appears in stored progress
  label: string;           // "5 words"
  cardIds: CardId[];       // EXPLICIT membership. Never computed.
};
```

### Why `back` is optional rather than a discriminated union

A single-sided card is not a different *kind* of thing from a two-sided one — it is a two-sided
card with nothing on the back. Making `back?: string` optional means adding a two-sided deck adds
a field to that deck's own cards and touches nothing else (FR-024, SC-010). A union would force
every existing config to declare which variant it is, which is precisely the rewrite FR-024
exists to prevent.

### Why `cardIds` is literal

Per the maintainer's constraint: the config states which cards are in which rung. It does not
state a rung *size* from which the engine slices. A "steps of 5" ladder and a "steps of 10"
ladder over the same words are two different authored decks, not one deck with a parameter. This
also makes the 52-word deck's final rung-of-2 a non-event — there is no arithmetic to special-case.

### Validation rules (FR-003, FR-004)

Run over every built-in deck. A failure is a **loud** failure — the deck does not load partially.
These are checks, never derivations:

| # | Rule | Requirement |
|---|---|---|
| V1 | `cards` is non-empty and every `card.id` is unique within the deck | edge case: duplicate cards |
| V2 | `rungs` is non-empty | — |
| V3 | Every `rung.id` is unique within the deck | storage integrity |
| V4 | Every id in every `rung.cardIds` exists in `cards` | FR-004 |
| V5 | No `rung.cardIds` contains a duplicate | FR-004 |
| V6 | For every adjacent pair, `rungs[i].cardIds ⊇ rungs[i-1].cardIds` | FR-003 |
| V7 | The last rung's `cardIds` equals the full set of `card.id` | FR-003, edge case: unreachable cards |

V6 is containment as a **set**, not a prefix — a future deck could reorder within a rung and stay
valid. V7 is set equality in both directions: the top rung may not omit a card, and (by V4) may
not invent one.

These run as a unit test over the deck registry, so an invalid deck fails CI rather than
reaching a learner.

---

## Earned: the run state machine

Pure, in `src/run/`. No React, no storage, no I/O.

```ts
type Outcome = 'got-it' | 'not-yet';

type RunState = {
  deckId: DeckId;
  rungId: RungId;
  cycleIndex: number;         // 0-based; cycle 0 is the full rung
  queue: CardId[];            // cards to present this cycle, in order
  position: number;           // index into queue of the current card
  failedThisCycle: CardId[];  // accumulating, in the order they were failed
  passedThisRun: CardId[];    // never shrinks (FR-009)
  status: 'running' | 'complete';
};
```

### Transitions

**`start(deck, rungId) → RunState`**

```
queue           = rung.cardIds        (config order — no shuffle, per spec assumption)
position        = 0
cycleIndex      = 0
failedThisCycle = []
passedThisRun   = []
status          = 'running'
```

**`mark(state, outcome) → RunState`** — the whole mechanic, in one function:

```
card = queue[position]

got-it  → passedThisRun   += card
not-yet → failedThisCycle += card

position += 1

if position < queue.length:
    stay in this cycle
else:                                   # cycle exhausted
    if failedThisCycle is empty:
        status = 'complete'             # FR-010
    else:
        cycleIndex     += 1
        queue           = failedThisCycle   # FR-008 — exactly, nothing else
        position        = 0
        failedThisCycle = []
```

**`restart(deck, state) → RunState`** ≡ `start(deck, state.rungId)`. Discards this run only;
nothing outside it is touched (FR-032).

There is no `abandon` transition. Abandoning is navigation, not a state change (FR-012) — the
run stays exactly as persisted and no completion is recorded.

### Selectors

| Selector | Returns | Serves |
|---|---|---|
| `currentCard(state)` | `queue[position]`, or `undefined` when complete | FR-006 |
| `remainingInCycle(state)` | `queue.length - position` | FR-013, SC-008 |
| `isComplete(state)` | `status === 'complete'` | FR-010 |

### Invariants — these are the test list

| # | Invariant | Requirement |
|---|---|---|
| I1 | A card in `passedThisRun` never appears in any later `queue` | FR-009, SC-003 |
| I2 | Cycle *n+1*'s `queue` equals cycle *n*'s `failedThisCycle` exactly — same members, same order | FR-008, SC-003 |
| I3 | `status === 'complete'` **iff** every card of `rung.cardIds` is in `passedThisRun` | FR-010, SC-004 |
| I4 | No bound on `cycleIndex`; a run where every card fails every cycle loops forever without erroring | FR-011 |
| I5 | While `running`: `queue` is non-empty and `0 ≤ position < queue.length` | — |
| I6 | `passedThisRun` and `failedThisCycle` never contain duplicates | FR-009 |

I3 holds by construction: every card enters cycle 0's queue, and the only exit from the loop is
passing. A cycle ends complete only when nothing was failed in it, so by induction every card has
passed.

---

## Earned: the persisted record

One record per deck, at key `flashrunner:deck:<deckId>`. Full format in
[contracts/storage.md](./contracts/storage.md).

```ts
type DeckRecord = {
  schemaVersion: number;      // 1
  completedRungIds: RungId[];
  run?: PersistedRun;         // the unfinished run, if any (FR-028)
  // …plus any field a future version adds, preserved verbatim (FR-041)
};

type PersistedRun = Omit<RunState, 'status' | 'deckId'>;
```

`status` is not persisted, because **a persisted run is always in progress**. On completion the
run is cleared and its rung id is appended to `completedRungIds` — so there is no stored
"complete" state that could disagree with the rung list. `deckId` is not persisted either; it is
already the key.

### Mastery is derived, not stored

FR-019 asks that mastery survive a reload. Two ways to get that: store a `mastered` boolean, or
derive it as `completedRungIds.includes(lastRung.id)`.

**Decision: derive it.** A stored boolean is a second source of truth that can drift from the
rung list, and it behaves badly across a config revision — a deck that gains a new top rung would
still claim mastery while displaying an unfinished ladder. Derivation is both simpler
(Principle VI) and cannot disagree with itself. Mastery still survives reloads, because
`completedRungIds` does.

### Rung unlocking (FR-015)

Shipped as `isStartable` in `src/decks/ladder.ts`:

```
isStartable(deck, completedRungIds, index) =
    index === 0 || completedRungIds.includes(deck.rungs[index - 1].id)
```

Completed rungs stay startable forever (FR-016), and repeating one appends nothing new, so
progress cannot go backwards (FR-018).

**Assumption: a deck's rung sequence is stable for as long as progress against it is retained.**
FR-016 is unconditional, but this rule reads the *predecessor*, not the rung itself. If a
published deck's rungs were ever reordered, or a rung inserted between two existing ones, a rung
the record says is completed could render as not startable — its new predecessor was never
completed. Under the rule above, `completedRungIds: ['r2']` leaves `r2` locked. Reaching that
state requires exactly the config drift § Mastery is derived, not stored cites, and
`plan.md § Key Design Decisions` already requires a changed ladder to ship under a new deck id,
which keeps stored progress from being read against it. Should a ladder ever be revised in place
instead, FR-016 would need an explicit exception here.

### Discarding a stale run

On read, a `PersistedRun` is dropped — and only it, never the whole record — when the deck config
has moved out from under it:

- `rungId` is not a rung in the current config
- any id in `queue`, `passedThisRun`, or `failedThisCycle` is not a card in the current config
- `queue` is empty, or `position` is outside `[0, queue.length)`

`completedRungIds` and everything else in the record survive intact. This is the spec's
"discarded rather than resumed into an inconsistent state" edge case, scoped as narrowly as it
can be.

Unrecognized entries in `completedRungIds` are ignored for display but **kept on write** — a rung
id this version does not know may belong to a config it has not caught up to yet (FR-040, FR-041).

---

## Entity map to the spec

| Spec entity | Lives as | Where |
|---|---|---|
| Deck | `DeckConfig` | `src/decks/*.ts`, authored |
| Card | `CardConfig` | inside `DeckConfig.cards` |
| Rung | `RungConfig` | inside `DeckConfig.rungs`, membership literal |
| Run | `RunState` | `src/run/`, pure |
| Cycle | `cycleIndex` + `queue` + `failedThisCycle` | not a separate object — a cycle is a phase of a run, and modelling it as a record would add a lifecycle nothing reads |
| Deck Progress | `completedRungIds` (+ derived mastery) | `DeckRecord` |
| Run State | `PersistedRun` | `DeckRecord.run`, one per deck (FR-036) |
