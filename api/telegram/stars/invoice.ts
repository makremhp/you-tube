import { authenticate } from "../../../server/auth.js";

type InvoiceRequest = { body?: { amountUsd?: unknown; telegramUserId?: unknown }; headers?: Record<string, string | string[] | undefined> };
type InvoiceResponse = { status: (code: number) => InvoiceResponse; json: (body: unknown) => void };

const STARS_PER_USD = 100;

function payloadFor(telegramUserId: number | undefined, amountUsd: number) {
  return `vidreward:${telegramUserId ?? "guest"}:${amountUsd.toFixed(2)}:${Date.now()}`;
}

export default async function handler(req: InvoiceRequest, res: InvoiceResponse) {
  if (req.body === undefined) {
    res.status(400).json({ message: "بيانات الطلب غير صالحة." });
    return;
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(503).json({ message: "Telegram Stars غير مفعّلة حاليًا." });
    return;
  }
  // الهوية تُؤخذ من initData الموقّع فقط؛ أي معرّف يرسله المتصفح في الجسم يُتجاهل.
  const verifiedUser = authenticate(req as never);
  if (!verifiedUser) {
    res.status(401).json({ message: "افتح التطبيق من Telegram ثم أعد المحاولة." });
    return;
  }
  const amountUsd = Number(req.body.amountUsd);
  const telegramUserId = verifiedUser.id;
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 10000) {
    res.status(400).json({ message: "أدخل مبلغًا بين 1 و10000 دولار." });
    return;
  }
  const normalizedAmountUsd = Number(amountUsd.toFixed(2));
  const stars = Math.round(normalizedAmountUsd * STARS_PER_USD);
  const payload = payloadFor(telegramUserId, normalizedAmountUsd);
  const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "إيداع رصيد الإعلانات",
      description: `إيداع بقيمة ${normalizedAmountUsd.toFixed(2)} دولار في VidReward`,
      payload,
      currency: "XTR",
      prices: [{ label: "رصيد VidReward", amount: stars }],
    }),
  });
  const telegramData = await telegramResponse.json() as { ok?: boolean; result?: string; description?: string };
  if (!telegramResponse.ok || !telegramData.ok || !telegramData.result) {
    res.status(502).json({ message: telegramData.description ?? "تعذر إنشاء فاتورة Telegram Stars." });
    return;
  }
  res.status(200).json({ invoiceUrl: telegramData.result, amountUsd: normalizedAmountUsd, stars, payload });
}