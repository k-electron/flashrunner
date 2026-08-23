import { createBrowserRouter } from 'react-router';
import { DeckLadder } from '@/routes/DeckLadder';
import { Home } from '@/routes/Home';
import { Run } from '@/routes/Run';

/**
 * Library mode only. Framework mode server-renders by default, which
 * Principle I treats as a MAJOR amendment. See specs/000-scaffold/plan.md.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/deck/:deckId', element: <DeckLadder /> },
  { path: '/deck/:deckId/rung/:rungId', element: <Run /> },
]);
