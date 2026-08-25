---

description: "Task list for 006-run-progress-bars"
---

# Tasks: Run Progress Bars

**Input**: Design documents from `/specs/006-run-progress-bars/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[contracts/run-progress.md](./contracts/run-progress.md), [quickstart.md](./quickstart.md)

**Tests**: Included, and mostly not new. 17 existing assertions in `src/routes/Run.test.tsx` break
when the sentence is deleted, so the bulk of the test work is migration rather than addition. Six
proposed new assertions were cut during `/speckit-analyze` for being tautological, change-detectors,
or already covered — see [Tests that were cut](#tests-that-were-cut).

**Organization**: Tasks are grouped by user story. Read [Why this order](#why-this-order) before
starting — the sequencing is deliberate and differs from the obvious one.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — maps to the user stories in [spec.md](./spec.md)
- Paths are repository-relative. This is a single-project SPA: everything lives under `src/`.

---

## Why this order

The obvious first move — delete `CycleCounter` — turns 17 assertions in `src/routes/Run.test.tsx`
red immediately, and leaves them red across every subsequent task. The order below avoids that.

**The sentence survives until Phase 3.** Phase 2 adds the run bar *beside* it. That leaves a
temporary state where the screen shows both a bar and "N cards left in this round", which looks
wrong and is meant to: it is what lets Phase 2 finish with a completely green tree, all 17 original
assertions still passing, and the new bar independently verified before the risky edit begins.
Phase 3 then does the deletion and the migration together, as one atomic group.

This is a sequence within one branch, not a series of PRs. A reviewer sees only the end state, where
FR-010 holds and the sentence is gone.

**There is no Foundational phase.** An earlier draft had one, holding two selectors and their unit
tests. Both were cut ([research.md § Decision 9](./research.md)) — the derivations are now four lines
inline at the one call site, and the invariant the tests would have proven is already asserted by
`src/run/reducer.test.ts:268` and `:293`. Nothing blocks the user stories, so no phase stands between
setup and them.

---

## Phase 1: Setup

**Purpose**: Get the vendored component in, and prove it cost nothing.

- [X] T001 Add the progress component by running `npx shadcn add progress` from the repository root. It resolves through this project's preset (`radix-nova`) and writes `src/components/ui/progress.tsx`. Do **not** hand-write the file, and do **not** edit it afterwards — it ships verbatim ([research.md § Decision 5](./research.md)).

- [X] T002 Confirm nothing was installed: `git diff --stat package.json package-lock.json` must be **empty**. `radix-ui` is already a dependency at `^1.6.7` and already used for `Slot` in `src/components/ui/button.tsx`, so this component is a file copy (plan.md, Principle V). Any diff here means something went wrong and Principle V/VIII need revisiting before continuing. The "still unmodified" check happens later, at T017.

**Checkpoint**: `npm run lint && npm run typecheck && npm test && npm run build` is green. The
component exists and nothing renders it yet.

---

## Phase 2: User Story 1 — A learner sees how close the run is to being over (Priority: P1) 🎯 MVP

**Goal**: The run bar, in its final position, growing only on "Got it" and full exactly at completion.

**Independent Test**: Start a run on `r1` (five words), mark cards one at a time, and confirm the bar
advances a fifth per "Got it", does not move on "Not yet", and is full on the same mark that shows
"Run complete". The sentence is still on screen at this point; ignore it.

- [X] T003 [US1] Create `src/components/RunProgress.tsx`. Presentational, no state, no effect. Declare the count shape locally — it is not exported and has no other user:

  ```tsx
  type Count = { done: number; total: number };

  function percent({ done, total }: Count): number {
    return (done / total) * 100;
  }

  export function RunProgress({ run }: { run: Count }) {
    return (
      <div className="fixed inset-x-0 top-0 z-10">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-1 px-6">
          <Progress
            className="h-1.5"
            value={percent(run)}
            aria-label="Cards got right"
            aria-valuetext={`${run.done} of ${run.total} cards`}
          />
        </div>
      </div>
    );
  }
  ```

  The cycle bar is added in T007. The file must carry a comment stating the rule from
  [contracts/run-progress.md § 3](./contracts/run-progress.md): **`value` is a percentage and `max`
  is never passed**, because the vendored component's transform hardcodes `100 - value`, so
  `value={2} max={5}` renders a bar 2% full while announcing "2 of 5". Also note that the percentage
  is deliberately not rounded, since rounding would let `(n-1)/n` reach 100 for `n ≥ 200` and
  contradict FR-004. The inner `max-w-xl px-6` deliberately mirrors `<main>`'s own column so the bars
  align with the card's edges (FR-016).

- [X] T004 [US1] Wire it into `src/routes/Run.tsx`. Three edits inside `RunLoop`:
  - Return a fragment: `<><RunProgress run={{ done: state.passedThisRun.length, total: rung.cardIds.length }} /><main …>…</main></>`. Built inline rather than through a selector ([research.md § Decision 9](./research.md)). No zero guard — `validate.ts` rule V8 forbids an empty rung.
  - Placing it before `<main>` rather than inside it satisfies FR-025's reading order and avoids any question about `<main>`'s `gap-8` spacing, which 003's research flagged as worth keeping stable. Because it lives in `RunLoop` and outside the `complete ? … : …` branch, FR-019 (no bars on the two "Run not found" screens, which live in `Run`) and FR-020 (bars survive onto the run-complete screen) both fall out with no condition written for either. Add a comment saying so.
  - Change `<main>`'s `p-6` to `px-6 pb-6 pt-9` (FR-017). Written out rather than appending `pt-9` because this className is a plain string, not passed through `cn()`, so `tailwind-merge` is not there to resolve the conflict. `pt-9` is the original 24px plus the 12px the bars occupy (`h-1.5` + `gap-1` + `h-0.5`).

  Leave the `<CycleCounter>` line alone. It goes in T008.

- [X] T005 [US1] Add the shared reader and three assertions to `src/routes/Run.test.tsx`. Put the reader near the existing helpers, since T009 uses it 17 more times:

  ```ts
  function progressOf(name: string): string | null {
    return screen.getByRole('progressbar', { name }).getAttribute('aria-valuetext');
  }
  ```

  Then assert, through role and accessible name only — never `aria-valuenow`, never `data-state`, never a class name ([contracts/run-progress.md § 4](./contracts/run-progress.md)):
  - A fresh run on `r1` reads `0 of 5 cards`. (FR-002)
  - Two "Got it" marks read `2 of 5 cards`; a following "Not yet" **still** reads `2 of 5 cards`. This is the load-bearing claim about the run bar — one test, both halves. (FR-003, SC-005)
  - Clearing all five reads `5 of 5 cards` on the run-complete screen. (FR-004, FR-020, SC-003)

  Do **not** add tests for start-over, resume, or the pronounce control. All three are existing tests among the 17 that T009 migrates, and the migration proves them — see [Tests that were cut](#tests-that-were-cut).

- [X] T006 [US1] Run the full gate: `npm run lint && npm run typecheck && npm test && npm run build`. All 17 original `'N cards left in this round'` assertions must **still pass** — nothing has been deleted yet, so if any of them fail, T004 changed something it should not have.

**Checkpoint**: US1 is complete and independently verifiable. The screen temporarily shows both the
run bar and the old sentence. The tree is green.

---

## Phase 3: User Story 2 — An adult sees how far through the current pass the child is (Priority: P2)

**Goal**: The cycle bar, and the removal of the sentence it replaces.

**Independent Test**: Mark a mix of outcomes and confirm the lower bar advances on every mark
regardless of outcome, then returns to empty on the first card of the next cycle, measured against
that cycle's own size.

**⚠️ T007–T010 are one atomic group.** The tree is red from the moment T008 lands until T009
finishes. Do not stop in the middle, and do not commit T008 on its own.

- [X] T007 [US2] Add the cycle bar to `src/components/RunProgress.tsx`. Widen the props to `{ run, cycle }: { run: Count; cycle: Count }` and add a second `<Progress>` **below** the first, inside the same flex column:

  ```tsx
  <Progress
    className="h-0.5"
    value={percent(cycle)}
    aria-label="Cards done in this round"
    aria-valuetext={`${cycle.done} of ${cycle.total} cards`}
  />
  ```

  `h-0.5` against the run bar's `h-1.5` is the whole of the differentiation — by mass, not colour, so
  it survives dark mode and any future theme (FR-013). `tailwind-merge` inside the component's `cn()`
  resolves both against the Root's shipped `h-1`. Add a comment recording that colour was rejected
  because the indicator's `bg-primary` sits on a child no prop reaches
  ([research.md § Decision 2](./research.md)). Add no colour token to `src/index.css` (FR-014).

- [X] T008 [US2] Remove the sentence. In `src/routes/Run.tsx`: delete the `<CycleCounter …/>` line, delete its import, and pass `cycle={{ done: state.position, total: state.queue.length }}` to `RunProgress`. Then delete `src/components/CycleCounter.tsx` outright. Nothing goes in the gap between the card and the outcome buttons (FR-010, FR-011, FR-018).

- [X] T009 [US2] Migrate all 17 broken assertions in `src/routes/Run.test.tsx`. **Find them by string, not by line number** — T005 inserted a helper and three tests into this file, so the line numbers recorded during planning have shifted. Locate them with:

  ```bash
  grep -n "cards\? left in this round" src/routes/Run.test.tsx    # expect 17 hits
  ```

  Each is a `screen.getByText('N cards left in this round')`. Replace each with a `progressOf('Cards done in this round')` read, converting the count: the sentence counted **down** from the cycle size, the bar counts **up**, so `'5 cards left in this round'` becomes `'0 of 5 cards'` and `'1 card left in this round'` becomes `'0 of 1 cards'`. Note that `aria-valuetext` is always plural "cards", including `0 of 1 cards`; the deleted sentence special-cased the singular and this does not ([contracts/run-progress.md § 1](./contracts/run-progress.md)).

  Most of these sites are not testing the counter at all — they use it as a cheap proxy for "the run advanced" inside tests about resuming, restarting, storage, and the ladder. Where that is the case, assert **both** bars, which is strictly better evidence than the sentence ever was. Three sites are load-bearing for requirements no other task covers, so get them right:
  - the "Start over" test → proves FR-008 for both bars
  - the resume tests → prove FR-009
  - the pronounce test, whose surrounding assertions already claim "no outcome, no advance, nothing stored" → proves FR-022

- [X] T010 [US2] Delete `remainingInCycle` from `src/run/selectors.ts`, now that nothing renders it (Principle V — remove what nothing uses). Add nothing in its place. Then **trim, do not rewrite**, the two tests in `src/run/reducer.test.ts` that use it (currently the `describe('selectors')` block, around lines 466–487): drop the `remainingInCycle` assertions, keep the `currentCard` ones, and drop it from the file's import list. The second test becomes "reports no current card once complete".

- [X] T011 [US2] Add three assertions for the cycle bar to `src/routes/Run.test.tsx`:
  - One "Not yet" advances the cycle bar while leaving the run bar unmoved — a single test asserting both, which is the clearest possible statement of what separates the two indicators. (FR-005, SC-005) **Landed in T009 instead**: the sentence's own test was one of the 17, and migrating it produced exactly this assertion. Writing it a second time would have been the duplication this feature's test plan spends a whole section avoiding.
  - Four "Got it" then one "Not yet" on `r1` opens a one-card cycle: cycle reads `0 of 1 cards`, run reads `4 of 5 cards`. Then one more mark reads against that cycle's own size, not the rung's. (FR-006, FR-007, SC-006)
  - Both bars read full on the run-complete screen. (FR-020) Added as one line to T005's completion test rather than as a test of its own, for the same reason.

  Do **not** add `queryByText(/cards left in this round/)` — T016's grep covers it statically and cannot pass by accident. See [Tests that were cut](#tests-that-were-cut).

- [X] T012 [US2] Run the full gate. It must be green again. If any assertion still references the deleted sentence, T009 missed a site — re-run its grep, which must return zero hits.

**Checkpoint**: US1 and US2 both complete. The sentence is gone, both bars work, the tree is green.
Everything assertable in jsdom is now asserted.

---

## Phase 4: User Story 3 — The indicators stay readable and stay out of the way (Priority: P3)

**Goal**: Prove the placement, which is the half of this feature no jsdom test can see.

**Independent Test**: Open a run at several viewport sizes and confirm the pair stays capped, centred,
pinned, and non-obscuring.

- [X] T013 [US3] Add the one structural assertion that is genuinely testable and not implied elsewhere, to `src/routes/Run.test.tsx`: neither "Run not found" screen has any progress bar. Use `queryAllByRole('progressbar')` and expect it empty, once for an unknown deck and once for an unknown rung of a real deck. (FR-019) Nothing else goes here — the "distinct accessible names" and "no percent sign" assertions were cut as tautological.

- [ ] T014 [P] [US3] Manual layout checks per [quickstart.md](./quickstart.md) § Manual checks, on `npm run dev` at `/deck/dolch-prek-5/rung/r1`. Record the outcome of each in the PR:
  - Bars stay the content column's width and centred when the window is widened to ultra-wide, aligned with the card's edges. (FR-016, SC-008)
  - Bars stay at the top edge when the window is short enough to scroll, and the "Deck · rung" heading is never clipped behind them. (FR-015, FR-017, SC-009)
  - The space between the card and the outcome buttons is empty. (FR-018, SC-007)
  - A pre-reader's view: from the top bar alone, the run reads as near its start, middle, or end. (SC-001, SC-002)

- [ ] T015 [P] [US3] Manual appearance and motion checks, same session:
  - Upper bar is visibly thicker than the lower one, and stays so in dark mode with no new colour appearing. (FR-012, FR-013, FR-014)
  - Four "Got it" then one "Not yet": the lower bar visibly slides back to empty. This animation is expected and runs for everyone, including a device asking for reduced motion — a deliberate decision, so do not "fix" it ([research.md § Decision 5](./research.md), FR-021).

  Do not re-check "full exactly at completion" by hand; T005 asserts it automatically.

**Checkpoint**: all three stories complete. Everything in the spec has been verified by test or by eye.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T016 [P] Sweep for leftovers. All four must return no hits:
  ```bash
  grep -rn "left in this round" src/
  grep -rn "CycleCounter" src/
  grep -rn "remainingInCycle" src/
  grep -rn "max=" src/components/RunProgress.tsx
  ```

- [ ] T017 [P] Confirm the vendored component is still unmodified — it is easy to "improve" a file you have been working next to, and [research.md § Decision 5](./research.md) says it ships verbatim:
  ```bash
  grep -c 'className="size-full flex-1 bg-primary transition-all"' src/components/ui/progress.tsx
  # expect: 1 — no motion-safe: token, nothing added
  ```
  The only permitted difference from `npx shadcn view progress` output is the import alias, which the CLI rewrites from `@/registry/radix-nova/lib/utils` to `@/lib/utils`.

- [ ] T018 [P] Screen reader spot check with VoiceOver (⌘F5) or equivalent. Focus each bar: it must be announced by its own name, with the value spoken as **cards** — "2 of 5 cards" — never as a percentage. Automated tests prove the attributes exist; only a reader proves what is said. (FR-024, SC-010)

- [ ] T019 Open the PR, running the gate one final time in CI order first: `npm run lint && npm run typecheck && npm test && npm run build`. The description states what was asked for, so Principle VI can be checked against it. Call out four things a reviewer would otherwise have to discover: no new dependency (`git diff package.json` is empty), no vendored code modified, no persisted shape change so no `schemaVersion` bump or migration, and no new exported function. Note the two planning amendments — FR-021 dropped reduced-motion handling at the maintainer's direction, and `/speckit-analyze` cut a `CardCount` type plus two selectors and six redundant assertions.

- [ ] T020 On the PR's Pages preview, re-run T014's viewport checks — on a real phone if one is to hand. Per constitution Principle I, viewport and deep-link behaviour is verified on a preview deploy, not on the dev server.

---

## Tests that were cut

`/speckit-analyze` checked each proposed assertion against what the repo already asserts. Six were
cut. Recorded here so nobody helpfully adds them back.

| Cut assertion | Why |
|---|---|
| Six unit tests for `cardsGotThisRun` / `cardsDoneThisCycle` | Every one already covered. `reducer.test.ts:268` (I3) asserts `passedThisRun.length === rungSize` **if and only if** `isComplete`, both directions. `:293` (I6) asserts no card is counted twice. `:246` (I2) and `:281` (I5) cover the cycle boundary. The selectors themselves were then cut too, having nothing left to justify them. |
| `expect(valuetext).not.toContain('%')` | `aria-valuetext` is the template literal `` `${done} of ${total} cards` ``. It cannot contain a percent sign. The assertion tests a string you just wrote. |
| `queryByText(/cards left in this round/)` absent | A change-detector on deleted text: it can only fail if someone retypes the exact string. T016's `grep` checks it statically, across all of `src/`, and cannot pass by accident. |
| "Both bars are addressable by distinct accessible names" | Every other test calls `getByRole('progressbar', { name })`, which throws if the names collide or go missing. Already proven 20+ times over. |
| Separate tests for start-over and resume | Both are *existing* tests among the 17 T009 migrates. Writing them again duplicates the migration. |
| A separate test that pronounce moves neither bar | `Run.test.tsx:1013` already asserts pronounce causes "no outcome, no advance, nothing stored", and one of the 17 migrated assertions sits **inside that very test** — so after T009 it literally asserts the bars did not move. |
| A manual re-check that the run bar is full exactly at completion | T005 asserts it automatically. Manual duplication of a covered automated claim is waste. |

---

## Dependencies & Execution Order

### Phase dependencies

```
Phase 1 (Setup: T001–T002)
    │
    ▼
Phase 2 (US1 run bar: T003–T006)     ← MVP; tree green, sentence still present
    │
    ▼
Phase 3 (US2 cycle bar + removal: T007–T012)   ← T007–T010 atomic; tree red mid-group
    │
    ▼
Phase 4 (US3 placement: T013–T015)
    │
    ▼
Phase 5 (Polish: T016–T020)
```

### Where the stories are genuinely independent, and where they are not

Being straight about this, because the template's model does not quite fit.

- **US1 is independently deliverable.** Phase 2 ends with a working, tested run bar and a green tree.
  If work stopped there, the feature would be half-shipped but coherent.
- **US2 is not independent of US1.** Both bars render from the same component and the same call site
  in `Run.tsx`, and the sentence's removal is what US2's bar exists to justify. It is sequenced after
  US1 rather than parallel to it.
- **US3 is not a separate increment at all.** The placement it describes is built into US1's very
  first line — the `fixed` wrapper is in T003. Its phase is verification, not construction. The spec
  gave it P3 because placement correctness is separable as a *test* concern, which is true, and that
  is exactly what Phase 4 does with it.

A reviewer should not expect three deployable slices here. There is one MVP checkpoint (end of
Phase 2) and one complete feature (end of Phase 3).

### Within each phase

- T003 → T004 → T005: the component, then its call site, then assertions against what renders.
- T007 → T008 → T009: the cycle bar must exist before the sentence goes, or `Run.tsx` will not
  typecheck; the assertions must be migrated before the tree is green again.
- T009 must run **after** T005, which is why it locates its targets by grep rather than by the line
  numbers recorded at planning time.
- T013 depends on Phase 3 — it needs both bars to exist to assert their absence elsewhere.

### Parallel opportunities

Genuinely few, because this is a small feature that mostly touches three files in sequence.

- **T014 and T015** — both manual, same dev session, different things to look at.
- **T016, T017, T018** — independent verification passes over a finished tree.

Nothing in Phases 1–3 is parallelisable: `RunProgress.tsx` → `Run.tsx` → `Run.test.tsx` is a straight
dependency chain, and marking any of it `[P]` would be a lie.

---

## Implementation Strategy

### MVP (Phases 1–2)

1. T001–T002 — component in, nothing installed.
2. T003–T006 — the run bar, in its final position, with three assertions that can each fail for a
   real reason.
3. **Stop and validate.** The tree is green, all 17 original assertions still pass, and the run bar
   can be demonstrated. The old sentence is still on screen; that is expected at this checkpoint.

This is the point of maximum safety: the risky work has not started, and the new component is
already proven.

### Completing the feature (Phases 3–5)

4. T007–T012 as one sitting. The tree is red from T008 until T009 lands — do not leave it there.
5. T013–T015 — verify the placement, most of it by eye.
6. T016–T020 — sweep, verify, screen reader, PR, preview.

### Rollback

No storage shape changed and no migration ran, so reverting the branch is the whole rollback. A
device holding a run written by this build resumes correctly on the previous build, because the
persisted record is byte-identical.

---

## Notes

- **The `max` trap.** `value` is a percentage and `max` is never passed. `value={2} max={5}` renders
  a bar 2% full while announcing "2 of 5", because the vendored transform hardcodes `100 - value`.
  Verified empirically; recorded in [contracts/run-progress.md § 3](./contracts/run-progress.md).
  T016's last grep exists to catch a regression.
- **The cycle bar never reads full mid-run.** `done` counts cards *marked*, so the last card of a
  five-card cycle reads `4 of 5`. It reaches full only at completion. Not an off-by-one — do not
  "fix" it.
- **Tests may bind to role, accessible name, and `aria-valuetext`. Nothing else.** Not
  `aria-valuenow` (an unrounded percentage — a three-card rung yields `33.33333333333333`), not
  `data-state`, not `data-slot`, not class names. Principle IV, and
  [contracts/run-progress.md § 4](./contracts/run-progress.md).
- **No new exported function.** Both counts are built inline in `Run.tsx`; the count shape is local to
  `RunProgress.tsx`. If a second call site ever appears, that is when a selector is earned
  ([research.md § Decision 9](./research.md)).
- **The vendored component ships verbatim.** No `motion-safe:`, no edits. FR-021 was amended during
  planning to drop reduced-motion handling; the known inconsistency with `PronounceButton.tsx:128`
  is recorded and accepted in [research.md § Decision 5](./research.md).
- Commit after each task or logical group, except T007–T010, which commit together.
