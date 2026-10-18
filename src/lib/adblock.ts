/*
 * اكتشاف مانع الإعلانات من المتصفح. لا توجد طريقة مضمونة 100%؛ نستخدم إشارتين شائعتين:
 *  1) عنصر «طُعم» بأسماء فئات تحجبها قوائم المنع، فإن اختفى أو صار حجمه صفرًا فهناك مانع.
 *  2) محاولة جلب سكربت إعلانات معروف؛ الرفض مع اتصال سليم يعني حجب الطلب.
 * عند عدم اليقين (لا اتصال بالإنترنت) نعيد false حتى لا نحجب مستخدمًا بلا سبب.
 */
const BAIT_CLASSES = 'adsbox ad-banner ad-placement adsbygoogle pub_300x250 text-ad';
const PROBE_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

function baitIsHidden() {
  const bait = document.createElement('div');
  bait.className = BAIT_CLASSES;
  bait.setAttribute('aria-hidden', 'true');
  bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;pointer-events:none;';
  bait.innerHTML = '&nbsp;';
  document.body.appendChild(bait);
  const style = window.getComputedStyle(bait);
  const hidden = bait.offsetHeight === 0 || bait.offsetParent === null && style.position !== 'fixed' && style.display === 'none'
    || style.display === 'none' || style.visibility === 'hidden';
  bait.remove();
  return hidden;
}

async function probeIsBlocked() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(PROBE_URL, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    return false;
  } catch {
    return true;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function detectAdBlocker(): Promise<boolean> {
  if (typeof document === 'undefined' || !document.body) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (baitIsHidden()) return true;
  return probeIsBlocked();
}
