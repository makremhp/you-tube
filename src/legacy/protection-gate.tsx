import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { apiGet, VPN_BLOCKED_EVENT } from '@/lib/api';
import { detectAdBlocker } from '@/lib/adblock';

type Reason = 'vpn' | 'adblock';

const COPY = {
  ar: {
    vpn: {
      badge: 'اتصال غير مسموح',
      title: 'أوقف VPN للمتابعة',
      body: 'اكتشفنا أنك تستخدم VPN أو بروكسي. لحماية المكافآت والرصيد من التلاعب لا يمكن استخدام المنصة عبر هذه الخدمات. أوقف الـ VPN ثم حدّث الصفحة.',
      steps: ['أوقف تطبيق الـ VPN أو البروكسي من هاتفك.', 'ارجع إلى التطبيق واضغط «تحديث الصفحة».'],
    },
    adblock: {
      badge: 'مانع إعلانات مفعّل',
      title: 'أوقف مانع الإعلانات للمتابعة',
      body: 'المكافآت في المنصة تُموَّل من الإعلانات. عطّل مانع الإعلانات (أو وضع الحماية في المتصفح) لهذا الموقع ثم حدّث الصفحة.',
      steps: ['عطّل مانع الإعلانات أو المتصفح الذي يحجب الإعلانات لهذا الموقع.', 'ارجع إلى التطبيق واضغط «تحديث الصفحة».'],
    },
    reload: 'تحديث الصفحة',
    recheck: 'إعادة التحقق',
    checking: 'جارٍ التحقق…',
    still: 'ما زال الحجب قائمًا. تأكد من إيقاف الخدمة ثم أعد المحاولة.',
  },
  en: {
    vpn: {
      badge: 'CONNECTION NOT ALLOWED',
      title: 'Turn off your VPN to continue',
      body: 'We detected a VPN or proxy. To protect rewards and balances from abuse, the platform can’t be used through these services. Turn the VPN off, then refresh the page.',
      steps: ['Turn off the VPN or proxy app on your device.', 'Come back and tap “Refresh page”.'],
    },
    adblock: {
      badge: 'AD BLOCKER DETECTED',
      title: 'Turn off your ad blocker to continue',
      body: 'Rewards on this platform are funded by ads. Disable your ad blocker (or the browser’s protection mode) for this site, then refresh the page.',
      steps: ['Disable the ad blocker, or the browser mode that blocks ads, for this site.', 'Come back and tap “Refresh page”.'],
    },
    reload: 'Refresh page',
    recheck: 'Check again',
    checking: 'Checking…',
    still: 'The block is still active. Make sure it is turned off, then try again.',
  },
} as const;

const NETWORK_POLL_MS = 30_000;
const ADBLOCK_POLL_MS = 20_000;

export function ProtectionGate({ language, children }: { language: 'ar' | 'en'; children: ReactNode }) {
  const [vpn, setVpn] = useState(false);
  const [adblock, setAdblock] = useState(false);
  const [checking, setChecking] = useState(false);
  const [retried, setRetried] = useState(false);
  const alive = useRef(true);

  const checkVpn = useCallback(async () => {
    try {
      const result = await apiGet<{ vpn: boolean }>('network/check');
      if (alive.current) setVpn(Boolean(result.vpn));
    } catch {
      // فشل الفحص (شبكة/صيانة) لا يحجب المستخدم؛ الخادم يرفض العمليات الحساسة من خلف VPN على أي حال.
    }
  }, []);

  const checkAdblock = useCallback(async () => {
    const blocked = await detectAdBlocker();
    if (alive.current) setAdblock(blocked);
  }, []);

  useEffect(() => {
    alive.current = true;
    void checkVpn();
    void checkAdblock();
    const vpnTimer = window.setInterval(checkVpn, NETWORK_POLL_MS);
    const adTimer = window.setInterval(checkAdblock, ADBLOCK_POLL_MS);
    const onVpn = () => setVpn(true);
    const onFocus = () => { void checkVpn(); void checkAdblock(); };
    window.addEventListener(VPN_BLOCKED_EVENT, onVpn);
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      window.clearInterval(vpnTimer);
      window.clearInterval(adTimer);
      window.removeEventListener(VPN_BLOCKED_EVENT, onVpn);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkVpn, checkAdblock]);

  const reason: Reason | null = vpn ? 'vpn' : adblock ? 'adblock' : null;
  if (!reason) return <>{children}</>;

  const text = COPY[language];
  const block = text[reason];
  const recheck = async () => {
    setChecking(true);
    await Promise.all([checkVpn(), checkAdblock()]);
    if (alive.current) { setChecking(false); setRetried(true); }
  };

  return (
    <main dir={language === 'ar' ? 'rtl' : 'ltr'} role="alertdialog" aria-labelledby="protection-title" aria-describedby="protection-body" className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#101827] px-5 py-8 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(251,191,36,.16),transparent_60%)]" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,.42)] backdrop-blur sm:p-9">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-amber-300/10 text-amber-300"><ShieldAlert className="h-12 w-12" aria-hidden="true" /></div>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />{block.badge}</span>
        <h1 id="protection-title" className="mt-4 text-2xl font-extrabold">{block.title}</h1>
        <p id="protection-body" className="mx-auto mt-3 max-w-sm text-sm leading-7 text-blue-100/70">{block.body}</p>
        <ol className="mx-auto mt-4 max-w-sm space-y-2 text-start text-sm leading-6 text-blue-100/80">
          {block.steps.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><b className="text-amber-300">{index + 1}</b><span>{step}</span></li>
          ))}
        </ol>
        {retried && !checking && <p role="status" className="mt-4 text-xs text-amber-200">{text.still}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-slate-900 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">{text.reload}</button>
          <button type="button" disabled={checking} onClick={recheck} className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{checking ? text.checking : text.recheck}</button>
        </div>
      </section>
    </main>
  );
}
