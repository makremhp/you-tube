import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { CreateTelegramStarsInvoiceBody } from "@workspace/api-zod";

const router: IRouter = Router();

const TELEGRAM_STARS = 1000;
const CREDIT_USD = 10;
const TELEGRAM_CURRENCY = "XTR";

type TelegramApiResponse =
  | { ok: true; result: string }
  | { ok: false; description?: string };

router.post("/telegram/stars-invoice", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    res.status(503).json({ error: "Telegram invoice service is not configured." });
    return;
  }

  const parsed = CreateTelegramStarsInvoiceBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Telegram user data." });
    return;
  }

  const payload = [
    "vidreward",
    "deposit",
    parsed.data.telegramUserId ?? "anonymous",
    randomUUID(),
  ].join(":");

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "إيداع رصيد VidReward",
          description: "إيداع 10 USDT في رصيد الإعلانات مقابل 1000 نجمة Telegram.",
          payload,
          currency: TELEGRAM_CURRENCY,
          prices: [{ label: "رصيد إعلانات بقيمة 10 USDT", amount: TELEGRAM_STARS }],
        }),
      },
    );

    const data = (await telegramResponse.json()) as TelegramApiResponse;
    if (!telegramResponse.ok || !data.ok) {
      const description = data.ok ? "Telegram request failed." : data.description;
      req.log.warn(
        { status: telegramResponse.status, description },
        "Telegram invoice creation failed",
      );
      res.status(503).json({ error: "تعذر إنشاء فاتورة Telegram الآن." });
      return;
    }

    res.json({
      invoiceLink: data.result,
      payload,
      amountStars: TELEGRAM_STARS,
      creditUsd: CREDIT_USD,
      currency: TELEGRAM_CURRENCY,
    });
  } catch (error) {
    req.log.error({ err: error }, "Telegram invoice request errored");
    res.status(503).json({ error: "تعذر الاتصال بخدمة Telegram." });
  }
});

export default router;