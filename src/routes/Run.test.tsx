// Queried by role and visible text only — no class names, no internals, no
// snapshots (Principle IV). The mechanic itself is covered by src/run/reducer.test.ts.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dolchPreK5 } from '@/decks/dolch-prek-5';
import { DeckLadder } from '@/routes/DeckLadder';
import { Run } from '@/routes/Run';
import { readDeckRecord, type PersistedRun } from '@/storage/deckRecord';
import { deckKey } from '@/storage/keys';
import { writeItem } from '@/storage/safeStorage';
import { seededRng } from '@/test/rng';

// The real registry, because the route resolves through it. Rung r1 of the
// Pre-K ladder is the five words a, I, the, and, to; r8 is the whole 40-word deck.
const FIRST_RUN = '/deck/dolch-prek-5/rung/r1';
// Rung r2 of the same ladder is those five words plus is, it, in, up, me.
const SECOND_RUN = '/deck/dolch-prek-5/rung/r2';
const TOP_RUN = '/deck/dolch-prek-5/rung/r8';
const FIRST_RUNG_CARDS = ['a', 'i', 'the', 'and', 'to'];
const SECOND_RUNG_CARDS = ['a', 'i', 'the', 'and', 'to', 'is', 'it', 'in', 'up', 'me'];

// Halfway through r2: three words cleared, one still to come back.
const SECOND_RUNG_RUN: PersistedRun = {
  rungId: 'r2',
  cycleIndex: 0,
  queue: SECOND_RUNG_CARDS,
  position: 4,
  failedThisCycle: ['i'],
  passedThisRun: ['a', 'the', 'and'],
};

type StoredRecord = { completedRungIds?: string[]; run?: PersistedRun };

/** The stored form of a deck record: what a seed writes and what a store reads back. */
function recordJson(record: StoredRecord): string {
  return JSON.stringify({ schemaVersion: 1, completedRungIds: [], ...record });
}

/**
 * Seeds the deck's stored record, defaulting to a deck that has been started but
 * has nothing completed and nothing to resume.
 *
 * Every transition writes, and the store outlives a single test — under Node 26
 * `globalThis.localStorage` reads back undefined, so safeStorage keeps one
 * module-level in-memory map for the whole file. Seeding makes each test start
 * from a known state rather than from what the last one left.
 */
function seed(record: StoredRecord = {}): void {
  writeItem(deckKey(dolchPreK5.id), recordJson(record));
}

/**
 * The engine shuffles, so a freshly started run has no fixed first card and every
 * test that named one was passing or failing by luck from run to run. One
 * reproducible stream for the whole file removes that.
 *
 * The seed is arbitrary and nothing below is written against the order it happens
 * to produce: the tests read the card the screen is showing and make their claim
 * about that. The stub is here so a failure means a failure, not so any assertion
 * can be pinned to a literal.
 */
const FILE_SEED = 20260213;

beforeEach(() => {
  seed();
  vi.spyOn(Math, 'random').mockImplementation(seededRng(FILE_SEED));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A card's visible face, which is all the screen ever shows of it. */
function frontOf(cardId: string): string {
  const card = dolchPreK5.cards.find((entry) => entry.id === cardId);
  if (card === undefined) {
    throw new Error(`No card "${cardId}" in deck "${dolchPreK5.id}"`);
  }
  return card.front;
}

/**
 * Which of `candidates` is on screen, read the way a learner reads it. Calling it
 * is itself a check: it throws unless exactly one of them is being presented, which
 * is what lets a test say "a card of this rung" without naming which.
 */
function shownCard(candidates: readonly string[]): string {
  const shown = candidates.filter((id) => screen.queryAllByText(frontOf(id)).length > 0);
  if (shown.length !== 1) {
    throw new Error(`Expected one of ${candidates.join(', ')} on screen, found ${shown.length}`);
  }
  return shown[0];
}

/** The stored run, insisted upon: a test that asks for it has nothing to say without it. */
function storedRun(): PersistedRun {
  const { run } = readDeckRecord(dolchPreK5);
  if (run === undefined) {
    throw new Error(`No run is stored for deck "${dolchPreK5.id}"`);
  }
  return run;
}

/** Sorted, so a queue can be compared for membership without naming an order (FR-006). */
function members(cardIds: readonly string[]): string[] {
  return [...cardIds].sort();
}

/**
 * Renders the run route and hands back the router, for tests that navigate, and
 * `unmount`, for tests that interrupt: unmounting and rendering again with the
 * store left alone is what a closed and reopened tab is.
 */
function renderRunWithRouter(path: string) {
  const router = createMemoryRouter([{ path: '/deck/:deckId/rung/:rungId', element: <Run /> }], {
    initialEntries: [path],
  });
  const { unmount } = render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router, unmount };
}

function renderRun(path: string) {
  return renderRunWithRouter(path).user;
}

/**
 * The run route together with the ladder it leaves to, so what a learner finds
 * after moving between the two is observable without stubbing either screen.
 */
function renderJourney(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/deck/:deckId', element: <DeckLadder /> },
      { path: '/deck/:deckId/rung/:rungId', element: <Run /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

/** Marks every card of the current cycle "Got it", which clears the run. */
async function clearRun(user: ReturnType<typeof userEvent.setup>, cards: number) {
  for (let card = 0; card < cards; card += 1) {
    await user.click(screen.getByRole('button', { name: 'Got it' }));
  }
}

/**
 * What an indicator announces: `aria-valuetext`, reached through role and
 * accessible name only. Never `aria-valuenow` (an unrounded percentage), never
 * `data-state`, never a class name — see
 * specs/006-run-progress-bars/contracts/run-progress.md § 4.
 */
function progressOf(name: string): string | null {
  return screen.getByRole('progressbar', { name }).getAttribute('aria-valuetext');
}

describe('Run', () => {
  // Which word leads the run is the shuffle's business (FR-001); that the run opens
  // on a card of this rung and only one is not.
  it('shows a card of the rung as soon as the run starts', () => {
    renderRun(FIRST_RUN);
    expect(FIRST_RUNG_CARDS).toContain(shownCard(FIRST_RUNG_CARDS));
  });

  it('offers both outcomes by their accessible names', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not yet' })).toBeInTheDocument();
  });

  // The queries above pass whether the name comes from visible text or from an
  // aria-label, so on their own they would not catch an icon-only button carrying
  // a hidden label — which is what FR-014 forbids.
  it('keeps each outcome wording as visible text (FR-014)', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByText('Got it')).toBeVisible();
    expect(screen.getByText('Not yet')).toBeVisible();
  });

  // What separates the two indicators, in one test: every mark moves the cycle
  // bar, and only "Got it" moves the run bar (FR-005, SC-005).
  it('advances the cycle bar on every mark and the run bar only on "Got it"', async () => {
    const user = renderRun(FIRST_RUN);
    expect(progressOf('Cards done in this round')).toBe('0 of 5 cards');
    expect(progressOf('Cards got right')).toBe('0 of 5 cards');

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(progressOf('Cards done in this round')).toBe('1 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(progressOf('Cards done in this round')).toBe('2 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');
  });

  // The load-bearing claim about the run bar, in one test: it is fed by "Got it"
  // and by nothing else, so its end means the run is over rather than that the
  // learner has been busy.
  it('grows the run bar on "Got it" and leaves it where it was on "Not yet" (FR-003)', async () => {
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(progressOf('Cards got right')).toBe('2 of 5 cards');

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(progressOf('Cards got right')).toBe('2 of 5 cards');
  });

  it('fills the run bar exactly when the run completes (FR-004, FR-020)', async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 5);

    expect(screen.getByText('Run complete')).toBeInTheDocument();
    expect(progressOf('Cards got right')).toBe('5 of 5 cards');
    expect(progressOf('Cards done in this round')).toBe('5 of 5 cards');
  });

  // The cycle bar's denominator is this cycle's size, not the rung's: a repeat
  // cycle of one reads 0 of 1 and then 1 of 1, while the run bar goes on
  // measuring the same five words throughout (FR-006, FR-007, SC-006).
  it("resets the cycle bar to the new cycle's own size when a cycle closes", async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 4);
    await user.click(screen.getByRole('button', { name: 'Not yet' }));

    expect(progressOf('Cards done in this round')).toBe('0 of 1 cards');
    expect(progressOf('Cards got right')).toBe('4 of 5 cards');

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(progressOf('Cards done in this round')).toBe('1 of 1 cards');
    expect(progressOf('Cards got right')).toBe('5 of 5 cards');
  });

  it('advances to the next card when the current one is marked', async () => {
    const user = renderRun(FIRST_RUN);
    // Which card was on top is whatever the shuffle dealt; what matters is that
    // marking it moves the run on to a different one and retires it.
    const first = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(shownCard(FIRST_RUNG_CARDS)).not.toBe(first);
    expect(screen.queryByText(frontOf(first))).not.toBeInTheDocument();
  });

  it('brings a failed card back in the next round', async () => {
    const user = renderRun(FIRST_RUN);
    for (let card = 0; card < 4; card += 1) {
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }
    // Whichever word the shuffle left last is the only one failed, and it is that
    // card by identity that has to come back — not a card in a known position.
    const failed = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Not yet' }));

    // A new cycle of one, measured against itself.
    expect(progressOf('Cards done in this round')).toBe('0 of 1 cards');
    expect(shownCard(FIRST_RUNG_CARDS)).toBe(failed);
  });

  it('returns to the start of a full first round when Start over is used', async () => {
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(progressOf('Cards done in this round')).toBe('2 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');

    await user.click(screen.getByRole('button', { name: 'Start over' }));

    // Cycle 0 again with nothing behind it, and a card of the rung on screen. Which
    // word leads is not the claim: a restart shuffles anew (FR-017), so naming one
    // would assert the seed rather than the reset.
    expect(progressOf('Cards done in this round')).toBe('0 of 5 cards');
    expect(progressOf('Cards got right')).toBe('0 of 5 cards');
    expect(FIRST_RUNG_CARDS).toContain(shownCard(FIRST_RUNG_CARDS));
    expect(storedRun()).toMatchObject({
      cycleIndex: 0,
      position: 0,
      failedThisCycle: [],
      passedThisRun: [],
    });
  });

  it('offers a way out of the run, back to the deck it belongs to', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByRole('link', { name: 'Leave this run' })).toHaveAttribute(
      'href',
      '/deck/dolch-prek-5',
    );
  });

  // The consequence the requirement is actually about, not just where the link
  // points: a run walked away from mid-way is not a run that was finished, so
  // nothing may join the list mastery and unlocking are derived from (FR-012).
  it('records no completion when a run in progress is abandoned (FR-012)', async () => {
    const user = renderJourney(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    // Mid-run, whatever this rung's length: cards are still being asked for, so
    // the run being left really is unfinished and not one that quietly ended.
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Leave this run' }));

    // Nothing joined the list mastery and unlocking read, and the ladder the
    // learner lands on shows the rung unmarked rather than climbed.
    expect(readDeckRecord(dolchPreK5).completedRungIds).toEqual([]);
    expect(screen.getByRole('link', { name: 'All decks' })).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('reports success once every card has been cleared', async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 5);

    expect(screen.getByText('Run complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
  });

  it('starts a new run when the route moves to another rung', async () => {
    const { user, router } = renderRunWithRouter(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(progressOf('Cards done in this round')).toBe('1 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');

    await act(async () => {
      await router.navigate(SECOND_RUN);
    });

    // The ten-word rung from a standing start, not the five-word queue carried
    // over: both bars empty and measured against ten, and the card on screen is
    // one of r2's.
    expect(progressOf('Cards done in this round')).toBe('0 of 10 cards');
    expect(progressOf('Cards got right')).toBe('0 of 10 cards');
    expect(SECOND_RUNG_CARDS).toContain(shownCard(SECOND_RUNG_CARDS));
  });

  it('offers a repeat and the next rung on completion (FR-014)', async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 5);

    expect(screen.getByRole('button', { name: 'Repeat this run' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next run' })).toHaveAttribute(
      'href',
      '/deck/dolch-prek-5/rung/r2',
    );
  });

  it('begins the same rung again when the run is repeated', async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 5);
    await user.click(screen.getByRole('button', { name: 'Repeat this run' }));

    // The same five words, all of them to do again, in whatever order the repeat
    // drew (FR-018).
    expect(progressOf('Cards done in this round')).toBe('0 of 5 cards');
    expect(progressOf('Cards got right')).toBe('0 of 5 cards');
    expect(FIRST_RUNG_CARDS).toContain(shownCard(FIRST_RUNG_CARDS));
    expect(members(storedRun().queue)).toEqual(members(FIRST_RUNG_CARDS));
  });

  it('records the completed rung, and repeating it appends nothing (FR-017, FR-018)', async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 5);
    expect(readDeckRecord(dolchPreK5).completedRungIds).toEqual(['r1']);

    await user.click(screen.getByRole('button', { name: 'Repeat this run' }));
    await clearRun(user, 5);
    expect(readDeckRecord(dolchPreK5).completedRungIds).toEqual(['r1']);
  });

  // The seed here is deliberately non-empty: with the file-level `beforeEach`
  // record, appending the finished rung and overwriting the whole list are
  // indistinguishable, so nothing would catch a completion that discards the
  // ladder the learner already climbed.
  it('keeps earlier rungs when a later one is completed (FR-018)', async () => {
    writeItem(
      deckKey(dolchPreK5.id),
      JSON.stringify({ schemaVersion: 1, completedRungIds: ['r1'] }),
    );
    const user = renderRun(SECOND_RUN);
    await clearRun(user, 10);

    expect(readDeckRecord(dolchPreK5).completedRungIds).toEqual(['r1', 'r2']);
  });

  // A finished run is not an unfinished one, so completing a rung must leave
  // nothing behind to resume from (FR-029).
  it('clears the stored run when the rung it belongs to is completed', async () => {
    writeItem(
      deckKey(dolchPreK5.id),
      JSON.stringify({
        schemaVersion: 1,
        completedRungIds: [],
        run: {
          rungId: 'r1',
          cycleIndex: 0,
          queue: ['a', 'i', 'the', 'and', 'to'],
          position: 2,
          failedThisCycle: [],
          passedThisRun: ['a', 'i'],
        },
      }),
    );
    // The seeded run is well-formed, so it survives the read that the completion
    // write overlays — otherwise this would pass for the wrong reason.
    expect(readDeckRecord(dolchPreK5).run).toBeDefined();

    const user = renderRun(FIRST_RUN);
    // Clear whatever the screen actually presents rather than a fixed count: this
    // rung is five cards from a standing start, but once resume lands the seeded
    // run is hydrated mid-cycle and only the remaining three are shown.
    while (screen.queryByRole('button', { name: 'Got it' }) !== null) {
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }

    expect(readDeckRecord(dolchPreK5).run).toBeUndefined();
  });

  it('shows mastery and offers no larger run on the top rung (US2 scenario 3)', async () => {
    const user = renderRun(TOP_RUN);
    await clearRun(user, 40);

    expect(screen.getByText('Deck mastered')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Next run' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Repeat this run' })).toBeInTheDocument();
  });

  // Home is the nearest screen that exists, because the deck itself does not.
  it('shows a plain message and a way home for a deck that does not exist', () => {
    renderRun('/deck/no-such-deck/rung/r1');
    expect(screen.getByRole('heading', { name: 'Run not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });

  // Navigation is a tree, so the parent of a run is that deck's own ladder and
  // not the deck list — and the deck here is real, only the rung is not (FR-034).
  it("shows the same message for a rung the deck does not have, and offers that deck's ladder", () => {
    renderRun('/deck/dolch-prek-5/rung/r99');
    expect(screen.getByRole('heading', { name: 'Run not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to this deck' })).toHaveAttribute(
      'href',
      '/deck/dolch-prek-5',
    );
    expect(screen.queryByRole('link', { name: 'Back home' })).not.toBeInTheDocument();
  });

  // There is no run to report on, so nothing reports on one. The bars live in
  // RunLoop, which neither of these screens reaches — this asserts that stays
  // true (FR-019).
  it('shows no progress bar on either "Run not found" screen', () => {
    renderRun('/deck/no-such-deck/rung/r1');
    expect(screen.queryAllByRole('progressbar')).toEqual([]);

    renderRun('/deck/dolch-prek-5/rung/r99');
    expect(screen.queryAllByRole('progressbar')).toEqual([]);
  });
});

// The store is only ever reached through src/storage/, so these assert what a
// learner would find on coming back rather than any internal of the components.
describe('Run — persistence and resume', () => {
  it('records the run on entry, before a single card has been marked', () => {
    renderRun(FIRST_RUN);

    const run = storedRun();
    expect(run).toMatchObject({
      rungId: 'r1',
      cycleIndex: 0,
      position: 0,
      failedThisCycle: [],
      passedThisRun: [],
    });
    // The order is the shuffle's, so what is recorded is the rung's membership in
    // some order — and it is that order's first card the learner is looking at,
    // which is the whole point of recording it (FR-011, FR-015).
    expect(members(run.queue)).toEqual(members(FIRST_RUNG_CARDS));
    expect(screen.getByText(frontOf(run.queue[0]))).toBeInTheDocument();
  });

  it('resumes a restarted run into the restarted order, not the discarded one (FR-019)', async () => {
    // The abandoned run's order is seeded explicitly so it is a known quantity, and
    // the restart's order is whatever the shuffle produced. Closing the tab must bring
    // back the second, not the first: the restart wrote over the run, and the recorded
    // order is the only source of truth for what comes next (FR-009).
    const discarded = [...FIRST_RUNG_CARDS];
    seed({
      completedRungIds: [],
      run: {
        rungId: 'r1',
        cycleIndex: 0,
        queue: discarded,
        position: 2,
        failedThisCycle: [],
        passedThisRun: ['a', 'i'],
      },
    });

    const { user, unmount } = renderRunWithRouter(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const restarted = storedRun().queue;

    unmount();
    renderRun(FIRST_RUN);

    expect(storedRun().queue).toEqual(restarted);
    expect(screen.getByText(frontOf(restarted[0]))).toBeInTheDocument();
    // Nothing is carried over from the run that was thrown away.
    expect(storedRun().passedThisRun).toEqual([]);
  });

  it('records the position after every card is marked (FR-028, SC-009)', async () => {
    const user = renderRun(FIRST_RUN);

    // Read off the screen rather than assumed from the config: the run is shuffled,
    // so the only thing that says which card is being answered is the card shown.
    const passed = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(readDeckRecord(dolchPreK5).run).toMatchObject({
      position: 1,
      passedThisRun: [passed],
      failedThisCycle: [],
    });

    const failed = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(readDeckRecord(dolchPreK5).run).toMatchObject({
      position: 2,
      passedThisRun: [passed],
      failedThisCycle: [failed],
    });
  });

  it('resumes on the card it stopped on, re-presenting nothing already passed (FR-029, FR-030)', async () => {
    seed({
      run: {
        rungId: 'r1',
        cycleIndex: 0,
        queue: FIRST_RUNG_CARDS,
        position: 2,
        failedThisCycle: ['i'],
        passedThisRun: ['a'],
      },
    });
    const user = renderRun(FIRST_RUN);

    expect(screen.getByText('the')).toBeInTheDocument();
    // Both bars come back where the interruption left them, not at zero.
    expect(progressOf('Cards done in this round')).toBe('2 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');
    expect(screen.queryByText('a')).not.toBeInTheDocument();

    // Clearing the three that are left ends the run on the one still failed,
    // never on a card passed before the interruption.
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(progressOf('Cards done in this round')).toBe('0 of 1 cards');
    expect(progressOf('Cards got right')).toBe('4 of 5 cards');
  });

  it('starts a fresh run when the stored one belongs to another rung', () => {
    seed({
      run: {
        rungId: 'r2',
        cycleIndex: 0,
        queue: SECOND_RUNG_CARDS,
        position: 6,
        failedThisCycle: [],
        passedThisRun: ['a', 'i', 'the', 'and', 'to', 'is'],
      },
    });
    renderRun(FIRST_RUN);

    // All five of r1 to do, in r1's own fresh order — not the four left of the
    // stored r2 run, and not resumed into it.
    expect(progressOf('Cards done in this round')).toBe('0 of 5 cards');
    expect(progressOf('Cards got right')).toBe('0 of 5 cards');
    expect(FIRST_RUNG_CARDS).toContain(shownCard(FIRST_RUNG_CARDS));
    expect(members(storedRun().queue)).toEqual(members(FIRST_RUNG_CARDS));
  });

  it('clears the stored run on completion, leaving nothing to resume', async () => {
    const user = renderRun(FIRST_RUN);
    await clearRun(user, 5);

    expect(readDeckRecord(dolchPreK5).run).toBeUndefined();
    expect(readDeckRecord(dolchPreK5).completedRungIds).toEqual(['r1']);
  });

  it('replaces only the run when Start over is used mid-run (FR-032, SC-015)', async () => {
    seed({
      completedRungIds: ['r1'],
      run: {
        rungId: 'r1',
        cycleIndex: 0,
        queue: FIRST_RUNG_CARDS,
        position: 3,
        failedThisCycle: ['i'],
        passedThisRun: ['a', 'the'],
      },
    });
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    // The rung stays completed, so it stays unlocked and mastery is unaffected.
    expect(readDeckRecord(dolchPreK5).completedRungIds).toEqual(['r1']);
    // The half-finished run is gone and a whole one written over it: same five
    // words, nothing marked, position 0. The order is the restart's own shuffle
    // (FR-017), so it is the membership that is asserted, not the sequence.
    const run = storedRun();
    expect(run).toMatchObject({
      rungId: 'r1',
      cycleIndex: 0,
      position: 0,
      failedThisCycle: [],
      passedThisRun: [],
    });
    expect(members(run.queue)).toEqual(members(FIRST_RUNG_CARDS));
    expect(screen.getByText(frontOf(run.queue[0]))).toBeInTheDocument();
  });
});

// Storage being full is a normal condition, handled explicitly rather than
// swallowed (constitution Principle II).
describe('Run — a device with no room left', () => {
  const realLocalStorage: unknown = globalThis.localStorage;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: realLocalStorage,
    });
  });

  /**
   * A full device, as a real one behaves: every write is refused, and everything
   * already in the store reads back normally. This is what makes the tests below
   * mean anything — a double whose `getItem` returns `null` lets safeStorage's
   * memory mirror win every read, which no browser ever does and which hides the
   * whole question of what a learner still has after a refused write.
   *
   * The same record is seeded into the mirror, because that is the state a
   * session is already in by the time a write is first refused: it has read the
   * store, so the two agree until the first write that does not land.
   *
   * The shape is src/storage/safeStorage.test.ts's `fullStorage`, kept the same
   * on purpose so there is one idea of a full store and not two.
   */
  function fillStorage(record: StoredRecord = {}): void {
    seed(record);
    const entries = new Map([[deckKey(dolchPreK5.id), recordJson(record)]]);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => ({
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
    });
  }

  it('says progress is not being saved, and the run carries on regardless', async () => {
    fillStorage();
    const user = renderRun(FIRST_RUN);

    // Said from entry: the write that records the run has already been refused,
    // so there is already something the device will not be keeping.
    expect(screen.getByRole('status')).toHaveTextContent(/Progress is not being saved/);

    // Told rather than silently lied to — and the run is still usable: each mark
    // moves it on to a card it has not shown yet, refused write or not.
    const first = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    const second = shownCard(FIRST_RUNG_CARDS);
    expect(second).not.toBe(first);
    expect(progressOf('Cards done in this round')).toBe('1 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect([first, second]).not.toContain(shownCard(FIRST_RUNG_CARDS));
    expect(progressOf('Cards done in this round')).toBe('2 of 5 cards');
    expect(progressOf('Cards got right')).toBe('1 of 5 cards');
    expect(screen.getByRole('status')).toHaveTextContent(/Progress is not being saved/);
  });

  // What the message promises is exactly this: the run keeps working, and only
  // the tab closing loses it. A rung completed on a full device has to stay
  // completed for the rest of the session, or the wording would be a lie.
  it('keeps a rung completed on a full device visible on the ladder afterwards', async () => {
    fillStorage();
    const user = renderJourney(FIRST_RUN);
    while (screen.queryByRole('button', { name: 'Got it' }) !== null) {
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }
    expect(screen.getByText('Run complete')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Leave this run' }));

    // The rung reads as completed, and the one above it has opened — the whole
    // consequence of the completion, not just a label.
    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '10 words' })).toBeInTheDocument();
  });

  // Start over on the ladder writes too, and that write is refused just the same.
  it('reaches a fresh run and says so when Start over is used on a full device', async () => {
    fillStorage({ completedRungIds: ['r1'], run: SECOND_RUNG_RUN });
    const user = renderJourney(`/deck/${dolchPreK5.id}`);
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    // The discarded run does not come back: the store still holds it, but this
    // session reads its own write back and finds nothing to resume. Both bars
    // empty against ten, not four marked of the abandoned run, and a card of r2
    // freshly drawn.
    expect(progressOf('Cards done in this round')).toBe('0 of 10 cards');
    expect(progressOf('Cards got right')).toBe('0 of 10 cards');
    expect(SECOND_RUNG_CARDS).toContain(shownCard(SECOND_RUNG_CARDS));

    // And the learner is told, on the screen they are now looking at, that the
    // discard did not reach the device (constitution Principle II).
    expect(screen.getByRole('status')).toHaveTextContent(/Progress is not being saved/);
  });
});

// The one failure no existing check catches. `readRun` validates a queue against
// the rung as a set, so two different permutations of the same cards both read
// back clean: nothing throws, nothing is logged, and the learner is handed an
// order that is not the one they were on. Only element-wise equality sees it.
describe('Run — the order stored is the order presented (FR-011, FR-015, FR-016)', () => {
  // Named cards, not positions: cycle 0 arrives shuffled, so which card comes
  // when is not knowable in advance. Four failed leaves a cycle-1 queue with 24
  // possible orders, so two independent shuffles agreeing by luck is remote.
  const FAILED_CARDS = ['i', 'the', 'and', 'to'];

  /**
   * One global stream, drawn from by both computations of the same transition.
   * That is precisely what makes the divergence observable: the reducer React
   * runs and the reducer `apply` runs to decide what to persist take *successive*
   * values off this stream, so they shuffle the same four cards differently.
   *
   * A stub returning a constant would do the opposite — both shuffles would draw
   * the same values, land on the same order, and the bug would pass unseen.
   * Deterministic here means one reproducible sequence, not one repeated value.
   *
   * This overrides the file-level stub rather than duplicating it: the seed is this
   * describe's own, chosen when the case was written, and re-stubbing here restarts
   * the stream at that seed for every test in it. The file-level hook would give a
   * stream that advances too, so the case does not depend on 2026 in particular —
   * it is kept because the reasoning above is about this test and belongs with it.
   */
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(seededRng(2026));
  });

  it('writes the order it is about to present, not a second shuffle of the same cards', async () => {
    const user = renderRun(FIRST_RUN);

    // Cycle 0, answered by card identity: everything but "a" comes back.
    for (let card = 0; card < FIRST_RUNG_CARDS.length; card += 1) {
      const outcome = FAILED_CARDS.includes(shownCard(FIRST_RUNG_CARDS)) ? 'Not yet' : 'Got it';
      await user.click(screen.getByRole('button', { name: outcome }));
    }

    // The boundary is behind us — the only transition that draws randomness. This
    // is the record a closed tab would resume from.
    const storedQueue = readDeckRecord(dolchPreK5).run?.queue ?? [];
    expect(storedQueue).toHaveLength(FAILED_CARDS.length);

    // What the learner is actually shown, card by card, for the rest of the cycle.
    const presented: string[] = [];
    for (let card = 0; card < FAILED_CARDS.length; card += 1) {
      presented.push(shownCard(FAILED_CARDS));
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }

    expect(
      storedQueue,
      `stored order [${storedQueue.join(', ')}] is not the order presented [${presented.join(', ')}]`,
    ).toEqual(presented);
  });
});

// Resume is only worth anything if it is invisible. The two claims are the
// learner's, not the code's: the run you come back to is the run you would have
// had if you had never closed the tab (SC-005, FR-011, FR-012), and a card you
// got right never comes back (SC-006, FR-014). Together they are data-model I10.
describe('Run — an interrupted run resumes into the run it already was (SC-005, SC-006)', () => {
  // Its own seed, so this case does not silently inherit whatever order the
  // file-level stream happens to deal. See `playRun` for why it is re-installed
  // per playthrough rather than once per test.
  const RESUME_SEED = 20260501;

  // r2 throughout: ten cards, so a cycle is long enough to be interrupted in the
  // middle of and the boundary is not also the end of the run.
  //
  // A policy, not a script: fail these the first time they come up, pass
  // everything else. It is a function of card identity and nothing else, so it
  // smuggles in no order of its own, and it guarantees a second cycle — which is
  // where the only mid-run shuffle lives.
  const FAIL_ON_FIRST_SIGHT = ['i', 'the', 'up', 'me'];
  // Fixed by the policy rather than by the seed: cycle 0 is the whole rung, and
  // cycle 1 is exactly the four failed in it, all passed on sight.
  const CYCLE_0_MARKS = SECOND_RUNG_CARDS.length;
  const TOTAL_MARKS = CYCLE_0_MARKS + FAIL_ON_FIRST_SIGHT.length;
  // Twice mid cycle 0, exactly on the cycle boundary, and mid cycle 1.
  const INTERRUPTIONS = [3, 7, CYCLE_0_MARKS, CYCLE_0_MARKS + 2];

  type Marked = { card: string; outcome: 'Got it' | 'Not yet' };

  /**
   * One playthrough of r2, interrupted after each mark counted in
   * `interruptAfter`, returning every card presented and how it was answered.
   *
   * Why two of these are comparable at all — the thing that could quietly make
   * this whole case meaningless. `Math.random` is one global stream, so if the
   * interrupted playthrough drew a different number of values off it than the
   * uninterrupted one, the two would present different orders for a reason that
   * has nothing to do with resume. They do not:
   *
   *  - randomness is drawn only inside `shuffle`, and `shuffle` is reached only
   *    from `start` (a fresh run) and from `mark` at a cycle boundary that has
   *    failures — nothing else on this screen draws;
   *  - a remount whose run is still in the store takes `resume`'s stored branch,
   *    calls no reducer, and so costs the stream nothing;
   *  - both playthroughs therefore draw one `start` shuffle at the first mount and
   *    one shuffle per boundary, at the same points in the same run of marks.
   *
   * Re-installing `seededRng(RESUME_SEED)` here — over the file-level stub, which
   * has already advanced by the time a second playthrough begins — puts every
   * playthrough at position 0 of the same stream. That is the entire setup, and it
   * assumes nothing about the code being right: if a remount ever did draw, by
   * `resume` falling through to `start`, the sequences would diverge, and a
   * diverged sequence is precisely the failure this case is looking for.
   */
  async function playRun(interruptAfter: readonly number[]): Promise<Marked[]> {
    seed();
    vi.spyOn(Math, 'random').mockImplementation(seededRng(RESUME_SEED));

    let mounted = renderRunWithRouter(SECOND_RUN);
    const marked: Marked[] = [];
    const seen = new Set<string>();

    while (screen.queryByRole('button', { name: 'Got it' }) !== null) {
      // Read off the screen: the run is shuffled, so the card being answered is
      // whichever one is being presented and never one a position implies.
      const card = shownCard(SECOND_RUNG_CARDS);
      const outcome: Marked['outcome'] =
        FAIL_ON_FIRST_SIGHT.includes(card) && !seen.has(card) ? 'Not yet' : 'Got it';
      seen.add(card);
      marked.push({ card, outcome });
      await mounted.user.click(screen.getByRole('button', { name: outcome }));

      if (interruptAfter.includes(marked.length)) {
        mounted.unmount();
        mounted = renderRunWithRouter(SECOND_RUN);
      }
      // The policy shrinks every cycle, so a run that has not ended by here is a
      // run that is not ending. Fail loudly rather than hanging the suite.
      if (marked.length > TOTAL_MARKS * 4) {
        throw new Error(`Run did not end after ${marked.length} marks`);
      }
    }
    return marked;
  }

  /** The sequence of cards, which is the thing SC-005 is about. */
  function sequence(marked: readonly Marked[]): string[] {
    return marked.map((entry) => entry.card);
  }

  it('presents the sequence an uninterrupted playthrough presents (SC-005, FR-011, FR-012)', async () => {
    const uninterrupted = await playRun([]);
    // The reference is worth comparing against: it runs past a cycle boundary, so
    // the interruptions below land on both sides of the one mid-run shuffle.
    expect(uninterrupted).toHaveLength(TOTAL_MARKS);

    // Each point on its own, then all four in a single playthrough.
    for (const points of [...INTERRUPTIONS.map((at) => [at]), INTERRUPTIONS]) {
      const resumed = await playRun(points);
      expect(
        sequence(resumed),
        `interrupted after mark ${points.join(', ')}: [${sequence(resumed).join(', ')}] is not the uninterrupted [${sequence(uninterrupted).join(', ')}]`,
      ).toEqual(sequence(uninterrupted));
    }
  });

  it('never presents a card again once it has been marked Got it (SC-006, FR-014)', async () => {
    const marked = await playRun(INTERRUPTIONS);

    // Every presentation in the run, not a spot check: by the time each card comes
    // up, it must not already have been cleared.
    const passed = new Set<string>();
    for (const [index, entry] of marked.entries()) {
      expect(
        passed.has(entry.card),
        `"${entry.card}" was presented again at mark ${index + 1}, after being marked Got it`,
      ).toBe(false);
      if (entry.outcome === 'Got it') {
        passed.add(entry.card);
      }
    }

    // And not vacuously: cards really do come back in this run — four of them were
    // failed and re-presented — every card of the rung was reached, and the run
    // was interrupted four times along the way.
    expect(
      marked.filter((entry) => entry.outcome === 'Not yet').map((entry) => entry.card),
    ).toEqual(expect.arrayContaining(FAIL_ON_FIRST_SIGHT));
    expect(marked).toHaveLength(TOTAL_MARKS);
    expect(members([...new Set(sequence(marked))])).toEqual(members(SECOND_RUNG_CARDS));
  });
});

// jsdom has no Web Speech API, so every test above this line runs down the path
// FR-011 describes and never meets a pronounce button at all. This block installs
// one for its own duration and takes it away again — the rest of the file depends
// on the API being absent, and a leaked stub would quietly turn those tests into
// something else.
//
// What is asserted here is what the device was asked to say. Whether `speak` was
// called is not a claim about anything a learner can hear, and whether sound
// leaves the device is the one thing no test can see (research § Decision 7).
describe('Run — hearing the word (US1)', () => {
  /**
   * A stand-in for `SpeechSynthesisUtterance`: the text it was made with, and the
   * two handlers that mean speech has stopped. Nothing else of the real interface
   * is touched, and the properties the control sets on it — `lang`, `voice` — are
   * deliberately not read back. A stub that echoes whatever it was handed can
   * only restate the diff (research § Decision 7).
   */
  class StubUtterance {
    readonly text: string;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(text: string) {
      this.text = text;
    }
  }

  /**
   * The stubbed API, and the only window onto what would have been said.
   *
   * `getVoices` answers with an empty list on purpose: `pickVoice` finds nothing
   * in it, so no voice is set and the browser's own en-US default speaks, which
   * is the last resort the contract specifies (§ 3 rule 5) and the path a device
   * with no voices loaded yet takes. Which voice is chosen is
   * src/speech/voice.test.ts's question, not this file's.
   */
  const speech = {
    /** Every utterance handed over, in the order it was handed over. */
    spoken: [] as StubUtterance[],

    /** How many times the device was told to stop talking. */
    cancelled: 0,

    /**
     * Whether this stubbed browser reports a cancel back through the utterance's
     * `error` handler. Real ones are supposed to; the point of being able to turn
     * it off is that the control must not depend on it.
     */
    reportsCancel: true,

    /**
     * What the device was asked to say — the assertable outcome. Compared in
     * lower case because none of the tests below is about capitalisation, and one
     * card in this rung is capitalised; `saidAsCapital` is where case is the
     * point. `frontOf` is likewise lowered at each comparison rather than here,
     * so the two sides stay independently written.
     */
    words(): string[] {
      return speech.spoken.map((utterance) => utterance.text.toLowerCase());
    },

    /** Anything handed over that a device would announce as "capital X". */
    saidAsCapital(): string[] {
      return speech.spoken
        .map((utterance) => utterance.text)
        .filter((text) => text.length === 1 && text !== text.toLowerCase());
    },

    /**
     * The utterance still speaking finishes, or fails. Both are the end of
     * speech, and both are here because a cancel comes back through the error
     * path (`canceled` / `interrupted`) rather than through `end`.
     */
    end(): void {
      speech.stop('onend');
    },
    error(): void {
      speech.stop('onerror');
    },
    stop(handler: 'onend' | 'onerror'): void {
      const utterance = speech.spoken.at(-1);
      if (utterance === undefined) {
        throw new Error('Nothing has been spoken, so nothing can stop speaking');
      }
      act(() => {
        utterance[handler]?.();
      });
    },
  };

  beforeEach(() => {
    speech.spoken.length = 0;
    speech.cancelled = 0;
    speech.reportsCancel = true;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: (utterance: StubUtterance) => speech.spoken.push(utterance),
        // A browser's `cancel` ends whatever is speaking through the error path,
        // so the stub does too — otherwise it would model a device that stops
        // making sound but never admits it, which no real one does. Called on
        // every word change and every unmount, including ones where nothing was
        // ever spoken, hence the missing handler being unremarkable.
        cancel: () => {
          speech.cancelled += 1;
          if (speech.reportsCancel) {
            speech.spoken.at(-1)?.onerror?.();
          }
        },
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: StubUtterance,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
  });

  it('offers a way to hear the word while a card is showing, and none once the run is over', async () => {
    const user = renderRun(FIRST_RUN);
    expect(screen.getByRole('button', { name: 'Hear the word' })).toBeInTheDocument();

    await clearRun(user, 5);

    // There is no word on the completed screen, so there is nothing to hear
    // (FR-010).
    expect(screen.getByText('Run complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hear the word' })).not.toBeInTheDocument();
  });

  it('never hands over a lone capital, which a device announces as one', async () => {
    // The Pre-K deck's "I" is capitalised, because that is how a reader meets the
    // word — and a device reads a lone capital as "capital I", which is the
    // opposite of hearing the word read. The card keeps its capital; only what is
    // handed to the device is lowered. Every card of the rung is pressed, since
    // the shuffle decides which one is "I".
    const user = renderRun(FIRST_RUN);
    for (let card = 0; card < FIRST_RUNG_CARDS.length; card += 1) {
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      speech.end();
      await user.click(screen.getByRole('button', { name: 'Not yet' }));
    }

    expect(speech.words()).toHaveLength(FIRST_RUNG_CARDS.length);
    expect(speech.saidAsCapital()).toEqual([]);
    // And the word itself is still what was asked for, not something emptied out.
    expect(speech.words()).toContain('i');
  });

  it('says the word on the card currently on screen, never the one before it (FR-005)', async () => {
    const user = renderRun(FIRST_RUN);
    // Read off the screen rather than named: the run is shuffled, so the only
    // thing that says which word should be spoken is the card being presented.
    const first = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Hear the word' }));
    expect(speech.words()).toEqual([frontOf(first).toLowerCase()]);

    speech.end();
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    // The card has moved on, and so has what is said.
    const second = shownCard(FIRST_RUNG_CARDS);
    await user.click(screen.getByRole('button', { name: 'Hear the word' }));
    expect(speech.words()).toEqual([frontOf(first).toLowerCase(), frontOf(second).toLowerCase()]);
  });

  it('changes nothing about the run: no outcome, no advance, nothing stored (FR-006, FR-016)', async () => {
    const user = renderRun(FIRST_RUN);
    const card = shownCard(FIRST_RUNG_CARDS);
    const before = readDeckRecord(dolchPreK5);

    await user.click(screen.getByRole('button', { name: 'Hear the word' }));
    speech.end();
    await user.click(screen.getByRole('button', { name: 'Hear the word' }));

    // Both presses reached the device, so what follows is a claim about a button
    // that did something rather than about one that did nothing at all.
    expect(speech.words()).toEqual([frontOf(card).toLowerCase(), frontOf(card).toLowerCase()]);
    // The same card, neither bar moved, and the device holding exactly what it
    // held before the button was ever pressed (FR-022).
    expect(shownCard(FIRST_RUNG_CARDS)).toBe(card);
    expect(progressOf('Cards done in this round')).toBe('0 of 5 cards');
    expect(progressOf('Cards got right')).toBe('0 of 5 cards');
    expect(readDeckRecord(dolchPreK5)).toEqual(before);
  });

  // Hearing the word points the learner at "Not yet" (007). The observable is
  // `data-variant`, set by src/components/ui/button.tsx — read as a pair it is
  // unambiguous, because green never accompanies `secondary`. Deliberately not a
  // class name and not a colour: jsdom does not resolve Tailwind utilities, so a
  // computed-style check here would pass while checking nothing (007 research
  // § Decision 3). Whether the two fills are far enough apart to read as
  // emphasis is a judgement a person makes at the screen, not a test.
  describe('what the screen recommends after hearing it (007 US1)', () => {
    function emphasis(): { gotIt: string | null; notYet: string | null } {
      return {
        gotIt: screen.getByRole('button', { name: 'Got it' }).getAttribute('data-variant'),
        notYet: screen.getByRole('button', { name: 'Not yet' }).getAttribute('data-variant'),
      };
    }

    it('swaps which outcome is emphasised (007 FR-001)', async () => {
      const user = renderRun(FIRST_RUN);
      expect(emphasis()).toEqual({ gotIt: 'default', notYet: 'secondary' });

      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      expect(emphasis()).toEqual({ gotIt: 'secondary', notYet: 'default' });
    });

    it('presses nothing and marks nothing (007 FR-003)', async () => {
      const user = renderRun(FIRST_RUN);
      const card = shownCard(FIRST_RUNG_CARDS);

      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      // The same word is still being asked for, and both ways of answering are
      // still open — the emphasis is a suggestion, not a decision taken for the
      // learner.
      expect(shownCard(FIRST_RUNG_CARDS)).toBe(card);
      expect(screen.getByRole('button', { name: 'Got it' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Not yet' })).toBeEnabled();
    });

    // Every presentation of a card starts from the default pair (007 FR-007).
    // "Not yet" rather than "Got it" for the marking case: the rung has five
    // cards so neither mark can complete the run and unmount the outcomes, and
    // marking "Not yet" also shows the reset does not depend on which outcome
    // was chosen.
    it('presents the next card with the default emphasis (007 FR-007)', async () => {
      const user = renderRun(FIRST_RUN);
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      await user.click(screen.getByRole('button', { name: 'Not yet' }));

      expect(emphasis()).toEqual({ gotIt: 'default', notYet: 'secondary' });
    });

    it('presents a started-over run with the default emphasis (007 FR-007)', async () => {
      const user = renderRun(FIRST_RUN);
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      await user.click(screen.getByRole('button', { name: 'Start over' }));

      expect(emphasis()).toEqual({ gotIt: 'default', notYet: 'secondary' });
    });

    it('leaves the emphasis alone when pressed again mid-word (007 FR-006)', async () => {
      const user = renderRun(FIRST_RUN);
      const hear = screen.getByRole('button', { name: 'Hear the word' });

      await user.click(hear);
      const afterFirst = emphasis();
      // No `speech.end()` between them, so the second press reaches a control
      // that is already speaking and starts nothing. It must still leave the
      // screen recommending the same thing rather than toggling back.
      await user.click(hear);

      expect(emphasis()).toEqual(afterFirst);
    });

    // The one path where it matters that the press is reported *above* the
    // already-speaking guard rather than below it, and the only one a test can
    // reach: fail the last card of a cycle as its only failure and the engine
    // re-presents that same card at once (src/run/reducer.ts). The word has not
    // changed, so nothing cancelled the speech and the control is still
    // speaking — a press here starts no sound at all. It must still point the
    // learner at "Not yet", because what the learner did was ask to hear the
    // word (007 FR-002). Move `onHeard()` below the guard and this is the test
    // that goes red.
    it('swaps on a press that starts no sound (007 FR-002)', async () => {
      const user = renderRun(FIRST_RUN);
      for (let card = 0; card < FIRST_RUNG_CARDS.length - 1; card += 1) {
        await user.click(screen.getByRole('button', { name: 'Got it' }));
      }
      const last = shownCard(FIRST_RUNG_CARDS);
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      await user.click(screen.getByRole('button', { name: 'Not yet' }));

      // The same word came straight back, so this is a new presentation of a
      // card that is still being spoken — the reset ran, and the speech did not.
      expect(shownCard(FIRST_RUNG_CARDS)).toBe(last);
      expect(emphasis()).toEqual({ gotIt: 'default', notYet: 'secondary' });
      const spokenSoFar = speech.words().length;

      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      expect(speech.words()).toHaveLength(spokenSoFar);
      expect(emphasis()).toEqual({ gotIt: 'secondary', notYet: 'default' });
    });
  });

  // Inside the block above so it speaks through the same stub. What is counted
  // here is utterances, because the count is the requirement: "spoken exactly
  // once" is a number, not a state, and it is the only form of the rule a test
  // can hold. The animation is not asserted — it is a class name (Principle IV)
  // and whether it is subtle enough is a judgement a person makes, not a test.
  describe('pressing it again while it is still speaking (US2)', () => {
    it('says the word once however many times it is pressed (FR-007, SC-003)', async () => {
      const user = renderRun(FIRST_RUN);
      const card = shownCard(FIRST_RUNG_CARDS);

      const hear = screen.getByRole('button', { name: 'Hear the word' });
      for (let press = 0; press < 5; press += 1) {
        await user.click(hear);
      }

      // Four of the five presses reached a control that was already speaking and
      // did nothing at all — nothing spoken twice, and nothing kept back to play
      // afterwards, which is what the run has to show once speech ends.
      expect(speech.words()).toEqual([frontOf(card).toLowerCase()]);
      speech.end();
      expect(speech.words()).toEqual([frontOf(card).toLowerCase()]);
    });

    it('says it again once it has finished saying it (FR-008)', async () => {
      const user = renderRun(FIRST_RUN);
      const card = shownCard(FIRST_RUNG_CARDS);

      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      speech.end();
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      expect(speech.words()).toEqual([frontOf(card).toLowerCase(), frontOf(card).toLowerCase()]);
    });

    it('says it again after a pronunciation that failed (FR-012)', async () => {
      const user = renderRun(FIRST_RUN);
      const card = shownCard(FIRST_RUNG_CARDS);

      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      // The same end of speech as `end`, arrived at the other way. A failure that
      // left the control unpressable would strand a learner on a word for the
      // rest of the run.
      speech.error();
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      expect(speech.words()).toEqual([frontOf(card).toLowerCase(), frontOf(card).toLowerCase()]);
    });

    it('stops talking and advances as usual when a card is marked mid-word (FR-009, SC-005)', async () => {
      const user = renderRun(FIRST_RUN);
      const first = shownCard(FIRST_RUNG_CARDS);
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      expect(speech.words()).toEqual([frontOf(first).toLowerCase()]);

      // Marked while it is still talking, which is what a child does.
      await user.click(screen.getByRole('button', { name: 'Got it' }));

      // The device was told to stop, and the run moved on exactly as it does
      // when nothing is speaking: a new card, and both bars a card further on.
      expect(speech.cancelled).toBe(1);
      const second = shownCard(FIRST_RUNG_CARDS);
      expect(second).not.toBe(first);
      expect(progressOf('Cards done in this round')).toBe('1 of 5 cards');
      expect(progressOf('Cards got right')).toBe('1 of 5 cards');

      // And the control came back to the new card rather than staying latched on
      // the interrupted one.
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));
      expect(speech.words()).toEqual([frontOf(first).toLowerCase(), frontOf(second).toLowerCase()]);
    });

    it('comes back to idle on a browser that cancels without saying so', async () => {
      // The test above passes on the strength of the stub firing `onerror` when
      // it is cancelled, which is what a browser is supposed to do. This one
      // takes that away. Reaching the next word must not depend on a promise
      // another program keeps: a device that stops making sound without
      // admitting it would leave the button dead for the rest of the run, and
      // silently, which is the failure this whole feature is most exposed to.
      speech.reportsCancel = false;
      const user = renderRun(FIRST_RUN);
      const first = shownCard(FIRST_RUNG_CARDS);
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      await user.click(screen.getByRole('button', { name: 'Got it' }));
      const second = shownCard(FIRST_RUNG_CARDS);
      await user.click(screen.getByRole('button', { name: 'Hear the word' }));

      expect(speech.words()).toEqual([frontOf(first).toLowerCase(), frontOf(second).toLowerCase()]);
    });
  });
});

describe('Run — where nothing can speak (US3)', () => {
  // No stub, so `speechSynthesis` is absent exactly as it is for every other
  // test in this file. That is jsdom's own state and the reason the rest of the
  // suite never meets the control at all — this states it as an expectation
  // rather than leaving it an unremarked property of the environment (FR-011).
  it('drops the control and keeps every other one', () => {
    renderRun(FIRST_RUN);

    expect(screen.queryByRole('button', { name: 'Hear the word' })).not.toBeInTheDocument();

    // The run is untouched: the word is readable and every way through it works.
    expect(shownCard(FIRST_RUNG_CARDS)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leave this run' })).toBeInTheDocument();
  });
});
