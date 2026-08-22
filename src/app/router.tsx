import { createBrowserRouter } from 'react-router';
import { Home } from '@/routes/Home';
import { Ping } from '@/routes/Ping';

/**
 * Library mode only. Framework mode server-renders by default, which
 * Principle I treats as a MAJOR amendment. See specs/000-scaffold/plan.md.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/ping', element: <Ping /> },
]);
