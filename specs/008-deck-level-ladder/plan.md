# Implementation Plan: Deck screen level ladder

**Branch**: `008-deck-level-ladder` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-deck-level-ladder/spec.md`

## Summary

Seven changes to how a deck's ladder reads, five on the deck screen (`/deck/:deckId`)
and two in the authored deck data:

1. Levels are named "Level N" and "Full deck" instead of "N words" — an edit to the
   `label` field of the 19 rungs across the two built-in decks. Every screen that
   names a level reads that field, so all three update from the one edit.
2. The deck screen renders the ladder highest-first, so Level 1 is the bottom row.
3. The unlock rule in `src/decks/ladder.ts` changes from "the level below is
   completed" to "every level below is completed" — one expression, and the whole
   of the monotonic-ladder requirement.
4. A level with an unfinished run collapses from two rows to one. The level's own
   control already links to the same URL the "Resume" link did, and the run screen
   already resumes from storage on entry, so this is a deletion: the "Resume" link
   and the "Unfinished run" caption go, "Start over" moves left of the level control.
5. The "Completed" caption is replaced by a `CircleCheck` inside the level control, left
   of the name and `aria-hidden` so the accessible name stays the level name. Content
   stays centre-justified, which `Button` already does.
6. `dolch-k-5`'s ladder ended 45 → 50 → 52, a final step of 2 against a regular step of
   5. The `r10` (50-word) rung is deleted, so `r11` — which already holds all 52 cards —
   becomes the highest level. The deck goes from 11 levels to 10. `dolch-prek-5` ends on
   a full step and is untouched.

Nothing persisted changes shape. No `schemaVersion` bump, no migration, no new
dependency — removing a level is a deck config revision, a case `specs/001-deck-runs`
already specifies and the storage layer already handles (research.md D8). The net diff is expected to remove more lines from `DeckLadder.tsx`
than it adds.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict`), Node 26.7.0 (pinned in `.nvmrc`)

**Primary Dependencies**: React 19.2.8, React Router 8.3.0 (SPA mode), Tailwind CSS 4,
shadcn/ui (vendored), `lucide-react` 1.33.0. No new dependency — `CircleCheck` is
already imported by `src/components/OutcomeButtons.tsx`.

**Storage**: `localStorage` only, via `src/storage/safeStorage.ts` and
`src/storage/deckRecord.ts`. **Unchanged by this feature.**

**Testing**: Vitest + React Testing Library. Component tests query by role and
visible text (Principle IV); the unlock rule is covered as plain function calls in
`src/decks/ladder.test.ts`.

**Target Platform**: Evergreen browsers, phone-first. Static SPA on Cloudflare Pages.

**Project Type**: Client-only single-page web app.

**Performance Goals**: N/A — this is render-order and copy. No new computation on any
path; the new unlock rule is O(levels²) across a full ladder render, over at most 11
levels.

**Constraints**: The deck screen must stay usable at phone width — the single-row
requirement (FR-009/FR-010) is what this constraint is about.

**Scale/Scope**: 2 built-in decks, 18 levels after the collapse (was 19), 3 screens, ~9 files touched. Shipping as one PR.

No NEEDS CLARIFICATION items. Every open reading is settled in the spec's
Clarifications section (session 2026-08-29), including the remainder collapse added
after this plan's first pass.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see below.*

| Principle | Status | Note |
|---|---|---|
| I. Client-Only Static SPA | PASS | No server, no routing change, no new route. Render and copy only. |
| II. localStorage Is the System of Record | PASS | No key, payload, or `schemaVersion` change. `readDeckRecord`/`writeDeckRecord` are used exactly as they are today; "Start over" keeps its current body verbatim. Deleting `dolch-k-5`'s `r10` is a config revision, not a stored-shape change: `readRungIds` keeps the orphaned id and `readRun` drops a run on a level that no longer exists, both already tested. No migration is owed. |
| III. Green CI or It Does Not Merge | PASS | No change to `.nvmrc`, `engines`, or the workflow. Existing pipeline covers it. |
| IV. Test Behavior, Not Implementation | PASS | `isStartable` is a pure function with existing unit tests, extended for the new rule. Deck screen assertions stay role/visible-text. See the caution in research.md D7 about asserting order without asserting internals. |
| V. Minimal Dependency Surface | PASS | Zero new dependencies. `CircleCheck` from the already-installed `lucide-react`. |
| VI. Build Only What Was Asked | PASS | Six numbered items, nothing beyond. Explicit non-goals recorded below. |
| VII. Self-Contained, No Host Pollution | PASS | No tooling change. |
| VIII. Free, Open, Reputable, Stable | PASS | No dependency or asset added, so nothing to license-review. |

**Scope note on item 6:** the remainder collapse was added by the maintainer after the
plan's first pass, as a rule for all decks. It is in scope and specified (FR-020,
FR-021). It is applied by editing the authored deck, not by adding runtime logic — see
research.md D8 for why no collapse function is written.

**Non-goals, recorded so Principle VI can be checked against the PR:** deck titles
(`Dolch Pre-K · Steps of 5`) are not touched; no level-count copy is added anywhere to
replace what the rename removes; no deck authoring, level configuration, or settings
screen; the run screen's own layout is untouched beyond the level name it prints.

**One supersession to record in the PR**, not a violation: `specs/001-deck-runs`
FR-016 says completed rungs stay startable forever. Under FR-006 here, a level
completed *out of order* is not startable from the deck screen. For any ladder
climbed in order the two rules agree exactly, and the affected doc comments in
`src/decks/ladder.ts` are updated to say so rather than left contradicting the code.

## Project Structure

### Documentation (this feature)

```text
specs/008-deck-level-ladder/
├── plan.md              # This file
├── research.md          # Phase 0 output — the decisions and what was rejected
├── data-model.md        # Phase 1 output — authored vs derived, and what is NOT stored
├── quickstart.md        # Phase 1 output — how to verify this by hand and by test
├── contracts/
│   └── deck-screen.md   # Phase 1 output — what the deck screen renders, and its names
├── checklists/
│   └── requirements.md  # /speckit-specify output
└── tasks.md             # /speckit-tasks output — NOT created here
```

### Source Code (repository root)

```text
src/
├── decks/
│   ├── dolch-prek-5.ts     # CHANGED — 8 rung labels
│   ├── dolch-k-5.ts        # CHANGED — delete the r10 rung, then 10 labels
│   ├── types.ts            # CHANGED — the RungConfig.label example comment
│   ├── ladder.ts           # CHANGED — isStartable, and its doc comment
│   ├── ladder.test.ts      # CHANGED — the FR-016 case, plus the out-of-order case
│   ├── registry.ts         # unchanged
│   └── validate.ts         # unchanged — no rule reads label
├── routes/
│   ├── DeckLadder.tsx      # CHANGED — order, single row, check mark, deletions
│   ├── DeckLadder.test.tsx # CHANGED — labels, order, row shape, resume, mark
│   ├── DeckList.tsx        # unchanged — reads label, so it renames for free
│   ├── DeckList.test.tsx   # CHANGED — three label assertions
│   └── Run.tsx             # unchanged — prints rung.label; already resumes on entry
├── components/
│   ├── OutcomeButtons.tsx  # unchanged — the CircleCheck precedent
│   └── ui/button.tsx       # unchanged
└── storage/                # unchanged, entirely
```

**Structure Decision**: The existing single-project `src/` layout, unchanged. This
feature adds no directory and no module. The split it relies on is the one already
in place: `src/decks/ladder.ts` decides what is startable and `src/routes/DeckLadder.tsx`
only renders that decision — which is why the monotonic rule is a one-expression change
in one file rather than a change to the screen.

## Constitution Re-check (post-Phase 1)

Re-run against the design in research.md, data-model.md, and contracts/deck-screen.md.
All eight principles still PASS, with three points the design settled rather than
assumed:

- **Principle II** — data-model.md confirms both requirements that looked like storage
  changes (FR-016's permanence, FR-013's isolation) are properties `completedRungIds`
  and `startOver()` already have. No `schemaVersion` bump is owed.
- **Principle IV** — research.md D7 pins the one assertion that could have gone through
  internals: FR-005's ordering is asserted from `getAllByRole('listitem')` in DOM order,
  by accessible name, with no class names and no snapshot.
- **Principle V** — confirmed against `src/components/ui/button.tsx`: the check mark is
  an already-installed `lucide-react` icon inside the existing `Button`, with no new
  component and no variant added. Centre-justification needs no code — the base class
  already sets `justify-center`.
- **Principle VI** — the remainder collapse (FR-020) adds no runtime code. The
  temptation was a function that reads step sizes and merges levels; rejected in
  research.md D8 as machinery for a rule that authoring enforces for free.

Design added no new module, no new directory, and no new dependency. Complexity
Tracking stays empty.

## Complexity Tracking

No constitution violations. Nothing to justify.
