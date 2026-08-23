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

- [X] T001 Verify the scaffold baseline is green before changing anything: run `npm ci && npm run lint && npm run typecheck && npm test && npm run build` at the repository root. Stop and fix if any step fails — a red baseline makes every later failure ambiguous.
- [X] T002 Vendor the shadcn/ui primitives with `npx shadcn@4.19.0 add button card`, producing `src/components/ui/button.tsx` and `src/components/ui/card.tsx`. Only these two. Vendored components are project source subject to every constitution rule (Principle V); anything no screen ends up rendering gets deleted in T040.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The authored deck data, its validator, and the storage module. All pure, all
testable without a browser, all required by more than one user story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

**Note**: This phase touches no route and no component, so `main`'s build and tests stay green
throughout it.

### Deck configuration and validation

- [X] T003 [P] Define the authored types in `src/decks/types.ts`: `DeckId`, `CardId`, `RungId`, `DeckConfig`, `CardConfig`, `RungConfig`, exactly as specified in [contracts/deck-config.md § Shape](./contracts/deck-config.md#shape). `back` is optional (`back?: string`), never a discriminated union — that optionality is what makes FR-024/SC-010 a type-level guarantee.
- [X] T004 [P] Author `src/decks/dolch-prek-5.ts`: `id: 'dolch-prek-5'`, `title: 'Dolch Pre-K · Steps of 5'`, 40 cards and 8 cumulative rungs taken verbatim from [research.md §4 — dolch-prek-5 table](./research.md#4-dolch-word-list-content-and-ordering). Card `id` is the word lowercased (`{ id: 'i', front: 'I' }`); rung ids are `r1`–`r8`; each rung's `cardIds` lists every card literally in presentation order, cumulative from rung 1. No `rungSize`, no computed membership.
- [X] T005 [P] Author `src/decks/dolch-k-5.ts`: `id: 'dolch-k-5'`, `title: 'Dolch Kindergarten · Steps of 5'`, 52 cards and 11 cumulative rungs from [research.md §4 — dolch-k-5 table](./research.md#4-dolch-word-list-content-and-ordering). Same id conventions; rung ids `r1`–`r11`. Rung 11 adds only 2 cards — this needs no special handling anywhere, because membership is authored rather than computed.
- [X] T006 Create `src/decks/registry.ts` exporting `decks: DeckConfig[]` (`[dolchPreK5, dolchK5]`, in display order) plus a `deckById(id: DeckId): DeckConfig | undefined` lookup, per [contracts/deck-config.md § Registering a deck](./contracts/deck-config.md#registering-a-deck).
- [X] T007 Implement `validateDeck(deck: DeckConfig): string[]` in `src/decks/validate.ts` — rules V1–V7 from [data-model.md § Validation rules](./data-model.md#validation-rules-fr-003-fr-004). Return one human-readable message per violation and an empty array for a valid deck. V6 is set containment between adjacent rungs (not prefix matching); V7 is set equality between the top rung and the full card set, in both directions. These are checks only — this file must never derive membership.
- [X] T008 Write `src/decks/validate.test.ts`: one deliberately malformed fixture per rule V1–V7, each asserting the specific violation is reported, plus a pass over the real `decks` registry asserting zero violations. The registry pass is the executable form of SC-005 and is what makes a malformed built-in deck fail CI instead of reaching a learner.

### Storage module — the only place `localStorage` is touched

- [X] T009 [P] Create `src/storage/keys.ts`: the `flashrunner:` namespace constant and `deckKey(deckId: DeckId): string` returning `flashrunner:deck:<deckId>` per [contracts/storage.md § Keys](./contracts/storage.md#keys).
- [X] T010 [P] Implement `src/storage/safeStorage.ts` — the only module in the project permitted to reference `localStorage` (Principle II). It must handle every row of [contracts/storage.md § Hostile storage](./contracts/storage.md#hostile-storage): storage absent or throwing on access (private mode, blocked cookies) falls back to an in-memory map for the session; `QuotaExceededError` on write is caught explicitly and surfaced to the caller rather than swallowed. No case may throw out to a component, and none may produce a blank screen.
- [X] T011 [P] Create `src/storage/migrations.ts`: `CURRENT_SCHEMA_VERSION = 1`, an ordered migration registry keyed by version (ships empty — version 1 is the baseline), and `runMigrations(parsed: unknown, registry = migrations, current = CURRENT_SCHEMA_VERSION): unknown` applying them in order — the registry and target version are parameters so the empty-today registry can still be tested against a real bump; call sites pass neither. Its purpose today is that the first real bump has an obvious home and an established test pattern, per [contracts/storage.md § Migrations](./contracts/storage.md#migrations).
- [X] T012 Implement `src/storage/deckRecord.ts` — `readDeckRecord(deck: DeckConfig): DeckRecord` and `writeDeckRecord(deckId, record)`. Read path: parse → migrate → default absent fields (`completedRungIds → []`, `run → undefined`, per G2) → drop a stale `run` and only the run, using the three conditions in [data-model.md § Discarding a stale run](./data-model.md#discarding-a-stale-run). Write path is read-whole, overlay-known, write-whole so unrecognized fields survive verbatim (G4/FR-041). Never discard a record for age alone (G3/FR-040). Unrecognized entries in `completedRungIds` are ignored for display but kept on write.
- [X] T013 [P] Write `src/storage/safeStorage.test.ts`: `localStorage` absent/throwing degrades to in-memory with the app still working; corrupt JSON under one deck's key leaves other decks readable; `QuotaExceededError` is caught and surfaced rather than thrown at the caller.
- [X] T014 [P] Write `src/storage/deckRecord.test.ts` covering the list in [quickstart.md § Storage](./quickstart.md#what-the-unit-tests-must-cover): round-trip unchanged; seed `{"futureThing": 42}`, complete a rung, assert `futureThing` is still 42 (G4/FR-041); a record missing a later-added field reads as valid with defaults (G2/FR-039); a `run` referencing a rung or card the config no longer has is dropped while `completedRungIds` survives intact.

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

- [X] T015 [P] [US1] Define `src/run/types.ts`: `Outcome = 'got-it' | 'not-yet'` and the `RunState` shape from [data-model.md § Earned: the run state machine](./data-model.md#earned-the-run-state-machine). No React import in this file or any other under `src/run/`.
- [X] T016 [US1] Implement `src/run/reducer.ts` — `start(deck, rungId)`, `mark(state, outcome)`, and `restart(deck, state)`, transcribing the transitions in data-model.md exactly. `mark` is the whole mechanic: append the current card to `passedThisRun` or `failedThisCycle`, advance `position`, and when the cycle is exhausted either flip `status` to `complete` (nothing failed) or swap `queue = failedThisCycle` and reset. There is no `abandon` transition — abandoning is navigation, not a state change (FR-012).
- [X] T017 [P] [US1] Implement `src/run/selectors.ts`: `currentCard(state)` (`queue[position]`, `undefined` when complete), `remainingInCycle(state)` (`queue.length - position`), `isComplete(state)`. Pure reads, no allocation of new state.
- [X] T018 [US1] Write `src/run/reducer.test.ts` asserting invariants I1–I6 from [data-model.md § Invariants](./data-model.md#invariants--these-are-the-test-list) plus every row of the scenario table in [quickstart.md § Run engine](./quickstart.md#what-the-unit-tests-must-cover): all-pass completes at `cycleIndex` 0; 2 failed produces a cycle-1 queue of exactly those 2 in fail order; a passed card never reappears; every-card-failed for 50 cycles neither errors nor caps; on completion `passedThisRun` equals the rung's full card set. Plain function calls, no rendering.

### The run screen

- [X] T019 [P] [US1] Create `src/components/CardFace.tsx` rendering a card's `front` as the single visible face (FR-023). Text sized for a Pre-K/Kindergarten learner. It must not read `back` — two-sided decks are a later feature and the run loop never inspects card content.
- [X] T020 [P] [US1] Create `src/components/OutcomeButtons.tsx` — two buttons labelled "Got it" and "Not yet" (FR-027), built on the vendored `Button`. Accessible names must equal the visible text so component tests can query by role and name. Sized and placed to be operable by an adult or a child, favouring neither (FR-026).
- [X] T021 [P] [US1] Create `src/components/CycleCounter.tsx` showing how many cards remain in the current cycle from `remainingInCycle` (FR-013, SC-008). Wording must be understandable to a supervising adult at a glance without asking.
- [X] T022 [US1] Build `src/routes/Run.tsx` for `/deck/:deckId/rung/:rungId`: resolve the deck via `deckById` and the rung within it, hold `RunState` with `useReducer` over the pure reducer from T016, and render `CardFace` + `OutcomeButtons` + `CycleCounter`. Include a "Start over" control that applies `restart` (FR-033) and a link back to the deck's ladder that records no completion (FR-012, FR-034). An unknown `deckId` or `rungId` renders a plain in-app message and a link home — never a crash and never a blank screen. The component decides nothing about the mechanic.
- [X] T023 [US1] Register the `/deck/:deckId/rung/:rungId` route in `src/app/router.tsx` using `createBrowserRouter` — library mode only. Framework mode SSRs and is a MAJOR constitutional violation (Principle I).
- [X] T024 [US1] Delete the scaffold's throwaway content now that a real route exists: remove `src/routes/Ping.tsx`, `src/demo/greeting.ts`, and `src/demo/greeting.test.ts`, and drop the `/ping` route from `src/app/router.tsx`. Leave `src/routes/Home.tsx` and its test in place until T033.
- [X] T025 [US1] Write `src/routes/Run.test.tsx` querying by role and visible text only — no class names, no snapshots (Principle IV): the current card's `front` is shown, both outcome buttons are reachable by their accessible names, the remaining-in-cycle count is displayed and decrements on marking, and "Start over" returns the run to the first card of cycle 0.

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

- [X] T026 [P] [US2] Create `src/decks/ladder.ts` — pure derivations over `(DeckConfig, completedRungIds)`: `isStartable(deck, completedRungIds, index)` (`index === 0 || completedRungIds.includes(rungs[index - 1].id)`, FR-015), `isMastered(deck, completedRungIds)` (`completedRungIds.includes(lastRung.id)`, FR-017), `highestCompletedRung(deck, completedRungIds)` (FR-019), and `nextRung(deck, rungId)` (FR-014). Mastery is derived here and never stored — see [data-model.md § Mastery is derived, not stored](./data-model.md#mastery-is-derived-not-stored). No React, no storage import.
- [X] T027 [US2] Write `src/decks/ladder.test.ts`: rung 1 is always startable; a rung is startable exactly when the one below it is in `completedRungIds`; completed rungs stay startable forever (FR-016); repeating a completed rung appends nothing so progress cannot go backwards (FR-018); mastery flips only on the top rung's id; `nextRung` returns `undefined` at the top; unrecognized ids in `completedRungIds` do not unlock anything.
- [X] T028 [US2] Handle completion in `src/routes/Run.tsx`: when `isComplete`, append the rung id to `completedRungIds` if not already present and clear `run`, via `writeDeckRecord` (FR-017, FR-018), then render the two choices FR-014 requires — "Repeat this run" (restarts the same rung) and "Next run" (navigates to `nextRung`). Suppress "Next run" on the top rung and show that the deck is mastered instead (US2 scenario 3).
- [X] T029 [US2] Build `src/routes/DeckLadder.tsx` for `/deck/:deckId`: list every rung in order with its label, mark completed ones, render a rung as visible but not startable exactly when its immediate predecessor is not in `completedRungIds` — use `isStartable` from T026, never a comparison against the highest completed index, which would lock the very rung just unlocked (FR-015, US2 scenario 4), show mastery when derived, and link back to the deck list (FR-034). Progress comes from `readDeckRecord` and `src/decks/ladder.ts`; this file derives nothing itself.
- [X] T030 [US2] Register the `/deck/:deckId` route in `src/app/router.tsx`.
- [X] T031 [US2] Write `src/routes/DeckLadder.test.tsx` by role and visible text: a locked rung is present in the document but not activatable; completing a rung makes the next one activatable; a mastered deck shows mastery and still lets any completed rung be repeated (US3 scenario 3 relies on this too).

**Checkpoint**: US1 and US2 both work. A learner can climb a deck end to end within one session.

---

## Phase 5: User Story 3 - Pick up a deck and see where you left off (Priority: P3)

**Goal**: Everything survives closing the browser, and an unfinished run resumes at the exact
card it stopped on. Each deck keeps its own position independently.

**Independent Test**: Complete a rung, start the next one, mark two cards, close the browser
entirely, reopen. The deck list shows the completed rung; the ladder surfaces the unfinished run
on its own rung with Resume and Start over side by side; resuming lands on card 3 with the two
already-marked cards not re-presented.

- [X] T032 [P] [US3] Build `src/routes/DeckList.tsx` for `/`: render every deck in `registry.decks` with its progress — highest rung completed, or not-started when there is no record (FR-020, FR-021) — and a mastery marker where derived (US3 scenarios 1–3). A record referencing a deck no longer in the registry is simply never read (FR-022).
- [X] T033 [US3] Point `/` at `DeckList` in `src/app/router.tsx` and delete the scaffold placeholder: remove `src/routes/Home.tsx` and `src/routes/Home.test.tsx`. After this task no disposable scaffold content remains in `src/`.
- [X] T034 [US3] Persist run state after every mark in `src/routes/Run.tsx` (FR-028) — one synchronous `writeDeckRecord` per outcome, plus on start and restart. Writes are a few hundred bytes, so an interruption at any moment leaves at most one card's position unrecorded (SC-009). Surface the `QuotaExceededError` case from T010: the run continues in memory and the learner is told progress is not being saved rather than silently lied to.
- [X] T035 [US3] Resume on entry in `src/routes/Run.tsx`: when the stored `run` exists and its `rungId` matches the route, hydrate `RunState` from it instead of calling `start` (FR-029). Already-passed cards must not be re-presented (FR-030, SC-009). `status` is not persisted — a persisted run is always in progress — so it is reconstituted as `'running'`. A stale run was already dropped on read by T012.
- [X] T036 [US3] Surface the unfinished run in `src/routes/DeckLadder.tsx` on the rung it belongs to, with **Resume and Start over rendered together** (FR-031, FR-035). A learner who has forgotten where they were must not have to resume in order to find the way to start over. Each deck's unfinished run is independent (FR-036); there is no guard, no reconciliation, and no error state for more than one (FR-037).
- [X] T037 [US3] Wire "Start over" — on both `src/routes/DeckLadder.tsx` and `src/routes/Run.tsx` — to clear only that deck's persisted `run` and begin a fresh run of the same rung (FR-032). `completedRungIds`, mastery, the rung's unlocked state, and every other deck's record are untouched (SC-015).
- [X] T038 [P] [US3] Write `src/routes/DeckList.test.tsx`: a deck with no record shows as not started and offers its smallest run; a deck with completed rungs shows the highest one; a mastered deck is marked mastered; a stored record for an unknown deck id causes no failure to start (FR-022).
- [X] T039 [US3] Extend `src/routes/DeckLadder.test.tsx` for resume and restart: an unfinished run appears on its own rung showing both Resume and Start over; Start over leaves `completedRungIds` unchanged and the rung still unlocked; two decks each keep their own unfinished run across a switch (SC-013).

**Checkpoint**: All three stories work independently. The feature is complete pending the
manual passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Manual passes T043–T045 were run by the maintainer on 2026-08-22 against the production
deployment** (not a preview — the feature had already landed on `main`). All three passed:
deep links resolve on a real deploy, progress survives quitting and reopening the browser,
and two decks each keep their own rung, cycle, and card.

- [X] T040 [P] Delete any file under `src/components/ui/` that no screen renders (Principle V: remove unused deps, including vendored components). Confirm with a grep for each vendored component's import across `src/`.
- [X] T041 [P] Correct six stale claims across this feature's own docs. **(1)**–**(5)** were surfaced by `/speckit-analyze` and all point the safe direction (they understate what is actually true); **(6)** was found during implementation. **(1)** `specs/001-deck-runs/research.md` §2 "Setup consequences" and § "Files the scaffold must produce" both say `tsconfig.json` needs `baseUrl`; TypeScript 7 removed it (`TS5102`) and the shipped scaffold uses `paths` alone, which resolve relative to the tsconfig — shadcn's own install guide is what carried the outdated instruction. **(2)** `specs/001-deck-runs/plan.md` § Constitution Check is annotated "Checked against constitution v1.4.0"; re-check it against **v1.5.0**, in which Principle VIII's license rule became a fast-path rather than a gate. **(3)** `plan.md`'s Principle III row still reads `DEFERRED — CI does not exist yet`; CI exists and both `Verify` and `Cloudflare Pages` are required status checks on `main`, so that row is now PASS. **(4)** `plan.md`'s Principle VIII row cites `TODO(DEP_LICENSES)` as pending; it was discharged by the 515-package audit in `specs/000-scaffold/research.md` §6. **(5)** `specs/001-deck-runs/quickstart.md` § Prerequisites says the `000-scaffold` feature "must have landed. Until then none of the commands below exist" — it landed; reword to past tense. **(6)** `specs/001-deck-runs/quickstart.md` § Manual 2 asserts that `jsdom` fakes `localStorage`; that is not true of this repo as configured. On Node 26 `globalThis.localStorage` resolves to the runtime's own experimental getter, which returns `undefined` without `--localstorage-file`, so jsdom's implementation never gets a look in and `safeStorage` falls back to its in-memory map for the whole suite. This *strengthens* the case for the T044 manual pass rather than weakening it — the test environment is even further from a real browser than the doc assumed. The same claim appears a second time in **T044's own line in this file**, which links to that section; correct both, or the task and the doc it cites will disagree. Leave `plan.md`'s *other* v1.4.0 mentions alone: they describe the amendment as history and are accurate. **Then, as a final step, sweep the docs for API-shape drift**: grep every identifier, function signature, and file path that `specs/001-deck-runs/*.md` and `specs/001-deck-runs/contracts/*.md` name against `src/` and the repository root, and reconcile any that no longer resolve. A spec-consistency pass structurally cannot catch these — each claim is internally consistent and only wrong relative to the code — and this is the check that would have caught the drift found in review: `plan.md` naming an `advance` transition the reducer never exported (`start` / `mark` / `restart`), `research.md` putting `strict` and `paths` in the root `tsconfig.json` when the root is solution-style and both live in `tsconfig.app.json`, `data-model.md` giving `restart` a `(state)` signature when it takes `(deck, state)` and calling `isStartable` `startable(rungs, i)`, and `research.md`'s scaffold gotcha still saying **Node 24** when the pin is 26.7.0.
- [X] T042 Run the full merge gate at the repository root: `npm run lint && npm run typecheck && npm test && npm run build`, then assert the build output shape — `dist/` contains no top-level `404.html` and no `_redirects` file (Principle I). CI's "Assert build output shape" step checks the same thing; run it locally first so the PR does not discover it.
- [X] T043 Manual pass 1 — deep links on the PR's Cloudflare Pages **preview** URL, not locally, per [quickstart.md § Manual 1](./quickstart.md#1-deep-links-on-a-real-deploy--principle-i). Navigate to a run, paste the URL into a fresh tab, and hard-reload on `/deck/dolch-prek-5/rung/r3`. The dev server resolves any path and will hide a broken deployment.
- [X] T044 Manual pass 2 — persistence across a real browser restart, per [quickstart.md § Manual 2](./quickstart.md#2-persistence-across-a-real-browser-restart--sc-006-sc-011). The automated suite never exercises a real `localStorage` at all — on Node 26 the runtime's own getter shadows jsdom's and yields `undefined`, so `safeStorage` runs on its in-memory fallback map for the whole suite. Only quitting the browser entirely and reopening proves the round trip (SC-006, SC-011, SC-009).
- [X] T045 Manual pass 3 — two decks in parallel, per [quickstart.md § Manual 3](./quickstart.md#3-two-decks-in-parallel--sc-013): mark cards in Dolch Pre-K, go home, mark cards in Dolch Kindergarten, return to Pre-K and find it on the same rung, cycle, and card (FR-036, SC-013).

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

---

## Phase 7: Convergence

**Appended by `/speckit-converge` on 2026-08-22**, assessing `main` at `f80e855` against
[spec.md](./spec.md), [plan.md](./plan.md), and Phases 1–6 of this file. All 45 prior tasks are
`[X]` and the feature is deployed; every item below is a gap found in the code **as it now
stands**, not leftover work from those phases.

Checked: 42 functional requirements, 15 success criteria, 13 user-story acceptance scenarios,
11 spec edge cases, 8 constitution principles, and plan.md's 5 Key Design Decisions.

Two things were re-checked and are **not** findings, because the code and the contract agree in
both directions — both are limitations [contracts/storage.md § Limits of the growth
rules](./contracts/storage.md#limits-of-the-growth-rules) already records deliberately: an
unknown field nested inside `run` does not survive a write (only top-level ones do), and an older
build restamps a newer record's `schemaVersion` downward.

- [X] T046 [P] **CRITICAL — remove the unused `lucide-react` runtime dependency** from `package.json` and regenerate `package-lock.json`, per **Constitution V** ("Remove unused deps, including vendored components no screen renders") (`unrequested`). It is declared at `package.json:23` (`"lucide-react": "^1.33.0"`) and imported by nothing: `grep -rn lucide src/ index.html specs/` returns no hits, and the lockfile shows no other package depends on it — it is a direct root dep only. Icons *are* pre-approved under Principle V's shadcn row, so the dependency class is fine; it being unused is what breaks the rule. Tree-shaking already keeps it out of `dist/`, so this changes no shipped byte — but [plan.md](./plan.md) § Constitution Check asserts PASS on Principle V and that row is wrong as written. **Leave `components.json:13` (`"iconLibrary": "lucide"`) alone** — it is a shadcn CLI preference, not a dependency, and `npx shadcn add` needs it to know what to wire up if a future component takes an icon.

- [X] T047 **HIGH — prove a written value actually reaches the real backing store** in `src/storage/safeStorage.test.ts`, per **Constitution IV** (storage-module coverage is required), SC-006 and FR-019 (`partial`). Today nothing does. Under Vitest on Node 26.7.0, `globalThis.localStorage` is `undefined` — the runtime's own experimental accessor shadows jsdom's, and `window.localStorage` is the same `undefined` — so `writeItem` returns `{ok: false, reason: 'unavailable'}` and the whole suite runs on the module's in-memory `Map`. Because `readItem` is mirror-first, every read short-circuits before it ever calls `getItem`. **Proven by mutation**: changing `storage.setItem(key, value)` to `storage.setItem(key, 'MUTANT-VALUE')` in `src/storage/safeStorage.ts` leaves **129/129 tests green**. The whole write path to the real store is invisible to CI. Add a test that installs a working storage double, writes through `writeItem`, then asserts the value observed *in the double* — and a read test that clears the in-memory mirror first, so the read is served by the store rather than the mirror. T044's manual pass covers this once by hand; it is not a regression guard (Principle III). This does not change `readItem`'s mirror-first precedence, which is correct and already defended — reversing it fails 3 tests.

- [X] T048 **Drop a stale run whose cards no longer match that rung's membership**, in `readRun` in `src/storage/deckRecord.ts`, per the spec edge case "Stored in-progress run state whose deck or rung no longer matches a revised deck configuration" and FR-029 (`partial`). The card check at `src/storage/deckRecord.ts:118-121` builds its set from `deck.cards` — every card in the *deck* — never from `rung.cardIds`. So a run for `r1` (`cardIds: [a,b]`) whose stored queue is `[a,b,c,d]` survives the read, and a run for `r2` (`cardIds: [a,b,c,d]`) whose queue is only `[a,b]` also survives — completing that one appends `r2` to `completedRungIds` having never presented `c` or `d`. The code matches [data-model.md § Discarding a stale run](./data-model.md#discarding-a-stale-run) exactly, so this is a gap in the *design*, not a drift from it; fixing it means adding a fourth condition there as well as in code. **Watch the cycle-1 trap**: from cycle 1 onward `queue` is deliberately the failed *subset*, not the rung's full list, so a naive `queue` -equals- `rung.cardIds` check would break every legitimate mid-run resume. **Correction, made while implementing this task:** the invariant first written here — a *subset* of `rung.cardIds`, plus a coverage check only at `cycleIndex === 0` — is too weak, and was mutation-proved so. It leaves a hole at cycle ≥ 1: a run at `cycleIndex: 1`, `queue: ['b']`, `passedThisRun: ['a']` against a rung now listing `['a','b','c']` is a subset, is not cycle 0, survives the read, and then completes the rung without ever presenting `c` — precisely the harm this task exists to prevent. The invariant that actually holds, verified across 152,306 reducer-produced states over every rung of both shipped decks, is **set equality at every cycle**: `queue` ∪ `failedThisCycle` ∪ `passedThisRun` equals `rung.cardIds` exactly. Cycle 0 starts with the whole rung in the queue; each later cycle re-queues exactly what it failed while everything else has already passed — so every rung card is accounted for either way. Touches the same function as T054.

- [ ] T049 [P] **Verify the Cloudflare Pages project's build command and `NODE_VERSION`, and record the result in the repo**, per **Constitution III** ("Runtime version pinned identically in `.nvmrc`, `engines`, CI workflow, and Pages env" and "CI build uses the same command Cloudflare Pages runs") (`partial`). Three of the four pins are verified in-repo and agree: `.nvmrc` = `26.7.0`, `package.json` `engines.node` = `26.7.0`, and `.github/workflows/ci.yml` reads `node-version-file: .nvmrc`. The fourth lives in the Cloudflare dashboard and is recorded **nowhere in this repository** — `specs/000-scaffold/tasks.md` has no Pages task at all, and [research.md](./research.md) stating the intended `NODE_VERSION = 26.7.0` is a plan, not evidence. [plan.md](./plan.md) § Constitution Check asserts the propagation as fact. Check the dashboard, confirm the build command is `npm run build` and `NODE_VERSION` is `26.7.0`, correct either if it has drifted, and write what you found into the repo so the next audit does not have to leave this open. Read-only repo access structurally cannot close this one.

- [X] T050 [P] **Reject a rung whose `cardIds` is empty**, adding a rule to `validateDeck` in `src/decks/validate.ts` with a malformed fixture in `src/decks/validate.test.ts`, per FR-004, FR-005, SC-007 and data-model invariant **I5** (`missing`). None of V1–V7 requires a rung to be non-empty, and `start` in `src/run/reducer.ts` does not guard it. Confirmed by probe: `rungs: [{id: 'r1', cardIds: []}, {id: 'r2', cardIds: ['a','b']}]` returns `[]` from `validateDeck`, and `start(deck, 'r1')` then yields `{queue: [], position: 0, status: 'running'}` — an empty queue while `running`, which I5 forbids; marking it pushes `undefined` into `passedThisRun`. Both shipped Dolch decks are unaffected and cannot reach this. It is reachable through exactly the config-only deck-addition path FR-005 and SC-007 promise, which is what makes it worth a loud failure at CI rather than a silent broken run for whoever authors deck three. Note the read path already handles its own version of this — `readRun` drops a persisted run with an empty `queue` (`src/storage/deckRecord.ts:128`) — so this is the authoring side of a check the storage side already makes.

- [ ] T051 **Confirm which error a full `localStorage` actually throws in every target browser, and widen the quota check if it differs**, in `src/storage/safeStorage.ts:64-71`, per **Constitution II** ("Handle `QuotaExceededError` explicitly and surface it") (`partial`). Classification matches on `error.name === 'QuotaExceededError'` alone; anything else falls through to `reason: 'unavailable'`, and `src/routes/Run.tsx:81` gates the "progress is not being saved" banner on `'quota-exceeded'` only — so a mismatch means a learner with a full profile is silently lied to, which is the exact outcome FR-028's handling exists to prevent. **This is a lead, not a confirmed defect**: Firefox has historically thrown a `DOMException` named `NS_ERROR_DOM_QUOTA_REACHED` (code 1014) rather than `QuotaExceededError` (code 22), and whether that is still true of current Firefox was **not verified** — it cannot be tested from this environment, since the suite never reaches a real store at all (see T047). Check it against the evergreen browsers plan.md § Target Platform names before changing anything. If the name does differ, widen to cover the code as well as the name; if it does not, record that and close this task without a code change.

- [X] T052 [P] **Correct the status block in `README.md`** (lines 9-12), per **Constitution VI** and this feature's actual state (`contradicts`). It reads: "**Status: scaffold.** The build, test, and CI pipeline are in place. The flashcard feature itself is specified in `specs/001-deck-runs/` and **not yet built**. What renders today is deliberately disposable placeholder content." Every part of that is now false — all 45 tasks above are `[X]`, `src/routes/{DeckList,DeckLadder,Run}.tsx` are the real screens, `src/app/router.tsx` routes all three paths, and T033 removed the last placeholder. `git log -- README.md` shows one commit (`51a3224`, the scaffold) and no edit since. T041's documentation sweep was scoped to `specs/001-deck-runs/*.md` and never reached the repository's front page — which, on a public repo, is the first thing a reader sees and currently tells them the app does not exist.

- [ ] T053 **Send "Run not found" back to the deck's own ladder when the deck resolves but the rung does not**, in `src/routes/Run.tsx:91-103`, per FR-034 (`partial`). Navigation is specified as a tree, so the parent of `/deck/dolch-prek-5/rung/r99` is that deck's ladder, not the deck list — but the branch tests `deck === undefined || rung === undefined` together and its only link is `to="/"`. Split the two cases: unknown deck keeps "Back home", unknown rung on a known deck offers that deck's ladder. `src/routes/DeckLadder.tsx:24` linking home is already correct, because there the deck genuinely does not exist. Error path only — the normal exit at `src/routes/Run.tsx:201` is right. Shares `src/routes/Run.test.tsx` with T057.

- [X] T054 **Reject a stored run whose cards still to come overlap `passedThisRun`**, in `readRun` in `src/storage/deckRecord.ts`, per FR-030 and SC-009 (`partial`). **This task originally read "whose `queue` overlaps `passedThisRun`", and that was wrong** — implementing it literally breaks every mid-cycle resume, so the wording is corrected here. `mark` in `src/run/reducer.ts` leaves `queue` untouched within a cycle and only advances `position`, so a card marked earlier in this cycle sits in the queue *behind* the cursor and is legitimately in `passedThisRun` as well; `PRE_K_RUN` in `src/routes/DeckLadder.test.tsx` is exactly that shape, and the blanket check discards it. **Proven by mutation**: the blanket version fails **11 tests across three files**, the FR-028/FR-029/FR-030 resume tests among them. What FR-030 forbids is *re-presenting*, and only the cards at or after `position` are ever presented, so the invariant is `queue.slice(position)` ∩ `passedThisRun` = ∅ — which is [data-model.md](./data-model.md#invariants--these-are-the-test-list) **I1** ("a card in `passedThisRun` never appears in any later `queue`") enforced on the read path. FR-030 is unconditional — a resumed run MUST NOT re-present an already-passed card — but the read path enforced no relationship between the two arrays. Confirmed by probe: a stored run with `queue: ['a','b']`, `position: 0` and `passedThisRun: ['a']` was returned verbatim and re-presented `a`; duplicates within `queue`, `failedThisCycle`, or `passedThisRun` also survive. This is unreachable from records this app writes, since the reducer cannot produce that shape — it needs a corrupt or externally-written record — and [contracts/storage.md § Hostile storage](./contracts/storage.md#hostile-storage)'s "wrong shape → salvage known fields that typecheck" arguably licensed it, so contract and code did agree. Decided deliberately: the disjointness check is added (cheap, and T048 was already editing this function) rather than recorded in that contract row as an accepted exclusion. What is not acceptable is FR-030 reading as unconditional while the code has a hole in it. Touches the same function as T048.

- [X] T055 [P] **Assert the literal `flashrunner:` key namespace in a test**, per **Constitution II** ("All keys namespaced `flashrunner:`") and **Constitution IV** (`partial`). The code satisfies the MUST at `src/storage/keys.ts:4,8`, but nothing defends it: every test derives its key by calling `deckKey()` itself, so no test would notice if the prefix vanished. **Proven by mutation**: changing `deckKey` to return `` `deck:${deckId}` `` leaves **129/129 tests green**. One assertion that `deckKey('dolch-prek-5') === 'flashrunner:deck:dolch-prek-5'` closes it — a namespace collision with another app on the same origin is silent data loss, which is why the constitution makes it a MUST rather than a convention.

- [X] T056 **Replace three storage tests that pass whether or not the code works**, per **Constitution IV** (`partial`). (a) `src/storage/safeStorage.test.ts:110-116` — "keeps one deck readable when another deck holds a corrupt value" — `safeStorage` has no JSON awareness whatsoever, so this is a two-key string round-trip that cannot fail for any implementation that round-trips; it also duplicates `:58-63`. The behaviour it claims to cover is genuinely covered at `src/storage/deckRecord.test.ts:159-167`, which is the right layer for it. (b) `src/storage/safeStorage.test.ts:58-63` — "round-trips a value when storage works" — the read is served by the in-memory mirror and never reaches `workingStorage`, so it survives T047's mutation; folding it into T047's store-observing test is the fix. (c) The `!Number.isInteger(cycleIndex)` half of the guard at `src/storage/deckRecord.ts:125` has no test — only `cycleIndex < 0` does (`src/storage/deckRecord.test.ts:152-157`), and deleting the integer half leaves **129/129 green**. That guard carries a comment at `src/storage/deckRecord.ts:122-124` explaining precisely why it exists (`queue[1.5]` is `undefined`, resuming into a `running` state with no current card) — so the reasoning was written down and then never asserted. Add the `cycleIndex: 1.5` case.

- [ ] T057 **Assert that abandoning a run mid-way records no completion**, in `src/routes/Run.test.tsx`, per FR-012 (`partial`). The behaviour is correct by construction — leaving triggers no write at all, and `persist` appends to `completedRungIds` only when `isComplete` (`src/routes/Run.tsx:72-78`) — but `src/routes/Run.test.tsx:145-151` asserts only the back-link's `href`. Nothing asserts the *consequence* the requirement is actually about: start a run, mark a card or two, leave, and confirm `completedRungIds` is unchanged. Every neighbouring requirement has that guard; this one does not. Shares `src/routes/Run.test.tsx` with T053.

### Phase 7 notes

- **Severity order**: T046 is the only constitution violation and leads the phase. T047 is the highest-value item that is not one — it is the difference between the storage module being tested and appearing to be tested.
- **File-sharing groups** (safe to batch, not safe to parallelise against each other): T048 + T054 both edit `readRun` in `src/storage/deckRecord.ts`; T047 + T051 + T056 all touch `src/storage/safeStorage.test.ts`; T053 + T057 both touch `src/routes/Run.test.tsx`. Everything marked `[P]` is disjoint from everything else.
- **Two tasks may close with no code change**: T049 (if the Pages settings already match) and T051 (if `QuotaExceededError` is the name every target browser throws). Both still need the answer written down — an unverified claim in `plan.md` is what generated each of them.
- **Principle VI still applies.** Each task above fixes a stated requirement or a stated principle. None of them licenses adjacent work.
