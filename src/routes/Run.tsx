// The run screen: /deck/:deckId/rung/:rungId.
// It composes the presentational pieces and dispatches into the pure engine.
// Every decision about the mechanic lives in src/run/reducer.ts, and every
// decision about the ladder in src/decks/ladder.ts.
//
// Run state is written after every transition and read back on entry, so the
// run survives the tab closing and resumes on the exact card it stopped on
// (FR-028, FR-029, SC-009).
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CardFace } from '@/components/CardFace';
import { OutcomeButtons } from '@/components/OutcomeButtons';
import { PronounceButton } from '@/components/PronounceButton';
import { RunProgress } from '@/components/RunProgress';
import { Button } from '@/components/ui/button';
import { nextRung } from '@/decks/ladder';
import { deckById } from '@/decks/registry';
import type { CardId, DeckConfig, RungConfig } from '@/decks/types';
import { cn } from '@/lib/utils';
import { CARD_ENTRY_CLASSES, CARD_ENTRY_MS, CARD_EXIT_CLASSES, CARD_EXIT_MS } from '@/run/advance';
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
  // Which half of a card change is running. Two phases rather than one timer
  // because they paint different cards, and because a single timer split later
  // would take the guard apart with it.
  const [phase, setPhase] = useState<'exiting' | 'entering' | 'idle'>('entering');
  // The card block's key, and the reason it is a counter rather than anything
  // read off the run: the same card is legitimately presented twice running (a
  // failed last card is re-queued), `position` resets when a cycle closes, and a
  // "Start over" from the first card of the first cycle changes no field at all.
  const [presentation, setPresentation] = useState(0);
  // Mounting is an entry with nothing before it, so there is no earlier press to
  // bounce from and the first card of a run — or of a resume — is markable on
  // arrival (FR-010). Only a press sets this.
  const [guarded, setGuarded] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The id of the card that was on screen when a press landed, held for the
  // length of that card's exit. The engine and the storage write move on the
  // press; this is what keeps the card the learner actually marked painted while
  // it leaves (FR-005d).
  const [leaving, setLeaving] = useState<CardId | null>(null);

  // These two lines are the entire divergence between what is true and what is
  // painted, and nothing else may read `leaving`: the progress bars, the storage
  // write, and what a resume comes back to all follow the engine. Nothing derived
  // from it is ever stored or compared against the queue.
  const shownId = leaving ?? currentCard(state);
  const complete = isComplete(state) && leaving === null;

  const card = deck.cards.find((entry) => entry.id === shownId);
  // Undefined only at the top of the ladder — the whole deck (FR-014).
  const next = nextRung(deck, rung.id);

  // A timer that outlives the screen would clear the guard on a component that is
  // gone, and React would warn about it. The mark it followed is already stored,
  // so nothing else is at stake here (FR-013, FR-014).
  useEffect(() => () => clearTimeout(pending.current), []);

  /**
   * The second phase: the incoming card arrives, and the controls become live
   * again as it settles.
   */
  function enter(): void {
    setLeaving(null);
    setPresentation((count) => count + 1);
    setPhase('entering');
    // Every presentation of a card begins either here or at this component's
    // mount, so clearing it here is the whole of FR-007 of 007 — marking, "Start
    // over", a resumed run, and a move to another rung, since `RunLoop` is keyed
    // by rung. Deliberately not keyed on the word: a failed last card is
    // re-queued and a "Start over" can reshuffle onto the card already showing,
    // so the same word can be a genuinely new presentation.
    //
    // Here rather than in `apply` because the outgoing card is still painted for
    // the whole of its exit, and whether its word was heard belongs to it right
    // up to the boundary.
    setHeard(false);
    pending.current = setTimeout(() => {
      setPhase('idle');
      setGuarded(false);
    }, CARD_ENTRY_MS);
  }

  /**
   * Opens the guard window and plays the card change out. The window is exactly
   * the two phases end to end — there is no duration of its own that could come
   * to disagree with the animation (FR-006).
   *
   * Clearing `pending` first is what makes a card change starting mid-transition
   * replace the one in flight rather than queue behind it (FR-013). A stale timer
   * would otherwise drop the guard early, part-way through the new window.
   */
  function beginTransition(): void {
    clearTimeout(pending.current);
    setGuarded(true);
    // "Repeat this run" is pressed on the run-complete screen, which holds no
    // card to play out. That is the same absence as the first card of a run, so
    // it goes straight to the entry — otherwise the *incoming* card would be the
    // thing animated away.
    if (shownId === undefined) {
      enter();
      return;
    }
    setLeaving(shownId);
    setPhase('exiting');
    pending.current = setTimeout(enter, CARD_EXIT_MS);
  }

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
    // Every caller of `apply` changes the card, so the transition belongs here
    // rather than at each of the three call sites. It carries nothing: the
    // outcome above is already applied and written before it starts (FR-005d).
    beginTransition();
  }

  return (
    // A plain wrapper carrying the one clock. Both are unregistered custom
    // properties, so they inherit to everything below — the card block's two
    // animations read them and name no duration of their own (FR-007). No
    // classes: `RunProgress` is fixed and <main> keeps its own column, so this
    // element must not be allowed to affect either.
    <div
      style={
        {
          '--card-exit': `${CARD_EXIT_MS}ms`,
          '--card-entry': `${CARD_ENTRY_MS}ms`,
        } as CSSProperties
      }
    >
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
          // The entry that pairs with the last card's exit, so the run ends on a
          // transition rather than a hard cut (FR-005e). It is unguarded for
          // free: the guard is only ever read at the outcome handler, and there
          // are no outcome buttons here (FR-009).
          <div className={cn('flex flex-col items-center gap-6', CARD_ENTRY_CLASSES)}>
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
          // The card block: one element, so "the card and its buttons move as one
          // group, on one timing and one curve" is structural rather than a rule
          // anyone has to remember (FR-005). Nothing inside carries an animation
          // of its own.
          //
          // Keyed by the counter so the entry replays on every presentation, and
          // the counter only advances at the boundary — advancing it on the press
          // would unmount the outgoing card mid-exit, leaving nothing to animate
          // away.
          //
          // `gap-8` here because <main> now spaces three children where it spaced
          // four, and this element spaces the two that moved inside it, so the
          // rendered gaps are unchanged (contract § 8).
          <div
            key={presentation}
            className={cn(
              'flex w-full flex-col items-center gap-8',
              phase === 'exiting' ? CARD_EXIT_CLASSES : CARD_ENTRY_CLASSES,
            )}
          >
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
              {/* The word is the painted card's, not the engine's, so the
                  component's word-keyed cleanup matches what is on screen
                  through the exit. `guarded` stops it speaking the same word the
                  block is carrying away (FR-011). */}
              {card !== undefined && (
                <PronounceButton
                  word={card.front}
                  guarded={guarded}
                  onHeard={() => setHeard(true)}
                />
              )}
              <div className="col-span-2">
                <OutcomeButtons
                  heard={heard}
                  onMark={(outcome) => {
                    // The guard is read here and nowhere else. `apply` also
                    // serves "Start over" and "Repeat this run", which must stay
                    // live — checking it at this one call site is what leaves
                    // both of them unguarded with no condition written for
                    // either (FR-009, FR-012). A blocked press does nothing at
                    // all: it is discarded, never queued (FR-003).
                    if (guarded) {
                      return;
                    }
                    apply({ type: 'mark', outcome });
                  }}
                />
              </div>
            </div>
          </div>
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
    </div>
  );
}
