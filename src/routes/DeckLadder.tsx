// A deck's rung ladder: /deck/:deckId.
// Progress is read from storage and every judgement about it — what is startable,
// what is mastered — comes from src/decks/ladder.ts. This file derives nothing
// itself, which is what keeps the FR-015 unlocking rule in exactly one place.
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { isMastered, isStartable } from '@/decks/ladder';
import { deckById } from '@/decks/registry';
import { readDeckRecord } from '@/storage/deckRecord';

export function DeckLadder() {
  const { deckId } = useParams();
  const deck = deckId === undefined ? undefined : deckById(deckId);

  // A renamed deck or a stale bookmark — a plain message, never a blank screen.
  if (deck === undefined) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Deck not found</h1>
        <p className="text-muted-foreground text-sm">
          There is no such deck. It may have been renamed since this link was made.
        </p>
        <Link className="text-primary text-sm underline underline-offset-4" to="/">
          Back home
        </Link>
      </main>
    );
  }

  const { completedRungIds } = readDeckRecord(deck);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
        {/* Derived from the top rung, never stored (FR-017). */}
        {isMastered(deck, completedRungIds) && <p className="text-base">Deck mastered</p>}
      </header>

      <ul className="flex flex-col gap-3">
        {deck.rungs.map((rung, index) => (
          <li key={rung.id} className="flex items-center gap-3">
            {isStartable(deck, completedRungIds, index) ? (
              // Completed rungs land here too — they stay startable forever (FR-016).
              <Button asChild className="h-12 flex-1 text-base" size="lg">
                <Link to={`/deck/${deck.id}/rung/${rung.id}`}>{rung.label}</Link>
              </Button>
            ) : (
              // Visible, so the whole ladder is legible from the start, but not
              // startable until the rung below it has been completed (FR-015).
              <Button className="h-12 flex-1 text-base" size="lg" variant="secondary" disabled>
                {rung.label}
              </Button>
            )}
            {/* Outside the control, so its accessible name stays the rung label. */}
            {completedRungIds.includes(rung.id) && (
              <span className="text-muted-foreground text-sm">Completed</span>
            )}
          </li>
        ))}
      </ul>

      {/* Leaving a deck returns to the deck list (FR-034). */}
      <Link className="text-primary text-sm underline underline-offset-4" to="/">
        All decks
      </Link>
    </main>
  );
}
