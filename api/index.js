import { dispatch } from '../server/router.js';
import { HttpError, fail } from '../server/errors.js';

/*
 * Vercel API entry point.
 *
 * Handlers and shared modules live in server/ (outside api/) because Vercel
 * deploys every file inside api/ as a separate Serverless Function, and the
 * Hobby plan allows at most 12 per deployment.
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
