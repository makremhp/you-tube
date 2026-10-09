export function readPositiveInteger(value, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > max) return null;
  return number;
}

export function readMoney(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Number(number.toFixed(6));
}

export function readText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

export function readHttpUrl(value, max = 500) {
  const text = readText(value, max);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function newIdentifier(prefix) {
  const random = Math.random().toString(36).slice(2, 12).toUpperCase().padEnd(10, '0');
  return `${prefix}-${Date.now().toString(36).slice(-6).toUpperCase()}-${random}`;
}

export function readIdempotencyKey(value) {
  const key = Array.isArray(value) ? value[0] : value;
  return typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? key : null;
}
