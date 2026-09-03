# Contract: Card Advance

**Feature**: 009-card-advance-guard | **Spec**: [spec.md](../spec.md)

The UI contract for the run screen's card block. Binding on `src/routes/Run.tsx`,
`src/run/advance.ts`, `src/components/PronounceButton.tsx`, and the indicator of
and `src/components/PronounceButton.tsx`. `src/components/ui/progress.tsx` and
`src/components/RunProgress.tsx` are **out of scope** — see § 4.

---

## 1. The guarded group

The **card block** is one keyed wrapper containing, in order:

1. `CardFace`
2. the two-column grid holding `PronounceButton` and `OutcomeButtons`

Everything in it animates as one element, because it *is* one element. Nothing
inside carries an animation class of its own — that is what makes "they MUST NOT
animate independently or on different curves" (FR-005) structural rather than a
rule someone has to remember.

A card change plays **two phases in sequence**. Only one card is ever on screen:
the outgoing one for the whole of its exit, the incoming one for its entry.

**Outside the block, and never guarded**: the run/level heading, the
out-of-storage message, "Start over", "Leave this run", and both progress bars.
The bars are outside the block but share its clock (§ 4).

## 2. When a press is accepted

| State | "Got it" / "Not yet" | Pronounce | Start over | Leave this run |
|---|---|---|---|---|
| idle | marks | speaks | restarts | navigates |
| exiting | **discarded** | **discarded** | restarts, cancelling the in-flight action | navigates |
| entering, after a press | **discarded** | **discarded** | restarts | navigates |
| entering, first card of a run | marks | speaks | restarts | navigates |
| run complete | not rendered | not rendered | n/a (offered as "Repeat this run") | navigates |

A discarded press produces nothing: no outcome, no storage write, no bar
movement, no console output, no deferred replay. It is not queued.

**The guard is checked at the call site, not inside `apply`.** `apply` also
serves "Start over" and "Repeat this run", which must stay live (FR-009, FR-012).
Guarding `onMark` rather than `apply` satisfies both with no condition written
for either.

## 3. When the window opens and closes

- **Opens** on any press that changes the card: an accepted mark, or "Start over".
- **Closes** when the entry ends, or when `RunLoop` unmounts, whichever is first.
- **Its length is `CARD_EXIT_MS + CARD_ENTRY_MS`, derived.** No third number
  exists to disagree with the animation (FR-006).
- **Never open** for the first card of a run or a resume (FR-010), or on the
  run-complete screen (FR-009). Both animate; neither is guarded.

### The outcome lands on the press

Applied and written immediately, before the exit starts (FR-005d, FR-014). **No
outcome is ever waiting on an animation.** Four consequences, all binding:

1. **Nothing can lose a mark.** Close the tab, leave the run, or restart at any
   point in the transition: the outcome is already in storage. There is no window
   in which it exists on screen but not on disk.
2. **The engine is one card ahead of the paint, for one exit.** `leaving` holds
   the id of the card that was on screen when the press landed, and the exit
   paints that.
3. **Only the paint may read `leaving`.** The progress bars, the storage write,
   and what a resume comes back to all follow the engine. Nothing derived from
   `leaving` is ever stored or treated as truth.
4. **A new transition replaces the one in flight** (FR-013), but no longer has to
   *cancel* anything dangerous: there is no unapplied action for the timer to
   carry. The worst an interruption costs is an animation.

## 4. The one clock

`RunLoop` renders `style={{ '--card-exit': `${CARD_EXIT_MS}ms`, '--card-entry':
`${CARD_ENTRY_MS}ms` }}` on a wrapper enclosing both the progress bars and
`<main>`. Both are unregistered custom properties, so they inherit to everything
below.

Three things read it, and **all three must read it rather than name a duration
of their own**:

| Consumer | How |
|---|---|
| The exit | `duration-(--card-exit)` → `--tw-duration` → `animate-out` |
| The entry | `duration-(--card-entry)` → `--tw-duration` → `animate-in` |
| The button dim-and-recover | The same two animations. `fade-out-40` takes opacity `1 → 0.4`, `fade-in-40` takes it `0.4 → 1` |

### The bars are not on this clock

They are a layer, not a group member: `RunProgress` is `fixed inset-x-0 top-0
z-10`, a sibling of `<main>`, and was never inside the card block. Its indicator
already carries `transition-all`, so the fill already eases at Tailwind's stock
150ms. It changes on the press, so it moves while the card is leaving underneath
it.

**`src/components/ui/progress.tsx` must not be modified by this feature.** Putting
the run screen's timing inside a shared component to synchronise two things on
different planes is coupling with nothing to buy. If tuning the exit far past
~250ms ever makes the bar land visibly early, that is when to revisit it.

The two `setTimeout`s read `CARD_EXIT_MS` and `CARD_ENTRY_MS` directly — the same
source, one step earlier.

**The two fade percentages must match.** `fade-out-40` and `fade-in-40` meeting at
the same opacity is what makes the dim one continuous gesture rather than two
adjacent ones (FR-005b, SC-003a). Change one, change the other.

**Prohibited**: a duration literal anywhere but `src/run/advance.ts` — including
the test file, which imports both constants and sums them (SC-004). And no
separate guard duration: it is the sum, derived (FR-006).

## 5. What must stay true at any tuning value

The numbers in `src/run/advance.ts` are expected to change. These do not:

- **At `0` for both phases**: one press marks exactly one card, and the outcome
  still applies. The screen stays correct; only the protection goes away (FR-008).
- **At `0` for one phase**: still correct. A zero exit is a hard cut into a normal
  entry; a zero entry is a normal exit into a hard cut.
- **At any value**: the block returns to the exact resting position and size it
  started from. Travel is displacement, never relocation (FR-005a).
- **At any value**: the buttons never reach an opacity that reads as switched
  off, and no countdown, timer, or spinner appears (FR-005b).
- **At any value**: no unit test expectation changes.

## 6. Prohibited implementations

- `disabled` on the outcome buttons. shadcn's `Button` applies
  `disabled:opacity-50`, a static half-dim that survives the animation and reads
  as switched off (FR-005b).
- `pointer-events: none` as the guard. It does not block keyboard activation
  (FR-004).
- Keying the wrapper by card id or by the word. The same card is legitimately
  presented twice running, and the entry must play both times.
- Incrementing the key on the press rather than at the boundary. That unmounts the
  outgoing card mid-exit, and there is nothing left to animate out.
- **Deferring the outcome, the storage write, or any part of either, to the end of
  an animation** (FR-005d, FR-014).
- Reading `leaving` for anything but which card to paint. It is not the current
  card, and must never be stored, compared against the queue, or passed to the
  engine.
- Letting two transitions be in flight at once (FR-013).
- Clearing the flag from `onAnimationEnd` alone. No animation, no clear, dead
  buttons for the rest of the run.
- A wall-clock deadline (`Date.now()`). Constitution Principle IV.
- A second animation on any child of the block.

## 7. Every card change plays both phases

Whatever caused it (FR-005e). None of these is a special case in the code:

| Cause | Exit | Entry | Guarded |
|---|---|---|---|
| A mark | yes | yes | yes |
| "Start over" | yes | yes | yes |
| First card of a run, or a resume | none to play | yes | **no** (FR-010) |
| The last card of a run | yes | the run-complete screen | **no** (FR-009) |

The first card has no exit because nothing preceded it — an absence, not a branch.
The completion screen is unguarded for free, because the guard is only ever
checked at the outcome handler and that screen has no outcome buttons.

## 8. Layout invariant

Introducing the wrapper must not change spacing. `<main>` is
`flex flex-col gap-8`; it currently spaces four children. After the change it
spaces three, and the wrapper spaces two internally, so the wrapper carries
`flex w-full flex-col items-center gap-8` and the rendered gaps are identical.

The outer wrapper carrying the two custom properties is a plain `<div>` with no
classes. `main`
keeps its own `mx-auto max-w-xl min-h-svh`, and `RunProgress` is `fixed`, so
neither is affected.
