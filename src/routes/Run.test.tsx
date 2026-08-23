// Queried by role and visible text only — no class names, no internals, no
// snapshots (Principle IV). The mechanic itself is covered by src/run/reducer.test.ts.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dolchPreK5 } from '@/decks/dolch-prek-5';
import { Run } from '@/routes/Run';
import { readDeckRecord, type PersistedRun } from '@/storage/deckRecord';
import { deckKey } from '@/storage/keys';
import { writeItem } from '@/storage/safeStorage';

// The real registry, because the route resolves through it. Rung r1 of the
// Pre-K ladder is the five words a, I, the, and, to; r8 is the whole 40-word deck.
const FIRST_RUN = '/deck/dolch-prek-5/rung/r1';
// Rung r2 of the same ladder is those five words plus is, it, in, up, me.
const SECOND_RUN = '/deck/dolch-prek-5/rung/r2';
const TOP_RUN = '/deck/dolch-prek-5/rung/r8';
const FIRST_RUNG_CARDS = ['a', 'i', 'the', 'and', 'to'];

/**
 * Seeds the deck's stored record, defaulting to a deck that has been started but
 * has nothing completed and nothing to resume.
 *
 * Every transition writes, and the store outlives a single test — under Node 26
 * `globalThis.localStorage` reads back undefined, so safeStorage keeps one
 * module-level in-memory map for the whole file. Seeding makes each test start
 * from a known state rather than from what the last one left.
 */
function seed(record: { completedRungIds?: string[]; run?: PersistedRun } = {}): void {
  writeItem(
    deckKey(dolchPreK5.id),
    JSON.stringify({ schemaVersion: 1, completedRungIds: [], ...record }),
  );
}

beforeEach(() => {
  seed();
});

/** Renders the run route and hands back the router, for tests that navigate. */
function renderRunWithRouter(path: string) {
  const router = createMemoryRouter([{ path: '/deck/:deckId/rung/:rungId', element: <Run /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router };
}

function renderRun(path: string) {
  return renderRunWithRouter(path).user;
}

/** Marks every card of the current cycle "Got it", which clears the run. */
async function clearRun(user: ReturnType<typeof userEvent.setup>, cards: number) {
  for (let card = 0; card < cards; card += 1) {
    await user.click(screen.getByRole('button', { name: 'Got it' }));
  }
}

describe('Run', () => {
  it('shows the first card of the rung', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('offers both outcomes by their accessible names', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not yet' })).toBeInTheDocument();
  });

  it('shows how many cards are left in the round and counts down as they are marked', async () => {
    const user = renderRun(FIRST_RUN);
    expect(screen.getByText('5 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('4 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.getByText('3 cards left in this round')).toBeInTheDocument();
  });

  it('advances to the next card when the current one is marked', async () => {
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
  });

  it('brings a failed card back in the next round', async () => {
    const user = renderRun(FIRST_RUN);
    for (let card = 0; card < 4; card += 1) {
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }
    // The last card of the round, "to", is the only one failed.
    await user.click(screen.getByRole('button', { name: 'Not yet' }));

    expect(screen.getByText('1 card left in this round')).toBeInTheDocument();
    expect(screen.getByText('to')).toBeInTheDocument();
  });

  it('returns to the first card of the first round when Start over is used', async () => {
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.getByText('3 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('5 cards left in this round')).toBeInTheDocument();
  });

  it('offers a way out of the run, back to the deck it belongs to', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByRole('link', { name: 'Leave this run' })).toHaveAttribute(
      'href',
      '/deck/dolch-prek-5',
    );
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
    expect(screen.getByText('4 cards left in this round')).toBeInTheDocument();

    await act(async () => {
      await router.navigate(SECOND_RUN);
    });

    // The ten-word rung from its first card, not the five-word queue carried over.
    expect(screen.getByText('10 cards left in this round')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
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

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('5 cards left in this round')).toBeInTheDocument();
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

  it('shows a plain message and a way home for a deck or rung that does not exist', () => {
    renderRun('/deck/no-such-deck/rung/r1');
    expect(screen.getByRole('heading', { name: 'Run not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });

  it('shows the same message for a rung the deck does not have', () => {
    renderRun('/deck/dolch-prek-5/rung/r99');
    expect(screen.getByRole('heading', { name: 'Run not found' })).toBeInTheDocument();
  });
});

// The store is only ever reached through src/storage/, so these assert what a
// learner would find on coming back rather than any internal of the components.
describe('Run — persistence and resume', () => {
  it('records the run on entry, before a single card has been marked', () => {
    renderRun(FIRST_RUN);

    expect(readDeckRecord(dolchPreK5).run).toEqual({
      rungId: 'r1',
      cycleIndex: 0,
      queue: FIRST_RUNG_CARDS,
      position: 0,
      failedThisCycle: [],
      passedThisRun: [],
    });
  });

  it('records the position after every card is marked (FR-028, SC-009)', async () => {
    const user = renderRun(FIRST_RUN);

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(readDeckRecord(dolchPreK5).run).toMatchObject({
      position: 1,
      passedThisRun: ['a'],
      failedThisCycle: [],
    });

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(readDeckRecord(dolchPreK5).run).toMatchObject({
      position: 2,
      passedThisRun: ['a'],
      failedThisCycle: ['i'],
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
    expect(screen.getByText('3 cards left in this round')).toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();

    // Clearing the three that are left ends the run on the one still failed,
    // never on a card passed before the interruption.
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText('1 card left in this round')).toBeInTheDocument();
  });

  it('starts a fresh run when the stored one belongs to another rung', () => {
    seed({
      run: {
        rungId: 'r2',
        cycleIndex: 0,
        queue: ['a', 'i', 'the', 'and', 'to', 'is', 'it', 'in', 'up', 'me'],
        position: 6,
        failedThisCycle: [],
        passedThisRun: ['a', 'i', 'the', 'and', 'to', 'is'],
      },
    });
    renderRun(FIRST_RUN);

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('5 cards left in this round')).toBeInTheDocument();
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

    const record = readDeckRecord(dolchPreK5);
    // The rung stays completed, so it stays unlocked and mastery is unaffected.
    expect(record.completedRungIds).toEqual(['r1']);
    expect(record.run).toEqual({
      rungId: 'r1',
      cycleIndex: 0,
      queue: FIRST_RUNG_CARDS,
      position: 0,
      failedThisCycle: [],
      passedThisRun: [],
    });
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

  function fillStorage(): void {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => ({
        getItem: () => null,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
    });
  }

  it('says progress is not being saved, and the run carries on regardless', async () => {
    fillStorage();
    const user = renderRun(FIRST_RUN);

    // Told at the first mark, which is the first moment there is progress to lose.
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText(/Progress is not being saved/)).toBeInTheDocument();

    // Told rather than silently lied to — and the run is still usable.
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText('4 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.getByText('the')).toBeInTheDocument();
    expect(screen.getByText(/Progress is not being saved/)).toBeInTheDocument();
  });
});
