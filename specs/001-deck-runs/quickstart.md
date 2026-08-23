# Quickstart: Validating Deck Runs

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

How to prove this feature works. Automated checks first, because most of the mechanic is pure and
does not need a browser; the manual passes cover only what automation genuinely cannot reach.

---

## Prerequisites

The `000-scaffold` feature has landed, so every command below exists on `main`.

```bash
node --version          # must report v26.7.0 — `nvm use` reads .nvmrc
npm ci                  # clean install from the committed lockfile
```

Node 26.7.0 is the pin, chosen partly because it is already the maintainer's default — so this
is usually a no-op rather than the `nvm use` step people forget. On any other machine it is not.

---

## Automated

```bash
npm test                # Vitest — unit + component
npm run typecheck       # tsc -b --noEmit — strict, over both project references
npm run lint
npm run build           # must emit dist/ with no top-level 404.html
```

### What the unit tests must cover

**Deck validation** (`src/decks/validate.test.ts`) — V1–V7 from
[data-model.md](./data-model.md#validation-rules-fr-003-fr-004), each with a deliberately
malformed fixture, plus a pass over the real registry so a bad built-in deck fails CI.

The registry pass is the executable form of SC-005: every rung above the smallest contains 100%
of the rung below.

**Run engine** (`src/run/reducer.test.ts`) — invariants I1–I6. These are plain function calls, no
rendering:

| Scenario | Asserts | Covers |
|---|---|---|
| 5 cards, all `got-it` on cycle 0 | completes immediately, `cycleIndex` never leaves 0 | US1 #1 |
| 5 cards, 2 failed | cycle 1's queue is exactly those 2, in fail order | US1 #2, SC-003 |
| cycle of 2, 1 pass 1 fail | cycle 2 holds exactly the 1 still-failed card | US1 #3 |
| last failed card passed | `status` flips to `complete` | US1 #4, SC-004 |
| card passed in cycle 0 | never appears in any later queue | US1 #5, I1 |
| every card failed, 50 cycles | no error, no cap, queue stays whole | I4, edge case |
| completion | `passedThisRun` equals the rung's full card set | I3 |

**Storage** (`src/storage/*.test.ts`) — the highest-risk surface, since a bug here destroys a
child's progress with no backup:

- round-trip: write a record, read it back unchanged
- **unknown field survives a write** — seed `{"futureThing": 42}`, complete a rung, assert
  `futureThing` is still 42 (G4 / FR-041)
- missing field defaults rather than rejecting (G2 / FR-039)
- corrupt JSON in one deck's key leaves other decks readable
- `QuotaExceededError` is caught and surfaced, and the run keeps working in memory
- `run` referencing a removed rung is dropped while `completedRungIds` survives

### What the component tests must cover

Queried by role and visible text only — no class names, no snapshots (Principle IV):

- the run screen shows the current card's `front`, both outcome buttons by their accessible
  names ("Got it" / "Not yet"), and the remaining-in-cycle count (FR-013)
- a deck with an unfinished run shows **Resume and Start over together** on the ladder (FR-031)
- Start over is reachable from inside a run (FR-033)
- a rung renders as visible but not startable exactly when its immediate predecessor is not
  completed — completing rung 1 must leave rung 2 startable and rung 3 locked (FR-015, US2 #4)

---

## Manual passes

Three things automation cannot honestly cover.

### 1. Deep links on a real deploy — Principle I

The dev server resolves any path and will happily hide a broken deployment. This must be checked
on the PR's Cloudflare Pages preview URL, not locally.

1. Open the preview URL, navigate to a run, copy the address bar.
2. Paste it into a fresh tab. It must load the run, not a 404.
3. Reload with F5 on `/deck/dolch-prek-5/rung/r3`. Same.
4. Confirm the build output has no top-level `404.html` and no `_redirects` file.

### 2. Persistence across a real browser restart — SC-006, SC-011

The automated suite never exercises a real `localStorage` at all. Under Node 26 the runtime's own
`localStorage` getter shadows jsdom's and yields `undefined` unless the process was started with
`--localstorage-file`, so `safeStorage` runs on its in-memory fallback map for the whole suite.
That makes this pass matter more, not less: the test environment is further from a real browser
than "jsdom fakes it" would suggest, and only a real browser proves the round trip.

1. Complete rung 1 of Dolch Pre-K, start rung 2, mark two cards.
2. Quit the browser entirely — not just the tab.
3. Reopen. The deck shows rung 1 complete and offers to resume rung 2 at card 3, with the two
   already-marked cards not re-presented (SC-009).

### 3. Two decks in parallel — SC-013

1. Start Dolch Pre-K rung 2, mark two cards, go home.
2. Start Dolch Kindergarten rung 1, mark one card, go home.
3. Return to Dolch Pre-K. Same rung, same cycle, same card — untouched (FR-036).

---

## Success criteria coverage

| Criterion | Verified by |
|---|---|
| SC-001 open → first card < 15s | manual, no setup step exists to slow it |
| SC-002 marking feels immediate | by construction — synchronous reducer + one sync write |
| SC-003 failed reappear / passed do not | run engine tests I1, I2 |
| SC-004 success only when all passed | run engine test I3 |
| SC-005 rung containment | validator V6 over the real registry |
| SC-006 progress survives close | manual pass 2 |
| SC-007 new deck = config only | contract; adding a deck touches no engine file |
| SC-008 adult sees cards remaining | component test on the cycle counter |
| SC-009 resume at exact point | storage round-trip test + manual pass 2 |
| SC-010 two-sided deck needs no edits | `back?` is optional — a type-level guarantee |
| SC-011 0% loss on upgrade | storage tests G2/G3/G4 |
| SC-012 new field needs no migration | G1/G4 tests |
| SC-013 switch decks and return | manual pass 3 |
| SC-014 resume in ≤3 taps | route tree is exactly deck → rung → resume |
| SC-015 start over costs no mastery | component test: restart clears `run`, leaves `completedRungIds` |

---

## Reviewing the deck content

Ordering is judgment, not code. Both ladders are laid out rung by rung in
[research.md §4](./research.md#4-dolch-word-list-content-and-ordering) — read those two tables
rather than the config files. Reordering is a config edit and breaks nothing.
