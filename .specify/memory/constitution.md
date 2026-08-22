<!--
SYNC IMPACT REPORT
==================
Version change: 1.3.1 → 1.3.2
Bump rationale: PATCH. Removed prohibition bullets from Principle VIII that the allowlist already
                covers. Naming GPL/AGPL/LGPL, proprietary SDKs, and non-commercial asset licenses
                as separate bans was redundant, and implied the ban list was exhaustive — which is
                the exact failure mode the allowlist exists to avoid. Nothing permitted changed:
                every one of those was already excluded by not appearing in the allowlist.

Prior history:
  1.3.1 — Principle VIII's license rule was mis-aimed at v1.3.0 and was corrected.
                The banned set (BSL, SSPL, Elastic, Commons Clause) restricts reselling software
                as a managed service, applies almost exclusively to databases and infrastructure,
                and was irrelevant to a bundled client-side app. Copyleft — the one license class
                that genuinely reaches a shipped JS bundle — was absent. Replaced with a five-
                license allowlist plus an explicit copyleft prohibition. The intent of the
                principle is unchanged, so this is PATCH rather than MINOR.

Corrected in this version:
  VIII. Free, Open, Reputable, Stable — banlist replaced by allowlist (MIT, Apache-2.0,
        BSD-2-Clause, BSD-3-Clause, ISC); GPL/AGPL/LGPL explicitly prohibited in shipped code;
        icon and font assets called out as requiring separate license review.

Prior history:
  1.3.0 — Added Principles VII (self-contained tooling) and VIII (dependency policy).

Added principles:
  VII. Self-Contained, No Host Pollution — all tooling lives in the repo; host prerequisites
       are git + Node only; no global installs.
  VIII. Free, Open, Reputable, Stable — OSI licenses only; maintained packages; LTS or latest
        stable; no pre-release in runtime deps.

Modified sections:
  Workflow & Gates — dependency gate now also requires license/maintenance/channel; notes that
  CI enforces Principle VII by construction (clean runners).
  Stack & Deployment — states host prerequisites explicitly.

  1.2.1 — Condensed from 284 lines of prose to a scannable one-pager. No rule changes.
  1.2.0 — Corrected Principle I. Cloudflare Pages does SPA fallback natively when the output
          has no top-level 404.html, so the previously mandated `_redirects` catch-all was
          unnecessary and unsafe (redirects outrank static assets). Now prohibited.
  1.1.0 — Added Principle VI. Pre-approved Tailwind, shadcn/ui, React Router in Principle V.
  1.0.0 — Initial ratification.

Deferred TODOs:
  - TODO(DEP_LICENSES): exact license of each dependency is recorded at scaffold time, once
    `npm ls` can enumerate the real tree. Not asserted here from memory.
  - TODO(NODE_VERSION): pin value chosen at scaffold time; must match in all four places
    listed under Principle III.
  - TODO(TAILWIND_VERSION): v3 and v4 differ materially in setup. Confirm against current
    docs at scaffold time.
-->

# FlashRunner Constitution

Flashcard training tool. Vite + React SPA, localStorage only, static on Cloudflare Pages.
This governs how it is built. The maintainer defines what gets built.

## I. Client-Only Static SPA

- `npm run build` → self-contained `dist/`. No server, no SSR, no Workers/Functions, no API.
- No code may assume a same-origin API exists.
- **Any** server-side execution is a MAJOR amendment. Includes React Router framework mode.
- React Router in browser/SPA mode only (`createBrowserRouter` / `<BrowserRouter>`).
- Output MUST NOT contain a top-level `404.html` — its absence is what keeps Pages in SPA mode.
- No `_redirects` catch-all. Redirects outrank static assets and can shadow the bundle.
- Verify deep links on a real preview deploy. The dev server hides this failure.

## II. localStorage Is the System of Record

- All keys namespaced `flashrunner:`. All payloads carry an integer `schemaVersion`.
- One storage module. Direct `localStorage.getItem`/`setItem` elsewhere = review failure.
- Treat storage as hostile: absent, disabled, full, corrupt JSON from an old build. Every case
  degrades to a working app with defaults. Never a blank screen on boot.
- Handle `QuotaExceededError` explicitly and surface it. It is a normal condition.
- `schemaVersion` bump ships a migration + a test starting from real prior-version data.
- Nothing transmits stored user data off-device.

## III. Green CI or It Does Not Merge

- Triggers: PRs, and pushes to `main`.
- Runs: install from lockfile → lint → typecheck → test → build.
- CI build uses the same command Cloudflare Pages runs.
- Red blocks merge. Fix or revert; never merge intending to fix later.
- Lockfile committed. Clean-checkout `npm ci` must succeed.
- `ubuntu-latest` standard runners only. No paid or self-hosted runners.
- Runtime version pinned identically in `.nvmrc`, `engines`, CI workflow, and Pages env.

## IV. Test Behavior, Not Implementation

- Required: storage module, every migration, every pure function transforming user data.
- Component tests query by role/label/visible text. No class names, internals, or snapshots.
- Every bug fix adds a test that fails against the unfixed code.
- Headless, no network, no wall-clock or timezone dependence.
- Full TDD optional. The coverage above and failing-test-first on fixes are not.
- Vendored shadcn/ui components exempt; covered via the features using them.

## V. Minimal Dependency Surface

Pre-approved, no justification needed:

| Dep | Note |
|---|---|
| Tailwind CSS | styling |
| shadcn/ui | + Radix primitives, `cva`, `clsx`, `tailwind-merge`, icons. Vendored as source — it is project code, subject to every rule here |
| React Router | browser/SPA mode only |

Everything else:

- Prefer platform and React built-ins. `useState`/`useReducer`/context until proven insufficient.
- New runtime dep → justify in the PR: what it does, what it replaces, why hand-rolling is worse.
- No state-management or data-fetching library speculatively. There is no backend.
- No known-unpatched vulns. Patch or remove; do not annotate and ignore.
- Remove unused deps, including vendored components no screen renders.

## VI. Build Only What Was Asked

- Implement the stated requirement and stop. No adjacent features, options, or settings.
- If something adjacent seems necessary: name it and ask. Do not build it and explain after.
- Simplest implementation that satisfies the requirement. Abstraction is earned by a second
  real use case, not predicted from the first.
- "While I was in there" changes go in their own PR, if anywhere.
- A PR that implements more than its description is rejected on that basis alone.

## VII. Self-Contained, No Host Pollution

- Host prerequisites are **git and Node at the pinned version. Nothing else.**
- Every framework, tool, and binary the project needs is declared in `package.json` and
  installed into `./node_modules`. Nothing is installed globally.
- `npm install -g` is prohibited. One-shot CLIs (`shadcn`, `create-vite`) run via `npx`.
- No Homebrew, apt, system package, or manually installed SDK may be required to build, test,
  or run this project.
- Node is selected per-project via `.nvmrc`, never by mutating a system-wide Node.
- No build step writes outside the repo folder, and nothing may depend on state in `$HOME`.
  Package-manager caches are exempt — but a cold cache MUST still produce a working build.
- Removing this project = deleting the folder. Nothing is left behind on the machine.
- Acceptance test: clean machine with only git + Node → clone → `npm ci` → `npm test` →
  `npm run build` succeeds. CI enforces this automatically, since runners are fresh hosts.

## VIII. Free, Open, Reputable, Stable

- **License allowlist — MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.** Anything outside these
  five stops and gets asked about. It is an allowlist because the disallowed set cannot be
  enumerated in advance; these five can. The list is short because everything here is bundled into
  the JS shipped to every visitor.
- **Assets are reviewed separately from packages.** Icons and fonts carry their own licenses that
  are usually none of the five above, so reading `package.json` does not discharge this rule.
- **Reputable:** actively maintained, real adoption, a release within the last 12 months, and no
  deprecation notice. Abandonware and single-author packages with no usage do not qualify.
- **Stable:** LTS where the project publishes an LTS line (Node), otherwise latest stable. No
  alpha, beta, RC, canary, `next`, or `0.0.x` packages in runtime dependencies.
- Exact versions come from the committed lockfile. Version ranges in `package.json` do not
  override this.
- Adding a dependency means recording its license in the PR. An unclear license is a no.
- The pre-approved stack in Principle V is all OSI-permissive and satisfies this principle.

## Stack & Deployment

Vite · React · TypeScript (`strict`) · Tailwind · shadcn/ui · React Router · Vitest + React
Testing Library · npm with committed `package-lock.json`.
All of it local to the repo. Host
prerequisites: git + Node at the pinned version, nothing else.

- Prod: Cloudflare Pages from `main` of public repo `k-electron/flashrunner`.
- Build `npm run build` → output `dist`.
- PRs get Pages preview URLs. Previews are where deep links and real `localStorage` get verified.
- Rollback = redeploy a previous deployment. No migration step. Preserve this property.
- No secrets in the bundle. Vite inlines every `VITE_` var into shipped JS, so `VITE_` means
  public. This app needs no secrets; needing one means Principle I is being violated.

## Workflow & Gates

- `main` is deployable. Branch → PR.
- Merge gates, all required: CI green, successful Pages preview, human review.
- PR description states what was asked for. Principle VI is checked against it.
- Dep outside the pre-approved set → Principle V justification **and** its license,
  maintenance status, and release channel per Principle VIII.
- CI is the enforcement mechanism for Principle VII: runners are clean hosts, so a build
  that needs a global install fails there by construction.
- Persisted shape change → `schemaVersion` bump + migration + migration test.
- Reviewers check constitution compliance, not just correctness. "It works" is not sufficient.
- Violating a principle requires stating which one, why simpler fails, and the exit path.

## Governance

- This document supersedes ad hoc convention. Amend it or follow it.
- Amendments: PR modifying this file, with rationale, version bump, and updated Sync Impact
  Report. If it invalidates existing code, include the migration plan.
- **MAJOR** — principle removed or redefined so compliant work becomes non-compliant. Any
  server-side execution is explicitly MAJOR. **MINOR** — principle/section added or materially
  changed. **PATCH** — clarification and wording only.
- Every PR review is a compliance review.
- A principle that is routinely waived gets enforced or amended. A rule that is always
  excepted makes the whole document untrustworthy.

**Version**: 1.3.2 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-22
