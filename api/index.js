import { createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

/*
 * VidReward backend — single entry point.
 *
 * Environment variables (server only, never exposed to the frontend):
 *   DATABASE_URL            Neon PostgreSQL connection string
 *   TELEGRAM_BOT_TOKEN      Bot token, used to verify Telegram initData and channel membership
 *   ADMIN_TELEGRAM_IDS      Comma separated Telegram IDs allowed to use /api/admin/*
 *   DEPOSIT_WALLET_ADDRESS  Wallet address shown for Web3 (USDT) deposits
 *
 * Every response is { success: true, data } or { success: false, error }.
 * When DATABASE_URL is missing or a table is empty, GET endpoints return empty data.
 */

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const TELEGRAM_TASK_REWARD = Number(process.env.TELEGRAM_TASK_REWARD ?? 0.003);
const TIKTOK_TASK_REWARD = Number(process.env.TIKTOK_TASK_REWARD ?? 0.01);
const VIEW_REWARD_SHARE = 0.2;
const AD_REWARD = Number(process.env.AD_REWARD ?? 0.0005);
const AD_DAILY_LIMIT = Number(process.env.AD_DAILY_LIMIT ?? 100);
const AD_MIN_INTERVAL_SECONDS = Number(process.env.AD_MIN_INTERVAL_SECONDS ?? 10);
const MIN_WATCH_TOLERANCE = 0.95;

function loadYoutubePricing() {
  try {
    const parsed = JSON.parse(process.env.YOUTUBE_PRICING ?? 'null');
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    return { 10: 1.5, 20: 2, 40: 2.8, 80: 3.2 };
  }
  return { 10: 1.5, 20: 2, 40: 2.8, 80: 3.2 };
}

const YOUTUBE_PRICING = loadYoutubePricing();

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

let schemaReady = null;

function ensureSchema() {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id BIGINT PRIMARY KEY,
          first_name TEXT NOT NULL DEFAULT '',
          last_name TEXT,
          username TEXT,
          photo_url TEXT,
          advertiser_balance NUMERIC(18,6) NOT NULL DEFAULT 0,
          earned_balance NUMERIC(18,6) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'نشط',
          banned_by_system BOOLEAN NOT NULL DEFAULT FALSE,
          invited_by BIGINT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS campaigns (
          id BIGSERIAL PRIMARY KEY,
          owner_id BIGINT NOT NULL REFERENCES users(id),
          platform TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          creator TEXT,
          link TEXT NOT NULL DEFAULT '',
          thumbnail TEXT,
          duration INTEGER,
          cpm NUMERIC(12,4),
          reward NUMERIC(18,6),
          price NUMERIC(18,6),
          target_count INTEGER,
          country TEXT,
          device TEXT,
          status TEXT NOT NULL DEFAULT 'نشط',
          views BIGINT NOT NULL DEFAULT 0,
          joined_count INTEGER NOT NULL DEFAULT 0,
          completed_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS completions (
          campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          user_id BIGINT NOT NULL REFERENCES users(id),
          status TEXT NOT NULL,
          proof_image TEXT,
          reward NUMERIC(18,6),
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ,
          PRIMARY KEY (campaign_id, user_id)
        )`,
        `CREATE SEQUENCE IF NOT EXISTS memo_seq START 1`,
        `CREATE TABLE IF NOT EXISTS deposits (
          id TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id),
          amount NUMERIC(18,6) NOT NULL,
          method TEXT NOT NULL,
          destination TEXT NOT NULL,
          memo_tag TEXT NOT NULL,
          blockchain_tx_id TEXT,
          credited BOOLEAN NOT NULL DEFAULT FALSE,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'قيد المعالجة',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS withdrawals (
          id TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id),
          amount NUMERIC(18,6) NOT NULL,
          method TEXT NOT NULL,
          destination TEXT NOT NULL,
          memo_tag TEXT NOT NULL,
          blockchain_tx_id TEXT,
          status TEXT NOT NULL DEFAULT 'قيد المعالجة',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS ad_rewards (
          user_id BIGINT NOT NULL REFERENCES users(id),
          day DATE NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, day)
        )`,
        `CREATE TABLE IF NOT EXISTS suspicious_signals (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id),
          attempt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'مفتوح',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE INDEX IF NOT EXISTS campaigns_owner_idx ON campaigns (owner_id)`,
        `CREATE INDEX IF NOT EXISTS campaigns_platform_status_idx ON campaigns (platform, status)`,
        `CREATE INDEX IF NOT EXISTS deposits_user_idx ON deposits (user_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON withdrawals (user_id, created_at DESC)`,
      ];
      for (const statement of statements) {
        await sql.query(statement);
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}

function fail(res, status, error) {
  res.status(status).json({ success: false, error });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function verifiedTelegramUser(initData, botToken) {
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

function authenticate(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  const header = req.headers['x-telegram-init-data'];
  return verifiedTelegramUser(Array.isArray(header) ? header[0] : header, botToken);
}

async function requireUser(req) {
  const telegramUser = authenticate(req);
  if (!telegramUser) throw new HttpError(401, 'Unauthorized');
  const rows = await sql.query(
    `INSERT INTO users (id, first_name, last_name, username, photo_url)
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
  if (user.status === 'محظور') throw new HttpError(403, 'Forbidden');
  return { ...telegramUser, id: Number(user.id) };
}

function isAdmin(userId) {
  const ids = (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.includes(String(userId));
}

async function requireAdmin(req) {
  const user = await requireUser(req);
  if (!isAdmin(user.id)) throw new HttpError(403, 'Forbidden');
  return user;
}

async function telegramCall(method, payload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new HttpError(503, 'Service unavailable');
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) return null;
  return data.result;
}

function publicChannelHandle(value) {
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

async function botIsChannelAdmin(link) {
  const handle = publicChannelHandle(link);
  if (!handle) return false;
  const me = await telegramCall('getMe', {});
  if (!me) return false;
  const member = await telegramCall('getChatMember', { chat_id: handle, user_id: me.id });
  return Boolean(member && (member.status === 'administrator' || member.status === 'creator'));
}

async function userIsChannelMember(link, userId) {
  const handle = publicChannelHandle(link);
  if (!handle) return false;
  const member = await telegramCall('getChatMember', { chat_id: handle, user_id: userId });
  if (!member) return false;
  return ['member', 'administrator', 'creator'].includes(member.status) || (member.status === 'restricted' && member.is_member === true);
}

const CAMPAIGN_COLUMNS = `
  c.id::text AS id,
  c.platform,
  c.title,
  c.description,
  c.creator,
  c.link,
  c.link AS "youtubeUrl",
  c.thumbnail,
  c.duration,
  c.cpm::float8 AS cpm,
  c.reward::float8 AS reward,
  c.price::float8 AS price,
  c.target_count AS "targetCount",
  c.country,
  c.device,
  c.status,
  c.views::float8 AS views,
  c.joined_count AS "joinedCount",
  c.completed_count AS "completedCount",
  c.owner_id::float8 AS "ownerId",
  c.created_at AS "createdAt"`;

function viewerReward(cpm) {
  return Number(((Number(cpm) / 1000) * VIEW_REWARD_SHARE).toFixed(6));
}

function readPositiveInteger(value, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > max) return null;
  return number;
}

function readMoney(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Number(number.toFixed(6));
}

function readText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function readHttpUrl(value, max = 500) {
  const text = readText(value, max);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function newIdentifier(prefix) {
  const random = Math.random().toString(36).slice(2, 12).toUpperCase().padEnd(10, '0');
  return `${prefix}-${Date.now().toString(36).slice(-6).toUpperCase()}-${random}`;
}

async function nextMemoTag(userId) {
  const rows = await sql.query(`SELECT nextval('memo_seq')::text AS sequence`);
  return `${userId}#${rows[0].sequence}`;
}

const PLATFORMS = ['youtube', 'telegram', 'tiktok'];
const CAMPAIGN_STATUSES = ['نشط', 'مسودة', 'مكتمل', 'موقوف', 'بانتظار تحقق البوت'];

async function listTasks(req, res, query) {
  const user = await requireUser(req);
  const platform = PLATFORMS.includes(query.get('platform') ?? '') ? query.get('platform') : null;
  const rows = await sql.query(
    `SELECT ${CAMPAIGN_COLUMNS},
            comp.status AS "userStatus",
            (comp.status = 'completed') AS completed
     FROM campaigns c
     LEFT JOIN completions comp ON comp.campaign_id = c.id AND comp.user_id = $1
     WHERE c.status = 'نشط' AND ($2::text IS NULL OR c.platform = $2)
     ORDER BY c.created_at DESC
     LIMIT 200`,
    [user.id, platform],
  );
  ok(res, rows);
}

async function listCampaigns(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT ${CAMPAIGN_COLUMNS}
     FROM campaigns c
     WHERE c.owner_id = $1
     ORDER BY c.created_at DESC
     LIMIT 200`,
    [user.id],
  );
  ok(res, rows);
}

async function createCampaign(req, res) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const platform = PLATFORMS.includes(body.platform) ? body.platform : null;
  const title = readText(body.title, 160);
  const link = platform === 'youtube' && body.link === '' ? '' : readHttpUrl(body.link);
  if (!platform || !title || link === null) throw new HttpError(400, 'Invalid request');

  if (platform === 'youtube') {
    const duration = readPositiveInteger(body.duration, 600);
    const cpm = readMoney(body.cpm, 0.01, 1000);
    if (!duration || !cpm || Number(YOUTUBE_PRICING[duration]) !== cpm) throw new HttpError(400, 'Invalid request');
    const status = body.status === 'مسودة' ? 'مسودة' : 'نشط';
    const creator = readText(body.creator, 120) ?? ([user.first_name, user.last_name].filter(Boolean).join(' ') || null);
    const rows = await sql.query(
      `INSERT INTO campaigns (owner_id, platform, title, description, creator, link, thumbnail, duration, cpm, reward, country, device, status)
       VALUES ($1, 'youtube', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id::text AS id`,
      [
        user.id, title, readText(body.description, 2000), creator, link, readHttpUrl(body.thumbnail),
        duration, cpm, viewerReward(cpm), readText(body.country, 80), readText(body.device, 40), status,
      ],
    );
    ok(res, { id: rows[0].id }, 201);
    return;
  }

  const targetCount = readPositiveInteger(body.targetCount, 1000000);
  const price = readMoney(body.price, 0.01, 1000000);
  const taskReward = platform === 'telegram' ? TELEGRAM_TASK_REWARD : TIKTOK_TASK_REWARD;
  if (!targetCount || !price || price / targetCount < taskReward) throw new HttpError(400, 'Invalid request');
  let status = 'نشط';
  if (platform === 'telegram') {
    status = (await botIsChannelAdmin(link)) ? 'نشط' : 'بانتظار تحقق البوت';
  }
  const rows = await sql.query(
    `INSERT INTO campaigns (owner_id, platform, title, description, link, thumbnail, target_count, price, reward, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id::text AS id, status`,
    [
      user.id, platform, title, readText(body.description, 2000), link,
      typeof body.image === 'string' && body.image.length <= 600000 ? body.image : null,
      targetCount, price, platform === 'telegram' ? TELEGRAM_TASK_REWARD : TIKTOK_TASK_REWARD, status,
    ],
  );
  ok(res, { id: rows[0].id, status: rows[0].status }, 201);
}

async function updateCampaign(req, res, id) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const status = CAMPAIGN_STATUSES.includes(body.status) ? body.status : null;
  const title = body.title === undefined ? null : readText(body.title, 160);
  const link = body.link === undefined ? null : readHttpUrl(body.link);
  if (body.title !== undefined && !title) throw new HttpError(400, 'Invalid request');
  if (body.link !== undefined && !link) throw new HttpError(400, 'Invalid request');
  if (body.status !== undefined && !status) throw new HttpError(400, 'Invalid request');

  let nextStatus = status;
  if (status === 'نشط') {
    const current = await sql.query(`SELECT platform, link FROM campaigns WHERE id = $1 AND owner_id = $2`, [id, user.id]);
    if (current[0]?.platform === 'telegram' && !(await botIsChannelAdmin(link ?? current[0].link))) {
      nextStatus = 'بانتظار تحقق البوت';
    }
  }
  const rows = await sql.query(
    `UPDATE campaigns SET
       title = COALESCE($3, title),
       link = COALESCE($4, link),
       status = COALESCE($5, status)
     WHERE id = $1 AND owner_id = $2
     RETURNING id::text AS id, status`,
    [id, user.id, title, link, nextStatus],
  );
  if (!rows.length) throw new HttpError(404, 'Not found');
  ok(res, rows[0]);
}

async function deleteCampaign(req, res, id) {
  const user = await requireUser(req);
  const rows = await sql.query(`DELETE FROM campaigns WHERE id = $1 AND owner_id = $2 RETURNING id::text AS id`, [id, user.id]);
  if (!rows.length) throw new HttpError(404, 'Not found');
  ok(res, { id: rows[0].id });
}

async function startTask(req, res, id) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `WITH target AS (
       SELECT id FROM campaigns WHERE id = $1 AND status = 'نشط'
     ), started AS (
       INSERT INTO completions (campaign_id, user_id, status)
       SELECT id, $2, 'started' FROM target
       ON CONFLICT (campaign_id, user_id) DO NOTHING
       RETURNING status
     ), joined AS (
       UPDATE campaigns SET joined_count = joined_count + 1
       WHERE id = $1 AND EXISTS (SELECT 1 FROM started)
       RETURNING id
     )
     SELECT COALESCE(
       (SELECT status FROM started),
       (SELECT status FROM completions WHERE campaign_id = $1 AND user_id = $2)
     ) AS status`,
    [id, user.id],
  );
  if (!rows[0] || !rows[0].status) throw new HttpError(404, 'Not found');
  ok(res, { status: rows[0].status });
}

async function completeTask(req, res, id) {
  const user = await requireUser(req);
  const campaigns = await sql.query(
    `SELECT platform, link, duration, cpm::float8 AS cpm, reward::float8 AS reward FROM campaigns WHERE id = $1 AND status = 'نشط'`,
    [id],
  );
  const campaign = campaigns[0];
  if (!campaign) throw new HttpError(404, 'Not found');

  if (campaign.platform === 'youtube') {
    const requiredSeconds = Number(campaign.duration) * MIN_WATCH_TOLERANCE;
    const reward = campaign.reward ?? viewerReward(campaign.cpm);
    const rows = await sql.query(
      `WITH done AS (
         UPDATE completions SET status = 'completed', completed_at = now(), reward = $3
         WHERE campaign_id = $1 AND user_id = $2 AND status = 'started'
           AND started_at <= now() - make_interval(secs => $4::float8)
         RETURNING reward
       ), credit AS (
         UPDATE users SET earned_balance = earned_balance + $3
         WHERE id = $2 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       ), bump AS (
         UPDATE campaigns SET completed_count = completed_count + 1, views = views + 1
         WHERE id = $1 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       )
       SELECT reward::float8 AS reward FROM done`,
      [id, user.id, reward, requiredSeconds],
    );
    if (!rows.length) throw new HttpError(409, 'Task not completed');
    ok(res, { reward: rows[0].reward });
    return;
  }

  if (campaign.platform === 'telegram') {
    if (!(await userIsChannelMember(campaign.link, user.id))) throw new HttpError(409, 'Membership not verified');
    const rows = await sql.query(
      `WITH done AS (
         INSERT INTO completions (campaign_id, user_id, status, reward, completed_at)
         VALUES ($1, $2, 'completed', $3, now())
         ON CONFLICT (campaign_id, user_id) DO NOTHING
         RETURNING reward
       ), credit AS (
         UPDATE users SET earned_balance = earned_balance + $3
         WHERE id = $2 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       ), bump AS (
         UPDATE campaigns SET joined_count = joined_count + 1, completed_count = completed_count + 1
         WHERE id = $1 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       )
       SELECT reward::float8 AS reward FROM done`,
      [id, user.id, campaign.reward ?? TELEGRAM_TASK_REWARD],
    );
    if (!rows.length) throw new HttpError(409, 'Task already completed');
    ok(res, { reward: rows[0].reward });
    return;
  }

  throw new HttpError(400, 'Invalid request');
}

async function submitProof(req, res, id) {
  const user = await requireUser(req);
  const image = typeof req.body?.image === 'string' && req.body.image.startsWith('data:image/') && req.body.image.length <= 3000000
    ? req.body.image
    : null;
  if (!image) throw new HttpError(400, 'Invalid request');
  const rows = await sql.query(
    `WITH target AS (
       SELECT id, reward FROM campaigns WHERE id = $1 AND status = 'نشط' AND platform = 'tiktok'
     ), proof AS (
       INSERT INTO completions (campaign_id, user_id, status, proof_image, reward)
       SELECT id, $2, 'pending', $3, reward FROM target
       ON CONFLICT (campaign_id, user_id) DO NOTHING
       RETURNING status
     ), bump AS (
       UPDATE campaigns SET joined_count = joined_count + 1
       WHERE id = $1 AND EXISTS (SELECT 1 FROM proof)
       RETURNING id
     )
     SELECT status FROM proof`,
    [id, user.id, image],
  );
  if (!rows.length) throw new HttpError(409, 'Proof already submitted');
  ok(res, { status: 'قيد المراجعة' }, 201);
}

async function claimAdReward(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `WITH bump AS (
       INSERT INTO ad_rewards (user_id, day, count, last_at)
       VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1, now())
       ON CONFLICT (user_id, day) DO UPDATE
         SET count = ad_rewards.count + 1, last_at = now()
         WHERE ad_rewards.count < $2
           AND ad_rewards.last_at <= now() - make_interval(secs => $4::float8)
       RETURNING count
     ), credit AS (
       UPDATE users SET earned_balance = earned_balance + $3
       WHERE id = $1 AND EXISTS (SELECT 1 FROM bump)
       RETURNING id
     )
     SELECT count FROM bump`,
    [user.id, AD_DAILY_LIMIT, AD_REWARD, AD_MIN_INTERVAL_SECONDS],
  );
  if (!rows.length) throw new HttpError(429, 'Reward not available');
  ok(res, { reward: AD_REWARD, claimedToday: Number(rows[0].count) });
}

async function listProofs(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT campaign_id::text AS "campaignId",
            user_id::float8 AS "userId",
            COALESCE(proof_image, '') AS image,
            CASE status WHEN 'approved' THEN 'معتمد' WHEN 'rejected' THEN 'مرفوض' ELSE 'قيد المراجعة' END AS status,
            started_at AS "submittedAt"
     FROM completions
     WHERE user_id = $1 AND proof_image IS NOT NULL
     ORDER BY started_at DESC
     LIMIT 200`,
    [user.id],
  );
  ok(res, rows);
}

const HISTORY_COLUMNS = `
  id,
  amount::float8 AS amount,
  method,
  destination,
  memo_tag AS "memoTag",
  blockchain_tx_id AS "blockchainTxId",
  status,
  created_at AS "createdAt"`;

async function listDeposits(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(`SELECT ${HISTORY_COLUMNS} FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [user.id]);
  ok(res, rows);
}

async function listWithdrawals(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(`SELECT ${HISTORY_COLUMNS} FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [user.id]);
  ok(res, rows);
}

async function createDeposit(req, res) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const method = body.method === 'stars' || body.method === 'web3' ? body.method : null;
  const amount = readMoney(body.amount, 1, 10000);
  if (!method || !amount) throw new HttpError(400, 'Invalid request');

  let destination;
  let memoTag;
  if (method === 'stars') {
    destination = readHttpUrl(body.destination);
    memoTag = readText(body.memoTag, 200);
    if (!destination || !memoTag) throw new HttpError(400, 'Invalid request');
  } else {
    destination = process.env.DEPOSIT_WALLET_ADDRESS;
    if (!destination) throw new HttpError(503, 'Service unavailable');
    memoTag = await nextMemoTag(user.id);
  }
  const rows = await sql.query(
    `INSERT INTO deposits (id, user_id, amount, method, destination, memo_tag)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${HISTORY_COLUMNS}`,
    [newIdentifier('DEP'), user.id, amount, method, destination, memoTag],
  );
  ok(res, rows[0], 201);
}

async function createWithdrawal(req, res) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const method = body.method === 'binance' || body.method === 'web3' ? body.method : null;
  const amount = readMoney(body.amount, 1, 100000);
  const destination = readText(body.destination, 200);
  if (!method || !amount || !destination) throw new HttpError(400, 'Invalid request');
  const memoTag = await nextMemoTag(user.id);
  const rows = await sql.query(
    `WITH debit AS (
       UPDATE users SET earned_balance = earned_balance - $3
       WHERE id = $2 AND earned_balance >= $3
       RETURNING id
     )
     INSERT INTO withdrawals (id, user_id, amount, method, destination, memo_tag)
     SELECT $1, $2, $3, $4, $5, $6 FROM debit
     RETURNING ${HISTORY_COLUMNS}`,
    [newIdentifier('WDR'), user.id, amount, method, destination, memoTag],
  );
  if (!rows.length) throw new HttpError(402, 'Insufficient balance');
  ok(res, rows[0], 201);
}

async function getUser(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT id::float8 AS id, first_name AS "firstName", last_name AS "lastName", username, photo_url AS "photoUrl",
            status, created_at AS "createdAt"
     FROM users WHERE id = $1`,
    [user.id],
  );
  ok(res, rows[0] ?? null);
}

async function getBalance(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT advertiser_balance::float8 AS "advertiserBalance", earned_balance::float8 AS "viewerBalance" FROM users WHERE id = $1`,
    [user.id],
  );
  ok(res, rows[0] ?? { advertiserBalance: 0, viewerBalance: 0 });
}

async function adminState(req, res) {
  await requireAdmin(req);
  const [users, deposits, withdrawals, campaigns, proofs, suspicious] = await Promise.all([
    sql.query(
      `SELECT id::float8 AS id,
              TRIM(CONCAT(first_name, ' ', COALESCE(last_name, ''))) AS name,
              COALESCE(username, '') AS username,
              advertiser_balance::float8 AS "advertiserBalance",
              earned_balance::float8 AS "earnedBalance",
              status,
              banned_by_system AS "bannedBySystem",
              to_char(created_at, 'YYYY-MM-DD') AS "joinedAt",
              to_char(last_active_at, 'YYYY-MM-DD HH24:MI') AS "lastLogin",
              to_char(last_active_at, 'YYYY-MM-DD HH24:MI') AS "lastActive",
              COALESCE(invited_by::text, '—') AS "invitedBy"
       FROM users ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT id, user_id::float8 AS "userId", amount::float8 AS amount,
              CASE method WHEN 'stars' THEN 'Stars' ELSE 'USDT' END AS method,
              memo_tag AS "memoTag", blockchain_tx_id AS "txId", destination AS wallet, credited, reason,
              CASE status WHEN 'تم' THEN 'ناجح' WHEN 'قيد المعالجة' THEN 'قيد المعالجة' ELSE 'فاشل' END AS status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM deposits ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT id, user_id::float8 AS "userId", amount::float8 AS amount,
              CASE method WHEN 'binance' THEN 'Binance' ELSE 'Web3' END AS method,
              destination,
              CASE status WHEN 'تم' THEN 'معتمد' WHEN 'مرفوض' THEN 'مرفوض' ELSE 'قيد المراجعة' END AS status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM withdrawals ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT 'CMP-' || id::text AS id, id::text AS "campaignId", owner_id::float8 AS "userId", title,
              CASE platform WHEN 'youtube' THEN 'YouTube' WHEN 'tiktok' THEN 'TikTok' ELSE 'Telegram' END AS platform,
              link AS "videoUrl", duration, price::float8 AS budget, price::float8 AS price,
              target_count AS "targetCount", completed_count AS "completedCount", views::float8 AS views,
              CASE status WHEN 'نشط' THEN 'نشطة' WHEN 'موقوف' THEN 'موقوفة' WHEN 'مسودة' THEN 'بانتظار المراجعة' ELSE status END AS status
       FROM campaigns ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT 'PRF-' || comp.campaign_id::text || '-' || comp.user_id::text AS id,
              comp.campaign_id::text AS "campaignId", comp.user_id::float8 AS "userId",
              'TASK-' || comp.campaign_id::text AS "taskId",
              CASE c.platform WHEN 'tiktok' THEN 'متابعة TikTok' ELSE 'اشتراك قناة' END AS "taskType",
              COALESCE(comp.proof_image, '') AS image, comp.reward::float8 AS reward,
              CASE comp.status WHEN 'approved' THEN 'معتمد' WHEN 'rejected' THEN 'مرفوض' ELSE 'قيد المراجعة' END AS status
       FROM completions comp JOIN campaigns c ON c.id = comp.campaign_id
       WHERE comp.proof_image IS NOT NULL
       ORDER BY comp.started_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT 'SIG-' || id::text AS id, user_id::float8 AS "userId", attempt, status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM suspicious_signals ORDER BY created_at DESC LIMIT 1000`,
    ),
  ]);
  ok(res, { users, deposits, withdrawals, campaigns, proofs, suspicious });
}

async function adminAction(req, res, collection, id) {
  await requireAdmin(req);
  const body = req.body ?? {};
  const status = readText(body.status, 40);

  if (collection === 'users') {
    const userId = readPositiveInteger(id, Number.MAX_SAFE_INTEGER);
    if (!userId || !['نشط', 'محظور'].includes(status)) throw new HttpError(400, 'Invalid request');
    const rows = await sql.query(
      `UPDATE users SET status = $2 WHERE id = $1 RETURNING id::float8 AS id`,
      [userId, status],
    );
    if (!rows.length) throw new HttpError(404, 'Not found');
    ok(res, { id: rows[0].id });
    return;
  }

  if (collection === 'withdrawals') {
    if (!['معتمد', 'مرفوض'].includes(status)) throw new HttpError(400, 'Invalid request');
    const stored = status === 'معتمد' ? 'تم' : 'مرفوض';
    const rows = await sql.query(
      `WITH updated AS (
         UPDATE withdrawals SET status = $2,
           blockchain_tx_id = COALESCE($3, blockchain_tx_id)
         WHERE id = $1 AND status = 'قيد المعالجة'
         RETURNING user_id, amount
       ), refund AS (
         UPDATE users SET earned_balance = earned_balance + (SELECT amount FROM updated)
         WHERE $2 = 'مرفوض' AND id = (SELECT user_id FROM updated)
         RETURNING id
       )
       SELECT user_id::float8 AS "userId" FROM updated`,
      [id, stored, readText(body.txId, 200)],
    );
    if (!rows.length) throw new HttpError(409, 'Request already processed');
    ok(res, { id });
    return;
  }

  if (collection === 'deposits') {
    if (!['ناجح', 'فاشل'].includes(status)) throw new HttpError(400, 'Invalid request');
    if (status === 'ناجح') {
      const rows = await sql.query(
        `WITH updated AS (
           UPDATE deposits SET status = 'تم', credited = TRUE, blockchain_tx_id = COALESCE($2, blockchain_tx_id)
           WHERE id = $1 AND credited = FALSE
           RETURNING user_id, amount
         ), credit AS (
           UPDATE users SET advertiser_balance = advertiser_balance + (SELECT amount FROM updated)
           WHERE id = (SELECT user_id FROM updated)
           RETURNING id
         )
         SELECT user_id::float8 AS "userId" FROM updated`,
        [id, readText(body.txId, 200)],
      );
      if (!rows.length) throw new HttpError(409, 'Deposit already processed');
    } else {
      const rows = await sql.query(
        `WITH updated AS (
           UPDATE deposits SET status = 'تم الإلغاء', reason = COALESCE($2, reason), credited = FALSE
           WHERE id = $1
           RETURNING user_id, amount, (SELECT credited FROM deposits WHERE id = $1) AS was_credited
         ), reverse AS (
           UPDATE users SET advertiser_balance = GREATEST(0, advertiser_balance - (SELECT amount FROM updated))
           WHERE id = (SELECT user_id FROM updated) AND (SELECT was_credited FROM updated)
           RETURNING id
         )
         SELECT user_id::float8 AS "userId" FROM updated`,
        [id, readText(body.reason, 300)],
      );
      if (!rows.length) throw new HttpError(404, 'Not found');
    }
    ok(res, { id });
    return;
  }

  if (collection === 'proofs') {
    if (!['معتمد', 'مرفوض'].includes(status)) throw new HttpError(400, 'Invalid request');
    const match = /^PRF-(\d+)-(\d+)$/.exec(id);
    if (!match) throw new HttpError(400, 'Invalid request');
    const next = status === 'معتمد' ? 'approved' : 'rejected';
    const rows = await sql.query(
      `WITH updated AS (
         UPDATE completions SET status = $3, completed_at = now()
         WHERE campaign_id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING reward, user_id
       ), credit AS (
         UPDATE users SET earned_balance = earned_balance + (SELECT reward FROM updated)
         WHERE $3 = 'approved' AND id = (SELECT user_id FROM updated)
         RETURNING id
       ), bump AS (
         UPDATE campaigns SET completed_count = completed_count + 1
         WHERE $3 = 'approved' AND id = $1 AND EXISTS (SELECT 1 FROM updated)
         RETURNING id
       )
       SELECT user_id::float8 AS "userId" FROM updated`,
      [match[1], match[2], next],
    );
    if (!rows.length) throw new HttpError(409, 'Proof already reviewed');
    ok(res, { id });
    return;
  }

  if (collection === 'campaigns') {
    const match = /^CMP-(\d+)$/.exec(id);
    const mapped = { 'نشطة': 'نشط', 'موقوفة': 'موقوف', 'مرفوضة': 'موقوف', 'أوقفتها الميزانية': 'موقوف' }[status];
    if (!match || !mapped) throw new HttpError(400, 'Invalid request');
    const rows = await sql.query(`UPDATE campaigns SET status = $2 WHERE id = $1 RETURNING id::text AS id`, [match[1], mapped]);
    if (!rows.length) throw new HttpError(404, 'Not found');
    ok(res, { id });
    return;
  }

  if (collection === 'suspicious') {
    const match = /^SIG-(\d+)$/.exec(id);
    if (!match || !['مفتوح', 'تمت المراجعة'].includes(status)) throw new HttpError(400, 'Invalid request');
    const rows = await sql.query(`UPDATE suspicious_signals SET status = $2 WHERE id = $1 RETURNING id`, [match[1], status]);
    if (!rows.length) throw new HttpError(404, 'Not found');
    ok(res, { id });
    return;
  }

  throw new HttpError(404, 'Not found');
}

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

async function dispatch(req, res) {
  const { segments, query } = routePath(req);
  const method = req.method ?? 'GET';
  const resource = segments[0];
  const key = segments.join('/');

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
