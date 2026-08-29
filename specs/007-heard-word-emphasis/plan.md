# Implementation Plan: Heard-Word Button Emphasis

**Branch**: `007-heard-word-emphasis` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-heard-word-emphasis/spec.md`

## Summary

When the learner presses the speaker button on the run screen, the two outcome buttons swap which
one the screen recommends: "Not yet" takes the primary (near-black) treatment already used by
"Resume" and "Next run", and "Got it" drops its green for the plain grey "Not yet" had. Purely
visual, nothing is pressed for the learner, and the swap lasts exactly as long as the presentation
of that one card.

Technical approach: one boolean in `RunLoop` (`src/routes/Run.tsx`), set by a new `onHeard` callback
on `PronounceButton` and read by a new `heard` prop on `OutcomeButtons`. The reset is the load-bearing
part, and it costs one line: every card presentation begins either at a mount of `RunLoop` (resume,
or a rung change, since `RunLoop` is keyed by rung) or at a call to `apply` (mark, restart). Clearing
the flag inside `apply` therefore covers every path in FR-007 with no effect, no key, and no
comparison against the current word.

**No dependency is added, nothing is persisted, no CSS token is added, and
`src/components/ui/button.tsx` is not touched.** Four files change, all of them existing.

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict: true`. Unchanged.

**Primary Dependencies**: None added. The two states are the `default` and `secondary` variants
already defined in the vendored `src/components/ui/button.tsx`, plus the `bg-green-800` utility
"Got it" already carries. `cn` (`clsx` + `tailwind-merge`, both already installed via shadcn/ui) is
imported into `OutcomeButtons.tsx` to make the green conditional.

**Storage**: Untouched. No key, no field, no `schemaVersion`, no migration. FR-008 requires the
opposite of persistence, and component state satisfies it by construction.

**Testing**: Vitest + React Testing Library on `jsdom`. New assertions go in the existing
`describe` block in `src/routes/Run.test.tsx` that stubs `window.speechSynthesis` — the only place in
the suite where the speaker button exists at all, since jsdom has no Web Speech API and
`PronounceButton` renders `null` without it. No test file is created.

**Target Platform**: Evergreen browsers, static bundle. Unchanged.

**Project Type**: Single-page web application. No backend.

**Performance Goals**: None engaged. One boolean, one re-render of two buttons per press.

**Constraints**: Nothing about size, position, label or icon may change (FR-005), so the layout
arithmetic done in 003 and 006 is untouched and needs no re-measuring. The only real constraint is
FR-007's reset, which is a correctness property rather than a visual one.

**Scale/Scope**: 4 files modified, 0 added, 0 dependencies, 0 lines of CSS, 1 unit of state.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see [below](#post-design-re-check).*

| Principle | Verdict | Basis |
|---|---|---|
| I. Client-only static SPA | **Pass** | Component state and CSS classes. No route, no server, no build change. |
| II. localStorage is the system of record | **Not engaged** | Nothing read, nothing written. FR-008 forbids persistence outright, so no `schemaVersion` bump and no migration are owed. |
| III. Green CI or it does not merge | **Pass** | No new CI step; existing `lint → typecheck → test → build` covers it. |
| IV. Test behavior, not implementation | **Pass, with one judgement recorded** | The behaviour under test is the reset (FR-007), which is the only silent-failure path here. Asserting it needs *some* observable for "which button is emphasised", and the two honest candidates are a class name (forbidden) and `data-variant`, the attribute `Button` deliberately emits at `src/components/ui/button.tsx:59`. `data-variant` is chosen and the reasoning is in [research.md § Decision 3](./research.md#decision-3-what-the-tests-can-honestly-assert). Colour itself gets no assertion — that is calibrated in a browser, as it was in 003. |
| V. Minimal dependency surface | **Pass** | Nothing added. One `useState`, which is exactly what the principle names as the default. |
| VI. Build only what was asked | **Pass, with one thing named and not built** | See [below](#adjacent-work-named-and-declined). |
| VII. Self-contained, no host pollution | **Pass** | Nothing installed, nothing global. |
| VIII. Free, open, reputable, stable | **Not engaged** | No dependency, no asset, no licence question. |

**No gate fails. No violation requires an exit path.**

### Adjacent work, named and declined

1. **Announcing the change to assistive technology.** A swap of visual emphasis could plausibly be
   paired with `aria-pressed`, a live region, or a changed accessible name. All three are declined
   and FR-003 says so: the accessible names stay `Got it` and `Not yet`, and nothing new is
   announced. Changing an accessible name mid-card would break roughly twenty existing queries in
   `src/routes/Run.test.tsx` and would tell a screen-reader user that a control had changed identity
   when it had not. The guidance being changed is visual guidance; it is offered to the eye.
2. **A `success` variant plus `--success` tokens on the vendored button.** Declined in
   [003's plan](../003-outcome-button-icons/plan.md#adjacent-work-named-and-declined) and still
   declined for the same reason — one caller. This feature makes the green *conditional*, which does
   not add a second caller.

## Project Structure

### Documentation (this feature)

```text
specs/007-heard-word-emphasis/
├── spec.md                     # written by /speckit-specify
├── plan.md                     # this file
├── research.md                 # Phase 0 — four decisions
├── contracts/
│   └── outcome-emphasis.md     # Phase 1 — the two component contracts that change
├── quickstart.md               # Phase 1 — validation
├── checklists/
│   └── requirements.md         # 16/16
└── tasks.md                    # /speckit-tasks, not created here
```

**No `data-model.md`.** That Phase 1 step is conditional on the feature involving data. This one
involves a boolean that never leaves the component tree, which is why the spec has no Key Entities
section either.

### Source code (repository root)

```text
src/
├── components/
│   ├── OutcomeButtons.tsx      # MODIFIED — new `heard` prop; variants swap on it
│   ├── PronounceButton.tsx     # MODIFIED — new `onHeard` prop; one call in `speak`
│   ├── CardFace.tsx            # UNCHANGED
│   ├── RunProgress.tsx         # UNCHANGED
│   └── ui/button.tsx           # UNCHANGED — no new variant, no new token
├── routes/
│   ├── Run.tsx                 # MODIFIED — one `useState`, one reset in `apply`, two props
│   └── Run.test.tsx            # MODIFIED — assertions inside the existing speech-stub block
├── run/                        # UNCHANGED — the engine has no opinion about this
├── storage/                    # UNCHANGED — nothing persisted changes
└── index.css                   # UNCHANGED
```

**Structure Decision**: Existing layout kept. The flag lives in `RunLoop` because that is the one
component that can see both the speaker and the outcomes, and because it already owns every
transition that ends a card's presentation. No context, no reducer field, no new component.

## Implementation notes that will otherwise be rediscovered the hard way

- **The reset belongs in `apply`, not in an effect and not in a comparison against the current
  word.** `PronounceButton` keys its own speaking state on the word and documents why that is safe
  for it (`src/components/PronounceButton.tsx`, the `useEffect` comment): a failed last card and a
  "Start over" can both re-present the *same* word, and it deliberately does not re-trigger. That is
  exactly the case FR-007 requires this feature to treat as a fresh presentation, so the same trick
  cannot be reused here. `apply` is the whole set of transitions that end a presentation; the mount
  covers the rest.
- **`variant` and `className` are not interchangeable.** `Button` composes them as
  `cn(buttonVariants({ variant, size, className }))`, so `className` is appended last and
  `tailwind-merge` lets `bg-green-800` beat the `default` variant's `bg-primary`. That is why green
  is already applied the way it is today, and why the heard state must *drop* the green classes
  rather than try to out-specify them.
- **`data-variant` is the only stable non-class hook.** `src/components/ui/button.tsx:59` sets
  `data-variant={variant}` on every button. In the default state the pair reads
  `Got it = default`, `Not yet = secondary`; after the press it reads `Got it = secondary`,
  `Not yet = default`. The green never accompanies `secondary`, so the pair is unambiguous.
- **The speaker button does not exist in jsdom.** Any test that presses it must live inside the
  `describe` block in `src/routes/Run.test.tsx` that defines `window.speechSynthesis`. Outside it,
  `PronounceButton` returns `null` — which is also, for free, the FR edge case that a device with no
  speech never sees the swap.

## Complexity Tracking

> No constitution violation. This table records where complexity was **declined**, so the next
> reader does not re-propose it.

| Choice | Simpler than | Why it holds |
|---|---|---|
| One `useState<boolean>` in `RunLoop`, cleared in `apply` | A field on `RunState`, or a presentation key derived from `cycleIndex`/`position` | The engine under `src/run/` is pure and decides the mechanic; whether a learner pressed a speaker is not part of the mechanic and must not be persisted (FR-008). A field there would have to be excluded from `PersistedRun` by hand. |
| `variant` prop swap plus a conditional green | A `success` variant and `--success` tokens | Still one caller. See 003. |
| No `data-model.md` | The template's Phase 1 default | No data. |

## Post-design re-check

Re-evaluated after Phase 1. **No verdict changed.** Three things the design work established rather
than assumed, all read out of the working tree on 2026-08-28:

- **`Button` emits `data-variant`** (`src/components/ui/button.tsx:59`), so Principle IV's
  observable exists without adding a `data-testid`. It was checked, not recalled.
- **`--primary` is `oklch(0.205 0 0)` and `--secondary` is `oklch(0.97 0 0)`**
  (`src/index.css:59`, `:61`) — a near-black and a near-white grey, which is what the request
  describes and what "Resume" already renders. No new colour is chosen, so no contrast figure is
  computed here; both pairings already ship.
- **`Run.test.tsx` already stubs the Web Speech API** in its own `describe` block, with an `end()`
  helper. The tests this feature needs have somewhere to live and nothing to set up.

One claim in this plan is **not** verified and is a browser check rather than a fact: that the swap
is legible as a change of recommendation to someone looking at the screen — i.e. that the black
"Not yet" reads as the emphasised one and the grey "Got it" as the plain one. That is
[quickstart.md](./quickstart.md) step 2, done in a real browser, not asserted in a test.
