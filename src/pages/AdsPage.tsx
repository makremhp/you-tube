import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Clock3,
  Gift,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import { apiPost, apiGet } from '@/lib/api';
import {
  buildAdsteraDocument,
  useAdsteraAds,
  type AdProvider,
  type AdsteraAd,
} from '@/lib/adsteraAds';

type DailyProgress = {
  day: string;
  adstera: number;
  monetag: number;
};

const ADSTERRA_REWARD = 0.0001;
const ADSTERRA_DAILY_LIMIT = 100;
const ADSTERRA_COUNTDOWN_SECONDS = 30;

function getLocalDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyProgress(day = getLocalDayKey()): DailyProgress {
  return { day, adstera: 0, monetag: 0 };
}

function loadDailyProgress(storageKey: string): DailyProgress {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<DailyProgress> | null;
    if (saved?.day === getLocalDayKey()) {
      return {
        day: saved.day,
        adstera: Math.min(ADSTERRA_DAILY_LIMIT, Math.max(0, Number(saved.adstera) || 0)),
        monetag: Math.min(500, Math.max(0, Number(saved.monetag) || 0)),
      };
    }
  } catch {
    // Keep the ads page usable when browser storage is blocked or unavailable.
  }
  return emptyProgress();
}

function formatReward(amount: number) {
  const precision = amount < 0.001 ? 4 : 3;
  return `${amount.toFixed(precision)} USDT`;
}

function appendAdsteraBanner(root: HTMLElement, ad: AdsteraAd) {
  const frame = document.createElement('iframe');
  frame.title = `${ad.provider === 'monetag' ? 'Monetag' : 'Adsterra'} ${ad.name}`;
  frame.width = '320';
  frame.height = ad.format === '320x50' ? '50' : '80';
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.style.display = 'block';
  frame.style.maxWidth = '100%';
  frame.style.border = '0';
  frame.dataset.vidrewardAdsteraCode = ad.id;
  frame.srcdoc = buildAdsteraDocument(ad);
  root.appendChild(frame);
}

function appendAdsteraSocialCode(root: HTMLElement, ad: AdsteraAd) {
  const parsedCode = new DOMParser().parseFromString(ad.code, 'text/html');
  const scripts = Array.from(parsedCode.body.querySelectorAll('script'));

  if (scripts.length === 0) {
    root.insertAdjacentHTML('beforeend', ad.code);
    return;
  }

  scripts.forEach((source) => {
    const script = document.createElement('script');
    Array.from(source.attributes).forEach(({ name, value }) => {
      if (name !== 'src' && name !== 'async') script.setAttribute(name, value);
    });
    script.async = false;
    const src = source.getAttribute('src');
    if (src) script.src = new URL(src, document.baseURI).href;
    script.textContent = source.textContent ?? '';
    script.dataset.vidrewardAdstera = ad.id;
    root.appendChild(script);
  });
}

function AdsterraBannerSlot({
  ad,
  active,
  refreshKey,
  index,
}: {
  ad: AdsteraAd;
  active: boolean;
  refreshKey: number;
  index: number;
}) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = slotRef.current;
    if (!root || !active) {
      root?.replaceChildren();
      return;
    }

    root.replaceChildren();
    appendAdsteraBanner(root, ad);
    return () => root.replaceChildren();
  }, [active, ad, refreshKey]);

  return (
    <div
      ref={slotRef}
      data-testid={`adsterra-banner-slot-${ad.id}`}
      data-adsterra-key={ad.id}
      className="flex min-h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] shadow-[0_0_0_1px_rgba(148,163,184,.2)]"
      aria-label={`Adsterra 320 × 50 banner ${index + 1}`}
    />
  );
}

function AdsterraSocialScripts({
  active,
  ads,
  refreshKey,
}: {
  active: boolean;
  ads: AdsteraAd[];
  refreshKey: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.replaceChildren();
    if (active) ads.forEach((ad) => appendAdsteraSocialCode(root, ad));
    return () => root.replaceChildren();
  }, [active, ads, refreshKey]);

  return (
    <div
      ref={rootRef}
      data-testid="adsterra-social-scripts"
      aria-hidden="true"
      className="adstera-social-scripts"
    />
  );
}

function AdsterraExperience({
  isArabic,
  provider,
  onClaim,
  claiming,
  claimError,
  banners,
  socialAds,
}: {
  isArabic: boolean;
  provider: AdProvider;
  onClaim: () => void;
  claiming: boolean;
  claimError: string;
  banners: AdsteraAd[];
  socialAds: AdsteraAd[];
}) {
  const [remaining, setRemaining] = useState(ADSTERRA_COUNTDOWN_SECONDS);
  const [refreshKey, setRefreshKey] = useState(0);
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [active, remaining]);

  useEffect(() => {
    if (!active) return;
    const refreshTimer = window.setInterval(() => setRefreshKey((value) => value + 1), 5000);
    return () => window.clearInterval(refreshTimer);
  }, [active]);

  const networkName = provider === 'monetag' ? 'Monetag' : 'Adsterra';
  const copy = isArabic
    ? {
        eyebrow: `تصفح ${networkName}`,
        title: 'أكمل وقت التصفح واحصل على مكافأتك.',
        description: 'ابقَ في هذه الصفحة حتى انتهاء العداد للحصول على 0.0001 USDT.',
        congratulations: 'تهانينا، لقد أكملت عملية التصفح',
        claim: 'استلام المكافأة',
      }
    : {
        eyebrow: `${networkName.toUpperCase()} BROWSING`,
        title: 'Finish browsing to claim your reward.',
        description: 'Stay on this page until the countdown ends to receive 0.0001 USDT.',
        congratulations: 'You completed the browsing session',
        claim: 'Claim reward',
      };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[80] min-h-dvh overflow-y-auto overscroll-contain bg-[#11172c] text-white"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[390px] flex-col items-center px-4 pb-10 pt-7">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.15em] text-blue-100/70">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f6c453]" />
          {copy.eyebrow}
        </div>
        <div
          data-testid="text-adstera-countdown"
          aria-live="polite"
          className="font-mono text-5xl font-bold tracking-[-.08em] text-[#f6c453]"
        >
          {remaining}
        </div>
        <h1 className="mt-2 text-center text-base font-bold">{copy.title}</h1>
        <p className="mt-1 text-center text-xs leading-5 text-blue-100/65">{copy.description}</p>
        <div data-testid="container-adsterra-banners" className="mt-6 flex w-full flex-col items-center gap-3">
          {banners.map((ad, index) => (
            <AdsterraBannerSlot
              key={`${ad.id}-${refreshKey}`}
              ad={ad}
              active={active}
              refreshKey={refreshKey}
              index={index}
            />
          ))}
          {banners.length === 0 && (
            <p className="rounded-lg border border-white/10 px-4 py-3 text-center text-xs text-blue-100/70">
              {isArabic ? 'لا توجد أكواد بانر مفعّلة حاليًا.' : 'No active banner codes.'}
            </p>
          )}
        </div>
        <AdsterraSocialScripts
          active={active}
          ads={socialAds}
          refreshKey={refreshKey}
        />
      </div>
      {!active && (
        <div
          data-testid="modal-adsterra-complete"
          className="absolute inset-0 flex items-center justify-center bg-[#11172c]/90 p-5 backdrop-blur-sm"
        >
          <section className="w-full max-w-sm rounded-[1.6rem] border border-[#f6c453]/30 bg-[#15243c] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-300">
              <BadgeCheck size={28} />
            </div>
            <h2 className="mt-5 text-lg font-bold">{copy.congratulations}</h2>
            <p className="mt-2 font-mono text-sm text-[#f6c453]">+{formatReward(ADSTERRA_REWARD)}</p>
            {claimError && <p role="alert" className="mt-3 text-xs text-rose-200">{claimError}</p>}
            <button
              type="button"
              data-testid="button-claim-adstera"
              onClick={onClaim}
              disabled={claiming}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f6c453] text-sm font-bold text-[#17213a] transition hover:bg-[#ffdc7e] disabled:cursor-wait disabled:opacity-60"
            >
              <Gift size={17} />
              {claiming ? (isArabic ? 'جارٍ تسجيل المكافأة…' : 'Recording reward…') : copy.claim}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function RewardAdCard({
  title,
  description,
  provider,
  label,
  reward,
  completed,
  limit,
  blocked,
  isArabic,
  onStart,
}: {
  title: string;
  description: string;
  provider: AdProvider;
  label: string;
  reward: number;
  completed: number;
  limit: number;
  blocked: boolean;
  isArabic: boolean;
  onStart: () => void;
}) {
  const isComplete = completed >= limit;
  const progress = Math.min(100, Math.round((completed / limit) * 100));
  const isMonetagCard = provider === 'monetag';
  const startLabel = isMonetagCard ? (isArabic ? 'شاهد' : 'Watch') : (isArabic ? 'ابدأ التصفح' : 'Start browsing');
  const isMonetag = provider === 'monetag';

  return (
    <section
      data-testid="card-task-adstera"
      className={`relative isolate overflow-hidden rounded-2xl border p-3 text-white shadow-xl transition duration-200 hover:-translate-y-0.5 ${isMonetag?'border-violet-300/35 bg-[radial-gradient(circle_at_94%_0%,rgba(167,139,250,.27),transparent_8rem),linear-gradient(135deg,#31215f_0%,#241943_58%,#17152c_100%)] shadow-violet-950/20':'border-red-400/40 bg-[radial-gradient(circle_at_94%_0%,rgba(248,90,90,.22),transparent_8rem),linear-gradient(135deg,#64221f_0%,#361a20_58%,#1d131e_100%)] shadow-red-950/20'} ${blocked ? 'opacity-60' : ''}`}
    >
      <div className="relative z-10 flex items-center gap-3 rounded-xl px-1.5 py-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
            <img
            src={`${import.meta.env.BASE_URL}assets/${isMonetag ? 'monetag-logo.jpg' : 'adstera-logo.jpeg'}`}
            alt={isMonetag ? 'Monetag' : 'Adsterra'}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-[.13em] ${isMonetag?'text-violet-200':'text-[#f6c453]'}`}>{label}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-blue-100/75">
              {isMonetag?'Monetag':'Adsterra'}
            </span>
          </div>
          <h2 className="truncate text-sm font-bold">{title}</h2>
        </div>
        <span className="shrink-0 rounded-xl bg-[#f6c453] px-2.5 py-1.5 text-center font-mono text-[10px] font-bold leading-4 text-[#17213a]">
          +{formatReward(reward)}
        </span>
      </div>

      <div className="relative z-10 mt-2 px-1">
        <p className="truncate text-[11px] leading-4 text-blue-100/75">{description}</p>
        <div className="mb-1.5 mt-3 flex items-center justify-between text-[10px] font-semibold text-blue-100/75">
          <span className="flex items-center gap-1.5">
            <Clock3 size={13} className="text-cyan-200" />
            {isMonetag ? (isArabic ? 'إعلانان متتاليان' : '2 ads in a row') : `${ADSTERRA_COUNTDOWN_SECONDS} ${isArabic ? 'ثانية' : 'seconds'}`}
          </span>
          <span data-testid="text-task-limit-adstera" className="font-mono">
            {completed} / {limit} {isArabic ? 'اليوم' : 'today'}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className={`h-full transition-[width] duration-500 ${isMonetag?'bg-violet-300':'bg-[#f6c453]'}`} style={{ width: `${Math.max(progress, progress > 0 ? 4 : 2)}%` }} />
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between gap-3 px-1">
        <span className="text-[10px] text-blue-100/65">{isArabic ? 'يتجدد يومياً' : 'Resets daily'}</span>
        {isComplete ? (
          <span data-testid="status-task-completed-adstera" className="flex min-h-9 items-center gap-1.5 text-xs font-bold text-emerald-300">
            <BadgeCheck size={16} />
            {isArabic ? 'اكتملت اليوم' : 'Done for today'}
          </span>
        ) : (
          <button
            type="button"
            disabled={blocked}
            data-testid="button-start-task-adstera"
            onClick={onStart}
            className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-bold transition active:scale-[.98] disabled:cursor-not-allowed ${isMonetag?'bg-violet-300 text-[#201544] hover:bg-violet-200':'bg-[#f6c453] text-[#17213a] hover:bg-[#ffdc7e]'}`}
          >
            <Zap size={14} />
            {startLabel}
          </button>
        )}
      </div>
    </section>
  );
}

type MonetagSession = {
  id: string;
  claimedToday: number;
  dailyLimit: number;
  reward: number;
};

type MonetagSessionStatus = {
  rewarded: boolean;
  settled: boolean;
  claimedToday: number;
  dailyLimit: number;
  reward: number;
};

type MonetagSdkResult = {
  reward_event_type?: string;
  event_type?: string;
  variable2?: string;
} | void;

type MonetagShowAd = (options: { ymid: string; requestVar: string }) => Promise<MonetagSdkResult>;

function MonetagExperience({
  isArabic,
  onReward,
  onDismiss,
  onProgress,
}: {
  isArabic: boolean;
  onReward: (amount: number, title: string, message: string) => void | Promise<void>;
  onDismiss: () => void;
  onProgress: (count: number) => void;
}) {
  const [session, setSession] = useState<MonetagSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'showing-first' | 'showing-second' | 'confirming' | 'pending' | 'error' | 'limit'>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const showError = isArabic
    ? 'تعذر تشغيل الإعلان. تأكد من فتح التطبيق داخل Telegram وحاول مجددًا.'
    : 'Could not start the ad. Make sure the app is open in Telegram and try again.';

  const createSession = async () => {
    setBusy(true);
    setMessage('');
    setStatus('loading');
    try {
      const created = await apiPost<MonetagSession>('ads/monetag/session', {});
      setSession(created);
      setStatus('ready');
    } catch (error) {
      if (error instanceof Error && /limit/i.test(error.message)) {
        setStatus('limit');
        setMessage(isArabic ? 'وصلت إلى الحد اليومي البالغ 500 مكافأة.' : 'You have reached the daily limit of 500 rewards.');
      } else {
        setStatus('error');
        setMessage(showError);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void createSession(); }, []);

  const pollForReward = async (sessionId: string) => {
    setStatus('confirming');
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const current = await apiGet<MonetagSessionStatus>(`ads/monetag/session/${encodeURIComponent(sessionId)}`);
      onProgress(current.claimedToday);
      if (current.rewarded) {
        await onReward(
          current.reward,
          isArabic ? 'تمت إضافة المكافأة' : 'Reward added',
          isArabic ? `أُضيفت ${formatReward(current.reward)} إلى رصيدك بعد تأكيد الإعلانين.` : `${formatReward(current.reward)} was added after both ads were confirmed.`,
        );
        onDismiss();
        return;
      }
      if (current.settled && current.claimedToday >= current.dailyLimit) {
        setStatus('limit');
        setMessage(isArabic ? 'اكتمل الإعلانان، لكن الحد اليومي استُخدم قبل تسجيل المكافأة.' : 'Both ads completed, but the daily limit was reached before the reward was recorded.');
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    setStatus('pending');
    setMessage(isArabic
      ? 'تم إرسال إكمال الإعلانين. ننتظر تأكيد Monetag؛ يمكنك التحقق مجددًا بعد قليل.'
      : 'Both ad completions were submitted. Waiting for Monetag confirmation; check again shortly.');
  };

  const startPair = async () => {
    if (!session || busy) return;
    const showAd = (window as unknown as { show_11993293?: MonetagShowAd }).show_11993293;
    if (typeof showAd !== 'function') {
      setStatus('error');
      setMessage(isArabic ? 'لم يتم تحميل إعلان Monetag بعد. أعد فتح النافذة بعد قليل.' : 'The Monetag SDK has not loaded yet. Reopen this panel in a moment.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      setStatus('showing-first');
      const firstYmid = `${session.id}_1`;
      const first = await showAd({ ymid: firstYmid, requestVar: `vidreward_${session.id}_1` });
      if (first?.reward_event_type !== 'valued') throw new Error('First ad was not valued');
      await apiPost(`ads/monetag/session/${encodeURIComponent(session.id)}/complete`, { step: 1 });

      setStatus('showing-second');
      const secondYmid = `${session.id}_2`;
      const second = await showAd({ ymid: secondYmid, requestVar: `vidreward_${session.id}_2` });
      if (second?.reward_event_type !== 'valued') throw new Error('Second ad was not valued');
      await apiPost(`ads/monetag/session/${encodeURIComponent(session.id)}/complete`, { step: 2 });
      await pollForReward(session.id);
    } catch {
      setStatus('error');
      setMessage(isArabic
        ? 'لم يكتمل الإعلانان معًا، لذلك لم تُمنح المكافأة. ابدأ زوجًا جديدًا للمحاولة مرة أخرى.'
        : 'Both ads were not completed, so no reward was issued. Start a new pair to try again.');
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      await pollForReward(session.id);
    } catch {
      setStatus('pending');
      setMessage(isArabic ? 'تعذر التحقق الآن. حاول مجددًا بعد قليل.' : 'Could not check the status. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    title: isArabic ? 'أكمل الإعلانين لتحصل على مكافأة' : 'Complete both ads to earn a reward',
    instructions: isArabic
      ? 'سيظهر الإعلان الأول، ثم يبدأ الثاني تلقائيًا بعد اكتماله. تُضاف المكافأة فقط بعد تأكيد Monetag للإعلانين.'
      : 'The first ad will appear, then the second starts automatically. The reward is issued only after Monetag confirms both ads.',
    start: isArabic ? 'ابدأ الإعلانين' : 'Start both ads',
    preparing: isArabic ? 'جارٍ تجهيز جلسة الإعلان…' : 'Preparing your ad session…',
    first: isArabic ? 'جارٍ عرض الإعلان الأول…' : 'Showing the first ad…',
    second: isArabic ? 'اكتمل الأول، جارٍ عرض الإعلان الثاني…' : 'First ad complete; showing the second…',
    confirming: isArabic ? 'جارٍ انتظار تأكيد Monetag…' : 'Waiting for Monetag confirmation…',
    retry: isArabic ? 'ابدأ زوج إعلانات جديدًا' : 'Start a new ad pair',
    check: isArabic ? 'تحقق من المكافأة' : 'Check reward status',
    close: isArabic ? 'إغلاق' : 'Close',
  };

  return (
    <div className="fixed inset-0 z-[80] grid min-h-dvh place-items-center overflow-y-auto bg-[#11172c]/95 p-4 text-white backdrop-blur-sm" dir={isArabic ? 'rtl' : 'ltr'}>
      <section className="w-full max-w-md rounded-[1.75rem] border border-violet-200/15 bg-[#1b1b35] p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-300/15 text-violet-200"><Zap size={25} /></div>
        <h2 className="mt-5 text-xl font-extrabold">{copy.title}</h2>
        <p className="mt-3 text-sm leading-6 text-blue-100/70">{copy.instructions}</p>
        <p className="mt-4 font-mono text-sm font-bold text-violet-200">+{formatReward(session?.reward ?? 0.0001)}</p>
        <div aria-live="polite" className="mt-5 min-h-6 text-xs font-semibold text-blue-100/80">
          {status === 'loading' && copy.preparing}
          {status === 'showing-first' && copy.first}
          {status === 'showing-second' && copy.second}
          {status === 'confirming' && copy.confirming}
          {message && <span role={status === 'error' || status === 'limit' ? 'alert' : 'status'}>{message}</span>}
        </div>
        {(status === 'ready' || status === 'error') && (
          <button type="button" onClick={status === 'error' ? () => void createSession() : () => void startPair()} disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-violet-300 px-4 text-sm font-extrabold text-[#201544] transition hover:bg-violet-200 disabled:opacity-50">{status === 'error' ? copy.retry : copy.start}</button>
        )}
        {status === 'pending' && <button type="button" onClick={() => void checkStatus()} disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-violet-300 px-4 text-sm font-extrabold text-[#201544] disabled:opacity-50">{busy ? copy.confirming : copy.check}</button>}
        <button type="button" onClick={onDismiss} disabled={busy} className="mt-3 min-h-10 px-4 text-xs font-bold text-blue-100/60 hover:text-white disabled:opacity-40">{copy.close}</button>
      </section>
    </div>
  );
}

export function AdsPage({
  userId,
  onReward,
}: {
  userId: number | null;
  onReward: (amount: number, title: string, message: string) => void;
}) {
  const { dir, isArabic } = useLanguage();
  const { ads } = useAdsteraAds();
  const storageKey = `vidreward.ads.daily.v1-${userId ?? 'guest'}`;
  const [today, setToday] = useState(getLocalDayKey);
  const [progress, setProgress] = useState(() => loadDailyProgress(storageKey));
  const [activeProvider, setActiveProvider] = useState<AdProvider | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      apiGet<{ claimedToday: number }>('ads/progress/adstera'),
      apiGet<{ claimedToday: number }>('ads/progress/monetag'),
    ])
      .then(([adstera, monetag]) => setProgress({
        day: getLocalDayKey(),
        adstera: Math.min(ADSTERRA_DAILY_LIMIT, adstera.claimedToday),
        monetag: Math.min(500, monetag.claimedToday),
      }))
      .catch(() => undefined);
  }, [userId, today]);

  useEffect(() => {
    const interval = window.setInterval(() => setToday(getLocalDayKey()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setProgress(loadDailyProgress(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (progress.day !== today) setProgress(emptyProgress(today));
  }, [progress.day, today]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      // The ad list still works for the current session if storage is unavailable.
    }
  }, [progress, storageKey]);

  const daily = progress.day === today ? progress : emptyProgress(today);
  const adsFor = (provider: AdProvider) => ads.filter((ad) => ad.enabled && ad.provider === provider);
  const activeBannerAds = activeProvider ? adsFor(activeProvider).filter((ad) => ad.format === '320x50') : [];
  const activeSocialAds = activeProvider ? adsFor(activeProvider).filter((ad) => ad.format === 'social') : [];
  const hasActiveExperienceAds = activeBannerAds.length > 0 || activeSocialAds.length > 0;

  useEffect(() => {
    if (activeProvider === 'adstera' && !hasActiveExperienceAds) setActiveProvider(null);
  }, [activeProvider, hasActiveExperienceAds]);

  const copy = isArabic
    ? {
        eyebrow: 'إعلانات Adsterra و Monetag',
        title: 'شاهد الإعلان واحصل على مكافأتك.',
        description: 'أكمل جلسة الإعلان لتحصل على مكافأة تُضاف إلى رصيدك بعد تسجيلها على الخادم.',
        rewardAdded: 'تمت إضافة المكافأة',
        rewardMessage: (reward: string) => `أُضيفت ${reward} إلى رصيدك.`,
      }
    : {
        eyebrow: 'ADSTERRA & MONETAG ADS',
        title: 'Watch the ad and earn your reward.',
        description: 'Complete an ad session to earn a reward after it is recorded by the server.',
        rewardAdded: 'Reward added',
        rewardMessage: (reward: string) => `${reward} was added to your balance.`,
      };

  const completeAd = async (provider: AdProvider | null) => {
    if (provider !== 'adstera' || !hasActiveExperienceAds) {
      setActiveProvider(null);
      return;
    }
    if (claiming) return;
    setClaiming(true);
    setClaimError('');
    try {
      const result = await apiPost<{ reward: number; claimedToday: number }>('ads/reward/adstera', {});
      setProgress(current => ({
        ...(current.day === getLocalDayKey() ? current : emptyProgress()),
        [provider]: Math.min(ADSTERRA_DAILY_LIMIT, result.claimedToday),
      }));
      onReward(result.reward, copy.rewardAdded, copy.rewardMessage(formatReward(result.reward)));
      setActiveProvider(null);
    } catch {
      setClaimError(isArabic ? 'تعذر تسجيل المكافأة. تحقق من اتصالك ثم حاول مجددًا.' : 'Reward could not be recorded. Check your connection and retry.');
    } finally {
      setClaiming(false);
    }
  };

  const startProvider = (provider: AdProvider) => {
    const count = daily[provider];
    const limit = provider === 'monetag' ? 500 : ADSTERRA_DAILY_LIMIT;
    if ((provider === 'adstera' && !adsFor(provider).length) || count >= limit || activeProvider) return;
    setClaimError('');
    setActiveProvider(provider);
  };

  return (
    <main data-testid="page-ads" aria-label={isArabic ? 'الإعلانات' : 'Ads'} dir={dir} className="mx-auto min-h-[calc(100dvh-7rem)] w-full max-w-[980px] px-4 pb-28 pt-7 text-[#12234b] md:px-8 md:pt-10">
      <section className="animate-rise">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#1557ee]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#23bdc9]" />
          {copy.eyebrow}
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#12234b] sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{copy.description}</p>
      </section>

      <div className="mt-4 space-y-3">
        {(['adstera','monetag'] as const).map(provider => {
          const available = provider === 'monetag' || adsFor(provider).length > 0;
          const name = provider === 'monetag' ? 'Monetag' : 'Adsterra';
          const completed = daily[provider];
          const limit = provider === 'monetag' ? 500 : ADSTERRA_DAILY_LIMIT;
          return <RewardAdCard
            key={provider}
            provider={provider}
            title={isArabic ? `شاهد إعلانات ${name}` : `Watch ${name} ads`}
            description={available
              ? (provider === 'monetag'
                ? (isArabic ? 'شاهد إعلانين متتاليين لإكمال زوج واحد وربح 0.0001 USDT.' : 'Watch two consecutive ads to complete one pair and earn 0.0001 USDT.')
                : (isArabic ? `شاهد الإعلان لمدة 30 ثانية واربح 0.0001 USDT لكل إعلان.` : 'Watch for 30 seconds and earn 0.0001 USDT per ad.'))
              : (isArabic ? `لا توجد شيفرات ${name} مفعّلة حاليًا.` : `No ${name} ad codes are enabled yet.`)}
            label={available ? (isArabic ? 'شاهد واربح' : 'WATCH & EARN') : (isArabic ? 'غير مهيأ' : 'NOT CONFIGURED')}
            reward={ADSTERRA_REWARD}
            completed={completed}
            limit={limit}
            blocked={activeProvider !== null || !available}
            isArabic={isArabic}
            onStart={() => startProvider(provider)}
          />;
        })}
      </div>

      {activeProvider === 'adstera' && (
        <AdsterraExperience
          isArabic={isArabic}
          provider={activeProvider}
          banners={activeBannerAds}
          socialAds={activeSocialAds}
          onClaim={() => { void completeAd(activeProvider); }}
          claiming={claiming}
          claimError={claimError}
        />
      )}
      {activeProvider === 'monetag' && (
        <MonetagExperience
          isArabic={isArabic}
          onReward={onReward}
          onDismiss={() => setActiveProvider(null)}
          onProgress={(count) => setProgress(current => ({
            ...(current.day === getLocalDayKey() ? current : emptyProgress()),
            monetag: Math.min(500, count),
          }))}
        />
      )}
    </main>
  );
}