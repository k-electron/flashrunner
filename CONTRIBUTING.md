# Contributing

A small, opinionated codebase. The opinions are written down, which should make it easier to work
in rather than harder.

Two things up front:

1. **The maintainer decides what gets built.** The rules in this repo govern _how_ things are
   built. If you want to add a feature, open an issue and ask before writing it. A PR that
   implements more than its description gets rejected on that basis alone.
2. **Features are specified before they're coded.** We run the cycle on
   [Spec Kit](https://github.com/github/spec-kit), so every directory under [`specs/`](specs/) is a
   feature: what was asked for, why, and how it was decided. Reading the one nearest your change is
   usually faster than reverse-engineering the code.

## Setup

You need **git** and **Node 26.7.0**. Nothing else: no global installs, no system packages.
Removing the project means deleting the folder.

```bash
nvm use          # reads .nvmrc; skip if you already run 26.7.0
npm ci           # exact versions from package-lock.json, not npm install
npm run dev      # http://localhost:5173
```

If `node --version` doesn't print `v26.7.0`, fix that first. It is the step people skip.

## Commands

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm ci`            | Install exactly the versions in the lockfile |
| `npm run dev`       | Dev server with hot reload                   |
| `npm run lint`      | Lint **and** check formatting                |
| `npm run format`    | Rewrite files to canonical formatting        |
| `npm run typecheck` | Typecheck, strict, no emit                   |
| `npm test`          | Run the suite once and exit                  |
| `npm run build`     | Produce the static `dist/`                   |
| `npm run preview`   | Serve the built `dist/` locally              |

## The gate

Four checks, in this order. CI runs exactly these on every PR and every push to `main`, and red
blocks merge, so fix or revert; never merge intending to fix later.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Run it before you push.

## Making a change

Branch off `main`, named `NNN-short-slug` matching the spec directory if there is one
(`009-card-advance-guard`), or something obvious if there isn't.

Your PR description should say what was asked for as well as what you did. The reviewer checks the
diff against it.

A few things that will come up in review:

- **Bug fixes lead with a failing test.** Write the test, watch it fail against the unfixed code,
  then fix it. A fix without that test isn't finished.
- **Tests describe behaviour, not structure.** Query by role, label, and visible text. No class
  names, no `data-*` attributes, no snapshots, no reaching into component internals. If a test
  only fails when you rename something, it's testing the wrong thing.
- **Comments explain _why_.** The code already says what it does. `// increment the counter` is
  noise; `// at the boundary, not on the press, or the outgoing card unmounts mid-exit` earns its
  place.
- **New dependencies need a reason.** Prefer platform and React built-ins. If you do add one, say
  in the PR what it does, what it replaces, and why hand-rolling is worse. Tailwind, shadcn/ui and
  React Router are pre-approved; everything else is a conversation.
- **`src/components/ui/` is vendored shadcn/ui.** It's project code and subject to every rule
  here, but don't edit it to solve a problem that belongs to the caller.
- **Don't hand-edit `package-lock.json` or `.nvmrc`.** The Node version has one source of truth.
- **A new feature needs a spec first**, a fix doesn't. Templates are in `.specify/templates/` if
  you're writing one by hand.

## How the code is arranged

```
src/
├── decks/        deck data + pure rules (ladder unlocking, validation)
├── run/          the run state machine (pure: no React, no I/O)
├── storage/      the only place localStorage is touched
├── components/   presentational; ui/ is vendored shadcn
├── routes/       the three screens
└── app/          the router
```

**`src/run/` and `src/decks/` decide things; `src/routes/` and `src/components/` display them.**
The engine is pure functions over plain data, which is why it is cheap to test. Keep it that way: no React imports, no storage calls, no `Date.now()`.

All persistence goes through `src/storage/`. A direct `localStorage.getItem` anywhere else is a
review failure, and storage is treated as hostile: absent, disabled, full, or holding corrupt JSON
from an older build. Every one of those degrades to a working app, never a blank screen.

## Adding a deck

This is the most likely first contribution, and it's mostly data.

1. Copy `src/decks/dolch-prek-5.ts` and edit it. A deck has an `id` (stable forever, because storage keys
   hang off it), a `title`, a flat list of `cards`, and `rungs` listing card ids **explicitly**, in
   presentation order.
2. Register it in `src/decks/registry.ts`.
3. Run `npm test`.

That third step does the checking. `src/decks/validate.ts` enforces eight structural rules. Every rung's cards
exist in the deck, each rung contains everything in the rung below it, the top rung covers the
whole deck, no duplicates, no empty rungs. `validate.test.ts` runs them against **every deck
in the registry**. So a malformed deck fails CI immediately, with a message naming the rule.

Rungs must nest, because that's what makes the ladder mean anything: Level 2 is Level 1 plus five
more words, not a different five words.

## Adding a UI component

```bash
npx shadcn@4.19.0 add button
```

Already initialised, so no config change needed. It lands in `src/components/ui/` as source.

## The governing document

[`.specify/memory/constitution.md`](.specify/memory/constitution.md) collects these rules and the
ones that come up less often. It runs to a page: client-only
static SPA, `localStorage` as the system of record, green CI or it doesn't merge, test behaviour
not implementation, minimal dependency surface, build only what was asked, no host pollution, and
free/open/reputable/stable dependencies.

AI agents working here should read [AGENTS.md](AGENTS.md), which covers the same ground plus the
traps that have cost time in this repo.
