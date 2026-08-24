---

description: "Task list for Andika Font"
---

# Tasks: Andika Font

**Input**: Design documents from `/specs/004-andika-font/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[contracts/typography.md](./contracts/typography.md), [quickstart.md](./quickstart.md).
No `data-model.md` — this feature involves no data.

**Tests**: **None are added, and no existing test changes.** This is the first feature in the project
whose correctness is invisible to the test environment: `jsdom` does not load fonts, do layout, or
resolve `font-family` to a typeface, so no assertion there can tell a single-story `a` from a
double-story one. The three substitutes are all change-detectors, and each is named and rejected in
[research.md § What is not tested](./research.md#what-is-not-tested-and-why). The existing 166 tests
are the regression guard for FR-017 and FR-020 and must pass **unmodified**.

That absence is why this list is verification-heavy for a three-file change. **The failure mode has no
symptom**: a font that does not load produces a green `lint → typecheck → test → build` and the wrong
typeface on screen. T005, T007 and T009–T012 are the only things that can catch it.

**Organization**: By user story, with a warning. US1 and US2 are **not** independent in the usual
sense — both are delivered by the same three lines of `src/index.css`, because the app has one font
token applied once at the root. Retargeting it for the card face retargets it for every screen
simultaneously. They are separated below because they carry different *verification*, not different
code. US3 is verification with no code at all. Sequential order is the only sane one; marked
accordingly rather than dressed up.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are in every task

## Path Conventions

Single project. Source at `src/`, tests colocated beside the code they cover (there is no `tests/`
directory in this repo). Paths below are from the repository root.

**The feature is three files**: `src/index.css`, `package.json` and `package-lock.json`. A fourth is a
scope failure — see T013.

---

## Phase 1: Setup

**Purpose**: A working tree that can run the gate.

- [ ] T001 Install dependencies from the lockfile: `npm ci` at the repository root. `node_modules` is
  not committed, so nothing below runs until this does.
- [ ] T002 Record the baseline: run `npm test` and confirm **166 tests pass** before any edit, so a
  later failure is attributable to this change rather than inherited.

---

## Phase 2: Foundational

**None.** There is no blocking prerequisite: no schema, no route, no shared module, no CSS token to
define. The token this feature retargets — `--font-sans` in `src/index.css` — already exists and is
already applied app-wide by `html { @apply font-sans }`. That is why the diff is three files.

**Checkpoint**: after T002, story work begins immediately.

---

## Phase 3: User Story 1 - A card shows the letters a child is actually taught (Priority: P1) 🎯 MVP

**Goal**: The word on a card is drawn in Andika, with the single-story `a` and single-bowl `g` a
beginning reader is taught.

**Independent Test**: Open `http://localhost:5173/deck/dolch-prek-5/rung/r8` and mark "Not yet" until
`and`, `a`, `go` and `big` have appeared. The `a` is a round bowl with a plain vertical stem — no hook
over the top. The `g` has one bowl and an open tail — no lower loop.

### Implementation for User Story 1

- [ ] T003 [US1] Add the dependency: `npm install @fontsource/andika` (not `npm ci` — this has to write
  the manifests). Confirm it resolves to **5.3.0** or later and that the licence is **OFL-1.1**, then
  commit both `package.json` and `package-lock.json` — Principle III requires a clean-checkout
  `npm ci` to succeed.
- [ ] T004 [US1] In `src/index.css`, replace the single `@import "@fontsource-variable/geist";` on line
  4 with the two weight imports, and retarget the token on line 10:

  ```css
  @import "@fontsource/andika/400.css";
  @import "@fontsource/andika/700.css";
  /* ... */
  --font-sans: 'Andika', sans-serif;
  ```

  **The two weight files, not the package's combined `index.css`** — that file declares **weight 400
  only**, with no 700 face at all, so `font-semibold` would fall through to *synthesized* bold and
  violate FR-013. Leave `--font-heading` alone: it already
  resolves through `--font-sans`, so it follows for free. Add **no** `font-display` override — `swap`
  is what the package ships and what the maintainer asked for (FR-009). Add no `font-feature-settings`: the
  single-story shapes are the font's default *and* only forms, so there is nothing to switch on
  (FR-005).
- [ ] T005 [US1] Run `npm run dev` and do [quickstart step 1](./quickstart.md#step-1--look-at-the-letter-fr-002-fr-003-sc-001).
  **This is the task that proves the feature works**, and the only one that catches a font which
  silently failed to load. If the `a` has a hook over the top you are looking at the fallback — check
  the Network tab for a 404 on a `.woff2` before changing anything else.

  **FR-004 is discharged here by evidence rather than observation**, and deliberately so: no deck word
  and no interface string contains an accented character, so the app cannot exercise it. The cmap says
  `á`/`à`/`ä` map to `aacute.SngStory` and siblings, which is the whole of the claim. Do not go looking
  for an accent on screen; there is not one.

**Checkpoint**: the cards render in Andika with the right letterforms. US1 is shippable on its own —
and because the token is app-wide, US2's outcome has already happened. What US2 adds is removing the
old package and *verifying* the app-wide claim.

---

## Phase 4: User Story 2 - The whole app reads in one voice (Priority: P2)

**Goal**: Every screen is Andika, and no second text font ships.

**Independent Test**: Walk the deck list, a deck ladder, a run and a completion screen. Every string is
Andika. DevTools → Network → Font shows exactly two `andika-latin-*` files from this origin and nothing
else.

**Dependency note**: follows US1 because T006 removes a package that T004 stopped referencing. Doing it
in the other order breaks the build in between.

### Implementation for User Story 2

- [ ] T006 [US2] Remove the outgoing font: `npm uninstall @fontsource-variable/geist`, and commit both
  manifests. Then confirm nothing still references it:
  `grep -ri "geist" src/ index.html package.json` must return **nothing** (FR-007, and Principle V's
  rule on unused dependencies).
- [ ] T007 [US2] Do [quickstart step 2](./quickstart.md#step-2--confirm-what-actually-loaded-fr-006-fr-007-fr-008-fr-011).
  Two font requests, both `andika-latin-*00-normal-<hash>.woff2`, both from **this origin** — no
  `fonts.googleapis.com`, no `fonts.gstatic.com`, no `cyrillic`/`vietnamese`/`latin-ext` subsets, and
  nothing for the removed font. Then read the computed `font-family` on the deck list, a deck ladder
  **and** a run: FR-006 covers every screen, not just the card.
- [ ] T008 [US2] Write the dependency record into the PR description, which the constitution requires
  and CI cannot check: the **Principle V justification** (what `@fontsource/andika` does, what it
  replaces, why hand-rolling is worse — hand-rolling a literacy typeface is not a real alternative)
  and the **Principle VIII record** (`@fontsource/andika@5.3.0`, **OFL-1.1**, pre-cleared; published
  2026-07-19; SIL International; stable channel). Note that the typeface is the package's own artwork
  under the same licence, which discharges the separate asset-review rule with the same line.

**Checkpoint**: one font, everywhere, from this origin — and the PR carries the dependency paperwork.

---

## Phase 5: User Story 3 - Nothing else about any screen moves (Priority: P3)

**Goal**: Prove the swap cost nothing — no overlap, no scrolling, no clipped word, no illegible label,
no behavioural drift.

**Independent Test**: The run screen fits 320 × 568 with no scrolling and no collisions, the longest
word in each deck fits at that width, emphasis still reads as emphasis, and the app stays usable with
the font blocked entirely.

**No implementation tasks.** This story is verification of US1 and US2. If a check here fails, the fix
belongs in T004, not in a new task.

### Verification for User Story 3

- [ ] T009 [P] [US3] Do [quickstart step 3](./quickstart.md#step-3--nothing-overlaps-at-the-smallest-viewport-fr-015-fr-016-sc-004)
  at **320 × 568**. **This closes the plan's one unverified number**: Andika's glyph box is 1.611em
  against the outgoing font's 1.300em, so descenders overhang their line box by roughly 22px instead of
  11px, into a 32px `gap-8`. Confirm the card's `g`/`y`/`p` do not collide with the cycle counter, and
  that nothing scrolls. The [vertical budget](./plan.md#the-vertical-budget) predicts every block keeps
  its exact height — if a total moved, that reasoning is wrong and worth understanding before merging.
- [ ] T010 [P] [US3] Do [quickstart step 4](./quickstart.md#step-4--the-longest-words-fr-014-sc-005):
  `yellow` in `dolch-prek-5` r8, `please` and `pretty` in `dolch-k-5` r11, at 320px and then past
  640px where the card jumps to `sm:text-8xl`. The widest was computed at **213.7px against 272px
  available**, so this confirms arithmetic rather than discovering anything — but FR-014 is a MUST and
  the computation has never been on a screen.
- [ ] T011 [P] [US3] Do [quickstart step 5](./quickstart.md#step-5--emphasis-still-reads-as-emphasis-fr-012-fr-013-sc-006).
  Six headings get **heavier** (600 → 700) and **every button label gets lighter** (500 → 400, from
  `font-medium` in `src/components/ui/button.tsx:8`). Button labels are the only thing losing weight,
  so they are where a problem shows. Nothing may look smeared or artificially thickened — that is
  synthesized bold, which FR-013 forbids.
- [ ] T012 [P] [US3] Do [quickstart step 6](./quickstart.md#step-6--block-the-font-entirely-fr-010-sc-003):
  block the `.woff2` requests and reload. Every screen readable, every control working, no blank
  screen, no layout collapse. Wrong letterforms are the accepted degradation; unusable is not.
  Then, still in DevTools, switch to **Offline** and reload once more with a warm cache: the app must
  come up fully, in Andika, from cache alone. That is SC-007's second clause and nothing else covers
  it.
- [ ] T013 [US3] Run `git diff --stat` and confirm exactly **three** source and manifest files changed:
  `src/index.css`, `package.json` and `package-lock.json` — plus this `tasks.md`, since the bookkeeping
  rides in the work commit. **A fourth is a scope failure** (Principle VI): no component file, no
  `index.html`, no test file, and not one word of deck content. Confirm too that `package.json` gained
  **only** `@fontsource/andika` and lost **only** `@fontsource-variable/geist`. This one task is what
  discharges **FR-018** (nothing persisted changed — no file under `src/storage/` was touched),
  **FR-019** (no setting or picker was added — that would need a component file) and **FR-020** (no
  deck content or component string changed).

**Checkpoint**: all three stories verified.

---

## Phase 6: Polish & Gate

- [ ] T014 Run the gate: `npm run lint && npm run typecheck && npm test && npm run build`. All four
  must pass — the same sequence CI runs (Principle III). **166 tests, with no test file edited**; if one
  needed changing, something outside this feature's scope changed, so revert it rather than adapting
  the test. Then check the build output per
  [quickstart step 7](./quickstart.md#step-7--the-gate-principle-iii): `dist/assets/` carries the
  andika `.woff2` files, and `grep -ci "geist"` over `dist/assets/*.css` and `dist/index.html` returns
  **0**. The unmodified suite is what discharges **FR-001**, **FR-017**, **SC-002**, **SC-008** and
  **SC-009**: it queries by role and visible text, so it passes only if behaviour and wording survived.
- [ ] T015 Do [quickstart step 8](./quickstart.md#step-8--the-preview-deploy-on-a-real-phone): open the
  PR's Pages preview on a **real phone** and repeat steps 1, 3 and 4. The dev server is not where the
  small-viewport claim gets its honest test. Deep-link straight to `/deck/dolch-k-5/rung/r11` to
  exercise the SPA fallback at the same time (Principle I).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)**: no dependencies. T001 blocks everything, since nothing runs without
  `node_modules`.
- **Foundational**: empty. Nothing blocks the stories.
- **US1 (T003–T005)**: after T002. T003 blocks T004 — the `@import` does not resolve until the package
  is installed. T004 blocks T005.
- **US2 (T006–T008)**: after US1. T006 removes what T004 stopped referencing; reversing them breaks the
  build in between.
- **US3 (T009–T013)**: after US2 — it verifies both stories against a finished build.
- **Polish (T014–T015)**: last. T014 is the merge gate; T015 needs a deployed preview, so it follows
  the PR being opened.

### Within the stories

T003 → T004 → T005 is one strictly sequential chain: install, edit, look. T006 → T007 likewise. There
is no way to shorten it, because the whole feature is three lines in one file.

### Parallel opportunities

Thin, and worth saying rather than padding:

- **T009, T010, T011 and T012** are independent read-only checks over one finished build and can be
  done in any order or at once. They are the only genuine parallelism here.
- Everything else is one person editing one file. There is no useful multi-developer split.

---

## Implementation Strategy

### MVP

US1 alone (T001–T005) is the MVP and carries the actual request: letterforms a beginning reader
recognizes. Because the font token is app-wide, this also *incidentally* delivers US2's visible
outcome — the whole app changes at once. Stop and look at it in a browser before going further.

### Incremental delivery

1. Setup → baseline 166 green.
2. US1 → Andika lands → **look at the `a`** → this is the MVP.
3. US2 → old package gone, app-wide claim verified, PR paperwork written.
4. US3 → verify nothing else moved.
5. Polish → gate, then the preview on a real phone.

A reasonable stopping point exists after step 2 or step 3.

### If something has to give

Cut **T015** first (the preview repeats checks already done on a desktop viewport), then **T010** (it
confirms a computation with 21% headroom). **Never** cut T005, T008, T009 or T013:

- **T005** is the only task that proves the feature works at all.
- **T008** is a constitution requirement CI cannot enforce.
- **T009** is the one measurement the plan left open.
- **T013** is the scope guard.

---

## Notes

- `[P]` means a different file with no dependency on incomplete work.
- Commit after US1, after US2, and after polish. Three commits, not fifteen.
- The behavioural suite is not to be edited. If it needs editing, the change went out of scope.
- **This list is deliberately verification-heavy for a three-file diff.** Six of fifteen tasks are
  "look at it in a browser". That is not ceremony: with no automated coverage possible, a broken
  implementation ships green, and looking is the only detector.
