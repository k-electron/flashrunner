---
description: 'Task list for 009-card-advance-guard'
---

# Tasks: Card Advance Guard

**Input**: Design documents from `/specs/009-card-advance-guard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/card-advance.md](./contracts/card-advance.md), [quickstart.md](./quickstart.md)

**Tests**: Required, not optional. This is a bug fix, so constitution Principle IV
applies: "every bug fix adds a test that fails against the unfixed code". Three
tasks below are written red first and must be *observed* failing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in every description

---

## Read this before starting: the stories are not independent

The template assumes each user story is a standalone slice. **Here they are not**,
and pretending otherwise would produce a wrong plan:

- **US3's file is a prerequisite for US1 and US2.** `src/run/advance.ts` holds the
  durations both need, so it is built in Setup rather than in a US3 phase. What is
  left of US3 afterwards is verification, not construction.
- **US1 and US2 share one state machine.** The guard needs a timer; the transition
  needs to know which phase is running. Building US1 with a single timer and then
  splitting it for US2 means rewriting the guard, so the two-phase machine is built
  once, in US1's phase, and US2 wires the animation onto it.
- **US1 is correct but not shippable alone.** A guard with no visible transition is
  precisely the "buttons feel broken" screen the feature exists to avoid. **The MVP
  is Phase 3 + Phase 4 together**, not Phase 3.

Phase 2 exists for one reason and is the most important sequencing decision here.
See its note.

---

## Phase 1: Setup

**Purpose**: The tuning surface, which everything else reads.

- [X] T001 Create `src/run/advance.ts` exporting `CARD_EXIT_MS = 140`, `CARD_ENTRY_MS = 180`, `CARD_EXIT_CLASSES` (`animate-out fade-out-40 slide-out-to-top-2 ease-in fill-mode-forwards duration-(--card-exit)`) and `CARD_ENTRY_CLASSES` (`animate-in fade-in-40 slide-in-from-bottom-2 ease-out duration-(--card-entry)`), with a comment stating that these values are meant to be edited, that the guard window is their sum and is never written down, and that the two `fade-*-40` percentages must stay equal

**Depends on**: nothing.

**Discharges**: FR-007, FR-007a, and the constructive half of US3.

---

## Phase 2: Foundational — migrate the test harness while the suite is still green

**⚠️ CRITICAL**: No source change may land before this phase is complete.

**Why this is first, and not folded into US1**: 53 call sites in
`src/routes/Run.test.tsx` press a button that will start a transition — 46 outcome
presses, 5 `Start over`, 2 `Repeat this run`. Once the machine lands, a press with
no timer advance leaves the screen mid-transition, so those tests fail. Doing the
migration *after* the feature means staring at ~50 failures with no way to tell
harness breakage from feature breakage.

Advancing fake timers when no timer is pending is a no-op, so this migration is
**inert against the current code**: the suite is green before it and green after
it. That is what T004 exists to prove.

- [X] T002 Add `vi.useFakeTimers()` / `vi.useRealTimers()` around the suites in `src/routes/Run.test.tsx` and give every `userEvent.setup()` call `{ advanceTimers: vi.advanceTimersByTime }`, in `renderRunWithRouter`, `renderRun` and `renderJourney`
- [X] T003 Add `settle()`, `mark(user, name)` and `restart(user, name)` helpers to `src/routes/Run.test.tsx` that click and then advance by `CARD_EXIT_MS + CARD_ENTRY_MS` **imported from `@/run/advance`**, never a literal, and route all 53 sites through them — including `clearRun` and the two `Repeat this run` presses
- [X] T004 Run `npx vitest run src/routes/Run.test.tsx` and confirm it is **green with no source change**. A failure here is a harness bug, and fixing it now costs minutes rather than being mistaken for a feature bug later

**Depends on**: T001 (T003 imports the constants).

**Blocks**: everything in Phases 3-5.

---

## Phase 3: US1 — A double tap does not mark two cards (P1)

**Goal**: A second press inside the window marks nothing.

**Independent test**: Press an outcome, fire a second activation immediately, and
assert exactly one card advanced and the newly presented card is still unanswered.

**Not shippable alone** — see the note at the top. Pair with Phase 4.

- [X] T005 [US1] Write the double-tap test in `src/routes/Run.test.tsx`: press "Got it" twice with no timer advance between, assert only one card was marked and the second card is still presented. **Run it and confirm it FAILS** against the unguarded code (Principle IV)
- [X] T006 [US1] Add the two-phase machine to `RunLoop` in `src/routes/Run.tsx`: `phase` (`'exiting' | 'entering' | 'idle'`, initial `'entering'`), `guarded` (initial `false`), `presentation` (initial `0`), and one `pending` timer ref. A press applies the action immediately, sets `guarded`, enters `'exiting'`, then at `CARD_EXIT_MS` increments `presentation` and enters `'entering'`, then at `CARD_ENTRY_MS` returns to `'idle'` and clears `guarded`. Built as two phases now rather than one timer, because splitting it later would mean rewriting the guard
- [X] T007 [US1] Guard the outcome handler in `src/routes/Run.tsx` — return early while `guarded`, at the `onMark` call site and **not** inside `apply`, so "Repeat this run" and "Start over" stay live with no condition written for either. T005 now passes
- [X] T008 [US1] Clear `pending` at the top of every transition and on unmount in `src/routes/Run.tsx` (FR-013), so a replaced transition cannot drop the guard early or clear state after the screen is gone
- [X] T009 [P] [US1] Add tests in `src/routes/Run.test.tsx` for FR-002 (a press on the *other* button inside the window is ignored) and FR-003 (a blocked press moves neither progress bar and writes nothing to storage)
- [X] T010 [P] [US1] Add a test in `src/routes/Run.test.tsx` for FR-004: keyboard activation and held-key auto-repeat are guarded exactly like a tap
- [X] T011 [P] [US1] Add tests in `src/routes/Run.test.tsx` for FR-009 (the completion screen's controls work with no advance), FR-010 (a resumed run's first card is markable on arrival) and FR-012 ("Start over" is never blocked, and does open a window of its own)
- [X] T012 [P] [US1] Add tests in `src/routes/Run.test.tsx` for FR-005d and FR-014: with **no timer advance at all** the outcome is already in storage and both bars have already moved; and unmounting mid-exit then rendering again resumes on the *next* card, proving the mark survived (SC-003b)
- [X] T013 [US1] Add a test in `src/routes/Run.test.tsx` for FR-013: press "Got it", then "Start over" mid-exit, and assert one coherent run with the earlier mark still recorded

> **T013 as written was not achievable.** `restart()` in `src/run/reducer.ts` calls
> `start()`, which builds a fresh run, so a "Start over" discards run progress by
> design and "the earlier mark still recorded" cannot hold. Built as: one coherent
> run after the replaced transition, plus a second test that *staggers* the two card
> changes by a phase. The staggered one matters — with both changes starting on the
> same frame, deleting `clearTimeout(pending.current)` leaves the same-frame test
> green, because the stale and live timers coincide. It is the only thing in the
> suite that catches that regression.

**Depends on**: T004. T006 → T007 → T008 strictly serially, all in `RunLoop`.
T009-T012 are parallel with each other (test-only, independent cases) but all need
T007. T013 needs T008.

---

## Phase 4: US2 — The wait reads as a transition, not a broken screen (P2)

**Goal**: The card and its buttons leave and arrive as one group, dimming and
recovering as one continuous gesture.

**Independent test**: Mark a card and watch. Card and buttons move as one,
restrained, settling at the moment the buttons become pressable.

**This plus Phase 3 is the MVP.**

- [X] T014 [US2] Wrap `CardFace` and the two-column grid in one element in `src/routes/Run.tsx`, keyed by `presentation`, and give it `flex w-full flex-col items-center gap-8` so `<main>` spacing three children instead of four renders identically (contract § 8). Verify the gaps are unchanged before going further
- [X] T015 [US2] Add `leaving: string | null` to `RunLoop` in `src/routes/Run.tsx`, set to the card on screen at the moment of any press that changes the card and cleared at the boundary, and derive `const shownId = leaving ?? currentCard(state)` and `const complete = isComplete(state) && leaving === null`. These two lines are the whole divergence between what is true and what is painted — nothing else may read `leaving`
- [X] T016 [US2] Point `CardFace` at `shownId` in `src/routes/Run.tsx`, and move the `setHeard(false)` reset out of `apply` and into the boundary callback, because the outgoing card is still painted through the exit and its emphasis belongs to it
- [X] T017 [US2] Apply `CARD_EXIT_CLASSES` while `phase === 'exiting'` and `CARD_ENTRY_CLASSES` otherwise to the wrapper from T014, in `src/routes/Run.tsx`
- [X] T018 [US2] Wrap `RunProgress` and `<main>` in a plain `<div>` in `src/routes/Run.tsx` carrying `style={{ '--card-exit': `${CARD_EXIT_MS}ms`, '--card-entry': `${CARD_ENTRY_MS}ms` }}`, so both inherit to everything below. No classes on this div
- [X] T019 [US2] Give the run-complete screen `CARD_ENTRY_CLASSES` in `src/routes/Run.tsx` — it is the entry that pairs with the last card's exit (FR-005e). It stays unguarded, which needs no code because the guard is only read at the outcome handler
- [X] T020 [P] [US2] Add a `guarded?: boolean` prop to `src/components/PronounceButton.tsx` and return early at the top of `speak()` while it is set (FR-011). Note in the file that this cannot be unit-tested: the component returns `null` without `speechSynthesis`, which is the path jsdom takes
- [X] T021 [US2] Pass `guarded` to `PronounceButton` from `src/routes/Run.tsx`, and pass it the word for `shownId` rather than the engine's current card, so its word-keyed cleanup matches what is painted
- [X] T022 [US2] Add a test in `src/routes/Run.test.tsx` for FR-005d's visible half: immediately after a press, the marked card's word is **still on screen** while storage already holds the outcome

**Depends on**: T006-T008 (the machine and `phase` must exist). T014 → T015 → T016
→ T017 strictly serially in `RunLoop`. T018 and T019 need T014. **T020 needs only
T006** — it is in another file and can be done any time from Phase 3 onwards — but
T021 needs both T020 and T015. T022 needs T015 and T016.

---

## Phase 5: US3 — The duration can be tuned without a rewrite (P2)

**Goal**: Retiming is a one-value edit that breaks nothing.

**Independent test**: Change one value, reload, and both the transition and the
unpressable window change together.

**Mostly discharged by T001.** What remains is proof, not construction — which is
why this phase is short and why it cannot come earlier: there is nothing to verify
until Phases 3 and 4 have consumed the constants.

- [X] T023 [US3] Temporarily set `CARD_EXIT_MS` and `CARD_ENTRY_MS` to different values in `src/run/advance.ts`, run `npx vitest run src/routes/Run.test.tsx`, and confirm the suite is green with **no test edit** (SC-004). Restore the values
- [X] T024 [US3] Set both durations to `0` in `src/run/advance.ts`, run the suite, and confirm one press still marks exactly one card and the outcome is applied and stored (FR-008). Restore the values
- [X] T025 [US3] Grep for duration literals outside `src/run/advance.ts` — `grep -rn "[0-9]\{2,\}ms\|CARD_EXIT_MS = \|CARD_ENTRY_MS = " src/` should show only that file's definitions, and no test may contain a timing number

**Depends on**: Phase 4 complete.

---

## Phase 6: Verification, tuning and cross-cutting

- [X] T026 Run the full CI gate: `npm run lint && npm run typecheck && npm test && npm run build`
- [X] T027 Confirm the change set is exactly four files — `git diff --stat main -- src/` — with **no change to `package-lock.json`**, nothing under `src/components/ui/`, and nothing under `src/storage/`
- [X] T028 Walk the twelve browser checks in [quickstart.md](./quickstart.md) § 3 against `npm run dev`, driving Playwright from the scratchpad via `npx playwright@1.62.1`. These are the whole verification of FR-005, FR-005a, FR-005b, FR-005c, FR-006, FR-007a and FR-011 — jsdom applies no CSS and Principle IV forbids asserting class names
- [X] T029 Measure the three checks that are measurements rather than impressions: the buttons' `boundingBox()` before and after settling is identical (FR-005a), the block's computed opacity is monotonic down then up with **no step at the boundary** (FR-005b, SC-003a), and a press one frame before the entry ends is refused while one frame after is accepted (FR-006)
- [X] T030 Tune `CARD_EXIT_MS` and `CARD_ENTRY_MS` across several passes against the sanity bounds in [quickstart.md](./quickstart.md) § 4 — below ~120ms total the protection stops working, above ~450ms total an adult marking quickly starts waiting. **"Subtle, polished, tasteful" is the acceptance test and it is a judgement**, so expect to come back here
- [X] T031 **Condition did not fire.** The exit stayed at 140ms, far short of the ~250ms that would have made the bar land visibly early, and browser check 7 measured 15 distinct bar transforms *while the card was still leaving*. `src/components/ui/progress.tsx` is untouched and the change set stays at four files. Original task: check the one condition that would re-couple the progress bars ([research.md](./research.md) § 6): if T030 leaves the exit much past ~250ms, confirm the bar does not visibly finish filling while the card is still leaving. If it does, add `duration-[var(--card-exit,150ms)]` to the indicator in `src/components/ui/progress.tsx` and say so in the PR — it takes the change set to five files
- [X] T032 Record what the browser checks actually showed, not that they were run, in [quickstart.md](./quickstart.md)
- [X] T033 Open the PR against `main`, describing what was asked for so Principle VI can be checked against it, linking issue #237, and stating that no dependency was added and no vendored component modified

**Depends on**: T026 needs Phase 5. T028-T032 need T026. T030 → T031 → T032
serially. T033 last.

---

## Dependencies

### Phase order

```text
Phase 1 (T001)
   │
   ▼
Phase 2 (T002 → T003 → T004)        ← hard gate. No source change before T004 is green
   │
   ▼
Phase 3 (US1)  T005 ──► T006 ──► T007 ──► T008
                                   │        │
                                   │        └──► T013
                                   └──► T009, T010, T011, T012  (parallel)
   │
   ▼
Phase 4 (US2)  T014 ──► T015 ──► T016 ──► T017
                 │        │
                 │        └──► T021 ◄── T020  (T020 is in another file)
                 └──► T018, T019
   │
   ▼
Phase 5 (US3)  T023, T024, T025
   │
   ▼
Phase 6        T026 ──► T027, T028 ──► T029 ──► T030 ──► T031 ──► T032 ──► T033
```

### The dependencies that are easy to get wrong

| Claim | Reality |
|---|---|
| "The three user stories are independent" | **No.** US3's file is a prerequisite for both others (T001 in Setup). US1 and US2 share one state machine. US1 alone ships a screen with dead buttons and no feedback |
| "Migrate the tests after the feature works" | **Backwards.** Do it first, while it is inert and the suite is green. Afterwards you cannot separate harness failures from feature failures across ~50 tests |
| "Build the guard with one timer, split it for US2 later" | Means rewriting the guard. T006 builds both phases at once, deliberately slightly ahead of US1's own need |
| "US3 is a phase of work" | Almost all of it is T001. Phase 5 is verification, and it must come *after* Phase 4 because there is nothing to verify until the constants have consumers |
| "The progress bars need a task" | They need none. They already ease, and they are a layer above the card rather than part of the group. T031 is a *conditional* task that only fires if tuning exposes a problem |
| "46 test sites need updating" | **53.** The 46 outcome presses, plus 5 `Start over` and 2 `Repeat this run`, which also animate now. The plan and issue #237 quote 46, which counted only outcome presses |

### Parallelism is genuinely limited, and marking more would be dishonest

Four files, and the two that carry the work are serial by nature: 10 tasks edit
`src/routes/Run.tsx` in a strict order because they build one state machine
incrementally, and 11 edit `src/routes/Run.test.tsx`. Real parallel
opportunities:

- **T009, T010, T011, T012** — four independent test cases, all needing T007. The
  only meaningful parallel block.
- **T020** (`PronounceButton.tsx`) can be written any time after T006, in parallel
  with the `Run.tsx` work, since only T021 joins them.
- **T028's twelve browser checks** are independent of each other, though they are
  one person at one screen.

Everything else is serial. `[P]` appears on five tasks — T009, T010, T011, T012,
T020 — and that is the honest count. Padding it would mislead whoever schedules
this work.

---

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + Phase 3 + Phase 4.** All four. Phase 3 alone is
correct and unshippable: the guard works, and the screen looks broken.

Suggested checkpoints:

1. **After T004** — the suite is green, nothing has changed. Cheapest possible
   place to discover a harness problem.
2. **After T005** — a failing test that names the bug. Principle IV satisfied
   before any fix exists.
3. **After T013** — the defect is fixed and proven. Screen still looks wrong.
4. **After T022** — the feature is complete and the MVP is real.
5. **After T030** — it feels right, which is the only acceptance test that matters
   for the motion and the one that will take the most passes.

Phase 3 is red in its middle on purpose: T005 fails until T007. That is the point
of writing it first.

**Total: 33 tasks.** T001 (setup), T002-T004 (harness), T005-T013 (US1, 9),
T014-T022 (US2, 9), T023-T025 (US3, 3), T026-T033 (verification and tuning, 8).

---

## Phase 7: Convergence

- [X] T034 Reconcile the progress bars' arrival timing per US2/AC4 (partial). **Resolved: no code change.** The maintainer's intent is that the bar and the card move *in parallel at their own speeds*, not that they finish together. Measured on the shipping build: the bar moves 41ms -> 182ms and the card 49ms -> 316ms, both starting on the press, overlapping for 133ms — parallel, never sequential. So the code already satisfies the intent, and AC4's trailing clause "and arrives as the card block settles" is the stale wording, superseded by FR-005c ("not required to share its timing") and SC-003 ("the bars ease too, on their own layer and their own timing"), both of which hold.

> **A coupling attempt was tried and reverted, and is worth recording so nobody
> repeats it.** Putting the indicator on a derived `--card-window` did make the
> two end together (both ~348ms), but it cost the bar its own speed, which is
> the thing the maintainer actually wanted kept. Two mechanical findings survive
> the revert: Tailwind registers `--tw-duration` as
> `@property { inherits: false }`, so a `duration-*` on the `Progress` Root
> never reaches the indicator by inheritance; reaching it needs a child variant
> (`[&>*]:duration-(--card-window)`), which does work and needs no edit to the
> vendored `ui/progress.tsx`. That is the route if the bars are ever genuinely
> wanted on the card's clock.
>
> AC4's stale clause will make a future `/speckit-converge` re-raise this. Amend
> the one line in spec.md if that matters; the behaviour is settled either way.
