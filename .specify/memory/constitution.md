<!--
SYNC IMPACT REPORT
Version: 1.6.0 → 2.0.0. MAJOR: rules removed from every principle, so work that was
non-compliant under 1.6.0 may be compliant now. 248 lines → 134, ~100 of the old lines
being accumulated amendment history.

Modified principles:
  I    dropped the no-same-origin-API bullet; merged the 404.html and _redirects rules.
  II   dropped the QuotaExceededError and no-off-device-transmission bullets.
  III  dropped the lockfile and ubuntu-latest bullets; folded the deploy-command rule into
       the CI sequence. The .nvmrc single-source rule stands.
  IV   renamed "Test Behavior, Not Implementation" → "Test Real Outcomes, Not Restatements".
       Now about brittleness rather than banned mechanisms: change-detector and tautological
       tests are the target, structural queries are allowed where no accessible handle exists.
  V    pre-approved table → one line; dropped the speculative-state-library bullet.
  VI   5 bullets → 3.
  VII  dropped four bullets that restated "git and Node, nothing else".
  VIII 9 bullets → 2. Dropped the 6-month LTS clause, asset review, lockfile precedence.

Removed sections: none. Stack & Deployment, Workflow & Gates, and Governance each lost
bullets that restated principles I-VIII.

Deferred TODOs: none. Prior history: `git log --follow .specify/memory/constitution.md`
-->

# FlashRunner Constitution

Flashcard training tool. Vite + React SPA, localStorage only, static on Cloudflare Pages.
This governs how it is built. The maintainer defines what gets built.

## I. Client-Only Static SPA

- `npm run build` → self-contained `dist/`. No server, no SSR, no Workers/Functions, no API.
- **Any** server-side execution is a MAJOR amendment. Includes React Router framework mode.
- React Router in browser/SPA mode only (`createBrowserRouter` / `<BrowserRouter>`).
- Output MUST NOT contain a top-level `404.html` or a `_redirects` catch-all. The 404's absence
  is what keeps Pages in SPA mode, and redirects outrank static assets, so a catch-all can
  shadow the bundle.
- Verify deep links on a real preview deploy. The dev server hides this failure.

## II. localStorage Is the System of Record

- All keys namespaced `flashrunner:`. All payloads carry an integer `schemaVersion`.
- One storage module. Direct `localStorage.getItem`/`setItem` elsewhere = review failure.
- Treat storage as hostile: absent, disabled, full, corrupt JSON from an old build. Every case
  degrades to a working app with defaults. Never a blank screen on boot.
- `schemaVersion` bump ships a migration + a test starting from real prior-version data.

## III. Green CI or It Does Not Merge

- Triggers: PRs, and pushes to `main`.
- Runs: install from lockfile → lint → typecheck → test → build, using the same build command
  the deploy platform runs.
- Red blocks merge. Fix or revert; never merge intending to fix later.
- Runtime version has ONE source of truth in the repo: `.nvmrc`. `engines` and CI follow it, and
  the deploy platform MUST derive from it rather than declare its own. Do not add a host-side
  version variable — it is a second copy that can drift.

## IV. Test Real Outcomes, Not Restatements

- Test outcomes. Not restatements of the implementation, not change-detector tests.
- Required: storage module, every migration, every pure function transforming user data.
- Query by role, label, or visible text where one exists. Structure only when there is no
  accessible handle. No snapshots.
- Every bug fix adds a test that fails against the unfixed code.
- No network, no wall-clock or timezone dependence.
- Test first-party code. Vendored components get covered via the features using them.

## V. Minimal Dependency Surface

- Pre-approved, no justification needed: Tailwind CSS; shadcn/ui with Radix primitives, `cva`,
  `clsx`, `tailwind-merge`, and icons (vendored as source, so it is project code subject to every
  rule here); React Router in browser/SPA mode.
- Prefer platform and React built-ins. `useState`/`useReducer`/context until proven insufficient.
- New runtime dep → justify in the PR: what it does, what it replaces, why hand-rolling is worse.
- No known-unpatched vulns. Patch or remove; do not annotate and ignore.
- Remove unused deps, including vendored components no screen renders.

## VI. Build Only What Was Asked

- If something adjacent seems necessary: name it and ask. Do not build it and explain after.
- Prefer simple, straightforward implementations. Avoid premature abstraction.
- Avoid piggybacking unrelated changes.

## VII. Self-Contained, No Host Pollution

- Host prerequisites are **git and Node at the pinned version. Nothing else.**
- Node is selected per-project via `.nvmrc`, never by mutating a system-wide Node.
- No build step writes outside the repo folder, and nothing may depend on state in `$HOME`.
  Package-manager caches are exempt — but a cold cache MUST still produce a working build.
- Acceptance test: clean machine with only git + Node → clone → `npm ci` → `npm test` →
  `npm run build` succeeds.

## VIII. Free, Open, Reputable, Stable

- Pre-cleared licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, OFL-1.1. Anything else,
  ask. Record the license in the PR.
- Prefer maintained, widely used packages on stable release channels. No pre-release versions in
  runtime dependencies.

## Stack & Deployment

Vite · React · TypeScript (`strict`) · Tailwind · shadcn/ui · React Router · Vitest + React
Testing Library · npm with committed `package-lock.json`.

- Prod: Cloudflare Pages from `main` of public repo `k-electron/flashrunner`. Build
  `npm run build` → output `dist`.
- PRs get Pages preview URLs. Previews are where deep links and real `localStorage` get verified.

## Workflow & Gates

- `main` is deployable. Branch → PR.
- Merge gates, all required: CI green, successful Pages preview, human review.
- Violating a principle requires stating which one, why simpler fails, and the exit path.

## Governance

- This document supersedes ad hoc convention. Amend it or follow it.
- Amendments: PR modifying this file, with rationale, version bump, and updated Sync Impact
  Report. If it invalidates existing code, include the migration plan.
- **MAJOR** — principle removed or redefined so compliant work becomes non-compliant. Any
  server-side execution is explicitly MAJOR. **MINOR** — principle/section added or materially
  changed. **PATCH** — clarification and wording only.

**Version**: 2.0.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-09-04
