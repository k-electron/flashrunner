---

description: "Task list for Screen Transition Lock"
---

# Tasks: Screen Transition Lock

**Input**: Design documents from `/specs/010-screen-transition-lock/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/screen-lock.md](./contracts/screen-lock.md),
[quickstart.md](./quickstart.md)

**Tests**: Included and non-optional. The spec calls the release path safety
critical, and [research](./research.md) Decision 2 found that the obvious
implementation is invisible to this repo's test environment — so the tests are the
deliverable that makes the lock's absence detectable, not an add-on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: Which user story the task serves (US1-US4)
- Every task names the file it touches

---

## Read this before starting

**The four user stories are not four increments.** US1, US2 and US4 are the same six
lines in `src/routes/Run.tsx`; US3 is those same six lines applied to the other arm of
one existing branch. No story can be shipped without the others, and there is no MVP
subset that leaves the app in a state worth deploying — a half-applied lock is a screen
where some controls are dead and some are not, which is what 009 already is.

So the phases below are ordered by **risk**, not by story independence, and the story
labels record which requirement each test discharges rather than a slice that could
ship alone. Phases 3-6 are one commit (see [Dependencies](#dependencies)).

**The single largest hazard is the test harness, not the feature.** `renderRun` mounts
the screen at `phase: 'entering'`, and `press()` clicks *before* it settles. The moment
the lock lands, the first press of nearly every one of the 66 tests is discarded and the
suite fails en masse for a reason that has nothing to do with whether the lock is
correct. Phase 2 fixes that first, against the current code, while the suite is still
green — the same sequencing 009 used for its own harness migration.

---

## Phase 1: Setup

**Purpose**: A branch, and a recorded green baseline to compare against.

- [ ] T001 Create branch `010-screen-transition-lock` from `main` (constitution: `main` is deployable, branch → PR)
- [ ] T002 Run `npm test` and record the passing count in the PR description as the baseline, so Phase 2's "still green" claim has something to be measured against (depends on T001)

**Depends on**: nothing.

**Blocks**: everything.

---

## Phase 2: Foundational — make the harness survive a locked mount

**⚠️ CRITICAL**: No source change may land before this phase is complete and green.

**Why this is first**: `renderRunWithRouter`, `renderRun` and `renderJourney`
(`src/routes/Run.test.tsx:131-157`) return a `user` on a screen whose mount entry is
still running. Today that is harmless: `guarded` initialises to `false`, so a press
lands. Under FR-020 the mount entry locks, and every test that renders and immediately
presses gets nothing.

This migration is **inert against the current code**: settling at mount just runs the
entry timer that is already pending. The suite is green before it and green after it,
which is what T006 exists to prove.

- [ ] T003 Settle on arrival in `src/routes/Run.test.tsx`: have `renderRunWithRouter` and `renderJourney` call the existing `settle()` after `render`, so every rendered run starts at `phase: 'idle'`. Keep the pre-settle render reachable as `renderRunArriving` — T014a and T014b are the two cases that must press *during* the mount entry, and they cannot use a helper that has already settled it (depends on T002)
- [ ] T004 Audit all 47 direct `user.click(` sites in `src/routes/Run.test.tsx` and classify each in a comment-free triage list: (a) acts on an already-settled screen — no change, (b) acts deliberately mid-transition — must be preserved verbatim, because these are the cases whose *meaning* flips in Phases 3-6, (c) acts on a freshly rendered screen — now covered by T003 (depends on T003)
- [ ] T005 [P] Add a `settled()` assertion helper to `src/routes/Run.test.tsx` that asserts the run wrapper is **not** `inert`, and a `locked()` helper that asserts it is, both reached from `screen.getByRole('main')` and its parent element — one place for the structural assertion that [plan.md](./plan.md) Complexity Tracking justifies, so no test spells out the attribute (depends on T003)
- [ ] T006 Run `npx vitest run src/routes/Run.test.tsx` and confirm it is green **with no change under `src/` outside the test file**. A failure here is a harness bug and costs minutes now; mistaken for a feature bug in Phase 3 it costs an afternoon (depends on T003, T004, T005)

**Depends on**: T002.

**Blocks**: T007 and everything after it.

**Discharges**: nothing on its own. It is what makes the rest measurable.

---

## Phase 3: US1 — A press during motion never lands (P1)

**Goal**: While the run screen is transitioning, nothing on it can be activated.

**Independent test**: Mark a card, then attempt every control on the screen before the
incoming card settles. No mark, no restart, no navigation, no speech. Wait, then confirm
each one works.

- [ ] T007 [US1] In `src/routes/Run.tsx`, add `const locked = phase !== 'idle'` in `RunLoop` and put `inert={locked}` on the outermost wrapper `<div>` — the one already carrying `--card-exit` and `--card-entry` — with a comment naming why the wrapper and not `<main>`: it is the only element containing the card block, "Start over", "Leave this run", and the run-complete arm (depends on T006)
- [ ] T008 [US1] In `src/routes/Run.tsx`, add capture-phase interception on that same wrapper: an effect that registers a **native** listener with `addEventListener(type, handler, true)` for `click` and — if the auto-repeat and Space/Enter cases in T013 need it — `keydown`, calling `preventDefault()` and `stopPropagation()` while locked, with a cleanup that removes them. **Not** React's `onClickCapture`: React's synthetic capture only reaches handlers registered through React, so a descendant that attaches its own native listener would slip past it, and FR-002 promises coverage regardless of how a control is wired. Native capture on the ancestor fires before every descendant listener whatever attached it — which is also what makes T024's probe possible. Comment must state that `inert` is the native semantic and this is the enforcement jsdom can observe, citing [research](./research.md) Decision 2 (depends on T007)
- [ ] T009 [US1] In `src/routes/Run.tsx`, delete the `guarded` state and its initialiser, and delete the `if (guarded) return` from the `onMark` callback passed to `OutcomeButtons`, along with the comment explaining why the guard was read at that one call site (depends on T008)
- [ ] T010 [US1] In `src/components/PronounceButton.tsx`, remove the `guarded` prop from the signature, its `if (guarded === true) return` in `speak()`, and the note claiming no unit test can reach it — that note is now wrong twice over, since the prop is gone and the `hearing the word` suite stubs `speechSynthesis` (depends on T009)
- [ ] T011 [US1] In `src/routes/Run.test.tsx`, rename `describe('Run — where the guard is not (FR-009, FR-010, FR-012)')` to reflect that there is nowhere the lock is not, and rewrite its `restarts from inside a window opened by a mark (FR-012)` case to assert the opposite: a "Start over" pressed mid-transition leaves the run untouched (depends on T008)
- [ ] T012 [US1] In `src/routes/Run.test.tsx`, add a case asserting that `Leave this run` activated mid-transition does not navigate — the run screen is still mounted and the ladder is not, using `renderJourney` so the destination is real (depends on T008)
- [ ] T013 [US1] In `src/routes/Run.test.tsx`, confirm the two existing bounce cases in `describe('Run — a bounced press does not mark two cards (US1)')` still pass unchanged — the second-press case and `marks one card for a held key that auto-repeats (FR-004)`. These are the suite's proof that the interceptor works; if either goes red, T008's event list is wrong, not the tests (depends on T008)
- [ ] T014 [US1] In `src/routes/Run.test.tsx`, inside `describe('Run — hearing the word (US1)')` where `speechSynthesis` is stubbed and the control actually renders, add a case asserting a mid-transition press of `Hear the word` neither speaks nor sets `heard` (depends on T008, T010)
- [ ] T014a [US1] In `src/routes/Run.test.tsx`, add a case using `renderRunArriving` that presses `Got it` while the **first card of a fresh run** is still arriving and asserts nothing is marked, then settles and asserts the same press marks. This is the only test of FR-020's positive half, and T003 is precisely why no existing test can catch its regression — every other case settles at mount (depends on T003, T008)
- [ ] T014b [US1] In `src/routes/Run.test.tsx`, rewrite `marks the first card of a resumed run on arrival (FR-010)` — one of the five cases T007-T010 turn red — into its opposite: a seeded run rendered with `renderRunArriving` refuses a press during its entry, then accepts one after settling, and the refusal is the mount entry rather than anything read off the device (depends on T003, T008)

**Depends on**: Phase 2 complete.

**Discharges**: FR-001, FR-002 (partly — T025 completes it), FR-003, FR-004, FR-005,
FR-006, FR-007, FR-015, FR-020, and the deletion half of FR-011.

---

## Phase 4: US2 — The lock always lets go (P1)

**Goal**: No sequence of events leaves the screen locked with no release pending.

**Independent test**: Interrupt a transition every way available — a second card change
mid-flight, a teardown, a zero-length phase, the exact phase boundary — and find the
screen live afterwards in each case.

- [ ] T015 [US2] In `src/routes/Run.test.tsx`, add a contiguity case: mark a card, `advanceToBoundary()` to land exactly on the exit's end, and assert the screen is still locked via the `locked()` helper — no live frame mid-motion (depends on T005, T008)
- [ ] T016 [P] [US2] In `src/routes/Run.test.tsx`, add a zero-duration case that stubs `CARD_EXIT_MS` and `CARD_ENTRY_MS` to `0` and asserts one press marks exactly one card and the screen is settled afterwards. Note the existing one-millisecond fake-timer floor that `settle()` already works around (`src/routes/Run.test.tsx:163`) — the case must use `settle()`, not a literal advance (depends on T005, T008)
- [ ] T017 [US2] In `src/routes/Run.test.tsx`, delete `describe('Run — a card change replaces the one in flight (FR-013)')` — both cases. Each drives "Start over" mid-transition, which FR-001 now refuses, so their premise is unreachable and rewriting them would only duplicate T011. Leave a comment at the deletion site recording that FR-013 survives as the retained invariant in [spec.md](./spec.md) with no input able to reach it, so nobody restores the block believing coverage was lost (depends on T008, T011)
- [ ] T018 [P] [US2] In `src/routes/Run.test.tsx`, add an unmount case: begin a transition, unmount, advance past both durations, and assert no act warning and no state update — the release was cleared, not fired at a gone screen (depends on T008)
- [ ] T019 [US2] Confirm no code change is needed for FR-009 and FR-010 by reading `beginTransition` and the unmount effect in `src/routes/Run.tsx`: the `setTimeout`/single-`pending`-ref discipline already satisfies them. If a change *is* needed, it belongs here and nowhere later (depends on T008)

**Depends on**: Phase 3.

**Discharges**: FR-009, FR-010, FR-011, FR-011a, FR-012, FR-014, and FR-013 by
retiring the block that claimed to test it.

---

## Phase 5: US3 — The run-complete screen is a card (P2)

**Goal**: The completion screen is locked while it arrives, and no code mentions it.

**Independent test**: Clear a run, attempt "Repeat this run" and "Next run" while the
screen is arriving, then again once it has settled.

- [ ] T020 [US3] In `src/routes/Run.test.tsx`, rewrite `repeats the run from the frame the completion screen appears (FR-009)` to assert the opposite: pressed at the boundary, while the completion screen's own entry is still to come, "Repeat this run" does nothing and the run stays complete (depends on T008)
- [ ] T021 [P] [US3] In `src/routes/Run.test.tsx`, add a case asserting `Next run` does not navigate while the completion screen arrives, and does once it has settled (depends on T008)
- [ ] T022 [P] [US3] In `src/routes/Run.test.tsx`, add a case asserting that "Repeat this run" pressed on a *settled* completion screen locks the screen for the incoming card's entry, and that the first card of the repeated run is refused until it has arrived (depends on T008)
- [ ] T023 [US3] Confirm `beginTransition`'s `shownId === undefined` shortcut in `src/routes/Run.tsx` is left in place and unmodified — FR-018 settled that the completion screen plays no visible exit, so per-phase locking needs no case for it ([research](./research.md) Decision 7) (depends on T008)

**Depends on**: Phase 3.

**Discharges**: FR-016, FR-017, FR-018.

---

## Phase 6: US4 — A new control needs no guard of its own (P2)

**Goal**: Coverage is proven to be structural, not enumerated.

**Independent test**: A control with no guard logic, added inside the wrapper, is dead
mid-transition and live when idle.

- [ ] T024 [US4] In `src/routes/Run.test.tsx`, add a probe case that appends a real `<button>` with a plain `addEventListener('click', …)` into `RunLoop`'s wrapper via `container.querySelector`, then asserts it does not fire mid-transition and does fire when idle. `Run.tsx` must not grow a test-only control, and this route needs none: T008's native capture listener on the wrapper fires before any descendant listener whatever attached it, so a control React has never seen is covered. That is FR-002 proven against the strongest case rather than the convenient one (depends on T005, T008)
- [ ] T025 [US4] Grep `src/` for any remaining per-control lock reasoning — `guarded`, a `phase` read inside a handler, a `disabled` driven by the transition — and confirm zero hits outside the two lines in `RunLoop`. This is FR-002 measured rather than asserted (depends on T009, T010)

**Depends on**: Phase 3.

**Discharges**: FR-002 in full, FR-019.

---

## Phase 7: Verification and cross-cutting

**Purpose**: The half jsdom cannot answer, plus the merge gates.

- [ ] T026 Run `npm test` and confirm the whole suite is green, with the count equal to the T002 baseline plus the cases added in Phases 3-6 (depends on T011-T025)
- [ ] T026a Sweep the vocabulary in `src/routes/Run.test.tsx`, `src/routes/Run.tsx` and `src/components/PronounceButton.tsx`: "the guard" and "the window" are 009's names for a thing that no longer exists in that shape, and three names for one concept is how the next reader is misled. Settle on "the lock" in `describe` names and comments, keeping "exit"/"entry" for the phases (depends on T026)
- [ ] T027 [P] Run `npm run typecheck` — this is where a missed `guarded` call site surfaces (depends on T010)
- [ ] T028 [P] Run `npm run lint` and `npm run format`, then `npm run build` (depends on T026)
- [ ] T029 Start the app with `npm run dev`, then write and run the Playwright script from [quickstart.md](./quickstart.md) § 3 in a scratch directory — **not** in the repo, and never added to `package.json` (Principle VII). Confirm every printed expectation: `inert` present on arrival and absent after settling; the measured release inside the motion duration plus 100ms and never beyond one second, which is the only place SC-003's two wall-clock bounds are checkable; and the 100-advance loop finishing with no stuck screen, which is SC-005 at its stated magnitude rather than a sample of ten (depends on T026)
- [ ] T030 Work through [quickstart.md](./quickstart.md) § 3 checks 1-11 by hand in a real browser. Checks 9 (browser back still works) and 11 (tab switched away and back) are the two that matter most: they are the stuck-screen failure modes, and neither is reachable from jsdom (depends on T029)
- [ ] T031 Verify FR-007 and FR-008 by eye during T030: no control looks greyed, disabled, or switched off at any point; the moving group's dim-and-recover is unchanged from 009; and the card's word, the two progress bars, the deck/rung heading and any storage message stay visible and legible for the whole of the lock (depends on T030)
- [ ] T032 Record in the PR description what was verified where, and that screen-reader verification is **not run** by standing decision, together with the accessibility-tree consequence of `inert` from [research](./research.md) Decision 8 (depends on T030)
- [ ] T033 Open the PR against `main` with CI green and a Pages preview, and verify a deep link to a run URL on the preview (Principle I: the dev server hides that failure) (depends on T026, T028, T032)

**Depends on**: Phases 3-6.

**Discharges**: FR-007 and FR-008 by eye (T031), SC-003's two wall-clock bounds and
SC-005's hundred advances by measurement (T029) — none of which a fake clock can
observe — and FR-001 for the pronounce control in a browser that can actually speak.

---

## Phase 8: Convergence

- [ ] T034 Run `/speckit-analyze` and resolve anything it reports between [spec.md](./spec.md), [plan.md](./plan.md) and this file (depends on T026)
- [ ] T035 Run `/speckit-converge` to confirm no requirement is unbuilt, then check the five superseded 009 requirements are genuinely reversed in the tests rather than merely deleted (depends on T034)

**Depends on**: Phase 7.

---

## Dependencies

### Phase order

```text
Phase 1 (T001-T002)
   └─> Phase 2 (T003-T006)             harness, inert against current code
          └─> Phase 3 (T007-T014b)     the lock lands; guarded deleted
                 ├─> Phase 4 (T015-T019)     release
                 ├─> Phase 5 (T020-T023)     run-complete
                 └─> Phase 6 (T024-T025)     coverage by construction
                        └─> Phase 7 (T026-T033, incl. T026a)
                               └─> Phase 8 (T034-T035)
```

Phases 4, 5 and 6 all hang off T008 and are independent of each other.

### One commit, not four

Phases 3-6 land together. T007-T010 turn five existing 009 cases red the moment they
run — the table in § Implementation Strategy step 2 names each one and the task that
answers it — and T011, T014b, T017 and T020 are what settle them. Splitting the lock
from the flipped tests means pushing a red commit, which Principle III forbids outright
("Red blocks merge. Fix or revert; never merge intending to fix later"). This is why the
feature is one PR rather than the usual stack.

### The dependencies that are easy to get wrong

- **T003 before anything under `src/`.** Landing T007 first turns ~60 tests red at once
  for a harness reason, and the real failures hide in the noise.
- **T007 before T009, not after.** Adding the lock while `guarded` still exists leaves
  both mechanisms live, which is harmless. Deleting `guarded` first leaves the screen
  unprotected in between.
- **T010 after T009.** Removing the prop from `PronounceButton` while `Run.tsx` still
  passes it fails `typecheck`; T027 is where that would surface, far from the cause.
- **T013 gates T008's event list.** If `onClickCapture` alone does not stop key
  auto-repeat under `user-event`, the fix is `onKeyDownCapture` in T008 — not a change
  to the test, which encodes the reported defect.
- **T005 before T015-T018.** Four cases assert locked/settled; all four must go through
  one helper, or the structural assertion spreads to four places and stops being the
  narrow exception [plan.md](./plan.md) justifies.
- **T003 must leave an unsettled render behind.** T014a and T014b are the only cases
  that press during the mount entry. If T003 settles inside every helper with no way
  out, FR-020 becomes untestable and its regression becomes invisible — which is the
  gap `/speckit-analyze` found in the first draft of this file.
- **T017 deletes, it does not rewrite.** Both FR-013 cases drive "Start over"
  mid-transition. Rewritten they assert what T011 already asserts; kept as they are
  they fail forever. Deleting them is the correct outcome and needs the comment T017
  asks for, or the next reader restores them.

### Parallelism

Genuinely limited, and marking more would be dishonest. T007-T011, T014a, T014b, T020
and T024 all touch `src/routes/Run.tsx` or the same `describe` blocks in
`src/routes/Run.test.tsx`, so they are serial. The `[P]` tasks that are real:

- **T016, T018** — separate `describe` blocks in the test file, no shared helper edits,
  both depending only on T005 and T008. T017 is **not** among them any more: it deletes
  a block and depends on T011 having absorbed what that block used to cover.
- **T021, T022** — different cases in the completion-screen block.
- **T027, T028** — different commands, no shared state.

Plus **T005** in Phase 2, which touches only the new helpers. Seven of thirty-eight
tasks are parallelisable. The feature is six lines of source; the
work is in one test file, and one test file is one editor.

---

## Implementation Strategy

**There is no MVP subset.** US1 alone is not shippable: it is the lock without the
proof that it releases, and the spec's own framing makes the release the safety-critical
half. The smallest deployable increment is Phases 1-7.

Suggested order of work in one sitting:

1. **T001-T006** — branch, baseline, harness. Stop and confirm green before touching
   `src/`. If this phase is not clean, nothing after it is diagnosable.
2. **T007-T010** — the six lines. Expect exactly five red cases, and check them off by
   name rather than by count:

   | Red case in `src/routes/Run.test.tsx` | Answered by |
   |---|---|
   | `repeats the run from the frame the completion screen appears (FR-009)` :1497 | T020 |
   | `marks the first card of a resumed run on arrival (FR-010)` :1521 | T014b |
   | `restarts from inside a window opened by a mark (FR-012)` :1538 | T011 |
   | `leaves one coherent run and one intact window (FR-013)` :1637 | T017 (deleted) |
   | `does not let a replaced transition close the new window (FR-013)` :1677 | T017 (deleted) |

   Only three of these trace to a row in [spec.md](./spec.md) § Superseded
   Requirements; the two FR-013 cases are downstream of superseding 009's FR-012 and
   are named nowhere else. `opens a window of its own when it restarts (FR-012)`
   :1557 does **not** go red — it starts from a settled screen. A sixth red case is a
   real bug.
3. **T011-T014, T020-T022** — flip the five, add the new ones. Suite green again.
4. **T015-T019, T024-T025** — the release and coverage cases. These are the tests that
   would have caught this feature being silently wrong.
5. **T026-T033** — gates, then the browser, where `inert` is seen for the first time.

**If the browser check in T029 fails** while the suite is green, the interceptor is
carrying the whole feature and `inert` is not applied — which is exactly the split
[research](./research.md) Decision 2 predicted, and exactly why T029 is not optional.
