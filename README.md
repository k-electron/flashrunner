# FlashRunner

A flashcard training tool. Pick a deck, work through a run one card at a time, and the cards you
miss come back until you clear them.

Static single-page app. Everything lives in your browser — no account, no server, no data leaves
the device.

> **Status: scaffold.** The build, test, and CI pipeline are in place. The flashcard feature
> itself is specified in [`specs/001-deck-runs/`](specs/001-deck-runs/) and not yet built. What
> renders today is deliberately disposable placeholder content.

## Prerequisites

Two things, and nothing else:

- **git**
- **Node 26.7.0** — the version is pinned in [`.nvmrc`](.nvmrc)

Nothing is installed globally. Nothing is written outside this folder. Removing the project means
deleting the folder.

## Getting started

```bash
nvm use          # reads .nvmrc; skip if you already run 26.7.0
npm ci           # installs the exact versions in package-lock.json
npm run dev      # http://localhost:5173
```

`nvm use` is the step people forget. If `node --version` does not print `v26.7.0`, nothing below
is guaranteed to behave.

## Commands

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm ci`            | Install exactly the versions in the lockfile |
| `npm run dev`       | Dev server with hot reload                   |
| `npm run lint`      | Lint **and** check formatting                |
| `npm run format`    | Rewrite files to canonical formatting        |
| `npm run typecheck` | Typecheck, strict, no emit                   |
| `npm test`          | Run the test suite once and exit             |
| `npm run build`     | Produce the static `dist/`                   |
| `npm run preview`   | Serve the built `dist/` locally              |

The four gates are `lint`, `typecheck`, `test`, and `build`. CI runs exactly those, in that order,
on every pull request and every push to `main`. All four must pass before anything merges.

Run them all locally the same way CI does:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Stack

TypeScript 7 (strict) · React 19 · React Router 8 (library mode) · Vite 8 · Tailwind CSS 4 ·
shadcn/ui · Vitest + React Testing Library · oxlint + Prettier.

Adding a UI component:

```bash
npx shadcn@4.19.0 add button
```

No configuration change needed — initialization already happened.

## How this project is built

[`.specify/memory/constitution.md`](.specify/memory/constitution.md) is the governing document:
client-only static SPA, `localStorage` as the system of record, green CI or it does not merge,
test behavior rather than implementation, a minimal dependency surface, build only what was asked,
no host pollution, and free/open/reputable/stable dependencies.

Features are specified before they are built. See [`specs/`](specs/).

## License

[MIT](LICENSE).

The Dolch sight word lists used by the flashcard decks were published in 1936 and are public
domain.
