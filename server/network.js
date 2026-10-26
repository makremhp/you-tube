import { isIP } from 'node:net';
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
 *  - VPN_BLOCK_DATACENTER=false   السماح بعناوين مراكز البيانات (الافتراضي: تُحجب لأنها غالبًا VPN/خوادم).
 *  - VPN_FAIL_CLOSED=true        حظر المستخدم عند تعذّر الفحص (الافتراضي: السماح لتفادي تعطيل المنصة).
 *  - VPN_CACHE_HOURS             مدة حفظ النتيجة (الافتراضي 12 ساعة).
 *  - VPN_CHECK_TIMEOUT_MS        مهلة مزوّد الفحص (الافتراضي 3500).
 *  - VPN_WEBRTC_CHECK=off        تعطيل مقارنة IP الذي يكشفه WebRTC بالـ IP الذي يراه الخادم (الافتراضي: مفعّلة).
 *  - VPN_TIMEZONE_CHECK=off      تعطيل مقارنة المنطقة الزمنية للجهاز بمنطقة الـ IP (الافتراضي: مفعّلة).
 *
 * إشارات المتصفح (WebRTC والمنطقة الزمنية) تلتقط إضافات VPN المجانية في المتصفح التي تغيّر الـ IP لحركة HTTP فقط:
 * تبقى المنطقة الزمنية للجهاز كما هي، وغالبًا يكشف WebRTC عنوان الشبكة الحقيقي. هي إشارات يرسلها العميل فيمكن
 * لمن يكتب سكربتًا مخصصًا تزويرها، لكنها تُغلق الباب أمام الاستخدام العادي لهذه الإضافات.
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

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryProxycheck(ip) {
  const key = process.env.VPN_CHECK_API_KEY;
  const url = new URL(`https://proxycheck.io/v2/${encodeURIComponent(ip)}`);
  url.searchParams.set('vpn', '1');
  url.searchParams.set('risk', '0');
  if (key) url.searchParams.set('key', key);
  const data = await fetchJson(url);
  if (!data || (data.status !== 'ok' && data.status !== 'warning')) return null;
  const entry = data[ip];
  if (!entry || typeof entry !== 'object') return null;
  const proxy = String(entry.proxy ?? '').toLowerCase() === 'yes';
  return { proxy, kind: proxy ? String(entry.type ?? 'Proxy').slice(0, 40) : null };
}

// ipapi.is: مجاني بدون مفتاح (حد يومي 1000 طلب). يضيف تغطية لنطاقات مراكز البيانات وخوادم VPN الذاتية.
async function queryIpapi(ip) {
  const url = new URL('https://api.ipapi.is/');
  url.searchParams.set('q', ip);
  const data = await fetchJson(url);
  if (!data || typeof data !== 'object' || typeof data.is_vpn !== 'boolean') return null;
  const blockDatacenter = String(process.env.VPN_BLOCK_DATACENTER ?? 'true').toLowerCase() !== 'false';
  if (data.is_vpn) return { proxy: true, kind: 'VPN' };
  if (data.is_tor) return { proxy: true, kind: 'TOR' };
  if (data.is_proxy) return { proxy: true, kind: 'Proxy' };
  if (blockDatacenter && data.is_datacenter) return { proxy: true, kind: 'Datacenter' };
  return { proxy: false, kind: null };
}

// نستعلم مزوّدين بالتوازي؛ يُحجب العنوان إذا أشار أي منهما إلى VPN/Proxy. إن فشل أحدهما نعتمد الآخر.
async function queryProvider(ip) {
  const results = (await Promise.all([queryProxycheck(ip), queryIpapi(ip)])).filter(Boolean);
  if (!results.length) return null;
  return results.find((result) => result.proxy) ?? { proxy: false, kind: null };
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

function normalizeIp(value) {
  return String(value ?? '').trim().replace(/^::ffff:/i, '').toLowerCase();
}

function readHeader(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function webrtcIps(req) {
  const raw = readHeader(req, 'x-client-webrtc-ips');
  if (typeof raw !== 'string' || !raw || raw.length > 400) return [];
  return raw
    .split(',')
    .map(normalizeIp)
    .filter((ip) => isIP(ip) && !isPrivateOrLocalIp(ip))
    .slice(0, 6);
}

function offsetMinutes(timeZone) {
  if (typeof timeZone !== 'string' || !/^[A-Za-z][A-Za-z0-9_+\-/]{1,63}$/.test(timeZone)) return null;
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName')?.value;
    if (!part) return null;
    if (part === 'GMT') return 0;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(part);
    if (!match) return null;
    return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
  } catch {
    return null;
  }
}

/*
 * فحص إشارات المتصفح دون أي استعلام خارجي. يعيد { proxy, kind } أو null إن لم تتوفر إشارة كافية.
 *  - WebRTC: إن كشف المتصفح عنوانًا عامًا من نفس عائلة عنوان الطلب (IPv4 أو IPv6) ولا يطابقه فالطلب يمر عبر وسيط.
 *  - المنطقة الزمنية: إن اختلف توقيت جهاز المستخدم عن توقيت موقع الـ IP (ترويسة Vercel) فالـ IP ليس من موقع الجهاز.
 */
export function assessClientSignals(req, ip) {
  const requestIpValue = normalizeIp(ip);
  const family = isIP(requestIpValue);

  if (String(process.env.VPN_WEBRTC_CHECK ?? 'on').toLowerCase() !== 'off' && family) {
    const sameFamily = webrtcIps(req).filter((candidate) => isIP(candidate) === family);
    if (sameFamily.length && !sameFamily.includes(requestIpValue)) return { proxy: true, kind: 'WebRTC mismatch' };
  }

  if (String(process.env.VPN_TIMEZONE_CHECK ?? 'on').toLowerCase() !== 'off') {
    const ipOffset = offsetMinutes(readHeader(req, 'x-vercel-ip-timezone'));
    const deviceOffset = offsetMinutes(readHeader(req, 'x-client-timezone'));
    if (ipOffset !== null && deviceOffset !== null && ipOffset !== deviceOffset) return { proxy: true, kind: 'Timezone mismatch' };
  }
  return null;
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

  // إشارات المتصفح تُفحص أولًا: لا تكلّف طلبًا خارجيًا وتلتقط إضافات VPN التي لا يعرفها مزوّد السمعة.
  const clientSignal = assessClientSignals(req, ip);
  if (clientSignal) return { enforced: true, checked: true, ...clientSignal };

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
