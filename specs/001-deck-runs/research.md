# Phase 0 Research: Deck Runs

**Date**: 2026-08-22 | **Plan**: [plan.md](./plan.md)

Every version number and behavioral claim below was checked on 2026-08-22 against the source
named. Nothing here is asserted from memory.

---

## 1. Does React Router still support library mode in v8?

**Decision**: Use `react-router` **8.3.0** with `createBrowserRouter` + `RouterProvider`.

**Why this needed research**: `react-router-dom` stopped at 7.18.2 while `react-router` moved to
8.3.0 — the `-dom` package was dropped in v8. Principle I forbids framework mode (it SSRs by
default), so the question was whether v8 still ships the browser-only entry points at all.

**Verification**: unpacked `react-router@8.3.0` from the registry and grepped its type
declarations. Present: `createBrowserRouter`, `createHashRouter`, `createMemoryRouter`,
`BrowserRouter`, `RouterProvider`. Library mode is intact.

Also read from its `package.json`:

- `license`: **MIT** — satisfies Principle VIII's allowlist directly, no interpretation needed.
- `peerDependencies`: `react >=19.2.7`, `react-dom >=19.2.7` → React 19.2.8 clears it.
- `engines`: `node >=22.22.0` → Node 26.7.0 clears it.
- Runtime dependencies: exactly one, `cookie-es@^3.1.1`.

**Alternatives considered**: `react-router-dom@7.18.2` — pinning to a superseded package name to
avoid a major bump would fail Principle VIII's "latest stable" rule and inherits no benefit.
Hash routing (`createHashRouter`) — would sidestep the Pages deep-link question entirely, but
produces `/#/deck/x` URLs and is unnecessary once §3 below holds.

---

## 2. Tailwind v3 or v4? — resolves `TODO(TAILWIND_VERSION)`

**Decision**: Tailwind CSS **4.3.3** via the `@tailwindcss/vite` plugin. No `tailwind.config.js`.

**Why this needed research**: the constitution explicitly flagged that v3 and v4 differ
materially in setup and told us to confirm rather than assume. The real risk was shadcn/ui
compatibility, since shadcn was built against v3's config-file model.

**Verification**: fetched shadcn/ui's official Vite installation guide. It installs
`tailwindcss @tailwindcss/vite` and puts `@import "tailwindcss";` in `src/index.css`. Both are
v4-only: v3 used a PostCSS plugin plus `@tailwind base/components/utilities` directives and
required a JS config file. So shadcn/ui's own documented path is v4, and there is no
compatibility gap to work around.

**Setup consequences for the scaffold**:

- `@tailwindcss/vite` goes in `vite.config.ts` plugins, not in a PostCSS chain.
- Theme customization is CSS-first (`@theme`), not a JS config object.
- `tsconfig.json` needs `paths: { "@/*": ["./src/*"] }`, and `vite.config.ts` needs the matching
  `resolve.alias` — shadcn's generated components import via `@/`. shadcn's guide also says to set
  `baseUrl`, but TypeScript 7 removed that option (`TS5102`); `paths` entries resolve relative to
  the `tsconfig.json` that declares them, so it is not needed and the shipped scaffold omits it.
- `@types/node` is a dev dependency, needed by `vite.config.ts` for `path.resolve`.

**Sources**: [shadcn/ui — Vite installation](https://ui.shadcn.com/docs/installation/vite)

---

## 3. Cloudflare Pages: deep links and the Node pin

**Deep links — now verified in production** (2026-08-22, `https://flashrunner.pages.dev`), not
merely reasoned about. A request for `/deck/dolch-prek-5/rung/r3` — a route this feature has not
built yet — returns the app shell with a 200. The routing design below is therefore known to work
on the real host before any of it is implemented.

The mechanism, unchanged: Pages
serves `index.html` for unmatched routes automatically **as long as the build output contains no
top-level `404.html`**. Adding one silently switches Pages out of SPA mode. A `/*` catch-all in
`_redirects` is *not* the fix and is actively harmful, because redirects are evaluated ahead of
static assets and can shadow the bundle's own asset requests. Both rules are already binding as
Principle I; this feature introduces nothing that would emit a `404.html`.

**Node pin** — resolves `TODO(NODE_VERSION)`.

**Decision**: Node **26.7.0**. Maintainer's call, 2026-08-22, overriding an initial
recommendation of 24.19.0.

**Verification** — two sources. `https://nodejs.org/dist/index.json` shows v26.7.0 (2026-08-05)
and v25.9.0 carrying `lts: false`, while v24.19.0 carries codename **"Krypton"**. The
authoritative dates come from `nodejs/Release`'s `schedule.json`:

| Line | Current from | Active LTS from | Maintenance from | End of life |
|---|---|---|---|---|
| v22 "Jod" | 2024-04-24 | 2024-10-29 | 2025-10-21 | 2027-04-30 |
| v24 "Krypton" | 2025-05-06 | 2025-10-28 | **2026-10-20** | 2028-04-30 |
| v25 | 2025-10-15 | never | 2026-04-01 | 2026-06-01 |
| **v26** | 2026-05-05 | **2026-10-28** | 2027-10-20 | **2029-04-30** |

Read against today (2026-08-22), this inverts the naive reading of Principle VIII. Node 24 is
LTS *right now* but enters maintenance in nine weeks. Node 26 is Current *right now* and becomes
Active LTS eight days after that, supported for a further two and a half years. Pinning 24 would
mean re-pinning before the year is out.

It is also already the maintainer's installed runtime (v26.7.0), so `nvm use` becomes a
formality rather than a step people forget.

**Cost**: Principle VIII says "LTS where the project publishes an LTS line (Node)", and Node 26
is not LTS today. This needs a constitution amendment, tracked in
[plan.md § Complexity Tracking](./plan.md#complexity-tracking). The conflict expires on its own
on 2026-10-28.

**Downstream effect on library versions: none.** Every pinned package accepts Node 26 —
`vite@8.2.2` (`^20.19.0 || >=22.12.0`), `vitest@4.1.11` (`^20.0.0 || ^22.0.0 || >=24.0.0`),
`@vitejs/plugin-react@6.1.0`, `react-router@8.3.0` (`>=22.22.0`), `@testing-library/react@16.3.2`
(`>=18`), and `jsdom` (`^22.22.2 || ^24.15.0 || >=26.0.0`, which enumerates 26 explicitly).
`tailwindcss` and `@tailwindcss/vite` declare no `engines` at all.

**Risk to verify on the first deploy**: Node 26.7.0 was released 2026-08-05, seventeen days ago.
The Pages build image documents "any version" support, but whether its provisioner can actually
fetch a release that new is an empirical question — only a real Pages build answers it. If it
cannot, the fallbacks are an older v26 patch or 24.19.0 until 2026-10-28.

**How Pages picks it up** — from the Pages build-image docs: the current (v3) build system
defaults to Node 22.16.0, supports any version, and reads `.nvmrc` / `.node-version` from the
project root or a `NODE_VERSION` environment variable.

> **Gotcha for the scaffold**: the v3 build image does **not** read `package.json` → `engines`.
> Principle III requires the version pinned in four places (`.nvmrc`, `engines`, CI workflow,
> Pages env), and three of those four are the enforcing ones — `engines` is enforced by npm and
> CI, `.nvmrc` is what Pages actually obeys. Declaring `engines` is still required, it just is
> not what makes the deployment use Node 24.

**Sources**: [Cloudflare Pages build image](https://developers.cloudflare.com/pages/configuration/build-image/),
[nodejs.org release index](https://nodejs.org/dist/index.json),
[nodejs/Release schedule.json](https://github.com/nodejs/Release/blob/main/schedule.json)

---

## 4. Dolch word list content and ordering

**Decision**: ship the Dolch **Pre-Primer** (40 words) as `dolch-prek-5` and **Primer**
(52 words) as `dolch-k-5`, ordered easiest-first, in rungs of 5.

**Verification**: three independent sources were cross-checked and agree on both lists
word-for-word, including counts:

1. IRA/NCTE ReadWriteThink "Dolch Word List" PDF (© 2004) — text extracted directly from the
   PDF, states "Preprimer (40 words)" and "Primer (52 words)".
2. sightwords.com's Dolch list page.
3. General web search results.

The lists are public domain — Dolch published them in 1936.

**Ordering rationale** (this part is judgment, not sourced): sight words are memorized rather
than decoded, so the ordering weights **length** and **raw frequency** first, then pushes
**orthographically irregular** words later. `one`, `two`, `yellow`, `where`, `please`, and
`pretty` land in the top rungs for that reason; `a`, `I`, `the`, `and`, `to` lead.

### `dolch-prek-5` — Dolch Pre-K · Steps of 5 (40 words, 8 rungs)

Each rung is cumulative. The "adds" column is what is new at that rung.

| Rung | Size | Adds |
|---|---|---|
| 1 | 5 | a, I, the, and, to |
| 2 | 10 | is, it, in, up, me |
| 3 | 15 | go, we, my, see, can |
| 4 | 20 | not, run, big, red, you |
| 5 | 25 | for, help, look, come, down |
| 6 | 30 | play, make, here, blue, said |
| 7 | 35 | away, find, jump, little, three |
| 8 | 40 | funny, one, two, where, yellow |

### `dolch-k-5` — Dolch Kindergarten · Steps of 5 (52 words, 11 rungs)

| Rung | Size | Adds |
|---|---|---|
| 1 | 5 | am, at, on, so, no |
| 2 | 10 | be, do, he, all, get |
| 3 | 15 | did, but, yes, ran, out |
| 4 | 20 | are, ate, eat, new, now |
| 5 | 25 | our, saw, say, she, too |
| 6 | 30 | was, who, will, with, that |
| 7 | 35 | this, they, want, well, went |
| 8 | 40 | came, good, have, into, like |
| 9 | 45 | must, ride, soon, four, what |
| 10 | 50 | black, brown, there, under, white |
| 11 | 52 | please, pretty |

52 is not divisible by 5, so the top rung adds 2 rather than 5. Because rung membership is
authored literally, this needs no special case anywhere in the engine — it is just what that
rung's `cardIds` says.

**Reviewed and approved by the maintainer, 2026-08-22.** Both ladders are settled content.
Nothing downstream depends on the specific sequence in any case — reordering is a config edit,
not a code change.

**Sources**: [ReadWriteThink Dolch Word List (PDF)](https://www.readwritethink.org/sites/default/files/resources/lesson_images/lesson301/dolchwordlist.pdf),
[sightwords.com — Dolch Sight Words List](https://sightwords.com/sight-words/dolch/)

---

## 5. State management for the run loop

**Decision**: `useReducer` over a pure reducer. No state library, no data-fetching library.

**Rationale**: the run loop is literally a finite state machine over a queue — a reducer is an
exact structural fit rather than a compromise. TanStack Query and friends solve *server* state:
caching, deduplication, refetching, staleness. Principle I guarantees there is no server, and
`localStorage` is synchronous, so every problem those libraries solve is absent here. Principle
V forbids adding one speculatively in as many words.

**Alternatives considered**: Zustand/Jotai — would centralise state that is already scoped to a
single route. Context for run state — unnecessary, since only the `Run` route reads it.

---

## Scaffold requirements (handoff to `000-scaffold`)

This is the concrete output for the separate scaffold feature. Collected here so `000` can be
specified from evidence instead of guessed at.

**TypeScript — 7.0.2.** Maintainer's decision, 2026-08-22. Checked the same day: 7.0.2
(2026-07-08, the Go-native port) is npm's `latest`, while `create-vite`'s react-ts template still
pins `~6.0.2` (6.0.3 current). Principle VIII's "latest stable" points at 7.

License **Apache-2.0**, on the allowlist. It is the only non-MIT package in the pinned stack,
which is worth knowing when `TODO(DEP_LICENSES)` gets filled in.

**Why the template's caution does not transfer.** The standard TypeScript-7 hazard in a React
codebase is `typescript-eslint`, which consumes the TypeScript compiler API directly and so tracks
its internals. This project does not use it — the linter is `oxlint`, which is Rust with its own
parser. That leaves `tsc` used only as the typecheck gate, which is the narrowest possible
exposure. Still verify by running it in `000`: "narrow exposure" is a reason to expect success,
not evidence of it.

**Linter — `oxlint` 1.79.0** (MIT). Not a guess: `create-vite`'s react-ts template ships it as the
`lint` script with `react/rules-of-hooks` and `react/only-export-components` configured, having
moved off ESLint. One binary rather than ESLint's five packages, which is also the better answer
under Principle V. 16.4M weekly downloads against ESLint's 158M and Biome's 13.6M — real adoption,
not a novelty.

**Pinned versions**: Node 26.7.0 · TypeScript 7.0.2 `strict` · React 19.2.8 · react-router 8.3.0 ·
Vite 8.2.2 · @vitejs/plugin-react 6.1.0 · tailwindcss + @tailwindcss/vite 4.3.3 · shadcn CLI
4.19.0 (via `npx`, vendored output) · Vitest 4.1.11 · @testing-library/react 16.3.2 · oxlint 1.79.0 ·
`@types/node` (dev, required by `vite.config.ts`).

**Files the scaffold must produce**:

- `.nvmrc` = `26.7.0`, and `engines.node` matching it in `package.json`.
- `vite.config.ts` with `@vitejs/plugin-react`, `@tailwindcss/vite`, and `resolve.alias` for `@/`.
- `tsconfig.json` with `strict` and `paths` for `@/`. No `baseUrl` — removed in TypeScript 7.
- `src/index.css` containing `@import "tailwindcss";`.
- `components.json` from `npx shadcn@4.19.0 init`.
- Vitest config using the `jsdom` environment plus an RTL setup file.
- `.github/workflows/ci.yml` on `ubuntu-latest`: `npm ci` → lint → typecheck → test → build,
  triggered on PRs and pushes to `main`, with `actions/setup-node` reading `.nvmrc`.
- Committed `package-lock.json`.

**Cloudflare Pages project settings**: build command `npm run build`, output directory `dist`,
`NODE_VERSION` = `26.7.0`. Confirm the deployed output has no top-level `404.html` and that no
`_redirects` file exists.

**Also belongs to `000`**: recording each dependency's license via `npm ls` once a real tree
exists — that is `TODO(DEP_LICENSES)` in the constitution, and it cannot be discharged before
`npm install` has ever run.
