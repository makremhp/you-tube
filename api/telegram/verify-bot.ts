import { createHmac, timingSafeEqual } from "node:crypto";

type VerifyRequest = {
  method?: string;
  body?: unknown;
};

type VerifyBody = {
  action?: unknown;
  channelUrl?: unknown;
  initData?: unknown;
};

type VerifyResponse = {
  status: (code: number) => VerifyResponse;
  json: (body: unknown) => void;
};

type TelegramResult<T> = {
  ok?: boolean;
  result?: T;
  description?: string;
};

type TelegramChat = {
  id: number;
  title?: string;
  username?: string;
};

type TelegramUser = {
  id: number;
  username?: string;
};

type TelegramMember = {
  status: string;
  is_member?: boolean;
};

const TELEGRAM_API = "https://api.telegram.org";
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

function parsePublicChannel(value: unknown) {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host !== "t.me" && host !== "telegram.me" && host !== "www.t.me") return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return null;
    const username = decodeURIComponent(segments[0]).replace(/^@/, "");
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) ? `@${username}` : null;
  } catch {
    return null;
  }
}

function verifiedTelegramUserId(initData: unknown, botToken: string) {
  if (typeof initData !== "string" || !initData || initData.length > 10_000) return null;
  const parameters = new URLSearchParams(initData);
  const suppliedHash = parameters.get("hash");
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) return null;

  const dataCheckString = [...parameters.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actualHash = Buffer.from(suppliedHash, "hex");
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) return null;

  const authDate = Number(parameters.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(parameters.get("user") ?? "null") as { id?: unknown } | null;
    return user && Number.isSafeInteger(user.id) && Number(user.id) > 0 ? Number(user.id) : null;
  } catch {
    return null;
  }
}

async function telegramCall<T>(botToken: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as TelegramResult<T>;
  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(data.description ?? "Telegram API request failed");
  }
  return data.result;
}

function publicTelegramError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("unauthorized")) {
    return "لم يقبل Telegram توكن البوت المضبوط على الخادم. راجع TELEGRAM_BOT_TOKEN.";
  }
  if (message.includes("chat not found") || message.includes("username not found")) {
    return "لم يعثر Telegram على القناة. استخدم رابط قناة عامة وأضف البوت إليها مشرفًا.";
  }
  return "تعذر التواصل مع Telegram. تحقق من التوكن ورابط القناة وصلاحيات البوت ثم أعد المحاولة.";
}

export default async function handler(req: VerifyRequest, res: VerifyResponse) {
  if (req.method && req.method !== "POST") {
    res.status(405).json({ message: "استخدم طلب POST." });
    return;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(503).json({ message: "التحقق غير مفعّل بعد. أضف TELEGRAM_BOT_TOKEN إلى أسرار الخادم." });
    return;
  }

  const body: VerifyBody | undefined = typeof req.body === "string"
    ? (() => { try { return JSON.parse(req.body) as VerifyBody; } catch { return undefined; } })()
    : req.body && typeof req.body === "object"
      ? req.body as VerifyBody
      : undefined;
  const action = body?.action;
  const chatId = parsePublicChannel(body?.channelUrl);
  if (!chatId) {
    res.status(400).json({ message: "أدخل رابط قناة Telegram عامة مثل https://t.me/yourchannel." });
    return;
  }
  if (action !== "verify-bot" && action !== "verify-member") {
    res.status(400).json({ message: "نوع التحقق غير صالح." });
    return;
  }

  const userId = action === "verify-member" ? verifiedTelegramUserId(body?.initData, botToken) : null;
  if (action === "verify-member" && !userId) {
    res.status(401).json({ message: "تعذر التحقق من جلسة Telegram. أعد فتح التطبيق من Telegram ثم حاول مجددًا." });
    return;
  }

  try {
    const bot = await telegramCall<TelegramUser>(botToken, "getMe", {});
    const chat = await telegramCall<TelegramChat>(botToken, "getChat", { chat_id: chatId });
    const botMembership = await telegramCall<TelegramMember>(botToken, "getChatMember", {
      chat_id: chat.id,
      user_id: bot.id,
    });
    if (botMembership.status !== "administrator" && botMembership.status !== "creator") {
      res.status(403).json({ message: "أضف البوت مشرفًا في القناة حتى يتمكن Telegram من التحقق من الاشتراكات." });
      return;
    }

    if (action === "verify-bot") {
      res.status(200).json({
        verified: true,
        botUsername: bot.username ?? "bot",
        channelTitle: chat.title ?? chat.username ?? "القناة",
      });
      return;
    }

    const member = await telegramCall<TelegramMember>(botToken, "getChatMember", {
      chat_id: chat.id,
      user_id: userId,
    });
    const isMember = ["creator", "administrator", "member"].includes(member.status)
      || (member.status === "restricted" && member.is_member === true);
    res.status(200).json({ member: isMember, membershipStatus: member.status });
  } catch (error) {
    res.status(502).json({ message: publicTelegramError(error) });
  }
}