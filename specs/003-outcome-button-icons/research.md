# Phase 0 Research: Outcome Button Icons

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Revised 2026-08-23** after maintainer direction: use `lucide-react` rather than hand-rolling the
symbols, use both symbols circled, and take `green-800` without measuring. Decisions 1, 2 and 3 were
reversed or settled by that direction; what the earlier versions argued is recorded at the end of each
so the reversal is legible rather than silently overwritten.

## Decision 1: where the check mark comes from

**Decision**: `CircleCheck` from `lucide-react`.

**Rationale**: Constitution Principle V pre-approves shadcn/ui "+ Radix primitives, `cva`, `clsx`,
`tailwind-merge`, **icons**", and `lucide-react` is the icon set shadcn generates against. It is the
conventional answer, it is already sanctioned by name, and it does not need reinventing.

Verified against the published package rather than from memory:

| Fact | Value |
|---|---|
| Version | `lucide-react@1.33.0` |
| Licence | **ISC** — pre-cleared by Principle VIII, no question owed |
| `CircleCheck` icon node | `["circle", { cx: 12, cy: 12, r: 10 }]` + `["path", { d: "m9 12 2 2 4-4" }]` |
| Import | `import { CircleCheck } from 'lucide-react'` |

**Note on `CheckCircle`**: it still exists but is a legacy alias that re-exports `circle-check-big`, a
different icon. `CircleCheck` is the canonical name in this version and is what to import.

**This package was previously removed from this repo.** Issue
[#63](https://github.com/k-electron/flashrunner/issues/63) — "T046: Remove the unused `lucide-react`
runtime dependency from `package.json`" — took it out during 001. It was removed for being **unused**,
which Principle V requires ("Remove unused deps"), not for being unwanted. This feature is its first
real use, so re-adding it is consistent with why it went: the rule was never "no icon library", it was
"no dependency nothing renders".

**Superseded rationale**: the first version of this document declined the package and hand-rolled a
three-point polyline, reasoning that Principle V's "why is hand-rolling worse" test cannot be met for
one SVG path. That reasoning was sound about the path and wrong about the trade: a sanctioned,
ISC-licensed, universally adopted icon set is not a cost worth avoiding to save two lines, and
hand-drawn icons are the kind of thing that never gets a second look and slowly drifts out of step
with everything around it.

## Decision 2: where the question mark comes from

**Decision**: `CircleQuestionMark` from `lucide-react`. Icon node:
`["circle", { cx: 12, cy: 12, r: 10 }]`, `["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }]`,
`["path", { d: "M12 17h.01" }]`.

**Rationale**: One source, one stroke weight, no calibration. Both symbols are a `circle r="10"` in the
same 24-unit box, so they are dimensionally identical by construction — the tick and the question mark
occupy exactly the same optical footprint, which is the thing hardest to achieve by hand and free here.

**On the enclosing circle**: `lucide-react@1.33.0` has **no bare question mark**. Every one is
enclosed — `CircleQuestionMark`, `BadgeQuestionMark`, `FileQuestionMark`, `MailQuestionMark`,
`MessageCircleQuestionMark`, `ShieldQuestionMark`. It has a bare `Check`, so a bare tick beside a
circled question mark was available and was rejected by the maintainer in favour of circling both.
That is the better call: **matched** is what makes a pair read as a pair, and two rings say "two
answers" where one ring says "this one is different".

**Superseded rationale**: the first version argued a circled question mark reads as a help affordance —
something to press for an explanation — and so was the wrong meaning for an answer button. That
objection was to a *lone* circled `?` sitting next to a *bare* tick, where the ring is the only
difference between them and therefore carries meaning. With both symbols circled and both labelled, the
ring is shared vocabulary rather than a signal, and the objection does not survive the change.

## Decision 3: which green

**Decision**: Tailwind's built-in `green-800` with white text, `hover:bg-green-900`. No new CSS custom
property, no `--success` token.

**Rationale**: `green-800` (`#166534`) is **7.13:1** against white — comfortably past the 4.5:1 that
FR-012 needs for small text, with enough margin that it does not need measuring.

| Shade | Hex | vs white |
|---|---|---|
| `green-600` | `#16a34a` | 3.30:1 — fails |
| `green-700` | `#15803d` | 5.02:1 — passes, thin margin |
| **`green-800`** | **`#166534`** | **7.13:1 — passes** |

These ratios were computed from the Tailwind **v3** palette hexes, and this project runs Tailwind
**4.3.3**, whose default palette was redefined in oklch with slightly more vivid greens. At 5.02:1 that
mattered and needed a measurement; at **7.13:1 the margin absorbs the difference** — a palette shift
large enough to drag `green-800` below 4.5:1 would be a different colour, not a refinement. So the
shade is settled here and there is nothing to check in a browser.

**Superseded**: the earlier version took `green-700` and carried an explicit "measure this, do not trust
the plan" task, because 5.02:1 left no room for the v3/v4 difference. Going one shade darker retires
both the task and the caveat.

A token pair would also only ever hold one value. Every other colour in `src/index.css` is defined
twice — once in `:root`, once in `.dark` — because the foreground it sits against flips, and that is
the whole reason those tokens exist. **Dark mode is not planned** (maintainer, 2026-08-23), and nothing
in the app applies the `dark` class: `src/index.css:6` defines `@custom-variant dark (&:is(.dark *))`
and line 86 defines the token block, but no component, route or entry point sets it, and neither does
`index.html`. The button is also its own background with its own white text, so white-on-green measures
the same regardless of what the page around it does.

## Decision 4: how the colour is applied

**Decision**: Three utility classes on the one button — `bg-green-800 text-white hover:bg-green-900` —
via the `className` prop. `src/components/ui/button.tsx` is not touched.

**Rationale**: One file changes instead of two, and no shared surface grows a variant for a single
caller. The `default` variant sets `bg-primary text-primary-foreground hover:bg-primary/80`;
`tailwind-merge` resolves each of those against its replacement, which is why the hover class has to be
supplied too rather than left to inherit.

**The mechanical detail that will bite**: `src/components/ui/button.tsx:8` ends with
`[&_svg:not([class*='size-'])]:size-4`. A lucide icon renders as an `<svg>`, so it is forced to 16px
unless it carries its own `size-*` class — the icons must be given an explicit size, or they render at
inline-icon scale instead of as the large central symbol FR-002 requires. The same base class already
sets `[&_svg]:pointer-events-none`, which is exactly what FR-005 wants: clicks land on the button,
never on the symbol.

**Alternative considered**: `--success` / `--success-foreground` tokens plus a `success` variant in
`src/components/ui/button.tsx`. The shadcn-idiomatic answer, and the right one the moment a second
thing in this app needs to be green. Today it is an abstraction with exactly one use and one value,
which Principle VI says is not yet earned. Rejected for now; recorded as the upgrade path.

## Decision 5: what the dependency costs

**Decision**: Add `lucide-react` as a runtime dependency, importing the two icons by name.

**The Principle V justification**, owed in the PR:

- **What it does**: supplies the two symbols this feature renders.
- **What it replaces**: two hand-drawn inline SVG paths and a text glyph.
- **Why hand-rolling is worse**: the question mark is the reason. Drawing a `?` as a stroked path means
  redrawing a letterform by hand, and matching it optically to a hand-drawn tick is exactly the kind of
  eyeball calibration that never gets revisited. lucide's two icons are dimensionally identical by
  construction. Buying that for one sanctioned dependency is the better trade.

**The Principle VIII record**, also owed in the PR: `lucide-react@1.33.0`, **ISC** (pre-cleared),
actively maintained with very wide adoption, stable release channel — not alpha, beta, RC, canary or
`0.0.x`. The icons are the package's own artwork under the same ISC licence, so the separate
asset-review rule is discharged by the same line.

**Tree-shaking**: named imports from `lucide-react` resolve to per-icon modules
(`dist/esm/icons/circle-check.mjs`), so Vite's production build pulls the two icons rather than the
whole set of ~1,600.

## Not researched, deliberately

- **Animation.** Not asked for.
- **An icon wrapper component.** Two named imports used once each.
