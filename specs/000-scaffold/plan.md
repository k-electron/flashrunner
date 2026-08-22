# Implementation Plan: Project Scaffold

**Branch**: `000-scaffold` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/000-scaffold/spec.md`

## Summary

Turn an empty repository into one that installs, lints, typechecks, tests, and builds — proven by
continuous integration on a clean runner rather than asserted. Ship just enough working code to
demonstrate each capability, marked as disposable, so `001-deck-runs` deletes it rather than
building around it.

The scaffold is the constitution made executable. Almost every requirement here exists because a
principle demanded it, and the acceptance test for the whole feature is the one Principle VII
already states: clean machine → clone → `npm ci` → `npm test` → `npm run build`.

## Technical Context

**Language/Version**: TypeScript **7.0.2** (Apache-2.0), `strict: true`, target ES2022.

**Runtime (tooling)**: Node **26.7.0**. Compliant under constitution v1.4.0 — Current today, LTS
on 2026-10-28.

**Primary Dependencies** — all verified against the npm registry on 2026-08-22:

| Package | Version | License | Role |
|---|---|---|---|
| `react` / `react-dom` | 19.2.8 | MIT | UI |
| `react-router` | 8.3.0 | MIT | routing, library mode only |
| `vite` | 8.2.2 | MIT | build + dev server |
| `@vitejs/plugin-react` | 6.1.0 | MIT | JSX, Fast Refresh |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | MIT | styling |
| `shadcn` (CLI, via `npx`) | 4.19.0 | MIT | initialization only, zero components |
| `typescript` | 7.0.2 | **Apache-2.0** | typecheck gate |
| `oxlint` | 1.79.0 | MIT | lint gate — **zero npm dependencies** |
| `prettier` | 3.9.6 | MIT | formatting |
| `vitest` | 4.1.11 | MIT | test runner |
| `jsdom` | 30.0.1 | MIT | DOM for component tests |
| `@testing-library/react` | 16.3.2 | MIT | component tests |
| `@types/node` | latest | MIT | needed by `vite.config.ts` |

Peer compatibility checked, not assumed: `vitest@4` peers `vite ^6 || ^7 || ^8`;
`@tailwindcss/vite@4.3.3` peers `vite ^5.2 || ^6 || ^7 || ^8`; `@vitejs/plugin-react@6.1.0` peers
`vite ^8.0.0`. Vite 8.2.2 satisfies all three.

Every license is on Principle VIII's allowlist. TypeScript is the only non-MIT entry.

**Storage**: none. This feature persists nothing.

**Testing**: Vitest on `jsdom`, plus React Testing Library for the component test.

**Target Platform**: Evergreen browsers. Static output, no server.

**Project Type**: Single-page web application. One deployable, no backend.

**Performance Goals**: the whole point is the feedback loop — a full local gate run and a CI
verdict must both be fast enough that nobody routes around them (SC-006: under 5 minutes).

**Constraints**: nothing installed globally; nothing written outside the repo; a cold cache must
still build.

**Scale/Scope**: two disposable routes, two example tests, one CI workflow. Deliberately tiny.

## Constitution Check

*Checked against constitution v1.4.0. Re-checked after Phase 1 design — result unchanged.*

| Principle | Status | How this design satisfies it |
|---|---|---|
| **I. Client-Only Static SPA** | PASS | `vite build` → static `dist/`. Router in library mode (`createBrowserRouter`). No `404.html` emitted, no `_redirects` written. |
| **II. localStorage Is the System of Record** | N/A | This feature stores nothing. The storage module arrives with 001. |
| **III. Green CI or It Does Not Merge** | PASS | This feature *is* Principle III. Workflow on PRs + pushes to `main`, `ubuntu-latest`, `npm ci` → lint → typecheck → test → build. |
| **IV. Test Behavior, Not Implementation** | PASS | Two example tests: one pure function, one component queried by role. Both are patterns for 001 to copy, not coverage of a real feature. |
| **V. Minimal Dependency Surface** | PASS — one justification | Everything is pre-approved except the toolchain itself. `prettier` is the single addition needing justification; see below. |
| **VI. Build Only What Was Asked** | PASS | The spec's Out of Scope list is long and specific. Demonstration content is disposable and marked as such. |
| **VII. Self-Contained, No Host Pollution** | PASS | This feature *is* Principle VII. `shadcn` runs via `npx`, never installed. No global installs anywhere. |
| **VIII. Free, Open, Reputable, Stable** | PASS | Full license table above, recorded from the registry. `TODO(DEP_LICENSES)` is discharged by this feature — see Phase 1. |

### Principle V justification: `prettier`

**What it does**: formats source files, and in `--check` mode fails when a file is not formatted.

**What it replaces**: nothing. The 000 spec originally assumed the linter would cover formatting;
that was checked and found false — `oxlint` lints and auto-fixes lint violations but does not
format. The spec has been corrected.

**Why hand-rolling is worse**: formatting is exactly the class of problem where a shared,
opinionated implementation beats a local one. There is no version of writing this ourselves that
is defensible.

**Conflict risk**: low, not zero. `oxlint`'s enabled rules are correctness-focused
(`react/rules-of-hooks`, `react/only-export-components`) rather than stylistic, so the classic
ESLint-vs-Prettier fight does not arise. If the two ever disagree, the formatter wins and the
lint rule is disabled — recorded so the resolution is not re-litigated later.

## Key Design Decisions

### 1. The demonstration content is disposable by design

FR-028 requires proof that each capability works; FR-029 requires that proof be removable without
touching configuration. Concretely: two routes under `src/routes/`, two tests, and one pure helper
— all confined to files 001 deletes wholesale. No configuration file references them by name.

The routes are `/` and `/ping`, deliberately meaningless. Naming them after real screens would
invite building on them.

### 2. Routing is set up here even though hosting is deferred

The spec defers production hosting, which means the "do deep links survive the real host" question
cannot be answered in this feature. What *can* be done is make the answer inevitable: emit no
top-level `404.html`, write no `_redirects`, and prove routing works against the built output with
a plain static server rather than the dev server, which papers over exactly this failure.

### 3. `oxlint` runs without type-aware mode

`oxlint` offers `--type-aware`, which requires type information. That is left off. Rationale: the
typecheck gate already runs the real compiler, so type-aware lint rules would duplicate it while
adding a coupling between the linter and TypeScript 7 — the one coupling this stack currently
avoids entirely, and the reason TypeScript 7 was low-risk to adopt.

### 4. `shadcn init` runs, `shadcn add` does not

Initialization writes shared configuration: the `@/` path alias, CSS variables, `components.json`,
and the `cn()` helper. That is scaffolding. Components are UI and arrive with the screens that
render them. This is the split the maintainer chose, and it is why FR-037 requires that adding a
component later needs no configuration change.

### 5. The Node version lives in exactly two files

`.nvmrc` and `package.json` → `engines`. The CI workflow reads `.nvmrc` rather than repeating the
number, so there is no third place to drift. Principle III names four locations; the fourth is the
hosting environment, which this feature defers — and CI reading `.nvmrc` means the count of
independently-editable copies is two, not three.

## Project Structure

### Documentation (this feature)

```text
specs/000-scaffold/
├── plan.md              # This file
├── research.md          # Phase 0 — verified facts, license table
├── quickstart.md        # Phase 1 — how to validate the scaffold
├── contracts/
│   └── commands.md      # the command surface every later feature depends on
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks output
```

No `data-model.md`: this feature defines no entities and persists nothing. The template's Phase 1
data-model step does not apply and the artifact would be an empty heading.

### Source Code (repository root)

```text
.github/workflows/ci.yml    # PRs + pushes to main
.nvmrc                      # 26.7.0
LICENSE                     # MIT
README.md                   # prerequisites + every command
components.json             # written by `npx shadcn init`
index.html
package.json
package-lock.json           # committed
tsconfig.json               # + tsconfig.app.json / tsconfig.node.json
vite.config.ts              # react plugin, tailwind plugin, @/ alias
vitest.config.ts            # jsdom + setup file (or merged into vite.config.ts)
.oxlintrc.json
.prettierrc.json
.prettierignore
src/
├── main.tsx
├── index.css               # @import "tailwindcss"
├── app/router.tsx          # createBrowserRouter
├── lib/utils.ts            # cn() — written by shadcn init
├── routes/                 # ── disposable ──
│   ├── Home.tsx
│   └── Ping.tsx
├── demo/                   # ── disposable ──
│   ├── greeting.ts
│   └── greeting.test.ts
└── test/setup.ts           # RTL matchers
```

Everything marked disposable is deleted by 001. Nothing outside those two directories refers to
them by name, which is what makes FR-029 true rather than aspirational.

**Structure Decision**: single project at the repository root. Principle I means one static
deployable, so there is no client/server split to represent. The only structural commitment worth
making now is the `@/` alias, because `shadcn init` writes generated imports against it.

## Phase 1 output note: `TODO(DEP_LICENSES)`

The constitution has carried this TODO since v1.3.0 because it could not be discharged before a
real dependency tree existed. This feature creates that tree. Once `npm install` has run, the
license of every transitive dependency is enumerated with `npm ls` and recorded in
[research.md](./research.md). Any license outside the allowlist stops the work per FR-035.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `prettier` — a dependency outside Principle V's pre-approved set | FR-010a requires formatting to be checkable in the lint gate, and the chosen linter does not format | Relying on editor configuration leaves formatting unenforced, so drift accumulates silently and lands in unrelated diffs. Using the linter's own formatter (`oxfmt`) would avoid the extra dependency but is pre-1.0, which is a worse trade for a tool that touches every file. |
