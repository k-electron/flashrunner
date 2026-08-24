# Contract: the app's typography

**Date**: 2026-08-23 | **Plan**: [plan.md](../plan.md) | **Spec**: [spec.md](../spec.md)

**Revised 2026-08-23** after maintainer direction: standard web-font loading, so the faces come from
the package's own stylesheets rather than being declared by hand.

This feature exposes no API and changes no component signature. What it changes is the rendered result
of every string in the app, so that is what this contract fixes.

## The declaration — unchanged in shape, retargeted in value

The app has exactly one font token, declared once and applied once. Both facts stay true:

```css
/* src/index.css */
@import "@fontsource/andika/400.css";
@import "@fontsource/andika/700.css";

@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: 'Andika', sans-serif;   /* the one line that retargets the app */
}

@layer base {
  html { @apply font-sans; }           /* the one place it is applied */
}
```

`--font-heading` is left alone: it already resolves through `--font-sans`, so it follows for free.

**No component declares a family, and none may start.** That is the property that makes this a
three-file change, and it is worth keeping.

Two weight files rather than the package's combined `index.css`: that file declares **weight 400
only**, so `font-semibold` would fall through to synthesized bold and violate FR-013. Each weight file
declares five subset faces carrying `unicode-range`, so a page fetches only the subset it needs — for
an English deck, two files at roughly 20 kB each. Twenty font files land in the build and two cross
the network; FR-007 is about the latter. `font-display: swap` is what the package ships and what the
platform does by default.

## What must be true of the rendered result

The requirement is a shape on a screen, so the contract is stated as one:

- The lowercase **`a` is single-story** — a closed bowl with a plain vertical stem, no upper hook
  (FR-002).
- The lowercase **`g` is single-bowl** — one closed bowl with an open descending tail, no lower loop
  (FR-003).
- **Accented forms keep those shapes**: `á`, `à`, `ä` carry the same bowl-and-stem `a` (FR-004).
- **No configuration produces this.** These are the font's default and only forms — `U+0061` maps to a
  glyph named `a.SngStory`, `U+0067` to `g.SngBowl`, and the files carry no double-story alternates.
  Nothing has to be switched on and nothing can switch it off (FR-005).
- **Every string in the app** renders in Andika, not only card faces (FR-006).
- **No second text font is downloaded** (FR-007).

## Weight resolution — what actually renders

Andika has no variable axis, so the app's requested weights resolve to the two real faces. This is the
full inventory, and it is the whole visible side effect of the feature:

| Requested | Where | Resolves to | Change |
|---|---|---|---|
| `font-semibold` (600) | `CardFace.tsx:7` — the card word | **700** | heavier |
| `font-semibold` (600) | `DeckList.tsx:20` — "FlashRunner" | **700** | heavier |
| `font-semibold` (600) | `DeckLadder.tsx:39` — deck title | **700** | heavier |
| `font-semibold` (600) | `DeckLadder.tsx:20` — "Deck not found" | **700** | heavier |
| `font-semibold` (600) | `Run.tsx:131` — "Run not found" | **700** | heavier |
| `font-semibold` (600) | `Run.tsx:200` — "Run complete" | **700** | heavier |
| `font-medium` (500) | `ui/button.tsx:8` — **every button label** | **400** | lighter |
| unset (400) | everything else | **400** | unchanged |

Per CSS Fonts Level 4: a desired weight above 500 checks available weights ascending, so 600 → 700; a
desired weight in [400, 500] checks that range first and then descends, so 500 → 400.

**Not a defect, and not to be "fixed" by editing the classes.** Six edits would produce identical
pixels, and `font-semibold` still means "heavier than body", which stays true. The obligations are
FR-012 (emphasis stays visible) and FR-013 (no synthesis) — both hold, since every requested weight
lands on a real face rather than a faked one.

## Degradation

- **Font still loading**: text paints in the browser's fallback and swaps when Andika arrives — the
  platform default, and accepted (FR-009).
- **Font never arrives**: the app stays fully usable with legible text in the fallback (FR-010).
  Correct letterforms are the goal; legibility is the floor.

## Explicitly not part of this contract

- **Any font size, weight class, spacing or line height in the app.** Not one changes. Andika's
  x-height is about 5% smaller than the outgoing font's, and the card is *not* enlarged to compensate —
  that is a redesign, and the spec's closing assumption rules it out.
- **`src/components/ui/button.tsx`** and every other component file. Untouched; `font-medium` stays as
  written.
- **`index.html`.** No change.
- **Deck content.** Not one word changes (FR-020).
- **Anything persisted.** No key, no field, no `schemaVersion`, no migration (FR-018).

## The assertions that hold this contract

**None are automated, and that is deliberate.** `jsdom` does not load fonts, do layout, or resolve a
family to a typeface, so no test there can tell these two letterforms apart — and the substitutes one
might reach for are all change-detectors. Reasoned out in
[research.md § What is not tested](../research.md#what-is-not-tested-and-why).

What holds it instead:

- **The existing 166 tests, unmodified**, guard FR-017 and FR-020. They query by role and visible text,
  so they pass if behaviour and wording are intact and fail if either is not. If a test file needs
  editing, the change went out of scope.
- **[quickstart.md](../quickstart.md) is the real gate**, because the failure mode here has no symptom
  anywhere else: a font that does not load produces a green `lint → typecheck → test → build` and the
  wrong typeface on screen. Step 1 is looking at the `a`.
