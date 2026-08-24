---

description: "Task list for Outcome Button Icons"
---

# Tasks: Outcome Button Icons

**Input**: Design documents from `/specs/003-outcome-button-icons/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[contracts/outcome-buttons.md](./contracts/outcome-buttons.md), [quickstart.md](./quickstart.md).
No `data-model.md` — this feature involves no data.

**Revised 2026-08-23** after maintainer direction: `lucide-react` supplies both icons, both are
circled, and the green is `green-800` taken without measurement. T003, T004, T008 and T012 changed
meaning; the rest stand. Task IDs are unchanged so the GitHub issues (#114–#130) stay aligned.

**Tests**: One assertion is added. The spec did not ask for TDD, and the behavioural suite that guards
this change **already exists** — roughly twenty `getByRole('button', { name: ... })` queries in
`src/routes/Run.test.tsx`. Those are the regression guard for FR-015 and must pass **unmodified**.

**Organization**: By user story. Be warned that the stories are not independent in the usual sense:
US1 and US2 edit the same twenty lines of the same file, and US3 is verification with no code of its
own. Sequential order is the only sane one here. Marked accordingly rather than dressed up.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are in every task

## Path Conventions

Single project. Source at `src/`, tests colocated beside the code they cover (there is no `tests/`
directory in this repo). Paths below are from the repository root.

**The feature is four files**: `src/components/OutcomeButtons.tsx`, `src/routes/Run.test.tsx`,
`package.json` and `package-lock.json`. A fifth file is a scope failure — see T012.

---

## Phase 1: Setup

**Purpose**: A working tree that can run the gate.

- [ ] T001 Install dependencies from the lockfile: `npm ci` at the repository root. `node_modules` is
  absent in this tree, so nothing runs until this does.
- [ ] T002 Record the baseline: run `npm test` and confirm the suite is green **before** any edit, so
  a later failure is attributable to this change and not inherited.

---

## Phase 2: Foundational

**None.** There is no blocking prerequisite: no schema, no route, no shared module, no CSS token to
define. `src/components/ui/button.tsx` and `src/index.css` are both left untouched by design (see
[plan.md § Adjacent work](./plan.md#adjacent-work-named-and-declined)).

**Checkpoint**: after T002, story work begins immediately.

---

## Phase 3: User Story 1 - A child can tell the two buttons apart without reading (Priority: P1) 🎯 MVP

**Goal**: Each outcome button shows a large centred icon with its wording smaller underneath — a
circled check mark for "Got it", a circled question mark for "Not yet".

**Independent Test**: Open `http://localhost:5173/deck/dolch-prek-5/rung/r1`. Both buttons show a
large icon above smaller wording. Cover the wording: the tick and the question mark alone still say
which is which. Pressing each still records its outcome and advances the run.

### Implementation for User Story 1

- [ ] T003 [US1] Add the dependency: `npm install lucide-react` (not `npm ci` — this has to write the
  manifests). Confirm it resolves to **1.33.0** or later and that the licence is **ISC**, then commit
  both `package.json` and `package-lock.json` — Principle III requires a clean-checkout `npm ci` to
  succeed. This package was removed from the repo during 001 as unused
  ([#63](https://github.com/k-electron/flashrunner/issues/63)); this feature is its first real use.
- [ ] T004 [US1] In `src/components/OutcomeButtons.tsx`, import the two icons:
  `import { CircleCheck, CircleQuestionMark } from 'lucide-react'`. `CircleCheck` is the canonical
  name — `CheckCircle` still exists but is a legacy alias for a **different** icon
  (`circle-check-big`). Render `CircleCheck` in "Got it" and `CircleQuestionMark` in "Not yet". Each
  **MUST** carry an explicit `size-*` class — `src/components/ui/button.tsx:8` ends with
  `[&_svg:not([class*='size-'])]:size-4`, so an unsized icon is silently forced to 16px and FR-002
  fails with no error. Start at `size-12`. Mark each `aria-hidden` (FR-008).
- [ ] T005 [US1] In the same file, restructure both `Button` children into a stacked layout: add
  `flex-col` and a small gap to each button's `className`, raise the height from `h-16` to `h-24`, and
  drop `text-xl` in favour of a label size smaller than the icon (`text-base`). The label MUST remain
  a **plain text child** — no `aria-label`, no `<title>` — so each accessible name stays exactly
  "Got it" / "Not yet" (FR-014, FR-015). `flex-col` is safe alongside the base class's `inline-flex`:
  `tailwind-merge` groups display and flex-direction separately.
- [ ] T006 [P] [US1] In `src/routes/Run.test.tsx`, add one assertion that each label renders as
  **visible text** inside its button (`getByText('Got it')`, `getByText('Not yet')`). The existing
  `getByRole('button', { name: ... })` queries pass whether the name comes from visible text or from
  an `aria-label`, so they alone would not catch an icon-only button with a hidden label. Different
  file from T004–T005, so this can be written in parallel with them.

**Checkpoint**: `npm test` green. The icons are visible, correctly sized, and announced by wording
only. US1 is shippable on its own — the buttons still look like today's grey pair, just with icons.

---

## Phase 4: User Story 2 - Green marks the positive answer (Priority: P2)

**Goal**: The "Got it" button is green. "Not yet" is untouched.

**Independent Test**: Open a run; "Got it" is green with legible white content, "Not yet" is
pixel-identical to the current build.

**Dependency note**: US2 edits the same lines T005 just rewrote, so it follows US1 rather than running
beside it. It is independently *deliverable* — you could green today's button without any icons — but
doing it in this order is strictly less work.

### Implementation for User Story 2

- [ ] T007 [US2] In `src/components/OutcomeButtons.tsx`, add `bg-green-800 text-white
  hover:bg-green-900` to the "Got it" button's `className`. **All three classes are required**: the
  `default` variant sets `hover:bg-primary/80` as its own class, and leaving it in place turns the
  button near-black on hover. Add nothing to the "Not yet" button (FR-010). No contrast measurement is
  owed — `green-800` is 7.13:1 against white against a required 4.5:1, and that margin absorbs the
  Tailwind v3/v4 palette difference.
- [ ] T008 [US2] Write the dependency record into the PR description, which the constitution requires
  and CI cannot check: the **Principle V justification** (what `lucide-react` does, what it replaces,
  why hand-rolling is worse) and the **Principle VIII record** (`lucide-react@1.33.0`, ISC — on the
  pre-cleared list, actively maintained, wide adoption, stable channel). Both are already drafted in
  [research.md § Decision 5](./research.md#decision-5-what-the-dependency-costs) — copy them in rather
  than rewriting. Note that the icons are the package's own artwork under the same ISC licence, which
  discharges the separate asset-review rule.

**Checkpoint**: both US1 and US2 visible, and the PR carries the dependency paperwork.

---

## Phase 5: User Story 3 - Nothing else about the run screen moves (Priority: P3)

**Goal**: Prove the taller buttons did not cost anything — no shrunken tap target, no scrolling on a
small phone, no behavioural drift.

**Independent Test**: The whole run screen fits 320 × 568 with no scrolling, each button measures
≥ 64px tall, and the behavioural suite passes with zero edits.

**No implementation tasks.** This story is verification of US1 and US2. If any check here fails, the
fix belongs in T005 or T007, not in a new task.

### Verification for User Story 3

- [ ] T009 [P] [US3] Measure both button heights in devtools. Each MUST be **≥ 64px** — today's
  `h-16` — per FR-019. Smaller is a regression even if it looks fine.
- [ ] T010 [P] [US3] In the devtools device toolbar at **320 × 568**, confirm the heading, card face,
  cycle counter, both buttons, "Start over" and "Leave this run" are all visible with **no vertical
  scrolling**, and that neither label clips or wraps into its icon (FR-020, SC-005). The plan's ~420px
  budget is spacing-scale arithmetic, not a measurement — this task is the measurement.
- [ ] T011 [P] [US3] Run the full suite and confirm **no behavioural test needed editing**. Nothing
  here touches `src/run/`, `src/storage/` or `src/routes/Run.tsx`; if an engine or storage test fails,
  something outside the spec was changed. Revert it rather than adapting the test.
- [ ] T012 [US3] Run `git diff --stat` and confirm exactly **four** files changed:
  `src/components/OutcomeButtons.tsx`, `src/routes/Run.test.tsx`, `package.json` and
  `package-lock.json`. A fifth — especially `src/components/ui/button.tsx` or `src/index.css` — means
  the declined work in [plan.md](./plan.md#adjacent-work-named-and-declined) got built anyway
  (Principle VI). Confirm too that `package.json` gained **only** `lucide-react`.

**Checkpoint**: all three stories verified.

---

## Phase 6: Polish & Gate

- [ ] T013 Size the icons in the browser against the labels in `src/components/OutcomeButtons.tsx`
  until the icon clearly dominates (FR-002, FR-003). Both icons are a `circle r="10"` in the same
  24-unit box, so they match each other by construction — this is a single size decision, not the
  optical calibration a hand-drawn pair would have needed.
- [ ] T014 Browser zoom to 200% and confirm the wording stays inside its button with the icon still
  visible.
- [ ] T015 Screen reader spot check with VoiceOver (`Cmd-F5`): tab to each button and confirm each is
  announced **once**, as "Got it, button" and "Not yet, button" — not "circle check", not "Got it
  circle check" (SC-004).
- [ ] T016 Run the gate: `npm run lint && npm run typecheck && npm test && npm run build`. All four
  must pass — the same sequence CI runs (Principle III). Watch the build output: the two named imports
  should pull two icon modules, not the whole set.
- [ ] T017 Walk [quickstart.md](./quickstart.md) end to end, then check the Pages preview on a real
  phone. The preview is where the small-viewport claim gets its honest test.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)**: no dependencies. T001 blocks everything, since nothing runs without
  `node_modules`.
- **Foundational**: empty. Nothing blocks the stories.
- **US1 (T003–T006)**: after T002. T003 blocks T004 — the import does not resolve until the package is
  installed.
- **US2 (T007–T008)**: after US1, because T007 edits what T005 wrote. See the note in Phase 4.
- **US3 (T009–T012)**: after US2 — it verifies both stories.
- **Polish (T013–T017)**: last. T016 is the merge gate.

### Within the stories

T004 and T005 both edit `src/components/OutcomeButtons.tsx`, so they are one sequential pass through
one file. T003 is a manifest change ahead of both.

### Parallel opportunities

Genuinely thin, and worth saying rather than padding:

- **T006** is a different file from T004–T005, so the test assertion can be written alongside the
  component edit. This is the only parallel pair in the implementation.
- **T009, T010 and T011** are independent read-only checks over a finished build and can be done in
  any order or at once.

Everything else is one person editing one file. There is no useful multi-developer split here.

---

## Implementation Strategy

### MVP

US1 alone (T001–T006) is the MVP and carries the actual request: icons a pre-reader can act on. The
buttons stay grey and are fully usable. Stop and look at it in a browser before adding colour.

### Incremental delivery

1. Setup → baseline green.
2. US1 → icons land → look at it on a phone → this is the MVP.
3. US2 → green, plus the dependency paperwork the PR owes.
4. US3 → verify nothing else moved.
5. Polish → size, gate, preview.

A reasonable stopping point exists after each of steps 2 and 3.

### If something has to give

Cut T013's sizing pass first (it is polish), then US2's green — colour is the reinforcement, the icons
are the accessible distinction. **Never** cut T008, T009, T010 or T012: T008 is a constitution
requirement CI cannot enforce, and the other three are the measurements and the scope guard.

---

## Notes

- `[P]` means a different file with no dependency on incomplete work.
- Commit after US1, after US2, and after polish. Three commits, not seventeen.
- The behavioural suite is not to be edited. If it needs editing, the change went out of scope.
- One number in the plan is unverified — the vertical budget, owned by T010. The contrast figures no
  longer need checking: `green-800` clears 4.5:1 by enough that the Tailwind v3/v4 palette difference
  cannot close the gap.
