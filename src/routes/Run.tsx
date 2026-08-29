// The run screen: /deck/:deckId/rung/:rungId.
// It composes the presentational pieces and dispatches into the pure engine.
// Every decision about the mechanic lives in src/run/reducer.ts, and every
// decision about the ladder in src/decks/ladder.ts.
//
// Run state is written after every transition and read back on entry, so the
// run survives the tab closing and resumes on the exact card it stopped on
// (FR-028, FR-029, SC-009).
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CardFace } from '@/components/CardFace';
import { OutcomeButtons } from '@/components/OutcomeButtons';
import { PronounceButton } from '@/components/PronounceButton';
import { RunProgress } from '@/components/RunProgress';
import { Button } from '@/components/ui/button';
import { nextRung } from '@/decks/ladder';
import { deckById } from '@/decks/registry';
import type { DeckConfig, RungConfig } from '@/decks/types';
import { mark, restart, start } from '@/run/reducer';
import { currentCard, isComplete } from '@/run/selectors';
import type { Outcome, RunState } from '@/run/types';
import { readDeckRecord, writeDeckRecord, type PersistedRun } from '@/storage/deckRecord';

type RunAction = { type: 'mark'; outcome: Outcome } | { type: 'restart'; deck: DeckConfig };

/** Routes intent to the engine. It decides nothing itself. */
function transition(state: RunState, action: RunAction): RunState {
  return action.type === 'mark' ? mark(state, action.outcome) : restart(action.deck, state);
}

/**
 * The stored run for this rung, or a fresh one (FR-029). `status` is not
 * persisted — a persisted run is always in progress — so it is reconstituted as
 * `running`, and `deckId` comes from the deck because it is the storage key.
 *
 * Already-passed cards cannot be re-presented, because the queue that comes back
 * is the one that was written (FR-030, SC-009). A run the deck config has moved
 * out from under was already dropped on read by src/storage/deckRecord.ts.
 */
function resume(deck: DeckConfig, rung: RungConfig): RunState {
  const { run } = readDeckRecord(deck);
  if (run === undefined || run.rungId !== rung.id) {
    return start(deck, rung.id);
  }
  return { ...run, deckId: deck.id, status: 'running' };
}

/** The persisted half of the run state. See the type's own note for what is left out. */
function toPersistedRun(state: RunState): PersistedRun {
  const { rungId, cycleIndex, queue, position, failedThisCycle, passedThisRun } = state;
  return { rungId, cycleIndex, queue, position, failedThisCycle, passedThisRun };
}

/**
 * One synchronous write, recording where the run now stands (FR-028). The record
 * is a few hundred bytes, so an interruption at any moment leaves at most one
 * card's position unrecorded (SC-009).
 *
 * Completion is the one transition that records something else: the rung id joins
 * `completedRungIds` and the run is cleared, because there is nothing left to
 * resume. Appending only what is missing is what makes repeating a rung cost
 * nothing (FR-016, FR-018), and mastery needs no flag of its own because it is
 * derived from that list.
 *
 * Returns whether the device is out of room — a normal condition, not a bug
 * (constitution Principle II).
 */
function persist(deck: DeckConfig, state: RunState): boolean {
  const record = readDeckRecord(deck);
  const result = writeDeckRecord(
    deck.id,
    isComplete(state)
      ? {
          ...record,
          completedRungIds: record.completedRungIds.includes(state.rungId)
            ? record.completedRungIds
            : [...record.completedRungIds, state.rungId],
          run: undefined,
        }
      : { ...record, run: toPersistedRun(state) },
  );
  return !result.ok && result.reason === 'quota-exceeded';
}

export function Run() {
  const { deckId, rungId } = useParams();
  const deck = deckId === undefined ? undefined : deckById(deckId);
  const rung = deck?.rungs.find((entry) => entry.id === rungId);

  // A revised config, a typo, or a stale bookmark — a plain message, never a
  // crash and never a blank screen. Where the message leads follows the tree
  // (FR-034): the deck genuinely does not exist, so home is the nearest screen
  // that does — the same reasoning as src/routes/DeckLadder.tsx.
  if (deck === undefined) {
    return (
      <NotFound to="/" linkLabel="Back home">
        There is no such deck. It may have been renamed since this link was made.
      </NotFound>
    );
  }

  // The deck is real and only the rung is not, so the parent of this URL is that
  // deck's own ladder, not the deck list (FR-034).
  if (rung === undefined) {
    return (
      <NotFound to={`/deck/${deck.id}`} linkLabel="Back to this deck">
        This deck has no such run. It may have been renamed since this link was made.
      </NotFound>
    );
  }

  // Keyed so moving to another rung starts a new run rather than inheriting this one.
  return <RunLoop key={`${deck.id}/${rung.id}`} deck={deck} rung={rung} />;
}

/**
 * The one "Run not found" screen, told where to send the learner. Only the
 * sentence and the way out differ between the two cases, so the heading and the
 * layout are written once and cannot drift apart.
 */
function NotFound({
  to,
  linkLabel,
  children,
}: {
  to: string;
  linkLabel: string;
  children: string;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Run not found</h1>
      <p className="text-muted-foreground text-sm">{children}</p>
      <Link className="text-primary text-sm underline underline-offset-4" to={to}>
        {linkLabel}
      </Link>
    </main>
  );
}

function RunLoop({ deck, rung }: { deck: DeckConfig; rung: RungConfig }) {
  const [state, setState] = useState<RunState>(() => resume(deck, rung));
  // The run as entered — resumed, or freshly started — is recorded as this
  // screen's state is set up, before a single card is marked, so an interruption
  // right here resumes on this card rather than at the top of the rung. The
  // initializer runs once per mount and `RunLoop` is keyed by rung, so this is
  // the entry write and nothing else: every later write is made by the
  // transition that caused it, in `apply` below.
  //
  // Its result seeds the one flag every write on this screen reports through, so
  // a full device is said once and in one way. This is the write that says it
  // after a Start over on the ladder, where the discarded run is still on the
  // device waiting to come back on the next tab — so there is something to lose
  // from the moment the run is entered, not only from the first mark.
  //
  // Recording the entered run twice records the same state under the same key,
  // which is what makes doing it here rather than in an effect harmless.
  const [storageFull, setStorageFull] = useState(() => persist(deck, state));
  // Whether the learner asked to hear the word on the card in front of them.
  // Purely visual guidance, never persisted (FR-008 of 007), so it is component
  // state rather than a field on the run.
  const [heard, setHeard] = useState(false);
  const card = deck.cards.find((entry) => entry.id === currentCard(state));
  const complete = isComplete(state);
  // Undefined only at the top of the ladder — the whole deck (FR-014).
  const next = nextRung(deck, rung.id);

  /**
   * Applies an action to the engine and records the state it produces — one
   * write per outcome, made by the event that caused it.
   *
   * The transition is worked out once and that one value is used twice, which is
   * load-bearing rather than tidy: a transition that closes a cycle shuffles, so
   * asking the engine the same question again draws different values and answers
   * with a different order. Storing that second answer would leave the device
   * holding a permutation the learner is not being shown, and nothing would say
   * so — `readRun` checks the queue as a set, never as a sequence, so both
   * orders come back looking valid (FR-011, FR-015, FR-016).
   *
   * The learner is told when a write finds no room, rather than being silently
   * lied to. The run itself carries on in memory either way.
   */
  function apply(action: RunAction): void {
    // `nextState`, not `next`: `next` is already the next rung, just above.
    const nextState = transition(state, action);
    setState(nextState);
    setStorageFull(persist(deck, nextState));
  }

  return (
    <>
      {/* Before <main> rather than inside it, so a screen reader meets the two
          indicators before the card they describe (FR-025) and <main>'s gap-8
          spacing is left untouched. No zero guard — validate.ts rule V8 forbids
          an empty rung.

          It sits in RunLoop and outside the `complete ? … : …` branch, so
          FR-019 (no bars on either "Run not found" screen, which live in `Run`)
          and FR-020 (the bars survive onto the run-complete screen) both fall
          out with no condition written for either. */}
      <RunProgress
        run={{ done: state.passedThisRun.length, total: rung.cardIds.length }}
        cycle={{ done: state.position, total: state.queue.length }}
      />
      {/* pt-9 is <main>'s original 24px plus the 12px the bars occupy, written
          out rather than appended because this className is a plain string, so
          tailwind-merge is not here to resolve `p-6` against `pt-9` (FR-017). */}
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-8 px-6 pt-9 pb-6">
        <h1 className="text-muted-foreground text-center text-sm">
          {deck.title} · {rung.label}
        </h1>

        {storageFull && (
          <p role="status" className="text-center text-sm">
            Progress is not being saved: this device is out of storage space. The run keeps working,
            but it will not be here after this tab is closed.
          </p>
        )}

        {complete ? (
          <div className="flex flex-col items-center gap-6">
            <p className="text-2xl font-semibold tracking-tight">Run complete</p>
            {next === undefined && <p className="text-base">Deck mastered</p>}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                className="h-12 text-base"
                size="lg"
                variant="secondary"
                onClick={() => apply({ type: 'restart', deck })}
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
            {/* Two columns, so the pronounce button lines up with "Not yet" without
                anyone writing a width by hand, and nothing sits above "Got it"
                (FR-002). The pair is one child of `main`, so the speaker adds no
                `gap-8` of its own (005 research § Decision 6). Deleting the
                cycle counter took one child away, so `main` now spaces three
                gaps rather than four — the grouping is what keeps the speaker
                from making it five.

                `OutcomeButtons` is composed with, never modified: the speaker is
                not an outcome, and that file never sees a card's text. Rendered
                only here, so the run-complete screen — which has no word — never
                has one (FR-010). */}
            <div className="grid w-full max-w-md grid-cols-2 gap-x-4 gap-y-2">
              {card !== undefined && (
                <PronounceButton word={card.front} onHeard={() => setHeard(true)} />
              )}
              <div className="col-span-2">
                <OutcomeButtons
                  heard={heard}
                  onMark={(outcome) => apply({ type: 'mark', outcome })}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-6">
          {/* Restarting mid-run (FR-033). `apply` writes the fresh run over the old
              one, as it does for every other transition — the entry write above
              happens once, as this screen's state is set up, so it is not what
              records a restart. Nothing outside this run is touched (FR-032).
              Once the run is over "Repeat this run" is the same action, so it is
              not offered twice. */}
          {!complete && (
            <Button variant="ghost" onClick={() => apply({ type: 'restart', deck })}>
              Start over
            </Button>
          )}
          {/* Leaving records no completion (FR-012, FR-034). */}
          <Link
            className="text-primary text-sm underline underline-offset-4"
            to={`/deck/${deck.id}`}
          >
            Leave this run
          </Link>
        </div>
      </main>
    </>
  );
}
