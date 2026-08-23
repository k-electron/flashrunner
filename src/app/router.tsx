import { createBrowserRouter } from 'react-router';
import { DeckLadder } from '@/routes/DeckLadder';
import { DeckList } from '@/routes/DeckList';
import { Run } from '@/routes/Run';

/**
 * Library mode only. Framework mode server-renders by default, which
 * Principle I treats as a MAJOR amendment. See specs/000-scaffold/plan.md.
 */
export const router = createBrowserRouter([
  { path: '/', element: <DeckList /> },
  { path: '/deck/:deckId', element: <DeckLadder /> },
  { path: '/deck/:deckId/rung/:rungId', element: <Run /> },
]);
