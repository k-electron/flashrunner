# Quickstart: validating the pronounce button

**Date**: 2026-08-24 | **Plan**: [plan.md](./plan.md) | **Contract**:
[contracts/pronunciation.md](./contracts/pronunciation.md)

**This document is the gate for one specific thing: whether sound comes out.** Everything else about
this feature is covered by the test suite. Nothing in CI, and nothing in `jsdom`, can hear — a
button that speaks silently passes `lint → typecheck → test → build` and passes every test written
for it. **Step 1 is the only check that catches that**, and it needs a human with the volume up.

Ten minutes, and step 6 wants a phone.

## Prerequisites

```bash
npm ci
npm run dev     # http://localhost:5173
```

**Turn the volume up before you start.** A silent step 1 is ambiguous otherwise.

**Two facts about the run screen.** Card order is shuffled per cycle, so you cannot navigate to a
specific word — mark **"Not yet"** to keep everything in rotation. And runs resume, so use "Start
over" or clear `localStorage` for the origin to begin clean.

---

## Step 1 — It speaks, and it sounds right (FR-001, FR-003, FR-004, SC-001, SC-002)

**This is the feature.** Everything else supports it.

Open <http://localhost:5173/deck/dolch-prek-5/rung/r1> and press the speaker button above
"Not yet".

**Expected**: the word on the card is spoken aloud, promptly, in an American English accent, in a
voice that sounds female.

- **Nothing at all?** Check the device volume first, then the console. On macOS the browser's
  default en-US voice is normally Samantha.
- **A singing bell, a robot, or a whisper?** That is a novelty voice, which the fallback exists to
  rule out — a real bug worth reporting, not a device quirk.
- **A male voice?** Not a failure in itself: the device may have no female en-US voice, and FR-004
  accepts any American English voice over silence. Note which voice you got.
- **A British or Australian accent?** The device has no American English voice at all. Note it.

## Step 2 — It says the word that is on screen (FR-005)

Press the speaker, listen, then mark "Not yet" so a different word appears, and press again.

**Expected**: each time, the word spoken is the one currently on the card. The previous word is
never repeated.

## Step 3 — Pressing repeatedly does not stack up (FR-007, FR-008, SC-003)

**This is the explicit request, and it is the thing most likely to be got wrong.**

Press the speaker button **five times as fast as you can**.

**Expected**: the word is spoken **once**. Not five times, and not once followed by four more once
it finishes — nothing is held back. Then wait for it to finish and press once more: it speaks again.

While it is speaking, watch the button: a small movement on the icon, nothing more. It must not
grey out, dim, flash, or pull your eye away from the card.

## Step 4 — Marking a card silences it (FR-006, FR-009, FR-017, SC-005)

Press the speaker, and **while the word is still being spoken**, press "Got it".

**Expected**: the speaking stops immediately and the run advances as normal. The old word does not
keep talking over the new card.

Repeat with "Not yet", with "Start over", and with "Leave this run". Each one silences it.

Then confirm the button changed nothing about the run: press the speaker several times on one card
without marking it, and check the card has not advanced, the "cards left in this round" count has
not moved, and reloading the page resumes on the same card.

## Step 5 — The run-complete screen has no speaker (FR-010)

Finish a run — <http://localhost:5173/deck/dolch-prek-5/rung/r1> is five words — by marking every
card "Got it".

**Expected**: "Run complete" appears with no speaker button anywhere on it.

## Step 6 — Small viewport, and a real phone (FR-002, FR-014, SC-007)

DevTools → device toolbar → **320 × 568**, then open a run.

**Expected**: the speaker button sits directly above "Not yet" and lines up with it. The space above
"Got it" is empty. Everything — heading, card, counter, speaker, both outcome buttons, "Start over"
and "Leave this run" — is visible with **no vertical scrolling** and nothing overlapping. The
arithmetic says 476px of content in 568px; if anything scrolls, that reasoning is wrong.

Then open the PR's preview deploy **on an actual phone** and repeat **steps 1, 3 and 6**. iOS is
where speech behaves least like the desktop, and it is where the app is actually used.

## Step 7 — With no voice, nothing is lost (FR-011, US3, SC-006)

In the DevTools console, before the run screen renders:

```js
delete window.speechSynthesis;
```

**Check that it took** — `'speechSynthesis' in window` must now be `false`. `delete` returns `false`
instead of removing it if the browser defines the property as non-configurable, and a step that fails
because the setup silently did not take is worse than no step at all. If it is still there:

```js
Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
```

Then navigate to a run (client-side, so the page does not reload).

**Expected**: no speaker button, and every other part of the run screen works exactly as it always
has — cards, marking, cycling, "Start over", "Leave this run". **No error, no gap in the layout, no
blank screen.**

## Step 8 — The gate (Principle III)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

All four must pass — the same sequence CI runs.

**The existing 166 tests must pass with no test file edited.** `jsdom` has no Web Speech API, so
those tests run down the "no speech available" path and their staying green is the proof of FR-011.
If one needed changing, something outside this feature's scope changed — revert it rather than
adapting the test.

---

## What "done" looks like

| Step | Proves | Requirement |
|---|---|---|
| 1 | It speaks, in American English, in a female voice | FR-001, FR-003, FR-004, SC-001, SC-002 |
| 2 | It speaks the current word | FR-005 |
| 3 | Presses do not queue, and the animation stays subtle | FR-007, FR-008, FR-013a, SC-003 |
| 4 | Moving on silences it; the run is untouched | FR-006, FR-009, FR-017, SC-005 |
| 5 | No button where there is no word | FR-010 |
| 6 | Correct position, and it still fits a phone | FR-002, FR-014, SC-007 |
| 7 | No speech costs nothing else | FR-011, SC-006 |
| 8 | Green gate, no behavioural drift | SC-008, Principle III |
