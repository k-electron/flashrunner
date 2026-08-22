# Phase 0 Research: Project Scaffold

**Date**: 2026-08-22 | **Plan**: [plan.md](./plan.md)

Everything below was checked against the npm registry or the tool itself on 2026-08-22. Where a
fact is still pending, it says so rather than being guessed at.

---

## 1. The linter does not format — corrects a spec assumption

**Finding**: `oxlint` 1.79.0 is a linter only. Its CLI offers `--fix`, `--fix-suggestions`, and
`--fix-dangerously` for **lint** violations, and `--format` selects *output* format (checkstyle,
etc.), not source formatting. There is no format subcommand.

The 000 spec had assumed "formatting is settled by whatever tool lints, so the two cannot
disagree." That assumption was false and the spec has been corrected, with FR-010a added to make
formatting a checkable part of the lint gate.

**Decision**: `prettier` 3.9.6 (MIT). Justified against Principle V in
[plan.md](./plan.md#principle-v-justification-prettier).

**Alternative considered**: `oxfmt` 0.64.0 (MIT), same project as `oxlint`, so the two could not
disagree by construction. Rejected on maturity — pre-1.0 for a tool that rewrites every file in
the repository is a worse trade than one extra well-established dependency. Principle VIII's
pre-release ban names `0.0.x` and covers runtime dependencies, so `oxfmt` would have squeaked
through on a technicality rather than on merit; that is not a good enough reason.

---

## 2. Why `oxlint` rather than ESLint

Not a preference — `create-vite`'s own `react-ts` template ships it. Inspected the published
tarball directly:

```json
"scripts": { "lint": "oxlint" },
"devDependencies": { "oxlint": "^1.75.0", ... }
```

with `_oxlintrc.json` enabling `react/rules-of-hooks` and `react/only-export-components`. The
template has moved off ESLint entirely.

Corroborating: `oxlint` reports **zero npm dependencies** — it is a single binary — against
ESLint's five-package setup for the same job. Weekly downloads: oxlint 16.4M, ESLint 158M,
Biome 13.6M. Real adoption, not a novelty.

This also happens to be what made TypeScript 7 low-risk: the usual TS-7 hazard is
`typescript-eslint` consuming the compiler API, and this project has no such consumer.

---

## 3. Peer compatibility across the toolchain

Checked rather than hoped:

| Package | Declares | Vite 8.2.2 |
|---|---|---|
| `vitest@4.1.11` | `vite: ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0` | ✅ |
| `@tailwindcss/vite@4.3.3` | `vite: ^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` | ✅ |
| `@vitejs/plugin-react@6.1.0` | `vite: ^8.0.0` | ✅ |

`react-router@8.3.0` declares `react >=19.2.7` (React 19.2.8 ✅) and `node >=22.22.0`
(Node 26.7.0 ✅), with exactly one runtime dependency, `cookie-es`.

---

## 4. Tailwind v4 and shadcn/ui setup shape

From shadcn/ui's official Vite guide: install `tailwindcss @tailwindcss/vite`, put
`@import "tailwindcss";` in the entry stylesheet, add `baseUrl` + `paths` for `@/*` to
`tsconfig.json`, mirror that in `vite.config.ts` via `resolve.alias`, then `npx shadcn init`.

Both the plugin and the `@import` directive are Tailwind v4 syntax — v3 used a PostCSS plugin,
`@tailwind` directives, and a `tailwind.config.js`. There is no `tailwind.config.js` in a v4
setup; theming is CSS-first via `@theme`.

`@types/node` is a dev dependency because `vite.config.ts` uses `path.resolve` for the alias.

---

## 5. Node version and where it is declared

Node **26.7.0**, compliant under constitution v1.4.0 (Current now, Active LTS 2026-10-28,
supported to 2029-04-30 — against Node 24 entering maintenance 2026-10-20).

Declared in exactly two files: `.nvmrc` and `package.json` → `engines`. The CI workflow reads
`.nvmrc` via `actions/setup-node`'s `node-version-file` rather than repeating the number, so there
is no third copy to drift. The fourth location Principle III names is the hosting environment,
which this feature defers.

**Known for later**: Cloudflare Pages' current build image defaults to Node 22.16.0, reads
`.nvmrc` / `.node-version` / `NODE_VERSION`, and does **not** read `package.json` → `engines`.
Recorded here so the hosting feature does not rediscover it.

---

## 6. Dependency licenses — discharges `TODO(DEP_LICENSES)`

The constitution has carried this TODO since v1.3.0 because it cannot be answered before a real
dependency tree exists. This feature creates one.

Direct dependencies, from the registry:

| Package | License |
|---|---|
| react, react-dom | MIT |
| react-router | MIT |
| vite, @vitejs/plugin-react | MIT |
| tailwindcss, @tailwindcss/vite | MIT |
| oxlint | MIT |
| prettier | MIT |
| vitest, jsdom | MIT |
| @testing-library/react | MIT |
| @types/node | MIT |
| **typescript** | **Apache-2.0** |

All on the allowlist. TypeScript is the only non-MIT entry.

### Full transitive enumeration — 515 packages

Walked every `package.json` under `node_modules` after a clean `npm ci`. 13 distinct license
strings across 515 packages:

| License | Packages | Pre-cleared? |
|---|---:|---|
| MIT | 450 | ✅ |
| ISC | 24 | ✅ |
| Apache-2.0 | 10 | ✅ |
| BSD-3-Clause | 8 | ✅ |
| BSD-2-Clause | 7 | ✅ |
| OFL-1.1 | 1 | ✅ (added to the list in constitution v1.5.0) |
| BlueOak-1.0.0 | 5 | asked |
| MPL-2.0 | 4 | asked |
| MIT-0 | 2 | asked |
| 0BSD | 1 | asked |
| Python-2.0 | 1 | asked |
| CC0-1.0 | 1 | asked |
| CC-BY-4.0 | 1 | asked |

**The seven unlisted ones, assessed.** Under constitution v1.5.0 these are questions rather than
blocks — asked, answered, recorded here.

| License | Packages | Assessment |
|---|---|---|
| **BlueOak-1.0.0** | `isexe`, `lru-cache`, `minimatch` | Permissive, OSI-approved, deliberately plain-language. Functionally equivalent to MIT. No copyleft. |
| **MPL-2.0** | `lightningcss` (+ platform binary) | **Weak, file-level copyleft** — modifying an MPL file obliges you to publish that file's changes. Using it unmodified obliges nothing. It is also a build-time CSS tool that never reaches the bundle. The only one here that would matter if we forked it. |
| **MIT-0** | `@csstools/*` | MIT without the attribution requirement. Strictly more permissive than MIT. |
| **0BSD** | `tslib` | Zero-clause BSD. Public-domain-equivalent, more permissive than BSD-2. |
| **Python-2.0** | `argparse` | PSF license. Permissive, GPL-compatible. |
| **CC0-1.0** | `mdn-data` | Public domain dedication. Build-time data. |
| **CC-BY-4.0** | `caniuse-lite` | Attribution required, and it applies to the browser-support *data*, not to our code. Build-time only, never bundled. |

None is copyleft over application code. The only license here with any reciprocal obligation at all
is MPL-2.0, and it binds only files we would have had to modify — which we have not.

**`TODO(DEP_LICENSES)` is discharged by this table.**

---

## 7. Proving deep links without a host

Hosting is deferred, so "does direct addressing work in production" cannot be answered here. What
this feature can do is make the answer inevitable and check the part that is checkable:

- emit no top-level `404.html` — its absence is what keeps the intended host in SPA mode
- write no `_redirects` — redirects outrank static assets and can shadow the bundle
- serve `dist/` with a plain static file server and request a nested path directly

The dev server resolves any path and therefore proves nothing. Testing against the built output
with a dumb static server is the closest available proxy, and it is what catches the real failure.
