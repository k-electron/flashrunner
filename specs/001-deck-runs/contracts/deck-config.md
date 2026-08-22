# Contract: Deck Configuration Format

**Stability**: this is the app's authoring interface. Adding a deck means writing one of these
and registering it — nothing else. Any change that would force an existing deck config to be
edited is a breaking change to this contract.

**Serves**: FR-002, FR-003, FR-004, FR-005, FR-023, FR-024, SC-007, SC-010

---

## Shape

```ts
type DeckConfig = {
  id: string;                    // stable forever
  title: string;                 // shown to the adult
  cards: Array<{
    id: string;                  // stable within this deck
    front: string;               // the visible face
    back?: string;               // omit for single-sided decks
  }>;
  rungs: Array<{
    id: string;                  // stable within this deck
    label: string;               // shown on the ladder
    cardIds: string[];           // explicit membership, in presentation order
  }>;                            // ordered smallest → largest
};
```

## Rules an author must follow

1. **`id` is permanent.** Stored progress is keyed by it. Changing a deck's `id` orphans every
   learner's progress on that deck. If a deck's *ladder* changes, publish it as a **new deck with
   a new id** rather than re-laddering an existing one — that is why the ladder is named in the
   id (`dolch-prek-5`), not only in the title.
2. **Card `id`s are permanent within the deck.** They appear inside saved runs. Renaming one
   invalidates any in-progress run on that deck (the run is discarded; completed rungs survive).
3. **Rung `id`s are permanent within the deck.** They are what "this rung is completed" records.
4. **Every rung lists its cards literally.** Do not compute membership. A rung of 20 lists 20
   card ids. This is verbose on purpose: the ladder is reviewable by reading the config.
5. **Each rung contains every card of the rung below it.** Set containment, checked by V6.
6. **The last rung contains every card in the deck** — no more, no less. Checked by V7.
7. **Order within `cardIds` is presentation order.** Cards are shown in the order listed, and
   are not shuffled.

## Adding a two-sided deck later

Add `back` to that deck's cards. Nothing else changes:

```ts
// single-sided — a sight word is its own answer (FR-023)
{ id: 'w-the', front: 'the' }

// two-sided — same type, one more field (FR-024)
{ id: 'q-7x8', front: '7 × 8', back: '56' }
```

Existing configs are not touched (SC-010), and the run mechanic does not branch on it — the run
loop moves card ids through a queue and never inspects card content.

## Registering a deck

```ts
// src/decks/registry.ts
import { dolchPreK5 } from './dolch-prek-5';
import { dolchK5 } from './dolch-k-5';

export const decks = [dolchPreK5, dolchK5];
```

The deck list renders `decks` in order. Validation (V1–V7) runs across `decks` as a unit test, so
a malformed deck fails CI rather than reaching a learner.

## Worked example

Abridged — a real deck lists every id.

```ts
export const dolchPreK5: DeckConfig = {
  id: 'dolch-prek-5',
  title: 'Dolch Pre-K · Steps of 5',
  cards: [
    { id: 'a',   front: 'a' },
    { id: 'i',   front: 'I' },
    { id: 'the', front: 'the' },
    { id: 'and', front: 'and' },
    { id: 'to',  front: 'to' },
    { id: 'is',  front: 'is' },
    // … 34 more
  ],
  rungs: [
    { id: 'r1', label: '5 words',  cardIds: ['a', 'i', 'the', 'and', 'to'] },
    { id: 'r2', label: '10 words', cardIds: ['a', 'i', 'the', 'and', 'to', 'is', 'it', 'in', 'up', 'me'] },
    // … through r8, which lists all 40
  ],
};
```

## What this contract deliberately does not have

No `rungSize`, no `generateRungs()` helper, no deck-level difficulty or grade metadata, no
per-card tags or hints, no images or audio, no localization, and no authoring UI. Each was
considered and left out under Principle VI — none was asked for, and every one of them would
have to be honored forever once a deck config used it.
