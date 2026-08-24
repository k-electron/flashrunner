# Implementation Plan: Andika Font

**Branch**: `004-andika-font` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-andika-font/spec.md`

**Revised 2026-08-23** after maintainer direction: standard web-font pattern, no blocking. FR-009 was
rewritten to match, and the first pass's hand-written `@font-face` and preload analysis are gone.

## Summary

Replace the app's typeface with **Andika**, SIL International's font for literacy and beginning
readers, so the lowercase `a` a learner decodes on a card is the single-story circle-and-stem they are
taught rather than the double-story form they are not. Andika applies to every string on every screen;
the outgoing font is removed rather than kept alongside.

Technical approach: **three files, no source code, no new pattern.** `src/index.css` swaps one font
`@import` for two (one per weight) and retargets its one `--font-sans` token; `package.json` and
`package-lock.json` swap one Fontsource package for another. The app already had exactly the right
shape for this — one token, declared once, applied once by `html { @apply font-sans }` — so an
app-wide typographic change touches no component.

**Nothing about layout, sizing or spacing changes**, and that is measured rather than hoped: every long
word in both decks gets *narrower*, and every line box keeps its height because Tailwind sets
`line-height` explicitly on every `text-*` utility. See
[research.md § Decision 4](./research.md#decision-4-sizing-and-spacing-stay-exactly-as-they-are).

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict: true`. Not engaged — this feature adds no TypeScript.

**Primary Dependencies**: **`@fontsource/andika@5.3.0` in, `@fontsource-variable/geist` out.** Net
zero. Both OFL-1.1, both from the same publisher and major version, so this is a swap inside an
established pattern rather than a new one. OFL-1.1 is pre-cleared by Principle VIII — a rule amended
in v1.5.0 for precisely this case, when the outgoing font arrived. The PR still owes the Principle V
justification, since fonts are not in the pre-approved table.

**Storage**: Untouched. No key, no field, no `schemaVersion`, no migration (FR-018).

**Testing**: Vitest + React Testing Library on `jsdom`. **No test added, no test file changed.**
`jsdom` does not load fonts or resolve a family to a typeface, so no assertion there can tell the two
letterforms apart. The existing 166 tests guard FR-017 and FR-020 and must pass **unmodified**.
Reasoned out, including the three tempting fake tests, in
[research.md § What is not tested](./research.md#what-is-not-tested-and-why).

**Target Platform**: Evergreen browsers on modern connections, static bundle. Unchanged.

**Project Type**: Single-page web application. No backend.

**Performance Goals**: What a browser downloads goes from ~32 kB (one variable file) to ~40 kB (two
static files) — Andika has no variable axis, so regular and bold are separate files. `unicode-range`
on every face means only the `latin` subset is fetched for English decks.

**Constraints**: FR-011 rules out a CDN — the font is served from the app's own origin, as today.

**Scale/Scope**: 3 files modified, 0 added. 0 lines of TypeScript. 1 dependency in, 1 out.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see [below](#post-design-re-check).*

| Principle | Verdict | Basis |
|---|---|---|
| I. Client-only static SPA | **Pass** | CSS and two font binaries from the app's own origin. No route, no server, no build-config change. FR-011 makes same-origin a requirement rather than an accident — nothing about which words a child is shown reaches a third party. |
| II. localStorage is the system of record | **Not engaged** | Reads and writes nothing. No shape change, so no `schemaVersion` bump and no migration (FR-018). |
| III. Green CI or it does not merge | **Pass** | No new CI step; `lint → typecheck → test → build` covers it. Worth naming: **CI cannot see this feature's failure mode.** A font that does not load produces a green build and the wrong typeface on screen. [quickstart.md](./quickstart.md) is the gate that matters. |
| IV. Test behavior, not implementation | **Pass** | No test added, no test changed. The assertions one might reach for are all change-detectors or `jsdom` artifacts. The behavioural suite queries role and visible text, so it is indifferent to which typeface renders it. |
| V. Minimal dependency surface | **Pass** | Net zero: one font package in, one out. Fonts are not pre-approved, so the PR owes the justification — and "hand-roll a literacy typeface" is not a real alternative, which is the short form of it. |
| VI. Build only what was asked | **Pass, with two things named and not built** | See [below](#adjacent-work-named-and-declined). |
| VII. Self-contained, no host pollution | **Pass** | Arrives via `npm ci` into `./node_modules`. Nothing global, no system font dependency, no `$HOME` state. |
| VIII. Free, open, reputable, stable | **Pass** | **OFL-1.1**, pre-cleared — and the same line discharges the separate asset review, since the typeface is the package's own artwork under that licence. Published 2026-07-19, SIL International, real adoption, stable channel. Recorded in the PR. |

**No gate fails. No violation requires an exit path.**

### Adjacent work, named and declined

1. **`font-synthesis: none`.** FR-013 forbids faked bold and italic, so it looks owed. It is a no-op:
   a face always matches, and synthesis kicks in only when the face the matching algorithm *lands on*
   is not bold or italic enough for the request. Every weight the app asks for resolves to one of the
   two real imported faces — `font-semibold` to the actual 700, not a thickened 400 — and nothing
   renders italic. Declined as a guard against a class nobody has written.
2. **Enlarging the card to offset Andika's smaller x-height** (0.508em against 0.534em, so lowercase
   reads about 5% shorter at the same size). Declined as a redesign rather than layout preservation —
   the spec's closing assumption draws exactly that line. The 5% was measured, seen, and left alone.

## Project Structure

### Documentation (this feature)

```text
specs/004-andika-font/
├── spec.md                  # merged in #135
├── plan.md                  # this file
├── research.md              # Phase 0 — four decisions
├── contracts/
│   └── typography.md        # Phase 1 — the rendered typography contract
├── quickstart.md            # Phase 1 — validation, by hand in a browser
├── checklists/
│   └── requirements.md      # 16/16
└── tasks.md                 # /speckit-tasks, not created here
```

**No `data-model.md`.** That Phase 1 step is conditional on the feature involving data, and this one
involves none — which is also why the spec has no Key Entities section.

### Source code (repository root)

```text
src/
├── index.css               # MODIFIED — the entire feature. One @import becomes two and
│                           #   --font-sans is retargeted: a -2/+3 diff.
├── components/             # UNCHANGED — including CardFace.tsx and ui/button.tsx
├── routes/                 # UNCHANGED — no route, no test file
├── run/                    # UNCHANGED — engine untouched
├── storage/                # UNCHANGED — nothing persisted changes
└── decks/                  # UNCHANGED — not one word of content changes

index.html                  # UNCHANGED
package.json                # MODIFIED — + @fontsource/andika, − @fontsource-variable/geist
package-lock.json           # MODIFIED — committed, per Principle III
```

**Structure Decision**: the existing layout is kept and nothing is added to it. One font token in one
file is why an app-wide typographic change is a three-file diff. Worth saying out loud, because the
*blast radius* is every string in the app even though the *diff* is one stylesheet — which is what
US3 and [quickstart.md](./quickstart.md) exist to check.

## Implementation notes that will otherwise be rediscovered the hard way

- **`font-semibold` will render as 700, not 600.** Andika has no variable axis, so CSS weight matching
  sends 600 up to the nearest available face. Six headings get genuinely bolder. Do not "fix" it by
  editing the classes — six edits, identical pixels.
- **`font-medium` on `ui/button.tsx:8` resolves to 400**, so *every button label in the app* gets
  slightly lighter. That declaration is in the shared base class, so it is one line with app-wide
  reach — and button labels are the one thing getting lighter, so they are where a problem shows.
- **The letterforms need no configuration and cannot be lost.** `U+0061` → `a.SngStory`, `U+0067` →
  `g.SngBowl`, in both weights, with no double-story alternates in the files at all. Nothing to
  enable, nothing that can be switched off later.
- **Import the two weight files, not the combined `index.css`.** That file declares **weight 400
  only** — there is no 700 face in it at all — so `font-semibold` would fall through to *synthesized*
  bold, which FR-013 forbids. This is a MUST-level reason, not a tidiness one.

### The vertical budget

FR-015 and SC-004 are the requirements a taller font would break, so here is the arithmetic for the
320 × 568 viewport, from `src/routes/Run.tsx`'s `main` (`min-h-svh`, `gap-8`, `p-6`):

| Element | Today | After |
|---|---|---|
| Padding, top + bottom (`p-6`) | 48 | 48 |
| Deck · rung heading (`text-sm`) | 20 | 20 |
| Card face (`text-7xl leading-none`) | 72 | 72 |
| Cycle counter (`text-base`) | 24 | 24 |
| Outcome buttons (`h-24`) | 96 | 96 |
| "Start over" row | 32 | 32 |
| Four `gap-8` gaps | 128 | 128 |
| **Total** | **420** | **420** |

**Every row is identical, and that is the finding rather than an omission.** Andika's glyph box is
1.611em against the outgoing font's 1.300em — 24% taller — yet no height moves, because Tailwind sets
an explicit `line-height` on every `text-*` utility and the card face adds `leading-none`. A line
box's height is its `line-height`.

What the taller glyph box does change is overhang *outside* the line box: roughly 22px above and below
at 72px, against roughly 11px today, into a 32px `gap-8`. It still clears. **That is arithmetic from
the metrics, not a measurement** — the one claim here that wants an eye on it in a browser.

Horizontally there is nothing to check by hand, because it was computed: 272px of content width on a
320px viewport against a widest-word width of **213.7px**, with every long word coming out *narrower*
than today.

## Complexity Tracking

> No constitution violation, and nothing more complex than the description implies. One row, recording
> where the template's default was skipped.

| Choice | Simpler than | Why it holds |
|---|---|---|
| No `data-model.md` | The template's Phase 1 default | No data. A document saying "no entities" is process for its own sake. |

## Post-design re-check

Re-evaluated after Phase 1. **No verdict changed.** Three things the design work established rather
than assumed:

- **The feature's real risk is silence, not layout.** Going in, the obvious worry was a wider font
  clipping a card. Measurement retired that: every long word gets narrower and no line box changes
  height. What replaces it is a failure mode with no symptom — a font that does not load produces a
  green `lint → typecheck → test → build` and the wrong typeface on screen, and neither CI nor `jsdom`
  can see it. So quickstart's first step is looking at the letter.
- **Principle IV is satisfied by adding nothing.** This is the first feature here whose correctness is
  entirely invisible to the test environment. The honest answer is no test, stated with its reasoning,
  rather than an assertion that restates the diff and would pass against a broken build.
- **FR-005 turned out to be free.** It is a property of the font files as published, not something the
  app has to arrange.

One number is **unverified** and carries a step in [quickstart.md](./quickstart.md) rather than being
presented as fact: the glyph-overhang arithmetic above. Everything else — the widths, the weight
resolution, the glyph names, the licence, the publish date — was read out of a font file, a manifest,
or a real build.
