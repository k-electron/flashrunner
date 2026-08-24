# Quickstart: validating Outcome Button Icons

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This is a presentational change, so most of it is only provable in a browser. The automated gate's
job here is to prove nothing *behavioural* moved.

## Prerequisites

Node 26.7.0 (`.nvmrc`), a clean install, and the one new dependency:

```sh
npm ci
npm install lucide-react
```

`npm install` (not `npm ci`) for the second line, since it has to write `package.json` and
`package-lock.json`. Commit both — Principle III requires a clean-checkout `npm ci` to succeed.

## Gate

```sh
npm run lint && npm run typecheck && npm test && npm run build
```

The same sequence CI runs. All four pass before the PR opens.

## What the automated tests prove

| Criterion | Asserted in | Shape of the assertion |
|---|---|---|
| SC-004 one announcement per button, no symbol name | `src/routes/Run.test.tsx` | The ~20 existing `getByRole('button', { name: 'Got it' })` / `{ name: 'Not yet' }` queries. A string `name` matches the full accessible name, so a leaked symbol breaks them. |
| SC-007 marking, cycles, resume, completion, mastery unchanged | `src/routes/Run.test.tsx`, `src/run/reducer.test.ts` | The whole existing suite, unmodified. This change must not require editing a single behavioural test. |
| FR-014 wording still rendered as visible text | `src/routes/Run.test.tsx` | One new assertion: `getByText('Got it')` and `getByText('Not yet')` resolve inside their buttons. |
| FR-023 nothing persisted changes | existing suite | `src/storage/` tests untouched and passing. |

**If a behavioural test needs changing to make this pass, stop.** Nothing in this feature touches the
engine, storage or the run loop; a failing engine test means something outside the spec was edited.

## What only a browser proves

```sh
npm run dev
```

Then open `http://localhost:5173/deck/dolch-prek-5/rung/r1` — a five-card rung, the shortest run in
the app.

1. **Layout (SC-002, FR-001 to FR-004).** Both buttons show a large centred symbol with smaller
   wording underneath. Cover the wording with a finger: the tick and the question mark alone still
   say which is which.
2. **Contrast (SC-003, FR-012).** Eyeball it: white on `green-800` should read cleanly. No measurement
   step — `green-800` is 7.13:1 against white, and the margin over the required 4.5:1 is wide enough
   to absorb the Tailwind v3/v4 palette difference.
3. **Small viewport (SC-005).** Devtools device toolbar at **320 × 568**. The heading, card, counter,
   both buttons, "Start over" and "Leave this run" are all visible with **no scrolling**, and neither
   label clips or wraps into its symbol.
4. **Tap target (SC-006).** Inspect each button and read its height. It must be **≥ 64px**, today's
   `h-16`. Smaller is a regression even if it looks fine.
5. **Large text.** Browser zoom to 200%. The wording stays inside its button; the symbol stays
   visible.
6. **Icon size.** Both icons are the large central symbol, not 16px. If either looks like an inline
   icon, it is missing its `size-*` class — `src/components/ui/button.tsx:8` forces unsized SVGs to
   `size-4`.
7. **Behaviour by hand.** Press the tick on three cards and the question mark on two. The two come
   back in a second round; the run completes after they are cleared. Reload mid-run: it resumes on
   the same card.

## Screen reader spot check

macOS VoiceOver (`Cmd-F5`), tab to each button. Each is announced once, as "Got it, button" and
"Not yet, button". Not "check mark", not "Got it check mark", not two elements.

## Preview deploy

Per the constitution's workflow gates, the PR's Pages preview is where this gets its final look — a
real phone on the preview URL is the only honest check of item 3.
