import { createHmac, timingSafeEqual } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const TELEGRAM_TIMEOUT_MS = 8_000;
let pool;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getPool() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ApiError(503, "Database is not configured.");
  }
  pool ??= new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  return pool;
}

function apiPath(req) {
  const url = new URL(req.url || "/api", `http://${req.headers.host || "localhost"}`);
  const rewrittenPath = url.searchParams.get("route");
  if (rewrittenPath) return `/${rewrittenPath.replace(/^\/+/, "")}`;
  return url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

function requestBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function verifyTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new ApiError(503, "Telegram authentication is not configured.");
  if (typeof initData !== "string" || !initData || initData.length > 10_000) {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }

  const parameters = new URLSearchParams(initData);
  const suppliedHash = parameters.get("hash");
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }

  const dataCheckString = [...parameters.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actualHash = Buffer.from(suppliedHash, "hex");
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }

  const authDate = Number(parameters.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(authDate)
    || authDate > now + 60
    || now - authDate > INIT_DATA_MAX_AGE_SECONDS
  ) {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }

  let telegramUser;
  try {
    telegramUser = JSON.parse(parameters.get("user") || "null");
  } catch {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }
  const rawId = telegramUser?.id;
  const telegramId = typeof rawId === "number" && Number.isSafeInteger(rawId) && rawId > 0
    ? String(rawId)
    : typeof rawId === "string" && /^\d{1,20}$/.test(rawId)
      ? rawId
      : null;
  if (!telegramId || typeof telegramUser.first_name !== "string" || !telegramUser.first_name.trim()) {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }

  const numericId = Number(telegramId);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new ApiError(401, "Telegram initData is invalid or expired.");
  }

  return {
    telegramId: numericId,
    firstName: telegramUser.first_name,
    lastName: typeof telegramUser.last_name === "string" ? telegramUser.last_name : null,
    username: typeof telegramUser.username === "string" ? telegramUser.username : null,
    photoUrl: typeof telegramUser.photo_url === "string" ? telegramUser.photo_url : null,
  };
}

function getInitDataFromRequest(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("tma ")) {
    throw new ApiError(401, "A valid Telegram Mini App session is required.");
  }
  const initData = authorization.slice(4).trim();
  if (!initData) throw new ApiError(401, "A valid Telegram Mini App session is required.");
  return initData;
}

function mapUser(row) {
  return {
    telegramId: Number(row.telegram_id),
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  };
}

function mapCampaign(row) {
  return {
    id: Number(row.id),
    platform: row.platform,
    title: row.title,
    description: row.description,
    link: row.link,
    image: row.image,
    targetCount: row.target_count,
    price: row.price,
    reward: row.reward,
    status: row.status,
    joinedCount: row.joined_count,
    completedCount: row.completed_count,
    createdAt: row.created_at,
  };
}

function mapCompletion(row) {
  return {
    id: Number(row.id),
    telegramId: Number(row.telegram_id),
    campaignId: Number(row.campaign_id),
    status: row.status,
    proofText: row.proof_text,
    proofUrl: row.proof_url,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

async function getAuthenticatedUser(req) {
  const profile = verifyTelegramInitData(getInitDataFromRequest(req));
  const result = await getPool().query(
    `SELECT telegram_id, first_name, last_name, username, photo_url, created_at
       FROM users
      WHERE telegram_id = $1
      LIMIT 1`,
    [profile.telegramId],
  );
  if (!result.rows[0]) {
    throw new ApiError(401, "Register through Telegram before calling this endpoint.");
  }
  return mapUser(result.rows[0]);
}

async function requireAdmin(req) {
  const user = await getAuthenticatedUser(req);
  const adminIds = new Set(
    (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
  );
  if (!adminIds.has(String(user.telegramId))) {
    throw new ApiError(403, "Administrator access is required.");
  }
  return user;
}

async function getWallet(telegramId) {
  const result = await getPool().query(
    `SELECT viewer_balance AS balance, currency
       FROM user_balances
      WHERE telegram_id = $1
      LIMIT 1`,
    [telegramId],
  );
  return result.rows[0] || { balance: "0", currency: "USD" };
}

async function registerTelegramUser(req, res) {
  const initData = requestBody(req).initData;
  const profile = verifyTelegramInitData(initData);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO users (telegram_id, first_name, last_name, username, photo_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         username = EXCLUDED.username,
         photo_url = EXCLUDED.photo_url
       RETURNING telegram_id, first_name, last_name, username, photo_url, created_at`,
      [profile.telegramId, profile.firstName, profile.lastName, profile.username, profile.photoUrl],
    );
    await client.query(
      `INSERT INTO user_balances (telegram_id) VALUES ($1)
       ON CONFLICT (telegram_id) DO NOTHING`,
      [profile.telegramId],
    );
    await client.query("COMMIT");
    res.status(200).json({ user: mapUser(result.rows[0]), ...(await getWallet(profile.telegramId)) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getTasks(user, res) {
  const result = await getPool().query(
    `SELECT c.id, c.platform, c.title, c.description, c.link, c.image,
            c.target_count, c.price, c.reward, c.status, c.joined_count,
            c.completed_count, c.created_at, tc.status AS completion_status
       FROM campaigns c
       LEFT JOIN task_completions tc
         ON tc.campaign_id = c.id AND tc.telegram_id = $1
      WHERE c.status = 'نشط' AND c.target_count > c.completed_count
      ORDER BY c.created_at DESC`,
    [user.telegramId],
  );
  res.json(result.rows.map((row) => ({
    ...mapCampaign(row),
    verificationMethod: row.platform === "telegram" ? "telegram_membership" : "manual",
    completionStatus: row.completion_status,
  })));
}

function resolvePublicTelegramChatId(link) {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || (host !== "t.me" && host !== "telegram.me")) return null;
    const [username] = url.pathname.split("/").filter(Boolean);
    if (!username || username.startsWith("+") || username === "c") return null;
    const normalizedUsername = decodeURIComponent(username).replace(/^@/, "");
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalizedUsername)
      ? `@${normalizedUsername}`
      : null;
  } catch {
    return null;
  }
}

async function telegramCall(method, payload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new ApiError(503, "Telegram membership verification is not configured.");
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, "Telegram could not verify this request right now.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true || result.result === undefined) {
    throw new ApiError(502, "Telegram could not verify this request right now.");
  }
  return result.result;
}

async function checkTelegramMembership(chatId, telegramId) {
  const member = await telegramCall("getChatMember", { chat_id: chatId, user_id: telegramId });
  return ["creator", "administrator", "member"].includes(member.status || "")
    || (member.status === "restricted" && member.is_member === true);
}

async function completeTask(req, res, user, campaignId) {
  if (!/^[1-9]\d{0,15}$/.test(campaignId) || !Number.isSafeInteger(Number(campaignId))) {
    throw new ApiError(400, "Invalid task id.");
  }
  const campaignResult = await getPool().query(
    "SELECT * FROM campaigns WHERE id = $1 LIMIT 1",
    [Number(campaignId)],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign || campaign.status !== "نشط") throw new ApiError(404, "Task not found or inactive.");

  let status = "pending";
  let proofText = null;
  let proofUrl = null;
  if (campaign.platform === "telegram") {
    const chatId = resolvePublicTelegramChatId(campaign.link);
    if (!chatId) {
      throw new ApiError(503, "This task does not have a verifiable public Telegram channel link.");
    }
    if (!await checkTelegramMembership(chatId, user.telegramId)) {
      throw new ApiError(403, "Join the Telegram channel before completing this task.");
    }
    status = "approved";
  } else if (campaign.platform === "tiktok") {
    const body = requestBody(req);
    proofText = typeof body.proofText === "string" ? body.proofText.trim() : null;
    proofUrl = typeof body.proofUrl === "string" ? body.proofUrl.trim() : null;
    if (proofText) {
      if (proofText.length > 4_000) throw new ApiError(400, "Proof text is too long.");
    } else {
      proofText = null;
    }
    if (proofUrl) {
      try {
        const url = new URL(proofUrl);
        if (url.protocol !== "https:" || proofUrl.length > 2_048) throw new Error("invalid_url");
      } catch {
        throw new ApiError(400, "Proof URLs must be valid HTTPS URLs.");
      }
    } else {
      proofUrl = null;
    }
    if (!proofText && !proofUrl) throw new ApiError(400, "Provide proofText or proofUrl for a manual task.");
  } else {
    throw new ApiError(503, "This campaign platform is not supported as a task.");
  }

  const client = await getPool().connect();
  let completion;
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT * FROM campaigns WHERE id = $1 FOR UPDATE",
      [Number(campaignId)],
    );
    const lockedCampaign = locked.rows[0];
    if (!lockedCampaign || lockedCampaign.status !== "نشط") {
      throw new ApiError(404, "Task not found or inactive.");
    }
    if (lockedCampaign.completed_count >= lockedCampaign.target_count) {
      throw new ApiError(409, "This task has reached its completion limit.");
    }
    const existingResult = await client.query(
      `SELECT * FROM task_completions
        WHERE telegram_id = $1 AND campaign_id = $2
        FOR UPDATE`,
      [user.telegramId, Number(campaignId)],
    );
    const existing = existingResult.rows[0];
    if (existing && ["pending", "approved"].includes(existing.status)) {
      throw new ApiError(409, "This task is already submitted or completed.");
    }

    if (existing) {
      const updated = await client.query(
        `UPDATE task_completions
            SET status = $2, proof_text = $3, proof_url = $4,
                review_note = NULL, reviewed_at = $5
          WHERE id = $1
          RETURNING *`,
        [existing.id, status, proofText, proofUrl, status === "approved" ? new Date() : null],
      );
      completion = updated.rows[0];
    } else {
      const created = await client.query(
        `INSERT INTO task_completions
           (telegram_id, campaign_id, status, proof_text, proof_url, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user.telegramId, Number(campaignId), status, proofText, proofUrl, status === "approved" ? new Date() : null],
      );
      completion = created.rows[0];
      await client.query(
        "UPDATE campaigns SET joined_count = joined_count + 1 WHERE id = $1",
        [Number(campaignId)],
      );
    }

    if (status === "approved") {
      await client.query(
        "UPDATE campaigns SET completed_count = completed_count + 1 WHERE id = $1",
        [Number(campaignId)],
      );
      const balance = await client.query(
        `UPDATE user_balances
            SET viewer_balance = viewer_balance + $2, updated_at = now()
          WHERE telegram_id = $1
          RETURNING currency`,
        [user.telegramId, lockedCampaign.reward],
      );
      if (!balance.rows[0]) throw new Error("User balance was not initialized.");
      await client.query(
        `INSERT INTO wallet_transactions
           (telegram_id, task_completion_id, amount, currency, reason)
         VALUES ($1, $2, $3, $4, 'task_reward')
         ON CONFLICT (task_completion_id) DO NOTHING`,
        [user.telegramId, completion.id, lockedCampaign.reward, balance.rows[0].currency],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  res.status(201).json({ completion: mapCompletion(completion), ...(await getWallet(user.telegramId)) });
}

function validHttpsUrl(value, maxLength = 2_048) {
  if (typeof value !== "string" || value.length > maxLength) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function multiplyAmount(amount, multiplier) {
  const [whole, fraction = ""] = amount.split(".");
  const scale = fraction.length;
  const scaled = BigInt(`${whole}${fraction.padEnd(scale, "0")}`) * BigInt(multiplier);
  if (!scale) return scaled.toString();
  const digits = scaled.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

async function createTask(req, res) {
  const body = requestBody(req);
  const platform = body.platform;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const link = body.link;
  const image = body.image;
  const targetCount = body.targetCount;
  const reward = typeof body.reward === "string" ? body.reward : "";
  if (
    !["telegram", "tiktok"].includes(platform)
    || title.length < 3
    || title.length > 120
    || description.length > 2_000
    || !validHttpsUrl(link)
    || (image !== undefined && !validHttpsUrl(image))
    || !Number.isInteger(targetCount)
    || targetCount < 1
    || targetCount > 1_000_000
    || !/^\d{1,8}(?:\.\d{1,4})?$/.test(reward)
    || Number(reward) <= 0
  ) {
    throw new ApiError(400, "Invalid task details.");
  }

  if (platform === "telegram") {
    const chatId = resolvePublicTelegramChatId(link);
    if (!chatId) throw new ApiError(400, "Automatic Telegram tasks need a public t.me channel link.");
    const bot = await telegramCall("getMe", {});
    const membership = await telegramCall("getChatMember", { chat_id: chatId, user_id: bot.id });
    if (membership.status !== "administrator" && membership.status !== "creator") {
      throw new ApiError(409, "Add the Telegram bot as a channel administrator before creating this task.");
    }
  }

  const price = multiplyAmount(reward, targetCount);
  const result = await getPool().query(
    `INSERT INTO campaigns
       (platform, title, description, link, image, target_count, reward, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'نشط')
     RETURNING *`,
    [platform, title, description, link, image ?? null, targetCount, reward, price],
  );
  res.status(201).json(mapCampaign(result.rows[0]));
}

async function listCompletions(req, res) {
  const url = new URL(req.url || "/api", `http://${req.headers.host || "localhost"}`);
  const status = url.searchParams.get("status");
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    throw new ApiError(400, "Invalid completion status filter.");
  }
  const values = [];
  let filter = "";
  if (status) {
    values.push(status);
    filter = "WHERE tc.status = $1";
  }
  const result = await getPool().query(
    `SELECT tc.*, to_jsonb(c) AS task,
            jsonb_build_object(
              'telegramId', u.telegram_id,
              'username', u.username,
              'firstName', u.first_name,
              'lastName', u.last_name
            ) AS user
       FROM task_completions tc
       INNER JOIN campaigns c ON c.id = tc.campaign_id
       INNER JOIN users u ON u.telegram_id = tc.telegram_id
       ${filter}
      ORDER BY tc.created_at ASC
      LIMIT 100`,
    values,
  );
  res.json(result.rows.map((row) => ({
    completion: mapCompletion(row),
    task: mapCampaign(row.task),
    user: row.user,
  })));
}

async function reviewCompletion(req, res, completionId) {
  if (!/^[1-9]\d{0,15}$/.test(completionId) || !Number.isSafeInteger(Number(completionId))) {
    throw new ApiError(400, "Invalid review request.");
  }
  const body = requestBody(req);
  if (typeof body.approved !== "boolean") throw new ApiError(400, "Invalid review request.");
  const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";
  if (reviewNote.length > 1_000) throw new ApiError(400, "Invalid review request.");

  const client = await getPool().connect();
  let completion;
  let telegramId;
  try {
    await client.query("BEGIN");
    const completionResult = await client.query(
      "SELECT * FROM task_completions WHERE id = $1 FOR UPDATE",
      [Number(completionId)],
    );
    const existing = completionResult.rows[0];
    if (!existing) throw new ApiError(404, "Completion not found.");
    if (existing.status !== "pending") {
      throw new ApiError(409, "Only pending completions can be reviewed.");
    }

    let campaign;
    if (body.approved) {
      const campaignResult = await client.query(
        "SELECT * FROM campaigns WHERE id = $1 FOR UPDATE",
        [existing.campaign_id],
      );
      campaign = campaignResult.rows[0];
      if (!campaign) throw new ApiError(404, "Completion not found.");
      if (campaign.completed_count >= campaign.target_count) {
        throw new ApiError(409, "This task has reached its completion limit.");
      }
    }

    const newStatus = body.approved ? "approved" : "rejected";
    const updated = await client.query(
      `UPDATE task_completions
          SET status = $2, review_note = $3, reviewed_at = now()
        WHERE id = $1
        RETURNING *`,
      [existing.id, newStatus, reviewNote || null],
    );
    completion = updated.rows[0];
    telegramId = Number(existing.telegram_id);

    if (body.approved && campaign) {
      await client.query(
        "UPDATE campaigns SET completed_count = completed_count + 1 WHERE id = $1",
        [campaign.id],
      );
      const balance = await client.query(
        `UPDATE user_balances
            SET viewer_balance = viewer_balance + $2, updated_at = now()
          WHERE telegram_id = $1
          RETURNING currency`,
        [telegramId, campaign.reward],
      );
      if (!balance.rows[0]) throw new Error("User balance was not initialized.");
      await client.query(
        `INSERT INTO wallet_transactions
           (telegram_id, task_completion_id, amount, currency, reason)
         VALUES ($1, $2, $3, $4, 'task_reward')
         ON CONFLICT (task_completion_id) DO NOTHING`,
        [telegramId, completion.id, campaign.reward, balance.rows[0].currency],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  res.json({ completion: mapCompletion(completion), ...(await getWallet(telegramId)) });
}

async function dispatch(req, res) {
  const path = apiPath(req).replace(/\/+$/, "") || "/";
  const method = (req.method || "GET").toUpperCase();

  if (path === "/healthz" && method === "GET") {
    return res.status(200).json({ ok: true });
  }
  if (path === "/neon-check" && method === "GET") {
    await getPool().query("SELECT 1");
    return res.status(200).json({ ok: true, database: "connected" });
  }
  if (path === "/auth/telegram" && method === "POST") {
    return registerTelegramUser(req, res);
  }
  if (path === "/me" && method === "GET") {
    const user = await getAuthenticatedUser(req);
    return res.json({ user, ...(await getWallet(user.telegramId)) });
  }
  if (path === "/wallet/transactions" && method === "GET") {
    const user = await getAuthenticatedUser(req);
    const result = await getPool().query(
      `SELECT id, amount, currency, reason, created_at
         FROM wallet_transactions
        WHERE telegram_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [user.telegramId],
    );
    return res.json(result.rows.map((row) => ({
      id: Number(row.id),
      amount: row.amount,
      currency: row.currency,
      reason: row.reason,
      createdAt: row.created_at,
    })));
  }
  if (path === "/tasks" && method === "GET") {
    return getTasks(await getAuthenticatedUser(req), res);
  }
  const completionRoute = path.match(/^\/tasks\/([1-9]\d{0,15})\/complete$/);
  if (completionRoute && method === "POST") {
    return completeTask(req, res, await getAuthenticatedUser(req), completionRoute[1]);
  }
  if (path === "/admin/tasks" && method === "POST") {
    await requireAdmin(req);
    return createTask(req, res);
  }
  if (path === "/admin/completions" && method === "GET") {
    await requireAdmin(req);
    return listCompletions(req, res);
  }
  const reviewRoute = path.match(/^\/admin\/completions\/([1-9]\d{0,15})\/review$/);
  if (reviewRoute && method === "POST") {
    await requireAdmin(req);
    return reviewCompletion(req, res, reviewRoute[1]);
  }
  if (
    path === "/auth/telegram"
    || path === "/me"
    || path === "/wallet/transactions"
    || path === "/tasks"
    || completionRoute
    || path === "/admin/tasks"
    || path === "/admin/completions"
    || reviewRoute
  ) {
    res.setHeader("Allow", path === "/tasks" ? "GET" : path === "/me" || path === "/wallet/transactions" ? "GET" : "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  return res.status(404).json({ error: "API route not found." });
}

export default async function handler(req, res) {
  try {
    await dispatch(req, res);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("API request failed", {
      path: apiPath(req),
      code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
    });
    return res.status(500).json({ error: "Internal server error." });
  }
}
