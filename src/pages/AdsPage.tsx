import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Clock3,
  Gift,
  LockKeyhole,
  Play,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/i18n';

type AdProvider = 'adsgram' | 'adstera';
type DailyProgress = {
  day: string;
  adsgram: number;
  adstera: number;
};

type AdScriptDefinition = {
  src: string;
  options?: {
    key: string;
    format: 'iframe';
    height: number;
    width: number;
    params: Record<string, never>;
  };
};

const ADSGRAM_REWARD = 0.002;
const ADSGRAM_DAILY_LIMIT = 10;
const ADSTERRA_REWARD = 0.0005;
const ADSTERRA_DAILY_LIMIT = 100;
const ADSTERRA_COUNTDOWN_SECONDS = 30;
const ADSGRAM_DURATION_SECONDS = 30;

const ADSTERRA_SCRIPT_BATCH: AdScriptDefinition[] = [
  { src: 'https://interventioncopiedloitering.com/b895987c82805b8778a34f54911e8de0/invoke.js', options: { key: 'b895987c82805b8778a34f54911e8de0', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/ab4615d3d759a81e9b876abbcebaf690/invoke.js', options: { key: 'ab4615d3d759a81e9b876abbcebaf690', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/3b49398bb9242d548c0464f244b621fa/invoke.js', options: { key: '3b49398bb9242d548c0464f244b621fa', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/b3570e82f7fb6c462dfdfded816f1576/invoke.js', options: { key: 'b3570e82f7fb6c462dfdfded816f1576', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/de29a44d70992e967ae5d20275e77fab/invoke.js', options: { key: 'de29a44d70992e967ae5d20275e77fab', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/280eab7c354ed87595a376b2f5e270cb/invoke.js', options: { key: '280eab7c354ed87595a376b2f5e270cb', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/d47f719464108005a03a03e6d49fba1a/invoke.js', options: { key: 'd47f719464108005a03a03e6d49fba1a', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/04bcf6532017b6790ab2ddac95a5621d/invoke.js', options: { key: '04bcf6532017b6790ab2ddac95a5621d', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/8c0574e870e5a3843e89d947bd38aaff/invoke.js', options: { key: '8c0574e870e5a3843e89d947bd38aaff', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/9f6fe4084cb3d8a8eb4d8246ee57ed25/invoke.js', options: { key: '9f6fe4084cb3d8a8eb4d8246ee57ed25', format: 'iframe', height: 50, width: 320, params: {} } },
  { src: 'https://interventioncopiedloitering.com/5d/77/0f/5d770ff402768d79ddda9c1cd67e9819.js' },
];

const ADSTERRA_BANNER_BATCH = ADSTERRA_SCRIPT_BATCH.filter(
  (script): script is AdScriptDefinition & {
    options: NonNullable<AdScriptDefinition['options']>;
  } => Boolean(script.options),
);
const ADSTERRA_SOCIAL_BATCH = ADSTERRA_SCRIPT_BATCH.filter((script) => !script.options);

function getLocalDayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyProgress(day = getLocalDayKey()): DailyProgress {
  return { day, adsgram: 0, adstera: 0 };
}

function loadDailyProgress(storageKey: string): DailyProgress {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<DailyProgress> | null;
    if (saved?.day === getLocalDayKey()) {
      return {
        day: saved.day,
        adsgram: Math.min(ADSGRAM_DAILY_LIMIT, Math.max(0, Number(saved.adsgram) || 0)),
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

function appendIsolatedBanner(
  root: HTMLElement,
  definition: (typeof ADSTERRA_BANNER_BATCH)[number],
) {
  const frame = document.createElement('iframe');
  frame.title = `Adsterra banner ${definition.options.key}`;
  frame.width = String(definition.options.width);
  frame.height = String(definition.options.height);
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.dataset.vidrewardAdsterraKey = definition.options.key;
  frame.srcdoc = `<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;overflow:hidden;background:transparent">
    <script>window.atOptions=${JSON.stringify(definition.options)};</script>
    <script src="${definition.src}"></script>
  </body>
</html>`;
  root.appendChild(frame);
}

function appendSocialScriptFrame(root: HTMLElement, definition: AdScriptDefinition) {
  const frame = document.createElement('iframe');
  frame.title = 'Adsterra social ad';
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.srcdoc = `<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;overflow:hidden;background:transparent">
    <script src="${definition.src}"></script>
  </body>
</html>`;
  root.appendChild(frame);
}

function AdsterraBannerSlot({
  definition,
  active,
  refreshKey,
  index,
}: {
  definition: (typeof ADSTERRA_BANNER_BATCH)[number];
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
    appendIsolatedBanner(root, definition);
    return () => root.replaceChildren();
  }, [active, definition, refreshKey]);

  return (
    <div
      ref={slotRef}
      data-testid={`adsterra-banner-slot-${index + 1}`}
      className="flex min-h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden rounded-lg bg-white/5"
      aria-label={`Adsterra banner ${index + 1}`}
    />
  );
}

function AdsterraSocialScripts({ active, refreshKey }: { active: boolean; refreshKey: number }) {
  const socialRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = socialRootRef.current;
    if (!root || !active) {
      root?.replaceChildren();
      return;
    }

    root.replaceChildren();
    ADSTERRA_SOCIAL_BATCH.forEach((definition) => appendSocialScriptFrame(root, definition));
    return () => root.replaceChildren();
  }, [active, refreshKey]);

  return (
    <div
      ref={socialRootRef}
      aria-hidden="true"
      className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
    />
  );
}

function AdsterraExperience({
  isArabic,
  onClaim,
}: {
  isArabic: boolean;
  onClaim: () => void;
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
          {ADSTERRA_BANNER_BATCH.map((definition, index) => (
            <AdsterraBannerSlot
              key={`${definition.src}-${refreshKey}`}
              definition={definition}
              active={active}
              refreshKey={refreshKey}
              index={index}
            />
          ))}
        </div>
        <AdsterraSocialScripts active={active} refreshKey={refreshKey} />
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
  provider,
  title,
  description,
  label,
  reward,
  completed,
  limit,
  phase,
  blocked,
  isArabic,
  onStart,
}: {
  provider: AdProvider;
  title: string;
  description: string;
  label: string;
  reward: number;
  completed: number;
  limit: number;
  phase: 'watching' | 'waiting' | null;
  blocked: boolean;
  isArabic: boolean;
  onStart: () => void;
}) {
  const isAdstera = provider === 'adstera';
  const isComplete = completed >= limit;
  const progress = Math.min(100, Math.round((completed / limit) * 100));
  const startLabel = isArabic ? (isAdstera ? 'ابدأ التصفح' : 'ابدأ الآن') : (isAdstera ? 'Start browsing' : 'Start now');

  return (
    <section
      data-testid={`card-task-${provider}`}
      className={`relative isolate overflow-hidden rounded-2xl border p-3 text-white shadow-xl transition duration-200 hover:-translate-y-0.5 ${
        isAdstera
          ? 'border-red-400/40 bg-[radial-gradient(circle_at_94%_0%,rgba(248,90,90,.22),transparent_8rem),linear-gradient(135deg,#64221f_0%,#361a20_58%,#1d131e_100%)] shadow-red-950/20'
          : 'border-blue-200/20 bg-[radial-gradient(circle_at_92%_0%,rgba(55,211,224,.2),transparent_8rem),linear-gradient(135deg,#1e2d5b_0%,#1c2347_58%,#10172d_100%)] shadow-blue-950/20'
      } ${blocked ? 'opacity-60' : ''}`}
    >
      <div className="relative z-10 flex items-center gap-3 rounded-xl px-1.5 py-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
          <img
            src={isAdstera ? '/assets/adstera-logo.jpeg' : '/assets/adsgram-logo.jpg'}
            alt={isAdstera ? 'Adsterra' : 'Adsgram'}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#f6c453]">{label}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-blue-100/75">
              {isAdstera ? 'Adsterra' : 'Adsgram'}
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
            {ADSGRAM_DURATION_SECONDS} {isArabic ? 'ثانية' : 'seconds'}
          </span>
          <span data-testid={`text-task-limit-${provider}`} className="font-mono">
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
          <span data-testid={`status-task-completed-${provider}`} className="flex min-h-9 items-center gap-1.5 text-xs font-bold text-emerald-300">
            <BadgeCheck size={16} />
            {isArabic ? 'اكتملت اليوم' : 'Done for today'}
          </span>
        ) : phase === 'waiting' ? (
          <button type="button" disabled className="flex min-h-9 cursor-wait items-center gap-2 rounded-lg bg-[#f6c453]/15 px-3 text-[11px] font-bold text-[#f6c453]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#f6c453]/35 border-t-[#f6c453]" />
            {isArabic ? 'جاري التحقق' : 'Verifying'}
          </button>
        ) : phase === 'watching' ? (
          <button type="button" disabled className="flex min-h-9 cursor-wait items-center gap-2 rounded-lg bg-cyan-200/10 px-3 text-[11px] font-bold text-cyan-100">
            <Clock3 size={14} />
            {isArabic ? 'جارٍ عرض الإعلان' : 'Ad in progress'}
          </button>
        ) : (
          <button
            type="button"
            disabled={blocked}
            data-testid={`button-start-task-${provider}`}
            onClick={onStart}
            className="flex min-h-9 items-center gap-2 rounded-lg bg-[#f6c453] px-3 text-[11px] font-bold text-[#17213a] transition hover:bg-[#ffdc7e] active:scale-[.98] disabled:cursor-not-allowed"
          >
            {isAdstera ? <Zap size={14} /> : <Play size={14} fill="currentColor" />}
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
  const storageKey = `vidreward.ads.daily.v1-${userId ?? 'guest'}`;
  const [today, setToday] = useState(getLocalDayKey);
  const [progress, setProgress] = useState(() => loadDailyProgress(storageKey));
  const [adsgramPhase, setAdsgramPhase] = useState<'watching' | 'waiting' | null>(null);
  const [adsteraOpen, setAdsteraOpen] = useState(false);
  const adsgramClaimed = useRef(false);

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
  const copy = isArabic
    ? {
        eyebrow: 'إعلانات Adsgram وAdsterra',
        title: 'شاهد الإعلان واحصل على مكافأتك.',
        description: 'إعلانات يومية واضحة، مع الحد الأقصى والمكافأة الظاهرة قبل البدء.',
        adsToday: 'إعلان مكافأة اليوم',
        resets: 'يتجدد يومياً',
        adsgramTitle: 'إعلان Adsgram',
        adsgramDescription: 'محاكاة محلية للتجربة فقط؛ لا يتصل المصدر بـ Adsgram ولا يتحقق من مشاهدة فعلية.',
        adsgramLabel: 'محاكاة',
        adsteraTitle: 'تصفح إعلانات Adsterra',
        adsteraDescription: 'تصفح صفحة Adsterra لمدة 30 ثانية واحصل على مكافأة 0.0005 USDT.',
        adsteraLabel: 'تصفح لمدة 30 ثانية',
        rulesTitle: 'لماذا توجد حدود يومية؟',
        rulesBody: 'كود Adsgram في المصدر المرفق يحاكي المشاهدة فقط؛ التحقق الحقيقي يحتاج Placement ID وخادماً. يسجل Adsterra المكافأة بعد عدّاد 30 ثانية كما في المصدر.',
        completed: 'اكتملت اليوم',
        rewardAdded: 'تمت إضافة المكافأة',
        rewardMessage: (reward: string) => `أُضيفت ${reward} إلى رصيدك.`,
        demoRewardAdded: 'مكافأة تجريبية',
        demoRewardMessage: (reward: string) => `أُضيفت ${reward} إلى رصيد العرض التجريبي.`,
      }
    : {
        eyebrow: 'ADSGRAM & ADSTERRA',
        title: 'Watch the ad and earn your reward.',
        description: 'Daily ads with the limit and reward shown before you start.',
        adsToday: 'reward ads today',
        resets: 'Resets daily',
        adsgramTitle: 'Adsgram ad',
        adsgramDescription: 'Local demo only; the supplied source does not call Adsgram or verify a real view.',
        adsgramLabel: 'Demo',
        adsteraTitle: 'Browse Adsterra',
        adsteraDescription: 'Browse the Adsterra page for 30 seconds and receive 0.0005 USDT.',
        adsteraLabel: '30-second browse',
        rulesTitle: 'Why are there daily limits?',
        rulesBody: 'The supplied Adsgram code simulates a view; real verification needs a Placement ID and server validation. Adsterra is credited after its 30-second timer, matching the source.',
        completed: 'complete today',
        rewardAdded: 'Reward added',
        rewardMessage: (reward: string) => `${reward} was added to your balance.`,
        demoRewardAdded: 'Demo reward added',
        demoRewardMessage: (reward: string) => `${reward} was added to the demo balance.`,
      };

  const completeAd = (provider: AdProvider) => {
    const current = progress.day === getLocalDayKey() ? progress : emptyProgress();
    const limit = provider === 'adsgram' ? ADSGRAM_DAILY_LIMIT : ADSTERRA_DAILY_LIMIT;
    if (current[provider] >= limit) return;

    setProgress({
      ...current,
      [provider]: current[provider] + 1,
    });
    const reward = provider === 'adsgram' ? ADSGRAM_REWARD : ADSTERRA_REWARD;
    if (provider === 'adsgram') {
      onReward(reward, copy.demoRewardAdded, copy.demoRewardMessage(formatReward(reward)));
    } else {
      onReward(reward, copy.rewardAdded, copy.rewardMessage(formatReward(reward)));
    }
  };

  useEffect(() => {
    if (!adsgramPhase) return;

    const timer = window.setTimeout(() => {
      if (adsgramPhase === 'watching') {
        setAdsgramPhase('waiting');
        return;
      }
      if (!adsgramClaimed.current) {
        adsgramClaimed.current = true;
        completeAd('adsgram');
      }
      setAdsgramPhase(null);
    }, adsgramPhase === 'watching' ? 1800 : 900);

    return () => window.clearTimeout(timer);
  }, [adsgramPhase]);

  const startAdsgram = () => {
    if (daily.adsgram >= ADSGRAM_DAILY_LIMIT || adsgramPhase || adsteraOpen) return;
    adsgramClaimed.current = false;
    setAdsgramPhase('watching');
  };

  const startAdstera = () => {
    if (daily.adstera >= ADSTERRA_DAILY_LIMIT || adsgramPhase || adsteraOpen) return;
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

      <section className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#f6c453]/50 bg-[#fff8df] px-4 py-3 text-xs">
        <span className="flex items-center gap-2 font-semibold text-[#70501a]">
          <Zap size={15} />
          <span data-testid="text-ads-daily-progress">
            {daily.adsgram + daily.adstera} {isArabic ? 'من' : 'of'} {ADSGRAM_DAILY_LIMIT + ADSTERRA_DAILY_LIMIT} {copy.adsToday}
          </span>
        </span>
        <span className="shrink-0 text-[#8a671e]">{copy.resets}</span>
      </section>

      <div className="mt-4 space-y-3">
        <RewardAdCard
          provider="adsgram"
          title={copy.adsgramTitle}
          description={copy.adsgramDescription}
          label={copy.adsgramLabel}
          reward={ADSGRAM_REWARD}
          completed={daily.adsgram}
          limit={ADSGRAM_DAILY_LIMIT}
          phase={adsgramPhase}
          blocked={Boolean(adsgramPhase || adsteraOpen)}
          isArabic={isArabic}
          onStart={startAdsgram}
        />
        <RewardAdCard
          provider="adstera"
          title={copy.adsteraTitle}
          description={copy.adsteraDescription}
          label={copy.adsteraLabel}
          reward={ADSTERRA_REWARD}
          completed={daily.adstera}
          limit={ADSTERRA_DAILY_LIMIT}
          phase={null}
          blocked={Boolean(adsgramPhase || adsteraOpen)}
          isArabic={isArabic}
          onStart={startAdstera}
        />
      </div>

      <section data-testid="status-task-rules" className="mt-6 flex gap-3 rounded-2xl bg-[#0e2452] p-5 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)]">
        <LockKeyhole className="mt-0.5 shrink-0 text-[#f6c453]" size={18} />
        <div>
          <div className="text-sm font-bold">{copy.rulesTitle}</div>
          <p className="mt-1 text-xs leading-6 text-blue-100/75">{copy.rulesBody}</p>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-200/90">
            <ShieldCheck size={14} />
            {isArabic ? 'شروط المكافأة ظاهرة قبل البدء' : 'Reward terms are visible before you start'}
          </div>
        </div>
      </section>

      {adsteraOpen && (
        <AdsterraExperience
          isArabic={isArabic}
          onClaim={() => {
            completeAd('adstera');
            setAdsteraOpen(false);
          }}
        />
      )}
    </main>
  );
}