---

description: "Task list for Random Run Order"
---

# Tasks: Random Run Order

**Input**: Design documents from `/specs/002-random-run-order/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/run-engine.md](./contracts/run-engine.md), [quickstart.md](./quickstart.md)

**Tests**: **Required, not optional.** Constitution Principle IV mandates tests for every pure
function transforming user data and for the storage module — this feature is exactly that — and
requires a failing-first test for every bug fix, which covers T012. Ordering claims are also
statistical (SC-001, SC-002, SC-003), and a distribution cannot be confirmed by hand.

**Organization**: Grouped by user story. US1 and US2 are both P1 and both required for a coherent
feature: shuffling without stable resume is worse than no shuffling at all.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different file, no dependency on incomplete work
- **[Story]**: US1, US2, US3 per [spec.md](./spec.md)
- Paths are repository-relative

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline and the one shared test fixture

- [X] T001 Confirm the branch is green before changing anything: run `npm ci && npm run lint && npm run typecheck && npm test && npm run build` and record that all four gates pass, so any later red is attributable to this work
- [X] T002 [P] Add a deterministic PRNG test fixture in `src/test/rng.ts` exporting `seededRng(seed: number): Rng` (mulberry32 form — same seed always yields the same sequence). Document in the file header that it is test-only, is never imported by `src/run/`, `src/routes/`, or `src/storage/`, and stores nothing, so it does not conflict with FR-010

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shuffle primitive and its type. Every user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `export type Rng = () => number;` to `src/run/types.ts` beside `Outcome` and `RunState`, documented as yielding a value in `[0, 1)` and satisfied by `Math.random`
- [X] T004 Write `src/run/shuffle.test.ts` covering the full contract in [contracts/run-engine.md](./contracts/run-engine.md): output is a permutation of the input (same multiset, same length), the input array is never mutated, `[]` and single-element inputs return an equal array, an `Rng` returning exactly `1` never places `undefined` in the result, an `Rng` sequence producing the identity permutation returns the input order as-is without re-rolling, and SC-002 — over many seeds from `seededRng`, a 5×5 position-occupancy grid for a 5-element input has no empty cell. These fail: the module does not exist yet
- [X] T005 Implement `src/run/shuffle.ts` — `shuffle<T>(items: readonly T[], rng: Rng): T[]`, Fisher–Yates back-to-front over a copy, with the swap index clamped so `rng() === 1` cannot index past the end. `rng` is a required parameter; this module takes no default. T004 goes green

**Checkpoint**: The shuffle primitive is proven correct in isolation. User stories can begin.

---

## Phase 3: User Story 1 - Cards come up in a different order every time (Priority: P1) 🎯 MVP

**Goal**: Every cycle of a run — the first and every repeat cycle — is presented in a shuffled order,
and a repeat cycle is not presented in the order its cards were failed.

**Independent Test**: Call `start` and `mark` directly with a seeded `Rng`. Confirm cycle 0 is a
permutation of the rung, that a repeat cycle is a permutation of the failed set rather than the fail
order, and that the first card varies across runs. No rendering required.

### Tests for User Story 1

> Write these first. **Correction, found while doing it**: T006 and T007 do *not* fail against
> the unshuffled engine — a permutation assertion and an invariant are both satisfied by the
> identity permutation. Only T008's distribution tests can tell a shuffling engine from a fixed
> one, which is the right division of labour, but the original claim here was wrong.

- [X] T006 [US1] In `src/run/reducer.test.ts`, rewrite the two assertions that encode config order: the `start` case asserting `queue: FIVE_CARDS` (line ~38) and the cycle-1 case asserting `queue).toEqual(['c2', 'c4'])` described as "in fail order" (line ~77). Both become permutation assertions — compare sorted members, not sequence. Rewrite, do not delete: the membership claim in each is still exactly right and is what SC-004 rests on
- [X] T007 [US1] Add the ordering invariants to `src/run/reducer.test.ts` — **I7**: every cycle's `queue` is a permutation of the cards that cycle should contain (cycle 0 of `rung.cardIds`, cycle *n+1* of cycle *n*'s `failedThisCycle`). **I8**: `queue` does not change while a cycle is in progress; only `position` advances. **I9**: the same `seededRng` seed and the same rung produce an identical sequence of cards
- [X] T008 [US1] Add the distribution tests to `src/run/reducer.test.ts` — **SC-001**: 20 `start` calls across different seeds yield more than one distinct first card. **SC-003**: driving many runs to cycle 1 with a fixed fail set, the share of repeat cycles that match fail order is near `1/k!` rather than 1. **SC-010**: the answer sequence that clears a run under one seed does not clear a second run under a different seed
- [X] T009 [US1] Confirm 001's invariant tests I1–I6 in `src/run/reducer.test.ts` still pass unchanged, except I2, which T006 amends from "same members, same order" to "same members, permuted order". Any other I1–I6 failure is a regression, not an expected update

### Implementation for User Story 1

- [X] T010 [US1] In `src/run/reducer.ts`, add an `rng: Rng = Math.random` parameter to `start`, `mark`, and `restart`; set `queue = shuffle(rung.cardIds, rng)` in `start` and `queue = shuffle(failedThisCycle, rng)` at the cycle boundary in `mark`. Leave `failedThisCycle` in fail order — it is the accumulator, not the queue. `mark` must consume no randomness mid-cycle or on completion. `restart` keeps delegating to `start`, which is what makes FR-017 and FR-018 fall out for free
- [X] T011 [US1] Correct the now-false doc comments in `src/run/reducer.ts`: the `start` header says "in config order — no shuffle", and the cycle-boundary comment says the next cycle is the failed set "exactly, nothing else". Both describe behavior this task replaced

**Checkpoint**: The engine shuffles every cycle, proven without rendering. US1 is independently testable and complete.

---

## Phase 4: User Story 2 - An interrupted run picks up exactly where it was (Priority: P1)

**Goal**: A resumed run presents its remaining cards in exactly the order an uninterrupted
playthrough would have used, re-presents nothing already passed, and needs no migration.

**Independent Test**: Play a run to a known point, unmount, remount, and compare the full card
sequence against an uninterrupted playthrough under the same seed. Separately, seed `localStorage`
with a pre-feature run in config order and confirm it resumes untouched.

**⚠️ This phase contains the correctness fix.** Without T012 and T013, US1 alone silently violates
FR-011: two independent shuffles of the same cards both pass `readRun`'s set-equality check, so the
learner is served an order that is not the one on screen, with nothing thrown and nothing logged.

### Tests for User Story 2

- [X] T012 [US2] Write the divergence test in `src/routes/Run.test.tsx`: mark cards up to a cycle boundary, then read the record back with `readDeckRecord` and assert the stored `queue` equals the order actually being presented. **This must fail against the current `src/routes/Run.tsx:173–174`**, which computes the transition twice. Run it and watch it fail before T013 — constitution Principle IV requires a bug fix to carry a test that fails against the unfixed code
- [ ] T013 [US2] Add the resume tests to `src/routes/Run.test.tsx` — **SC-005**: a run interrupted and resumed at several different points presents a card sequence identical to one uninterrupted playthrough under the same stub. **SC-006**: across a resumed run, no card marked "Got it" is ever presented again
- [X] T014 [P] [US2] Add the storage tests to `src/storage/deckRecord.test.ts` — a run whose `queue` is in shuffled order round-trips through `writeDeckRecord`/`readDeckRecord` with its order intact; a pre-feature run whose `queue` is in config order reads back unchanged and resumable (**SC-007**, FR-021); and `CURRENT_SCHEMA_VERSION` is still `1` with the `migrations` registry still empty (FR-020). No storage source file changes — these tests exist to hold that true

### Implementation for User Story 2

- [ ] T015 [US2] Fix `src/routes/Run.tsx`: move `RunLoop` from `useReducer` to `useState<RunState>`, and have `apply` compute the transition exactly once, passing that single value to both the state update and `persist`. Remove the `runReducer` second call. Replace the comment claiming "the engine is pure, so … cannot diverge" with the reason the single computation is now load-bearing. T012 goes green
- [ ] T016 [US2] Make the fresh-run assertions in `src/routes/Run.test.tsx` deterministic: stub `Math.random` in a `beforeEach` with `seededRng` from `src/test/rng.ts`, then update the roughly fifteen tests that assert a specific first card of a freshly started run (`'a'`, `'I'`, `'the'`, `'to'` at lines ~95, 118, 131, 141, 192, 211, 349, 358, 375, 467, 471, 502) to the order that stub now produces. Tests that already seed `localStorage` with an explicit `queue` need no change — they control their own order and are the model to follow

**Checkpoint**: Shuffling and resume are both correct and mutually consistent. This is the smallest shippable feature.

---

## Phase 5: User Story 3 - Starting over gives a genuinely new order (Priority: P2)

**Goal**: Restarting an unfinished run, or repeating a cleared rung, shuffles anew rather than
replaying the discarded order.

**Independent Test**: Get partway into a run, restart, and confirm the fresh run is not obliged to
reproduce the abandoned sequence; then interrupt and resume the restarted run and confirm it comes
back in the restarted order.

**Note**: `restart` delegates to `start`, so T010 already makes this work. These tasks prove it and
guard it against a future change that stops delegating.

### Tests for User Story 3

- [ ] T017 [US3] Add restart and repeat ordering tests to `src/run/reducer.test.ts`: `restart` under a different `Rng` yields a different order from the run it discarded (FR-017), and starting a completed rung again shuffles anew (FR-018). Assert that a new shuffle happened, never that two orders must differ — a chance match is legitimate per the spec's edge cases
- [ ] T018 [P] [US3] Add the component-level cases to `src/routes/Run.test.tsx`: "Start over" mid-run produces a fresh order, and a restarted run that is then interrupted resumes into the restarted run's order, never the discarded one's (FR-019)

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Validation

- [ ] T019 [P] Add a one-line forward pointer in `specs/001-deck-runs/data-model.md` at the I2 row (line ~156), which states cycle *n+1*'s queue matches the previous `failedThisCycle` "same members, same order", noting that 002 amends it to "same members, permuted order". Cross-reference only — do not rewrite 001's record of itself
- [ ] T020 Run the full gate: `npm run lint && npm run typecheck && npm test && npm run build`. All four must pass
- [ ] T021 Walk the browser checks in [quickstart.md § Browser walkthrough](./quickstart.md#browser-walkthrough): opening words move between runs, a repeat cycle does not arrive in fail order, a resume is invisible, the remaining count still counts down, and no new control appeared
- [ ] T022 Run the upgrade check in [quickstart.md § Upgrade check](./quickstart.md#upgrade-check): start a run on `main`, switch to this branch, reload, and confirm the run resumes on the same card in its original order — not discarded, not reshuffled, not migrated
- [ ] T023 On the PR's Cloudflare Pages preview, open a run deep link (`/deck/:deckId/rung/:rungId`) directly to confirm SPA fallback still resolves (constitution Principle I). A regression check — nothing here touches routing

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)**: no dependencies
- **Foundational (T003–T005)**: needs T002 for the fixture. **Blocks every user story**
- **US1 (T006–T011)**: needs Foundational
- **US2 (T012–T016)**: needs Foundational. T012 can be written before US1 lands, but only goes green after T015
- **US3 (T017–T018)**: needs T010. Cheapest last — the behavior already works by delegation
- **Polish (T019–T023)**: needs every story intended for the PR

### Story dependencies

- **US1** is independent once Foundational lands.
- **US2** depends on US1 in practice, not in principle: the divergence T012 catches only occurs once the engine shuffles. Shipping US1 without US2 would be a regression, so they land together.
- **US3** depends on T010 only.

### Within a story

Tests before implementation, and the failing run is the point — T004 before T005, T006–T009 before T010, T012 before T015.

### Critical path

`T002 → T003 → T004 → T005 → T006 → T010 → T012 → T015 → T020`

### Parallel opportunities

Limited by design: three files carry almost all the work, and same-file tasks cannot overlap.

- T001 and T002 are independent
- **T014** (`src/storage/deckRecord.test.ts`) runs alongside all of T012–T016 — different file, no storage source change
- **T018** (`src/routes/Run.test.tsx`) runs alongside T017 (`src/run/reducer.test.ts`)
- **T019** (a 001 doc) runs alongside anything

Everything else in `src/run/reducer.test.ts` (T006–T009, T017) and `src/routes/Run.test.tsx` (T012, T013, T016, T018) is same-file and sequential.

---

## Parallel Example: User Story 2

```bash
# T014 touches only the storage tests, so it runs against the Run.tsx work:
Task: "Add shuffled-order round trip, pre-feature config-order resume, and
       schemaVersion-still-1 tests in src/storage/deckRecord.test.ts"

# ...while this sequence proceeds in src/routes/:
Task: "T012 → T015 → T013 → T016 in src/routes/Run.test.tsx and src/routes/Run.tsx"
```

---

## Implementation Strategy

### Smallest shippable increment

**US1 + US2 together (T001–T016).** US1 alone is not shippable: shuffling without the T015 fix
serves a resumed learner a different order than the one on screen, which is worse than the fixed
order it replaces. Treat Phase 4's checkpoint as the real MVP line.

### Suggested order

1. **T001–T005** — baseline and the shuffle primitive, proven in isolation
2. **T006–T011** — the engine shuffles; the mechanic is done and testable without rendering
3. **T012 first, and watch it fail** — this is the evidence the double transition is real
4. **T013–T016** — the fix, then the resume proofs, then the deterministic component-test stub
5. **T017–T018** — restart and repeat, cheap because they already work by delegation
6. **T019–T023** — cross-reference, gate, browser, upgrade, preview

### Where the time actually goes

T016 is the largest task by edit volume: roughly fifteen assertions in a 509-line file move to a new
known order. It is mechanical but not automatic, and it is the one most likely to be
underestimated — nothing about it is conceptually hard, and all of it has to be right.

T012 is the highest-value task in the list. It is the only one that catches a silent failure, and it
is worthless if written after T015.
