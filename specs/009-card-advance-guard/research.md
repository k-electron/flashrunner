# Research: Card Advance Guard

**Feature**: 009-card-advance-guard | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

Every decision below was checked against the installed packages rather than
recalled. Where a claim was verified by running something, the check is named.

---

## Decision 1 — The guard is a boolean checked at the call site, not `disabled`

**Decision**: `RunLoop` holds a `guarded` flag. The outcome handler returns
early while it is set. The buttons keep their `enabled` state throughout.

**Rationale**: FR-005b forbids a greyed-out or switched-off appearance, and
shadcn's `Button` applies `disabled:pointer-events-none disabled:opacity-50` —
a *static* half-dim that would sit under the recovering fade and still be there
when the animation ended. A `disabled` button also drops focus, which would
break the keyboard case FR-004 requires. An early return in the handler covers
touch, mouse, keyboard activation and key auto-repeat in one line, because all
four arrive as the same React `click`.

**Alternatives considered**:

- `disabled` on both buttons — rejected above.
- `pointer-events: none` on the block — does not block keyboard activation, so
  it fails FR-004, and it is invisible to jsdom so nothing could test it.
- Blocking inside `apply` — rejected: `apply` also serves "Start over" and
  "Repeat this run", which FR-009 and FR-012 require to stay live. Guarding at
  the `onMark` call site rather than inside `apply` satisfies both for free,
  with no condition written for either.

---

## Decision 2 — One inherited CSS custom property, fed by one TypeScript constant

**Decision**: `src/run/advance.ts` exports the tuning surface. `RunLoop` wraps its
output in a plain `<div>` carrying `style={{ '--card-exit': …, '--card-entry': … }}`.
Everything below inherits both: the block's two animation phases, and the progress
bars' fill.

**Rationale**: FR-007 requires one value to retime the guard window, the block's
motion, the button recovery and the bar fill together. The JavaScript timeout and
the CSS both need it, so exactly one of them must be the source. A TypeScript
constant is the one that can be imported by a test; a CSS variable read back
through `getComputedStyle` is not resolvable in jsdom.

`--card-exit` and `--card-entry` are plain, unregistered custom properties, so
they inherit by default. Tailwind's own `--tw-duration` is registered `inherits: false` and
cannot be set from an ancestor — verified by compiling the utilities against the
installed Tailwind 4.3.3 (see Decision 3).

**Alternatives considered**:

- Declare the value in `index.css` and duplicate it in TypeScript — two copies of
  the number, which is precisely what FR-007 exists to prevent.
- Read it back with `getComputedStyle(document.documentElement)` — unresolvable in
  jsdom, so the guard would silently run at 0ms in every test.
- Set `--tw-duration` on an ancestor — does not work: `inherits: false`.

---

## Decision 3 — The animation is `tw-animate-css`, already installed

**Decision**: The card block is a keyed wrapper carrying, while entering,
`animate-in fade-in-40 slide-in-from-bottom-2 ease-out duration-(--card-entry)`,
and while exiting the mirror set in Decision 4.

**Verification**: compiled these exact classes with the installed
`tailwindcss@4.3.3` and `tw-animate-css@1.4.0` via Tailwind's `compile()` API.
Generated output:

| Class | Generates |
|---|---|
| `animate-in` | `animation: enter var(--tw-animation-duration,var(--tw-duration,.15s)) var(--tw-ease,ease) …` |
| `fade-in-40` | `--tw-enter-opacity: .4` |
| `slide-in-from-bottom-2` | `--tw-enter-translate-y: calc(2*var(--spacing))` → 8px |
| `duration-(--card-entry)` | `--tw-duration: var(--card-entry); transition-duration: var(--card-entry)` |

**`fade-in-40` is the whole of FR-005b.** It starts the enter animation at
opacity `0.4` and drives it to `1` over the window — literally "dim on press,
recover to full strength, reaching it as the transition ends". No second
animation, no countdown element, and nothing that reads as a disabled state. The
recovery and the motion are one animation by construction, so they cannot drift.

`slide-in-from-bottom-2` is 8px of travel. That is the restraint FR-005a asks
for, and it is a `transform`/`opacity` pair, so it composites without layout.

**Alternatives considered**:

- Hand-written `@keyframes` in `index.css` — more code for what an installed,
  shadcn-standard dependency already generates. Rung 5 of the ladder.
- `framer-motion` / `motion` — a new runtime dependency needing a Principle V
  justification, for an 8px fade. Rejected.
- The View Transitions API — not in Firefox at the time of writing, and it would
  animate a snapshot of the whole document rather than one block.

---

## Decision 4 — Two phases in sequence, with the outcome applied at the boundary

**Decision**: A card change is a small state machine.

```text
  press ──► apply + write ──► exiting ──CARD_EXIT_MS──► entering ──CARD_ENTRY_MS──► idle
```

**The outcome is applied and written on the press** (FR-005d). The animation runs
afterwards and carries nothing with it. The outgoing card stays mounted and gains
`animate-out … fill-mode-forwards`; `leaving` holds its id so the exit paints the
card the learner actually marked. At the boundary `leaving` clears and the
wrapper's key changes, so the next card mounts with `animate-in …`.

**Rationale**: This is the maintainer's model, and it turns out to be simpler than
the enter-only version it replaces, not harder. Because the phases run in
*sequence* rather than overlapping, only one card is ever on screen. **No presence
library, no new dependency.** The thing that would have needed one — a crossfade
with both cards visible — is not what was asked for.

**The dim becomes continuous, which is a real gain.** Verified by compiling:
`fade-out-40` ends the exit at opacity `0.4`, and `fade-in-40` starts the entry at
`0.4`. The two halves meet at the same value, so the block dims as the card leaves
and recovers as the next arrives — one gesture across the whole window, which is
what FR-005b and SC-003a ask for. Under the enter-only design the dim existed only
in the second half.

Travel composes the same way: `slide-out-to-top-2` lifts the outgoing card 8px up
and out, `slide-in-from-bottom-2` brings the next one up from 8px below. The card
reads as moving on rather than being replaced.

**Applying on the press is the maintainer's call, and it is the right one.** An
earlier draft of this plan deferred the outcome to the exit/entry boundary so that
the engine and the paint never disagreed. That bought tidiness and paid for it in
the only currency that matters here: a tab closed during an exit lost the mark.

Applying on the press costs one lagging value — `leaving`, the id of the card to
paint — confined to one phase, read by nothing but the renderer. It buys two
things:

1. **No mark can be lost** (FR-014). There is no window in which an outcome exists
   on screen but not in storage. Interruption behaviour is exactly what it is
   today.
2. **The dangerous cancellation case disappears.** Under the deferred design, a
   "Start over" during an exit had to cancel a *scheduled outcome*, or that outcome
   would land on the freshly shuffled run — this feature's own defect, reintroduced
   by its own fix. With nothing scheduled, there is nothing to land late. FR-013
   shrinks from a correctness rule to a tidiness one.

The discipline the lag needs is one line in the contract: `leaving` may be read
for painting and nothing else. The engine, the bars, the write, and a resume all
follow `state`.

**Key must be a counter, not the card id.** The same word can legitimately be
presented twice running — failing the last card of a cycle re-queues it, and a
"Start over" can reshuffle onto the card already showing. Keying by word or card
id would skip the entry in exactly those cases.

**Verification** (same method as Decision 3, installed Tailwind 4.3.3 and
`tw-animate-css` 1.4.0):

| Class | Generates |
|---|---|
| `animate-out` | `animation: exit var(--tw-animation-duration,var(--tw-duration,.15s)) …` |
| `fade-out-40` | `--tw-exit-opacity: .4` |
| `slide-out-to-top-2` | `--tw-exit-translate-y: calc(2*var(--spacing)*-1)` → -8px |
| `fill-mode-forwards` | `animation-fill-mode: forwards` — holds the exited state so nothing snaps back before the remount |

---

## Decision 4a — One timer ref, cleared before every transition

**Decision**: Both phase timeouts share one `useRef`. Any new card change clears
it first, and so does unmount.

**Rationale**: FR-013. With the outcome applied on the press, this is no longer
protecting correctness — the timer carries no unapplied action, only the job of
ending a phase — so the worst a stale timer could do is clear `leaving` or drop
the guard early on a transition that has already been replaced. Still wrong, still
one line to prevent.

Unmount clearing the same ref is what keeps a run left mid-exit from setting state
after it is gone.

---

## Decision 4b — The first card and the run-complete screen

**Decision**: Both play an entry. Neither is guarded.

**Rationale**: The maintainer asked for both (points 3 and 4). Neither needs a
special case in the code:

- The **first card** mounts with the wrapper's entry classes because that is what
  mounting does. It has no exit because nothing preceded it — an absence, not a
  branch. It is unguarded because `guarded` starts `false` and only a press sets
  it. There is no earlier press to bounce from, so a guard would protect against
  nothing and only delay the learner (FR-010).
- The **run-complete screen** is the entry that pairs with the last card's exit.
  The block unmounts at the boundary and the completion screen mounts carrying the
  same entry classes. It is unguarded for free: the guard is only ever checked at
  the outcome handler, and the completion screen has no outcome buttons (FR-009).

So FR-009 and FR-010 both fall out of the structure rather than being enforced by
a condition — the same property the guard's placement has (Decision 1).

---

## Decision 5 — `setTimeout`, not `onAnimationEnd`

**Decision**: The flag is cleared by a `setTimeout` of the same constant, with the
id held in a ref and cleared on unmount.

**Rationale**: `onAnimationEnd` would tie the guard to the animation exactly,
which is what FR-006 describes — but if the animation never runs, the flag never
clears and the buttons are dead for the rest of the run. That happens in jsdom
(no CSS), and under any future reduced-motion or background-tab condition. A
guard whose failure mode is a permanently unusable screen is the wrong trade for
a frame of precision.

**Honest limit on FR-006**: a `setTimeout(d)` and a CSS animation of duration `d`
beginning at the next paint are not frame-identical. Each phase ends roughly one
frame *after* its timeout, so the boundary and the final release each run about
16ms early. That is well below the ~100ms floor of perception, and no knob is
added to correct it — a correction would be a third number that could disagree
with the other two.

The two-phase model makes one part of FR-006 free rather than enforced: the guard
window is `CARD_EXIT_MS + CARD_ENTRY_MS`, **derived**. It cannot disagree with the
animation because it is not written down anywhere.

**Alternatives considered**:

- `onAnimationEnd` with a timeout fallback — two mechanisms racing, and the
  fallback duration is a second copy of the number.
- A `Date.now()` deadline compared on each press — wall-clock dependence, which
  constitution Principle IV forbids in tests.

---

## Decision 6 — The progress bars need no change at all

**Decision**: `src/components/ui/progress.tsx` is **not touched**. The bars keep
the fill animation they already have.

**Rationale**: The bars are on a different layer from the card. `RunProgress`
renders `fixed inset-x-0 top-0 z-10` as a sibling of `<main>`, so it was never
inside the card block and never part of the moving group. They do their own thing
while the cards move underneath — which is what a status indicator should do.

Two things make this free rather than a compromise:

1. **The indicator already carries `transition-all`** — Tailwind's stock 150ms. So
   the bars have always eased their fill rather than jumping, and FR-005c is
   satisfied by code that already ships.
2. **The layering survives the new animation.** The card block will be
   `transform`ed, which creates a stacking context — but the block is statically
   positioned inside `<main>`, and `<main>` has no `z-index`, so a `fixed z-10`
   sibling still paints above it. Checked, not assumed.

An earlier draft of this plan added `duration-[var(--card-exit,150ms)]` to the
vendored indicator so the bars would share the card's clock. That was
over-coupling: it reached the run screen's timing into a shared component to
synchronise two things that are not on the same plane and do not need to agree.
**Dropping it removes a file from the change set** and leaves `progress.tsx`
exactly as shadcn ships it.

**The one condition that would bring it back**, recorded so it stays a decision
rather than an oversight: at a stock 150ms the bar lands close to a 140ms exit.
Tune the exit much past ~250ms and the bar will visibly finish while the card is
still leaving. If that reads badly, couple it then — one token,
`duration-[var(--card-exit,150ms)]` on the indicator. Do not build for it now.

**Alternatives considered**:

- Couple the bars to `--card-exit` — the over-coupling described above.
- Couple them to `--card-entry` — worse. The bars change value on the press, so
  they would be timed against a phase that has not started yet.
- A `duration` prop on `Progress` — a speculative API for a caller that turned out
  not to need it.

---

## Decision 7 — Fake timers in `Run.test.tsx`, advancing by the imported constant

**Decision**: `Run.test.tsx` switches to `vi.useFakeTimers()`, `userEvent.setup`
gains `advanceTimers`, and a `mark(user, name)` helper replaces the 46 direct
outcome clicks. The helper advances by `CARD_EXIT_MS + CARD_ENTRY_MS`,
**imported**, never written as a literal.

**The two-phase model makes this strictly necessary, where before it was merely
likely.** Under enter-only, a single click still marked the card synchronously and
only a *second* click was blocked. Now the outcome is applied at the boundary, so
**a click with no timer advance changes nothing at all** — the assertion after it
sees the old card. Every one of the 46 sites needs the helper, not just the
consecutive ones.

**Rationale**: This is the largest single cost of the feature and it is
unavoidable, so it is planned rather than discovered. 46 call sites in
`src/routes/Run.test.tsx` click "Got it" or "Not yet". With real timers, the
guard's `setTimeout(280)` has not fired by the time `userEvent`'s own `delay: 0`
resolves, so **every test that marks two cards in a row would fail.**

Advancing by the imported constant is what makes SC-004 true: retiming the
feature changes one value and no test expectation. A literal `280` in the test
file would be the second copy FR-007 forbids, wearing a different hat.

Only `Run.test.tsx` is affected. `reducer.test.ts` and `deckRecord.test.ts`
mention the outcomes as data (`'got-it'`), never as buttons, and render nothing.

**Alternatives considered**:

- Run the tests at a duration of zero — the shipped timing would then be
  exercised by nothing, and the mechanism most likely to break would be the one
  never run.
- `vi.mock` the constant module — the dedicated guard tests need the real value,
  so the file would need two versions of one module.

---

## Decision 8 — What is verified where

The motion cannot be asserted in jsdom without querying class names, which
Principle IV forbids. The split is therefore deliberate:

| Requirement | Verified by |
|---|---|
| FR-001…FR-004, FR-008 | Unit tests in `Run.test.tsx` — two presses, one mark |
| FR-009, FR-012 | Unit tests — completion and "Start over" stay live |
| FR-010 | Unit test — a resumed run's first card is markable immediately |
| FR-005, FR-005a, FR-005c, FR-006, FR-007a | Browser check (Playwright), recorded in `quickstart.md` |
| FR-005b | Browser check. `fade-in-40` is the mechanism, but opacity over time is not observable in jsdom |
| FR-005d, FR-014 (mark applies on the press) | Unit test — with **no** timer advance at all, the outcome is already in storage and the bars have already moved, while the marked card is still painted |
| FR-013 (replacement) | Unit test — "Start over" during an exit leaves one coherent run, and the earlier mark stayed recorded |
| FR-011 (pronounce) | Browser check **only**. `PronounceButton` returns `null` when `speechSynthesis` is absent, which is the path jsdom takes, so no unit test can reach it |

---

## Decision 9 — Rejected outright

- **Outcome-dependent direction** ("Got it" exits right, "Not yet" left). Spec
  Assumptions rule it out as a new feature. Note that the exit direction is now a
  one-token change (`slide-out-to-top-2` → `-right-2`), so if this is ever wanted
  it is cheap — but it is not wanted now.
- **A crossfade with both cards on screen.** The phases run in sequence, so this
  was never needed. It is the only version that would have cost a dependency.
- **A separate guard duration.** Derived from the two phase durations instead
  (FR-006). A third number is a third thing that can disagree.
- **A `prefers-reduced-motion` variant.** Out of scope by the maintainer's
  decision, recorded in the spec.

### Resolved by the two-phase model

Two items the enter-only design had to flag are simply gone:

- *"A Start over swaps the card with no animation"* — it now plays both phases,
  like a mark (FR-012).
- *"The pronounce guard's stated rationale does not hold, because there is no
  outgoing card"* — there is one now. It is on screen for the whole exit, so
  leaving the speaker live really would let it say the incoming word over the
  outgoing card. FR-011's reasoning holds as written.
