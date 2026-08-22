# Contract: Command Surface

**Stability**: every later feature, the CI workflow, and eventually the hosting configuration all
invoke these. Renaming one is a breaking change; adding one is not.

**Serves**: FR-003, FR-004, FR-010, FR-010a, FR-011, FR-015

---

## The commands

| Command | Does | Gate? |
|---|---|---|
| `npm ci` | Installs exactly the versions in the lockfile | — |
| `npm run dev` | Starts the local dev server with hot reload | — |
| `npm run lint` | Lints, and checks formatting | ✅ |
| `npm run format` | Rewrites files to canonical formatting | — |
| `npm run typecheck` | Typechecks with no emit, strict | ✅ |
| `npm test` | Runs the test suite once and exits | ✅ |
| `npm run build` | Produces the static `dist/` | ✅ |
| `npm run preview` | Serves the built `dist/` locally | — |

## Rules

1. **The four gates are the merge contract.** CI runs exactly these four, in this order, and each
   must exit non-zero on failure. Nothing may be a gate in CI that is not runnable locally by the
   same command.
2. **`npm test` must exit.** Watch mode is not the default — a command that never returns cannot be
   a CI gate.
3. **`npm run build` is the deployment command.** Whatever the eventual host runs, it runs this.
   Principle III requires CI to build with the same command, so it must not grow host-specific
   behavior.
4. **`npm run lint` includes the formatting check**, so formatting drift fails CI rather than
   accumulating (FR-010a). `npm run format` is the fix; `npm run lint` is the verdict.
5. **No gate may reach the network.** Tests especially: no network, no wall-clock dependence, no
   timezone or locale dependence.
6. **`npm ci`, not `npm install`, in CI.** `ci` installs from the lockfile and fails if
   `package.json` and the lockfile disagree, which is the property FR-008 is asking for.

## What later features may rely on

- These names existing and meaning what the table says.
- All four gates passing on `main` at all times.
- Being able to add a test file anywhere under `src/` and have `npm test` pick it up with no
  configuration change.
- Being able to run `npx shadcn@4.19.0 add <component>` and get a working component with no
  configuration change (FR-037).
