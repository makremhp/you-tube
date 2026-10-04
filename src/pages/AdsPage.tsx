import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Clock3,
  Gift,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import {
  buildAdsteraDocument,
  useAdsteraAds,
  type AdsteraAd,
} from '@/lib/adsteraAds';

type DailyProgress = {
  day: string;
  adstera: number;
};

const ADSTERRA_REWARD = 0.0005;
const ADSTERRA_DAILY_LIMIT = 100;
const ADSTERRA_COUNTDOWN_SECONDS = 30;

function getLocalDayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyProgress(day = getLocalDayKey()): DailyProgress {
  return { day, adstera: 0 };
}

function loadDailyProgress(storageKey: string): DailyProgress {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<DailyProgress> | null;
    if (saved?.day === getLocalDayKey()) {
      return {
        day: saved.day,
        adstera: Math.min(ADSTERRA_DAILY_LIMIT, Math.max(0, Number(saved.adstera) || 0)),
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

function appendIsolatedAd(root: HTMLElement, ad: AdsteraAd) {
  const frame = document.createElement('iframe');
  frame.title = `Adsterra ${ad.name}`;
  frame.width = '320';
  frame.height = ad.format === '320x50' ? '50' : '80';
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.style.display = 'block';
  frame.style.maxWidth = '100%';
  frame.style.border = '0';
  frame.dataset.vidrewardAdsteraCode = ad.id;
  frame.srcdoc = buildAdsteraDocument(ad);
  root.appendChild(frame);
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
    appendIsolatedAd(root, ad);
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

function AdsterraSocialScripts({ active, ads }: { active: boolean; ads: AdsteraAd[] }) {
  useEffect(() => {
    if (!active || ads.length === 0) return;

    let currentIndex = 0;
    let frame: HTMLIFrameElement | null = null;
    const showScript = (index: number) => {
      const ad = ads[index];
      frame?.remove();
      if (!ad) return;

      // The ad is attached to the task page body in its own disposable context.
      frame = document.createElement('iframe');
      frame.title = `Adsterra social ad ${ad.name}`;
      frame.width = '320';
      frame.height = '80';
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.referrerPolicy = 'no-referrer';
      frame.style.cssText = 'position:fixed;right:16px;bottom:16px;display:block;width:min(320px,calc(100vw - 32px));height:80px;border:0;z-index:90;background:transparent';
      frame.dataset.vidrewardAdsteraSocial = ad.id;
      frame.srcdoc = buildAdsteraDocument(ad);
      document.body.appendChild(frame);
    };

    showScript(currentIndex);
    const rotationTimer = window.setInterval(() => {
      currentIndex = (currentIndex + 1) % ads.length;
      showScript(currentIndex);
    }, 3000);

    return () => {
      window.clearInterval(rotationTimer);
      frame?.remove();
    };
  }, [active, ads]);

  return null;
}

function AdsterraExperience({
  isArabic,
  onClaim,
  banners,
  socialAds,
}: {
  isArabic: boolean;
  onClaim: () => void;
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

  const copy = isArabic
    ? {
        eyebrow: 'تصفح Adsterra',
        title: 'أكمل وقت التصفح واحصل على مكافأتك.',
        description: 'ابقَ في هذه الصفحة حتى انتهاء العداد للحصول على 0.0005 USDT.',
        congratulations: 'تهانينا، لقد أكملت عملية التصفح',
        claim: 'استلام المكافأة',
      }
    : {
        eyebrow: 'ADSTERRA BROWSING',
        title: 'Finish browsing to claim your reward.',
        description: 'Stay on this page until the countdown ends to receive 0.0005 USDT.',
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
        <AdsterraSocialScripts active={active} ads={socialAds} />
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
            <button
              type="button"
              data-testid="button-claim-adstera"
              onClick={onClaim}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f6c453] text-sm font-bold text-[#17213a] transition hover:bg-[#ffdc7e]"
            >
              <Gift size={17} />
              {copy.claim}
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
  const startLabel = isArabic ? 'ابدأ التصفح' : 'Start browsing';

  return (
    <section
      data-testid="card-task-adstera"
      className={`relative isolate overflow-hidden rounded-2xl border border-red-400/40 bg-[radial-gradient(circle_at_94%_0%,rgba(248,90,90,.22),transparent_8rem),linear-gradient(135deg,#64221f_0%,#361a20_58%,#1d131e_100%)] p-3 text-white shadow-xl shadow-red-950/20 transition duration-200 hover:-translate-y-0.5 ${blocked ? 'opacity-60' : ''}`}
    >
      <div className="relative z-10 flex items-center gap-3 rounded-xl px-1.5 py-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
          <img
            src={`${import.meta.env.BASE_URL}assets/adstera-logo.jpeg`}
            alt="Adsterra"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#f6c453]">{label}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-blue-100/75">
              Adsterra
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
            {ADSTERRA_COUNTDOWN_SECONDS} {isArabic ? 'ثانية' : 'seconds'}
          </span>
          <span data-testid="text-task-limit-adstera" className="font-mono">
            {completed} / {limit} {isArabic ? 'اليوم' : 'today'}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#f6c453] transition-[width] duration-500" style={{ width: `${Math.max(progress, progress > 0 ? 4 : 2)}%` }} />
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
            className="flex min-h-9 items-center gap-2 rounded-lg bg-[#f6c453] px-3 text-[11px] font-bold text-[#17213a] transition hover:bg-[#ffdc7e] active:scale-[.98] disabled:cursor-not-allowed"
          >
            <Zap size={14} />
            {startLabel}
          </button>
        )}
      </div>
    </section>
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
  const [adsteraOpen, setAdsteraOpen] = useState(false);

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
  const activeBannerAds = ads.filter((ad) => ad.enabled && ad.format === '320x50');
  const activeSocialAds = ads.filter((ad) => ad.enabled && ad.format === 'social');
  const hasActiveAds = activeBannerAds.length > 0 || activeSocialAds.length > 0;

  useEffect(() => {
    if (!hasActiveAds) setAdsteraOpen(false);
  }, [hasActiveAds]);

  const copy = isArabic
    ? {
        eyebrow: 'إعلانات Adsterra',
        title: 'شاهد الإعلان واحصل على مكافأتك.',
        description: 'تصفح البنرات الإعلانية واحصل على مكافأتك بعد إكمال الوقت.',
        adsteraTitle: 'تصفح إعلانات Adsterra',
        adsteraDescription: hasActiveAds
          ? 'تصفح صفحة Adsterra لمدة 30 ثانية واحصل على مكافأة 0.0005 USDT.'
          : 'لا توجد أكواد Adsterra مفعّلة حاليًا.',
        adsteraLabel: hasActiveAds ? 'تصفح لمدة 30 ثانية' : 'لا توجد إعلانات متاحة',
        rewardAdded: 'تمت إضافة المكافأة',
        rewardMessage: (reward: string) => `أُضيفت ${reward} إلى رصيدك.`,
      }
    : {
        eyebrow: 'ADSTERRA ADS',
        title: 'Watch the ad and earn your reward.',
        description: 'Browse the banner ads and earn your reward after completing the countdown.',
        adsteraTitle: 'Browse Adsterra',
        adsteraDescription: hasActiveAds
          ? 'Browse the Adsterra page for 30 seconds and receive 0.0005 USDT.'
          : 'No Adsterra codes are active right now.',
        adsteraLabel: hasActiveAds ? '30-second browse' : 'No ads available',
        rewardAdded: 'Reward added',
        rewardMessage: (reward: string) => `${reward} was added to your balance.`,
      };

  const completeAd = () => {
    if (!hasActiveAds) {
      setAdsteraOpen(false);
      return;
    }
    const current = progress.day === getLocalDayKey() ? progress : emptyProgress();
    if (current.adstera >= ADSTERRA_DAILY_LIMIT) return;

    setProgress({
      ...current,
      adstera: current.adstera + 1,
    });
    onReward(ADSTERRA_REWARD, copy.rewardAdded, copy.rewardMessage(formatReward(ADSTERRA_REWARD)));
  };

  const startAdstera = () => {
    if (!hasActiveAds || daily.adstera >= ADSTERRA_DAILY_LIMIT || adsteraOpen) return;
    setAdsteraOpen(true);
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
        <RewardAdCard
          title={copy.adsteraTitle}
          description={copy.adsteraDescription}
          label={copy.adsteraLabel}
          reward={ADSTERRA_REWARD}
          completed={daily.adstera}
          limit={ADSTERRA_DAILY_LIMIT}
          blocked={adsteraOpen || !hasActiveAds}
          isArabic={isArabic}
          onStart={startAdstera}
        />
      </div>

      {adsteraOpen && (
        <AdsterraExperience
          isArabic={isArabic}
          banners={activeBannerAds}
          socialAds={activeSocialAds}
          onClaim={() => {
            completeAd();
            setAdsteraOpen(false);
          }}
        />
      )}
    </main>
  );
}