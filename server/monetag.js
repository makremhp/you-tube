import { timingSafeEqual } from 'node:crypto';
import { sql } from './db.js';
import { HttpError, fail, ok } from './errors.js';
import { requireUser } from './auth.js';
import { getAdSettings } from './settings.js';
import { newIdentifier } from './validation.js';

const SESSION_ID_PATTERN = /^MNT-[A-Z0-9-]{8,40}$/;

function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || !actual || typeof expected !== 'string' || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function settlePair(sessionId, step, action, userId = null, requireActive = false) {
  if (!SESSION_ID_PATTERN.test(sessionId) || (step !== 1 && step !== 2)) return null;
  const column = action === 'valued'
    ? (step === 1 ? 'first_valued_at' : 'second_valued_at')
    : (step === 1 ? 'first_completed_at' : 'second_completed_at');
  const flags = ['first_valued_at', 'second_valued_at', 'first_completed_at', 'second_completed_at'];
  const pairComplete = flags.map((flag) => flag === column ? 'TRUE' : `${flag} IS NOT NULL`).join(' AND ');
  const { monetagReward, monetagDailyLimit } = await getAdSettings();

  const rows = await sql.query(
    `WITH changed AS (
       UPDATE vr_monetag_ad_sessions
       SET ${column} = COALESCE(${column}, now()),
           rewarded_at = CASE
             WHEN ${pairComplete} THEN COALESCE(rewarded_at, now())
             ELSE rewarded_at
           END
       WHERE id = $1
         AND ($2::bigint IS NULL OR user_id = $2)
         AND (NOT $5::boolean OR expires_at > now())
       RETURNING id, user_id, day, first_valued_at, second_valued_at,
                 first_completed_at, second_completed_at, rewarded_at
     ), eligible AS (
       SELECT id, user_id, day
       FROM changed
       WHERE first_valued_at IS NOT NULL
         AND second_valued_at IS NOT NULL
         AND first_completed_at IS NOT NULL
         AND second_completed_at IS NOT NULL
     ), claim AS (
       INSERT INTO vr_monetag_reward_claims (session_id, user_id, day)
       SELECT id, user_id, day FROM eligible
       ON CONFLICT (session_id) DO NOTHING
       RETURNING session_id, user_id, day
     ), bump AS (
       INSERT INTO vr_monetag_ad_rewards (user_id, day, count, last_at)
       SELECT user_id, day, 1, now() FROM claim
       ON CONFLICT (user_id, day) DO UPDATE
         SET count = vr_monetag_ad_rewards.count + 1, last_at = now()
         WHERE vr_monetag_ad_rewards.count < $4
       RETURNING user_id, day, count
     ), credited AS (
       UPDATE vr_users AS users
       SET earned_balance = users.earned_balance + $3
       FROM bump, claim
       WHERE users.id = bump.user_id
         AND users.id = claim.user_id
         AND bump.day = claim.day
       RETURNING users.id, claim.session_id, claim.day
     ), credit_ledger AS (
       INSERT INTO vr_monetag_reward_credits (session_id, user_id, day)
       SELECT session_id, user_id, day FROM credited
       ON CONFLICT (session_id) DO NOTHING
       RETURNING session_id
     )
     SELECT changed.id,
            changed.rewarded_at IS NOT NULL AS settled,
            (EXISTS (SELECT 1 FROM credit_ledger)
             OR EXISTS (SELECT 1 FROM vr_monetag_reward_credits WHERE session_id = changed.id)) AS rewarded,
            COALESCE(
              (SELECT count FROM bump WHERE bump.user_id = changed.user_id),
              (SELECT count FROM vr_monetag_ad_rewards WHERE user_id = changed.user_id AND day = changed.day),
              0
            ) AS claimed_today,
            (EXISTS (SELECT 1 FROM credit_ledger)
             OR EXISTS (SELECT 1 FROM vr_monetag_reward_credits WHERE session_id = changed.id)) AS credited
     FROM changed`,
    [sessionId, userId, monetagReward, monetagDailyLimit, requireActive],
  );
  return rows[0] ?? null;
}

async function readSession(sessionId, userId) {
  const rows = await sql.query(
    `SELECT id,
            first_completed_at IS NOT NULL AS "firstComplete",
            second_completed_at IS NOT NULL AS "secondComplete",
            rewarded_at IS NOT NULL AS settled,
            EXISTS (
              SELECT 1 FROM vr_monetag_reward_credits AS credit
              WHERE credit.session_id = vr_monetag_ad_sessions.id
            ) AS rewarded,
            expires_at > now() AS active
     FROM vr_monetag_ad_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  if (!rows.length) return null;
  const progress = await sql.query(
    `SELECT count FROM vr_monetag_ad_rewards
     WHERE user_id = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
    [userId],
  );
  const { monetagReward, monetagDailyLimit } = await getAdSettings();
  return {
    ...rows[0],
    claimedToday: Number(progress[0]?.count ?? 0),
    dailyLimit: monetagDailyLimit,
    reward: monetagReward,
  };
}

export async function createMonetagSession(req, res) {
  const user = await requireUser(req);
  const progress = await sql.query(
    `SELECT count FROM vr_monetag_ad_rewards
     WHERE user_id = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
    [user.id],
  );
  const claimedToday = Number(progress[0]?.count ?? 0);
  const { monetagReward, monetagDailyLimit } = await getAdSettings();
  if (claimedToday >= monetagDailyLimit) throw new HttpError(429, 'Daily Monetag reward limit reached');

  const id = newIdentifier('MNT');
  await sql.query(
    `INSERT INTO vr_monetag_ad_sessions (id, user_id, day)
     VALUES ($1, $2, (now() AT TIME ZONE 'UTC')::date)`,
    [id, user.id],
  );
  ok(res, { id, claimedToday, dailyLimit: monetagDailyLimit, reward: monetagReward }, 201);
}

export async function completeMonetagStep(req, res, sessionId) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const step = Number(body.step);
  if (step !== 1 && step !== 2) throw new HttpError(400, 'Invalid ad step');
  const result = await settlePair(sessionId, step, 'completed', user.id, true);
  if (!result) throw new HttpError(404, 'Ad session not found or expired');
  const session = await readSession(sessionId, user.id);
  ok(res, { ...session, credited: Boolean(result.credited) || Boolean(session?.rewarded) });
}

export async function getMonetagSession(req, res, sessionId) {
  const user = await requireUser(req);
  const session = await readSession(sessionId, user.id);
  if (!session) throw new HttpError(404, 'Ad session not found');
  ok(res, session);
}

export async function handleMonetagPostback(req, res, query) {
  const expectedSecret = process.env.MONETAG_POSTBACK_SECRET;
  const suppliedSecret = query.get('secret') ?? '';
  if (!expectedSecret || !sameSecret(suppliedSecret, expectedSecret)) {
    fail(res, expectedSecret ? 403 : 503, 'Invalid Monetag postback secret');
    return;
  }

  const ymid = query.get('ymid') ?? '';
  const eventType = query.get('event_type') ?? '';
  const rewardEventType = query.get('reward_event_type') ?? '';
  const zoneId = query.get('zone_id') ?? '';
  const match = /^(MNT-[A-Z0-9-]{8,40})_([12])$/.exec(ymid);
  if (!match || eventType !== 'impression' || rewardEventType !== 'valued' || zoneId !== '11993293') {
    ok(res, { accepted: true, ignored: true });
    return;
  }

  await settlePair(match[1], Number(match[2]), 'valued');
  ok(res, { accepted: true });
}
