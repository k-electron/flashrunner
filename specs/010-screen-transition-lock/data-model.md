# Data Model: Screen Transition Lock

Feature: [spec.md](./spec.md) · Contract:
[contracts/screen-lock.md](./contracts/screen-lock.md)

## Nothing persisted changes

No stored payload, no key, and no `schemaVersion` is touched. FR-015 says the lock is
never written down, so `src/storage/deckRecord.ts` and `src/storage/migrations.ts`
are out of scope and no migration is required. The lock lives and dies with the
mounted screen.

## The screen's transient state

All of it is `RunLoop` state in `src/routes/Run.tsx`. The table is the state **after**
this feature; the last column says what changes.

| Name | Type | Meaning | Change |
|---|---|---|---|
| `state` | `RunState` | The run itself, owned by the engine in `src/run/reducer.ts` | unchanged |
| `storageFull` | `boolean` | The device refused the last write | unchanged |
| `heard` | `boolean` | The learner asked to hear this card's word | unchanged |
| `phase` | `'exiting' \| 'entering' \| 'idle'` | Which half of a card change is running | unchanged |
| `presentation` | `number` | The card block's key; advances only at the phase boundary | unchanged |
| `leaving` | `CardId \| null` | The card to keep painted through its exit | unchanged |
| `pending` | `ref<Timeout>` | The one release timer | unchanged |
| ~~`guarded`~~ | ~~`boolean`~~ | ~~Whether outcome presses are refused~~ | **deleted** (research Decision 3) |
| `locked` | `boolean` | Whether the screen accepts activations | **new, derived**: `phase !== 'idle'` |

`locked` is a `const` computed at render, not state. That is FR-011's "MUST NOT be
tracked separately from which phase is running" expressed in the only way that
cannot drift: there is no second value to keep in step.

## Lock state transitions

`locked` is a pure function of `phase`, so the lock has no state machine of its own —
it has `phase`'s. What follows is `phase`, annotated with the lock.

| From | Event | To | `locked` | Timer |
|---|---|---|---|---|
| *(none)* | mount — a run entered or resumed | `entering` | **true** | entry timer set |
| `idle` | a mark, or "Start over" | `exiting` | **true** | previous cleared; exit timer set |
| `idle` | "Repeat this run" (no card to play out) | `entering` | **true** | previous cleared; entry timer set |
| `exiting` | exit timer fires → `enter()` | `entering` | **true** | entry timer set in the same callback |
| `exiting` | a new card change | `exiting` | **true** | previous cleared; exit timer set |
| `entering` | entry timer fires | `idle` | **false** | none pending |
| `entering` | a new card change | `exiting` | **true** | previous cleared; exit timer set |
| *any* | unmount | — | — | cleared, never fires |

Two properties the table is meant to make checkable:

- **`locked` is true in every row but the last.** The only path to `false` is the
  entry timer firing. Mount enters at `entering`, which is FR-020 — the first card of
  a run locks like any other arrival, with no row that exempts it.
- **`exiting` → `entering` sets the next timer in the same callback.** That is
  FR-011a: no scheduling gap, so no frame in which `phase` is `idle` mid-motion.

## Derived values, unchanged

Listed because FR-011 is about what may and may not be derived, and these already are:

- `shownId = leaving ?? currentCard(state)` — what is painted, which diverges from the
  engine only during an exit.
- `complete = isComplete(state) && leaving === null` — whether the run-complete screen
  is showing.
- The exit and entry durations, from `CARD_EXIT_MS` and `CARD_ENTRY_MS` in
  `src/run/advance.ts`. Each phase's lock is that phase's duration; there is no sum
  and no third constant.

## Component surface

| Component | Before | After |
|---|---|---|
| `PronounceButton` | `{ word, guarded?, onHeard }` | `{ word, onHeard }` |
| `OutcomeButtons` | `{ onMark, heard }` | unchanged; its `onMark` caller loses the `if (guarded) return` |
| `RunProgress` | `{ run, cycle }` | unchanged |
| `CardFace` | `{ front }` | unchanged |

No component gains a lock-related prop. A component that had one loses it. That is
FR-002 measured at the API: coverage is not something a control is told about.
