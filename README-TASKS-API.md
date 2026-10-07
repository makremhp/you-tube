# Telegram tasks and rewards API

This API is implemented as Vercel Node.js Functions and uses the existing Neon database.

## Vercel environment variables

- `NEON_DATABASE_URL` or the existing `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_TELEGRAM_IDS` — comma-separated Telegram numeric IDs for administrators

Never add these values to source control. Configure them in Vercel for the environments where the API will run.

## Database setup

The API reuses the existing `users`, `user_balances`, and `campaigns` tables. If the additive API tables are not already present, apply `migrations/0001_task_completions_and_wallet_transactions.sql` once to the same Neon database configured in Vercel.

## Endpoints

- `POST /api/auth/telegram` — validate Mini App `initData`, register/update the user, initialize their balance.
- `GET /api/me` — authenticated user and viewer balance.
- `GET /api/wallet/transactions` — the user's latest 50 reward transactions.
- `GET /api/tasks` — active tasks and the user's completion state.
- `POST /api/tasks/:taskId/complete` — automatically verify public Telegram channel membership; TikTok tasks require `proofText` or an HTTPS `proofUrl`.
- `POST /api/admin/tasks` — create a Telegram or TikTok task.
- `GET /api/admin/completions?status=pending|approved|rejected` — list submissions for review.
- `POST /api/admin/completions/:completionId/review` — approve or reject a pending submission.
- `GET /api/healthz` and `GET /api/neon-check` — health and database connectivity checks.

Authenticated endpoints expect `Authorization: tma <Telegram.WebApp.initData>`. Telegram automatic verification requires the bot to be an administrator of the public channel. Manual task submissions remain pending until an administrator reviews them.
