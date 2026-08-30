---

description: "Task list for 008-deck-level-ladder"
---

# Tasks: Deck Screen Level Ladder

**Input**: Design documents from `/specs/008-deck-level-ladder/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/deck-screen.md](./contracts/deck-screen.md),
[quickstart.md](./quickstart.md)

**Tests**: Included, and mostly *edits* to existing assertions rather than new ones — this feature
deliberately changes strings that five existing tests pin. Three assertions are written **before**
the code they guard and must be seen to fail (T008, T017, T018). No test file is created.

**Organization**: Grouped by user story, in the priority order from [spec.md](./spec.md). The order
is also a dependency order — see [Why this order](#why-this-order).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different file, no dependency on an incomplete task
- **[Story]**: `[US1]`–`[US5]`, mapping to the user stories in [spec.md](./spec.md)
- Paths are repository-relative. Single-project SPA: everything under `src/`.

---

## Why this order

**There is no Setup phase and no Foundational phase.** Nothing is installed, nothing is vendored, no
schema changes, no new module. Inventing a phase to say so would be process for its own sake.

**The story order is forced by a real dependency, not just by priority.** US1 renames the strings
that every other story's tests query by. Do US2–US5 first and their assertions are written against
`"15 words"`, then rewritten an hour later. US1 first, once.

**Inside US1, the collapse comes before the rename.** T001 deletes a level from `dolch-k-5`. Relabel
first and you number eleven levels, then delete one and renumber ten. The collapse changes what the
numbers *are*, so it goes first.

**Three assertions are written red on purpose** — T008 (order), T017 (unlock, unit) and T018
(unlock, screen). Both are cases where a test written after the code can pass while checking
nothing: an ordering assertion transcribed from the rendered output is tautological, and the unlock
rule's new behaviour is invisible unless someone deliberately constructs out-of-order progress. Seen
failing first, they mean something.

**One phase is deliberately not green in the middle.** T014 deletes the `Resume` link that five
existing assertions query. The gate is red between T014 and T015 and that is expected; they are one
commit.

Single branch, single PR — the maintainer's call, recorded in
[plan.md](./plan.md) § Scale/Scope. Nine files; a reviewer sees the end state.

---

## Phase 1: User Story 1 — Levels read as levels, not word counts (Priority: P1) 🎯 MVP

**Goal**: Every step of both decks is named `Level N` or `Full deck`, on all three screens, and no
deck's top level adds only a part-step.

**Independent Test**: Open both decks and the deck list. Nothing anywhere is named `N words`.
Kindergarten has ten levels, not eleven.

- [X] T001 [US1] **Collapse the remainder level** in `src/decks/dolch-k-5.ts` (FR-020, FR-021).
  Delete the entire `r10` rung object — the one with `label: '50 words'` and 50 `cardIds`. Leave
  `r9` and `r11` exactly as they are; in particular **do not touch `r11`'s `cardIds`**, which
  already lists all 52. The `rungs` array goes from 11 entries to 10, ending `r9`, `r11`.

  `r11` is the id that survives, and the reason is not cosmetic: anyone who has mastered this deck
  has `r11` in `completedRungIds`. Keeping `r10` and widening it to 52 cards instead would silently
  un-master every learner who had finished the deck. See
  [research.md § D8](./research.md#d8--the-remainder-collapse-is-an-edit-to-the-authored-deck-not-runtime-logic).

  Then fix the file header, which currently claims the rungs are transcribed verbatim from
  `specs/001-deck-runs/research.md §4`. After this they deliberately are not, so say so and say why —
  left alone it is a false claim about the data beneath it.

  **This task has a free teeth-check already in the tree**: `src/decks/validate.test.ts:184` runs
  `validateDeck` over every built-in deck. V6 (`r9`'s cards ⊆ `r11`'s) and V7 (`r11` equals the full
  card set) both still hold after the deletion, so `npm test -- validate` must stay green. If it goes
  red, the wrong rung was deleted.

  Do not touch `src/decks/dolch-prek-5.ts` here — it ends 35 → 40, a full step of 5, and FR-020 does
  not apply to it.

- [X] T002 [P] [US1] **Relabel `src/decks/dolch-prek-5.ts`** (FR-001, FR-002). Eight rungs, in order:

  | Rung | Was | Now |
  |---|---|---|
  | `r1`–`r7` | `'5 words'` … `'35 words'` | `'Level 1'` … `'Level 7'` |
  | `r8` | `'40 words'` | `'Full deck'` |

  `label` only. Every `id` and every `cardIds` array is untouched — `id` is what stored progress
  refers to, so touching one would reset a learner's ladder (FR-004).

- [X] T003 [P] [US1] **Relabel `src/decks/dolch-k-5.ts`** (FR-001, FR-002). **Depends on T001**: the
  numbering is over the *collapsed* ladder, so this cannot be done correctly until `r10` is gone.
  Ten rungs, in order:

  | Rung | Was | Now |
  |---|---|---|
  | `r1`–`r9` | `'5 words'` … `'45 words'` | `'Level 1'` … `'Level 9'` |
  | `r11` | `'52 words'` | `'Full deck'` |

  Note the id jump: `r9` is `Level 9` and `r11` is `Full deck`. There is no `Level 10`. The ids are
  not renumbered and must not be.

- [X] T004 [P] [US1] **Update the convention comment** at `src/decks/types.ts:17`, which reads
  `label: string; // "5 words"`. It is the only place left in the repo teaching the old scheme.

- [X] T005 [P] [US1] **Fix `src/routes/DeckList.test.tsx`** (FR-003). **Depends on T002 and T003.**
  Three places:
  - `:16` — the comment `Kindergarten (r1–r11), both starting at a rung labelled "5 words"` is wrong
    twice over after T001 and T003.
  - `:65` — `'Not started · Next run: 5 words'` → `'Not started · Next run: Level 1'`. Both decks
    still start the same, so `getAllByText(...)` with `toHaveLength(decks.length)` still holds.
  - `:72` — `'Completed 15 words · Next run: 20 words'` → `'Completed Level 3 · Next run: Level 4'`.

  This file needs no other change: `DeckList.tsx` reads `rung.label` and renames for free.

- [X] T006 [P] [US1] **Fix the label strings in `src/routes/DeckLadder.test.tsx`, and guard the
  collapse** (FR-003, FR-021). **Depends on T002 and T003.**

  First the mechanical part: every `'5 words'`, `'10 words'`, `'15 words'`, `'20 words'` and
  `'40 words'` becomes its `Level N` / `Full deck` equivalent. `'40 words'` is Pre-K's top rung, so
  it becomes `'Full deck'`. Also `:18`'s comment and the `queryByRole('button', { name: /words/ })`
  regex at the mastery test — that regex must become `/Level|Full deck/` or it silently matches
  nothing and asserts nothing forever after.

  Then add **two assertions that pin FR-021** — the only automated proof that the T001 collapse
  costs a learner nothing. Both are green from here on and must stay green through every later
  phase, which is exactly what makes them useful:

  - Seed `dolch-k-5` with `completedRungIds: ['r1' … 'r10']` — the top of the ladder as it was
    *before* the collapse, including the deleted `r10`. Assert `Full deck` is startable. A learner
    who was one level from the top is still one level from the top; the orphaned `r10` costs nothing.
  - Seed `dolch-k-5` with `completedRungIds: ['r11']`. Assert `Deck mastered` still shows. This is
    the assertion that would have caught keeping `r10` instead of `r11` in T001 — the mistake that
    would silently un-master everyone who had finished the deck.

  Both hold under the old unlock rule and the new one, so they do not move when Phase 5 lands.

  Apart from those two, change strings only in this task. The structural rewrites belong to T012,
  T015 and T018.

- [X] T007 [US1] **Gate**: `npm run lint && npm run typecheck && npm test`. **Depends on
  T001–T006.** Green here means the rename and the collapse are complete and nothing else moved.

  *Found by the gate*: a sixth assertion pinned a label — `src/routes/Run.test.tsx:710`
  (`link, name: '10 words'`, after leaving a completed run). Renamed to `'Level 2'`. T018 was
  already going to touch this file; nothing else in it changed.

**Checkpoint**: both decks read as levels on all three screens. Kindergarten has ten. The deck screen
still lists lowest-first, still spreads an unfinished run over two rows, and still says "Completed" —
those are Phases 2–4.

---

## Phase 2: User Story 2 — Climbing upward (Priority: P1)

**Goal**: The deck screen shows the highest level first and `Level 1` last.

**Independent Test**: Open a deck screen and read top to bottom — the numbers descend and `Full deck`
is first.

- [X] T008 [US2] **Write the order assertion first, and confirm it FAILS**, in
  `src/routes/DeckLadder.test.tsx` (FR-005). **Depends on T006.** Read the accessible names out of
  `screen.getAllByRole('listitem')` — which returns items in DOM order — and compare the whole
  sequence to `['Full deck', 'Level 7', … 'Level 1']`.

  Assert the sequence, not "the first one is Full deck". A single-element check passes on a list
  that is otherwise still ascending.

  Run it. It must fail before T009 exists. An ordering assertion written after the change is
  usually transcribed from the output it is supposed to be judging.

- [X] T009 [US2] **Invert the render order** in `src/routes/DeckLadder.tsx` (FR-005). **Depends on
  T008 being red.** Reverse the *mapped array*, keeping the index that `map` supplies:

  ```tsx
  {deck.rungs
    .map((rung, index) => (
      // …unchanged body, still using `index` for isStartable…
    ))
    .reverse()}
  ```

  Two things this must not become:

  - **Not `flex-col-reverse` on the `<ul>`.** It paints bottom-up while the DOM stays top-down, so
    tab order and screen-reader order would run backwards against what is on screen. T008 is written
    against DOM order precisely so this shortcut fails.
  - **Not `deck.rungs.reverse()` or a reversed config.** `deck.rungs` is documented as ordered
    smallest → largest and is read by `isStartable`, `isMastered`, `nextRung`, and validation rules
    V6/V7. Reversing the model to change a view is the largest possible blast radius here.

  The index must keep coming from `map`. This is the one place the change could silently invert the
  unlock rule. If oxlint objects to mutating with `.reverse()`, use `.toReversed()` — the array is
  fresh from `map` either way.

- [X] T010 [US2] **Gate**: `npm test`. T008 goes green; everything from Phase 1 stays green.

**Checkpoint**: the ladder climbs upward, and tabbing through it moves in the same order you read.

---

## Phase 3: User Story 3 — One row per level, start-over on the left (Priority: P2)

**Goal**: A level with an unfinished run is one row: a narrower `Start over` on the left, the wider
level button on the right, which resumes.

**Independent Test**: Leave a run partway through, return to the deck screen, and confirm that level
is one row holding exactly two controls and no other text.

**Note on the gate**: T011 deletes the `Resume` link and the `Unfinished run` caption, which five
existing assertions query. The tree is **red between T011 and T012, expected**. They are one commit.

- [X] T011 [US3] **Collapse the row** in `src/routes/DeckLadder.tsx` (FR-009 – FR-014, FR-019).
  **Depends on T009** — same JSX region, so it cannot be done in parallel with it.

  The `<li>` becomes the row itself; the inner wrapper `<div>` goes away:

  ```tsx
  {deck.rungs
    .map((rung, index) => {
      const startable = isStartable(deck, completedRungIds, index);
      const path = `/deck/${deck.id}/rung/${rung.id}`;
      return (
        <li key={rung.id} className="flex items-center gap-3">
          {/* Only on a startable level: a locked one must not offer a way in (FR-019). */}
          {startable && run?.rungId === rung.id && (
            <StartOverButton deck={deck} rungId={rung.id} />
          )}
          {startable ? (
            <Button asChild className="h-12 flex-1 text-base" size="lg">
              <Link to={path}>{rung.label}</Link>
            </Button>
          ) : (
            <Button className="h-12 flex-1 text-base" size="lg" variant="secondary" disabled>
              {rung.label}
            </Button>
          )}
          {/* Still here, unchanged — T014 deletes it. Keeping it means this task
              breaks only the assertions T012 repairs. */}
          {completedRungIds.includes(rung.id) && (
            <span className="text-muted-foreground text-sm">Completed</span>
          )}
        </li>
      );
    })
    .reverse()}
  ```

  `flex-1` on the level control against `Start over`'s natural width is what makes the level control
  the wider of the two (FR-010).

  Rename `UnfinishedRun` to `StartOverButton` and reduce it to the button alone. **Keep `startOver`'s
  body verbatim** — the read/write/navigate sequence and its doc comment about where the
  full-storage message is raised are still exactly right (FR-013):

  ```tsx
  function StartOverButton({ deck, rungId }: { deck: DeckConfig; rungId: RungId }) {
    const navigate = useNavigate();
    // …startOver() unchanged, comment and all…
    return (
      <Button className="h-12 text-base" size="lg" variant="secondary" onClick={startOver}>
        Start over
      </Button>
    );
  }
  ```

  It stays a component rather than an inline handler because it calls `useNavigate`, and a hook
  cannot be called conditionally inside the `map`.

  **Delete**: the `Resume` `<Link>`, the `Unfinished run` `<span>` (FR-011), and the wrapper `<div>`
  the two lived in. Nothing replaces the caption.

  **Do not delete the `Completed` span here**, tempting as it is while this file is open. It belongs
  to T014, and carrying it through this phase is what keeps the red gate between T011 and T012
  explainable: exactly the `Resume` and `Unfinished run` assertions break, and T012 repairs exactly
  those. Delete it now and two further assertions fail for a reason no task in this phase mentions.

  No new code is needed for FR-012. The level control already points at the same URL the `Resume`
  link did, and `resume()` in `src/routes/Run.tsx:41` reads the stored run on entry. Resuming has
  always been what that button does; the second row was duplication.

- [X] T012 [US3] **Rewrite the unfinished-run assertions** in `src/routes/DeckLadder.test.tsx`
  (FR-009 – FR-013, FR-019). **Depends on T011.** In the `DeckLadder — an unfinished run` block:
  - `Resume` no longer exists. Assert instead that the level's own link is present and points at the
    run path, and that `queryByRole('link', { name: 'Resume' })` finds nothing.
  - `Unfinished run` no longer exists — assert `queryByText('Unfinished run')` is null.
  - The "puts Resume and Start over on the rung the run belongs to" test keeps its shape and its
    point: find the `<li>` by the level a learner reads, and assert `Start over` is inside *that*
    item. That is still the only assertion that pins *where* the control sits.
  - Add: **the row holds exactly two controls** (FR-010). Within that `<li>`, `getAllByRole` across
    `link` and `button` returns two. Assert the count of *controls*, not of every node — the
    `Completed` span is still in the row until T014, and FR-011 is about a caption beside the
    controls, not about the completion status. T015 is where "no other text" becomes assertable.
  - Add: **a locked level with a run offers no `Start over`** (FR-019). Seed a run on `r5` with no
    completed levels; `r5` is locked, so its item has one control and no `Start over`.
  - Keep the two `Start over` behaviour tests (fresh run, and progress untouched) as they are apart
    from the label strings — they already cover FR-013.

- [X] T013 [US3] **Gate**: `npm run lint && npm run typecheck && npm test`. **Depends on T011 and
  T012.** This is the first green since T010.

**Checkpoint**: one row per level, `Start over` on the left, the level button resumes.

---

## Phase 4: User Story 4 — A completed level stays marked (Priority: P2)

**Goal**: A level ever completed carries a circle-check inside its button, left of the name,
permanently.

**Independent Test**: Complete a level, see the check, replay it, see the check still there.

- [X] T014 [US4] **Add the mark and delete the caption** in `src/routes/DeckLadder.tsx` (FR-015,
  FR-017, FR-018). **Depends on T011** — same JSX, and it needs the shape T011 leaves behind.

  Build the control's content **once** and use it in both branches, so a completed-but-locked level
  (FR-007) cannot drift from a completed-and-startable one:

  ```tsx
  import { CircleCheck } from 'lucide-react';
  ```

  ```tsx
      const completed = completedRungIds.includes(rung.id);
      // Built once for both branches: a completed level carries the mark whether or
      // not it is startable (FR-007). aria-hidden keeps the accessible name exactly
      // the level name (FR-016) — the same reason the old "Completed" text sat
      // outside the control.
      const name = (
        <>
          {completed && <CircleCheck className="size-5" aria-hidden="true" />}
          {rung.label}
        </>
      );
  ```

  Then `{name}` replaces `{rung.label}` in both branches.

  Two mechanics, both checked rather than assumed:

  - The explicit `size-5` is **required**. `Button`'s base class carries
    `[&_svg:not([class*='size-'])]:size-4`, so an unsized icon is silently forced to 16px — the same
    reason `OutcomeButtons` writes `size-12`.
  - In the startable branch the icon goes **inside the `<Link>`**, not beside it. `Button asChild`
    uses Radix `Slot`, which takes exactly one child element, and that child is the `Link`. A second
    child of `Button` is a runtime error.

  Content stays centre-justified — `Button`'s base class already sets `justify-center`, so nothing is
  needed to keep it. That is what puts the mark near the middle of a wide row rather than pressed
  against `Start over`.

  **Delete** the `{completedRungIds.includes(rung.id) && <span>Completed</span>}` block and the
  comment above it (FR-018).

- [X] T015 [US4] **Assert the mark** in `src/routes/DeckLadder.test.tsx` (FR-015, FR-016, FR-018).
  **Depends on T014.**
  - The accessible name is **unchanged** by the mark: `expectStartable('Level 1', 'r1')` on a
    completed level still passes. This is the FR-016 guard and it already exists — `getByRole` with a
    string `name` matches the full normalised name, so `Level 1 completed` would fail it.
  - `queryByText('Completed')` finds nothing anywhere on the screen (FR-018).
  - Presence and absence of the mark: within a level's `<li>`, `item.querySelector('svg')` is
    non-null for a completed level and null for one never completed. **This is a deliberate
    judgement call against Principle IV** — see [Notes](#notes).
  - Permanence (FR-016): seed `completedRungIds: ['r1']` *and* an unfinished run on `r1`, and assert
    the mark is still there. That is the replay-in-progress case, and it is the one that would
    regress if anyone ever made the mark depend on the run instead of on `completedRungIds`.

- [X] T016 [US4] **Gate**: `npm run lint && npm run typecheck && npm test`. **Depends on T014, T015.**

**Checkpoint**: every level ever finished carries its check, and nothing announces it.

---

## Phase 5: User Story 5 — The ladder never shows a gap (Priority: P3)

**Goal**: Startable levels always run unbroken from `Level 1` up to the first unfinished one — for
any stored progress, however it was made.

**Independent Test**: With no progress, finish a mid-deck level via its URL, then open the deck
screen: the startable levels still start at `Level 1` and stop at the first unfinished one.

**This phase is written test-first on purpose.** The new behaviour only shows up on out-of-order
progress, which nobody constructs by accident. A test written after the change would be built from
whatever the code does.

- [X] T017 [US5] **Add the unit cases and confirm they FAIL**, in `src/decks/ladder.test.ts`
  (FR-006, FR-007). The existing four-rung fixture is already the right shape.

  All four new cases use `['r3']` completed and nothing else — r3 finished, r1 and r2 not. Work out
  what each *should* be from FR-006 ("every level below has been completed") before writing it, not
  from what the code does:

  - **The red one**: `isStartable(deck, ['r3'], 3)` is **`false`**. r4 must not open just because r3
    is done — r1 and r2 are unfinished. The current rule looks only at the immediate predecessor,
    finds r3 completed, and returns `true`. **Run it and see it fail.** This single case is the whole
    behavioural difference between the two rules; if it does not go red, the fixture or the seed is
    wrong.
  - `isStartable(deck, ['r3'], 2)` is `false` — the completed level itself is not startable while r1
    and r2 are unfinished (FR-007).
  - `isStartable(deck, ['r3'], 1)` is `false` — r2 does **not** open. r1 is unfinished, and finishing
    r3 out of order does not change that. It is tempting to write `true` here on the reasoning that
    "r2 is next"; it is not, and the rule has no such clause.
  - `isStartable(deck, ['r1', 'r2', 'r3'], 3)` is `true` — with the run below unbroken, the next
    level still opens. Without this one the suite would pass with an `isStartable` that returns
    `false` for everything above index 0.

  The last three are green under both rules. They are correctness assertions pinning FR-006 and
  FR-007, not red-first ones, and only the first is expected to fail now.

  Finally, **restate the premise** of the existing `'keeps completed rungs startable forever
  (FR-016)'` test. It passes `['r1','r2','r3','r4']`, so it still passes — but it now demonstrates
  something narrower, and its name and comment claim a guarantee the code no longer makes. Rename it
  to say *in order*, and note the supersession of `001-deck-runs` FR-016.

- [X] T018 [US5] **Add the deck-screen case (red) and the URL-entry guard (green)**, in
  `src/routes/DeckLadder.test.tsx` and `src/routes/Run.test.tsx` (FR-006, FR-007, FR-008).
  **Depends on T006 and T014** — T006 for the level names this queries by, and T014 for the
  completion mark, which the `Level 5` assertion below reads. T014 is in Phase 4, so running the
  phases in order satisfies both.

  **In `DeckLadder.test.tsx`** — seed Pre-K with `['r5']` and nothing else, then assert:

  - **`Level 6` is locked. This is the red one.** Under the current rule r5 is completed, so the
    level above it opens — the exact gap FR-006 exists to close. Every other assertion below passes
    under both rules, so **without this one the test is green before the change and proves nothing.**
  - `Level 1` startable, `Level 2` locked, `Level 5` locked *and* carrying its mark (FR-007).

  **In `Run.test.tsx`** — one assertion that FR-008 still holds: render the run route directly at a
  rung the deck screen would not offer (Pre-K `r5` with no completed levels) and confirm a card face
  is on screen. This is green today and must stay green forever; it is the only thing standing
  between FR-008 and a future "helpful" redirect added by someone who reads FR-006 as a gate.

  It is the one file this feature touches outside the deck screen and the deck data — see
  [plan.md](./plan.md) § Source Code. Add the assertion; change nothing else in that file.

- [X] T019 [US5] **Change the rule** in `src/decks/ladder.ts` (FR-006). **Depends on T017 and T018
  being red.** `isStartable`'s body becomes a check that *every* level below `index` is completed.
  Keep the range guard. Do not re-add an `index === 0` special case: `[].every(…)` is `true`, so
  "the smallest level is always startable" falls out of the expression rather than being written
  twice.

  **Rewrite the doc comments in the same edit.** The block above `isStartable` currently argues for
  the old rule in detail ("A rung is startable exactly when its immediate predecessor has been
  completed… Completed rungs therefore stay startable forever (FR-016) — completing a rung required
  its predecessor, which is the same condition read back"). Every sentence of that is now either
  wrong or misleading. Replace it with the new rule, why it exists (an unbroken ladder for an early
  reader), and the explicit note that it supersedes `001-deck-runs` FR-016 for out-of-order progress
  only. A comment left contradicting the function beneath it is worse than no comment.

  Nothing else changes. `highestCompletedRung`, `isMastered` and `nextRung` are correct under either
  rule, and `DeckLadder.tsx` derives nothing — it needs no edit for this.

- [X] T020 [US5] **Confirm nothing else moved.** `npm run lint && npm run typecheck && npm test`.
  **Depends on T019.** T017 and T018 go green. Every Phase 1–4 test must stay green: they all seed
  progress in order, where the two rules agree exactly. A failure here means a test was seeding
  out-of-order progress without meaning to.

**Checkpoint**: the feature is complete. Everything after this is verification.

---

## Phase 6: Polish & Verification

- [X] T021 [P] **Sweep for leftovers.** Four greps over `src/`, each of which must return nothing:
  - `label: '[0-9]` — a deck rung still named by its card count
  - `Unfinished run` — the deleted caption
  - `>Completed<`, and `'Completed'` in `DeckLadder.test.tsx` — the deleted status text
  - `name: 'Resume'` — the deleted link

  Fixture labels in `ladder.test.ts`, `validate.test.ts` and `deckRecord.test.ts` belong to synthetic
  decks, carry no meaning, and are **out of scope** — the first grep is scoped to `src/decks/dolch-*`.

  **Amended while running it.** Greps 2–4 as written contradict T012 and T015, which ask for
  `queryByText('Unfinished run')`, `queryByRole('link', { name: 'Resume' })` and
  `queryByText('Completed')` as *absence* assertions. The criterion is that nothing **renders**
  those strings, so the sweep is scoped to non-test `.tsx`. So scoped, all four return nothing. The
  surviving hits are `DeckLadder.test.tsx:152, :269, :270`, all `not.toBeInTheDocument()`.

- [X] T022 [P] **Confirm the untouched-file guarantees.** `git diff --stat main` must show **no**
  change under `src/storage/` or `src/run/`, and none to `package.json` or `package-lock.json`. This
  feature adds no dependency and no stored shape. If either moved, the design was misread — see
  [data-model.md](./data-model.md) and
  [research.md § D8](./research.md#d8--the-remainder-collapse-is-an-edit-to-the-authored-deck-not-runtime-logic).

- [X] T023 **Full gate**: `npm run lint && npm run typecheck && npm test && npm run build` — the same
  sequence CI runs. **Depends on T020.**

- [X] T024 **Browser verification.** `npm run dev`, then walk all sixteen rows of
  [quickstart.md](./quickstart.md) § What to look for. The six that jsdom cannot judge and that
  therefore matter most here:
  - **Row 5 / 11** — the two controls stay on one line at ~360px. `flex-1` plus a natural-width
    button should do it; if `Start over` wraps, that is a real failure of FR-009.
  - **Row 9** — the check on a *locked* level. Confirm it reads as "you did this, but not from here"
    rather than as a glitch. This is the state the maintainer chose in clarification, and the only
    one nobody has seen yet.
  - **Row 3b** — the run header. `Run.tsx` renames for free from `rung.label`, so nothing asserts
    it; an assertion there would pin a string with no logic behind it. This row is FR-003's only
    coverage of that screen, so do not skip it.
  - **Row 12** — tab order matches reading order. The check T008 cannot make.
  - **Rows 13/14** — Kindergarten seeded with pre-collapse progress (`r1`…`r10`, and `r11`). Nobody
    loses a level and a mastered deck stays mastered (FR-021).
  - The mark itself, by eye, at `size-5` next to `text-base` — light and dark.

- [X] T025 **Record what the browser checks actually showed** in this file, under T024. Not "done" —
  what was seen, and at which widths. **Depends on T024.**

  **What the browser actually showed** (Chromium via Playwright against `npm run dev`,
  viewport 390×844 unless stated). All sixteen rows walked; every one passed.

  - **1** Pre-K, no progress, top to bottom: `Full deck, Level 7, Level 6, Level 5, Level 4,
    Level 3, Level 2, Level 1`. No "words" anywhere.
  - **1b** Kindergarten: **ten** rows, `Full deck, Level 9 … Level 1`. No `Level 10`.
  - **2** Only `Level 1` enabled; the other seven disabled.
  - **3** Deck list: both lines read `Not started · Next run: Level 1`.
  - **3b** Run header: `Dolch Pre-K · Steps of 5 · Level 1`.
  - **4** Played `Level 1` to `Run complete`, left the run: `Level 1` open with its mark,
    `Level 2` open unmarked, `Level 3` locked.
  - **5** One row, text exactly `Start overLevel 2`, two controls and nothing else.
  - **6** Seeded a run stopped at `queue[3]` (`and`) and tapped the `Level 2` button: landed on
    `/rung/r2` showing **`and`**, not the first card. The level control resumes.
  - **7** `Start over` navigated to `/rung/r2`; back on the deck screen `Level 1` still marked,
    `Level 2` still open, and no `Start over` anywhere — the run was discarded.
  - **8** Replayed the completed `Level 1`, answered `Not yet`, left mid-run: `Level 1` still
    carries its mark, and the row is `Start overLevel 1`.
  - **9** Seeded `['r5']`: `Level 5` **locked and marked**, `Level 1` the only open level,
    `Level 2`–`Full deck` locked. No gap. By eye the mark on the greyed row reads as "you did
    this, but not from here" — it is dimmed with the rest of the disabled button, not a glitch.
  - **10** `/deck/dolch-prek-5/rung/r5` from that state played normally (`Level 5` header, a card
    face, both outcome buttons).
  - **11** Measured at **390px, 360px and 320px**: `Start over` 97px, the level control 233/203/163px,
    both on the same line (identical `getBoundingClientRect().top`) at every width. No wrap even at
    320px, which is narrower than the row the spec asks about.
  - **12** Tab order with every level unlocked: `Full deck → Level 7 → … → Level 1 → All decks`.
    Focus moves in reading order. (With no progress there is only one focusable level, so this
    check needs a mastered deck to mean anything.)
  - **13** Kindergarten seeded `['r1'…'r10']`: `Level 1`–`Level 9` all open and marked, `Full deck`
    open and unmarked. The deleted `r10` costs nothing.
  - **14** Kindergarten seeded `['r11']`: header reads `Deck mastered`.
  - **The mark itself**: `size-5` beside `text-base`, centred with the name rather than pressed
    against `Start over`. Legible in light and in dark (`.dark` on `<html>`; the app uses a class,
    not `prefers-color-scheme`, so emulating the media query alone shows no change).

  Screen-reader verification not run — waived by the maintainer.


- [X] **Review pass** (separate subagent, fresh context, `git diff main -- src/`). No correctness
  bugs: the `index` passed to `isStartable` comes from `map` and is unaffected by the `.reverse()`
  after it, and `Button asChild` receives exactly one child. Eight findings, all test-strength or
  comment accuracy; all acted on:

  1. **The FR-017 accessible-name guard did not exist.** T015's comment claimed `expectStartable`
     pinned it; it does not — an svg with no `<title>` adds nothing to an accessible name whether or
     not it is hidden, and lucide sets `aria-hidden` itself (`Icon.mjs:36`), so the explicit
     attribute is redundant too. Replaced with a direct assertion on the rendered mark, checked red
     by giving it an `aria-label`.
  2. **FR-010's "on the left" was unasserted.** Counting the two controls by role stays green with
     the branches swapped. Added `item.firstElementChild` has text `Start over`; checked red by
     moving the button to the right.
  3. **FR-016 cited where FR-017 was meant** in three places, propagated from T014/T015.
  4. **Bare `FR-015` / `FR-017` collide across 001 and 008** — `DeckLadder.test.tsx` used bare
     `FR-015` for 008's mark and for 001's unlock rule nineteen lines apart. Prefixed the ambiguous
     ones with their feature.
  5. **`isStartable`'s range guard was uncovered**: seeded with `['r1']` the `every()` is false
     either way, so the guard could have been deleted unnoticed. The test now seeds a completed
     deck, where only the guard keeps an out-of-range index from reporting startable. Checked red.
  6. **T017's fourth case was already asserted verbatim twice** (`ladder.test.ts:47` and `:84`).
     Deleted rather than triplicated — a deliberate deviation from T017 as written.
  7. **Two stale comments**: `dolch-k-5.ts`'s header said the deleted rung's "52 cards" (it had 50;
     the 52 are the deck's), and a test titled "in order" asserted presence only, after T008 took
     the order check into a test of its own.
  8. **The k-5 relabel had no automated assertion at all** — ten hand-edited labels with an id jump
     (`r9` → `r11`), covered only by the browser walk. Added the ten-label order assertion, which
     also pins that there is no `Level 10`.

- [ ] T026 **Open the PR** against `main` with `Closes #209` in the body. **Depends on T023, T025.**
  State what was asked for, so Principle VI can be checked against it, and name the two things a
  reviewer should not have to discover: the `001-deck-runs` FR-016 supersession, and that `r10` was
  deleted from shipped deck data. Wait for a green Pages preview before merge.

---

## Dependencies & Execution Order

### Phase dependencies

```
Phase 1  US1 naming + collapse   T001 → T002/T003/T004 → T005/T006 → T007
   │     (T001 before T003: the collapse decides the numbers)
   ▼
Phase 2  US2 inverted order      T008 (RED) → T009 → T010
   │
   ▼
Phase 3  US3 single row          T011 → T012 → T013      ← red between T011 and T012, expected
   │
   ▼
Phase 4  US4 completion mark     T014 → T015 → T016
   │
   ▼
Phase 5  US5 monotonic unlock    T017 (RED) ┐
   │                             T018 (RED) ┴→ T019 → T020
   ▼
Phase 6  Polish                  T021/T022 → T023 → T024 → T025 → T026
```

### Why the phases cannot be reordered

- **US1 before everything.** It renames the strings every later test queries by. Any other order
  writes those assertions twice.
- **US2 before US3 before US4.** All three edit the same JSX in `DeckLadder.tsx`. This is a
  file-level dependency, not a logical one — but it is absolute.
- **US5 last, and it is only half-liftable.** `isStartable` is a different file and depends on
  nothing here, so T017 and T019 could be lifted out to their own branch. T018 cannot: it queries
  level names (US1) and reads the completion mark (US4), so it needs Phases 1 and 4 behind it.
- **Phase 3 has no green gate in its middle.** T011 removes what T012's predecessors assert. Do not
  "fix" the red by reordering — commit them together.

### Within each phase

- **T002 ∥ T003 ∥ T004** — three different files, once T001 is in. T003 alone waits on T001.
- **T005 ∥ T006** — different test files, both waiting on the relabel.
- **T008 → T009** and **T017/T018 → T019** are red-then-green pairs. Do not reorder them; the failure
  is the deliverable.
- **T017 ∥ T018** — different files, both red against the same unchanged `isStartable`.
- **T021 ∥ T022** — one greps, one reads `git diff`. Neither touches anything.

### Parallel opportunities

Real but modest: `T002 ∥ T003 ∥ T004`, `T005 ∥ T006`, `T017 ∥ T018`, `T021 ∥ T022`. Everything else
runs in sequence, most of it because four of the six phases edit `DeckLadder.tsx`.

---

## Implementation Strategy

Single branch, single PR, on `008-deck-level-ladder`.

1. **Phase 1 → gate green.** The rename and the collapse are the whole of the data change. Stop and
   open both decks: Kindergarten should have ten levels.
2. **Phases 2–4 → gate green.** Three edits to one file, in order, each with its assertions.
3. **Phase 5 → red first, then one expression.** This is the change that supersedes a rule from an
   earlier feature, so the care goes here.
4. **Phase 6.** Sweeps, browser, PR.

**MVP scope**: Phase 1 alone. Levels are named levels everywhere, and no deck ends on a part-step. It
is coherent, green, and shippable on its own — the ladder just still reads downward and still spreads
an unfinished run over two rows.

**Bookkeeping is inline.** Flip `- [ ]` → `- [X]` in this file in the *same commit* as the work it
describes. There is no checkbox cleanup pass at the end.

---

## Notes

- `[P]` = different file, no dependency on an incomplete task.
- **The one Principle IV judgement call**, in T015. `item.querySelector('svg')` is a structural
  query, not a query by role or visible text. The mark is `aria-hidden` by design (FR-016), so it has
  no accessible name to query, and 003-outcome-button-icons set the precedent of leaving icon
  presence to the eye. It is asserted here anyway because FR-016's *permanence* — through replays,
  failures and abandoned retries — is the requirement most likely to regress silently, and a browser
  spot-check does not run in CI. On the deck screen the check mark is the only `svg` rendered, so the
  query is unambiguous. Flag it in the PR the way 007 flagged its `data-variant` assertions; if the
  maintainer would rather not have it, delete it and rely on T024's row-9 check.
- **Do not add a `data-testid`.** Every other observable this feature needs already exists.
- **Do not add a runtime collapse function** for FR-020. The rule is enforced by how decks are
  authored — see
  [research.md § D8](./research.md#d8--the-remainder-collapse-is-an-edit-to-the-authored-deck-not-runtime-logic).
- **Do not guard the run screen** on `isStartable`. FR-008 keeps URL entry working, deliberately.
- `cd` and `ls` are aliased in this shell (zoxide, eza). Use absolute paths; a failed `cd` is silent.
