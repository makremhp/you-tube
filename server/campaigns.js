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
import {
  readHttpUrl,
  readIdempotencyKey,
  readMoney,
  readPositiveInteger,
  readText,
} from './validation.js';

const PLATFORMS = ['youtube', 'telegram', 'tiktok'];
const CAMPAIGN_STATUSES = ['نشط', 'مسودة', 'مكتمل', 'موقوف', 'بانتظار تحقق البوت'];

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
     ), debited AS (
       UPDATE vr_users
       SET advertiser_balance = advertiser_balance - $4::numeric
       WHERE id = $1
         AND advertiser_balance >= $4::numeric
         AND EXISTS (SELECT 1 FROM claimed)
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
    if (prior.status === 'created' && prior.id) {
      ok(res, { id: prior.id, campaignBudget, replayed: true }, 200);
      return;
    }
    throw new HttpError(409, 'هذا الطلب قيد المعالجة بالفعل.');
  }

  const result = createdRows[0];
  if (result.status === 'insufficient_balance') {
    throw new HttpError(402, 'رصيد المعلن غير كافٍ لنشر هذه الحملة. أضف رصيدًا ثم أعد المحاولة.');
  }
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
  const rows = await sql.query(
    `INSERT INTO vr_campaigns (owner_id, platform, title, description, link, thumbnail, target_count, price, reward, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id::text AS id, status`,
    [
      user.id, platform, title, readText(body.description, 2000), link,
      typeof body.image === 'string' && body.image.length <= 600000 ? body.image : null,
      targetCount, price, taskReward, status,
    ],
  );
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

  let nextStatus = status;
  if (status === 'نشط') {
    const current = await sql.query(`SELECT platform, link FROM vr_campaigns WHERE id = $1 AND owner_id = $2`, [id, user.id]);
    if (current[0]?.platform === 'telegram' && !(await botIsChannelAdmin(link ?? current[0].link))) {
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

export async function completeTask(req, res, id) {
  const user = await requireUser(req);
  const campaigns = await sql.query(
    `SELECT platform, link, duration, cpm::float8 AS cpm, reward::float8 AS reward
     FROM vr_campaigns WHERE id = $1 AND status = 'نشط'`,
    [id],
  );
  const campaign = campaigns[0];
  if (!campaign) throw new HttpError(404, 'Not found');

  if (campaign.platform === 'youtube') {
    const requiredSeconds = Number(campaign.duration) * MIN_WATCH_TOLERANCE;
    const reward = campaign.reward ?? viewerReward(campaign.cpm);
    const rows = await sql.query(
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
         RETURNING reward
       ), bump AS (
         UPDATE vr_campaigns SET completed_count = completed_count + 1, views = views + 1
         WHERE id = $1 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       ), credit AS (
         UPDATE vr_users SET earned_balance = earned_balance + $3
         WHERE id = $2 AND EXISTS (SELECT 1 FROM bump)
         RETURNING id
       )
       SELECT done.reward::float8 AS reward FROM done, bump, credit`,
      [id, user.id, reward, requiredSeconds],
    );
    if (!rows.length) throw new HttpError(409, 'لم تكتمل المشاهدة بعد أو وصلت الحملة إلى عدد المشاهدات المطلوب.');
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
         RETURNING reward
       ), credit AS (
         UPDATE vr_users SET earned_balance = earned_balance + $3
         WHERE id = $2 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       ), bump AS (
         UPDATE vr_campaigns SET joined_count = joined_count + 1, completed_count = completed_count + 1
         WHERE id = $1 AND EXISTS (SELECT 1 FROM done)
         RETURNING id
       )
       SELECT reward::float8 AS reward FROM done`,
      [id, user.id, campaign.reward ?? (await getTaskRewardSettings()).telegramTaskReward, campaign.link],
    );
    if (!rows.length) throw new HttpError(409, 'Task already completed');
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
       SELECT id, reward FROM vr_campaigns WHERE id = $1 AND status = 'نشط' AND platform = 'tiktok'
     ), proof AS (
       INSERT INTO vr_completions (campaign_id, user_id, status, proof_image, reward)
       SELECT id, $2, 'pending', $3, reward FROM target
       ON CONFLICT (campaign_id, user_id) DO NOTHING
       RETURNING status
     ), bump AS (
       UPDATE vr_campaigns SET joined_count = joined_count + 1
       WHERE id = $1 AND EXISTS (SELECT 1 FROM proof)
       RETURNING id
     )
     SELECT status FROM proof`,
    [id, user.id, image],
  );
  if (!rows.length) throw new HttpError(409, 'Proof already submitted');
  ok(res, { status: 'قيد المراجعة' }, 201);
}
