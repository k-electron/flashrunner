<!--
SYNC IMPACT REPORT
==================
Version change: 1.5.0 → 1.6.0
Bump rationale: MINOR. Principle III's runtime-pin rule described a mechanism that does not
                exist, and inverted the required action.

Why: the rule read "pinned identically in .nvmrc, engines, CI workflow, and Pages env" — four
     copies kept in sync by hand. Checking it (001-deck-runs T049, 2026-08-23) found there is no
     fourth copy. The deploy platform's build image reads .nvmrc directly, and no version
     variable is set. So the pin propagates by construction from a single source of truth.

     This matters beyond wording. The old rule told you to SET a version in the host; the actual
     requirement is the opposite — do NOT set one, because a host-side copy is precisely what can
     drift out of step with the repo. Absence is the guarantee, and absence cannot fall out of
     date. A rule that instructs the failure mode it exists to prevent is mis-specified.

     Also drops the vendor name from the rule, per the maintainer's constraint that this repo stay
     general purpose. The requirement is about the deploy platform, whichever one it is; naming
     one in a normative rule made the rule unusable if the host ever changes. Cloudflare is still
     named in Principle I and Stack & Deployment, which describe today's deployment as fact rather
     than imposing a rule.

Modified principles:
  III. Green CI or It Does Not Merge — runtime-pin bullet rewritten: one source of truth
       (`.nvmrc`), host derives from it, host-side version variables prohibited rather than
       required. Every other bullet unchanged: triggers, the install→lint→typecheck→test→build
       sequence, matching the deploy build command, red-blocks-merge, the lockfile rule, and the
       ubuntu-latest-only rule all stand.

Added sections: none.
Removed sections: none.

Triggering case: 001-deck-runs T049. Build system version 3, no NODE_VERSION variable in either
                 environment, build log reports "Installing nodejs 26.7.0" — matching .nvmrc,
                 engines.node, and the workflow's node-version-file.

Deferred TODOs: none.

Prior history:
  1.5.0 → see below.

SUPERSEDED REPORT (1.4.0 → 1.5.0)
================================
Bump rationale: MINOR. Principle VIII's license rule changed from a gate into a fast-path, and
                OFL-1.1 was added to the pre-cleared set.

Why: the allowlist was being read as "anything unlisted requires amending this document." That
     made every ordinary dependency question into a governance event. Within a single day it had
     produced one amendment for a Node version and was about to produce another for a font — at
     which point the process is the obstacle, not the safeguard.

     The maintainer's correction, 2026-08-22: unlisted licenses should be asked about in
     conversation, confirmed, and moved past. The list is there to skip the question when the
     answer is obvious, not to require ceremony when it is not.

     This is intended to be the last amendment of its kind. A rule that generates an amendment
     per dependency was mis-specified, not under-enforced.

Modified principles:
  VIII. Free, Open, Reputable, Stable — allowlist reframed as pre-cleared licenses; unlisted
        licenses are now explicitly a question rather than a block, resolved by asking and
        recording the answer in the PR. OFL-1.1 added, since effectively every open font uses it
        and it constrains only the font, never the code that renders it. Added the clarifying
        line: "Stop and ask" means ask. It does not mean stop.

        The reputable rule, the stable rule, the lockfile rule, the asset-review rule, and the
        pre-release prohibition are unchanged.

Added sections: none.
Removed sections: none.

Triggering case: shadcn/ui's default theme vendors the Geist font under OFL-1.1. Approved for use
                 by the maintainer, and OFL-1.1 added to the pre-cleared set rather than recorded
                 as a one-off exception.

Deferred TODOs: none remaining.
  - TODO(DEP_LICENSES) is discharged. 000-scaffold produced the first real dependency tree; all
    515 packages are enumerated by license in specs/000-scaffold/research.md section 6.

Prior history:
  1.4.0 — Principle VIII's "Stable" rule admits a Current runtime line whose LTS date is within
          six months, judged by release dates rather than by today's badge.
  1.3.2 — Removed prohibition bullets from Principle VIII that the allowlist already covered.
  1.3.1 — Principle VIII's license rule corrected: banlist (BSL/SSPL/Elastic/Commons Clause)
          replaced by an allowlist. The banlist was aimed at managed-service restrictions
          irrelevant to a bundled client app and omitted copyleft entirely.
  1.3.0 — Added Principles VII (self-contained tooling) and VIII (dependency policy).
  1.2.1 — Condensed from 284 lines of prose to a scannable one-pager. No rule changes.
  1.2.0 — Corrected Principle I. Cloudflare Pages does SPA fallback natively when the output has
          no top-level 404.html, so the previously mandated `_redirects` catch-all was
          unnecessary and unsafe. Now prohibited.
  1.1.0 — Added Principle VI. Pre-approved Tailwind, shadcn/ui, React Router in Principle V.
  1.0.0 — Initial ratification.
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
- Runtime version has ONE source of truth in the repo: `.nvmrc`. `engines` and CI follow it, and
  the deploy platform MUST derive from it rather than declare its own. A host-side version
  variable is a second copy that can drift — its absence is the guarantee, so do not add one.

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

- **Pre-cleared licenses — MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, OFL-1.1.** Use these
  without asking. The list exists to skip the question, not to gate the answer.
- **Anything outside the list is a question, not a block.** Ask, get an answer, record it in the
  PR, move on. Using an unlisted license does **not** require amending this document. If one keeps
  coming up and keeps being approved, add it to the list — that is bookkeeping, not governance.
- **Assets are reviewed separately from packages.** Icons and fonts carry their own licenses, so
  reading `package.json` does not discharge this rule. OFL-1.1 is pre-cleared because effectively
  every open font uses it, and it constrains only the font — never the code that renders it.
- **Reputable:** actively maintained, real adoption, a release within the last 12 months, and no
  deprecation notice. Abandonware and single-author packages with no usage do not qualify.
- **Stable:** LTS where the project publishes an LTS line (Node), otherwise latest stable.
  A Current line with a **published LTS date within six months** counts as LTS for this rule, and
  is preferred over an LTS line that enters maintenance before that date. Check the dates, not
  today's label — the goal is the runtime with the longest support ahead of it, not the one
  wearing the badge right now. No alpha, beta, RC, canary, `next`, or `0.0.x` packages in runtime
  dependencies.
- Exact versions come from the committed lockfile. Version ranges in `package.json` do not
  override this.
- Adding a dependency means recording its license in the PR. An unclear license is a no.
- "Stop and ask" means ask. It does not mean stop.
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

**Version**: 1.6.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-23
