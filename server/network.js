import { sql } from './db.js';
import { HttpError } from './errors.js';
import { isAdmin } from './auth.js';
import { isPrivateOrLocalIp, requestIp } from './ip.js';
import { keyedHash } from './security.js';

/*
 * حماية ضد VPN / Proxy / Tor.
 *
 * لا توجد طريقة موثوقة لاكتشاف VPN من المتصفح وحده؛ لذلك يعتمد الفحص على الخادم بمقارنة عنوان IP الذي
 * تراه المنصة بقاعدة سمعة IP لدى مزوّد خارجي (proxycheck.io افتراضيًا). النتيجة تُخزَّن مؤقتًا بصيغة هاش.
 *
 * متغيرات البيئة (كلها اختيارية):
 *  - VPN_PROTECTION=off          تعطيل الحماية بالكامل (الافتراضي: مفعّلة).
 *  - VPN_CHECK_API_KEY           مفتاح proxycheck.io (يعمل بدونه بحد يومي صغير جدًا).
 *  - VPN_FAIL_CLOSED=true        حظر المستخدم عند تعذّر الفحص (الافتراضي: السماح لتفادي تعطيل المنصة).
 *  - VPN_CACHE_HOURS             مدة حفظ النتيجة (الافتراضي 12 ساعة).
 *  - VPN_CHECK_TIMEOUT_MS        مهلة مزوّد الفحص (الافتراضي 3500).
 */
export const VPN_ERROR_CODE = 'VPN_DETECTED';
const MEMORY_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map();

export function vpnProtectionEnabled() {
  return String(process.env.VPN_PROTECTION ?? 'on').toLowerCase() !== 'off';
}

function cacheHours() {
  const value = Number(process.env.VPN_CACHE_HOURS);
  return Number.isFinite(value) && value >= 1 && value <= 168 ? Math.floor(value) : 12;
}

function timeoutMs() {
  const value = Number(process.env.VPN_CHECK_TIMEOUT_MS);
  return Number.isSafeInteger(value) && value >= 500 && value <= 10000 ? value : 3500;
}

async function queryProvider(ip) {
  const key = process.env.VPN_CHECK_API_KEY;
  const url = new URL(`https://proxycheck.io/v2/${encodeURIComponent(ip)}`);
  url.searchParams.set('vpn', '1');
  url.searchParams.set('risk', '0');
  if (key) url.searchParams.set('key', key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || (data.status !== 'ok' && data.status !== 'warning')) return null;
    const entry = data[ip];
    if (!entry || typeof entry !== 'object') return null;
    const proxy = String(entry.proxy ?? '').toLowerCase() === 'yes';
    return { proxy, kind: proxy ? String(entry.type ?? 'Proxy').slice(0, 40) : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCached(ipHash) {
  const hit = memoryCache.get(ipHash);
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const rows = await sql.query(
      `SELECT is_proxy AS proxy, kind FROM vr_ip_reputation
       WHERE ip_hash = $1 AND checked_at > now() - make_interval(hours => $2::int)`,
      [ipHash, cacheHours()],
    );
    if (!rows.length) return null;
    const value = { proxy: Boolean(rows[0].proxy), kind: rows[0].kind ?? null };
    memoryCache.set(ipHash, { value, expires: Date.now() + MEMORY_TTL_MS });
    return value;
  } catch {
    return null;
  }
}

async function writeCache(ipHash, value) {
  memoryCache.set(ipHash, { value, expires: Date.now() + MEMORY_TTL_MS });
  try {
    await sql.query(
      `INSERT INTO vr_ip_reputation (ip_hash, is_proxy, kind, provider, checked_at)
       VALUES ($1, $2, $3, 'proxycheck', now())
       ON CONFLICT (ip_hash) DO UPDATE
         SET is_proxy = EXCLUDED.is_proxy, kind = EXCLUDED.kind, provider = EXCLUDED.provider, checked_at = now()`,
      [ipHash, value.proxy, value.kind],
    );
  } catch {
    // الذاكرة المؤقتة تكفي؛ فشل التخزين لا يوقف الطلب.
  }
}

export function resetNetworkCacheForTests() {
  memoryCache.clear();
}

/*
 * يعيد { enforced, checked, proxy, kind }.
 *  - enforced=false: الحماية معطّلة أو العنوان محلي/غير معروف فلا يُطبَّق أي حظر.
 *  - checked=false مع enforced=true: تعذّر الفحص (يُسمح بالمرور ما لم يُفعَّل VPN_FAIL_CLOSED).
 */
export async function inspectNetwork(req) {
  if (!vpnProtectionEnabled()) return { enforced: false, checked: false, proxy: false, kind: null };
  const ip = requestIp(req);
  if (!ip || isPrivateOrLocalIp(ip)) return { enforced: false, checked: false, proxy: false, kind: null };

  const ipHash = keyedHash(`vpn:${ip}`);
  const cached = await readCached(ipHash);
  if (cached) return { enforced: true, checked: true, ...cached };

  const fresh = await queryProvider(ip);
  if (!fresh) {
    const failClosed = String(process.env.VPN_FAIL_CLOSED ?? '').toLowerCase() === 'true';
    return { enforced: true, checked: false, proxy: failClosed, kind: failClosed ? 'unverified' : null };
  }
  await writeCache(ipHash, fresh);
  return { enforced: true, checked: true, ...fresh };
}

export async function assertNoVpn(req, authUser) {
  if (authUser && isAdmin(authUser.id)) return;
  const result = await inspectNetwork(req);
  if (result.proxy) {
    throw new HttpError(403, 'VPN or proxy detected. Turn it off, then refresh the page.', VPN_ERROR_CODE);
  }
}
