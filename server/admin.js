import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { readMoney, readPositiveInteger, readText } from './validation.js';
import { requireAdmin, telegramCall } from './auth.js';

async function recordAdminAction(adminId, collection, recordId, status) {
  try {
    await sql.query(
      `INSERT INTO vr_admin_audit_log (admin_id, collection, record_id, new_status)
       VALUES ($1, $2, $3, $4)`,
      [adminId, collection, String(recordId), status],
    );
  } catch (error) {
    console.error('Admin audit log write failed:', error instanceof Error ? error.message : 'unknown');
  }
}

export async function adminState(req, res) {
  await requireAdmin(req);
  const [users, deposits, withdrawals, campaigns, proofs, suspicious, adminAudit, settings] = await Promise.all([
    sql.query(
      `SELECT id::float8 AS id,
              TRIM(CONCAT(first_name, ' ', COALESCE(last_name, ''))) AS name,
              COALESCE(username, '') AS username,
               COALESCE(photo_url, '') AS "photoUrl",
              advertiser_balance::float8 AS "advertiserBalance",
              earned_balance::float8 AS "earnedBalance",
              status,
              banned_by_system AS "bannedBySystem",
              to_char(created_at, 'YYYY-MM-DD') AS "joinedAt",
              to_char(last_active_at, 'YYYY-MM-DD HH24:MI') AS "lastLogin",
              to_char(last_active_at, 'YYYY-MM-DD HH24:MI') AS "lastActive",
              COALESCE(invited_by::text, '—') AS "invitedBy"
       FROM vr_users ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT id, user_id::float8 AS "userId", amount::float8 AS amount,
              CASE method WHEN 'stars' THEN 'Stars' ELSE 'USDT' END AS method,
              memo_tag AS "memoTag", blockchain_tx_id AS "txId", destination AS wallet, credited, reason,
              CASE status WHEN 'تم' THEN 'ناجح' WHEN 'قيد المعالجة' THEN 'قيد المعالجة' ELSE 'فاشل' END AS status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM vr_deposits ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT id, user_id::float8 AS "userId", amount::float8 AS amount,
              CASE method WHEN 'binance' THEN 'Binance' ELSE 'Web3' END AS method,
              destination,
              CASE status WHEN 'تم' THEN 'معتمد' WHEN 'مرفوض' THEN 'مرفوض' ELSE 'قيد المراجعة' END AS status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM vr_withdrawals ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT 'CMP-' || id::text AS id, id::text AS "campaignId", owner_id::float8 AS "userId", title,
              CASE platform WHEN 'youtube' THEN 'YouTube' WHEN 'tiktok' THEN 'TikTok' ELSE 'Telegram' END AS platform,
              link AS "videoUrl", duration,
              COALESCE(campaign_budget, price)::float8 AS budget,
              COALESCE(campaign_budget, price)::float8 AS price,
              target_count AS "targetCount", requested_views AS "requestedViews",
              completed_count AS "completedCount", views::float8 AS views,
              CASE status WHEN 'نشط' THEN 'نشطة' WHEN 'موقوف' THEN 'موقوفة' WHEN 'مسودة' THEN 'بانتظار المراجعة' ELSE status END AS status
       FROM vr_campaigns ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT 'PRF-' || comp.campaign_id::text || '-' || comp.user_id::text AS id,
              comp.campaign_id::text AS "campaignId", comp.user_id::float8 AS "userId",
              'TASK-' || comp.campaign_id::text AS "taskId",
              CASE c.platform WHEN 'tiktok' THEN 'متابعة TikTok' ELSE 'اشتراك قناة' END AS "taskType",
              COALESCE(comp.proof_image, '') AS image, comp.reward::float8 AS reward,
              CASE comp.status WHEN 'approved' THEN 'معتمد' WHEN 'rejected' THEN 'مرفوض' ELSE 'قيد المراجعة' END AS status
       FROM vr_completions comp JOIN vr_campaigns c ON c.id = comp.campaign_id
       WHERE comp.proof_image IS NOT NULL
       ORDER BY comp.started_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT 'SIG-' || id::text AS id, user_id::float8 AS "userId", attempt, status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM vr_suspicious_signals ORDER BY created_at DESC LIMIT 1000`,
    ),
    sql.query(
      `SELECT audit.id::text AS id, audit.admin_id::float8 AS "adminId",
              audit.collection, audit.record_id AS "recordId", audit.new_status AS "newStatus",
              to_char(audit.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM vr_admin_audit_log AS audit
       ORDER BY audit.created_at DESC LIMIT 500`,
    ),
    sql.query(`SELECT value::text AS maintenance FROM vr_platform_settings WHERE key = 'maintenance'`),
  ]);
  ok(res, { users, deposits, withdrawals, campaigns, proofs, suspicious, adminAudit, maintenance: settings[0]?.maintenance === 'true' });
}

export async function sendAdminNotification(req, res) {
  const admin = await requireAdmin(req);
  const body = req.body ?? {};
  const title = readText(body.title, 120);
  const message = readText(body.message, 3500);
  if (!title || !message) throw new HttpError(400, 'Invalid notification');

  let recipients;
  if (body.recipientMode === 'all') {
    const rows = await sql.query(`SELECT id::text AS id FROM vr_users WHERE status <> 'محظور' ORDER BY id`);
    recipients = rows.map((row) => row.id);
  } else if (body.recipientMode === 'ids' && Array.isArray(body.userIds)) {
    const suppliedIds = [...new Set(body.userIds.map((id) => String(id).trim()))];
    if (suppliedIds.some((id) => !/^\d{1,20}$/.test(id))) throw new HttpError(400, 'Invalid Telegram IDs');
    const eligible = await sql.query(
      `SELECT id::text AS id FROM vr_users WHERE id = ANY($1::bigint[]) AND status <> 'محظور'`,
      [suppliedIds],
    );
    recipients = eligible.map((row) => row.id);
    if (!recipients.length || recipients.length > 500) throw new HttpError(400, 'Provide between 1 and 500 valid Telegram IDs');
  } else {
    throw new HttpError(400, 'Invalid recipients');
  }

  const buttonText = readText(body.buttonText, 40);
  const buttonUrl = typeof body.buttonUrl === 'string' ? body.buttonUrl.trim() : '';
  let replyMarkup;
  if (Boolean(buttonText) !== Boolean(buttonUrl)) throw new HttpError(400, 'Button text and URL must be provided together');
  if (buttonText && buttonUrl) {
    let parsed;
    try { parsed = new URL(buttonUrl); } catch { throw new HttpError(400, 'Invalid button URL'); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new HttpError(400, 'Invalid button URL');
    replyMarkup = { inline_keyboard: [[{ text: buttonText, url: parsed.toString() }]] };
  }

  let sent = 0;
  let failed = 0;
  const text = `${title}\n\n${message}`;
  for (let offset = 0; offset < recipients.length; offset += 20) {
    const batch = recipients.slice(offset, offset + 20);
    const results = await Promise.all(batch.map(async (chatId) => {
      try {
        return await telegramCall('sendMessage', {
          chat_id: chatId,
          text,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
      } catch {
        return null;
      }
    }));
    sent += results.filter(Boolean).length;
    failed += results.filter((result) => !result).length;
  }
  await recordAdminAction(admin.id, 'notifications', 'broadcast', `sent:${sent};failed:${failed}`);
  ok(res, { targeted: recipients.length, sent, failed });
}

export async function setMaintenance(req, res) {
  const admin = await requireAdmin(req);
  if (typeof req.body?.enabled !== 'boolean') throw new HttpError(400, 'Invalid maintenance setting');
  const rows = await sql.query(
    `INSERT INTO vr_platform_settings (key, value, updated_at)
     VALUES ('maintenance', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING value::text AS value`,
    [JSON.stringify(req.body.enabled)],
  );
  await recordAdminAction(admin.id, 'settings', 'maintenance', req.body.enabled ? 'enabled' : 'disabled');
  ok(res, { maintenance: rows[0]?.value === 'true' });
}

export async function adminAction(req, res, collection, id) {
  const admin = await requireAdmin(req);
  const body = req.body ?? {};
  const status = readText(body.status, 40);

  if (collection === 'users') {
    const userId = readPositiveInteger(id, Number.MAX_SAFE_INTEGER);
    if (!userId) throw new HttpError(400, 'Invalid request');
    const hasStatus = Object.hasOwn(body, 'status');
    const advertiserBalance = Object.hasOwn(body, 'advertiserBalance') ? readMoney(body.advertiserBalance, 0, 100000000) : undefined;
    const earnedBalance = Object.hasOwn(body, 'earnedBalance') ? readMoney(body.earnedBalance, 0, 100000000) : undefined;
    const fullName = Object.hasOwn(body, 'name') ? readText(body.name, 160) : undefined;
    const [firstName, ...lastNameParts] = fullName?.split(/\s+/) ?? [];
    const lastName = fullName ? (lastNameParts.join(' ') || null) : undefined;
    const username = Object.hasOwn(body, 'username')
      ? (body.username === '' ? '' : readText(body.username, 64)?.replace(/^@/, '') ?? null)
      : undefined;
    if ((hasStatus && !['نشط', 'محظور'].includes(status))
      || (Object.hasOwn(body, 'advertiserBalance') && advertiserBalance === null)
      || (Object.hasOwn(body, 'earnedBalance') && earnedBalance === null)
      || (Object.hasOwn(body, 'name') && !firstName)
      || (Object.hasOwn(body, 'username') && username === null)
      || (!hasStatus && advertiserBalance === undefined && earnedBalance === undefined && firstName === undefined && username === undefined)) {
      throw new HttpError(400, 'Invalid request');
    }
    const rows = await sql.query(
      `UPDATE vr_users SET
         status = COALESCE($2, status),
         advertiser_balance = COALESCE($3, advertiser_balance),
         earned_balance = COALESCE($4, earned_balance),
         first_name = COALESCE($5, first_name),
         last_name = CASE WHEN $5 IS NOT NULL THEN $6 ELSE last_name END,
         username = COALESCE($7, username)
       WHERE id = $1 RETURNING id::float8 AS id`,
      [userId, hasStatus ? status : null, advertiserBalance ?? null, earnedBalance ?? null, firstName ?? null, lastName ?? null, username ?? null],
    );
    if (!rows.length) throw new HttpError(404, 'Not found');
    await recordAdminAction(admin.id, collection, id, hasStatus ? status : 'updated');
    ok(res, { id: rows[0].id });
    return;
  }

  if (collection === 'withdrawals') {
    if (!['معتمد', 'مرفوض'].includes(status)) throw new HttpError(400, 'Invalid request');
    const stored = status === 'معتمد' ? 'تم' : 'مرفوض';
    const rows = await sql.query(
      `WITH updated AS (
         UPDATE vr_withdrawals SET status = $2,
           blockchain_tx_id = COALESCE($3, blockchain_tx_id)
         WHERE id = $1 AND status = 'قيد المعالجة'
         RETURNING user_id, amount
       ), refund AS (
         UPDATE vr_users SET earned_balance = earned_balance + (SELECT amount FROM updated)
         WHERE $2 = 'مرفوض' AND id = (SELECT user_id FROM updated)
         RETURNING id
       )
       SELECT user_id::float8 AS "userId" FROM updated`,
      [id, stored, readText(body.txId, 200)],
    );
    if (!rows.length) throw new HttpError(409, 'Request already processed');
    await recordAdminAction(admin.id, collection, id, status);
    ok(res, { id });
    return;
  }

  if (collection === 'deposits') {
    if (!['ناجح', 'فاشل'].includes(status)) throw new HttpError(400, 'Invalid request');
    if (status === 'ناجح') {
      const rows = await sql.query(
        `WITH updated AS (
           UPDATE vr_deposits SET status = 'تم', credited = TRUE, blockchain_tx_id = COALESCE($2, blockchain_tx_id)
           WHERE id = $1 AND credited = FALSE
           RETURNING user_id, amount
         ), credit AS (
           UPDATE vr_users SET advertiser_balance = advertiser_balance + (SELECT amount FROM updated)
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
           UPDATE vr_deposits SET status = 'تم الإلغاء', reason = COALESCE($2, reason), credited = FALSE
           WHERE id = $1
           RETURNING user_id, amount, (SELECT credited FROM vr_deposits WHERE id = $1) AS was_credited
         ), reverse AS (
           UPDATE vr_users SET advertiser_balance = GREATEST(0, advertiser_balance - (SELECT amount FROM updated))
           WHERE id = (SELECT user_id FROM updated) AND (SELECT was_credited FROM updated)
           RETURNING id
         )
         SELECT user_id::float8 AS "userId" FROM updated`,
        [id, readText(body.reason, 300)],
      );
      if (!rows.length) throw new HttpError(404, 'Not found');
    }
    await recordAdminAction(admin.id, collection, id, status);
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
         UPDATE vr_completions SET status = $3, completed_at = now()
         WHERE campaign_id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING reward, user_id
       ), credit AS (
         UPDATE vr_users SET earned_balance = earned_balance + (SELECT reward FROM updated)
         WHERE $3 = 'approved' AND id = (SELECT user_id FROM updated)
         RETURNING id
       ), bump AS (
         UPDATE vr_campaigns SET completed_count = completed_count + 1
         WHERE $3 = 'approved' AND id = $1 AND EXISTS (SELECT 1 FROM updated)
         RETURNING id
       )
       SELECT user_id::float8 AS "userId" FROM updated`,
      [match[1], match[2], next],
    );
    if (!rows.length) throw new HttpError(409, 'Proof already reviewed');
    await recordAdminAction(admin.id, collection, id, status);
    ok(res, { id });
    return;
  }

  if (collection === 'campaigns') {
    const match = /^CMP-(\d+)$/.exec(id);
    const mapped = { 'نشطة': 'نشط', 'موقوفة': 'موقوف', 'مرفوضة': 'موقوف', 'أوقفتها الميزانية': 'موقوف' }[status];
    if (!match || !mapped) throw new HttpError(400, 'Invalid request');
    const rows = await sql.query(`UPDATE vr_campaigns SET status = $2 WHERE id = $1 RETURNING id::text AS id`, [match[1], mapped]);
    if (!rows.length) throw new HttpError(404, 'Not found');
    await recordAdminAction(admin.id, collection, id, status);
    ok(res, { id });
    return;
  }

  if (collection === 'suspicious') {
    const match = /^SIG-(\d+)$/.exec(id);
    if (!match || !['مفتوح', 'تمت المراجعة'].includes(status)) throw new HttpError(400, 'Invalid request');
    const rows = await sql.query(`UPDATE vr_suspicious_signals SET status = $2 WHERE id = $1 RETURNING id`, [match[1], status]);
    if (!rows.length) throw new HttpError(404, 'Not found');
    await recordAdminAction(admin.id, collection, id, status);
    ok(res, { id });
    return;
  }

  throw new HttpError(404, 'Not found');
}
