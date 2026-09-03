# AGENTS.md

Notes for an AI agent working in this repo. Human-facing setup lives in
[CONTRIBUTING.md](CONTRIBUTING.md); this file covers the same ground, plus the traps that have
cost time here.

## Read before editing

1. **[`.specify/memory/constitution.md`](.specify/memory/constitution.md)** contains eight principles,
   all non-negotiable. A change violating a MUST is wrong regardless of how well it works.
2. **The nearest directory under [`specs/`](specs/)**. Every feature has one, holding the spec,
   plan, design decisions, and a record of what was verified and how. When code looks arbitrary,
   the reason is almost always written down there. Check before assuming it's an accident.

## The gate

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Run it before claiming done. `lint` includes formatting. One pre-existing oxlint warning about
fast refresh in `src/components/ui/button.tsx` is expected; everything else should be silent.

## Layout

```
src/
├── decks/        deck data + pure rules (ladder unlocking, validation)
├── run/          the run state machine (pure: no React, no I/O)
├── storage/      the only place localStorage is touched
├── components/   presentational; ui/ is vendored shadcn
├── routes/       the three screens
└── app/          the router
```

`src/run/` and `src/decks/` **decide**; `src/routes/` and `src/components/` **display**. Keep the
engine pure: no React imports, no storage calls, no `Date.now()`. It is why the mechanic is cheap to test,
and it is easy to break without noticing.

All persistence goes through `src/storage/`. A direct `localStorage.getItem` elsewhere is a review
failure.

## Rules that get work rejected

- **Build only what was asked.** No adjacent features, no options, no settings, no abstraction
  "for later". If something adjacent seems necessary, say so and ask. Don't build it and explain
  afterwards. Abstraction is earned by a second real use case, not predicted from the first.
- **Bug fixes lead with a failing test.** Write it, _observe it fail_ against the unfixed code,
  then fix. Report the actual failure message.
- **Tests assert behaviour.** Role, label, visible text. No class names, `data-*`, snapshots, or
  internals. If a test only breaks on a rename, it's testing the wrong thing.
- **Comments explain why.** Never restate the code. The existing comments are dense with
  rationale, so match that rather than diluting it.
- **No new dependency** without justifying it in the PR. Tailwind, shadcn/ui and React Router are
  pre-approved.
- **Never edit `src/components/ui/`** to solve a caller's problem. It's vendored shadcn.
- **Never touch `package-lock.json` by hand, or `.nvmrc`.**
- **One-off tooling doesn't go in `package.json`.** Run it via `npx` from a scratch directory
  outside the repo. Playwright is used for visual verification this way and must stay out of the
  dependency tree.

## Traps

**Tests**

- **Fake timers deadlock without a `jest` shim.** `@testing-library/react`'s `asyncWrapper` drains
  microtasks with a `setTimeout(0)` it only pumps when it can see Jest's fake timers, and under
  Vitest it can't. Every `user.click` then hangs to timeout. `src/routes/Run.test.tsx` defines a
  one-method `globalThis.jest` shim for this. Don't remove it; don't reach for
  `shouldAdvanceTime: true` instead, which lets the clock creep on real time.
- **`vi.advanceTimersByTime(0)` will not fire a 0 ms timer that was scheduled during a tick.**
  `@sinonjs/fake-timers` floors it at `now + 1`. Chained timers (a timeout that arms the next)
  therefore can't be flushed by advancing zero, which matters because durations are tunable to
  zero. Use `vi.runOnlyPendingTimers()` after advancing, or `vi.advanceTimersToNextTimer()` to
  reach the next boundary regardless of duration. Both patterns are in `Run.test.tsx`.
- **Under Node 26, `globalThis.localStorage` reads back `undefined` in jsdom.** `safeStorage`
  mirrors every write into a module-level `Map`, which survives across tests in a file, so seed
  a known state per test instead of inheriting what the last one left.
- **The engine shuffles.** Never pin a test to a named card. Read what's on screen and assert
  about that; `src/test/rng.ts` gives a deterministic stream so a failure means a failure.
- **`Progress` takes a percentage as `value` and is never given `max`.** The vendored component
  positions its fill with a hardcoded `translateX`, so `value={2} max={5}` renders a 2% bar
  announcing "2 of 5".

**Browser verification with Playwright**

- **`click()` waits for a stable bounding box.** Any press meant to land mid-animation gets
  silently deferred until the animation finishes, so you get a wrong result instead of an
  error. Use `click({ force: true })`.
- **`localStorage` survives `page.goto`.** Runs leak between scenarios and counts drift. Clear it,
  then navigate again, before each check.

**CSS**

- **Tailwind registers `--tw-duration` as `@property { inherits: false }`.** A `duration-*`
  utility on a parent does not reach a child's `transition-duration`. To retime a child you don't
  own, target it: `[&>*]:duration-(--your-var)`.

## Conventions

- **Prefer absences to branches.** Several behaviours fall out of structure rather than being
  enforced by a condition. The card-advance guard, for instance, is read at exactly one call site, which is
  what leaves "Start over" and the completion screen unguarded with no `if` written for either.
  Before adding a special case, check whether the shape can carry it.
- **Derive, don't duplicate.** Where two values must agree, one is computed from the other so they
  can't drift. Mastery is derived from completed levels, not stored. The guard window is the sum of
  two animation durations, never its own number.
- **Timeouts close timed states, not animation events.** An `onAnimationEnd` that never fires
  leaves a control dead forever; a timeout can't.

## Spec-driven workflow

Feature work runs through Spec Kit skills, roughly in order: `/speckit-specify` →
`/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` →
`/speckit-converge`. Also available: `/speckit-analyze`, `/speckit-checklist`,
`/speckit-constitution`, `/speckit-taskstoissues`.

The artifacts are the source of intent. If the code and the spec disagree, that's a finding to
raise, not something to quietly resolve in either direction.

## Reporting

Say what you did and what you verified. If tests fail, show the output. If a
step was skipped, say so. Don't describe a check as run when it wasn't, and don't infer a
rationale you haven't read; the specs are right there.
