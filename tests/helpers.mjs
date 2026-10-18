import { createHmac, randomBytes } from 'node:crypto';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export function signInitData(user, { authDate = Math.floor(Date.now() / 1000), botToken = BOT_TOKEN, startParam } = {}) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAETEST', user: JSON.stringify(user) });
  if (startParam) params.set('start_param', startParam);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

export const nonce = () => randomBytes(16).toString('hex');

export function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  };
}

// يستدعي معالج Vercel الحقيقي (api/index.js) بكامل طبقات الحماية: nonce وrate limit وجلسات الأجهزة.
export async function call({ method = 'GET', path, user, body, ip = '203.0.113.10', headers = {}, initData, withNonce = true }) {
  const { default: handler } = await import('../api/index.js');
  const requestHeaders = {
    'x-vercel-forwarded-for': ip,
    ...headers,
  };
  if (user) requestHeaders['x-telegram-init-data'] = initData ?? signInitData(user);
  else if (initData) requestHeaders['x-telegram-init-data'] = initData;
  if (method !== 'GET' && withNonce && !requestHeaders['x-request-nonce']) requestHeaders['x-request-nonce'] = nonce();
  const req = { method, url: `/api/${path}`, headers: requestHeaders, body };
  const res = makeRes();
  await handler(req, res);
  return res;
}

export const makeUser = (id, extra = {}) => ({ id, first_name: `User${id}`, username: `user${id}`, language_code: 'en', ...extra });

export async function sqlRows(text, params = []) {
  const { sql } = await import('../server/db.js');
  return sql.query(text, params);
}

export async function ensureUser(user) {
  const res = await call({ path: 'balance', user });
  if (res.statusCode !== 200) throw new Error(`could not create test user: ${JSON.stringify(res.body)}`);
}

export async function setBalances(userId, { advertiser, earned }) {
  await sqlRows(
    `UPDATE vr_users SET advertiser_balance = COALESCE($2::numeric, advertiser_balance),
                         earned_balance = COALESCE($3::numeric, earned_balance) WHERE id = $1`,
    [userId, advertiser ?? null, earned ?? null],
  );
}

export async function balanceOf(userId) {
  const rows = await sqlRows(
    `SELECT advertiser_balance::float8 AS advertiser, earned_balance::float8 AS earned FROM vr_users WHERE id = $1`,
    [userId],
  );
  return rows[0];
}

// اعتراض كل طلبات fetch الخارجية. الافتراضي: Telegram يردّ بنجاح، وأي مضيف آخر يفشل صراحةً.
export function installFetchStub(handlers = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof URL ? input.href : input?.url ?? input);
    calls.push(url);
    if (handlers.custom) {
      const custom = await handlers.custom(url, init);
      if (custom) return custom;
    }
    if (url.startsWith('https://api.telegram.org/')) {
      const method = url.split('/').pop();
      const payload = init?.body ? JSON.parse(init.body) : {};
      let result = true;
      if (method === 'getMe') result = { id: 777, username: 'test_bot' };
      if (method === 'getChatMember') result = { status: payload.user_id === 777 ? 'administrator' : (handlers.memberStatus ?? 'member') };
      return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected external request in test: ${url}`);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
