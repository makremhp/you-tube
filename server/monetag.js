import { timingSafeEqual } from 'node:crypto';
import { sql } from './db.js';
import { HttpError, fail, ok } from './errors.js';
import { requireUser } from './auth.js';
import { getAdSettings } from './settings.js';
import { newIdentifier } from './validation.js';
import { MONETAG_ADS_PER_REWARD_MAX } from './config.js';

const SESSION_ID_PATTERN = /^MNT-[A-Z0-9-]{8,40}$/;

function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || !actual || typeof expected !== 'string' || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// الخطوات المكتملة تُحفظ كقناع بتّات (completed_mask) ليبقى الإبلاغ عن الخطوة نفسها آمنًا عند إعادة المحاولة.
// الأعمدة القديمة (first/second_*) تبقى للخطوتين 1 و2 كما كانت، وتُحتسب ضمن القناع الفعلي للجلسات القديمة.
const EFFECTIVE_MASK = `(completed_mask
  | (CASE WHEN first_completed_at IS NOT NULL THEN 1 ELSE 0 END)
  | (CASE WHEN second_completed_at IS NOT NULL THEN 2 ELSE 0 END))`;

async function settlePair(sessionId, step, action, userId = null, requireActive = false) {
  if (!SESSION_ID_PATTERN.test(sessionId) || !Number.isInteger(step)) return null;
  if (action === 'valued' ? (step !== 1 && step !== 2) : (step < 1 || step > MONETAG_ADS_PER_REWARD_MAX)) return null;
  // إكمال الخطوة من التطبيق (بعد أن أعاد Monetag SDK حدث valued) يسجّل الخطوة كمُكتملة ومُقيَّمة معًا،
  // فتُمنح المكافأة مباشرة بعد إكمال كل الإعلانات المطلوبة دون انتظار postback. أما الـ postback فيبقى يسجّل valued فقط.
  const completing = action !== 'valued';
  const stepBit = completing ? 1 << (step - 1) : 0;
  const setParts = [];
  if (step === 1 || step === 2) {
    const valuedColumn = step === 1 ? 'first_valued_at' : 'second_valued_at';
    const completedColumn = step === 1 ? 'first_completed_at' : 'second_completed_at';
    for (const column of completing ? [valuedColumn, completedColumn] : [valuedColumn]) {
      setParts.push(`${column} = COALESCE(${column}, now())`);
    }
  }
  setParts.push(
    `completed_mask = completed_mask | $6::int`,
    `steps_completed = steps_completed + CASE WHEN $6::int > 0 AND (${EFFECTIVE_MASK} & $6::int) = 0 THEN 1 ELSE 0 END`,
    `rewarded_at = CASE
             WHEN ((${EFFECTIVE_MASK}) | $6::int) = ((1 << required_steps) - 1) THEN COALESCE(rewarded_at, now())
             ELSE rewarded_at
           END`,
  );
  const { monetagReward, monetagDailyLimit } = await getAdSettings();

  const rows = await sql.query(
    `WITH changed AS (
       UPDATE vr_monetag_ad_sessions
       SET ${setParts.join(',\n           ')}
       WHERE id = $1
         AND ($2::bigint IS NULL OR user_id = $2)
         AND (NOT $5::boolean OR expires_at > now())
         AND ($7::int = 0 OR $7::int <= required_steps)
       RETURNING id, user_id, day, required_steps, rewarded_at,
                 ${EFFECTIVE_MASK} AS effective_mask
     ), eligible AS (
       SELECT id, user_id, day
       FROM changed
       WHERE effective_mask = ((1 << required_steps) - 1)
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
       RETURNING users.id AS user_id, claim.session_id, claim.day
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
    [sessionId, userId, monetagReward, monetagDailyLimit, requireActive, stepBit, completing ? step : 0],
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
            expires_at > now() AS active,
            required_steps AS "requiredSteps"
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
  const { monetagReward, monetagDailyLimit, monetagAdsPerReward } = await getAdSettings();
  if (claimedToday >= monetagDailyLimit) throw new HttpError(429, 'Daily Monetag reward limit reached');

  const id = newIdentifier('MNT');
  await sql.query(
    `INSERT INTO vr_monetag_ad_sessions (id, user_id, day, required_steps)
     VALUES ($1, $2, (now() AT TIME ZONE 'UTC')::date, $3)`,
    [id, user.id, monetagAdsPerReward],
  );
  ok(res, { id, claimedToday, dailyLimit: monetagDailyLimit, reward: monetagReward, requiredSteps: monetagAdsPerReward }, 201);
}

export async function completeMonetagStep(req, res, sessionId) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const step = Number(body.step);
  if (!Number.isInteger(step) || step < 1 || step > MONETAG_ADS_PER_REWARD_MAX) throw new HttpError(400, 'Invalid ad step');
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
