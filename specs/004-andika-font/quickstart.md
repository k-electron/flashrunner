# Quickstart: validating the Andika font swap

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Contract**:
[contracts/typography.md](./contracts/typography.md)

**This document is the gate, not a formality.** Every other feature in this project could lean on CI.
This one cannot: a font that fails to load produces a fully green `lint → typecheck → test → build` and
renders the app in the wrong typeface with no error anywhere. `jsdom` cannot see it either. **A human
looking at a letter is the only check that catches it.**

Steps 1, 2 and 6 would catch a broken implementation. Step 3 closes the one thing the plan estimated
rather than measured. Ten minutes.

## Prerequisites

```bash
npm ci          # node_modules is not committed; nothing below runs without this
npm run dev     # http://localhost:5173
```

**Two useful facts about the run screen.** Card order is shuffled per cycle (feature 002), so you
cannot navigate to a specific word — mark **"Not yet"** repeatedly instead, which keeps every card in
rotation until you have seen the whole rung. And a run resumes where it left off, so use "Start over"
or clear `localStorage` for the origin to start clean.

---

## Step 1 — Look at the letter (FR-002, FR-003, SC-001)

**This is the feature.** Everything else supports it.

Open <http://localhost:5173/deck/dolch-prek-5/rung/r8> and mark "Not yet" until you have seen
**`and`**, **`a`**, **`go`** and **`big`**.

**Expected**: the `a` is a round bowl with a plain vertical stem on its right — no hook curving over
the top. The `g` is a single bowl with an open tail below the baseline — no closed lower loop.

**If the `a` has a hook over the top**, the font is not applied and you are looking at the fallback.
Check the Network tab for a 404 on a `.woff2` and the computed `font-family` on the card element. This
is the silent-failure path.

## Step 2 — Confirm what actually loaded (FR-006, FR-007, FR-008, FR-011)

DevTools → Network → filter **Font**, then hard-reload.

**Expected**, exactly:

- **Two** requests, both `andika-latin-*00-normal-<hash>.woff2`, roughly 20 kB each.
- Both from **this origin**. No request to `fonts.googleapis.com`, `fonts.gstatic.com`, or any other
  host.
- **Zero** requests for the outgoing font, and zero for the `cyrillic`, `cyrillic-ext`, `vietnamese` or
  `latin-ext` subsets — `unicode-range` should keep them unfetched.

Then inspect an element on the deck list, a deck ladder and a run, and read the computed
`font-family` — it must resolve to `Andika` on all three. FR-006 covers every screen, not just the
card.

## Step 3 — Nothing overlaps at the smallest viewport (FR-015, FR-016, SC-004)

**This closes the plan's one unverified number.** Andika's glyph box is 1.611em against the outgoing
font's 1.300em, so at the card's 72px the glyphs overhang their line box by roughly 22px above and
below rather than roughly 11px. The gap between elements is 32px, so it should still clear — but that
is arithmetic, not a measurement.

DevTools → device toolbar → **320 × 568**. Open a run.

**Expected**: the heading, card face, cycle counter, both outcome buttons, "Start over" and "Leave this
run" all visible with **no vertical scrolling**. Nothing touches or overlaps — in particular the card's
descenders (`g`, `y`, `p`) must not collide with the cycle counter beneath.

The [vertical budget](./plan.md#the-vertical-budget) says every block keeps its exact height, because
Tailwind sets `line-height` explicitly. If a total moved, that reasoning is wrong and worth
understanding before merging.

## Step 4 — The longest words (FR-014, SC-005)

The widest word in either deck was computed at **213.7px** against **272px** of available width on a
320px viewport — 21% headroom, with every long word narrower than today. Confirm the computation.

Still at **320 × 568**:

1. <http://localhost:5173/deck/dolch-prek-5/rung/r8> — mark "Not yet" until **`yellow`** appears.
2. <http://localhost:5173/deck/dolch-k-5/rung/r11> — mark "Not yet" until **`please`** and **`pretty`**
   appear.

**Expected**: each word sits fully inside the screen with clear margin. No clipping, no horizontal
scrollbar, no wrapping mid-word. Then widen past 640px, where the card jumps to `sm:text-8xl` (96px),
and confirm the same.

## Step 5 — Emphasis still reads as emphasis (FR-012, FR-013, SC-006)

Andika ships 400 and 700 only, so **six headings get heavier** (600 → 700) and **every button label
gets lighter** (500 → 400). Full inventory in
[the contract](./contracts/typography.md#weight-resolution--what-actually-renders).

Look at "FlashRunner" on the deck list, a deck title, "Run complete", and the "Got it" / "Not yet"
button labels.

**Expected**: headings still read clearly heavier than body text. Button labels are comfortably legible
— they are the one thing that got lighter, so they are where a problem would show. Nothing looks
smeared or artificially thickened, which is what synthesized bold looks like.

## Step 6 — Block the font entirely (FR-010, SC-003)

DevTools → Network → **Block request URL on both formats**, then reload. Blocking only the `.woff2`
is not enough: every Fontsource face declares two sources —
`src: url(...woff2) format('woff2'), url(...woff) format('woff')` — so the browser simply falls through
to the `.woff` and a font still loads. Confirmed in UAT: blocking the `.woff2` alone loaded the `.woff`
instead, which is correct behaviour and not what this step is testing. Block the domain pattern
`*andika*`, or block all four latin files.

**Expected**: the app renders in the fallback sans-serif and is **fully usable** — every screen
readable, every control working, no blank screen, no layout collapse. The letterforms are wrong, which
is the accepted degradation; being unusable would not be.

Unblock before continuing.

## Step 7 — The gate (Principle III)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

All four must pass — the same sequence CI runs. Then check the build output:

```bash
ls dist/assets/*.woff2                                # expect andika files, no geist
grep -ci "geist" dist/assets/*.css dist/index.html    # expect 0
```

**166 tests must pass with no test file edited.** If a test needed changing, something outside this
feature's scope changed — revert it rather than adapting the test.

## Step 8 — The preview deploy, on a real phone

The dev server is not where the small-viewport claim gets its honest test. Open the PR's Pages preview
on an actual phone and repeat **steps 1, 3 and 4**. Deep-link straight to
`/deck/dolch-k-5/rung/r11` to exercise the SPA fallback at the same time (Principle I).

---

## What "done" looks like

| Step | Proves | Requirement |
|---|---|---|
| 1 | The letterforms are the single-story ones | FR-002, FR-003, SC-001, SC-002 |
| 2 | Andika everywhere, two files, same origin, nothing stale | FR-006 – FR-008, FR-011, SC-007, SC-008 |
| 3 | Nothing overlaps and nothing scrolls | FR-015, FR-016, SC-004 |
| 4 | The widest words fit | FR-014, SC-005 |
| 5 | Emphasis survives, nothing is faked | FR-012, FR-013, SC-006 |
| 6 | The app degrades rather than breaks | FR-010, SC-003 |
| 7 | Green gate, no behavioural drift | FR-017, SC-009, Principle III |
| 8 | It holds on real hardware | FR-015, SC-005, Principle I |
