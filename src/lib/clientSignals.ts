/*
 * إشارات الجهاز والشبكة التي يرسلها العميل مع كل طلب:
 *  - بصمة الجهاز (SHA-256): سمات عتادية وشاشة ومتصفح. تُستخدم لمنع تعدد الحسابات على نفس الجهاز.
 *  - المنطقة الزمنية: تُقارن في الخادم بموقع الـ IP لكشف إضافات VPN في المتصفح.
 *  - عناوين WebRTC العامة: إضافات VPN المجانية كثيرًا ما تُمرّر HTTP فقط فيظهر عنوان الشبكة الحقيقية هنا.
 * كلها إشارات من جهة العميل؛ القرار النهائي دائمًا في الخادم.
 */

export type ClientSignals = { fingerprint: string; timezone: string; webrtcIps: string };

const STUN_SERVERS = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'];
const WEBRTC_TIMEOUT_MS = 2500;
const SIGNALS_WAIT_MS = 1500;

function fallbackHash(input: string) {
  // مسار احتياطي عند غياب crypto.subtle (سياق غير آمن): 4 تجزئات FNV بعروض مختلفة تُنتج 64 خانة سداسية.
  let out = '';
  for (let seed = 0; seed < 8; seed += 1) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

async function sha256Hex(input: string) {
  try {
    if (window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // يستمر على المسار الاحتياطي.
  }
  return fallbackHash(input);
}

function canvasTrait() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 40;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.textBaseline = 'top';
    context.font = "16px 'Arial'";
    context.fillStyle = '#f60';
    context.fillRect(10, 5, 90, 25);
    context.fillStyle = '#069';
    context.fillText('vidreward-fp-\u2713\u0639\u0631\u0628\u064a', 4, 8);
    context.fillStyle = 'rgba(102,204,0,.7)';
    context.fillText('vidreward-fp-\u2713\u0639\u0631\u0628\u064a', 6, 10);
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function webglTrait() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}|${renderer}|${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`;
  } catch {
    return '';
  }
}

async function computeFingerprint() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const traits = [
    navigator.userAgent,
    navigator.platform,
    navigator.hardwareConcurrency ?? '',
    nav.deviceMemory ?? '',
    navigator.maxTouchPoints ?? '',
    `${screen.width}x${screen.height}x${screen.colorDepth}@${window.devicePixelRatio}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    (navigator.languages ?? [navigator.language]).join(','),
    webglTrait(),
    canvasTrait(),
  ];
  return sha256Hex(traits.join('||'));
}

function publicIpFromCandidate(candidate: string) {
  // مثال: "candidate:842163049 1 udp 1677729535 203.0.113.9 56143 typ srflx raddr 0.0.0.0 rport 0"
  if (!/ typ srflx /.test(candidate)) return null;
  const parts = candidate.split(' ');
  const address = parts[4];
  return address && /^[0-9a-f:.]+$/i.test(address) ? address.toLowerCase() : null;
}

function collectWebrtcIps(): Promise<string[]> {
  return new Promise((resolve) => {
    const Peer = window.RTCPeerConnection;
    if (!Peer) {
      resolve([]);
      return;
    }
    const found = new Set<string>();
    let pc: RTCPeerConnection | null = null;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      try { pc?.close(); } catch { /* ignore */ }
      resolve([...found].slice(0, 4));
    };
    const timer = window.setTimeout(finish, WEBRTC_TIMEOUT_MS);
    try {
      pc = new Peer({ iceServers: [{ urls: STUN_SERVERS }] });
      pc.createDataChannel('probe');
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          finish();
          return;
        }
        const ip = publicIpFromCandidate(event.candidate.candidate);
        if (ip) found.add(ip);
      };
      pc.createOffer()
        .then((offer) => pc?.setLocalDescription(offer))
        .catch(finish);
    } catch {
      finish();
    }
  });
}

let fingerprintPromise: Promise<string> | null = null;
let webrtcPromise: Promise<string[]> | null = null;

export function startClientSignals() {
  fingerprintPromise ??= computeFingerprint().catch(() => '');
  webrtcPromise ??= collectWebrtcIps().catch(() => []);
}

function within<T>(promise: Promise<T>, fallback: T, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))]);
}

/*
 * ينتظر الإشارات بحد أقصى قصير حتى لا يتأخر أول طلب. البصمة سريعة وتنتظر أطول؛ أما WebRTC فإن لم يجهز يُرسل الطلب
 * بدونه (الخادم يعامل غياب الإشارة على أنه «لا معلومة» وليس إدانة).
 */
export async function getClientSignals(): Promise<ClientSignals> {
  startClientSignals();
  const [fingerprint, ips] = await Promise.all([
    within(fingerprintPromise!, '', SIGNALS_WAIT_MS * 2),
    within(webrtcPromise!, [] as string[], SIGNALS_WAIT_MS),
  ]);
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timezone = '';
  }
  return { fingerprint, timezone, webrtcIps: ips.join(',') };
}

if (typeof window !== 'undefined') startClientSignals();
