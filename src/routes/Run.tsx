// The run screen: /deck/:deckId/rung/:rungId.
// It composes the presentational pieces and dispatches into the pure engine.
// Every decision about the mechanic lives in src/run/reducer.ts.
//
// Run state is held in memory only. Persisting it and resuming it are US3
// (T034/T035); handling completion beyond reporting it is US2 (T028).
import { useReducer } from 'react';
import { Link, useParams } from 'react-router';
import { CardFace } from '@/components/CardFace';
import { CycleCounter } from '@/components/CycleCounter';
import { OutcomeButtons } from '@/components/OutcomeButtons';
import { Button } from '@/components/ui/button';
import { deckById } from '@/decks/registry';
import type { DeckConfig, RungConfig } from '@/decks/types';
import { mark, restart, start } from '@/run/reducer';
import { currentCard, isComplete, remainingInCycle } from '@/run/selectors';
import type { Outcome, RunState } from '@/run/types';

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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-muted-foreground text-center text-sm">
        {deck.title} · {rung.label}
      </h1>

      {isComplete(state) ? (
        <p className="text-2xl font-semibold tracking-tight">Run complete</p>
      ) : (
        <>
          {card !== undefined && <CardFace front={card.front} />}
          <CycleCounter remaining={remainingInCycle(state)} />
          <OutcomeButtons onMark={(outcome) => dispatch({ type: 'mark', outcome })} />
        </>
      )}

      <div className="flex items-center gap-6">
        <Button variant="ghost" onClick={() => dispatch({ type: 'restart', deck })}>
          Start over
        </Button>
        {/* Leaving records no completion (FR-012, FR-034). */}
        <Link className="text-primary text-sm underline underline-offset-4" to={`/deck/${deck.id}`}>
          Leave this run
        </Link>
      </div>
    </main>
  );
}
