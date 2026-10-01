import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Clock3, Gift, LockKeyhole, Zap,
} from 'lucide-react';
import { useLanguage } from '@/i18n';

type AdTaskId = 'adsgram-daily' | 'adstera-daily';

type AdTask = {
  id: AdTaskId;
  kind: 'adsgram' | 'adstera';
  provider: 'Adsgram' | 'Adsterra';
  title: string;
  description: string;
  reward: number;
  dailyLimit: number;
  completedToday: number;
  duration: number;
};

type DailyProgress = {
  day: string;
  counts: Record<AdTaskId, number>;
};

type VerificationState = {
  taskId: AdTaskId;
  phase: 'watching' | 'waiting';
} | null;

type AdsterraBanner = {
  key: string;
  src: string;
};

const DAILY_PROGRESS_KEY = 'vidreward.daily-ad-progress.v1';
const ADSTERRA_COUNTDOWN_SECONDS = 30;
const ADSGRAM_LOGO = `${import.meta.env.BASE_URL}assets/adsgram-logo.jpg`;
const ADSTERRA_LOGO = `${import.meta.env.BASE_URL}assets/adstera-logo.jpeg`;

const ADSTERRA_BANNERS: AdsterraBanner[] = [
  { key: 'b895987c82805b8778a34f54911e8de0', src: 'https://interventioncopiedloitering.com/b895987c82805b8778a34f54911e8de0/invoke.js' },
  { key: 'ab4615d3d759a81e9b876abbcebaf690', src: 'https://interventioncopiedloitering.com/ab4615d3d759a81e9b876abbcebaf690/invoke.js' },
  { key: '3b49398bb9242d548c0464f244b621fa', src: 'https://interventioncopiedloitering.com/3b49398bb9242d548c0464f244b621fa/invoke.js' },
  { key: 'b3570e82f7fb6c462dfdfded816f1576', src: 'https://interventioncopiedloitering.com/b3570e82f7fb6c462dfdfded816f1576/invoke.js' },
  { key: 'de29a44d70992e967ae5d20275e77fab', src: 'https://interventioncopiedloitering.com/de29a44d70992e967ae5d20275e77fab/invoke.js' },
  { key: '280eab7c354ed87595a376b2f5e270cb', src: 'https://interventioncopiedloitering.com/280eab7c354ed87595a376b2f5e270cb/invoke.js' },
  { key: 'd47f719464108005a03a03e6d49fba1a', src: 'https://interventioncopiedloitering.com/d47f719464108005a03a03e6d49fba1a/invoke.js' },
  { key: '04bcf6532017b6790ab2ddac95a5621d', src: 'https://interventioncopiedloitering.com/04bcf6532017b6790ab2ddac95a5621d/invoke.js' },
  { key: '8c0574e870e5a3843e89d947bd38aaff', src: 'https://interventioncopiedloitering.com/8c0574e870e5a3843e89d947bd38aaff/invoke.js' },
  { key: '9f6fe4084cb3d8a8eb4d8246ee57ed25', src: 'https://interventioncopiedloitering.com/9f6fe4084cb3d8a8eb4d8246ee57ed25/invoke.js' },
];

function localDayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyCounts(): Record<AdTaskId, number> {
  return { 'adsgram-daily': 0, 'adstera-daily': 0 };
}

function safeCount(value: unknown, limit: number) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(limit, Math.floor(count))) : 0;
}

function readDailyProgress(storageKey: string): DailyProgress {
  const day = localDayKey();
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as {
      day?: unknown;
      counts?: Partial<Record<AdTaskId, unknown>>;
    } | null;
    if (saved?.day === day && saved.counts) {
      return {
        day,
        counts: {
          'adsgram-daily': safeCount(saved.counts['adsgram-daily'], 10),
          'adstera-daily': safeCount(saved.counts['adstera-daily'], 100),
        },
      };
    }
  } catch {
    // Ads remain available when browser storage is blocked.
  }
  return { day, counts: emptyCounts() };
}

function rewardLabel(amount: number) {
  return `${amount.toFixed(amount < 0.001 ? 4 : 3)}$`;
}

function makeAdsterraDocument(banner: AdsterraBanner) {
  const options = {
    key: banner.key,
    format: 'iframe',
    height: 50,
    width: 320,
    params: {},
  };
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;overflow:hidden;background:transparent">
    <script>window.atOptions=${JSON.stringify(options)};</script>
    <script src="${banner.src}"></script>
  </body>
</html>`;
}

function AdsTaskCard({
  task,
  isArabic,
  verification,
  onStart,
}: {
  task: AdTask;
  isArabic: boolean;
  verification: VerificationState;
  onStart: (task: AdTask) => void;
}) {
  const limitReached = task.completedToday >= task.dailyLimit;
  const active = verification?.taskId === task.id;
  const blocked = Boolean(verification && !active);
  const progress = task.dailyLimit ? Math.round(task.completedToday / task.dailyLimit * 100) : 0;
  const isAdsterra = task.kind === 'adstera';

  return (
    <article
      data-testid={`card-task-${task.id}`}
      className={`relative overflow-hidden rounded-2xl border p-3 text-white shadow-[0_12px_28px_rgba(9,18,42,.18)] transition hover:-translate-y-0.5 ${
        active ? 'border-amber-300/80' : isAdsterra ? 'border-red-500/60' : 'border-slate-200/20'
      } ${blocked ? 'opacity-60' : ''}`}
      style={{
        background: isAdsterra
          ? 'radial-gradient(circle at 94% 0%, rgba(239,68,68,.23), transparent 8rem), linear-gradient(135deg, #642424 0%, #351313 58%, #1c0909 100%)'
          : 'radial-gradient(circle at 92% 0%, rgba(34,211,238,.18), transparent 8rem), linear-gradient(135deg, #1c2b55 0%, #202540 58%, #10172f 100%)',
      }}
    >
      <div className="flex items-center gap-3 rounded-xl px-1.5 py-1">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_8px_18px_rgba(0,0,0,.25)]">
          <img
            src={isAdsterra ? ADSTERRA_LOGO : ADSGRAM_LOGO}
            alt={task.provider}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-[.13em] ${isAdsterra ? 'text-red-200' : 'text-cyan-200'}`}>
              {isAdsterra ? (isArabic ? 'تصفح لمدة 30 ثانية' : '30-second browse') : (isArabic ? 'إعلان قصير' : 'Short ad')}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/80">{task.provider}</span>
          </div>
          <h2 data-testid={`text-task-title-${task.id}`} className="truncate text-sm font-bold">
            {task.title}
          </h2>
        </div>
        <span
          data-testid={`text-task-reward-${task.id}`}
          className="shrink-0 rounded-xl bg-amber-300 px-2.5 py-1.5 text-center font-mono text-[10px] font-bold text-[#17203a]"
        >
          +{rewardLabel(task.reward)}
        </span>
      </div>

      <p data-testid={`text-task-description-${task.id}`} className="mt-2 truncate px-1 text-[11px] leading-5 text-white/75">
        {task.description}
      </p>

      <div className="mt-3 px-1">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold text-white/70">
          <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-cyan-200" />{task.duration} {isArabic ? 'ثانية' : 'seconds'}</span>
          <span data-testid={`text-task-limit-${task.id}`} className="font-mono">
            {task.completedToday.toLocaleString(isArabic ? 'ar' : 'en-US')} / {task.dailyLimit.toLocaleString(isArabic ? 'ar' : 'en-US')} {isArabic ? 'اليوم' : 'today'}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-label={`${task.provider} ${isArabic ? 'الإنجاز اليومي' : 'daily progress'}`}
          aria-valuemin={0}
          aria-valuemax={task.dailyLimit}
          aria-valuenow={task.completedToday}
        >
          <div className="h-full rounded-full bg-amber-300 transition-[width] duration-500" style={{ width: `${Math.max(progress, progress > 0 ? 4 : 2)}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <span className="text-[10px] text-white/65">{isArabic ? 'يتجدد يومياً' : 'Resets daily'}</span>
        {active ? (
          <button type="button" disabled data-testid={`button-start-task-${task.id}`} className="flex min-h-9 cursor-wait items-center gap-2 rounded-lg bg-white/10 px-3 text-[11px] font-bold text-amber-200">
            {verification?.phase === 'waiting'
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200/35 border-t-amber-200" />
              : <Clock3 className="h-3.5 w-3.5" />}
            <span data-testid={verification?.phase === 'waiting' ? `status-task-verifying-${task.id}` : undefined}>
              {verification?.phase === 'waiting'
                ? (isArabic ? 'جاري التحقق' : 'Verifying')
                : (isArabic ? 'جارٍ عرض الإعلان' : 'Ad in progress')}
            </span>
          </button>
        ) : limitReached ? (
          <span data-testid={`status-task-completed-${task.id}`} className="flex min-h-9 items-center gap-1.5 text-xs font-bold text-emerald-200">
            <BadgeCheck className="h-4 w-4" />{isArabic ? 'اكتمل حد اليوم' : 'Daily limit reached'}
          </span>
        ) : (
          <button
            type="button"
            disabled={blocked}
            data-testid={`button-start-task-${task.id}`}
            onClick={() => onStart(task)}
            className="flex min-h-9 items-center gap-2 rounded-lg bg-amber-300 px-3 text-[11px] font-bold text-[#17203a] transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 disabled:cursor-not-allowed"
          >
            {isAdsterra ? (isArabic ? 'ابدأ التصفح' : 'Start browsing') : (isArabic ? 'ابدأ المشاهدة' : 'Watch ad')}
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {active && (
        <div data-testid={`panel-verification-${task.id}`} className="mt-3 border-t border-white/15 pt-3">
          <div className="flex items-center gap-3 rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-white/80">
            {verification?.phase === 'waiting'
              ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-200/35 border-t-amber-200" />
              : <Clock3 className="h-4 w-4 shrink-0 text-cyan-200" />}
            <span>
              {verification?.phase === 'waiting'
                ? (isArabic ? 'جاري تجهيز المكافأة...' : 'Preparing your reward...')
                : (isArabic ? 'جارٍ عرض الإعلان...' : 'The ad is in progress...')}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

function AdsterraSession({
  task,
  isArabic,
  dir,
  onClaim,
}: {
  task: AdTask;
  isArabic: boolean;
  dir: 'rtl' | 'ltr';
  onClaim: () => void;
}) {
  const [remaining, setRemaining] = useState(ADSTERRA_COUNTDOWN_SECONDS);
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setRemaining((current) => Math.max(current - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [active, remaining]);

  return (
    <main
      data-testid="page-adstera-session"
      dir={dir}
      className="fixed inset-0 z-[70] min-h-dvh overflow-y-auto bg-[#0e1632] text-white"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[390px] flex-col items-center px-4 pb-10 pt-7">
        <p className="text-xs font-bold text-white/65">{isArabic ? 'تصفح إعلانات Adsterra' : 'Browse Adsterra ads'}</p>
        <div
          data-testid="text-adstera-countdown"
          aria-live="polite"
          className="mt-2 font-mono text-5xl font-bold tracking-[-.08em] text-amber-300"
        >
          {remaining}
        </div>
        <p className="mt-1 text-[11px] text-white/65">{isArabic ? 'ابقَ في الصفحة حتى انتهاء العداد' : 'Stay on this page until the timer ends'}</p>

        {active && (
          <div data-testid="container-adsterra-banners" className="mt-6 flex w-full flex-col items-center gap-3">
            {ADSTERRA_BANNERS.map((banner, index) => (
              <div
                key={banner.key}
                data-testid={`adsterra-banner-slot-${index + 1}`}
                className="flex min-h-[50px] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-lg bg-white/[.04]"
                aria-label={`Adsterra banner ${index + 1}`}
              >
                <iframe
                  title={`Adsterra banner ${index + 1}`}
                  width="320"
                  height="50"
                  loading="eager"
                  referrerPolicy="no-referrer-when-downgrade"
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={makeAdsterraDocument(banner)}
                  className="block h-[50px] w-[320px] max-w-full border-0"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!active && (
        <div data-testid="modal-adstera-complete" className="absolute inset-0 flex items-center justify-center bg-[#0e1632]/90 p-5 backdrop-blur-sm">
          <section className="w-full max-w-sm rounded-[1.6rem] border border-amber-300/30 bg-[#102b30] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,.35)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-200">
              <BadgeCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-bold">
              {isArabic ? 'تهانينا، أكملت التصفح' : 'Browsing complete'}
            </h2>
            <p className="mt-2 text-xs leading-6 text-white/70">
              +{rewardLabel(task.reward)}
            </p>
            <button
              type="button"
              data-testid="button-claim-adstera"
              onClick={onClaim}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-[#17203a] transition hover:bg-amber-200"
            >
              <Gift className="h-4 w-4" />
              {isArabic ? 'استلام المكافأة' : 'Claim reward'}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export function AdsPage({
  telegramUserId,
  onReward,
}: {
  telegramUserId: number | null;
  onReward: (amount: number, provider: string) => void;
}) {
  const { dir, isArabic } = useLanguage();
  const storageKey = `${DAILY_PROGRESS_KEY}.${telegramUserId ?? 'guest'}`;
  const today = localDayKey();
  const [dailyProgress, setDailyProgress] = useState(() => readDailyProgress(storageKey));
  const [verification, setVerification] = useState<VerificationState>(null);
  const [activeAdsterraTask, setActiveAdsterraTask] = useState<AdTask | null>(null);
  const onRewardRef = useRef(onReward);
  const adsterraClaimedRef = useRef(false);
  onRewardRef.current = onReward;

  useEffect(() => {
    if (dailyProgress.day !== today) {
      setDailyProgress({ day: today, counts: emptyCounts() });
    }
  }, [dailyProgress.day, today]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(dailyProgress));
    } catch {
      // Keep the task list usable if storage is unavailable.
    }
  }, [dailyProgress, storageKey]);

  const tasks = useMemo<AdTask[]>(() => [
    {
      id: 'adsgram-daily',
      kind: 'adsgram',
      provider: 'Adsgram',
      title: isArabic ? 'إعلان Adsgram' : 'Adsgram ad',
      description: isArabic ? 'شاهد إعلاناً قصيراً واحصل على مكافأة 0.002$.' : 'Watch a short ad and receive a 0.002$ reward.',
      reward: 0.002,
      dailyLimit: 10,
      completedToday: dailyProgress.day === today ? dailyProgress.counts['adsgram-daily'] : 0,
      duration: 30,
    },
    {
      id: 'adstera-daily',
      kind: 'adstera',
      provider: 'Adsterra',
      title: isArabic ? 'تصفح إعلانات Adsterra' : 'Browse Adsterra',
      description: isArabic ? 'تصفح الإعلانات لمدة 30 ثانية واحصل على مكافأة 0.0005$.' : 'Browse the ads for 30 seconds and receive a 0.0005$ reward.',
      reward: 0.0005,
      dailyLimit: 100,
      completedToday: dailyProgress.day === today ? dailyProgress.counts['adstera-daily'] : 0,
      duration: ADSTERRA_COUNTDOWN_SECONDS,
    },
  ], [dailyProgress, isArabic, today]);

  useEffect(() => {
    if (!verification) return;
    const task = tasks.find((item) => item.id === verification.taskId);
    if (!task) return;

    const timer = window.setTimeout(() => {
      if (verification.phase === 'watching') {
        setVerification((current) => current?.taskId === task.id ? { ...current, phase: 'waiting' } : current);
        return;
      }

      setDailyProgress((current) => {
        const counts = current.day === today ? current.counts : emptyCounts();
        const completed = counts[task.id] ?? 0;
        if (completed >= task.dailyLimit) return current;
        return {
          day: today,
          counts: { ...counts, [task.id]: completed + 1 },
        };
      });
      setVerification(null);
      onRewardRef.current(task.reward, task.provider);
    }, verification.phase === 'watching' ? 1800 : 900);

    return () => window.clearTimeout(timer);
  }, [tasks, today, verification]);

  const totalCompleted = tasks.reduce((total, task) => total + task.completedToday, 0);
  const totalLimit = tasks.reduce((total, task) => total + task.dailyLimit, 0);
  const totalProgress = totalLimit ? Math.min(100, Math.round(totalCompleted / totalLimit * 100)) : 0;

  const startTask = (task: AdTask) => {
    if (verification || task.completedToday >= task.dailyLimit) return;
    if (task.kind === 'adstera') {
      adsterraClaimedRef.current = false;
      setActiveAdsterraTask(task);
      return;
    }
    setVerification({ taskId: task.id, phase: 'watching' });
  };

  const claimAdsterra = () => {
    const task = activeAdsterraTask;
    if (!task || adsterraClaimedRef.current) return;
    adsterraClaimedRef.current = true;
    setDailyProgress((current) => {
      const counts = current.day === today ? current.counts : emptyCounts();
      const completed = counts[task.id] ?? 0;
      if (completed >= task.dailyLimit) return current;
      return {
        day: today,
        counts: { ...counts, [task.id]: completed + 1 },
      };
    });
    onRewardRef.current(task.reward, task.provider);
    setActiveAdsterraTask(null);
  };

  if (activeAdsterraTask) {
    return (
      <AdsterraSession
        task={activeAdsterraTask}
        isArabic={isArabic}
        dir={dir}
        onClaim={claimAdsterra}
      />
    );
  }

  return (
    <main data-testid="page-ads" aria-label="Ads" className="mx-auto min-h-[calc(100dvh-7rem)] w-full max-w-[900px] px-4 pb-28 pt-7 md:px-8 md:pt-10" dir={dir}>
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#1557ee]">
          <Zap className="h-4 w-4 text-amber-500" />
          <span>{isArabic ? 'إعلانات Adsgram وAdsterra' : 'Adsgram & Adsterra'}</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#12234b] md:text-3xl">
          {isArabic ? 'شاهد الإعلان واحصل على مكافأتك.' : 'Watch an ad and earn your reward.'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {isArabic ? 'إعلانات يومية واضحة، مع الحد الأقصى والمكافأة الظاهرة قبل البدء.' : 'Daily ads with a clear limit and reward shown before you start.'}
        </p>
      </header>

      <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label={isArabic ? 'تقدم الإعلانات اليوم' : 'Daily ad progress'}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Zap className="h-4 w-4 text-amber-600" />
            {totalCompleted.toLocaleString(isArabic ? 'ar' : 'en-US')} {isArabic ? 'من' : 'of'} {totalLimit.toLocaleString(isArabic ? 'ar' : 'en-US')} {isArabic ? 'إعلانات المكافآت اليوم' : 'reward ads today'}
          </span>
          <span className="shrink-0 text-[10px] font-semibold text-amber-800">{isArabic ? 'يتجدد يومياً' : 'Resets daily'}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-200/70" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={totalProgress}>
          <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${totalProgress}%` }} />
        </div>
      </section>

      <section className="space-y-3">
        {tasks.map((task) => (
          <AdsTaskCard key={task.id} task={task} isArabic={isArabic} verification={verification} onStart={startTask} />
        ))}
      </section>

      <section data-testid="status-task-rules" className="mt-6 flex gap-3 rounded-2xl bg-[#123438] p-5 text-white">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <h2 className="text-sm font-bold">{isArabic ? 'لماذا توجد حدود يومية؟' : 'Why are there daily limits?'}</h2>
          <p className="mt-1 text-xs leading-6 text-white/75">
            {isArabic
              ? 'الحد ينظم المكافآت المتاحة يومياً. تدفق Adsgram الحالي يحاكي التحقق بمؤقت من النسخة المرفقة، ولا يتحقق مباشرةً من مشاهدة الإعلان لدى المزود.'
              : 'Limits organize daily rewards. The Adsgram flow currently uses the timer simulation from the supplied app; it does not verify an ad view with the provider.'}
          </p>
        </div>
      </section>
    </main>
  );
}