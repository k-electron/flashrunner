# Tasks: Deck Runs

**Input**: Design documents from `/specs/001-deck-runs/`

**Prerequisites**: `000-scaffold` has landed on `main`. `npm ci` → lint → typecheck → test →
build is green before task T001.

**Tests**: Required, not optional. Constitution Principle IV mandates coverage for the storage
module, every migration, and every pure function transforming user data — which is the entire
run engine and the deck validator. Test tasks below are therefore not marked "if requested".

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — maps to the user stories in [spec.md](./spec.md)
- Every task names its exact file path

## Path Conventions

Single project, no `backend/`/`frontend/` split — Principle I means one static deployable.
Sources under `src/` at the repository root. Tests are colocated as `*.test.ts` /
`*.test.tsx` beside the module they cover (Vitest default).

The boundary that matters is **pure vs. React**: `src/decks/`, `src/run/`, and `src/storage/`
contain no JSX and no React import.

---

## Deviations from plan.md

One file is added that [plan.md § Project Structure](./plan.md#project-structure) does not list:

- **`src/decks/ladder.ts`** — pure derivations over `(DeckConfig, completedRungIds)`:
  rung unlocking (FR-015), mastery (FR-017), next rung (FR-014). data-model.md specifies these
  formulas but assigns them no file. They cannot live in `src/storage/` without mixing I/O with
  derivation, and they are not run-loop state, so `src/run/` is wrong too. Pure, no React, no
  storage — it respects the boundary the plan actually cares about.

---

## Phase 1: Setup

**Purpose**: Confirm the ground is solid and vendor the two UI primitives the screens need.

- [ ] T001 Verify the scaffold baseline is green before changing anything: run `npm ci && npm run lint && npm run typecheck && npm test && npm run build` at the repository root. Stop and fix if any step fails — a red baseline makes every later failure ambiguous.
- [ ] T002 Vendor the shadcn/ui primitives with `npx shadcn@4.19.0 add button card`, producing `src/components/ui/button.tsx` and `src/components/ui/card.tsx`. Only these two. Vendored components are project source subject to every constitution rule (Principle V); anything no screen ends up rendering gets deleted in T040.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The authored deck data, its validator, and the storage module. All pure, all
testable without a browser, all required by more than one user story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

**Note**: This phase touches no route and no component, so `main`'s build and tests stay green
throughout it.

### Deck configuration and validation

- [ ] T003 [P] Define the authored types in `src/decks/types.ts`: `DeckId`, `CardId`, `RungId`, `DeckConfig`, `CardConfig`, `RungConfig`, exactly as specified in [contracts/deck-config.md § Shape](./contracts/deck-config.md#shape). `back` is optional (`back?: string`), never a discriminated union — that optionality is what makes FR-024/SC-010 a type-level guarantee.
- [ ] T004 [P] Author `src/decks/dolch-prek-5.ts`: `id: 'dolch-prek-5'`, `title: 'Dolch Pre-K · Steps of 5'`, 40 cards and 8 cumulative rungs taken verbatim from [research.md §4 — dolch-prek-5 table](./research.md#4-dolch-word-list-content-and-ordering). Card `id` is the word lowercased (`{ id: 'i', front: 'I' }`); rung ids are `r1`–`r8`; each rung's `cardIds` lists every card literally in presentation order, cumulative from rung 1. No `rungSize`, no computed membership.
- [ ] T005 [P] Author `src/decks/dolch-k-5.ts`: `id: 'dolch-k-5'`, `title: 'Dolch Kindergarten · Steps of 5'`, 52 cards and 11 cumulative rungs from [research.md §4 — dolch-k-5 table](./research.md#4-dolch-word-list-content-and-ordering). Same id conventions; rung ids `r1`–`r11`. Rung 11 adds only 2 cards — this needs no special handling anywhere, because membership is authored rather than computed.
- [ ] T006 Create `src/decks/registry.ts` exporting `decks: DeckConfig[]` (`[dolchPreK5, dolchK5]`, in display order) plus a `deckById(id: DeckId): DeckConfig | undefined` lookup, per [contracts/deck-config.md § Registering a deck](./contracts/deck-config.md#registering-a-deck).
- [ ] T007 Implement `validateDeck(deck: DeckConfig): string[]` in `src/decks/validate.ts` — rules V1–V7 from [data-model.md § Validation rules](./data-model.md#validation-rules-fr-003-fr-004). Return one human-readable message per violation and an empty array for a valid deck. V6 is set containment between adjacent rungs (not prefix matching); V7 is set equality between the top rung and the full card set, in both directions. These are checks only — this file must never derive membership.
- [ ] T008 Write `src/decks/validate.test.ts`: one deliberately malformed fixture per rule V1–V7, each asserting the specific violation is reported, plus a pass over the real `decks` registry asserting zero violations. The registry pass is the executable form of SC-005 and is what makes a malformed built-in deck fail CI instead of reaching a learner.

### Storage module — the only place `localStorage` is touched

- [ ] T009 [P] Create `src/storage/keys.ts`: the `flashrunner:` namespace constant and `deckKey(deckId: DeckId): string` returning `flashrunner:deck:<deckId>` per [contracts/storage.md § Keys](./contracts/storage.md#keys).
- [ ] T010 [P] Implement `src/storage/safeStorage.ts` — the only module in the project permitted to reference `localStorage` (Principle II). It must handle every row of [contracts/storage.md § Hostile storage](./contracts/storage.md#hostile-storage): storage absent or throwing on access (private mode, blocked cookies) falls back to an in-memory map for the session; `QuotaExceededError` on write is caught explicitly and surfaced to the caller rather than swallowed. No case may throw out to a component, and none may produce a blank screen.
- [ ] T011 [P] Create `src/storage/migrations.ts`: `CURRENT_SCHEMA_VERSION = 1`, an ordered migration registry keyed by version (ships empty — version 1 is the baseline), and `runMigrations(parsed: unknown): unknown` applying them in order. Its purpose today is that the first real bump has an obvious home and an established test pattern, per [contracts/storage.md § Migrations](./contracts/storage.md#migrations).
- [ ] T012 Implement `src/storage/deckRecord.ts` — `readDeckRecord(deck: DeckConfig): DeckRecord` and `writeDeckRecord(deckId, record)`. Read path: parse → migrate → default absent fields (`completedRungIds → []`, `run → undefined`, per G2) → drop a stale `run` and only the run, using the three conditions in [data-model.md § Discarding a stale run](./data-model.md#discarding-a-stale-run). Write path is read-whole, overlay-known, write-whole so unrecognized fields survive verbatim (G4/FR-041). Never discard a record for age alone (G3/FR-040). Unrecognized entries in `completedRungIds` are ignored for display but kept on write.
- [ ] T013 [P] Write `src/storage/safeStorage.test.ts`: `localStorage` absent/throwing degrades to in-memory with the app still working; corrupt JSON under one deck's key leaves other decks readable; `QuotaExceededError` is caught and surfaced rather than thrown at the caller.
- [ ] T014 [P] Write `src/storage/deckRecord.test.ts` covering the list in [quickstart.md § Storage](./quickstart.md#what-the-unit-tests-must-cover): round-trip unchanged; seed `{"futureThing": 42}`, complete a rung, assert `futureThing` is still 42 (G4/FR-041); a record missing a later-added field reads as valid with defaults (G2/FR-039); a `run` referencing a rung or card the config no longer has is dropped while `completedRungIds` survives intact.

**Checkpoint**: Deck data, validation, and persistence all exist and are tested. `npm test` is
green and no route has changed yet. User story work can begin.

---

## Phase 3: User Story 1 - Complete a run by clearing every card (Priority: P1) 🎯 MVP

**Goal**: The learning mechanic itself. Cards appear one at a time, get marked "Got it" or
"Not yet", and every failed card comes back in the next cycle until none remain.

**Independent Test**: Navigate directly to `/deck/dolch-prek-5/rung/r1` (a real URL — deep links
are already verified working on Pages). Mark a mix of outcomes and confirm failed cards
re-present in later cycles, passed cards never do, and the run reports success only when the
failed set reaches zero. The unit tests in T018 assert the same thing as plain function calls,
without rendering.

**Note on reachability**: this phase adds the run route only. The scaffold's placeholder `/`
stays in place as a temporary way in and is deleted in US3 (T033) when the real deck list lands.

### The pure run engine

- [ ] T015 [P] [US1] Define `src/run/types.ts`: `Outcome = 'got-it' | 'not-yet'` and the `RunState` shape from [data-model.md § Earned: the run state machine](./data-model.md#earned-the-run-state-machine). No React import in this file or any other under `src/run/`.
- [ ] T016 [US1] Implement `src/run/reducer.ts` — `start(deck, rungId)`, `mark(state, outcome)`, and `restart(deck, state)`, transcribing the transitions in data-model.md exactly. `mark` is the whole mechanic: append the current card to `passedThisRun` or `failedThisCycle`, advance `position`, and when the cycle is exhausted either flip `status` to `complete` (nothing failed) or swap `queue = failedThisCycle` and reset. There is no `abandon` transition — abandoning is navigation, not a state change (FR-012).
- [ ] T017 [P] [US1] Implement `src/run/selectors.ts`: `currentCard(state)` (`queue[position]`, `undefined` when complete), `remainingInCycle(state)` (`queue.length - position`), `isComplete(state)`. Pure reads, no allocation of new state.
- [ ] T018 [US1] Write `src/run/reducer.test.ts` asserting invariants I1–I6 from [data-model.md § Invariants](./data-model.md#invariants--these-are-the-test-list) plus every row of the scenario table in [quickstart.md § Run engine](./quickstart.md#what-the-unit-tests-must-cover): all-pass completes at `cycleIndex` 0; 2 failed produces a cycle-1 queue of exactly those 2 in fail order; a passed card never reappears; every-card-failed for 50 cycles neither errors nor caps; on completion `passedThisRun` equals the rung's full card set. Plain function calls, no rendering.

### The run screen

- [ ] T019 [P] [US1] Create `src/components/CardFace.tsx` rendering a card's `front` as the single visible face (FR-023). Text sized for a Pre-K/Kindergarten learner. It must not read `back` — two-sided decks are a later feature and the run loop never inspects card content.
- [ ] T020 [P] [US1] Create `src/components/OutcomeButtons.tsx` — two buttons labelled "Got it" and "Not yet" (FR-027), built on the vendored `Button`. Accessible names must equal the visible text so component tests can query by role and name. Sized and placed to be operable by an adult or a child, favouring neither (FR-026).
- [ ] T021 [P] [US1] Create `src/components/CycleCounter.tsx` showing how many cards remain in the current cycle from `remainingInCycle` (FR-013, SC-008). Wording must be understandable to a supervising adult at a glance without asking.
- [ ] T022 [US1] Build `src/routes/Run.tsx` for `/deck/:deckId/rung/:rungId`: resolve the deck via `deckById` and the rung within it, hold `RunState` with `useReducer` over the pure reducer from T016, and render `CardFace` + `OutcomeButtons` + `CycleCounter`. Include a "Start over" control that applies `restart` (FR-033) and a link back to the deck's ladder that records no completion (FR-012, FR-034). An unknown `deckId` or `rungId` renders a plain in-app message and a link home — never a crash and never a blank screen. The component decides nothing about the mechanic.
- [ ] T023 [US1] Register the `/deck/:deckId/rung/:rungId` route in `src/app/router.tsx` using `createBrowserRouter` — library mode only. Framework mode SSRs and is a MAJOR constitutional violation (Principle I).
- [ ] T024 [US1] Delete the scaffold's throwaway content now that a real route exists: remove `src/routes/Ping.tsx`, `src/demo/greeting.ts`, and `src/demo/greeting.test.ts`, and drop the `/ping` route from `src/app/router.tsx`. Leave `src/routes/Home.tsx` and its test in place until T033.
- [ ] T025 [US1] Write `src/routes/Run.test.tsx` querying by role and visible text only — no class names, no snapshots (Principle IV): the current card's `front` is shown, both outcome buttons are reachable by their accessible names, the remaining-in-cycle count is displayed and decrements on marking, and "Start over" returns the run to the first card of cycle 0.

**Checkpoint**: The learning mechanic works end to end at a real URL and is fully covered by
tests that need no browser. This is the MVP.

---

## Phase 4: User Story 2 - Climb the ladder from smallest run to whole deck (Priority: P2)

**Goal**: Progression. Completing a rung unlocks the next; completing the top rung masters the
deck. A rung whose immediate predecessor is not yet completed is visible but not startable.

**Independent Test**: Complete rung 1 of Dolch Pre-K, confirm the ladder now offers rung 2 and
that rung 3 is visible but not startable. Start rung 2 and verify it contains all of rung 1's
cards plus the new ones. Complete the top rung and confirm the deck reads as mastered with no
larger run offered.

- [ ] T026 [P] [US2] Create `src/decks/ladder.ts` — pure derivations over `(DeckConfig, completedRungIds)`: `isStartable(deck, completedRungIds, index)` (`index === 0 || completedRungIds.includes(rungs[index - 1].id)`, FR-015), `isMastered(deck, completedRungIds)` (`completedRungIds.includes(lastRung.id)`, FR-017), `highestCompletedRung(deck, completedRungIds)` (FR-019), and `nextRung(deck, rungId)` (FR-014). Mastery is derived here and never stored — see [data-model.md § Mastery is derived, not stored](./data-model.md#mastery-is-derived-not-stored). No React, no storage import.
- [ ] T027 [US2] Write `src/decks/ladder.test.ts`: rung 1 is always startable; a rung is startable exactly when the one below it is in `completedRungIds`; completed rungs stay startable forever (FR-016); repeating a completed rung appends nothing so progress cannot go backwards (FR-018); mastery flips only on the top rung's id; `nextRung` returns `undefined` at the top; unrecognized ids in `completedRungIds` do not unlock anything.
- [ ] T028 [US2] Handle completion in `src/routes/Run.tsx`: when `isComplete`, append the rung id to `completedRungIds` if not already present and clear `run`, via `writeDeckRecord` (FR-017, FR-018), then render the two choices FR-014 requires — "Repeat this run" (restarts the same rung) and "Next run" (navigates to `nextRung`). Suppress "Next run" on the top rung and show that the deck is mastered instead (US2 scenario 3).
- [ ] T029 [US2] Build `src/routes/DeckLadder.tsx` for `/deck/:deckId`: list every rung in order with its label, mark completed ones, render a rung as visible but not startable exactly when its immediate predecessor is not in `completedRungIds` — use `isStartable` from T026, never a comparison against the highest completed index, which would lock the very rung just unlocked (FR-015, US2 scenario 4), show mastery when derived, and link back to the deck list (FR-034). Progress comes from `readDeckRecord` and `src/decks/ladder.ts`; this file derives nothing itself.
- [ ] T030 [US2] Register the `/deck/:deckId` route in `src/app/router.tsx`.
- [ ] T031 [US2] Write `src/routes/DeckLadder.test.tsx` by role and visible text: a locked rung is present in the document but not activatable; completing a rung makes the next one activatable; a mastered deck shows mastery and still lets any completed rung be repeated (US3 scenario 3 relies on this too).

**Checkpoint**: US1 and US2 both work. A learner can climb a deck end to end within one session.

---

## Phase 5: User Story 3 - Pick up a deck and see where you left off (Priority: P3)

**Goal**: Everything survives closing the browser, and an unfinished run resumes at the exact
card it stopped on. Each deck keeps its own position independently.

**Independent Test**: Complete a rung, start the next one, mark two cards, close the browser
entirely, reopen. The deck list shows the completed rung; the ladder surfaces the unfinished run
on its own rung with Resume and Start over side by side; resuming lands on card 3 with the two
already-marked cards not re-presented.

- [ ] T032 [P] [US3] Build `src/routes/DeckList.tsx` for `/`: render every deck in `registry.decks` with its progress — highest rung completed, or not-started when there is no record (FR-020, FR-021) — and a mastery marker where derived (US3 scenarios 1–3). A record referencing a deck no longer in the registry is simply never read (FR-022).
- [ ] T033 [US3] Point `/` at `DeckList` in `src/app/router.tsx` and delete the scaffold placeholder: remove `src/routes/Home.tsx` and `src/routes/Home.test.tsx`. After this task no disposable scaffold content remains in `src/`.
- [ ] T034 [US3] Persist run state after every mark in `src/routes/Run.tsx` (FR-028) — one synchronous `writeDeckRecord` per outcome, plus on start and restart. Writes are a few hundred bytes, so an interruption at any moment leaves at most one card's position unrecorded (SC-009). Surface the `QuotaExceededError` case from T010: the run continues in memory and the learner is told progress is not being saved rather than silently lied to.
- [ ] T035 [US3] Resume on entry in `src/routes/Run.tsx`: when the stored `run` exists and its `rungId` matches the route, hydrate `RunState` from it instead of calling `start` (FR-029). Already-passed cards must not be re-presented (FR-030, SC-009). `status` is not persisted — a persisted run is always in progress — so it is reconstituted as `'running'`. A stale run was already dropped on read by T012.
- [ ] T036 [US3] Surface the unfinished run in `src/routes/DeckLadder.tsx` on the rung it belongs to, with **Resume and Start over rendered together** (FR-031, FR-035). A learner who has forgotten where they were must not have to resume in order to find the way to start over. Each deck's unfinished run is independent (FR-036); there is no guard, no reconciliation, and no error state for more than one (FR-037).
- [ ] T037 [US3] Wire "Start over" — on both `src/routes/DeckLadder.tsx` and `src/routes/Run.tsx` — to clear only that deck's persisted `run` and begin a fresh run of the same rung (FR-032). `completedRungIds`, mastery, the rung's unlocked state, and every other deck's record are untouched (SC-015).
- [ ] T038 [P] [US3] Write `src/routes/DeckList.test.tsx`: a deck with no record shows as not started and offers its smallest run; a deck with completed rungs shows the highest one; a mastered deck is marked mastered; a stored record for an unknown deck id causes no failure to start (FR-022).
- [ ] T039 [US3] Extend `src/routes/DeckLadder.test.tsx` for resume and restart: an unfinished run appears on its own rung showing both Resume and Start over; Start over leaves `completedRungIds` unchanged and the rung still unlocked; two decks each keep their own unfinished run across a switch (SC-013).

**Checkpoint**: All three stories work independently. The feature is complete pending the
manual passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T040 [P] Delete any file under `src/components/ui/` that no screen renders (Principle V: remove unused deps, including vendored components). Confirm with a grep for each vendored component's import across `src/`.
- [ ] T041 [P] Correct a stale claim in `specs/001-deck-runs/research.md`: §2 "Setup consequences" and § "Files the scaffold must produce" both say `tsconfig.json` needs `baseUrl`. TypeScript 7 removed `baseUrl` (`TS5102`), and the shipped scaffold uses `paths` alone, which resolve relative to the tsconfig. shadcn's own install guide is what carried the outdated instruction. Fix both lines to match what was actually built.
- [ ] T042 Run the full merge gate at the repository root: `npm run lint && npm run typecheck && npm test && npm run build`, then assert the build output shape — `dist/` contains no top-level `404.html` and no `_redirects` file (Principle I). CI's "Assert build output shape" step checks the same thing; run it locally first so the PR does not discover it.
- [ ] T043 Manual pass 1 — deep links on the PR's Cloudflare Pages **preview** URL, not locally, per [quickstart.md § Manual 1](./quickstart.md#1-deep-links-on-a-real-deploy--principle-i). Navigate to a run, paste the URL into a fresh tab, and hard-reload on `/deck/dolch-prek-5/rung/r3`. The dev server resolves any path and will hide a broken deployment.
- [ ] T044 Manual pass 2 — persistence across a real browser restart, per [quickstart.md § Manual 2](./quickstart.md#2-persistence-across-a-real-browser-restart--sc-006-sc-011). `jsdom` fakes `localStorage`; only quitting the browser entirely and reopening proves the round trip (SC-006, SC-011, SC-009).
- [ ] T045 Manual pass 3 — two decks in parallel, per [quickstart.md § Manual 3](./quickstart.md#3-two-decks-in-parallel--sc-013): mark cards in Dolch Pre-K, go home, mark cards in Dolch Kindergarten, return to Pre-K and find it on the same rung, cycle, and card (FR-036, SC-013).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 gates everything — do not start on a red baseline.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all three user stories.**
- **US1 (Phase 3)**: Depends on Foundational. No dependency on US2 or US3.
- **US2 (Phase 4)**: Depends on Foundational. Reuses US1's `Run.tsx` (T028 edits it), so in
  practice it follows US1.
- **US3 (Phase 5)**: Depends on Foundational. T034–T037 edit `Run.tsx` and `DeckLadder.tsx`,
  so it follows US1 and US2 respectively.
- **Polish (Phase 6)**: Depends on all stories being complete. T043–T045 additionally require
  an open PR with a live Pages preview.

### Within Phase 2

- T003 blocks T004, T005, T006, T007 (they import the types).
- T004 and T005 block T006 (the registry imports both decks).
- T006 and T007 block T008 (the test runs the validator over the registry).
- T009, T010, T011 block T012. T006 also blocks T012 — the stale-run check validates against
  the current deck config.
- T010 blocks T013; T012 blocks T014.

### Within Each User Story

- Pure engine before components; components before the route that composes them.
- Route before its component test.
- Story complete and its checkpoint verified before moving to the next priority.

### Parallel Opportunities

- **T003 alone first**, then **T004 and T005 together** — two independent deck files.
- **T009, T010, T011 together** — three independent storage files, once T006 exists.
- **T013 and T014 together** once their subjects exist.
- **T015 and T017 together** — types and selectors are independent of the reducer body.
- **T019, T020, T021 together** — three independent presentational components.
- **T040 and T041 together** — unrelated files.
- The three manual passes T043–T045 are independent of each other and can be done in one
  browser session.

---

## Parallel Example: Phase 2 Foundational

```bash
# After T003 lands, the two deck configs are independent files:
Task: "Author src/decks/dolch-prek-5.ts — 40 cards, 8 rungs, from research.md §4"
Task: "Author src/decks/dolch-k-5.ts — 52 cards, 11 rungs, from research.md §4"

# After T006 lands, the three storage leaf modules are independent:
Task: "Create src/storage/keys.ts"
Task: "Implement src/storage/safeStorage.ts"
Task: "Create src/storage/migrations.ts"
```

## Parallel Example: User Story 1

```bash
# Three presentational components, no shared file:
Task: "Create src/components/CardFace.tsx"
Task: "Create src/components/OutcomeButtons.tsx"
Task: "Create src/components/CycleCounter.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup — T001, T002
2. Phase 2 Foundational — T003–T014 (**blocks everything**)
3. Phase 3 US1 — T015–T025
4. **STOP and VALIDATE**: `npm test` green, and `/deck/dolch-prek-5/rung/r1` runs end to end
   in the browser
5. This is a demoable product: a child can practise a rung of sight words. It forgets progress
   on reload, which US3 fixes.

### Incremental Delivery

1. Setup + Foundational → deck data and persistence exist, tested, no UI changed
2. Add US1 → the learning mechanic works → **MVP**
3. Add US2 → progression and mastery → a deck can be climbed end to end
4. Add US3 → nothing is ever lost → the product as specified
5. Polish → manual passes on a real Pages preview

Each story adds value without breaking the ones before it. Phase 2's checkpoint and every story
checkpoint leave the build and test suite green, so the work can stop at any of them.

### Solo Sequencing

Single maintainer, so the parallel-team split does not apply. The `[P]` markers still matter:
they identify tasks that touch disjoint files, which is what makes them safe to batch in one
editing pass and safe to reorder.

---

## Notes

- **`[P]`** = different files, no dependency on an incomplete task.
- **Purity is the architectural constraint.** `src/decks/`, `src/run/`, and `src/storage/` must
  contain no JSX and no React import. That boundary is what lets the entire learning mechanic
  be tested without rendering anything.
- **Rung membership is never computed.** The validator checks containment; nothing derives it.
  A "steps of 5" ladder is a property of the authored config, not a parameter.
- **`src/storage/` is the only place `localStorage` appears.** A direct
  `localStorage.getItem`/`setItem` anywhere else is a review failure (Principle II).
- **Principle VI applies to every task.** Implement the stated requirement and stop. The
  explicitly-not-built list is in [plan.md § Explicitly not built](./plan.md#explicitly-not-built-principle-vi):
  no profiles, scoring, streaks, timers, spaced repetition, shuffling, deck authoring,
  import/export, settings screen, analytics, or service worker.
- Commit after each task or logical group. Merge gates: CI green **and** a successful Pages
  preview — both are now enforced on `main` — plus human review.
