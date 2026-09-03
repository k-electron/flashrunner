# Implementation Plan: Card Advance Guard

**Branch**: `009-card-advance-guard` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-card-advance-guard/spec.md`

## Summary

A second tap landing on the next card marks it, because the outcome buttons never
move. The fix is a guard window after every mark in which no outcome is accepted,
made legible by a transition rather than by a disabled state.

**Approach**: the outcome is applied and written **on the press**, exactly as it
is today. The animation runs after it and carries nothing with it. The card and
its buttons become one wrapper that plays two `tw-animate-css` phases in sequence,
driven by a small phase machine in `RunLoop`, with the guard open across both.

```text
  press ──► apply + write ──► exiting ──CARD_EXIT_MS──► entering ──CARD_ENTRY_MS──► idle
```

One value lags: `leaving`, the id of the card that was on screen when the press
landed, so the exit paints the card the learner actually marked. It is read by the
renderer and by nothing else — the bars, the storage write, and a resume all
follow the engine.

Because the phases run in sequence, **only one card is ever on screen**, so the
thing that would have cost a dependency — a crossfade holding both — never
arises. `fade-out-40` ends the exit at opacity `0.4` and `fade-in-40` starts the
entry there, so the dim is one continuous gesture across the whole window rather
than an effect confined to the second half.

**No new dependency.** `tw-animate-css` is already installed and is what shadcn
uses. Every class in this plan was compiled against the installed Tailwind 4.3.3
to confirm it generates what is claimed — [research.md](./research.md) §§ 3, 4.

**Largest cost, planned rather than discovered**: 46 outcome clicks in
`src/routes/Run.test.tsx`. The outcome now applies at the boundary, so **a click
with no timer advance changes nothing at all** — not just the second click, every
click. That file moves to fake timers behind a `mark()` helper.

## Technical Context

**Language/Version**: TypeScript 7.0.2 (`strict`), React 19.2.8

**Primary Dependencies**: Tailwind 4.3.3, `tw-animate-css` 1.4.0, `radix-ui`
1.6.7, React Router 8.3.0 (browser mode). **Nothing added.**

**Storage**: none touched. No `schemaVersion` bump, no migration — the guard is
presentation state (FR-010).

**Testing**: Vitest 4.1.11 + React Testing Library + `user-event` 14.6.6, jsdom.
Visual behaviour verified in a real browser via Playwright driven from the
scratchpad, never added to `package.json`.

**Target Platform**: static SPA, `dist/` on Cloudflare Pages. Touch-first; the
reported defect is a finger bounce.

**Project Type**: single-project client-only SPA.

**Performance Goals**: 60fps. The animation is `transform` + `opacity` only, so it
composites without layout or paint. The bars' fill is an existing `transform`
transition.

**Constraints**: the guard must never leave a control permanently dead — that is
why each phase is closed by a timeout and not by an animation event
([research.md](./research.md) § 5). The tuning surface must be one file
(FR-007, FR-007a), and the guard window must be *derived* from the two phase
durations rather than given one of its own (FR-006).

**Scale/Scope**: one screen, four files, no data.

**No behaviour change to persistence.** The write stays on the press. An earlier
draft of this plan deferred it to the exit/entry boundary to keep the engine and
the paint in step; the maintainer overruled that, correctly — it bought tidiness
and paid in lost marks. Applying on the press also removes the one genuinely
dangerous case the deferred design created: a scheduled outcome landing after a
"Start over", on a run it was never meant for.

## Constitution Check

*Checked before Phase 0, and again after Phase 1 design. Result unchanged.*

| Principle | Status | Note |
|---|---|---|
| I. Client-only static SPA | ✅ | CSS and component state. No server, no SSR, no route change |
| II. localStorage is the system of record | ✅ | No new key, no shape change, no migration, and the write does not move. FR-014 makes "no mark is ever lost to an animation" a requirement |
| III. Green CI or it does not merge | ✅ | Existing gate. No runtime change, `.nvmrc` untouched |
| IV. Test behavior, not implementation | ⚠️ **see below** | Motion cannot be asserted in jsdom without class names |
| V. Minimal dependency surface | ✅ | Zero added. `tw-animate-css` was already installed. No vendored component is modified |
| VI. Build only what was asked | ✅ | Guard + transition + a tuning surface. Nothing adjacent |
| VII. Self-contained, no host pollution | ✅ | Playwright runs from the scratchpad via `npx`, never `npm install -g`, never in `package.json` |
| VIII. Free, open, reputable, stable | ✅ | No dependency added, so no license to record |

**Principle IV, stated plainly rather than waved past.** The guard's *behaviour*
is fully unit-tested by role and visible text: two presses, one card marked. The
*motion* is not, and cannot be — jsdom applies no CSS, and querying
`animate-in` would be exactly the class-name assertion the principle forbids. So
the visual requirements (FR-005, FR-005a, FR-005b, FR-005c, FR-006, FR-007a) are
verified in a real browser and recorded, per the repo's habit of recording what
the checks showed rather than that they ran. This is the split the principle
intends, not an exemption from it. The table in [research.md](./research.md) § 8
says which requirement is proved where.

**One coverage hole, named**: FR-011's pronounce guard has **no** unit test
available. `PronounceButton` returns `null` when `speechSynthesis` is absent,
which is the path jsdom takes, so no test can reach the control. Browser check
only.

## Project Structure

### Documentation (this feature)

```text
specs/009-card-advance-guard/
├── spec.md                      # /speckit-specify + /speckit-clarify
├── plan.md                      # This file
├── research.md                  # Phase 0 — nine decisions, one verified by compiling
├── data-model.md                # Phase 1 — transient state only; nothing persisted
├── quickstart.md                # Phase 1 — CI gate, nine browser checks, how to tune
├── contracts/
│   └── card-advance.md          # Phase 1 — the UI contract for the card block
├── checklists/
│   └── requirements.md          # 16/16
└── tasks.md                     # /speckit-tasks — NOT created here
```

### Source Code (repository root)

```text
src/
├── run/
│   └── advance.ts               # NEW — the whole tuning surface. Two exports
├── routes/
│   ├── Run.tsx                  # The guard, the counter, the wrapper, the clock
│   └── Run.test.tsx             # Fake timers + mark() helper + new guard tests
└── components/
    └── PronounceButton.tsx      # + `guarded` prop, early return in speak()
```

**Structure Decision**: no new directory and no new component. The guard is
`RunLoop`'s business because `RunLoop` already owns every other piece of
per-presentation state (`heard`, `storageFull`) and already routes every
transition through one `apply`. The one new file is the tuning surface, which
exists because FR-007 requires a single place — not because the logic needed
somewhere to live.

One caveat on that placement, since it breaks a pattern rather than following
one: `src/run/` is otherwise pure engine — `reducer.ts`, `selectors.ts` and
`types.ts` import no React and name no Tailwind class. `advance.ts` will name
several. The alternative is splitting the number into `src/run/` and the classes
into `src/components/`, which puts the tuning surface in two directories and
breaks FR-007's "one place" for the sake of a directory convention. One file in
`src/run/` that carries presentation values, with a comment saying why, is the
smaller cost. Worth a reviewer's attention.

**Untouched**: `src/storage/`, `src/decks/`, `src/run/reducer.ts`,
`src/run/selectors.ts`, `src/components/CardFace.tsx`,
`src/components/OutcomeButtons.tsx`, `src/components/RunProgress.tsx`,
`src/components/ui/progress.tsx`, `package.json`, `package-lock.json`.

**No vendored component is modified.** The progress bars already ease their fill —
the indicator has carried `transition-all` since it was vendored — and they sit on
their own layer above the card, so they need nothing from this feature
([research.md](./research.md) § 6).

`OutcomeButtons.tsx` not changing is worth stating: the guard is a decision about
*whether a mark happens*, which is the run loop's business, and the dim is the
group animation rather than anything the buttons do to themselves. A component
that renders two buttons should not learn about timers.

## The four changes

1. **`src/run/advance.ts`** (new, ~15 lines). `CARD_EXIT_MS = 140`,
   `CARD_ENTRY_MS = 180`, and the two class strings. Nothing else names a
   duration: the guard window is their sum, derived (FR-006). The file's comment
   says these are meant to be edited.

2. **`src/routes/Run.tsx`**, the bulk of the work.
   - The phase machine: `phase`, `presentation`, `guarded`, and one `pending`
     timer ref. See [data-model.md](./data-model.md) for the table and the
     diagram.
   - `apply` is called **from the click**, unchanged: the outcome and its storage
     write happen immediately (FR-005d, FR-014). The animation follows and carries
     nothing.
   - `leaving` is set to the card on screen at the same moment, and cleared at the
     boundary. `shownId = leaving ?? currentCard(state)` and
     `complete = isComplete(state) && leaving === null` are the entire divergence
     between what is true and what is painted.
   - `presentation` increments **at the boundary**. Incrementing it on the press
     would unmount the outgoing card mid-exit, leaving nothing to animate out.
   - `heard` resets at the boundary rather than in `apply`, because the outgoing
     card is still on screen through the exit and its emphasis belongs to it.
   - Every transition clears `pending` first (FR-013). Lower stakes than in the
     deferred design — the timer carries no unapplied outcome — but a stale one
     would still drop the guard early on a transition already replaced.
   - The outcome handler returns early while `guarded`. Guarding there rather than
     inside `apply` keeps "Repeat this run" live with no condition written for it
     (FR-009).
   - `CardFace` and the two-column grid move inside one wrapper keyed by
     `presentation`, carrying `CARD_EXIT_CLASSES` while exiting and
     `CARD_ENTRY_CLASSES` otherwise.
   - The run-complete screen carries `CARD_ENTRY_CLASSES` too — it is the entry
     that pairs with the last card's exit (FR-005e).
   - A plain outer `<div>` sets `--card-exit` and `--card-entry`, enclosing both
     the bars and `<main>`.
   - **Spacing must not change.** `<main>` goes from spacing four children to
     three, so the wrapper carries `flex w-full flex-col items-center gap-8` and
     the rendered gaps stay identical (contract § 8).

3. **`src/components/PronounceButton.tsx`**. A `guarded` prop and one early
   return at the top of `speak()`. Two lines. Untestable in jsdom, as above.

4. **`src/routes/Run.test.tsx`**. `vi.useFakeTimers()`,
   `userEvent.setup({ advanceTimers })`, and a `mark()` helper replacing 46 direct
   clicks. The helper advances by the **imported** `CARD_EXIT_MS + CARD_ENTRY_MS`.
   A literal there would be the second copy of the number FR-007 exists to
   prevent, and would break SC-004. Then the new tests, including two the
   model makes necessary: the outcome is *already* stored with no timer advance at
   all, while the marked card is still painted (FR-005d, FR-014), and a "Start
   over" mid-exit leaves one coherent run with the earlier mark still recorded
   (FR-013).

## What the maintainer's four points changed

All four are in. Two open questions from the previous plan closed themselves:

| Previously flagged | Now |
|---|---|
| "A Start over swaps the card with no animation" — a visible asymmetry, followed literally from the spec's Edge Cases | Gone. Start over plays both phases like a mark, and opens a guard window, because the restarted card would otherwise arrive unprotected under a finger. The spec's Edge Case and FR-012 were amended |
| "FR-011's rationale does not hold, because enter-only leaves no outgoing card" | Gone. There is an outgoing card painted for the whole exit, so leaving the speaker live really would let it say the incoming word over it. FR-011 reads correctly as written |
| A vendored `progress.tsx` edit, to put the bars on the card's clock | Dropped. The bars are a layer above the card, not part of the moving group, and they already ease. Four files, not five |

Two things the points required the spec to change, both amended:

- **FR-010** — the first card of a run now plays an entry. It is still *not*
  guarded: no earlier press exists to bounce from, so a guard there protects
  against nothing and only delays the learner.
- **FR-009** — the run-complete screen now plays an entry, and is still not
  guarded. Both fall out of the structure rather than needing a condition
  ([research.md](./research.md) § 4b).

And two requirements the model made necessary: **FR-013** (a new transition
replaces the one in flight) and **FR-014** (no outcome is ever lost to an
interruption — the requirement that settles where the mark happens).

## Complexity Tracking

No constitution violations to justify. The Principle IV split above is the
principle working as written, not a deviation — it is recorded in the
Constitution Check rather than here because nothing is being waived.
