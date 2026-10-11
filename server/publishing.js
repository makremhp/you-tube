import { sql } from './db.js';
import { HttpError, ok } from './errors.js';
import { requireUser } from './auth.js';

// مكافأة نظام النشر اليومية (تظهر في الواجهة كمبلغ ثابت).
export const PUBLISH_DAILY_REWARD = 0.02;
export const PUBLISH_MAX_IMAGES = 5;
const MAX_IMAGE_CHARS = 900_000;
// حد جسم الطلب في Vercel حوالي 4.5MB؛ نبقى أقل منه.
const MAX_TOTAL_CHARS = 3_600_000;
const IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const STATUS_LABELS = `CASE status WHEN 'approved' THEN 'معتمد' WHEN 'rejected' THEN 'مرفوض' ELSE 'قيد المراجعة' END`;

function readImages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > PUBLISH_MAX_IMAGES) return null;
  let total = 0;
  for (const image of value) {
    if (typeof image !== 'string' || image.length > MAX_IMAGE_CHARS || !IMAGE_PATTERN.test(image)) return null;
    total += image.length;
  }
  return total <= MAX_TOTAL_CHARS ? value : null;
}

// إرسال إثبات نشر واحد (حتى 5 صور) للمراجعة: طلب واحد غير مرفوض لكل مستخدم في اليوم.
export async function submitPublishProof(req, res) {
  const user = await requireUser(req);
  const images = readImages(req.body?.images);
  if (!images) throw new HttpError(400, 'أضف من صورة إلى 5 صور واضحة بحجم مناسب.');
  const rows = await sql.query(
    `INSERT INTO vr_publish_proofs (user_id, images, reward)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (user_id, day) WHERE status <> 'rejected' DO NOTHING
     RETURNING id::text AS id`,
    [user.id, JSON.stringify(images), PUBLISH_DAILY_REWARD],
  );
  if (!rows.length) throw new HttpError(409, 'أرسلت إثبات نشر اليوم بالفعل. حاول غدًا أو بعد مراجعة الإدارة.');
  ok(res, { id: rows[0].id, status: 'قيد المراجعة', reward: PUBLISH_DAILY_REWARD }, 201);
}

// حالة اليوم وآخر الطلبات (بدون الصور لتبقى الاستجابة خفيفة).
export async function listPublishProofs(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(
    `SELECT id::text AS id,
            ${STATUS_LABELS} AS status,
            reward::float8 AS reward,
            jsonb_array_length(images) AS "imageCount",
            (day = CURRENT_DATE) AS today,
            COALESCE(rejection_reason, '') AS "rejectionReason",
            created_at AS "createdAt"
     FROM vr_publish_proofs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [user.id],
  );
  ok(res, rows);
}
