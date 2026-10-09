import { authenticate } from './auth.js';
import { sql, ensureSchema } from './db.js';
import { HttpError, fail, ok } from './errors.js';
import { getYoutubeSettings } from './config.js';
import {
  completeTask,
  createCampaign,
  deleteCampaign,
  listCampaigns,
  listTasks,
  startTask,
  submitProof,
  updateCampaign,
} from './campaigns.js';
import {
  adminAction,
  adminState,
} from './admin.js';
import {
  claimAdReward,
  createDeposit,
  createWithdrawal,
  getBalance,
  getUser,
  listDeposits,
  listProofs,
  listWithdrawals,
} from './wallet.js';
import { checkTelegramMembershipOnEntry } from './membership.js';
import { readPositiveInteger } from './validation.js';

function routePath(req) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const fromQuery = url.searchParams.get('path');
  const raw = fromQuery ?? url.pathname.replace(/^\/api\/?/, '');
  return { segments: raw.split('/').filter(Boolean), query: url.searchParams };
}

const EMPTY_GET_DATA = {
  user: null,
  balance: { advertiserBalance: 0, viewerBalance: 0 },
  'admin/state': { users: [], deposits: [], withdrawals: [], campaigns: [], proofs: [], suspicious: [] },
};

export async function dispatch(req, res) {
  const { segments, query } = routePath(req);
  const method = req.method ?? 'GET';
  const resource = segments[0];
  const key = segments.join('/');

  if (method === 'GET' && key === 'youtube/settings') {
    ok(res, getYoutubeSettings());
    return;
  }

  if (!sql) {
    if (method === 'GET') {
      ok(res, key in EMPTY_GET_DATA ? EMPTY_GET_DATA[key] : []);
      return;
    }
    fail(res, 503, 'Service unavailable');
    return;
  }

  await ensureSchema();

  if (method === 'GET') {
    if (!process.env.TELEGRAM_BOT_TOKEN || !authenticate(req)) {
      if (resource === 'admin') {
        fail(res, 401, 'Unauthorized');
        return;
      }
      ok(res, key in EMPTY_GET_DATA ? EMPTY_GET_DATA[key] : []);
      return;
    }
    if (key === 'tasks') return listTasks(req, res, query);
    if (key === 'campaigns') return listCampaigns(req, res);
    if (key === 'user') return getUser(req, res);
    if (key === 'balance') return getBalance(req, res);
    if (key === 'proofs') return listProofs(req, res);
    if (key === 'deposits') return listDeposits(req, res);
    if (key === 'withdrawals') return listWithdrawals(req, res);
    if (key === 'admin/state') return adminState(req, res);
    throw new HttpError(404, 'Not found');
  }

  if (method === 'POST') {
    if (key === 'session/entry') return checkTelegramMembershipOnEntry(req, res);
    if (key === 'campaigns') return createCampaign(req, res);
    if (key === 'deposits') return createDeposit(req, res);
    if (key === 'withdrawals') return createWithdrawal(req, res);
    if (key === 'ads/reward') return claimAdReward(req, res);
    if (resource === 'tasks' && segments.length === 3) {
      const id = readPositiveInteger(segments[1], Number.MAX_SAFE_INTEGER);
      if (!id) throw new HttpError(400, 'Invalid request');
      if (segments[2] === 'start') return startTask(req, res, id);
      if (segments[2] === 'complete') return completeTask(req, res, id);
      if (segments[2] === 'proof') return submitProof(req, res, id);
    }
    throw new HttpError(404, 'Not found');
  }

  if (method === 'PATCH') {
    if (resource === 'campaigns' && segments.length === 2) {
      const id = readPositiveInteger(segments[1], Number.MAX_SAFE_INTEGER);
      if (!id) throw new HttpError(400, 'Invalid request');
      return updateCampaign(req, res, id);
    }
    if (resource === 'admin' && segments.length === 3) return adminAction(req, res, segments[1], segments[2]);
    throw new HttpError(404, 'Not found');
  }

  if (method === 'DELETE') {
    if (resource === 'campaigns' && segments.length === 2) {
      const id = readPositiveInteger(segments[1], Number.MAX_SAFE_INTEGER);
      if (!id) throw new HttpError(400, 'Invalid request');
      return deleteCampaign(req, res, id);
    }
    throw new HttpError(404, 'Not found');
  }

  throw new HttpError(405, 'Method not allowed');
}
