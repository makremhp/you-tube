import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';
import { sql } from './db.js';

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifiedTelegramUser(initData, botToken) {
  if (typeof initData !== 'string' || !initData || initData.length > 10000) return null;
  const parameters = new URLSearchParams(initData);
  const suppliedHash = parameters.get('hash');
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) return null;

  const dataCheckString = [...parameters.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const actualHash = Buffer.from(suppliedHash, 'hex');
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) return null;

  const authDate = Number(parameters.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(parameters.get('user') ?? 'null');
    if (!user || !Number.isSafeInteger(user.id) || Number(user.id) <= 0) return null;
    return {
      id: Number(user.id),
      first_name: typeof user.first_name === 'string' ? user.first_name.slice(0, 80) : '',
      last_name: typeof user.last_name === 'string' ? user.last_name.slice(0, 80) : null,
      username: typeof user.username === 'string' ? user.username.slice(0, 64) : null,
      photo_url: typeof user.photo_url === 'string' && /^https?:\/\//i.test(user.photo_url) ? user.photo_url.slice(0, 500) : null,
    };
  } catch {
    return null;
  }
}

export function authenticate(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  const header = req.headers['x-telegram-init-data'];
  return verifiedTelegramUser(Array.isArray(header) ? header[0] : header, botToken);
}

export async function requireUser(req) {
  const telegramUser = authenticate(req);
  if (!telegramUser) throw new HttpError(401, 'Unauthorized');
  const rows = await sql.query(
    `INSERT INTO vr_users (id, first_name, last_name, username, photo_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       username = EXCLUDED.username,
       photo_url = EXCLUDED.photo_url,
       last_active_at = now()
     RETURNING id::float8 AS id, status`,
    [telegramUser.id, telegramUser.first_name, telegramUser.last_name, telegramUser.username, telegramUser.photo_url],
  );
  const user = rows[0];
  // الحظر مطبّق على الخادم لكل مسارات المستخدم؛ المدير يبقى قادرًا على الوصول لأدوات الإدارة.
  if (user.status === 'محظور' && !isAdmin(user.id)) throw new HttpError(403, 'Account banned');
  return { ...telegramUser, id: Number(user.id) };
}

export function isAdmin(userId) {
  const ids = (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.includes(String(userId));
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  if (!isAdmin(user.id)) throw new HttpError(403, 'Forbidden');
  return user;
}

/*
 * Low-level Telegram Bot API request. Never throws: always resolves to
 * { ok, result } or { ok:false, errorCode, description, retryAfter } so callers
 * can report the real failure reason. Pass { form } to send multipart data.
 */
export async function telegramRequest(method, payload, options = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, errorCode: 503, description: 'TELEGRAM_BOT_TOKEN is not configured on the server' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  try {
    const init = options.form
      ? { method: 'POST', body: options.form }
      : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { ...init, signal: controller.signal });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (response.ok && data?.ok) return { ok: true, result: data.result };
    return {
      ok: false,
      errorCode: Number(data?.error_code ?? response.status),
      description: String(data?.description ?? `HTTP ${response.status}`),
      retryAfter: Number(data?.parameters?.retry_after ?? 0) || 0,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: 0,
      description: error instanceof Error && error.name === 'AbortError' ? 'Telegram request timed out' : 'Network error while contacting Telegram',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function telegramCall(method, payload) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new HttpError(503, 'Service unavailable');
  const result = await telegramRequest(method, payload);
  return result.ok ? result.result : null;
}

export function publicChannelHandle(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host !== 't.me' && host !== 'telegram.me' && host !== 'www.t.me') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return null;
    const username = decodeURIComponent(segments[0]).replace(/^@/, '');
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) ? `@${username}` : null;
  } catch {
    return null;
  }
}

export async function botIsChannelAdmin(link) {
  const handle = publicChannelHandle(link);
  if (!handle) return false;
  const me = await telegramCall('getMe', {});
  if (!me) return false;
  const member = await telegramCall('getChatMember', { chat_id: handle, user_id: me.id });
  return Boolean(member && (member.status === 'administrator' || member.status === 'creator'));
}

export async function channelMembershipState(link, userId) {
  const handle = publicChannelHandle(link);
  if (!handle) return null;
  try {
    const member = await telegramCall('getChatMember', { chat_id: handle, user_id: userId });
    if (!member) return null;
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      return 'member';
    }
    if (member.status === 'left' || member.status === 'kicked' || (member.status === 'restricted' && member.is_member === false)) {
      return 'left';
    }
    if (member.status === 'restricted' && member.is_member === true) return 'member';
    return null;
  } catch {
    return null;
  }
}

export async function userIsChannelMember(link, userId) {
  return (await channelMembershipState(link, userId)) === 'member';
}
