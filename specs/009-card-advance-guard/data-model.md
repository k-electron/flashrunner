# Data Model: Card Advance Guard

**Feature**: 009-card-advance-guard | **Spec**: [spec.md](./spec.md)

## Nothing persisted changes

No `schemaVersion` bump, no migration, no new storage key, no change to
`PersistedRun` or the deck record. FR-010 makes this a requirement rather than an
observation.

**The write does not move.** It still happens on the press, synchronously, exactly
as it does today (FR-005d, FR-014). Nothing about interruption behaviour changes:
there is no window in which an outcome exists on screen but not in storage.

`src/storage/deckRecord.ts` and `src/storage/keys.ts` are untouched.

## Transient state added to `RunLoop`

All in `src/routes/Run.tsx`, alongside the existing `state`, `storageFull` and
`heard`. None of it is written anywhere.

| Name | Type | Initial | Changes when | Read by |
|---|---|---|---|---|
| `leaving` | `string \| null` | `null` | Set to the card id on screen, on any press that changes the card; cleared at the boundary | `CardFace` and `PronounceButton` paint `leaving ?? currentCard(state)` |
| `phase` | `'exiting' \| 'entering' \| 'idle'` | `'entering'` | A card change begins, the exit ends, the entry ends | Which animation classes the block carries |
| `presentation` | `number` | `0` | `+1` at the boundary | The block wrapper's `key` |
| `guarded` | `boolean` | `false` | `true` on a press that changes the card; `false` when the entry ends | The outcome handler's early return; `PronounceButton`'s `guarded` prop |
| `pending` | `useRef<timeout id>` | — | Every transition, and unmount | Cleared before each new transition (FR-013) |

### `leaving` is the whole of the lag

The engine and storage move on the press. `leaving` holds the id of the card that
was on screen when it did, so the exit paints the card the learner actually
marked. One value, one phase long.

```ts
const shownId = leaving ?? currentCard(state);
const complete = isComplete(state) && leaving === null;
```

Those two lines are the entire divergence. **Everything else reads the engine**:
the progress bars, the storage write, what a resume comes back to. Nothing derived
from `leaving` is ever stored or treated as truth.

### The machine

```text
   press ──► apply the action AND write to storage        ← immediately, always (FR-005d)
             leaving = the card that was on screen
             guarded = true
                │
                ▼
   idle ──► exiting ──CARD_EXIT_MS──► leaving = null ──► entering ──CARD_ENTRY_MS──► idle
    ▲        paints `leaving`;        presentation += 1   paints the engine's        guarded = false
    │        bars already moving                          card                            │
    └──────────────────────────────────────────────────────────────────────────────────────┘

   mount                     → phase = 'entering', guarded = false, leaving = null (FR-010)
   press while not idle      → clear `pending`, start again. No outcome is pending,
                               so nothing can land late (FR-013)
   outcome press + guarded   → discarded. No mark, no write, no bar movement
   "Start over"              → allowed at any time, and starts a transition of its own
   unmount                   → `pending` cleared. The mark is already written (FR-014)
   run completes             → `isComplete` is true from the press, but the block keeps
                               painting `leaving` until the boundary, then the completion
                               screen mounts as the entry. Not guarded (FR-009)
```

### What cancellation now means

`pending` is still cleared before every transition, but the stakes are far lower
than they were: the timer no longer carries an unapplied outcome, only the job of
ending a phase. An interrupted transition can lose an animation. It cannot lose a
mark (FR-013, FR-014).

### Why `phase` and `guarded` are separate

They start together on a press and end together — but not on mount. The first
card of a run is `phase: 'entering'` and `guarded: false`, which is FR-010
expressed as an initial value rather than as a condition someone has to remember.

### Why `presentation` is a counter

It is the entry animation's `key`, and it must change on every presentation. The
run state cannot supply one:

- `currentCard(state)` repeats. Failing the last card of a cycle re-queues it, so
  the same card id can be presented twice running.
- `state.position` resets to `0` when a cycle closes.
- `` `${cycleIndex}-${position}` `` changes on every mark, but a "Start over" from
  the first card of the first cycle maps `0-0` to `0-0` — and Start over now
  animates, so that hole is reachable.

It increments at the **boundary**, not on the press: during the exit the outgoing
card must stay mounted, and changing the key would unmount it mid-animation. That
is also why `leaving` exists — holding the key still keeps the element alive, and
`leaving` keeps the right word inside it.

## The tuning surface

`src/run/advance.ts`, new. The one place FR-007 and FR-007a point at.

| Export | Type | Purpose |
|---|---|---|
| `CARD_EXIT_MS` | `number` | How long the outgoing card takes to leave |
| `CARD_ENTRY_MS` | `number` | How long the incoming card takes to arrive |
| `CARD_EXIT_CLASSES` | `string` | `animate-out fade-out-40 slide-out-to-top-2 ease-in fill-mode-forwards duration-(--card-exit)` |
| `CARD_ENTRY_CLASSES` | `string` | `animate-in fade-in-40 slide-in-from-bottom-2 ease-out duration-(--card-entry)` |

The progress bars are **not** consumers of this surface. They are a layer above
the card rather than part of the moving group, and already ease their own fill
(FR-005c, [research.md](./research.md) § 6).

**Derived, never written**: the guard window is `CARD_EXIT_MS + CARD_ENTRY_MS`
(FR-006). Nothing else names a duration.

`fade-out-40` and `fade-in-40` **must hold the same number**. That shared value is
what makes the dim continuous across the boundary instead of two effects that
happen to be adjacent (FR-005b, SC-003a).

Starting values: `140` and `180` — the exit slightly quicker than the entry, so
the card leaves briskly and settles gently. Both are meant to be changed; see
[contracts/card-advance.md](./contracts/card-advance.md) § 5.

`Run.test.tsx` imports both durations and advances by their sum. It never writes
a number, so retiming changes one line and no expectation (SC-004).
