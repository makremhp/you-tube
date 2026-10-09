import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { isAdmin, requireUser } from './auth.js';
import { AD_DAILY_LIMIT, AD_MIN_INTERVAL_SECONDS, AD_REWARD } from './config.js';
import { newIdentifier, readHttpUrl, readMoney, readPositiveInteger, readText } from './validation.js';

async function nextMemoTag(userId) {
  const rows = await sql.query(`SELECT nextval('vr_memo_seq')::text AS sequence`);
  return `${userId}#${rows[0].sequence}`;
}

export async function claimAdReward(req, res, provider = 'adstera') {
  const user = await requireUser(req);
  const rewardsTable = provider === 'monetag' ? 'vr_monetag_ad_rewards' : 'vr_ad_rewards';
  const rows = await sql.query(
    `WITH bump AS (
       INSERT INTO ${rewardsTable} (user_id, day, count, last_at)
       VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1, now())
       ON CONFLICT (user_id, day) DO UPDATE
         SET count = ${rewardsTable}.count + 1, last_at = now()
         WHERE ${rewardsTable}.count < $2
           AND ${rewardsTable}.last_at <= now() - make_interval(secs => $4::float8)
       RETURNING count
     ), credit AS (
        UPDATE vr_users SET earned_balance = earned_balance + $3
       WHERE id = $1 AND EXISTS (SELECT 1 FROM bump)
       RETURNING id
     )
     SELECT count FROM bump`,
    [user.id, AD_DAILY_LIMIT, AD_REWARD, AD_MIN_INTERVAL_SECONDS],
  );
  if (!rows.length) throw new HttpError(429, 'Reward not available');
  ok(res, { reward: AD_REWARD, claimedToday: Number(rows[0].count), provider });
}

export async function getAdProgress(req, res, provider = 'adstera') {
  const user = await requireUser(req);
  const rewardsTable = provider === 'monetag' ? 'vr_monetag_ad_rewards' : 'vr_ad_rewards';
  const rows = await sql.query(
    `SELECT count FROM ${rewardsTable} WHERE user_id = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
    [user.id],
  );
  ok(res, { claimedToday: Number(rows[0]?.count ?? 0) });
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
  } else {
    destination = process.env.DEPOSIT_WALLET_ADDRESS;
    if (!destination) throw new HttpError(503, 'Service unavailable');
    memoTag = await nextMemoTag(user.id);
  }
  const rows = await sql.query(
    `INSERT INTO vr_deposits (id, user_id, amount, method, destination, memo_tag)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${HISTORY_COLUMNS}`,
    [newIdentifier('DEP'), user.id, amount, method, destination, memoTag],
  );
  ok(res, rows[0], 201);
}

export async function createWithdrawal(req, res) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const method = body.method === 'binance' || body.method === 'web3' ? body.method : null;
  const amount = readMoney(body.amount, 1, 100000);
  const destination = readText(body.destination, 200);
  if (!method || !amount || !destination) throw new HttpError(400, 'Invalid request');
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
  ok(res, rows[0], 201);
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
