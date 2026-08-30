# Contract: the deck screen, `/deck/:deckId`

What this screen renders and what each thing is called. This is the surface the
component tests assert against — everything below is observable by role and visible
text, with no class names and no internals (Principle IV).

Only the parts this feature changes are specified. The heading, the "Deck mastered"
line, the "All decks" link, and the "Deck not found" screen are unchanged.

## The ladder

A list of one item per level, **in reverse ladder order**: the highest level first,
`Level 1` last. Reading order, tab order, and visual order are identical — the reversal
is in the DOM, not only in the paint.

Every level in the deck appears, startable or not. The ladder is legible in full from
the first visit; this is unchanged.

### Level names

Read from `RungConfig.label`. Per deck, in ladder order: `Level 1` … `Level N-1`, then
`Full deck` for the highest. No level is named by its card count on this screen or any
other.

| Deck | Ladder, top to bottom |
|---|---|
| `dolch-prek-5` | `Full deck`, `Level 7` … `Level 1` |
| `dolch-k-5` | `Full deck`, `Level 9` … `Level 1` |

No deck's highest level adds only a part-step to the one below it; where it would, the
two are authored as a single level (data-model.md, "The remainder collapse").

### Startability

A level is startable exactly when **every level below it has been completed**. `Level 1`
is always startable.

| State | Renders as | Accessible name |
|---|---|---|
| Startable | a link to `/deck/:deckId/rung/:rungId` | the level name |
| Not startable | a disabled button | the level name |

The accessible name is the level name and nothing else, in both states — no
"Completed", no "Resume", no icon text.

This rule governs **this screen only**. `/deck/:deckId/rung/:rungId` starts the run for
any level regardless of what this screen would offer (FR-008). Nothing here redirects,
blocks, or warns.

### The completion mark

A level whose id is in `completedRungIds` renders a `CircleCheck` **inside** its own
control, immediately left of the level name, `aria-hidden`. Present in both the
startable and the not-startable states.

The control's content stays centre-justified. On a row that also carries `Start over`,
that is what keeps the mark near the middle of the level control rather than pressed up
against the button beside it.

The mark is permanent: it survives a replay in progress, a replay abandoned, and a
replay with failed cards. There is no state in which a level that has been completed
renders without it.

There is no separate "Completed" text anywhere on this screen.

## A level with an unfinished run

Exactly one level can be in this state at a time (one run per deck).

**When that level is startable**, its list item is a single row containing exactly two
controls and no other text:

| Position | Control | Behaviour |
|---|---|---|
| left, narrower | button, named `Start over` | discards the stored run and navigates to `/deck/:deckId/rung/:rungId` |
| right, wider | the level's own control, named by the level | navigates to `/deck/:deckId/rung/:rungId`, where the run screen resumes the stored run |

Both controls lead to the same URL. The difference is only whether the stored run is
discarded first. `Start over` keeps its current visual treatment (the secondary
variant).

No caption, status text, or third control appears in the row. There is no control
named `Resume`.

**When that level is not startable** — reachable only by having started the run from a
URL — the row is the level's control alone, not startable, with no `Start over`.

**A level with no unfinished run** is a single row containing its own control, full
width.

## Invariants

- The startable levels always form an unbroken run from `Level 1` upward. There is
  never a startable level above a not-startable one, for any stored progress.
- Reading top to bottom, level numbers strictly decrease and `Full deck` is first.
- Every list item is one row, the same height as every other.
- `Start over` leaves `completedRungIds` exactly as it found it, and touches no other
  deck's record.
