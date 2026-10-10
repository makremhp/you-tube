import { sql } from './db.js';
import { ok } from './errors.js';
import { requireUser } from './auth.js';

export async function getReferrals(req, res) {
  const user = await requireUser(req);
  const rows = await sql.query(`SELECT count(*)::int AS invited FROM vr_users WHERE invited_by = $1`, [user.id]);
  ok(res, { invited: Number(rows[0]?.invited ?? 0) });
}
