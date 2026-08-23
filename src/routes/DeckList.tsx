// The deck list: /. Every built-in deck with the progress stored against it
// (FR-020, FR-021).
//
// Progress is read from storage and every judgement about it — the highest rung
// completed, what comes next, whether the deck is mastered — comes from
// src/decks/ladder.ts. This file derives nothing itself.
//
// The list walks the registry and looks up one key per known deck, so a record
// left behind by a deck that is no longer built in is simply never read (FR-022).
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { highestCompletedRung, isMastered, nextRung } from '@/decks/ladder';
import { decks } from '@/decks/registry';
import type { DeckConfig } from '@/decks/types';
import { readDeckRecord } from '@/storage/deckRecord';

export function DeckList() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">FlashRunner</h1>

      <ul className="flex flex-col gap-4">
        {decks.map((deck) => (
          <li key={deck.id} className="flex flex-col gap-2">
            {/* A deck opens its ladder, never a run directly — navigation is a
                tree, and the rung is chosen one level down (FR-034, SC-014). */}
            <Button asChild className="h-12 text-base" size="lg">
              <Link to={`/deck/${deck.id}`}>{deck.title}</Link>
            </Button>
            <DeckProgress deck={deck} />
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * One line naming where this deck stands and what it offers next, so the choice
 * of deck can be made without opening each one.
 */
function DeckProgress({ deck }: { deck: DeckConfig }) {
  const { completedRungIds } = readDeckRecord(deck);

  // Derived from the top rung, never stored (FR-017). A mastered deck has no
  // next run — every rung stays available to repeat, one level down.
  if (isMastered(deck, completedRungIds)) {
    return <p className="text-muted-foreground text-sm">Deck mastered</p>;
  }

  const highest = highestCompletedRung(deck, completedRungIds);
  const status = highest === undefined ? 'Not started' : `Completed ${highest.label}`;
  const next = highest === undefined ? deck.rungs.at(0) : nextRung(deck, highest.id);

  return (
    <p className="text-muted-foreground text-sm">
      {next === undefined ? status : `${status} · Next run: ${next.label}`}
    </p>
  );
}
