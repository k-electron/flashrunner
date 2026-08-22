# Quickstart: Validating the Scaffold

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

The scaffold's whole job is to be verifiable, so most of this is mechanical.

---

## Prerequisites

Git and Node **26.7.0**. Nothing else.

```bash
node --version     # v26.7.0 — `nvm use` reads .nvmrc
```

---

## The four gates

```bash
npm ci
npm run lint        # lint + formatting check
npm run typecheck
npm test
npm run build
```

All four must pass on a fresh clone with no feature code (SC-002). This is the whole acceptance
test for the feature, and it is the same sequence CI runs.

---

## Proving each capability actually works

The point of the demonstration content is that these are observations, not assertions.

| Claim | How to see it fail if it were broken |
|---|---|
| Something renders | `npm run dev`, open the page — content appears |
| Hot reload works | Edit a route's text with the dev server running; the browser updates without a restart |
| Routing works | Click through from `/` to `/ping` |
| **Direct addressing works** | Build, serve `dist/` with a plain static server, request `/ping` **directly** — see below |
| Tests run *and can fail* | `npm test` passes; break an assertion on purpose and watch it go red |
| Component tests have a DOM | The component test queries by role — it could not pass without jsdom and RTL wired up |
| Styling is wired | The rendered page shows applied styles, not unstyled HTML (FR-038) |
| The build is self-contained | `dist/` served by a dumb file server, with no application logic, works |

### Direct addressing, specifically

```bash
npm run build
npx --yes serve -s dist -l 4173     # -s / --single = SPA fallback
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/ping
```

**The `-s` flag matters, and understanding why matters more.** A plain static file server has no
SPA fallback, so `/ping` correctly returns 404 there — that is the file server behaving properly,
not the build being broken. Cloudflare Pages supplies the fallback itself, which is precisely what
the absent top-level `404.html` enables. `serve -s` emulates Pages; `serve` on its own emulates a
dumb file host and will make a working build look broken.

So this check proves two separate things, and neither substitutes for the other:

| Check | Proves | Where it can be proven |
|---|---|---|
| `dist/` has no `404.html`, no `_redirects` | the host will *offer* SPA fallback | here, by inspection |
| `serve -s dist` resolves `/ping` and deeper paths | the router *accepts* what the host hands it | here, with fallback on |
| a real preview deploy resolves them | the host actually does it | only in the hosting feature |

**Do not use `npm run dev` for any of this.** The dev server resolves any path and hides the exact
failure the check exists to catch.

Also confirm by inspection:

```bash
ls dist/404.html            # must NOT exist — its absence is what keeps the host in SPA mode
ls dist/_redirects          # must NOT exist — redirects outrank static assets
```

---

## Proving nothing leaked onto the machine

```bash
npm ls -g --depth=0         # unchanged before and after
```

Then the real test, which needs a machine that has never built this project: clone, `npm ci`,
`npm test`, `npm run build`. CI does this automatically on every run, because runners are clean
hosts — which is why Principle VII says CI enforces it by construction.

Cold-cache check (SC-009): `npm cache clean --force` then `npm ci` still succeeds.

---

## Proving the demonstration content is disposable

```bash
rm -rf src/routes src/demo
```

Nothing in any configuration file references those paths by name, so only the router's imports
break — which is precisely what 001 replaces. If removing them required editing
`vite.config.ts`, `tsconfig.json`, or `vitest.config.ts`, FR-029 would be violated.

---

## Success criteria coverage

| Criterion | Verified by |
|---|---|
| SC-001 clone → rendered page, <5 min, ≤3 commands | README walkthrough on a clean machine |
| SC-002 all gates pass on a fresh clone | the four commands above |
| SC-003 identical versions across time | committed lockfile + `npm ci` |
| SC-004 / SC-005 / SC-018 automatic verdict, failures blocked | open a PR that breaks each gate in turn |
| SC-006 verdict under 5 minutes | CI run duration |
| SC-007 / SC-008 nothing leaks, deletion restores | `npm ls -g` before/after |
| SC-009 cold cache builds | `npm cache clean --force && npm ci` |
| SC-010 one runtime version, no drift | only `.nvmrc` and `engines` declare it; CI reads `.nvmrc` |
| SC-011 direct addressing | static-server check above |
| SC-012 plain static host works | same check |
| SC-013 demo content removable | `rm -rf` check above |
| SC-014 licenses recorded and allowed | `npm ls` enumeration in research.md |
| SC-015 CI on infrastructure that never built this | every CI run, by construction |
| SC-016 adding a component needs no config change | `npx shadcn add button` |
| SC-017 reuse terms stated | `LICENSE` exists |
