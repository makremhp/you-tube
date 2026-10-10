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

const ADSTERRA_COUNTDOWN_SECONDS = 30;

// القيم الفعلية (الحد اليومي والمكافأة) تأتي من الخادم وتُحدَّث من لوحة الإدارة؛ هذه قيم احتياطية لحين وصول الردّ.
type AdConfig = {
  adsteraLimit: number;
  adsteraReward: number;
  monetagLimit: number;
  monetagReward: number;
};

const FALLBACK_AD_CONFIG: AdConfig = {
  adsteraLimit: 100,
  adsteraReward: 0.0001,
  monetagLimit: 500,
  monetagReward: 0.0001,
};

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
        adstera: Math.max(0, Number(saved.adstera) || 0),
        monetag: Math.max(0, Number(saved.monetag) || 0),
      };
    }
  } catch {
    // Keep the ads page usable when browser storage is blocked or unavailable.
  }
  return emptyProgress();
}

function formatReward(amount: number) {
  const value = Number(Number(amount).toFixed(6));
  const actualDecimals = (String(value).split('.')[1] ?? '').length;
  const precision = Math.min(6, Math.max(value < 0.001 ? 4 : 3, actualDecimals));
  return `${value.toFixed(precision)} USDT`;
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
  reward,
  onClaim,
  claiming,
  claimError,
  banners,
  socialAds,
}: {
  isArabic: boolean;
  provider: AdProvider;
  reward: number;
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
        description: `ابقَ في هذه الصفحة حتى انتهاء العداد للحصول على ${formatReward(reward)}.`,
        congratulations: 'تهانينا، لقد أكملت عملية التصفح',
        claim: 'استلام المكافأة',
      }
    : {
        eyebrow: `${networkName.toUpperCase()} BROWSING`,
        title: 'Finish browsing to claim your reward.',
        description: `Stay on this page until the countdown ends to receive ${formatReward(reward)}.`,
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
            <p className="mt-2 font-mono text-sm text-[#f6c453]">+{formatReward(reward)}</p>
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
  const progress = limit > 0 ? Math.min(100, Math.round((completed / limit) * 100)) : 100;
  const isMonetagCard = provider === 'monetag';
  const startLabel = isMonetagCard ? (isArabic ? 'شاهد' : 'Watch') : (isArabic ? 'ابدأ التصفح' : 'Start browsing');
  const isMonetag = provider === 'monetag';

  return (
    <section
      data-testid="card-task-adstera"
      className={`relative isolate overflow-hidden rounded-2xl border p-3 text-white shadow-xl transition duration-200 hover:-translate-y-0.5 ${isMonetag?'border-violet-300/35 bg-[radial-gradient(circle_at_94%_0%,rgba(167,139,250,.27),transparent_8rem),linear-gradient(135deg,#31215f_0%,#241943_58%,#17152c_100%)] shadow-violet-950/20':'border-red-400/40 bg-[radial-gradient(circle_at_94%_0%,rgba(248,90,90,.22),transparent_8rem),linear-gradient(135deg,#64221f_0%,#361a20_58%,#1d131e_100%)] shadow-red-950/20'}`}
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
            {label && <span className={`text-[9px] font-bold uppercase tracking-[.13em] ${isMonetag?'text-violet-200':'text-[#f6c453]'}`}>{label}</span>}
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
        {description && <p className="truncate text-[11px] leading-4 text-blue-100/75">{description}</p>}
        <div className="mb-1.5 mt-3 flex items-center justify-between text-[10px] font-semibold text-blue-100/75">
          {isMonetag ? <span /> : <span className="flex items-center gap-1.5">
            <Clock3 size={13} className="text-cyan-200" />
            {`${ADSTERRA_COUNTDOWN_SECONDS} ${isArabic ? 'ثانية' : 'seconds'}`}
          </span>}
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
  credited?: boolean;
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

type MonetagFlow = 'idle' | 'loading' | 'first' | 'second' | 'confirming' | 'error' | 'limit';

export function AdsPage({
  userId,
  onReward,
  onNotify,
}: {
  userId: number | null;
  onReward: (amount: number, title: string, message: string) => void | Promise<void>;
  onNotify?: (tone: 'success' | 'info' | 'warning', title: string, message: string) => void;
}) {
  const { dir, isArabic } = useLanguage();
  const { ads } = useAdsteraAds();
  const storageKey = `vidreward.ads.daily.v1-${userId ?? 'guest'}`;
  const [today, setToday] = useState(getLocalDayKey);
  const [progress, setProgress] = useState(() => loadDailyProgress(storageKey));
  const [config, setConfig] = useState<AdConfig>(FALLBACK_AD_CONFIG);
  const [activeProvider, setActiveProvider] = useState<AdProvider | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [monetagFlow, setMonetagFlow] = useState<MonetagFlow>('idle');
  const monetagSessionRef = useRef<string | null>(null);
  const monetagBusy = monetagFlow === 'loading' || monetagFlow === 'first' || monetagFlow === 'second' || monetagFlow === 'confirming';

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      apiGet<{ claimedToday: number; dailyLimit: number; reward: number }>('ads/progress/adstera'),
      apiGet<{ claimedToday: number; dailyLimit: number; reward: number }>('ads/progress/monetag'),
    ])
      .then(([adstera, monetag]) => {
        setConfig({
          adsteraLimit: Number(adstera.dailyLimit),
          adsteraReward: Number(adstera.reward),
          monetagLimit: Number(monetag.dailyLimit),
          monetagReward: Number(monetag.reward),
        });
        setProgress({
          day: getLocalDayKey(),
          adstera: adstera.claimedToday,
          monetag: monetag.claimedToday,
        });
      })
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
  const limitFor = (provider: AdProvider) => (provider === 'monetag' ? config.monetagLimit : config.adsteraLimit);
  const rewardFor = (provider: AdProvider) => (provider === 'monetag' ? config.monetagReward : config.adsteraReward);

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
        [provider]: result.claimedToday,
      }));
      onReward(result.reward, copy.rewardAdded, copy.rewardMessage(formatReward(result.reward)));
      setActiveProvider(null);
    } catch {
      setClaimError(isArabic ? 'تعذر تسجيل المكافأة. تحقق من اتصالك ثم حاول مجددًا.' : 'Reward could not be recorded. Check your connection and retry.');
    } finally {
      setClaiming(false);
    }
  };

  // Monetag: بعد الضغط على «شاهد» يبدأ الإعلان الأول فورًا، وعند انتهائه يبدأ الثاني تلقائيًا، وبعد إكمال الإعلانين تُمنح المكافأة مباشرة.
  const finishMonetagReward = async (current: MonetagSessionStatus) => {
    setProgress(value => ({
      ...(value.day === getLocalDayKey() ? value : emptyProgress()),
      monetag: current.claimedToday,
    }));
    monetagSessionRef.current = null;
    if (current.rewarded || current.credited) {
      setMonetagFlow('idle');
      await onReward(
        current.reward,
        copy.rewardAdded,
        copy.rewardMessage(formatReward(current.reward)),
      );
      return;
    }
    if (current.settled && current.claimedToday >= current.dailyLimit) {
      setMonetagFlow('limit');
      onNotify?.('warning', isArabic ? 'الحد اليومي' : 'Daily limit', isArabic ? 'اكتمل الإعلانان، لكن الحد اليومي استُخدم قبل تسجيل المكافأة.' : 'Both ads completed, but the daily limit was reached before the reward was recorded.');
      return;
    }
    setMonetagFlow('idle');
  };

  const runMonetagPair = async () => {
    if (monetagBusy) return;
    setMonetagFlow('loading');
    const notifyLoading = () => onNotify?.('info', isArabic ? 'تحميل Monetag' : 'Loading Monetag', '');
    const notifyIncomplete = () => onNotify?.('warning', isArabic ? 'لم يكتمل إعلان' : 'Ad not completed', '');
    let bothWatched = false;
    try {
      const showAd = (window as unknown as { show_11993293?: MonetagShowAd }).show_11993293;
      if (typeof showAd !== 'function') {
        setMonetagFlow('error');
        onNotify?.('warning', isArabic ? 'تحميل Monetag' : 'Loading Monetag', isArabic ? 'لم يتم تحميل إعلان Monetag بعد. حاول مجددًا بعد قليل.' : 'The Monetag SDK has not loaded yet. Try again in a moment.');
        return;
      }

      let session: MonetagSession;
      try {
        session = await apiPost<MonetagSession>('ads/monetag/session', {});
      } catch (error) {
        if (error instanceof Error && /limit/i.test(error.message)) {
          setMonetagFlow('limit');
          onNotify?.('warning', isArabic ? 'الحد اليومي' : 'Daily limit', isArabic ? `وصلت إلى الحد اليومي (${config.monetagLimit}).` : `You have reached the daily limit (${config.monetagLimit}).`);
        } else {
          setMonetagFlow('error');
          onNotify?.('warning', isArabic ? 'تعذر تشغيل الإعلان' : 'Could not start the ad', isArabic
            ? 'تأكد من فتح التطبيق داخل Telegram وحاول مجددًا.'
            : 'Make sure the app is open in Telegram and try again.');
        }
        return;
      }
      monetagSessionRef.current = session.id;
      setConfig(current => ({ ...current, monetagLimit: Number(session.dailyLimit), monetagReward: Number(session.reward) }));
      // نعيد محاولة إبلاغ الخادم عند انقطاع لحظي حتى لا يضيع إعلان شاهده المستخدم فعلًا.
      const reportStep = async (step: 1 | 2) => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return await apiPost(`ads/monetag/session/${encodeURIComponent(session.id)}/complete`, { step });
          } catch (error) {
            lastError = error;
            await new Promise((resolve) => window.setTimeout(resolve, 700));
          }
        }
        throw lastError;
      };

      // الإعلان الأول
      setMonetagFlow('first');
      notifyLoading();
      const first = await showAd({ ymid: `${session.id}_1`, requestVar: `vidreward_${session.id}_1` });
      if (first?.reward_event_type !== 'valued') throw new Error('First ad was not valued');
      // نُبلغ الخادم بإكمال الأول في الخلفية ونبدأ الثاني فورًا بدون انتظار.
      const firstReport = reportStep(1).then(() => true, () => false);

      // الإعلان الثاني يبدأ تلقائيًا
      setMonetagFlow('second');
      notifyLoading();
      const second = await showAd({ ymid: `${session.id}_2`, requestVar: `vidreward_${session.id}_2` });
      if (second?.reward_event_type !== 'valued') throw new Error('Second ad was not valued');
      bothWatched = true;
      setMonetagFlow('confirming');
      if (!(await firstReport)) await reportStep(1);
      const final = await reportStep(2) as MonetagSessionStatus;
      await finishMonetagReward(final);
    } catch {
      if (bothWatched) {
        // شاهد المستخدم الإعلانين فعلًا؛ المشكلة في الاتصال بالخادم فقط، فلا نقول إنه لم يكمل.
        setMonetagFlow('idle');
        return;
      }
      setMonetagFlow('error');
      notifyIncomplete();
    }
  };

  const startProvider = (provider: AdProvider) => {
    const count = daily[provider];
    if ((provider === 'adstera' && !adsFor(provider).length) || count >= limitFor(provider) || activeProvider || monetagBusy) return;
    if (provider === 'monetag') {
      void runMonetagPair();
      return;
    }
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
          const limit = limitFor(provider);
          const reward = rewardFor(provider);
          return <RewardAdCard
            key={provider}
            provider={provider}
            title={provider === 'monetag' && isArabic ? 'شاهد إعلانات مونيتاج' : (isArabic ? `شاهد إعلانات ${name}` : `Watch ${name} ads`)}
            description={provider === 'monetag' ? '' : available
              ? (isArabic ? `شاهد الإعلان لمدة 30 ثانية واربح ${formatReward(reward)} لكل إعلان.` : `Watch for 30 seconds and earn ${formatReward(reward)} per ad.`)
              : (isArabic ? `لا توجد شيفرات ${name} مفعّلة حاليًا.` : `No ${name} ad codes are enabled yet.`)}
            label={provider === 'monetag' ? '' : available ? (isArabic ? 'شاهد واربح' : 'WATCH & EARN') : (isArabic ? 'غير مهيأ' : 'NOT CONFIGURED')}
            reward={reward}
            completed={completed}
            limit={limit}
            blocked={activeProvider !== null || monetagBusy || !available}
            isArabic={isArabic}
            onStart={() => startProvider(provider)}
          />;
        })}
      </div>

      {activeProvider === 'adstera' && (
        <AdsterraExperience
          isArabic={isArabic}
          provider={activeProvider}
          reward={config.adsteraReward}
          banners={activeBannerAds}
          socialAds={activeSocialAds}
          onClaim={() => { void completeAd(activeProvider); }}
          claiming={claiming}
          claimError={claimError}
        />
      )}
    </main>
  );
}
