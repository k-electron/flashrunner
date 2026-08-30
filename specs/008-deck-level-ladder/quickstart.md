# Quickstart: verifying the deck screen level ladder

Prerequisites: Node 26.7.0 (`.nvmrc`), `npm ci` run once. Nothing else — see
constitution Principle VII.

## Automated

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

The same sequence CI runs. `npm test` is the gate that matters here; the rest catch
collateral.

**Expected**: green. Before the source changes land, the updated assertions in
`src/decks/ladder.test.ts`, `src/routes/DeckLadder.test.tsx`, and
`src/routes/DeckList.test.tsx` should fail — see research.md D7 for which ones and why
each is a deliberate change rather than a break.

## By hand

```bash
npm run dev
```

The deck screen is at `/deck/dolch-prek-5` (8 levels) — the shorter ladder, so the
whole thing fits one screen. Progress lives in `localStorage` under
`flashrunner:deck:dolch-prek-5`.

To put the app in a given state, set that key from the browser console and reload:

```js
// no progress
localStorage.setItem('flashrunner:deck:dolch-prek-5',
  JSON.stringify({ schemaVersion: 1, completedRungIds: [], run: undefined }));

// climbed in order to Level 3
localStorage.setItem('flashrunner:deck:dolch-prek-5',
  JSON.stringify({ schemaVersion: 1, completedRungIds: ['r1','r2','r3'], run: undefined }));

// Kindergarten at the old top of the ladder, r10 included (key: flashrunner:deck:dolch-k-5)
// completed Level 5 out of order — the URL-skip case
localStorage.setItem('flashrunner:deck:dolch-prek-5',
  JSON.stringify({ schemaVersion: 1, completedRungIds: ['r5'], run: undefined }));

// start fresh
localStorage.clear();
```

An unfinished run is easier to make than to write: open a level, answer one or two
cards, then navigate back to the deck screen.

### What to look for

| # | Do this | Expect | Covers |
|---|---|---|---|
| 1 | Open `/deck/dolch-prek-5` with no progress | Reading top to bottom: `Full deck`, `Level 7` … `Level 1`. No "words" anywhere. | FR-001–003, FR-005 |
| 1b | Open `/deck/dolch-k-5` | **Ten** levels: `Full deck`, `Level 9` … `Level 1`. There is no `Level 10`. | FR-020 |
| 2 | Same screen | Only `Level 1` is tappable. Everything above is greyed. | FR-006 |
| 3 | Open `/` | Each deck's line reads `Not started · Next run: Level 1` | FR-003 |
| 4 | Play `Level 1` through to the end, return to the deck screen | `Level 1` carries a check; `Level 2` is now tappable; `Level 3` is not | FR-006, FR-015 |
| 5 | Start `Level 2`, answer one card, go back | `Level 2` is **one row**: `Start over` on the left, a wider `Level 2` on the right. No other text in the row. | FR-009, FR-010, FR-011 |
| 6 | Tap the `Level 2` button | The run resumes on the card you stopped on — not the first card | FR-012 |
| 7 | Go back, tap `Start over` | A fresh run of `Level 2` from the first card. Return to the deck screen: `Level 1` still checked, `Level 2` still tappable, no run to resume. | FR-013 |
| 8 | Replay the completed `Level 1`, fail a card, leave mid-run | `Level 1` still carries its check | FR-016 |
| 9 | Seed `completedRungIds: ['r5']`, open the deck screen | `Level 5` carries a check **and is not tappable**. `Level 1` is tappable, `Level 2` upward is not. No gap: the tappable levels run unbroken from the bottom. | FR-006, FR-007 |
| 10 | From that state, go straight to `/deck/dolch-prek-5/rung/r5` | The run plays normally. This is intended. | FR-008 |
| 11 | Narrow the window to ~360px on the state from step 5 | The two controls stay side by side on one line | SC-004 |
| 12 | Tab through the deck screen | Focus moves in the same order you read — `Full deck` first, `Level 1` last | FR-005, research.md D3 |
| 13 | Seed `dolch-k-5` with `completedRungIds: ['r1'...'r10']` (the pre-collapse top), open it | `Level 1`–`Level 9` all checked, `Full deck` startable and unchecked. The removed `r10` costs nothing. | FR-021 |
| 14 | Seed `dolch-k-5` with `completedRungIds: ['r11']` | `Deck mastered` still shows | FR-021 |

Step 9 and step 10 together are the whole point of the clarification: the ladder is
tidy, and the URL still works.

### Screen reader

Karim waives screen-reader verification. The check to run if anyone wants it: each
level control announces only its level name (`Level 3`), never `Level 3 completed` or
`circle check Level 3`. This is also asserted by `getByRole('link', { name: 'Level 3' })`
in the component tests, so a regression fails CI regardless.

## Details

Level naming and what is authored vs derived: [data-model.md](./data-model.md).
Exactly what the screen renders: [contracts/deck-screen.md](./contracts/deck-screen.md).
Why each approach was chosen: [research.md](./research.md).
