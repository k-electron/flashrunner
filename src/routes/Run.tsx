// The run screen: /deck/:deckId/rung/:rungId.
// It composes the presentational pieces and dispatches into the pure engine.
// Every decision about the mechanic lives in src/run/reducer.ts, and every
// decision about the ladder in src/decks/ladder.ts.
//
// Run state is held in memory until the run completes. Persisting it as it
// happens and resuming it are US3 (T034/T035).
import { useEffect, useReducer } from 'react';
import { Link, useParams } from 'react-router';
import { CardFace } from '@/components/CardFace';
import { CycleCounter } from '@/components/CycleCounter';
import { OutcomeButtons } from '@/components/OutcomeButtons';
import { Button } from '@/components/ui/button';
import { nextRung } from '@/decks/ladder';
import { deckById } from '@/decks/registry';
import type { DeckConfig, RungConfig } from '@/decks/types';
import { mark, restart, start } from '@/run/reducer';
import { currentCard, isComplete, remainingInCycle } from '@/run/selectors';
import type { Outcome, RunState } from '@/run/types';
import { readDeckRecord, writeDeckRecord } from '@/storage/deckRecord';

type RunAction = { type: 'mark'; outcome: Outcome } | { type: 'restart'; deck: DeckConfig };

/** Routes intent to the engine. It decides nothing itself. */
function runReducer(state: RunState, action: RunAction): RunState {
  return action.type === 'mark' ? mark(state, action.outcome) : restart(action.deck, state);
}

export function Run() {
  const { deckId, rungId } = useParams();
  const deck = deckId === undefined ? undefined : deckById(deckId);
  const rung = deck?.rungs.find((entry) => entry.id === rungId);

  // A revised config, a typo, or a stale bookmark — a plain message, never a
  // crash and never a blank screen.
  if (deck === undefined || rung === undefined) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Run not found</h1>
        <p className="text-muted-foreground text-sm">
          There is no such deck or run. It may have been renamed since this link was made.
        </p>
        <Link className="text-primary text-sm underline underline-offset-4" to="/">
          Back home
        </Link>
      </main>
    );
  }

  // Keyed so moving to another rung starts a new run rather than inheriting this one.
  return <RunLoop key={`${deck.id}/${rung.id}`} deck={deck} rung={rung} />;
}

function RunLoop({ deck, rung }: { deck: DeckConfig; rung: RungConfig }) {
  const [state, dispatch] = useReducer(runReducer, rung, (entry) => start(deck, entry.id));
  const card = deck.cards.find((entry) => entry.id === currentCard(state));
  const complete = isComplete(state);
  // Undefined only at the top of the ladder — the whole deck (FR-014).
  const next = nextRung(deck, rung.id);

  // Completing a rung is the one thing this screen records. Appending only what
  // is missing is what makes repeating a rung cost nothing (FR-016, FR-018), and
  // mastery needs no flag of its own because it is derived from this list.
  useEffect(() => {
    if (!complete) {
      return;
    }
    const record = readDeckRecord(deck);
    writeDeckRecord(deck.id, {
      ...record,
      completedRungIds: record.completedRungIds.includes(rung.id)
        ? record.completedRungIds
        : [...record.completedRungIds, rung.id],
      // The run is over, so there is nothing left to resume.
      run: undefined,
    });
  }, [complete, deck, rung.id]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-muted-foreground text-center text-sm">
        {deck.title} · {rung.label}
      </h1>

      {complete ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-2xl font-semibold tracking-tight">Run complete</p>
          {next === undefined && <p className="text-base">Deck mastered</p>}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              className="h-12 text-base"
              size="lg"
              variant="secondary"
              onClick={() => dispatch({ type: 'restart', deck })}
            >
              Repeat this run
            </Button>
            {/* No larger run exists on the top rung (US2 scenario 3). */}
            {next !== undefined && (
              <Button asChild className="h-12 text-base" size="lg">
                <Link to={`/deck/${deck.id}/rung/${next.id}`}>Next run</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {card !== undefined && <CardFace front={card.front} />}
          <CycleCounter remaining={remainingInCycle(state)} />
          <OutcomeButtons onMark={(outcome) => dispatch({ type: 'mark', outcome })} />
        </>
      )}

      <div className="flex items-center gap-6">
        {/* Restarting mid-run (FR-033). Once the run is over "Repeat this run"
            above is the same action, so it is not offered twice. */}
        {!complete && (
          <Button variant="ghost" onClick={() => dispatch({ type: 'restart', deck })}>
            Start over
          </Button>
        )}
        {/* Leaving records no completion (FR-012, FR-034). */}
        <Link className="text-primary text-sm underline underline-offset-4" to={`/deck/${deck.id}`}>
          Leave this run
        </Link>
      </div>
    </main>
  );
}
