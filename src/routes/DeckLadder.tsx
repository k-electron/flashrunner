// A deck's rung ladder: /deck/:deckId.
// Progress is read from storage and every judgement about it — what is startable,
// what is mastered — comes from src/decks/ladder.ts. This file derives nothing
// itself, which is what keeps the unlocking rule (008 FR-006) in exactly one place.
import { CircleCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { isMastered, isStartable } from '@/decks/ladder';
import { deckById } from '@/decks/registry';
import type { DeckConfig, RungId } from '@/decks/types';
import { readDeckRecord, writeDeckRecord } from '@/storage/deckRecord';

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

  // One record per deck, so the run surfaced here is this deck's own and working
  // on another deck cannot disturb it (FR-036). Nothing reconciles or guards
  // against more than one — the situation does not arise (FR-037).
  const { completedRungIds, run } = readDeckRecord(deck);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
        {/* Derived from the top rung, never stored (FR-017). */}
        {isMastered(deck, completedRungIds) && <p className="text-base">Deck mastered</p>}
      </header>

      <ul className="flex flex-col gap-3">
        {/* Highest level first, so the ladder reads as a climb (FR-005). Reversed
            after the map, never in `deck.rungs`: the config is ordered smallest →
            largest and read by isStartable, isMastered, nextRung and validation.
            Reversed in the DOM rather than with flex-col-reverse, so tab order
            and screen-reader order match what is on screen. */}
        {deck.rungs
          .map((rung, index) => {
            const startable = isStartable(deck, completedRungIds, index);
            const path = `/deck/${deck.id}/rung/${rung.id}`;
            // Built once for both branches, so a completed level that is locked
            // cannot drift from a completed one that is startable (FR-007).
            // aria-hidden keeps the accessible name exactly the level name
            // (FR-016) — the same reason the old "Completed" text sat outside the
            // control. The explicit size-5 is required: Button forces an unsized
            // svg to 16px.
            const name = (
              <>
                {completedRungIds.includes(rung.id) && (
                  <CircleCheck className="size-5" aria-hidden="true" />
                )}
                {rung.label}
              </>
            );
            return (
              <li key={rung.id} className="flex items-center gap-3">
                {/* Only on a startable level: a locked one must not offer a way in
                    (FR-019). The level control itself resumes — it points at the
                    same path the old Resume link did (FR-012). */}
                {startable && run?.rungId === rung.id && (
                  <StartOverButton deck={deck} rungId={rung.id} />
                )}
                {startable ? (
                  // The mark goes inside the Link, not beside it: Button asChild is
                  // a Radix Slot and takes exactly one child element.
                  <Button asChild className="h-12 flex-1 text-base" size="lg">
                    <Link to={path}>{name}</Link>
                  </Button>
                ) : (
                  // Visible, so the whole ladder is legible from the start, but not
                  // startable until every level below it has been completed (FR-006).
                  <Button className="h-12 flex-1 text-base" size="lg" variant="secondary" disabled>
                    {name}
                  </Button>
                )}
              </li>
            );
          })
          .reverse()}
      </ul>

      {/* Leaving a deck returns to the deck list (FR-034). */}
      <Link className="text-primary text-sm underline underline-offset-4" to="/">
        All decks
      </Link>
    </main>
  );
}

/**
 * Discards the run left unfinished on this level.
 *
 * A component rather than an inline handler only because it calls `useNavigate`,
 * which cannot be called conditionally inside the map.
 */
function StartOverButton({ deck, rungId }: { deck: DeckConfig; rungId: RungId }) {
  const navigate = useNavigate();
  const path = `/deck/${deck.id}/rung/${rungId}`;

  /**
   * Discards this unfinished run and nothing else (FR-032). `completedRungIds`
   * is written back as it was read, so mastery and this rung's unlocked state
   * are untouched, and every other deck has its own record entirely (SC-015).
   * The fresh run itself is started by the run screen on entry.
   *
   * A device with no room is a normal condition and the learner is told about it
   * (constitution Principle II) — but not from here. This navigation replaces the
   * ladder in the same render, so a message put on this screen would never be
   * painted. It is the run screen that says it: the entry write it makes lands in
   * the same full store and reports it there, on the screen the learner is
   * looking at. The discarded run is still gone for this session either way,
   * because storage reads this session's own writes back from its mirror.
   */
  function startOver(): void {
    const record = readDeckRecord(deck);
    writeDeckRecord(deck.id, { ...record, run: undefined });
    void navigate(path);
  }

  return (
    <Button className="h-12 text-base" size="lg" variant="secondary" onClick={startOver}>
      Start over
    </Button>
  );
}
