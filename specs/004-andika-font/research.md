# Research: Andika Font

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Revised 2026-08-23** after maintainer direction: use the standard web-font pattern rather than
blocking text to avoid the swap. This app runs on modern connections. Decisions 2, 3 and 7 of the
first pass — a hand-written `@font-face`, `font-display: block`, and a preload analysis — are gone,
along with FR-009's original wording. What follows is what the change actually needs.

## Decision 1: how the font is delivered

**Decision**: `@fontsource/andika@5.3.0`, imported the way the repo already imports a font.

```css
/* src/index.css — replaces the one @import it sits on */
@import "@fontsource/andika/400.css";
@import "@fontsource/andika/700.css";
```

**Rationale**: this is the pattern in front of us. The outgoing font is one `@import` of a Fontsource
package; so is this. Each weight file declares five subset faces carrying `unicode-range`, exactly
like the file it replaces, so the browser downloads only the subset a page actually needs — two files,
~40 kB, on an English deck. `font-display: swap` is what the package ships and what the platform
does by default: text paints immediately in the fallback and swaps when Andika lands.

Weight-specific imports rather than the package's combined `index.css` for a MUST-level reason: that
file declares **weight 400 only**, with no 700 face in it, so `font-semibold` would fall through to
*synthesized* bold and violate FR-013. Two imports instead of one, and the bold is real.

**Alternatives considered**: Google Fonts CDN — rejected, a third-party request from a children's app
on every first load, and FR-011 forbids it. Vendoring the `.woff2` files into the repo — works, but
gives up lockfile pinning and means hand-carrying the OFL text.

## Decision 2: two weights, and the utility classes stay as written

**Decision**: import 400 and 700. Do not touch a single `font-*` class.

Andika has **no variable axis** — there is no `@fontsource-variable/andika`, and the static files
report `usWeightClass` 400 and 700. The outgoing font is variable across 100–900, so the app has been
free to ask for anything. It asks for two things, and CSS Fonts Level 4 weight matching resolves both
without ambiguity:

| Requested | Where | Renders as |
|---|---|---|
| `font-semibold` (600) | the card word, plus five headings | **700** — heavier than today |
| `font-medium` (500) | `ui/button.tsx:8`, so every button label | **400** — lighter than today |

600 is above 500, so available weights are checked ascending → 700. 500 is in [400, 500], so that
range is checked first (nothing there) and then descending → 400.

That is the whole visible side effect of the feature. FR-012 keeps emphasis visible and FR-013 forbids
faking it; both hold, because every requested weight lands on a real declared face. **No
`font-synthesis: none`** is added — a face always matches; synthesis kicks in when the face the
matching algorithm *lands on* is not bold or italic enough to satisfy the request. Here it always is:
`font-semibold` resolves to the real 700 face rather than being faked up from 400, and nothing renders
italic. So the property would guard a class nobody has written.

**Alternative considered**: rewriting the six `font-semibold` occurrences to `font-bold` so the
stylesheet says what renders. Rejected — six edits, identical pixels.

## Decision 3: nothing to configure for the letterforms

**Decision**: set the family and stop.

Read out of the published font files rather than recalled: `U+0061` maps to a glyph named
**`a.SngStory`** and `U+0067` to **`g.SngBowl`**, in both the 400 and 700 weights. Accented forms map
to `aacute.SngStory` and siblings. The files contain **no double-story alternates at all**, and GSUB
exposes only `ccmp` and `liga`.

So the single-story shapes are the default *and* the only option. FR-005 ("no configuration MUST be
required") costs nothing, and no later edit can silently switch the shapes off. There is no
`font-feature-settings` line to write and no character-variant feature to enable — which is worth
knowing, because with many literacy fonts there would be.

## Decision 4: sizing and spacing stay exactly as they are

**Decision**: change nothing. The two things that could have forced a change do not.

**No word gets wider.** Advance widths summed from `hmtx` at the card's 72px with `tracking-tight`,
comparing the outgoing font at wght 600 against Andika at 700 — the weights that actually render.
Every long word in both decks comes out narrower except "little", which grows 2.6px. The widest word
in either deck is **"please" at 213.7px**, against **272px** of content width on a 320px viewport.
21% headroom, so FR-014 and SC-005 hold untouched.

**No block gets taller.** Andika's glyph box is 1.611em against the outgoing font's 1.300em, which
sounds like it should push the run screen past a phone viewport. It cannot: Tailwind sets an explicit
`line-height` on every `text-*` utility, and the card face adds `leading-none`. A line box's height is
its `line-height`; font metrics do not enter into it. The
[vertical budget](./plan.md#the-vertical-budget) is unchanged, row for row.

What the taller glyph box does change is overhang *outside* the line box — roughly 22px above and
below at 72px, against roughly 11px today, into a 32px `gap-8`. That still clears, and it is the one
claim here that is arithmetic rather than a measurement. [quickstart.md](./quickstart.md) looks at it.

**Declined**: enlarging the card to offset Andika's slightly smaller x-height (0.508em against
0.534em, so lowercase reads about 5% shorter). That is a redesign, and the spec's closing assumption
draws exactly that line.

## What is not tested, and why

**No test is added, and no existing test changes.**

The suite runs in `jsdom`, which does not load fonts, do layout, or resolve `font-family` to a
typeface. No assertion available there can tell a single-story `a` from a double-story one. The
substitutes are all things Principle IV rules out: asserting `--font-sans` contains `"Andika"` is a
change-detector that restates the diff; asserting a computed `font-family` in `jsdom` is the same
assertion in costume, since `jsdom` echoes the declared string back without loading anything; a
stylesheet snapshot is banned outright.

The existing 166 tests are the regression guard for FR-017 and FR-020 — they query by role and visible
text, so they pass unchanged if behaviour and wording are intact and fail if either is not. **No test
file should need editing.** Everything else is a browser check, which is what
[quickstart.md](./quickstart.md) is for.
