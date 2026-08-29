# Quickstart: Heard-Word Button Emphasis

**Feature**: `007-heard-word-emphasis` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run this feature and prove it works. The automated checks cover the reset — the only way this
can fail silently. The browser check covers the colours, which no jsdom test can see and which are
the whole point of the feature.

## Prerequisites

```bash
node --version    # must match .nvmrc — 26.7.0
npm ci            # from the committed lockfile
```

Nothing else. No package is added by this feature, so both of these should be no-ops on an
up-to-date checkout.

## Setup

None. No component to add, no dependency to install. Confirm that stays true:

```bash
git diff --stat package.json package-lock.json    # MUST be empty
git diff --stat src/components/ui/                # MUST be empty
git diff --stat src/index.css src/run/ src/storage/   # MUST be empty
```

## Automated checks

The full gate, in the order CI runs it:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Targeted run while working:

```bash
npx vitest run src/routes/Run.test.tsx
```

The six new assertions live in the `describe` block that stubs `window.speechSynthesis` — the only
block where the speaker button exists, since jsdom has no Web Speech API. They are listed in
[contracts/outcome-emphasis.md § The assertions that hold this contract](./contracts/outcome-emphasis.md#the-assertions-that-hold-this-contract).

Two things to watch for in the output:

- Every existing `getByRole('button', { name: 'Got it' })` / `{ name: 'Not yet' }` query must still
  pass untouched. If any of them broke, an accessible name changed, which FR-003 forbids.
- The `Run — where nothing can speak (US3)` block must still pass. It runs with no stub, so it is
  the standing proof that a device without speech never reaches the swap.

## Browser checks

The colours and the guidance they convey are visual, so they are checked by looking.

```bash
npm run dev
```

Open a run: home → a deck → a rung → the run screen.

**Recorded 2026-08-29** against `npm run dev` (Vite 8.2.2) at 420×900, driven with Playwright
1.62.1 headless Chromium. Every reading below is a settled `getComputedStyle` value — the base
`Button` carries `transition-all`, so a colour sampled immediately after a click comes back as an
interpolated `oklab(…)` and means nothing. The pointer was parked away from all controls before
reading, so nothing is a hover state.

**Step 1 — the default presentation.** ✅ As before. "Got it" `oklch(0.448 0.119 151.328)`
(`bg-green-800`) with white text; "Not yet" `oklch(0.97 0 0)` (`--secondary`) with
`oklch(0.205 0 0)` text.

**Step 2 — the swap, and whether it reads.** ✅ After one press: "Not yet" becomes
`oklch(0.205 0 0)`, "Got it" becomes `oklch(0.97 0 0)` — exactly the fill "Not yet" gave up.

The two judgements the tests cannot make:

- **Does the black match `bg-primary` elsewhere?** ✅ Yes, exactly. All of these read
  `oklch(0.205 0 0)`: the heard "Not yet", "Resume" and the rung buttons on the deck ladder, and
  "Next run" on the run-complete screen. One value, no near-miss.
- **Does the grey "Got it" read as plain, or as disabled?** ✅ **Plain.** Its text and icon stay
  at full contrast (`oklch(0.205 0 0)` on `oklch(0.97 0 0)`) and `opacity` is `1` — nothing is
  dimmed. It is the identical treatment "Not yet" wears in step 1, where no one has read it as
  disabled. No darker grey is needed and none was substituted.

**Step 3 — nothing was pressed.** ✅ Same word on the card, both buttons `178x96` at the same x
before and after, same accessible names, `disabled` false on both, and no `aria-disabled` or
`aria-pressed` on either. Focus stays on the speaker button.

**Step 4 — the reset, all four ways.** ✅ All four, plus the whole of the following cycle:

1. Hear, then "Got it" → the next card is `default` / `secondary`.
2. Hear, then "Not yet", then walked every remaining card of the cycle → `default` / `secondary`
   at each one, including the re-queued card.
3. Hear, then "Start over" → `default` / `secondary`.
4. Hear, then "Leave this run", then "Resume" → `default` / `secondary`, and `localStorage` is
   byte-identical across press → leave → resume. The stored record is
   `{"schemaVersion":1,"completedRungIds":[],"run":{…}}` with no mention of the flag (FR-008).

**Step 5 — repeat presses.** ✅ Three presses in a row while the word is speaking leave
`{ Got it: secondary, Not yet: default }` — no flicker back.

**Step 6 — no speech available.** ✅ Speaker gone, outcomes green / grey for the whole run.

Note the recipe in an earlier draft of this file was wrong and should not be reused:

```js
// WRONG — leaves the key present, so `'speechSynthesis' in window` stays true
// and the button is still rendered.
Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
```

`PronounceButton` guards on `'speechSynthesis' in window`, so the API has to be *absent*, not
undefined. Use a pre-navigation script:

```js
delete window.speechSynthesis;
delete window.SpeechSynthesisUtterance;
```

## UAT on the Pages preview

Per constitution Principle I, the visual and viewport behaviour is signed off on a preview deploy,
not on the dev server.

**Preview**: <https://007-heard-word-emphasis.flashrunner.pages.dev> (PR #207), confirmed to be this
branch's build rather than main's — the bundle carries this branch's split `bg-green-800 text-white
hover:bg-green-900` literal, which main's combined `bg-green-800 text-xl text-white` is not. The
first response after pushing was still the branch's earlier docs-only deploy, whose source is
identical to main; that is the trap to watch for on the next feature.

**Signed off by the maintainer, 2026-08-29.** All sixteen checks pass. The two that no test can
make and that are the actual deliverable:

- **Does the screen now recommend "Not yet"?** — *"yes"*.
- **Does the grey "Got it" read as plain rather than disabled?** — *"its fine"*. No darker grey
  needed, and none was substituted.

Also confirmed by eye rather than by measurement: the black matches "Resume" on the ladder, the
speaker button is unchanged, and nothing overlaps or scrolls sideways in landscape or on a tablet.

The one check the maintainer did not run by hand is the DevTools `localStorage` inspection
(FR-008). It is covered twice over automatically: by the assertion that the stored record is
untouched by a press, and by the Playwright run above finding `localStorage` byte-identical across
press → leave → resume.

## What is deliberately not checked

- **Screen-reader behaviour.** Nothing is announced differently by design (FR-003), and the
  maintainer has waived VoiceOver passes on this project. If it were run, the check would be: press
  the speaker, then move through both buttons and confirm they still announce as
  "Got it, button" and "Not yet, button" with nothing added. **Not run.**
- **Dark mode.** Not applied anywhere in this app (established in 003 and unchanged). Both
  treatments have dormant `.dark` token values in `src/index.css`; neither is exercised.
