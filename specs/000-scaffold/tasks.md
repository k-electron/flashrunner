---
description: "Task list for 000-scaffold"
---

# Tasks: Project Scaffold

**Input**: Design documents from `/specs/000-scaffold/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[contracts/commands.md](./contracts/commands.md), [quickstart.md](./quickstart.md)

**Tests**: The spec does not request TDD. Test tasks below are **deliverables**, not a testing
strategy — FR-028 requires the scaffold to prove a test can run and can fail, so the example tests
are part of the product of this feature.

**Organization**: Grouped by user story. Note that this feature's dependency graph is unusually
linear — you cannot demonstrate a test harness before there is a project to test. Story
independence is therefore weaker here than in a normal feature, and is called out per phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1, US2, US3

## Path Conventions

Single project at repository root: `src/`, `.github/workflows/`, config files at top level.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The runtime pin and package manifest everything else hangs off.

- [X] T001 Create `.nvmrc` at repository root containing `26.7.0`
- [X] T002 Create `package.json` at repository root with `"type": "module"`, `"private": true`, and `engines.node` set to `26.7.0` to match `.nvmrc`
- [X] T003 Install runtime dependencies pinned per plan.md into `package.json`: `react@19.2.8`, `react-dom@19.2.8`, `react-router@8.3.0`
- [X] T004 Install dev dependencies pinned per plan.md: `vite@8.2.2`, `@vitejs/plugin-react@6.1.0`, `typescript@7.0.2`, `@types/react`, `@types/react-dom`, `@types/node`
- [X] T005 Verify `package-lock.json` was generated at repository root and is not ignored by `.gitignore`

**Checkpoint**: `npm ci` succeeds from a clean `node_modules`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build and type configuration. Nothing can render, lint, or be tested until this is
done.

**⚠️ CRITICAL**: Blocks all three user stories.

- [X] T006 Create `tsconfig.json` at repository root with `strict: true`, `baseUrl: "."`, and `paths` mapping `@/*` to `./src/*`, referencing app and node configs
- [X] T007 [P] Create `tsconfig.app.json` for `src/` with ES2022 target and `noEmit`
- [X] T008 [P] Create `tsconfig.node.json` for `vite.config.ts` and other config files
- [X] T009 Create `vite.config.ts` at repository root wiring `@vitejs/plugin-react` and `resolve.alias` for `@/` via `path.resolve`
- [X] T010 Create `index.html` at repository root with a `#root` mount point and a `<script type="module">` pointing at `src/main.tsx`
- [X] T011 Add `dev`, `build`, and `preview` scripts to `package.json` per [contracts/commands.md](./contracts/commands.md)
- [X] T012 Add `typecheck` script running `tsc --noEmit` per contracts/commands.md

**Checkpoint**: `npm run typecheck` passes on an empty `src/`.

---

## Phase 3: User Story 1 — Clone it and see it run (Priority: P1) 🎯 MVP

**Goal**: A developer clones, runs documented commands, and sees a styled page in a browser with
working navigation.

**Independent Test**: On a machine that has never built this project, follow the README and
confirm a styled page renders and navigating between the two routes works. Count commands and time
it (SC-001).

### Styling foundation (FR-036, FR-038)

- [X] T013 [US1] Install `tailwindcss@4.3.3` and `@tailwindcss/vite@4.3.3` as dev dependencies
- [X] T014 [US1] Register the Tailwind plugin in `vite.config.ts`
- [X] T015 [US1] Create `src/index.css` containing `@import "tailwindcss";`
- [X] T016 [US1] Run `npx shadcn@4.19.0 init` to write `components.json`, CSS variables, and `src/lib/utils.ts`, vendoring **zero** components (FR-036)
- [X] T017 [US1] Verify `npx shadcn@4.19.0 init` did not install anything globally and that `tsconfig.json` / `vite.config.ts` alias settings still agree after it rewrote them

### Application entry and routing

- [X] T018 [US1] Create `src/main.tsx` mounting React 19 into `#root` and importing `src/index.css`
- [X] T019 [US1] Create `src/app/router.tsx` using `createBrowserRouter` and `RouterProvider` — **library mode only**, never framework mode (Principle I)
- [X] T020 [P] [US1] Create disposable route `src/routes/Home.tsx` at path `/`, using Tailwind utility classes so styling is visibly proven (FR-038), with a link to `/ping`
- [X] T021 [P] [US1] Create disposable route `src/routes/Ping.tsx` at path `/ping`, with a link back to `/`
- [X] T022 [US1] Add a comment at the top of `src/routes/Home.tsx` and `src/routes/Ping.tsx` marking them disposable and naming 001 as the feature that deletes them (FR-029)

### Documentation and licensing

- [X] T023 [P] [US1] Create `LICENSE` at repository root containing the MIT license (FR-039)
- [X] T024 [P] [US1] Add `license: "MIT"` to `package.json`
- [X] T025 [US1] Create `README.md` documenting the prerequisites (git, Node 26.7.0) and every command from contracts/commands.md, with no step discoverable only by reading config (FR-006)

**Checkpoint**: `npm run dev` serves a styled page; clicking navigates between `/` and `/ping`;
editing a route updates the browser without a restart. **US1 independently testable here.**

---

## Phase 4: User Story 2 — Every change gets an automatic verdict (Priority: P2)

**Goal**: Four gates runnable locally by one command each, and run automatically on every pull
request and push to `main`, with failure blocking merge.

**Independent Test**: Open a pull request that breaks each gate in turn and confirm each is
reported and blocks merging (SC-004, SC-005, SC-018).

**Dependency note**: requires Phase 2. Does not require Phase 3, except that the component test
needs something to render — so T031 depends on T020.

### Lint and format gates

- [X] T026 [P] [US2] Install `oxlint@1.79.0` and `prettier@3.9.6` as dev dependencies
- [X] T027 [US2] Create `.oxlintrc.json` at repository root enabling `react/rules-of-hooks` and `react/only-export-components`, with `--type-aware` left off per plan.md decision 3
- [X] T028 [P] [US2] Create `.prettierrc.json` and `.prettierignore` at repository root, with `dist/` and `package-lock.json` ignored
- [X] T029 [US2] Add `lint` script running **both** `oxlint` and `prettier --check` so formatting drift fails the gate (FR-010a), and a `format` script running `prettier --write`

### Test gate

- [X] T030 [US2] Install `vitest@4.1.11`, `jsdom@30`, `@testing-library/react@16.3.2`, and `@testing-library/jest-dom` as dev dependencies; configure Vitest with the `jsdom` environment and `src/test/setup.ts`
- [X] T031 [US2] Create `src/test/setup.ts` importing `@testing-library/jest-dom` matchers
- [X] T032 [P] [US2] Create disposable `src/demo/greeting.ts` with one pure function, and `src/demo/greeting.test.ts` covering it — proving the plain unit-test path
- [X] T033 [US2] Create `src/routes/Home.test.tsx` querying by role and visible text — proving the jsdom + React Testing Library path (Principle IV: no class names, no snapshots)
- [X] T034 [US2] Add a `test` script that runs once and **exits** rather than watching (contracts/commands.md rule 2)
- [X] T035 [US2] Confirm a test can fail: temporarily break an assertion, observe a red run, restore it

### Continuous integration

- [X] T036 [US2] Create `.github/workflows/ci.yml` triggering on pull requests and pushes to `main`, running on `ubuntu-latest` only (Principle III)
- [X] T037 [US2] In the workflow, use `actions/setup-node` with `node-version-file: .nvmrc` so the version is not repeated in a third place (plan.md decision 5)
- [X] T038 [US2] In the workflow, run `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`, in that order, each failing the job on non-zero exit

**Checkpoint**: all four gates pass locally and in CI on a clean runner. **US2 independently
testable here.**

---

## Phase 5: User Story 3 — It leaves no trace on the machine (Priority: P3)

**Goal**: Nothing installed globally, nothing written outside the repository, deletion restores
the machine.

**Independent Test**: Record global state, build and test, delete the folder, confirm only package
caches changed (SC-007, SC-008).

**Dependency note**: verification-only. Requires Phases 1–4 to exist but adds no new capability —
if the earlier phases were built correctly this phase finds nothing to fix.

- [X] T039 [US3] Confirm `npm ls -g --depth=0` is unchanged before and after a full install, test, and build cycle (FR-024)
- [X] T040 [US3] Confirm no `npm install -g` appears anywhere in `package.json` scripts, the CI workflow, or the README, and that `shadcn` is invoked only via `npx` (FR-025)
- [X] T041 [US3] Confirm a cold-cache build succeeds: `npm cache clean --force` then `npm ci && npm run build` (SC-009, FR-026)
- [X] T042 [US3] Confirm nothing outside the repository is written during a build, and that no script references a path in `$HOME` (FR-026, FR-027)

**Checkpoint**: containment verified. **US3 independently testable here.**

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T043 Verify build output shape: `dist/` contains **no** top-level `404.html` and **no** `_redirects` (FR-033, Principle I)
- [X] T044 Verify direct addressing against the **built output**: `npm run build`, serve `dist/` with a plain static server, request `/ping` directly rather than by clicking (FR-032, SC-011). Do not use the dev server — it hides this failure.
- [X] T045 Verify the demonstration content is disposable: `rm -rf src/routes src/demo` breaks only router imports, with no configuration file edit required (FR-029, SC-013). Restore afterwards.
- [X] T046 Enumerate every transitive dependency license with `npm ls` and append the result to [research.md](./research.md) §6, discharging `TODO(DEP_LICENSES)` (FR-034, SC-014)
- [X] T047 Confirm every license found is on Principle VIII's allowlist — MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC — and stop and raise anything outside it (FR-035)
- [X] T048 Update `.specify/memory/constitution.md` to remove `TODO(DEP_LICENSES)` from its deferred list, now that it is discharged
- [X] T049 Confirm `.nvmrc` and `package.json` → `engines` agree, and that the CI workflow declares no third copy (FR-021, FR-023, SC-010)
- [X] T050 Run the full [quickstart.md](./quickstart.md) end to end and confirm every claim in its checklist

### Deferred to after merge

- [ ] T051 Enable branch protection on `main` requiring the CI check, with no approving review required (FR-040, FR-041). **Cannot be done before merge** — the platform can only require a check that has already run at least once.

---

## Dependencies

```text
Phase 1 (Setup)
   ↓
Phase 2 (Foundational) ── blocks everything
   ↓
   ├─→ Phase 3 (US1)  styling, routing, README, LICENSE
   │        ↓
   └─→ Phase 4 (US2)  gates + CI      [T033 needs T020]
            ↓
        Phase 5 (US3)  containment verification
            ↓
        Phase 6 (Polish)
            ↓
        T051 after merge
```

**Honest note on story independence**: the template assumes user stories are independently
deliverable. For a scaffold they largely are not — US2 cannot demonstrate a component test without
US1's component, and US3 is pure verification of what US1 and US2 built. The phases are still worth
separating because they are independently *testable*, which is what the checkpoints assert.

## Parallel Opportunities

Genuinely parallel, being different files with no shared dependency:

- **Phase 2**: T007, T008 (two tsconfig files)
- **Phase 3**: T020, T021 (two route files) · T023, T024 (LICENSE and manifest field)
- **Phase 4**: T026, T028 (installs vs. prettier config) · T032 (demo test) alongside T027–T029

Everything else is sequential — mostly because each step configures the tool the next step runs.

## Implementation Strategy

**MVP is Phase 1 → Phase 3.** That yields a repository someone can clone and run, which is the
single most valuable increment and the one that unblocks nothing else being guesswork.

**Phase 4 is what makes the repository trustworthy** and is where the constitution stops being
advisory. It should not be deferred past this feature.

**Phases 5 and 6 are verification.** If earlier phases were built correctly they find nothing —
and that is the expected outcome, not a sign they were unnecessary.
