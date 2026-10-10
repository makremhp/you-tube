import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { channelMembershipState, publicChannelHandle, requireUser } from './auth.js';
import { TELEGRAM_RETENTION_DAYS } from './config.js';
import { getTaskRewardSettings } from './settings.js';

async function reverseLostMembershipRewards(userId, memberships) {
  const { telegramTaskReward } = await getTaskRewardSettings();
  const payload = memberships.map((item) => ({
    campaign_id: item.campaignId,
    completed_at: item.completedAt,
    fallback_reward: telegramTaskReward,
  }));
  const rows = await sql.query(
    `WITH candidates AS (
       SELECT campaign_id, completed_at, fallback_reward
       FROM jsonb_to_recordset($2::jsonb)
         AS item(campaign_id BIGINT, completed_at TIMESTAMPTZ, fallback_reward NUMERIC)
     ), revoked AS (
       UPDATE vr_completions AS completion
       SET status = 'membership_lost',
           reward = COALESCE(completion.reward, candidates.fallback_reward)
       FROM candidates
       WHERE completion.campaign_id = candidates.campaign_id
         AND completion.user_id = $1
         AND completion.status = 'completed'
         AND completion.completed_at = candidates.completed_at
         AND completion.completed_at > now() - make_interval(days => $3::int)
       RETURNING completion.campaign_id, completion.reward
     ), debit AS (
       UPDATE vr_users
       SET earned_balance = earned_balance - (SELECT COALESCE(SUM(reward), 0) FROM revoked)
       WHERE id = $1 AND EXISTS (SELECT 1 FROM revoked)
       RETURNING id
     ), campaign_counts AS (
       UPDATE vr_campaigns AS campaign
       SET completed_count = GREATEST(0, campaign.completed_count - counts.revoked_count)
       FROM (
         SELECT campaign_id, COUNT(*)::int AS revoked_count
         FROM revoked GROUP BY campaign_id
       ) AS counts
       WHERE campaign.id = counts.campaign_id
       RETURNING campaign.id
     )
     SELECT COUNT(*)::int AS "revokedCount",
            COALESCE(SUM(reward), 0)::float8 AS "reversedAmount"
     FROM revoked`,
    [userId, JSON.stringify(payload), TELEGRAM_RETENTION_DAYS],
  );
  return {
    revokedCount: Number(rows[0]?.revokedCount ?? 0),
    reversedAmount: Number(rows[0]?.reversedAmount ?? 0),
  };
}

export async function checkTelegramMembershipOnEntry(req, res) {
  const user = await requireUser(req);
  const completions = await sql.query(
    `SELECT completion.campaign_id::text AS "campaignId",
            completion.completed_at AS "completedAt",
            COALESCE(completion.campaign_link, campaign.link) AS link
     FROM vr_completions AS completion
     JOIN vr_campaigns AS campaign ON campaign.id = completion.campaign_id
     WHERE completion.user_id = $1
       AND completion.status = 'completed'
       AND completion.completed_at > now() - make_interval(days => $2::int)
       AND campaign.platform = 'telegram'
     ORDER BY completion.completed_at ASC`,
    [user.id, TELEGRAM_RETENTION_DAYS],
  );

  const byChannel = new Map();
  for (const completion of completions) {
    const handle = publicChannelHandle(completion.link);
    if (!handle) continue;
    const channelTasks = byChannel.get(handle) ?? [];
    channelTasks.push(completion);
    byChannel.set(handle, channelTasks);
  }

  let checkedChannels = 0;
  let unavailableChannels = 0;
  let revokedTasks = 0;
  let reversedAmount = 0;
  const entries = [...byChannel.entries()];
  for (let offset = 0; offset < entries.length; offset += 5) {
    const batch = entries.slice(offset, offset + 5);
    const checks = await Promise.all(batch.map(async ([, tasks]) => ({
      tasks,
      state: await channelMembershipState(tasks[0].link, user.id),
    })));
    for (const check of checks) {
      if (check.state === null) {
        unavailableChannels += 1;
        continue;
      }
      checkedChannels += 1;
      if (check.state !== 'left') continue;
      const reversal = await reverseLostMembershipRewards(user.id, check.tasks);
      revokedTasks += reversal.revokedCount;
      reversedAmount += reversal.reversedAmount;
    }
  }

  ok(res, { checkedChannels, unavailableChannels, revokedTasks, reversedAmount });
}
