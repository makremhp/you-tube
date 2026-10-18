/*
 * استخراج عنوان IP الموثوق للعميل.
 * على Vercel تُضبط ترويسات x-vercel-forwarded-for / x-real-ip من المنصة نفسها ولا يمكن للعميل تزويرها.
 * خارج Vercel لا نثق بأي ترويسة يرسلها العميل إلا إذا فعّل المشرف TRUST_PROXY_HEADERS=true صراحةً
 * (يعني أن الخادم يقع خلف وكيل موثوق يستبدل هذه الترويسات)؛ وإلا نستخدم عنوان اتصال المقبس.
 */
function readHeader(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

export function trustsProxyHeaders() {
  return Boolean(process.env.VERCEL) || String(process.env.TRUST_PROXY_HEADERS ?? '').toLowerCase() === 'true';
}

export function requestIp(req) {
  const candidates = trustsProxyHeaders()
    ? [readHeader(req, 'x-vercel-forwarded-for'), readHeader(req, 'x-real-ip'), readHeader(req, 'x-forwarded-for')]
    : [req.socket?.remoteAddress];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate) continue;
    // آخر عنصر هو ما أضافه آخر وكيل موثوق؛ العناصر الأولى قد يكون العميل قد حقنها.
    const value = candidate.split(',').at(-1)?.trim().slice(0, 128);
    if (value) return value;
  }
  return null;
}

export function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  const value = ip.replace(/^::ffff:/i, '').toLowerCase();
  if (value === '::1' || value === 'localhost') return true;
  if (/^(10\.|127\.|192\.168\.|169\.254\.|0\.)/.test(value)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true;
  return /^(fc|fd|fe80)/.test(value);
}
