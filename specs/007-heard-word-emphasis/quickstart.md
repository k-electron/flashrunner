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

The five new assertions live in the `describe` block that stubs `window.speechSynthesis` — the only
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

**Step 1 — the default presentation.** Before touching anything: "Got it" is green, "Not yet" is
light grey. Unchanged from today.

**Step 2 — the swap, and whether it reads.** Press the speaker button. "Not yet" should turn
near-black — the same fill as "Resume" on the deck ladder and "Next run" on the run-complete screen
— and "Got it" should turn the light grey "Not yet" just gave up. The thing to judge, and the one
claim the plan does **not** assert anywhere: does the screen now read as recommending "Not yet"?
If both buttons read as equally weighted, or the grey "Got it" reads as disabled rather than plain,
the feature has not landed even with every test green.

Compare against the ladder in a second tab if the black needs confirming; it is `bg-primary` in both
places, so they must match exactly.

**Step 3 — nothing was pressed.** After step 2, the same word is still on the card, no card has
advanced, and both buttons still respond to a press. Hover each one: the green's hover is gone with
the green, and each button hovers as whatever it now is.

**Step 4 — the reset, all four ways.** This is FR-007, and it is the part worth doing by hand even
though tests cover it:

1. Press the speaker, then mark "Got it". The next card shows green / grey again.
2. Press the speaker, then mark "Not yet", and keep going until that card comes back around in the
   next cycle. It shows green / grey again.
3. Press the speaker, then press "Start over". The card that comes up shows green / grey again.
4. Press the speaker, then "Leave this run", then "Resume" from the ladder. The resumed card shows
   green / grey again — and nothing in `localStorage` mentions it. Check in DevTools → Application →
   Local Storage: the `flashrunner:` record must be byte-identical to what it was before the press.

**Step 5 — repeat presses.** Press the speaker three times in a row while the word is speaking. The
buttons stay swapped and do not flicker back.

**Step 6 — no speech available.** In DevTools, before loading the run screen:

```js
Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
```

Reload the run. The speaker button is gone and the outcomes stay green / grey for the whole run —
there is nothing to press, so there is nothing to swap.

## What is deliberately not checked

- **Screen-reader behaviour.** Nothing is announced differently by design (FR-003), and the
  maintainer has waived VoiceOver passes on this project. If it were run, the check would be: press
  the speaker, then move through both buttons and confirm they still announce as
  "Got it, button" and "Not yet, button" with nothing added. **Not run.**
- **Dark mode.** Not applied anywhere in this app (established in 003 and unchanged). Both
  treatments have dormant `.dark` token values in `src/index.css`; neither is exercised.
