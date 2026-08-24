# Contract: the outcome buttons

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](../spec.md)

The one interface this feature changes. `src/components/OutcomeButtons.tsx` keeps its props exactly;
only what it renders changes.

## Props — unchanged

```ts
function OutcomeButtons({ onMark }: { onMark: (outcome: Outcome) => void }): ReactElement
```

`Outcome` is `'got-it' | 'not-yet'` (`src/run/types.ts`). The left button calls `onMark('got-it')`,
the right calls `onMark('not-yet')`. No new prop, no variant flag, no configuration (FR-022).

## Rendered contract

Two buttons, side by side, left to right, in this order (FR-018):

| Position | Icon | Wording | Accessible name | Fill |
|---|---|---|---|---|
| Left | `CircleCheck` (lucide) | `Got it` | `Got it` | `green-800`, white content |
| Right | `CircleQuestionMark` (lucide) | `Not yet` | `Not yet` | unchanged from today |

Both icons come from `lucide-react@1.33.0` and are a `circle r="10"` in the same 24-unit box, so they
are a dimensionally matched pair without tuning.

Each button:

- is one element with one activation region — the symbol and the wording are both inside it, and
  neither is separately clickable (FR-005)
- stacks the symbol above the wording, both horizontally centred (FR-001, FR-004)
- draws the symbol larger than the wording (FR-002, FR-003)
- exposes an accessible name equal to its visible wording, with nothing appended (FR-015)
- is one tab stop with a visible focus ring, inherited from `Button` (FR-016)

## What the icons must be

- **Decorative** (FR-008). `aria-hidden` on both. They carry no information the wording does not, so
  announcing them would be duplicate noise.
- **Not focusable.** Inherited: an `<svg>` is not in the tab order, and the base `Button` class sets
  `[&_svg]:pointer-events-none`.
- **Explicitly sized.** `src/components/ui/button.tsx:8` forces any unsized descendant SVG to
  `size-4`. Each icon carries its own `size-*` class or it renders at 16px.
- **Imported by name.** `import { CircleCheck, CircleQuestionMark } from 'lucide-react'` — named
  imports so the build pulls two icon modules rather than the set. `CircleCheck`, not `CheckCircle`:
  the latter is a legacy alias for a different icon.

## The assertions that hold this contract

Existing, in `src/routes/Run.test.tsx` — roughly twenty queries of the form:

```ts
screen.getByRole('button', { name: 'Got it' })
```

React Testing Library matches a string `name` against the **full** accessible name, so every one of
these fails if a symbol leaks into the name — an `aria-label`, a `<title>`, or an unhidden glyph.
The regression guard for FR-015 already exists and does not need rebuilding.

New, one assertion: each label is present as **visible text** inside its button. The queries above
pass whether the name comes from visible text or from an `aria-label`, so they alone would not catch
an icon-only button carrying a hidden label — which is exactly what FR-014 forbids.

## Explicitly not part of this contract

- The exact icon size and button height. Those are visual decisions taken in a browser, not fixed
  here. The constraint on them is FR-019 (tap target no smaller than today's `h-16`). The green **is**
  fixed: `green-800`, 7.13:1 against white, settled in planning rather than measured.
- `src/components/ui/button.tsx`. Not modified; no `success` variant is added (see
  [research.md § Decision 4](../research.md#decision-4-how-the-colour-is-applied)).
- Every other button in the app. None gains a symbol.
