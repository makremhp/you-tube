import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql, ensureSchema } from "../../server/db.js";
import { telegramRequest } from "../../server/auth.js";

const MAX_CAPTION_LENGTH = 1024;
const IMAGE_DIRECTORY = join(process.cwd(), "api", "telegram", "images");
let cachedBotUsername = null;
let botUsernameLookup = null;
let botUsernameCheckedAt = 0;
const DEFAULT_SAMPLE = Object.freeze({
  firstName: "أحمد",
  username: "ahmad_creator",
  amount: "12.50",
  currency: "USDT",
  method: "Polygon",
  address: "0x1234…89ab",
  requestId: "WDR-2026-001",
  taskId: "204",
  campaignId: "31",
  taskTitle: "متابعة قناة VidReward",
  campaignTitle: "حملة صيفية",
  platform: "Telegram",
  reward: "0.003",
  date: "2026-10-11",
  status: "قيد المعالجة",
  reason: "لم يطابق الإثبات المتطلبات",
  transactionId: "0x8f2c…a912",
  referralUsername: "@new_member",
  proofId: "PUB-81",
  deepLinkPayload: "home",
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const valueOr = (value, fallback = "—") => value === undefined || value === null || value === "" ? fallback : value;

function htmlLine(label, value, code = false) {
  const safeValue = escapeHtml(valueOr(value));
  return `${escapeHtml(label)}: ${code ? `<code>${safeValue}</code>` : `<b>${safeValue}</b>`}`;
}

// ---------------------------------------------------------------------------
// Notification card layout (Telegram HTML only: <b>, <i>, <code>, <a>)
//
//   {icon} <b>Title</b>
//   Short reason for the notification
//
//   Label: <b>value</b>          <- details (bold values; IDs, amounts, addresses in <code> so they can be copied)
//
//   Status: <b>value</b>         <- status / outcome
//
//   <i>Short closing note</i>    <- only when it adds something
//
// Every dynamic value goes through escapeHtml(); titles, intros and footers are escaped here too.
// ---------------------------------------------------------------------------
const STATUS_EN = Object.freeze({
  "قيد المعالجة": "Processing", "تم": "Completed", "تم التأكيد": "Confirmed",
  "مرفوض": "Declined", "مرفوضة": "Rejected", "موقوف": "Paused", "نشط": "Active",
  "مكتمل": "Completed", "قيد المراجعة": "Under review", "معتمد": "Approved",
  "تم الإلغاء": "Cancelled", "بانتظار تحقق البوت": "Waiting for bot verification",
});
const STATUS_TONES = Object.freeze({
  pending: ["قيد المعالجة", "قيد المراجعة", "بانتظار تحقق البوت", "Processing", "Under review", "Waiting for bot verification"],
  success: ["تم", "تم التأكيد", "نشط", "مكتمل", "معتمد", "Completed", "Confirmed", "Active", "Approved"],
  failure: ["مرفوض", "مرفوضة", "تم الإلغاء", "Declined", "Rejected", "Cancelled"],
  attention: ["موقوف", "Paused"],
});

function statusTone(value, fallback = "info") {
  const text = String(value ?? "").trim();
  for (const [tone, names] of Object.entries(STATUS_TONES)) {
    if (names.includes(text)) return tone;
  }
  return fallback;
}

// `tone` is kept for call-site compatibility; the card has no coloured indicator.
function statusLine(tone, label, value) {
  return `${escapeHtml(label)}: <b>${escapeHtml(valueOr(value))}</b>`;
}

// Status coming from the database/caller: localise known Arabic values for English users
// and pick the indicator colour from the actual status text.
function dynamicStatus(lang, label, value, fallbackTone = "info") {
  const text = valueOr(value);
  return statusLine(statusTone(text, fallbackTone), label, lang === "en" ? STATUS_EN[text] ?? text : text);
}

function amountText(amount, currency) {
  if (amount === undefined || amount === null || amount === "") return "";
  return `${amount} ${String(currency ?? "")}`.trim();
}

// Plain "YYYY-MM-DDTHH:MM:SS.sssZ" timestamps become "YYYY-MM-DD HH:MM UTC"; anything else is left as is.
function formatDate(value) {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?Z$/.exec(raw);
  return match ? `${match[1]} ${match[2]} UTC` : raw;
}

function safeHttpsUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 500 || /\s/.test(raw)) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// Optional clickable line; renders nothing unless the caller supplies a valid https URL.
function linkLine(label, url, text) {
  const safeUrl = safeHttpsUrl(url);
  return safeUrl ? `${escapeHtml(label)}: <a href="${escapeHtml(safeUrl)}"><b>${escapeHtml(text)}</b></a>` : null;
}

// fields: a flat array of lines, or an array of groups (arrays) separated by a blank line.
// Falsy entries are skipped so optional lines can be written inline.
function card({ icon, title, intro, fields = [], status, footer, spaced = false }) {
  const groups = (Array.isArray(fields[0]) ? fields : [fields])
    .map((group) => group.filter(Boolean).join("\n"))
    .filter(Boolean);
  const blocks = [];
  if (intro) blocks.push(escapeHtml(intro));
  blocks.push(...groups);
  if (status) blocks.push(status);
  let text = `${icon} <b>${escapeHtml(title)}</b>${spaced ? "\n\n" : "\n"}${blocks.join("\n\n")}`;
  if (footer) text += `\n\n<i>${escapeHtml(footer)}</i>`;
  return text;
}

async function resolveBotUsername() {
  const configured = String(process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(configured)) return configured;
  if (Date.now() - botUsernameCheckedAt < 5 * 60 * 1000) return cachedBotUsername;
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  if (!botUsernameLookup) {
    botUsernameCheckedAt = Date.now();
    botUsernameLookup = telegramRequest("getMe", {}).then((response) => {
      const username = String(response.ok ? response.result?.username ?? "" : "");
      cachedBotUsername = /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) ? username : null;
      return cachedBotUsername;
    }).catch(() => null).finally(() => { botUsernameLookup = null; });
  }
  return botUsernameLookup;
}

function pageLink(payload = "home", botUsername = null) {
  const username = botUsername ?? String(process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");
  const safePayload = /^[A-Za-z0-9_-]{1,64}$/.test(String(payload)) ? String(payload) : "home";
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) return null;
  const shortName = String(process.env.TELEGRAM_WEBAPP_SHORT_NAME ?? "ads");
  const validShortName = /^[A-Za-z0-9_-]{1,64}$/.test(shortName) ? shortName : "ads";
  // The app still verifies Telegram initData; startapp only selects a safe in-app destination.
  return `https://t.me/${username}/${validShortName}?startapp=${encodeURIComponent(safePayload)}`;
}

const openBotButton = (language, payload, username) => ({
  text: language === "ar" ? "فتح VidReward" : "Open VidReward",
  url: pageLink(payload, username),
});

function template({
  id, category, image, title, description, sample = {}, buttonPayload = "home", render,
}) {
  return { id, category, image, title, description, sample: { ...DEFAULT_SAMPLE, ...sample }, buttonPayload, render };
}

const templates = [
  template({
    id: "withdrawal_requested", category: "users", image: "sheet1-r1-c1.jpg",
    title: { ar: "استلام طلب السحب", en: "Withdrawal request received" },
    description: { ar: "بعد إنشاء طلب السحب وحفظه بحالة قيد المعالجة.", en: "After a withdrawal request is saved as processing." },
    sample: { status: "قيد المعالجة" }, buttonPayload: "withdrawals",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "💸", title: "تم استلام طلب السحب",
        intro: "سُجّل طلب السحب الخاص بك بنجاح.",
        fields: [
          htmlLine("المبلغ", amountText(v.amount, v.currency), true),
          htmlLine("الطريقة", v.method),
          htmlLine("العنوان", v.address, true),
          htmlLine("رقم الطلب", v.requestId, true),
        ],
        status: dynamicStatus("ar", "الحالة", v.status, "pending"),
        footer: "سنُعلمك عند تغيّر حالة الطلب.",
      })
      : card({
        icon: "💸", title: "Withdrawal request received",
        intro: "Your withdrawal request has been recorded.",
        fields: [
          htmlLine("Amount", amountText(v.amount, v.currency), true),
          htmlLine("Method", v.method),
          htmlLine("Address", v.address, true),
          htmlLine("Request ID", v.requestId, true),
        ],
        status: dynamicStatus("en", "Status", v.status, "pending"),
        footer: "We'll notify you when the status changes.",
      }),
  }),
  template({
    id: "withdrawal_approved", category: "users", image: "sheet1-r3-c2.jpg",
    title: { ar: "تحديث طلب السحب", en: "Withdrawal status updated" },
    description: { ar: "بعد تغيير حالة الطلب في قاعدة البيانات؛ لا يدّعي الدفع عند غياب مرجع معاملة.", en: "After the database status changes; no payment claim is made without a transaction reference." },
    buttonPayload: "withdrawals",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "💸", title: "تحديث حالة السحب",
        intro: "تم تحديث حالة طلب السحب الخاص بك.",
        fields: [
          htmlLine("المبلغ", amountText(v.amount, v.currency), true),
          htmlLine("الطريقة", v.method),
          v.transactionId ? htmlLine("مرجع المعاملة", v.transactionId, true) : null,
          linkLine("رابط المعاملة", v.transactionUrl, "عرض المعاملة"),
        ],
        status: dynamicStatus("ar", "الحالة", v.status, "success"),
        footer: v.transactionId ? "" : "لم يُسجَّل مرجع معاملة بعد؛ هذا الإشعار لا يؤكد إتمام الدفع.",
      })
      : card({
        icon: "💸", title: "Withdrawal status update",
        intro: "The status of your withdrawal request has been updated.",
        fields: [
          htmlLine("Amount", amountText(v.amount, v.currency), true),
          htmlLine("Method", v.method),
          v.transactionId ? htmlLine("Transaction reference", v.transactionId, true) : null,
          linkLine("Transaction link", v.transactionUrl, "View transaction"),
        ],
        status: dynamicStatus("en", "Status", v.status, "success"),
        footer: v.transactionId ? "" : "No transaction reference is recorded yet; this notice does not confirm payment.",
      }),
  }),
  template({
    id: "withdrawal_rejected", category: "users", image: "sheet1-r3-c1.jpg",
    title: { ar: "رفض طلب السحب", en: "Withdrawal declined" },
    description: { ar: "بعد رفض طلب السحب وإرجاع المبلغ إلى رصيد المستخدم.", en: "After a withdrawal is declined and the amount is returned to the user's balance." },
    buttonPayload: "withdrawals",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "💸", title: "تم رفض طلب السحب",
        intro: "تعذّر تنفيذ طلب السحب، وأُعيد المبلغ إلى رصيدك.",
        fields: [
          htmlLine("المبلغ المُعاد", amountText(v.amount, v.currency), true),
          htmlLine("رقم الطلب", v.requestId, true),
          v.reason ? htmlLine("السبب", v.reason) : null,
        ],
        status: statusLine("failure", "الحالة", "مرفوض"),
      })
      : card({
        icon: "💸", title: "Withdrawal request declined",
        intro: "We couldn't process your withdrawal, and the amount was returned to your balance.",
        fields: [
          htmlLine("Amount returned", amountText(v.amount, v.currency), true),
          htmlLine("Request ID", v.requestId, true),
          v.reason ? htmlLine("Reason", v.reason) : null,
        ],
        status: statusLine("failure", "Status", "Declined"),
      }),
  }),
  template({
    id: "payment_proof_admin", category: "admin", image: "sheet1-r1-c3.jpg",
    title: { ar: "تقرير مرجع السحب", en: "Withdrawal reference report" },
    description: { ar: "يُرسل إلى قناة الإدارة فقط عند تسجيل مرجع معاملة في قاعدة البيانات.", en: "Sent only to the admin channel when a transaction reference is stored." },
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "🧾", title: "مرجع سحب مسجّل",
        intro: "سُجّل مرجع معاملة لطلب سحب.",
        fields: [
          [
            htmlLine("المستخدم", v.firstName),
            htmlLine("Telegram", v.username),
            htmlLine("Telegram ID", v.telegramId, true),
          ],
          [
            htmlLine("المبلغ", amountText(v.amount, v.currency), true),
            htmlLine("الطريقة", v.method),
            htmlLine("العنوان", v.address, true),
            htmlLine("رقم الطلب", v.requestId, true),
          ],
          [
            htmlLine("مرجع المعاملة", v.transactionId, true),
            linkLine("رابط المعاملة", v.transactionUrl, "عرض المعاملة"),
            htmlLine("وقت التسجيل", formatDate(v.date)),
          ],
        ],
        status: statusLine("info", "الحالة", "مرجع مسجّل"),
        footer: "أُدخل هذا المرجع في النظام ولم يتم التحقق منه بشكل مستقل على الشبكة.",
      })
      : card({
        icon: "🧾", title: "Withdrawal reference recorded",
        intro: "A transaction reference was recorded for a withdrawal.",
        fields: [
          [
            htmlLine("User", v.firstName),
            htmlLine("Telegram", v.username),
            htmlLine("Telegram ID", v.telegramId, true),
          ],
          [
            htmlLine("Amount", amountText(v.amount, v.currency), true),
            htmlLine("Method", v.method),
            htmlLine("Address", v.address, true),
            htmlLine("Request ID", v.requestId, true),
          ],
          [
            htmlLine("Transaction reference", v.transactionId, true),
            linkLine("Transaction link", v.transactionUrl, "View transaction"),
            htmlLine("Recorded at", formatDate(v.date)),
          ],
        ],
        status: statusLine("info", "Status", "Reference recorded"),
        footer: "This reference was entered in the system; it has not been independently verified on-chain.",
      }),
  }),
  template({
    id: "deposit_requested", category: "advertisers", image: "sheet2-r1-c1.jpg",
    title: { ar: "استلام طلب الإيداع", en: "Deposit request received" },
    description: { ar: "بعد حفظ طلب الإيداع، قبل تأكيده.", en: "After the deposit request is saved, before it is confirmed." },
    sample: { requestId: "DEP-2026-001", status: "قيد المعالجة" }, buttonPayload: "deposit",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "💳", title: "تم استلام طلب الإيداع",
        intro: "سُجّل طلب الإيداع الخاص بك، وسيُضاف الرصيد بعد التأكيد.",
        fields: [
          htmlLine("المبلغ", amountText(v.amount, v.currency), true),
          htmlLine("الطريقة", v.method),
          htmlLine("رقم الطلب", v.requestId, true),
        ],
        status: dynamicStatus("ar", "الحالة", v.status, "pending"),
        footer: "سنُشعرك فور تأكيد الإيداع.",
      })
      : card({
        icon: "💳", title: "Deposit request received",
        intro: "Your deposit request has been recorded. The balance is added once it's confirmed.",
        fields: [
          htmlLine("Amount", amountText(v.amount, v.currency), true),
          htmlLine("Method", v.method),
          htmlLine("Request ID", v.requestId, true),
        ],
        status: dynamicStatus("en", "Status", v.status, "pending"),
        footer: "We'll notify you as soon as the deposit is confirmed.",
      }),
  }),
  template({
    id: "deposit_confirmed", category: "advertisers", image: "sheet2-r1-c2.jpg",
    title: { ar: "تأكيد الإيداع", en: "Deposit confirmed" },
    description: { ar: "بعد تأكيد الإيداع وإضافة الرصيد في قاعدة البيانات.", en: "After the deposit is confirmed and credited in the database." },
    sample: { status: "تم التأكيد" }, buttonPayload: "deposit",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "💳", title: "تم تأكيد الإيداع",
        intro: "تم تأكيد طلب الإيداع الخاص بك.",
        fields: [
          htmlLine("المبلغ المضاف", amountText(v.amount, v.currency), true),
          htmlLine("الطريقة", v.method),
          htmlLine("رقم الطلب", v.requestId, true),
        ],
        status: statusLine("success", "الحالة", "تم التأكيد"),
        footer: "الرصيد متاح وفق سجل المنصة.",
      })
      : card({
        icon: "💳", title: "Deposit confirmed",
        intro: "Your deposit request has been confirmed.",
        fields: [
          htmlLine("Amount credited", amountText(v.amount, v.currency), true),
          htmlLine("Method", v.method),
          htmlLine("Request ID", v.requestId, true),
        ],
        status: statusLine("success", "Status", "Confirmed"),
        footer: "The balance is available according to the platform ledger.",
      }),
  }),
  template({
    id: "deposit_rejected", category: "advertisers", image: "sheet2-r3-c5.jpg",
    title: { ar: "رفض الإيداع", en: "Deposit declined" },
    description: { ar: "بعد حفظ حالة الإيداع المرفوضة وسببها إن وُجد.", en: "After a deposit is marked declined, with a reason when available." },
    sample: { status: "مرفوض" }, buttonPayload: "deposit-history",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "💳", title: "تعذّر تأكيد الإيداع",
        intro: "لم نتمكن من تأكيد طلب الإيداع.",
        fields: [
          htmlLine("المبلغ", amountText(v.amount, v.currency), true),
          htmlLine("رقم الطلب", v.requestId, true),
          v.reason ? htmlLine("السبب", v.reason) : null,
        ],
        status: statusLine("failure", "الحالة", "مرفوض"),
      })
      : card({
        icon: "💳", title: "Deposit could not be confirmed",
        intro: "We couldn't confirm your deposit request.",
        fields: [
          htmlLine("Amount", amountText(v.amount, v.currency), true),
          htmlLine("Request ID", v.requestId, true),
          v.reason ? htmlLine("Reason", v.reason) : null,
        ],
        status: statusLine("failure", "Status", "Declined"),
      }),
  }),
  template({
    id: "task_available", category: "users", image: "sheet1-r2-c4.jpg",
    title: { ar: "مهمة جديدة متاحة", en: "A new task is available" },
    description: { ar: "عند نشر حملة نشطة ومؤهلة للمستخدمين.", en: "When an active campaign becomes available to users." },
    sample: { taskTitle: "تابع قناة VidReward", platform: "Telegram", reward: "0.003" }, buttonPayload: "task_204",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "🎯", title: "مهمة جديدة متاحة",
        intro: "تتوفر مهمة جديدة يمكنك تنفيذها الآن.",
        fields: [
          htmlLine("المهمة", v.taskTitle),
          htmlLine("المنصة", v.platform),
          htmlLine("المكافأة", amountText(v.reward, "USDT"), true),
          v.description ? htmlLine("الشروط", v.description) : null,
        ],
        status: statusLine("success", "الحالة", "متاحة"),
      })
      : card({
        icon: "🎯", title: "A new task is available",
        intro: "A new task is ready for you to complete.",
        fields: [
          htmlLine("Task", v.taskTitle),
          htmlLine("Platform", v.platform),
          htmlLine("Reward", amountText(v.reward, "USDT"), true),
          v.description ? htmlLine("Requirements", v.description) : null,
        ],
        status: statusLine("success", "Status", "Available"),
      }),
  }),
  template({
    id: "referral_joined", category: "users", image: "sheet1-r2-c1.jpg",
    title: { ar: "انضمام إحالة جديدة", en: "A new referral joined" },
    description: { ar: "عند إنشاء مستخدم جديد برابط إحالة موثّق.", en: "When a new user is created from a verified referral link." },
    sample: { referralUsername: "@new_member" }, buttonPayload: "referrals",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "👥", title: "انضمام إحالة جديدة",
        intro: "انضم مستخدم جديد عبر رابط الإحالة الخاص بك.",
        fields: [
          htmlLine("المستخدم", v.referralUsername),
          htmlLine("تاريخ الانضمام", formatDate(v.date)),
        ],
        footer: "يمكنك متابعة إحالاتك من حسابك.",
      })
      : card({
        icon: "👥", title: "New referral joined",
        intro: "A new user joined through your referral link.",
        fields: [
          htmlLine("User", v.referralUsername),
          htmlLine("Joined", formatDate(v.date)),
        ],
        footer: "You can review your referrals in your account.",
      }),
  }),
  template({
    id: "advertiser_telegram_task", category: "advertisers", image: "sheet2-r1-c4.jpg",
    title: { ar: "انضمام مستخدم لمهمة Telegram", en: "User joined a Telegram task" },
    description: { ar: "بعد التحقق الفعلي من عضوية المستخدم وإضافة المكافأة.", en: "After the user's channel membership is verified and the reward is recorded." },
    sample: { platform: "Telegram" }, buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📣", title: "انضمام جديد عبر مهمة Telegram",
        intro: "انضم مستخدم جديد إلى قناتك عبر المهمة.",
        fields: [
          htmlLine("المستخدم", v.username || v.firstName),
          htmlLine("الحملة", v.campaignTitle),
          htmlLine("وقت الحدث", formatDate(v.date)),
        ],
        status: statusLine("success", "الحالة", "تم التحقق من الانضمام"),
      })
      : card({
        icon: "📣", title: "New join via Telegram task",
        intro: "A new user joined your channel through the task.",
        fields: [
          htmlLine("User", v.username || v.firstName),
          htmlLine("Campaign", v.campaignTitle),
          htmlLine("Event time", formatDate(v.date)),
        ],
        status: statusLine("success", "Status", "Join verified"),
      }),
  }),
  template({
    id: "advertiser_tiktok_task", category: "advertisers", image: "sheet2-r2-c1.jpg",
    title: { ar: "اعتماد إثبات مهمة TikTok", en: "TikTok task proof approved" },
    description: { ar: "بعد اعتماد إثبات المهمة فقط؛ لا يدّعي تحقق المتابعة عبر TikTok.", en: "Only after task proof approval; it does not claim TikTok independently verified a follow." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📣", title: "اعتماد إثبات مهمة TikTok",
        intro: "تم اعتماد إثبات أحد المستخدمين لمهمتك.",
        fields: [
          htmlLine("المستخدم", v.username || v.firstName),
          htmlLine("المهمة", v.campaignTitle),
          htmlLine("وقت الاعتماد", formatDate(v.date)),
        ],
        status: statusLine("success", "الحالة", "معتمد"),
        footer: "الاعتماد مبني على إثبات المهمة المقدَّم من المستخدم.",
      })
      : card({
        icon: "📣", title: "TikTok task proof approved",
        intro: "A user's proof for your task has been approved.",
        fields: [
          htmlLine("User", v.username || v.firstName),
          htmlLine("Task", v.campaignTitle),
          htmlLine("Approved at", formatDate(v.date)),
        ],
        status: statusLine("success", "Status", "Approved"),
        footer: "Approval is based on the proof the user submitted.",
      }),
  }),
  template({
    id: "advertiser_youtube_task", category: "advertisers", image: "sheet2-r2-c2.jpg",
    title: { ar: "إكمال مهمة YouTube", en: "YouTube task completed" },
    description: { ar: "بعد تحقق النظام من اكتمال مشاهدة المهمة؛ ليس تحققًا من الاشتراك.", en: "After the system validates task watch completion; not a subscription check." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📣", title: "إكمال مهمة YouTube",
        intro: "أكمل مستخدم مهمة المشاهدة على منصتنا.",
        fields: [
          htmlLine("المستخدم", v.username || v.firstName),
          htmlLine("الحملة", v.campaignTitle),
          htmlLine("الإجراء المتحقق", "إكمال مدة المشاهدة المطلوبة"),
          htmlLine("وقت الحدث", formatDate(v.date)),
        ],
        status: statusLine("success", "الحالة", "مكتمل"),
      })
      : card({
        icon: "📣", title: "YouTube task completed",
        intro: "A user completed a YouTube watch task on our platform.",
        fields: [
          htmlLine("User", v.username || v.firstName),
          htmlLine("Campaign", v.campaignTitle),
          htmlLine("Verified action", "Required watch duration completed"),
          htmlLine("Event time", formatDate(v.date)),
        ],
        status: statusLine("success", "Status", "Completed"),
      }),
  }),
  template({
    id: "campaign_accepted", category: "advertisers", image: "sheet1-r1-c4.jpg",
    title: { ar: "قبول الحملة", en: "Campaign accepted" },
    description: { ar: "عند انتقال الحملة فعليًا إلى الحالة النشطة.", en: "When the campaign actually enters the active state." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "تم قبول الحملة",
        intro: "تم قبول حملتك وأصبحت نشطة.",
        fields: [htmlLine("الحملة", v.campaignTitle)],
        status: dynamicStatus("ar", "الحالة", v.status, "success"),
      })
      : card({
        icon: "📢", title: "Campaign accepted",
        intro: "Your campaign has been accepted and is now active.",
        fields: [htmlLine("Campaign", v.campaignTitle)],
        status: dynamicStatus("en", "Status", v.status, "success"),
      }),
  }),
  template({
    id: "campaign_activated", category: "advertisers", image: "sheet2-r4-c4.jpg",
    title: { ar: "تفعيل الحملة", en: "Campaign activated" },
    description: { ar: "عند تفعيل الحملة من حالة غير نشطة.", en: "When a campaign is activated from an inactive state." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "تم تفعيل الحملة",
        intro: "تم تفعيل حملتك وأصبحت نشطة.",
        fields: [htmlLine("الحملة", v.campaignTitle)],
        status: dynamicStatus("ar", "الحالة", v.status, "success"),
      })
      : card({
        icon: "📢", title: "Campaign activated",
        intro: "Your campaign has been activated and is now active.",
        fields: [htmlLine("Campaign", v.campaignTitle)],
        status: dynamicStatus("en", "Status", v.status, "success"),
      }),
  }),
  template({
    id: "campaign_paused", category: "advertisers", image: "sheet2-r3-c3.jpg",
    title: { ar: "إيقاف الحملة", en: "Campaign paused" },
    description: { ar: "عند حفظ الحالة الموقوفة للحملة.", en: "When a campaign's paused state is saved." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "تم إيقاف الحملة",
        intro: "تم إيقاف حملتك مؤقتًا.",
        fields: [
          htmlLine("الحملة", v.campaignTitle),
          v.reason ? htmlLine("السبب", v.reason) : null,
        ],
        status: dynamicStatus("ar", "الحالة", v.status, "attention"),
      })
      : card({
        icon: "📢", title: "Campaign paused",
        intro: "Your campaign has been paused.",
        fields: [
          htmlLine("Campaign", v.campaignTitle),
          v.reason ? htmlLine("Reason", v.reason) : null,
        ],
        status: dynamicStatus("en", "Status", v.status, "attention"),
      }),
  }),
  template({
    id: "campaign_rejected", category: "advertisers", image: "sheet2-r3-c5.jpg",
    title: { ar: "رفض الحملة", en: "Campaign not accepted" },
    description: { ar: "عند حفظ قرار رفض الحملة من الإدارة.", en: "When an administrator records a campaign rejection." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "لم تتم الموافقة على الحملة",
        intro: "لم تتم الموافقة على حملتك.",
        fields: [htmlLine("الحملة", v.campaignTitle)],
        status: statusLine("failure", "الحالة", "مرفوضة"),
      })
      : card({
        icon: "📢", title: "Campaign not accepted",
        intro: "Your campaign was not accepted.",
        fields: [htmlLine("Campaign", v.campaignTitle)],
        status: statusLine("failure", "Status", "Rejected"),
      }),
  }),
  template({
    id: "campaign_exhausted", category: "advertisers", image: "sheet2-r3-c5.jpg",
    title: { ar: "رصيد الحملة", en: "Campaign balance update" },
    description: { ar: "قالب جاهز؛ لا يُرسل تلقائيًا لأن النظام الحالي لا يغيّر حالة الحملات عند نفاد الرصيد.", en: "Template prepared; not sent automatically because the current system does not change campaign state on balance exhaustion." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "تحديث رصيد الحملة",
        intro: "طرأ تحديث على رصيد حملتك.",
        fields: [htmlLine("الحملة", v.campaignTitle)],
        status: dynamicStatus("ar", "الحالة المسجلة", v.status, "attention"),
        footer: "لا تُعتبر الحملة موقوفة إلا إذا أكّدت حالتها المسجلة ذلك.",
      })
      : card({
        icon: "📢", title: "Campaign balance update",
        intro: "There is an update to your campaign balance.",
        fields: [htmlLine("Campaign", v.campaignTitle)],
        status: dynamicStatus("en", "Recorded status", v.status, "attention"),
        footer: "The campaign is only treated as paused if its recorded status says so.",
      }),
  }),
  template({
    id: "campaign_resumed", category: "advertisers", image: "sheet2-r3-c4.jpg",
    title: { ar: "استئناف الحملة", en: "Campaign resumed" },
    description: { ar: "عند عودة الحملة إلى الحالة النشطة.", en: "When a campaign returns to the active state." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "تم استئناف الحملة",
        intro: "عادت حملتك إلى الحالة النشطة.",
        fields: [htmlLine("الحملة", v.campaignTitle)],
        status: dynamicStatus("ar", "الحالة", v.status, "success"),
      })
      : card({
        icon: "📢", title: "Campaign resumed",
        intro: "Your campaign is active again.",
        fields: [htmlLine("Campaign", v.campaignTitle)],
        status: dynamicStatus("en", "Status", v.status, "success"),
      }),
  }),
  template({
    id: "campaign_completed", category: "advertisers", image: "sheet1-r4-c1.jpg",
    title: { ar: "اكتمال الحملة", en: "Campaign completed" },
    description: { ar: "قالب جاهز للأحداث التي يسجلها النظام عند الاكتمال.", en: "Template for completion events recorded by the system." },
    buttonPayload: "campaigns",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📢", title: "اكتملت الحملة",
        intro: "اكتملت حملتك بنجاح.",
        fields: [htmlLine("الحملة", v.campaignTitle)],
        status: dynamicStatus("ar", "الحالة", v.status, "success"),
      })
      : card({
        icon: "📢", title: "Campaign completed",
        intro: "Your campaign has finished.",
        fields: [htmlLine("Campaign", v.campaignTitle)],
        status: dynamicStatus("en", "Status", v.status, "success"),
      }),
  }),
  template({
    id: "proof_received", category: "users", image: "sheet2-r4-c5.jpg",
    title: { ar: "استلام إثبات المهمة", en: "Task proof received" },
    description: { ar: "بعد حفظ إثبات المستخدم بحالة قيد المراجعة.", en: "After the user's proof is saved as pending review." },
    sample: { proofId: "PRF-204-9988" }, buttonPayload: "tiktok-tasks",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📝", title: "تم استلام إثباتك",
        intro: "استلمنا إثبات المهمة وهو الآن قيد المراجعة.",
        fields: [
          htmlLine("المهمة", v.taskTitle),
          htmlLine("رقم الإثبات", v.proofId, true),
        ],
        status: statusLine("pending", "الحالة", "قيد المراجعة"),
        footer: "سنُعلمك بالنتيجة بعد انتهاء المراجعة.",
      })
      : card({
        icon: "📝", title: "Task proof received",
        intro: "We received your task proof and it is now under review.",
        fields: [
          htmlLine("Task", v.taskTitle),
          htmlLine("Proof ID", v.proofId, true),
        ],
        status: statusLine("pending", "Status", "Under review"),
        footer: "We'll let you know the result once the review is done.",
      }),
  }),
  template({
    id: "proof_accepted", category: "users", image: "sheet2-r4-c1.jpg",
    title: { ar: "قبول إثبات المهمة", en: "Task proof approved" },
    description: { ar: "بعد اعتماد الإثبات وإضافة المكافأة مرة واحدة.", en: "After the proof is approved and the reward is credited once." },
    buttonPayload: "proofs",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📝", title: "تم قبول إثباتك",
        intro: "تمت الموافقة على إثبات المهمة.",
        fields: [
          htmlLine("المهمة", v.taskTitle),
          htmlLine("المكافأة المسجلة", amountText(v.reward, "USDT"), true),
        ],
        status: statusLine("success", "الحالة", "معتمد"),
      })
      : card({
        icon: "📝", title: "Task proof approved",
        intro: "Your task proof has been approved.",
        fields: [
          htmlLine("Task", v.taskTitle),
          htmlLine("Recorded reward", amountText(v.reward, "USDT"), true),
        ],
        status: statusLine("success", "Status", "Approved"),
      }),
  }),
  template({
    id: "proof_rejected", category: "users", image: "sheet2-r4-c2.jpg",
    title: { ar: "رفض إثبات المهمة", en: "Task proof declined" },
    description: { ar: "بعد حفظ حالة الرفض وسببها إن توفر.", en: "After the proof is marked declined, with a reason when available." },
    buttonPayload: "proofs",
    render: (lang, v) => lang === "ar"
      ? card({
        icon: "📝", title: "لم يتم قبول إثباتك",
        intro: "لم تتم الموافقة على إثبات المهمة.",
        fields: [
          htmlLine("المهمة", v.taskTitle),
          v.reason ? htmlLine("السبب", v.reason) : null,
        ],
        status: statusLine("failure", "الحالة", "مرفوض"),
        footer: "يمكنك إعادة التقديم إذا كانت المهمة تسمح بذلك.",
      })
      : card({
        icon: "📝", title: "Task proof not approved",
        intro: "Your task proof was not approved.",
        fields: [
          htmlLine("Task", v.taskTitle),
          v.reason ? htmlLine("Reason", v.reason) : null,
        ],
        status: statusLine("failure", "Status", "Declined"),
        footer: "You may resubmit if the task allows it.",
      }),
  }),
  template({
    id: "generic", category: "admin", image: "sheet1-r5-c2.jpg",
    title: { ar: "إشعار عام", en: "General notification" },
    description: { ar: "قالب عام ثنائي اللغة.", en: "A bilingual general template." },
    render: (lang, v) => card({
      icon: "🔔", spaced: true,
      title: valueOr(v.title, lang === "ar" ? "إشعار" : "Notification"),
      intro: valueOr(v.message, lang === "ar" ? "تفاصيل الإشعار" : "Notification details"),
    }),
  }),
  template({
    id: "warning", category: "admin", image: "sheet1-r5-c3.jpg",
    title: { ar: "تحذير أو خطأ", en: "Warning or error" },
    description: { ar: "قالب تحذير؛ لا يُرسل إلا عند وجود حالة يدعمها النظام.", en: "Warning template; sent only for states supported by the system." },
    render: (lang, v) => card({
      icon: "⚠️", spaced: true,
      title: valueOr(v.title, lang === "ar" ? "تنبيه" : "Notice"),
      intro: valueOr(v.message, v.reason),
      fields: [v.message && v.reason && v.message !== v.reason ? htmlLine(lang === "ar" ? "السبب" : "Reason", v.reason) : null],
    }),
  }),
];

const templateById = new Map(templates.map((item) => [item.id, item]));

function sampleValues(item, language) {
  const lang = normalizeLanguage(language);
  const values = { ...item.sample };
  if (lang === "en") {
    if (STATUS_EN[values.status]) values.status = STATUS_EN[values.status];
    if (values.firstName === "أحمد") values.firstName = "Ahmed";
    if (values.taskTitle === "متابعة قناة VidReward") values.taskTitle = "Follow the VidReward channel";
    if (values.campaignTitle === "حملة صيفية") values.campaignTitle = "Summer campaign";
    if (values.reason === "لم يطابق الإثبات المتطلبات") values.reason = "The submitted proof did not meet the requirements";
  }
  if (item.id === "campaign_accepted" || item.id === "campaign_activated" || item.id === "campaign_resumed") {
    values.status = lang === "ar" ? "نشط" : "Active";
  }
  if (item.id === "campaign_paused") values.status = lang === "ar" ? "موقوف" : "Paused";
  if (item.id === "campaign_rejected") values.status = lang === "ar" ? "مرفوضة" : "Rejected";
  if (item.id === "campaign_completed") values.status = lang === "ar" ? "مكتمل" : "Completed";
  return values;
}

function normalizeLanguage(language) {
  return String(language ?? "").toLowerCase().startsWith("ar") ? "ar" : "en";
}

function renderTemplate(type, language, values = {}, botUsername = null) {
  const item = templateById.get(type);
  if (!item) return null;
  const lang = normalizeLanguage(language);
  const merged = { ...item.sample, ...values };
  const text = item.render(lang, merged);
  const payload = values.deepLinkPayload ?? item.buttonPayload;
  const button = openBotButton(lang, payload, botUsername);
  const replyMarkup = button.url ? { inline_keyboard: [[button]] } : undefined;
  return {
    type: item.id,
    category: item.category,
    title: item.title[lang],
    description: item.description[lang],
    text,
    imageFile: item.image,
    replyMarkup,
    variables: merged,
    language: lang,
  };
}

async function imageData(file) {
  if (!file) return null;
  try {
    const bytes = await readFile(join(IMAGE_DIRECTORY, file));
    return { bytes, filename: file, mime: "image/jpeg" };
  } catch {
    return null;
  }
}

export function notificationTypes() {
  return templates.map(({ id, category, title, description, image }) => ({
    id, category, title, description, image,
  }));
}

export async function previewNotification(type, language = "ar") {
  const item = templateById.get(type);
  if (!item) return null;
  const rendered = renderTemplate(type, language, sampleValues(item, language), await resolveBotUsername());
  if (!rendered) return null;
  const image = await imageData(rendered.imageFile);
  return {
    ...rendered,
    imageAvailable: Boolean(image),
    imageDataUrl: image ? `data:${image.mime};base64,${image.bytes.toString("base64")}` : null,
    buttonUrl: rendered.replyMarkup?.inline_keyboard?.[0]?.[0]?.url ?? null,
  };
}

function eventKeyFor(type, eventId) {
  const safeEventId = String(eventId ?? "").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 180);
  if (!safeEventId) return null;
  return `${type}:${safeEventId}`.slice(0, 200);
}

async function telegramSend(method, payload, options) {
  let result = await telegramRequest(method, payload, options);
  if (!result.ok && result.errorCode === 429 && result.retryAfter > 0 && result.retryAfter <= 3) {
    await new Promise((resolve) => setTimeout(resolve, result.retryAfter * 1000 + 100));
    result = await telegramRequest(method, payload, options);
  }
  return result;
}

async function deliver(chatId, rendered) {
  const image = await imageData(rendered.imageFile);
  if (image) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("photo", new Blob([image.bytes], { type: image.mime }), image.filename);
    if (rendered.text.length <= MAX_CAPTION_LENGTH) {
      form.append("caption", rendered.text);
      form.append("parse_mode", "HTML");
      if (rendered.replyMarkup) form.append("reply_markup", JSON.stringify(rendered.replyMarkup));
    }
    const photo = await telegramSend("sendPhoto", null, { form, timeoutMs: 30000 });
    if (photo.ok && rendered.text.length <= MAX_CAPTION_LENGTH) return photo;
    if (photo.ok) {
      return telegramSend("sendMessage", {
        chat_id: chatId, text: rendered.text, parse_mode: "HTML",
        ...(rendered.replyMarkup ? { reply_markup: rendered.replyMarkup } : {}),
      });
    }
    // Telegram can reject an image while still allowing the text. Do not retry as text after
    // network timeouts, rate limiting, or blocked-chat errors because delivery may be ambiguous.
    if (photo.errorCode !== 400) return photo;
  }
  return telegramSend("sendMessage", {
    chat_id: chatId, text: rendered.text, parse_mode: "HTML",
    ...(rendered.replyMarkup ? { reply_markup: rendered.replyMarkup } : {}),
  });
}

function deliveryState(result) {
  if (result.ok) return "sent";
  if (result.errorCode === 429) return "retryable";
  if (!result.errorCode || result.errorCode >= 500) return "uncertain";
  return "failed";
}

export async function sendNotification(type, recipientId, values = {}, options = {}) {
  const item = templateById.get(type);
  const recipient = String(recipientId ?? "");
  const eventKey = eventKeyFor(type, options.eventId);
  if (!item || !/^\d{1,20}$/.test(recipient) || !eventKey || !sql) return { ok: false, reason: "invalid_recipient_or_event" };

  try {
    await ensureSchema();
    const users = await sql.query(
      `SELECT id::text AS id, language FROM vr_users
       WHERE id = $1 AND status <> 'محظور' LIMIT 1`,
      [recipient],
    );
    const user = users[0];
    if (!user) return { ok: false, reason: "recipient_unavailable" };
    const rendered = renderTemplate(type, user.language ?? options.language, values, await resolveBotUsername());
    const claimed = await sql.query(
      `INSERT INTO vr_notification_deliveries
         (event_key, recipient_id, notification_type, status, attempt_count)
       VALUES ($1, $2, $3, 'sending', 1)
       ON CONFLICT (event_key, recipient_id) DO UPDATE
         SET status = 'sending', attempt_count = vr_notification_deliveries.attempt_count + 1,
             last_error = NULL, updated_at = now()
       WHERE vr_notification_deliveries.status = 'retryable'
         AND vr_notification_deliveries.attempt_count < 3
       RETURNING event_key`,
      [eventKey, recipient, type],
    );
    if (!claimed.length) return { ok: true, duplicate: true };

    const result = await deliver(user.id, rendered);
    await sql.query(
      `UPDATE vr_notification_deliveries
       SET status = $3, last_error = $4, updated_at = now()
       WHERE event_key = $1 AND recipient_id = $2`,
      [
        eventKey,
        recipient,
        deliveryState(result),
        result.ok ? null : String(result.description ?? "Telegram delivery failed").slice(0, 300),
      ],
    );
    return result.ok ? { ok: true } : { ok: false, reason: result.description ?? "telegram_error" };
  } catch {
    // Notification delivery must never roll back or fail the underlying financial/task event.
    return { ok: false, reason: "notification_delivery_failed" };
  }
}

export async function sendNotificationToChat(type, chatId, values = {}, language = "en") {
  const rendered = renderTemplate(type, language, values, await resolveBotUsername());
  if (!rendered || !/^-?\d{1,20}$/.test(String(chatId ?? "")) || !process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, reason: "not_configured" };
  }
  try {
    const result = await deliver(String(chatId), rendered);
    return result.ok ? { ok: true } : { ok: false, reason: result.description ?? "telegram_error" };
  } catch {
    return { ok: false, reason: "telegram_error" };
  }
}

const channelIdCache = new Map();

async function resolveChannelId(chatId) {
  const raw = String(chatId ?? "").trim();
  if (/^-?\d{1,20}$/.test(raw)) return raw;
  const handle = raw.replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle)) return "";
  if (channelIdCache.has(handle)) return channelIdCache.get(handle);
  const result = await telegramSend("getChat", { chat_id: `@${handle}` });
  const id = result.ok && result.result?.id ? String(result.result.id) : "";
  if (id) channelIdCache.set(handle, id);
  return id;
}

export async function sendAdminChannelNotification(type, chatId, values = {}, eventId) {
  const rendered = renderTemplate(type, "en", values, await resolveBotUsername());
  const destination = await resolveChannelId(chatId);
  const eventKey = eventKeyFor(type, eventId);
  if (!rendered || !/^-?\d{1,20}$/.test(destination) || !eventKey || !process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, reason: "not_configured" };
  }
  try {
    await ensureSchema();
    const claimed = await sql.query(
      `INSERT INTO vr_notification_deliveries
         (event_key, recipient_id, notification_type, status, attempt_count)
       VALUES ($1, $2, $3, 'sending', 1)
       ON CONFLICT (event_key, recipient_id) DO UPDATE
         SET status = 'sending', attempt_count = vr_notification_deliveries.attempt_count + 1,
             last_error = NULL, updated_at = now()
       WHERE vr_notification_deliveries.status = 'retryable'
         AND vr_notification_deliveries.attempt_count < 3
       RETURNING event_key`,
      [eventKey, destination, type],
    );
    if (!claimed.length) return { ok: true, duplicate: true };
    const result = await deliver(destination, rendered);
    await sql.query(
      `UPDATE vr_notification_deliveries
       SET status = $3, last_error = $4, updated_at = now()
       WHERE event_key = $1 AND recipient_id = $2`,
      [eventKey, destination, deliveryState(result), result.ok ? null : String(result.description ?? "Telegram delivery failed").slice(0, 300)],
    );
    return result.ok ? { ok: true } : { ok: false, reason: result.description ?? "telegram_error" };
  } catch {
    return { ok: false, reason: "notification_delivery_failed" };
  }
}

function platformEventType(platform) {
  if (platform === "telegram") return "advertiser_telegram_task";
  if (platform === "tiktok") return "advertiser_tiktok_task";
  if (platform === "youtube") return "advertiser_youtube_task";
  return null;
}

export async function notifyTaskAdvertiser(campaignId, taskUserId, eventId) {
  if (!sql) return;
  try {
    const rows = await sql.query(
      `SELECT c.owner_id::text AS "ownerId", c.platform, c.title AS "campaignTitle",
              u.first_name AS "firstName", u.username
       FROM vr_campaigns c
       JOIN vr_users u ON u.id = $2
       WHERE c.id = $1`,
      [campaignId, taskUserId],
    );
    const row = rows[0];
    const type = row && platformEventType(row.platform);
    if (!type || !row.ownerId) return;
    await sendNotification(type, row.ownerId, {
      campaignTitle: row.campaignTitle,
      firstName: row.firstName,
      username: row.username ? `@${row.username}` : "",
      date: new Date().toISOString(),
    }, { eventId });
  } catch {
    // The task result is authoritative; advertiser notification is best-effort.
  }
}

export async function notifyTaskAvailable(campaignId, activationId = "initial") {
  if (!sql) return;
  try {
    const rows = await sql.query(
      `SELECT id::text AS id, title, platform, COALESCE(description, '') AS description,
              COALESCE(reward, 0)::float8 AS reward
       FROM vr_campaigns
       WHERE id = $1 AND status = 'نشط'
         AND (platform <> 'youtube' OR requested_views IS NULL OR views < requested_views)
         AND (platform = 'youtube' OR completed_count < COALESCE(target_count, 0))`,
      [campaignId],
    );
    const task = rows[0];
    if (!task) return;
    const users = await sql.query(`SELECT id::text AS id FROM vr_users WHERE status <> 'محظور' ORDER BY id`);
    const platform = task.platform === "youtube" ? "YouTube" : task.platform === "tiktok" ? "TikTok" : "Telegram";
    const reward = Number(task.reward).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    for (let offset = 0; offset < users.length; offset += 15) {
      const batch = users.slice(offset, offset + 15);
      await Promise.all(batch.map((user) => sendNotification("task_available", user.id, {
        taskTitle: task.title,
        platform,
        description: task.description,
        reward,
        deepLinkPayload: `task_${task.platform}_${task.id}`,
      }, { eventId: `campaign_${task.id}_${activationId}` })));
      if (offset + batch.length < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  } catch {
    // Campaign publication is not rolled back if a Telegram message cannot be delivered.
  }
}

export async function notifyCampaignStatus(campaignId, previousStatus, nextStatus, reason = "") {
  if (!sql || previousStatus === nextStatus) return;
  try {
    const rows = await sql.query(
      `SELECT id::text AS id, owner_id::text AS "ownerId", title, status
       FROM vr_campaigns WHERE id = $1`,
      [campaignId],
    );
    const campaign = rows[0];
    if (!campaign) return;
    const active = nextStatus === "نشط";
    const paused = nextStatus === "موقوف";
    const type = active
      ? (previousStatus === "موقوف" ? "campaign_resumed" : previousStatus === "بانتظار تحقق البوت" ? "campaign_accepted" : "campaign_activated")
      : reason === "مرفوضة" ? "campaign_rejected"
        : paused ? "campaign_paused" : nextStatus === "مكتمل" ? "campaign_completed" : null;
    if (type) {
      await sendNotification(type, campaign.ownerId, {
        campaignTitle: campaign.title, status: campaign.status, reason,
      }, { eventId: `campaign_${campaign.id}_${nextStatus}_${randomUUID()}` });
    }
    if (active && previousStatus !== "نشط") await notifyTaskAvailable(campaign.id, randomUUID());
  } catch {
    // Campaign state changes remain valid even if notification delivery fails.
  }
}

export async function sendAdminTestNotification(req, res) {
  const { requireAdmin } = await import("../../server/auth.js");
  const admin = await requireAdmin(req);
  const body = req.body ?? {};
  const type = String(body.type ?? "");
  const language = normalizeLanguage(body.language);
  const item = templateById.get(type);
  if (!item) {
    const { HttpError } = await import("../../server/errors.js");
    throw new HttpError(400, "Invalid notification type");
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    const { HttpError } = await import("../../server/errors.js");
    throw new HttpError(503, "TELEGRAM_BOT_TOKEN is not configured on the server");
  }
  const result = await sendNotificationToChat(type, admin.id, sampleValues(item, language), language);
  if (!result.ok) {
    const { HttpError } = await import("../../server/errors.js");
    throw new HttpError(502, "Telegram could not deliver the test message to your admin chat.");
  }
  const { ok } = await import("../../server/errors.js");
  ok(res, { sent: true, chatId: admin.id });
}

export async function handleNotificationPreview(req, res, query) {
  const { requireAdmin } = await import("../../server/auth.js");
  await requireAdmin(req);
  const type = query.get("type");
  if (!type) {
    const { ok } = await import("../../server/errors.js");
    ok(res, notificationTypes());
    return;
  }
  const preview = await previewNotification(type, query.get("language"));
  if (!preview) {
    const { HttpError } = await import("../../server/errors.js");
    throw new HttpError(404, "Unknown notification type");
  }
  const { ok } = await import("../../server/errors.js");
  ok(res, preview);
}

// Vercel discovers files under api/ as routes. Keep this utility module non-public
// even if someone requests its path directly; app routes go through api/index.js.
export default function handler(req, res) {
  res.status(req.method === "GET" ? 404 : 405).json({ success: false, error: "Not found" });
}
