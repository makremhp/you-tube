import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { isAdmin, requireUser } from './auth.js';
import {
  AD_MIN_INTERVAL_SECONDS,
  DEFAULT_WITHDRAWAL_SETTINGS, normalizeWithdrawalSettings,
} from './config.js';
import { getAdSettings, providerAdConfig } from './settings.js';
import { newIdentifier, readHttpUrl, readMoney, readPositiveInteger, readText } from './validation.js';
import { sendNotification } from '../api/telegram/bot-messages.js';

const MAX_PENDING_DEPOSITS = 20;

async function nextMemoTag(userId) {
  const rows = await sql.query(`SELECT nextval('vr_memo_seq')::text AS sequence`);
  return `${userId}#${rows[0].sequence}`;
}

// مدة التصفح المطلوبة بالثواني، ويُسمح بتسامح 10% لاختلاف توقيت النبضات.
const AD_BROWSE_SECONDS = Number(process.env.AD_BROWSE_SECONDS ?? 30);
const AD_BROWSE_TOLERANCE = 0.9;
// أقصى زمن يُحتسب لنبضة واحدة: النبضات المتأخرة (تبويب مخفي/إغلاق مؤقت) لا تُحتسب إلا بهذا السقف.
const AD_BEAT_MAX_MS = 3500;

function browseSessionRequired() {
  return String(process.env.AD_BROWSE_SESSION_REQUIRED ?? 'true').toLowerCase() !== 'false';
}

export async function startAdBrowse(req, res) {
  const user = await requireUser(req);
  const provider = readText(req.body?.provider ?? 'adstera', 20);
  if (provider !== 'adstera') throw new HttpError(400, 'Invalid request');
  const id = newIdentifier('BRW');
  // جلسة جديدة عند كل فتح للصفحة: إغلاق الصفحة وإعادة فتحها يصفّر التقدم، وتُحذف الجلسات القديمة غير المستلمة.
  await sql.query(
    `WITH cleanup AS (
       DELETE FROM vr_ad_browse_sessions WHERE user_id = $2 AND (claimed = FALSE OR created_at < now() - interval '1 day')
     )
     INSERT INTO vr_ad_browse_sessions (id, user_id, provider, required_ms) VALUES ($1, $2, $3, $4)`,
    [id, user.id, provider, AD_BROWSE_SECONDS * 1000],
  );
  ok(res, { id, requiredSeconds: AD_BROWSE_SECONDS }, 201);
}

export async function beatAdBrowse(req, res, sessionId) {
  const user = await requireUser(req);
  // يضيف الزمن الحقيقي المنقضي منذ آخر نبضة فقط (بسقف)، فلا يمكن تسريع العدّاد بإرسال نبضات كثيرة.
  const rows = await sql.query(
    `UPDATE vr_ad_browse_sessions SET
       active_ms = LEAST(required_ms, active_ms + LEAST($3::int, GREATEST(0, (extract(epoch FROM (now() - last_beat_at)) * 1000)::int))),
       last_beat_at = now()
     WHERE id = $1 AND user_id = $2 AND claimed = FALSE
     RETURNING active_ms::int AS "activeMs", required_ms::int AS "requiredMs"`,
    [sessionId, user.id, AD_BEAT_MAX_MS],
  );
  if (!rows.length) throw new HttpError(404, 'Browsing session not found');
  ok(res, { activeMs: rows[0].activeMs, requiredMs: rows[0].requiredMs });
}

export async function claimAdReward(req, res, provider = 'adstera') {
  const user = await requireUser(req);
  const rewardsTable = provider === 'monetag' ? 'vr_monetag_ad_rewards' : 'vr_ad_rewards';
  const { limit, reward } = providerAdConfig(await getAdSettings(), provider);
  const requireSession = provider === 'adstera' && browseSessionRequired();
  const sessionId = requireSession ? readText(req.body?.sessionId, 64) : null;
  if (requireSession && !sessionId) throw new HttpError(409, 'Browsing not completed');
  // عند اشتراط الجلسة: تُقفل وتُستهلك داخل نفس الاستعلام الذرّي مع المكافأة، فلا تُصرف جلسة مرتين.
  const rows = await sql.query(
    `WITH sess AS (
       SELECT id FROM vr_ad_browse_sessions
       WHERE $5::boolean = TRUE
         AND id = $6::text AND user_id = $1 AND claimed = FALSE AND active_ms >= required_ms * $7::float8
       FOR UPDATE
     ), bump AS (
       INSERT INTO ${rewardsTable} (user_id, day, count, last_at)
       SELECT $1, (now() AT TIME ZONE 'UTC')::date, 1, now() WHERE $5::boolean = FALSE OR EXISTS (SELECT 1 FROM sess)
       ON CONFLICT (user_id, day) DO UPDATE
         SET count = ${rewardsTable}.count + 1, last_at = now()
         WHERE ${rewardsTable}.count < $2
           AND ${rewardsTable}.last_at <= now() - make_interval(secs => $4::float8)
       RETURNING count
     ), mark AS (
       UPDATE vr_ad_browse_sessions SET claimed = TRUE
       WHERE $5::boolean = TRUE AND id = $6::text AND user_id = $1 AND EXISTS (SELECT 1 FROM bump)
     ), credit AS (
        UPDATE vr_users SET earned_balance = earned_balance + $3
       WHERE id = $1 AND EXISTS (SELECT 1 FROM bump)
       RETURNING id
     )
     SELECT count FROM bump`,
    [user.id, limit, reward, AD_MIN_INTERVAL_SECONDS, requireSession, sessionId, AD_BROWSE_TOLERANCE],
  );
  if (!rows.length) {
    if (requireSession) {
      const valid = await sql.query(
        `SELECT 1 FROM vr_ad_browse_sessions WHERE id = $1 AND user_id = $2 AND claimed = FALSE AND active_ms >= required_ms * $3::float8`,
        [sessionId, user.id, AD_BROWSE_TOLERANCE],
      );
      if (!valid.length) throw new HttpError(409, 'Browsing not completed');
    }
    throw new HttpError(429, 'Reward not available');
  }
  ok(res, { reward, claimedToday: Number(rows[0].count), provider });
}

export async function getAdProgress(req, res, provider = 'adstera') {
  const user = await requireUser(req);
  const rewardsTable = provider === 'monetag' ? 'vr_monetag_ad_rewards' : 'vr_ad_rewards';
  const rows = await sql.query(
    `SELECT count FROM ${rewardsTable} WHERE user_id = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
    [user.id],
  );
  const { limit, reward } = providerAdConfig(await getAdSettings(), provider);
  ok(res, {
    claimedToday: Number(rows[0]?.count ?? 0),
    dailyLimit: limit,
    reward,
  });
}

export async function getWithdrawalSettings() {
  const rows = await sql.query(`SELECT value::text AS settings FROM vr_platform_settings WHERE key = 'withdrawal'`);
  return normalizeWithdrawalSettings(rows[0]?.settings ?? DEFAULT_WITHDRAWAL_SETTINGS);
}

export async function listProofs(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT campaign_id::text AS "campaignId",
            user_id::float8 AS "userId",
            COALESCE(proof_image, '') AS image,
            CASE status WHEN 'approved' THEN 'معتمد' WHEN 'rejected' THEN 'مرفوض' ELSE 'قيد المراجعة' END AS status,
            started_at AS "submittedAt"
     FROM vr_completions
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

export async function listDeposits(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(`SELECT ${HISTORY_COLUMNS} FROM vr_deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [user.id]);
  ok(res, rows);
}

export async function listWithdrawals(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(`SELECT ${HISTORY_COLUMNS} FROM vr_withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [user.id]);
  ok(res, rows);
}

export async function getPublicWithdrawalSettings(_req, res) {
  ok(res, await getWithdrawalSettings());
}

export async function createDeposit(req, res) {
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
    // الوجهة يعرضها المشرف في لوحة الإدارة؛ لا نقبل إلا رابط فاتورة Telegram حتى لا تُستخدم لروابط خارجية خادعة.
    const invoiceHost = new URL(destination).hostname.toLowerCase();
    if (invoiceHost !== 't.me' && invoiceHost !== 'telegram.me') throw new HttpError(400, 'Invalid request');
  } else {
    destination = process.env.DEPOSIT_WALLET_ADDRESS;
    if (!destination) throw new HttpError(503, 'Service unavailable');
    memoTag = await nextMemoTag(user.id);
  }
  // سقف للطلبات المعلّقة يمنع إغراق لوحة الإدارة بإيداعات وهمية.
  const rows = await sql.query(
    `INSERT INTO vr_deposits (id, user_id, amount, method, destination, memo_tag)
     SELECT $1::text, $2::bigint, $3::numeric, $4::text, $5::text, $6::text
     WHERE (SELECT count(*) FROM vr_deposits WHERE user_id = $2::bigint AND status = 'قيد المعالجة') < $7::int
     RETURNING ${HISTORY_COLUMNS}`,
    [newIdentifier('DEP'), user.id, amount, method, destination, memoTag, MAX_PENDING_DEPOSITS],
  );
  if (!rows.length) throw new HttpError(429, 'Too many pending deposit requests');
  const deposit = rows[0];
  await sendNotification('deposit_requested', user.id, {
    amount: Number(deposit.amount).toFixed(2),
    currency: method === 'stars' ? 'Stars' : 'USDT',
    method: method === 'stars' ? 'Telegram Stars' : 'USDT (Web3)',
    requestId: deposit.id,
    status: deposit.status,
  }, { eventId: `${deposit.id}:requested` });
  ok(res, deposit, 201);
}

export async function createWithdrawal(req, res) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const method = body.method === 'binance' || body.method === 'web3' ? body.method : null;
  if (!method) throw new HttpError(400, 'Invalid withdrawal method');
  const settings = await getWithdrawalSettings();
  const minimum = settings[method === 'binance' ? 'binanceWithdrawMin' : 'web3WithdrawMin'];
  const amount = readMoney(body.amount, minimum, 100000);
  const destination = readText(body.destination, 200);
  if (!amount) throw new HttpError(400, `Minimum withdrawal is ${minimum} USDT`);
  if (!destination) throw new HttpError(400, 'Invalid request');
  const memoTag = await nextMemoTag(user.id);
  const rows = await sql.query(
    `WITH debit AS (
       UPDATE vr_users SET earned_balance = earned_balance - $3
       WHERE id = $2 AND earned_balance >= $3
       RETURNING id
     )
     INSERT INTO vr_withdrawals (id, user_id, amount, method, destination, memo_tag)
     SELECT $1, $2, $3, $4, $5, $6 FROM debit
     RETURNING ${HISTORY_COLUMNS}`,
    [newIdentifier('WDR'), user.id, amount, method, destination, memoTag],
  );
  if (!rows.length) throw new HttpError(402, 'Insufficient balance');
  const withdrawal = rows[0];
  await sendNotification('withdrawal_requested', user.id, {
    amount: Number(withdrawal.amount).toFixed(2),
    currency: 'USDT',
    method: method === 'binance' ? 'Binance' : 'Web3',
    address: destination,
    requestId: withdrawal.id,
    status: withdrawal.status,
  }, { eventId: `${withdrawal.id}:requested` });
  ok(res, withdrawal, 201);
}

export async function getUser(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT id::float8 AS id, first_name AS "firstName", last_name AS "lastName", username, photo_url AS "photoUrl",
            status, created_at AS "createdAt"
     FROM vr_users WHERE id = $1`,
    [user.id],
  );
  ok(res, rows[0] ? { ...rows[0], isAdmin: isAdmin(user.id) } : null);
}

export async function getBalance(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT advertiser_balance::float8 AS "advertiserBalance", earned_balance::float8 AS "viewerBalance"
     FROM vr_users WHERE id = $1`,
    [user.id],
  );
  ok(res, rows[0] ?? { advertiserBalance: 0, viewerBalance: 0 });
}
