# Implementation Plan: Outcome Button Icons

**Branch**: `003-outcome-button-icons` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-outcome-button-icons/spec.md`

## Summary

Give the two outcome buttons on the run screen a large central symbol with smaller wording
underneath — a check mark for "Got it", a question mark for "Not yet" — and make the "Got it" button
green. "Not yet" keeps the appearance it has. A pre-reading learner should be able to answer by
recognizing a shape.

Technical approach: rewrite the contents of `src/components/OutcomeButtons.tsx`. Each `Button`
becomes a `flex-col` stack of an icon and a label, with `CircleCheck` and `CircleQuestionMark` imported
from `lucide-react` — both are a `circle r="10"` in the same 24-unit box, so they are a dimensionally
matched pair by construction. The green is Tailwind's built-in `green-800` with white text, applied as
three utility classes on the one button.

**One dependency is added — `lucide-react`, sanctioned by name in Principle V and ISC-licensed. No CSS
token is added, `src/components/ui/button.tsx` is not touched, and nothing persisted changes.** Four
files change: the component, one test file, `package.json` and `package-lock.json`.

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict: true`. Unchanged.

**Primary Dependencies**: **`lucide-react@1.33.0` added**, ISC-licensed. Principle V pre-approves
shadcn/ui "+ ... icons" by name, and Principle VIII pre-clears ISC, so nothing here needs an amendment
— but the PR still owes the dependency justification and the licence record. Both are written out in
[research.md § Decision 5](./research.md#decision-5-what-the-dependency-costs). Note that this package
was removed from the repo during 001 as **unused**
([#63](https://github.com/k-electron/flashrunner/issues/63)); this feature is its first real use.

**Storage**: Untouched. No key, no field, no `schemaVersion`, no migration. This feature stores
nothing and reads nothing.

**Testing**: Vitest + React Testing Library on `jsdom`. The regression guard already exists — roughly
twenty `getByRole('button', { name: ... })` queries in `src/routes/Run.test.tsx` that fail if a symbol
leaks into an accessible name. One assertion is added. No test file is created.

**Target Platform**: Evergreen browsers, static bundle. Unchanged.

**Project Type**: Single-page web application. No backend.

**Performance Goals**: None engaged. Two inline SVG paths and a text character, rendered once per
card.

**Constraints**: The tap target must not shrink below today's 64px (FR-019), and the whole run screen
must still fit a 320px-wide viewport without scrolling (FR-020, SC-005). Both are measured in a
browser — see [quickstart.md](./quickstart.md). FR-012's contrast requirement is settled by choosing
`green-800` (7.13:1 against white) rather than deferred to a measurement.

**Scale/Scope**: One component. 4 files modified (component, test, `package.json`,
`package-lock.json`), 0 added, 1 dependency, 0 lines of CSS.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see [below](#post-design-re-check).*

| Principle | Verdict | Basis |
|---|---|---|
| I. Client-only static SPA | **Pass** | Markup and CSS classes. No route, no server, no build change. |
| II. localStorage is the system of record | **Not engaged** | This feature reads and writes nothing. No shape change, so no `schemaVersion` bump and no migration are owed (FR-023). |
| III. Green CI or it does not merge | **Pass** | No new CI step. The existing `lint → typecheck → test → build` covers it. |
| IV. Test behavior, not implementation | **Pass** | The behavioural suite is untouched and must stay green as-is. The one added assertion queries visible text. Nothing asserts a class name, a stroke width, or a colour value — those are calibrated by eye in a browser, which is where a presentational requirement belongs. Symbol presence gets no test: it is presentation, like `CardFace`'s font size, which also has none. |
| V. Minimal dependency surface | **Pass** | One dependency added, and it is pre-approved by name — Principle V's table lists shadcn/ui "+ ... icons", which is `lucide-react`. The justification is written out in [research.md § Decision 5](./research.md#decision-5-what-the-dependency-costs) and belongs in the PR description. Two icons are imported by name, so the build pulls two icon modules rather than the set. |
| VI. Build only what was asked | **Pass, with two things named and not built** | See [below](#adjacent-work-named-and-declined). |
| VII. Self-contained, no host pollution | **Pass** | Nothing installed, nothing global. |
| VIII. Free, open, reputable, stable | **Pass** | `lucide-react@1.33.0`, **ISC** — on the pre-cleared list, so no question is owed. Actively maintained, very wide adoption, stable channel (not alpha/beta/RC/canary/`0.0.x`). The icons are the package's own artwork under the same licence, which discharges the separate asset-review rule. Recorded in the PR per the rule that adding a dependency means recording its licence. |

**No gate fails. No violation requires an exit path.**

### Adjacent work, named and declined

Principle VI says name adjacent work and ask rather than building it and explaining afterwards. Two
things came up:

1. **A `success` variant on `src/components/ui/button.tsx`, backed by `--success` /
   `--success-foreground` tokens.** The idiomatic shadcn answer, and correct the moment a second
   thing in this app needs to be green. Today it is an abstraction with one caller. Declined; the
   green is three utility classes on the one button. Upgrade path recorded in
   [research.md § Decision 3](./research.md#decision-3-which-green).
2. **Anything to do with dark mode.** Asked and answered: the maintainer confirmed on 2026-08-23
   that dark mode is not planned, and FR-011 was amended into a scope boundary — no dark variant of
   either button. `src/index.css:6` and `:86` define the `dark` variant and its token block, but no
   code applies the class, and none is being added. The dormant block is left exactly as it is.

## Project Structure

### Documentation (this feature)

```text
specs/003-outcome-button-icons/
├── spec.md                     # merged separately
├── plan.md                     # this file
├── research.md                 # Phase 0 — four decisions, three of them "no"
├── contracts/
│   └── outcome-buttons.md      # Phase 1 — the rendered contract
├── quickstart.md               # Phase 1 — validation, mostly by hand
├── checklists/
│   └── requirements.md         # 16/16
└── tasks.md                    # /speckit-tasks, not created here
```

**No `data-model.md`.** The Phase 1 step is conditional on the feature involving data, and this one
involves none — the spec has no Key Entities section for the same reason. Writing a document to say
"no entities" would be process for its own sake.

### Source code (repository root)

```text
src/
├── components/
│   ├── OutcomeButtons.tsx      # MODIFIED — the entire feature
│   ├── CardFace.tsx            # UNCHANGED
│   ├── CycleCounter.tsx        # UNCHANGED
│   └── ui/button.tsx           # UNCHANGED — no `success` variant
├── routes/
│   ├── Run.tsx                 # UNCHANGED — it passes `onMark` and nothing else
│   └── Run.test.tsx            # MODIFIED — one added assertion
├── run/                        # UNCHANGED — engine untouched
├── storage/                    # UNCHANGED — nothing persisted changes
└── index.css                   # UNCHANGED — no new token

package.json                    # MODIFIED — + lucide-react
package-lock.json               # MODIFIED — committed, per Principle III
```

**Structure Decision**: The existing layout is kept. `OutcomeButtons.tsx` already owns exactly this
concern, and the two icons are named imports used once each — no wrapper component, no icon module, no
re-export barrel.

## Implementation notes that will otherwise be rediscovered the hard way

Three mechanical facts, all from `src/components/ui/button.tsx:8`:

- **An unsized SVG inside a `Button` is forced to 16px.** The base class ends with
  `[&_svg:not([class*='size-'])]:size-4`. A lucide icon renders as an `<svg>`, so each one must carry
  its own `size-*` class or it renders at inline-icon scale, quietly failing FR-002.
- **`[&_svg]:pointer-events-none` is already set**, which is exactly what FR-005 needs — a press on
  the symbol registers on the button.
- **The base class is `inline-flex`, and adding `flex-col` is safe.** `tailwind-merge` groups display
  and flex-direction separately, so both survive. Overriding the fill needs all three of
  `bg-green-800 text-white hover:bg-green-900`, because the `default` variant sets
  `hover:bg-primary/80` as its own class, and leaving it in place would turn the button near-black on
  hover.

### The vertical budget

FR-020 and SC-005 are the requirements most likely to be broken by taller buttons, so here is the
arithmetic for the 320 × 568 viewport, from `src/routes/Run.tsx`'s `main` (`min-h-svh`, `gap-8`,
`p-6`):

| Element | Today | After |
|---|---|---|
| Padding, top + bottom (`p-6`) | 48 | 48 |
| Deck · rung heading (`text-sm`) | ~20 | ~20 |
| Card face (`text-7xl leading-none`) | 72 | 72 |
| Cycle counter (`text-base`) | ~24 | ~24 |
| **Outcome buttons** | **64** (`h-16`) | **96** (`h-24`) |
| "Start over" row | ~32 | ~32 |
| Four `gap-8` gaps | 128 | 128 |
| **Total** | **~388** | **~420** |

Roughly 148px of headroom on the shortest phone viewport in common use. **This is an estimate from
Tailwind's spacing scale, not a measurement** — it assumes default line heights and ignores font
metrics. Verify it in the device toolbar per [quickstart.md](./quickstart.md) step 3.

Horizontally: 320 − 48 padding = 272px of content, less a `gap-4`, gives each button ~128px. "Not yet"
at `text-base` is about 55px wide, so there is no clipping risk at the narrowest supported width.

## Complexity Tracking

> Nothing in this feature requires a constitution violation, and nothing is more complex than the
> description implies. This table records the one place complexity was **removed** relative to the
> obvious approach, so the reasoning survives the next person's "why isn't this a variant?".

| Choice | Simpler than | Why it holds |
|---|---|---|
| Three utility classes on one button | A `success` variant plus a `--success` / `--success-foreground` token pair | Two files instead of one, and a shared surface grown for a single caller. A token pair earns its keep by holding two values that swap with the theme; with dark mode off the table it would hold one. Principle VI: earned by a second use case, not predicted from the first. |
| `lucide-react` for both icons | Two hand-drawn SVG paths, or a hand-drawn tick beside a text `?` | Reversed on maintainer direction, and it is the better call. `lucide-react` is named in Principle V, is ISC, and gives two icons that are dimensionally identical by construction. Hand-matching a drawn tick to a typographic `?` is eyeball calibration that never gets revisited. See [research.md § Decision 1](./research.md#decision-1-where-the-check-mark-comes-from). |
| No `data-model.md` | The template's Phase 1 default | No data. |

## Post-design re-check

Re-evaluated after Phase 1. **No verdict changed.** Two things the design work established rather
than assumed:

- **Principle IV is satisfied by tests that already exist.** React Testing Library matches a string
  `name` option against the *full* accessible name, so the ~20 existing
  `getByRole('button', { name: 'Got it' })` queries in `src/routes/Run.test.tsx` are already the
  regression guard for FR-015 — a leaked `<title>`, `aria-label`, or unhidden glyph breaks every one
  of them. Only one gap was real: those queries pass whether the name comes from visible text or from
  an `aria-label`, so they would not catch an icon-only button with a hidden label. That gap gets the
  one added assertion, and nothing else.
- **Dark mode is settled, not deferred.** Chasing FR-011 turned up that the `dark` class is never
  applied anywhere in the app; the maintainer confirmed it is not planned. So the green is one value
  with no second variant to invent, and the `.dark` token block stays dormant and untouched.

One number in this plan was **unverified** and carried a measurement step in
[quickstart.md](./quickstart.md) rather than being presented as fact: the vertical budget above, derived
from Tailwind's spacing scale rather than measured in a browser. **Measured 2026-08-24 — it holds.** At
320 x 568 nothing scrolls and no label clips. The buttons measure 94px in the computed box rather than
96px, because `box-sizing` is `border-box` and the base `Button` class carries a 1px transparent
border, so `getComputedStyle().height` reports the content box; the tap target is 96px either way.

The contrast figures are no longer in that category. They were computed from Tailwind v3 palette hexes
while this project runs Tailwind 4.3.3, which is why the earlier `green-700` plan carried a measurement
task — 5.02:1 left no room for the palette difference. `green-800` is 7.13:1, and that margin absorbs
it, so the shade is settled rather than checked.

The `lucide-react` facts in [research.md](./research.md) **were** verified: version, ISC licence, and
both icon nodes were read out of the published `lucide-react@1.33.0` tarball, not recalled.
