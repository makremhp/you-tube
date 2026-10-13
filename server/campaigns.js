import { createHash } from 'node:crypto';
import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { requireUser, botIsChannelAdmin, userIsChannelMember } from './auth.js';
import {
  getYoutubeSettings,
  MAX_REQUESTED_VIEWS,
  MIN_WATCH_TOLERANCE,
  roundMoney,
  viewerReward,
} from './config.js';
import { getTaskRewardSettings } from './settings.js';
import { notifyCampaignStatus, notifyTaskAdvertiser, notifyTaskAvailable, sendNotification } from '../api/telegram/bot-messages.js';
import {
  readHttpUrl,
  readIdempotencyKey,
  readMoney,
  readPositiveInteger,
  readText,
} from './validation.js';

const PLATFORMS = ['youtube', 'telegram', 'tiktok'];
const CAMPAIGN_STATUSES = ['نشط', 'مسودة', 'مكتمل', 'موقوف', 'بانتظار تحقق البوت'];

// حماية النشر من الضغط المتكرر/الأوتو كليك: لا يُنشر أكثر من إعلان واحد لكل معلن خلال هذه الفترة،
// ولا يُقبل إعلان مطابق لإعلان نُشر قبل لحظات (يمنع الخصم المتكرر).
const CAMPAIGN_COOLDOWN_SECONDS = 5;
const CAMPAIGN_DUPLICATE_WINDOW_SECONDS = 120;
const RATE_LIMIT_MESSAGE = 'يوجد طلب نشر آخر قيد المعالجة. انتظر بضع ثوانٍ وتحقق من قائمة إعلاناتك قبل المحاولة مجددًا.';
const DUPLICATE_MESSAGE = 'تم نشر إعلان مطابق قبل لحظات ولم يُخصم رصيد إضافي. راجع قائمة إعلاناتك.';

function completionStamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(Date.now()) : date.toISOString();
}

// العمليات التي بعد الحفظ (إشعارات) لا يجوز أن تُفشل الاستجابة ولا أن تؤخرها طويلًا.
async function bestEffort(promise, ms = 3000) {
  try {
    await Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);
  } catch (error) {
    console.error('Post-commit task failed:', error instanceof Error ? error.message : 'unknown');
  }
}

// إعادة محاولة واحدة لاستعلام آمن التكرار (idempotent) عند خطأ مؤقت من قاعدة البيانات/Neon.
async function queryWithRetry(text, params) {
  try {
    return await sql.query(text, params);
  } catch (error) {
    const code = String(error?.code ?? '');
    if (/^(22|23|42)/.test(code)) throw error;
    console.error('Retrying after database error:', code, error instanceof Error ? error.message : 'unknown');
    await new Promise((resolve) => setTimeout(resolve, 300));
    return sql.query(text, params);
  }
}

async function releaseCampaignRequest(userId, requestId) {
  try {
    await sql.query(
      `DELETE FROM vr_campaign_requests
       WHERE owner_id = $1 AND request_id = $2 AND status IN ('rate_limited', 'duplicate')`,
      [userId, requestId],
    );
  } catch {
    // محاولة تنظيف فقط.
  }
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
  c.requested_views AS "requestedViews",
  c.campaign_budget::float8 AS "campaignBudget",
  c.viewer_share::float8 AS "viewerShare",
  c.platform_share::float8 AS "platformShare",
  c.viewer_reward_per_view::float8 AS "viewerRewardPerView",
  c.platform_revenue_per_view::float8 AS "platformRevenuePerView",
  c.country,
  c.device,
  c.status,
  c.views::float8 AS views,
  c.joined_count AS "joinedCount",
  c.completed_count AS "completedCount",
  c.owner_id::float8 AS "ownerId",
  c.created_at AS "createdAt"`;

export async function listTasks(req, res, query) {
  const user = await requireUser(req);
  const platform = PLATFORMS.includes(query.get('platform') ?? '') ? query.get('platform') : null;
  const rows = await sql.query(
    `SELECT ${CAMPAIGN_COLUMNS},
            comp.status AS "userStatus",
            (comp.status = 'completed') AS completed
     FROM vr_campaigns c
     LEFT JOIN vr_completions comp ON comp.campaign_id = c.id AND comp.user_id = $1
     WHERE c.status = 'نشط'
       AND ($2::text IS NULL OR c.platform = $2)
       AND (c.platform <> 'youtube' OR c.requested_views IS NULL OR c.views < c.requested_views)
       AND (c.platform <> 'telegram' OR comp.status IS DISTINCT FROM 'completed')
     ORDER BY c.created_at DESC
     LIMIT 200`,
    [user.id, platform],
  );
  ok(res, rows);
}

// قائمة عامة لإعلانات يوتيوب النشطة تُعرض خارج Telegram (المتصفح) للقراءة فقط.
// لا تتضمن بيانات المالك أو الميزانية أو حالة أي مستخدم، ولا يمكن استلام مكافأة بدون جلسة Telegram.
export async function listPublicTasks(_req, res) {
  const rows = await sql.query(
    `SELECT c.id::text AS id,
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
            c.requested_views AS "requestedViews",
            c.status,
            c.views::float8 AS views,
            c.joined_count AS "joinedCount",
            c.completed_count AS "completedCount",
            c.created_at AS "createdAt"
     FROM vr_campaigns c
     WHERE c.status = 'نشط'
       AND c.platform = 'youtube'
       AND (c.requested_views IS NULL OR c.views < c.requested_views)
     ORDER BY c.created_at DESC
     LIMIT 200`,
  );
  ok(res, rows);
}

export async function listCampaigns(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT ${CAMPAIGN_COLUMNS}
     FROM vr_campaigns c
     WHERE c.owner_id = $1
     ORDER BY c.created_at DESC
     LIMIT 200`,
    [user.id],
  );
  ok(res, rows);
}

function makeYoutubeRequestHash(values) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

async function createYoutubeCampaign(req, res, user, body, title, link) {
  const settings = getYoutubeSettings();
  const duration = readPositiveInteger(body.duration, 600);
  const cpm = readMoney(body.cpm, 0.01, 1000);
  const requestedViews = readPositiveInteger(body.requestedViews, MAX_REQUESTED_VIEWS);
  const configuredCpm = duration ? settings.cpmOptions[duration] : undefined;

  if (
    !duration || !cpm || !requestedViews
    || requestedViews < settings.minimumViews
    || configuredCpm === undefined
    || Math.abs(Number(configuredCpm) - cpm) > 0.000001
  ) {
    throw new HttpError(400, `يجب اختيار إعداد CPM صالح وطلب ${settings.minimumViews} مشاهدة على الأقل.`);
  }

  const requestId = readIdempotencyKey(req.headers['idempotency-key']);
  if (!requestId) throw new HttpError(400, 'تعذر التحقق من طلب الحملة. حدّث الصفحة ثم أعد المحاولة.');

  const costPerView = roundMoney(cpm / 1000, 9);
  const campaignBudget = roundMoney(costPerView * requestedViews, 6);
  const viewerRewardPerView = roundMoney(costPerView * (settings.viewerShare / 100), 9);
  const platformRevenuePerView = roundMoney(costPerView - viewerRewardPerView, 9);
  const reward = roundMoney(viewerRewardPerView, 6);
  const creator = readText(body.creator, 120) ?? ([user.first_name, user.last_name].filter(Boolean).join(' ') || null);
  const description = readText(body.description, 2000);
  const thumbnail = readHttpUrl(body.thumbnail);
  const country = readText(body.country, 80);
  const device = readText(body.device, 40);
  const status = body.status === 'مسودة' ? 'مسودة' : 'نشط';

  const normalizedRequest = {
    platform: 'youtube',
    title,
    link,
    creator,
    description,
    thumbnail,
    duration,
    cpm,
    requestedViews,
    country,
    device,
    status,
  };
  const requestHash = makeYoutubeRequestHash(normalizedRequest);
  const createdRows = await sql.query(
    `WITH claimed AS (
       INSERT INTO vr_campaign_requests (owner_id, request_id, request_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_id, request_id) DO NOTHING
       RETURNING owner_id
     ), cooled AS (
       INSERT INTO vr_campaign_cooldowns (owner_id, last_at)
       SELECT $1::bigint, now() WHERE EXISTS (SELECT 1 FROM claimed)
       ON CONFLICT (owner_id) DO UPDATE SET last_at = now()
         WHERE vr_campaign_cooldowns.last_at <= now() - make_interval(secs => ${CAMPAIGN_COOLDOWN_SECONDS})
       RETURNING owner_id
     ), duplicate AS (
       SELECT 1 AS found FROM vr_campaigns
       WHERE owner_id = $1 AND platform = 'youtube' AND link = $8::text AND title = $5::text
         AND duration = $10::int AND requested_views = $13::int
         AND created_at > now() - make_interval(secs => ${CAMPAIGN_DUPLICATE_WINDOW_SECONDS})
         AND EXISTS (SELECT 1 FROM cooled)
       LIMIT 1
     ), debited AS (
       UPDATE vr_users
       SET advertiser_balance = advertiser_balance - $4::numeric
       WHERE id = $1
         AND advertiser_balance >= $4::numeric
         AND EXISTS (SELECT 1 FROM cooled)
         AND NOT EXISTS (SELECT 1 FROM duplicate)
       RETURNING id
     ), created AS (
       INSERT INTO vr_campaigns (
         owner_id, platform, title, description, creator, link, thumbnail,
         duration, cpm, reward, price, target_count, requested_views,
         campaign_budget, viewer_share, platform_share, viewer_reward_per_view,
         platform_revenue_per_view, country, device, status
       )
       SELECT
         $1, 'youtube', $5, $6, $7, $8, $9,
         $10, $11, $12, $4, $13, $13,
         $4, $14, $15, $16, $17, $18, $19, $20
       FROM debited
       RETURNING id
     ), finalized AS (
       UPDATE vr_campaign_requests
       SET campaign_id = (SELECT id FROM created),
           status = CASE
             WHEN EXISTS (SELECT 1 FROM created) THEN 'created'
             WHEN NOT EXISTS (SELECT 1 FROM cooled) THEN 'rate_limited'
             WHEN EXISTS (SELECT 1 FROM duplicate) THEN 'duplicate'
             ELSE 'insufficient_balance'
           END
       WHERE owner_id = $1
         AND request_id = $2
         AND EXISTS (SELECT 1 FROM claimed)
       RETURNING campaign_id, status
     )
     SELECT campaign_id::text AS id, status
     FROM finalized`,
    [
      user.id,
      requestId,
      requestHash,
      campaignBudget,
      title,
      description,
      creator,
      link,
      thumbnail,
      duration,
      cpm,
      reward,
      requestedViews,
      settings.viewerShare,
      settings.platformShare,
      viewerRewardPerView,
      platformRevenuePerView,
      country,
      device,
      status,
    ],
  );

  if (!createdRows.length) {
    const priorRows = await sql.query(
      `SELECT request_hash AS "requestHash", campaign_id::text AS id, status
       FROM vr_campaign_requests
       WHERE owner_id = $1 AND request_id = $2`,
      [user.id, requestId],
    );
    const prior = priorRows[0];
    if (!prior) throw new HttpError(409, 'تعذر إكمال الطلب. أعد المحاولة باستخدام طلب جديد.');
    if (prior.requestHash !== requestHash) throw new HttpError(409, 'تم استخدام معرّف الطلب مع بيانات حملة مختلفة.');
    if (prior.status === 'insufficient_balance') {
      throw new HttpError(402, 'رصيد المعلن غير كافٍ لنشر هذه الحملة. أضف رصيدًا ثم أعد المحاولة.');
    }
    if (prior.status === 'rate_limited') {
      await releaseCampaignRequest(user.id, requestId);
      throw new HttpError(429, RATE_LIMIT_MESSAGE);
    }
    if (prior.status === 'duplicate') {
      await releaseCampaignRequest(user.id, requestId);
      throw new HttpError(409, DUPLICATE_MESSAGE);
    }
    if (prior.status === 'created' && prior.id) {
      ok(res, { id: prior.id, campaignBudget, replayed: true }, 200);
      return;
    }
    throw new HttpError(409, 'هذا الطلب قيد المعالجة بالفعل.');
  }

  const result = createdRows[0];
  if (result.status === 'rate_limited') {
    await releaseCampaignRequest(user.id, requestId);
    throw new HttpError(429, RATE_LIMIT_MESSAGE);
  }
  if (result.status === 'duplicate') {
    await releaseCampaignRequest(user.id, requestId);
    throw new HttpError(409, DUPLICATE_MESSAGE);
  }
  if (result.status === 'insufficient_balance') {
    throw new HttpError(402, 'رصيد المعلن غير كافٍ لنشر هذه الحملة. أضف رصيدًا ثم أعد المحاولة.');
  }
  if (status === 'نشط') await notifyTaskAvailable(result.id);
  ok(res, { id: result.id, campaignBudget, replayed: false }, 201);
}

export async function createCampaign(req, res) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const platform = PLATFORMS.includes(body.platform) ? body.platform : null;
  const title = readText(body.title, 160);
  const link = platform === 'youtube' && body.link === '' ? '' : readHttpUrl(body.link);
  if (!platform || !title || link === null) throw new HttpError(400, 'Invalid request');

  if (platform === 'youtube') {
    await createYoutubeCampaign(req, res, user, body, title, link);
    return;
  }

  const targetCount = readPositiveInteger(body.targetCount, 1000000);
  const price = readMoney(body.price, 0.01, 1000000);
  const rewardSettings = await getTaskRewardSettings();
  const taskReward = platform === 'telegram' ? rewardSettings.telegramTaskReward : rewardSettings.tiktokTaskReward;
  if (!targetCount || !price || price / targetCount < taskReward) throw new HttpError(400, 'Invalid request');
  let status = 'نشط';
  if (platform === 'telegram') {
    status = (await botIsChannelAdmin(link)) ? 'نشط' : 'بانتظار تحقق البوت';
  }
  // خصم ميزانية الحملة وإنشاؤها في عملية ذرّية واحدة، مع حماية من الضغط المتكرر (فاصل زمني + منع التكرار المطابق).
  const rows = await sql.query(
    `WITH cooled AS (
       INSERT INTO vr_campaign_cooldowns (owner_id, last_at)
       VALUES ($1::bigint, now())
       ON CONFLICT (owner_id) DO UPDATE SET last_at = now()
         WHERE vr_campaign_cooldowns.last_at <= now() - make_interval(secs => ${CAMPAIGN_COOLDOWN_SECONDS})
       RETURNING owner_id
     ), duplicate AS (
       SELECT 1 AS found FROM vr_campaigns
       WHERE owner_id = $1::bigint AND platform = $2::text AND link = $5::text
         AND created_at > now() - make_interval(secs => ${CAMPAIGN_DUPLICATE_WINDOW_SECONDS})
         AND EXISTS (SELECT 1 FROM cooled)
       LIMIT 1
     ), debited AS (
       UPDATE vr_users
       SET advertiser_balance = advertiser_balance - $8::numeric
       WHERE id = $1 AND advertiser_balance >= $8::numeric
         AND EXISTS (SELECT 1 FROM cooled)
         AND NOT EXISTS (SELECT 1 FROM duplicate)
       RETURNING id
     ), created AS (
       INSERT INTO vr_campaigns (owner_id, platform, title, description, link, thumbnail, target_count, price, campaign_budget, reward, status)
       SELECT $1::bigint, $2::text, $3::text, $4::text, $5::text, $6::text, $7::int, $8::numeric, $8::numeric, $9::numeric, $10::text
       FROM debited
       RETURNING id::text AS id, status
     )
     SELECT (SELECT id FROM created) AS id,
            (SELECT status FROM created) AS status,
            EXISTS (SELECT 1 FROM cooled) AS "cooledOk",
            EXISTS (SELECT 1 FROM duplicate) AS "isDuplicate"`,
    [
      user.id, platform, title, readText(body.description, 2000), link,
      typeof body.image === 'string' && body.image.length <= 600000 ? body.image : null,
      targetCount, price, taskReward, status,
    ],
  );
  if (!rows[0]?.id) {
    if (!rows[0]?.cooledOk) throw new HttpError(429, RATE_LIMIT_MESSAGE);
    if (rows[0]?.isDuplicate) throw new HttpError(409, DUPLICATE_MESSAGE);
    throw new HttpError(402, 'رصيد المعلن غير كافٍ لنشر هذه الحملة. أضف رصيدًا ثم أعد المحاولة.');
  }
  if (rows[0].status === 'نشط') await notifyTaskAvailable(rows[0].id);
  ok(res, { id: rows[0].id, status: rows[0].status }, 201);
}

export async function updateCampaign(req, res, id) {
  const user = await requireUser(req);
  const body = req.body ?? {};
  const status = CAMPAIGN_STATUSES.includes(body.status) ? body.status : null;
  const title = body.title === undefined ? null : readText(body.title, 160);
  const link = body.link === undefined ? null : readHttpUrl(body.link);
  if (body.title !== undefined && !title) throw new HttpError(400, 'Invalid request');
  if (body.link !== undefined && !link) throw new HttpError(400, 'Invalid request');
  if (body.status !== undefined && !status) throw new HttpError(400, 'Invalid request');

  const currentRows = await sql.query(
    `SELECT platform, link, status FROM vr_campaigns WHERE id = $1 AND owner_id = $2`,
    [id, user.id],
  );
  let nextStatus = status;
  if (status === 'نشط') {
    if (currentRows[0]?.platform === 'telegram' && !(await botIsChannelAdmin(link ?? currentRows[0].link))) {
      nextStatus = 'بانتظار تحقق البوت';
    }
  }
  const rows = await sql.query(
    `UPDATE vr_campaigns SET
       title = COALESCE($3, title),
       link = COALESCE($4, link),
       status = COALESCE($5, status)
     WHERE id = $1 AND owner_id = $2
     RETURNING id::text AS id, status`,
    [id, user.id, title, link, nextStatus],
  );
  if (!rows.length) throw new HttpError(404, 'Not found');
  if (status) await notifyCampaignStatus(id, currentRows[0]?.status, rows[0].status);
  ok(res, rows[0]);
}

export async function deleteCampaign(req, res, id) {
  const user = await requireUser(req);
  const rows = await sql.query(`DELETE FROM vr_campaigns WHERE id = $1 AND owner_id = $2 RETURNING id::text AS id`, [id, user.id]);
  if (!rows.length) throw new HttpError(404, 'Not found');
  ok(res, { id: rows[0].id });
}

export async function startTask(req, res, id) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `WITH target AS (
       SELECT id FROM vr_campaigns
       WHERE id = $1 AND status = 'نشط'
         AND (platform <> 'youtube' OR requested_views IS NULL OR views < requested_views)
     ), started AS (
       INSERT INTO vr_completions (campaign_id, user_id, status)
       SELECT id, $2, 'started' FROM target
       ON CONFLICT (campaign_id, user_id) DO UPDATE
         SET status = 'started', started_at = now(), completed_at = NULL, reward = NULL, proof_image = NULL
         WHERE vr_completions.status = 'membership_lost'
       RETURNING status
     ), joined AS (
       UPDATE vr_campaigns SET joined_count = joined_count + 1
       WHERE id = $1 AND EXISTS (SELECT 1 FROM started)
       RETURNING id
     )
     SELECT COALESCE(
       (SELECT status FROM started),
       (SELECT status FROM vr_completions WHERE campaign_id = $1 AND user_id = $2)
     ) AS status`,
    [id, user.id],
  );
  if (!rows[0] || !rows[0].status) throw new HttpError(404, 'Not found');
  ok(res, { status: rows[0].status });
}

async function findCompletedReward(campaignId, userId) {
  const rows = await sql.query(
    `SELECT reward::float8 AS reward FROM vr_completions
     WHERE campaign_id = $1 AND user_id = $2 AND status = 'completed'`,
    [campaignId, userId],
  );
  return rows[0] ? Number(rows[0].reward ?? 0) : null;
}

export async function completeTask(req, res, id) {
  const user = await requireUser(req);
  const campaigns = await sql.query(
    `SELECT platform, link, duration, cpm::float8 AS cpm, reward::float8 AS reward, status
     FROM vr_campaigns WHERE id = $1`,
    [id],
  );
  const campaign = campaigns[0];
  if (!campaign) throw new HttpError(404, 'Not found');
  if (campaign.status !== 'نشط') {
    // أُوقفت الحملة بعد أن احتُسبت المشاهدة (مثلًا إعادة ضغط بعد انقطاع الاستجابة): لا خطأ ولا مكافأة مكررة.
    if (campaign.platform === 'youtube') {
      const earlier = await findCompletedReward(id, user.id);
      if (earlier !== null) {
        ok(res, { reward: earlier, alreadyCredited: true });
        return;
      }
    }
    throw new HttpError(404, 'Not found');
  }

  if (campaign.platform === 'youtube') {
    const requiredSeconds = Number(campaign.duration) * MIN_WATCH_TOLERANCE;
    const reward = campaign.reward ?? viewerReward(campaign.cpm);
    const rows = await queryWithRetry(
      `WITH candidate AS (
         SELECT id FROM vr_campaigns
         WHERE id = $1 AND status = 'نشط' AND platform = 'youtube'
           AND (requested_views IS NULL OR views < requested_views)
         FOR UPDATE
       ), done AS (
         UPDATE vr_completions
         SET status = 'completed', completed_at = now(), reward = $3
         WHERE campaign_id = $1 AND user_id = $2 AND status = 'started'
           AND started_at <= now() - make_interval(secs => $4::float8)
           AND EXISTS (SELECT 1 FROM candidate)
         RETURNING reward, completed_at
       ), bump AS (
         UPDATE vr_campaigns SET completed_count = completed_count + 1, views = views + 1
         WHERE id = $1 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       ), credit AS (
         UPDATE vr_users SET earned_balance = earned_balance + $3
         WHERE id = $2 AND EXISTS (SELECT 1 FROM bump)
         RETURNING id
       )
       SELECT done.reward::float8 AS reward, done.completed_at AS "completedAt" FROM done, bump, credit`,
      [id, user.id, reward, requiredSeconds],
    );
    if (!rows.length) {
      // إن كانت المشاهدة محتسبة سابقًا (إعادة محاولة بعد خطأ مؤقت) نُرجع نجاحًا دون خصم/إضافة جديدة.
      const earlier = await findCompletedReward(id, user.id);
      if (earlier !== null) {
        ok(res, { reward: earlier, alreadyCredited: true });
        return;
      }
      throw new HttpError(409, 'لم تكتمل المشاهدة بعد أو وصلت الحملة إلى عدد المشاهدات المطلوب.');
    }
    // المكافأة حُفظت فعلًا؛ الإشعار لا يجوز أن يُفشل الاستجابة أو يؤخرها.
    await bestEffort(notifyTaskAdvertiser(id, user.id, `complete_${id}_${user.id}_${completionStamp(rows[0].completedAt)}`));
    ok(res, { reward: rows[0].reward });
    return;
  }

  if (campaign.platform === 'telegram') {
    if (!(await userIsChannelMember(campaign.link, user.id))) throw new HttpError(409, 'Membership not verified');
    const rows = await sql.query(
      `WITH done AS (
         INSERT INTO vr_completions (campaign_id, user_id, status, reward, completed_at, campaign_link)
         VALUES ($1, $2, 'completed', $3, now(), $4)
         ON CONFLICT (campaign_id, user_id) DO UPDATE
           SET status = 'completed', reward = EXCLUDED.reward, completed_at = now(), campaign_link = EXCLUDED.campaign_link,
               started_at = now(), proof_image = NULL
           WHERE vr_completions.status IN ('membership_lost', 'started')
         RETURNING reward, completed_at
       ), credit AS (
         UPDATE vr_users SET earned_balance = earned_balance + $3
         WHERE id = $2 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       ), bump AS (
         UPDATE vr_campaigns SET joined_count = joined_count + 1, completed_count = completed_count + 1
         WHERE id = $1 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       )
       SELECT reward::float8 AS reward, completed_at AS "completedAt" FROM done`,
      [id, user.id, campaign.reward ?? (await getTaskRewardSettings()).telegramTaskReward, campaign.link],
    );
    if (!rows.length) throw new HttpError(409, 'Task already completed');
    await bestEffort(notifyTaskAdvertiser(id, user.id, `complete_${id}_${user.id}_${completionStamp(rows[0].completedAt)}`));
    ok(res, { reward: rows[0].reward });
    return;
  }

  throw new HttpError(400, 'Invalid request');
}

export async function submitProof(req, res, id) {
  const user = await requireUser(req);
  const image = typeof req.body?.image === 'string' && req.body.image.startsWith('data:image/') && req.body.image.length <= 3000000
    ? req.body.image
    : null;
  if (!image) throw new HttpError(400, 'Invalid request');
  const rows = await sql.query(
    `WITH target AS (
       SELECT id, reward, title FROM vr_campaigns WHERE id = $1 AND status = 'نشط' AND platform = 'tiktok'
     ), proof AS (
       INSERT INTO vr_completions (campaign_id, user_id, status, proof_image, reward)
       SELECT id, $2, 'pending', $3, reward FROM target
       ON CONFLICT (campaign_id, user_id) DO NOTHING
       RETURNING status, campaign_id
     ), bump AS (
       UPDATE vr_campaigns SET joined_count = joined_count + 1
       WHERE id = $1 AND EXISTS (SELECT 1 FROM proof)
       RETURNING id
     )
     SELECT proof.status, proof.campaign_id::text AS "campaignId", target.title FROM proof
     JOIN target ON target.id = proof.campaign_id`,
    [id, user.id, image],
  );
  if (!rows.length) throw new HttpError(409, 'Proof already submitted');
  const proofId = `PRF-${rows[0].campaignId}-${user.id}`;
  await sendNotification('proof_received', user.id, {
    taskTitle: rows[0].title,
    proofId,
  }, { eventId: `${proofId}:received` });
  ok(res, { status: 'قيد المراجعة' }, 201);
}
