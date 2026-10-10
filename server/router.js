import { authenticate, isAdmin } from './auth.js';
import { sql, ensureSchema } from './db.js';
import { HttpError, fail, ok } from './errors.js';
import { DEFAULT_WITHDRAWAL_SETTINGS, getYoutubeSettings } from './config.js';
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
  sendAdminNotification,
  setMaintenance,
  setWithdrawalSettings,
  setAdSettings,
  setTaskRewardSettings,
  adminAdStats,
  deleteUser,
} from './admin.js';
import { getTaskRewardSettings } from './settings.js';
import {
  claimAdReward,
  createDeposit,
  createWithdrawal,
  getBalance,
  getAdProgress,
  getUser,
  listDeposits,
  listProofs,
  listWithdrawals,
  getPublicWithdrawalSettings,
} from './wallet.js';
import {
  completeMonetagStep,
  createMonetagSession,
  getMonetagSession,
  handleMonetagPostback,
} from './monetag.js';
import { checkTelegramMembershipOnEntry } from './membership.js';
import { readPositiveInteger, readText } from './validation.js';

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
  'withdrawal/settings': DEFAULT_WITHDRAWAL_SETTINGS,
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
    if (method === 'GET' && key === 'monetag/postback') {
      fail(res, 503, 'Service unavailable');
      return;
    }
    if (method === 'GET' && key === 'admin/state') {
      fail(res, 503, 'Service unavailable');
      return;
    }
    if (method === 'GET') {
      ok(res, key in EMPTY_GET_DATA ? EMPTY_GET_DATA[key] : []);
      return;
    }
    fail(res, 503, 'Service unavailable');
    return;
  }

  await ensureSchema();

  if (method === 'GET' && key === 'monetag/postback') {
    await handleMonetagPostback(req, res, query);
    return;
  }

  const authUser = authenticate(req);
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((id) => id.trim());
  const adminRequest = Boolean(authUser && adminIds.includes(String(authUser.id)));
  const maintenanceRows = await sql.query(`SELECT value::text AS enabled FROM vr_platform_settings WHERE key = 'maintenance'`);
  const maintenance = maintenanceRows[0]?.enabled === 'true';
  if (method === 'GET' && key === 'maintenance') {
    ok(res, { maintenance, isAdmin: Boolean(authUser && isAdmin(authUser.id)) });
    return;
  }
  if (method === 'GET' && key === 'withdrawal/settings') return getPublicWithdrawalSettings(req, res);
  if (method === 'GET' && key === 'settings/rewards') {
    ok(res, await getTaskRewardSettings());
    return;
  }
  if (maintenance && !adminRequest) {
    fail(res, 503, 'Platform is under maintenance');
    return;
  }

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
    if (key === 'ads/progress') return getAdProgress(req, res);
    if (key === 'ads/progress/adstera' || key === 'ads/progress/monetag') return getAdProgress(req, res, segments[2]);
    if (resource === 'ads' && segments[1] === 'monetag' && segments[2] === 'session' && segments.length === 4) {
      return getMonetagSession(req, res, readText(segments[3], 64));
    }
    if (key === 'proofs') return listProofs(req, res);
    if (key === 'deposits') return listDeposits(req, res);
    if (key === 'withdrawals') return listWithdrawals(req, res);
    if (key === 'admin/state') return adminState(req, res);
    if (key === 'admin/ad-stats') return adminAdStats(req, res);
    throw new HttpError(404, 'Not found');
  }

  if (method === 'POST') {
    if (key === 'session/entry') return checkTelegramMembershipOnEntry(req, res);
    if (key === 'admin/notifications/send') return sendAdminNotification(req, res);
    if (key === 'campaigns') return createCampaign(req, res);
    if (key === 'deposits') return createDeposit(req, res);
    if (key === 'withdrawals') return createWithdrawal(req, res);
    if (key === 'ads/reward') return claimAdReward(req, res);
    if (key === 'ads/reward/adstera') return claimAdReward(req, res, 'adstera');
    if (key === 'ads/monetag/session') return createMonetagSession(req, res);
    if (resource === 'ads' && segments[1] === 'monetag' && segments[2] === 'session' && segments[4] === 'complete' && segments.length === 5) {
      return completeMonetagStep(req, res, readText(segments[3], 64));
    }
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
    if (key === 'admin/settings/maintenance') return setMaintenance(req, res);
    if (key === 'admin/settings/withdrawal') return setWithdrawalSettings(req, res);
    if (key === 'admin/settings/ads') return setAdSettings(req, res);
    if (key === 'admin/settings/rewards') return setTaskRewardSettings(req, res);
    if (resource === 'campaigns' && segments.length === 2) {
      const id = readPositiveInteger(segments[1], Number.MAX_SAFE_INTEGER);
      if (!id) throw new HttpError(400, 'Invalid request');
      return updateCampaign(req, res, id);
    }
    if (resource === 'admin' && segments.length === 3) return adminAction(req, res, segments[1], segments[2]);
    throw new HttpError(404, 'Not found');
  }

  if (method === 'DELETE') {
    if (resource === 'admin' && segments[1] === 'users' && segments.length === 3) {
      const id = readPositiveInteger(segments[2], Number.MAX_SAFE_INTEGER);
      if (!id) throw new HttpError(400, 'Invalid request');
      return deleteUser(req, res, id);
    }
    if (resource === 'campaigns' && segments.length === 2) {
      const id = readPositiveInteger(segments[1], Number.MAX_SAFE_INTEGER);
      if (!id) throw new HttpError(400, 'Invalid request');
      return deleteCampaign(req, res, id);
    }
    throw new HttpError(404, 'Not found');
  }

  throw new HttpError(405, 'Method not allowed');
}
