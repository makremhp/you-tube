import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { requireUser } from './auth.js';

const DAILY_CLAIM_DAY = '1970-01-01';
const TASKS = {
  invite_daily: { reward: 0.007, target: 3, metric: 'referralsToday', daily: true },
  referrals_20: { reward: 0.04, target: 20, metric: 'referralsTotal' },
  referrals_50: { reward: 0.1, target: 50, metric: 'referralsTotal' },
  referrals_100: { reward: 0.2, target: 100, metric: 'referralsTotal' },
  browse_100: { reward: 0.01, target: 100, metric: 'browsingSessions' },
  monetag_500: { reward: 0.02, target: 500, metric: 'monetagSessions' },
};

async function readProgress(userId) {
  const [referrals, browsing, monetag, claims] = await Promise.all([
    sql.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (
                WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
              )::int AS today
       FROM vr_users WHERE invited_by = $1`,
      [userId],
    ),
    sql.query(
      `SELECT (
         COALESCE((SELECT sum(count) FROM vr_ad_rewards WHERE user_id = $1), 0)
         + COALESCE((SELECT sum(count) FROM vr_monetag_ad_rewards WHERE user_id = $1), 0)
       )::int AS total`,
      [userId],
    ),
    sql.query(
      `SELECT count(*)::int AS total
       FROM vr_monetag_reward_credits WHERE user_id = $1`,
      [userId],
    ),
    sql.query(
      `SELECT achievement_id,
              claim_day = (now() AT TIME ZONE 'UTC')::date AS claimed_today
       FROM vr_achievement_claims
       WHERE user_id = $1`,
      [userId],
    ),
  ]);

  return {
    referralsTotal: Number(referrals[0]?.total ?? 0),
    referralsToday: Number(referrals[0]?.today ?? 0),
    browsingSessions: Number(browsing[0]?.total ?? 0),
    monetagSessions: Number(monetag[0]?.total ?? 0),
    claimed: [...new Set(claims
      .filter((row) => row.achievement_id !== 'invite_daily')
      .map((row) => row.achievement_id))],
    claimedToday: claims.filter((row) => row.achievement_id === 'invite_daily' && row.claimed_today)
      .map((row) => row.achievement_id),
  };
}

export async function getAchievements(req, res) {
  const user = await requireUser(req);
  ok(res, await readProgress(user.id));
}

export async function claimAchievement(req, res) {
  const user = await requireUser(req);
  const achievementId = req.body?.id;
  const task = TASKS[achievementId];
  if (!task) throw new HttpError(400, 'Invalid achievement');

  const claimDay = task.daily ? "(now() AT TIME ZONE 'UTC')::date" : `'${DAILY_CLAIM_DAY}'::date`;
  const eligibility = {
    invite_daily: `(SELECT count(*) FROM vr_users
      WHERE invited_by = $1
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') >= 3`,
    referrals_20: `(SELECT count(*) FROM vr_users WHERE invited_by = $1) >= 20`,
    referrals_50: `(SELECT count(*) FROM vr_users WHERE invited_by = $1) >= 50`,
    referrals_100: `(SELECT count(*) FROM vr_users WHERE invited_by = $1) >= 100`,
    browse_100: `(COALESCE((SELECT sum(count) FROM vr_ad_rewards WHERE user_id = $1), 0)
      + COALESCE((SELECT sum(count) FROM vr_monetag_ad_rewards WHERE user_id = $1), 0)) >= 100`,
    monetag_500: `(SELECT count(*) FROM vr_monetag_reward_credits WHERE user_id = $1) >= 500`,
  }[achievementId];

  const rows = await sql.query(
    `WITH eligibility AS (
       SELECT ${eligibility} AS met
     ), inserted AS (
       INSERT INTO vr_achievement_claims (user_id, achievement_id, claim_day, reward)
       SELECT $1, $2, ${claimDay}, $3 FROM eligibility WHERE met
       ON CONFLICT (user_id, achievement_id, claim_day) DO NOTHING
       RETURNING reward
     ), credited AS (
       UPDATE vr_users
       SET earned_balance = earned_balance + (SELECT reward FROM inserted)
       WHERE id = $1 AND EXISTS (SELECT 1 FROM inserted)
       RETURNING id
     )
     SELECT (SELECT reward::float8 FROM inserted) AS reward`,
    [user.id, achievementId, task.reward],
  );

  if (!rows[0]?.reward) {
    const progress = await readProgress(user.id);
    const alreadyClaimed = task.daily
      ? progress.claimedToday.includes(achievementId)
      : progress.claimed.includes(achievementId);
    throw new HttpError(alreadyClaimed ? 409 : 400, alreadyClaimed ? 'Achievement already claimed' : 'Achievement not completed');
  }

  ok(res, { reward: Number(rows[0].reward), progress: await readProgress(user.id) });
}
