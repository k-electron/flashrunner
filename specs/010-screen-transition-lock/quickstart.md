# Quickstart: Screen Transition Lock

Feature: [spec.md](./spec.md) · Contract:
[contracts/screen-lock.md](./contracts/screen-lock.md)

How to prove the lock works. § 1 and § 2 run in CI. § 3 needs a real browser,
because jsdom enforces neither `inert` nor hit-testing
([research](./research.md) Decision 2) — it is not optional polish, it is the only
place `inert` itself is ever checked.

## Prerequisites

```bash
nvm use              # 26.7.0, from .nvmrc
npm ci
```

## 1. The suite

```bash
npm test
```

Expected: green. The lock's own tests live in `src/routes/Run.test.tsx` and read the
durations from `src/run/advance.ts` rather than restating them, so retuning the
motion does not touch a single assertion.

New and rewritten cases to look for by name:

| Case | Proves |
|---|---|
| a second outcome press inside the window marks one card | FR-001, FR-004 |
| a held key that auto-repeats marks one card | FR-004 — the case a pointer-only lock misses |
| "Start over" pressed mid-transition does nothing | FR-001, replaces 009's FR-012 test |
| "Leave this run" activated mid-transition does not navigate | FR-001 |
| the pronounce control mid-transition neither speaks nor sets `heard` | FR-001, FR-004 |
| "Repeat this run" pressed while the completion screen arrives does nothing | FR-017, replaces 009's FR-009 test |
| the first card of a fresh run is locked until its entry ends | FR-020, replaces 009's FR-010 test |
| a resumed run is locked until its entry ends, then accepts a press | FR-015, FR-020 |
| an unguarded probe control inside the wrapper does not fire mid-transition | FR-002 — the whole point |
| still locked at exactly `CARD_EXIT_MS` | FR-011a contiguity |
| both durations stubbed to 0: one press, one card, live afterwards | FR-012 |
| a "Start over" landing mid-exit replaces the transition and releases once | FR-010, FR-013 |
| unmounting mid-transition leaves no timer to fire | FR-010 |

FR-009 needs no test that fires an animation event, because the suite never fires
one: a release wired to `onAnimationEnd` would simply never arrive, and every case
above would fail on a screen that stayed locked.

## 2. Gates

```bash
npm run lint
npm run typecheck
npm run build
```

`typecheck` is where the deleted `guarded` prop is caught: removing it from
`PronounceButton` fails the build at any call site still passing it.

## 3. A real browser — the `inert` check

Nothing in § 1 can see `inert`. This is where it gets seen.

```bash
npm run dev          # leaves the app on http://localhost:5173
```

Playwright is already on this machine (1.62.1, chromium-1234) and is driven from a
scratch directory. It is deliberately **not** added to `package.json`: Principle VII
holds host prerequisites to git and Node, and Principle V keeps the dependency
surface minimal. A throwaway script is enough:

```js
// run with: node lock-check.mjs   (from a scratch dir, not the repo)
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto('http://localhost:5173/deck/dolch-prek-5/rung/r1');

const wrapper = page.locator('main').locator('..');
const gotIt = page.getByRole('button', { name: 'Got it' });
const leave = page.getByRole('link', { name: 'Leave this run' });

// Entry on arrival: locked before the first card has settled (FR-020).
console.log('inert on arrival:', await wrapper.getAttribute('inert') !== null);
await gotIt.waitFor();

// Mark, then attempt everything while the motion runs.
await gotIt.click();
console.log('inert mid-transition:', await wrapper.getAttribute('inert') !== null);
// force:true bypasses Playwright's own actionability checks, so this is a genuine
// attempt at the element rather than a skipped one.
await gotIt.click({ force: true, timeout: 1000 }).catch(() => {});
await leave.click({ force: true, timeout: 1000 }).catch(() => {});
console.log('still on the run screen:', page.url().includes('/rung/'));

// SC-003, both bounds. Wall-clock, so a fake timer cannot stand in for this.
const pressedAt = Date.now();
await page.waitForFunction(
  () => !document.querySelector('main').parentElement.hasAttribute('inert'),
  { timeout: 2000 },
);
const released = Date.now() - pressedAt;
console.log('released after (ms):', released, '— budget 320+100, hard cap 1000');

console.log('inert after settling:', await wrapper.getAttribute('inert') !== null);
console.log('progress:', await page.getByText(/of 5 cards/).first().textContent());

// SC-005 at its stated magnitude: 100 advances, every one ending live. Ten by hand
// (check 10 below) is a spot check; this is the figure the criterion names.
let stuck = 0;
for (let i = 0; i < 100; i += 1) {
  const button = page.getByRole('button', { name: /Got it|Repeat this run/ }).first();
  await button.click();
  await page
    .waitForFunction(
      () => !document.querySelector('main').parentElement.hasAttribute('inert'),
      { timeout: 1000 },
    )
    .catch(() => { stuck += 1; });
}
console.log('stuck screens over 100 advances:', stuck);

await browser.close();
```

Expected:

```
inert on arrival: true
inert mid-transition: true
still on the run screen: true
released after (ms): 3xx — budget 320+100, hard cap 1000
inert after settling: false
progress: 1 of 5 cards        # one press, one card
stuck screens over 100 advances: 0
```

A `released after` above 420ms is worth a second look; above 1000ms is an SC-003
failure. `stuck screens` must be `0` — that line is SC-005.

Then, by hand in the same browser:

| # | Do this | Expect |
|---|---|---|
| 1 | Press "Got it" and immediately hammer both outcome buttons | one card advances; the bars move once |
| 2 | Press "Got it", then jab "Start over" during the motion | the run does not restart |
| 3 | Press "Got it", then tap "Leave this run" during the motion | you stay in the run |
| 4 | Press "Got it", then the speaker during the motion | silence; no pulse on the icon |
| 5 | Watch the buttons through a transition | they dim and recover; never greyed, never a spinner |
| 6 | Clear the last card, then hammer "Repeat this run" as the screen arrives | nothing until it settles, then one restart |
| 7 | Reload onto a resumed run and press "Got it" the instant it appears | the press is refused; a press after it settles marks |
| 8 | Focus "Got it" and hold Enter | one card advances |
| 9 | Mid-transition, press the browser's back button | it works — the lock never covers browser chrome |
| 10 | Throttle to 6× CPU in devtools and hammer through ten cards | ten advances, no stuck screen — a spot check by hand; the scripted 100-advance loop above is SC-005 proper |
| 11 | Mark a card, switch tabs for 10s, come back | the screen is live, not locked |

Check 11 is the throttled-timer path from the spec's edge cases and the one worth
doing slowly: a late release is acceptable, a lost one is not.

## 4. Not run

Screen-reader verification is **not** part of this feature's sign-off, by the
maintainer's standing decision. For the record, `inert` removes its subtree from the
accessibility tree, so a VoiceOver user loses the card, the bars, and the heading for
the ~320ms a transition lasts ([research](./research.md) Decision 8). If it is ever
checked: VO-Command-A to read continuously, mark a card mid-read, and observe the
gap. Recorded here as **not run**.

Reduced-motion behaviour is likewise out of scope: no `prefers-reduced-motion`
branch is added, and FR-012 covers the case where the durations are simply set to
zero.
