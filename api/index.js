import { dispatch } from './router.js';
import { HttpError, fail } from './errors.js';

/*
 * Vercel API entry point.
 *
 * API handlers and shared server modules are split into sibling files under
 * api/ so the entry point stays small and easy to trace.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await dispatch(req, res);
  } catch (error) {
    if (error instanceof HttpError) {
      fail(res, error.status, error.message);
      return;
    }
    console.error('API error:', error instanceof Error ? error.message : 'unknown');
    fail(res, 500, 'Internal server error');
  }
}
