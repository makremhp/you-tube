import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Gift,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  Eye,
  Clapperboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { apiGet, apiPost } from '@/lib/api';

type AchievementSnapshot = {
  referralsTotal: number;
  referralsToday: number;
  browsingSessions: number;
  monetagSessions: number;
  claimed: string[];
  claimedToday: string[];
};

type AchievementId = 'invite_daily' | 'referrals_20' | 'referrals_50' | 'referrals_100' | 'browse_100' | 'monetag_500';

type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  reward: number;
  target: number;
  value: number;
  icon: typeof UsersRound;
  tone: 'blue' | 'violet' | 'cyan' | 'amber';
  action: 'invite' | 'browse' | 'monetag';
  daily?: boolean;
};

const EMPTY: AchievementSnapshot = {
  referralsTotal: 0,
  referralsToday: 0,
  browsingSessions: 0,
  monetagSessions: 0,
  claimed: [],
  claimedToday: [],
};

export function AchievementsPage({
  onNavigate,
  onNotify,
}: {
  onNavigate: (screen: 'publish' | 'ads') => void;
  onNotify?: (tone: 'success' | 'info' | 'warning', title: string, message: string) => void;
}) {
  const { dir, isArabic } = useLanguage();
  const [snapshot, setSnapshot] = useState<AchievementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<AchievementId | null>(null);
  const [error, setError] = useState('');
  const text = (ar: string, en: string) => isArabic ? ar : en;

  const loadProgress = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setSnapshot(await apiGet<AchievementSnapshot>('achievements'));
    } catch {
      setError(text('تعذّر تحميل الإنجازات. افتح التطبيق من Telegram ثم أعد المحاولة.', 'Achievements could not be loaded. Open the app in Telegram and try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadProgress();
  }, []);

  const current = snapshot ?? EMPTY;
  const tasks = useMemo<Achievement[]>(() => [
    {
      id: 'invite_daily',
      title: text('ادعُ 3 أصدقاء اليوم', 'Invite 3 friends today'),
      description: text('كل 3 أصدقاء جدد يسجّلون عبر رابطك يفتحون مكافأتك اليومية.', 'Earn this daily reward when 3 new friends join through your referral link.'),
      reward: 0.007,
      target: 3,
      value: current.referralsToday,
      icon: UserRoundPlus,
      tone: 'blue',
      action: 'invite',
      daily: true,
    },
    {
      id: 'referrals_20',
      title: text('وصل إلى 20 إحالة', 'Reach 20 referrals'),
      description: text('اجمع 20 إحالة مسجّلة لتحصل على مكافأة لمرة واحدة.', 'Bring in 20 registered referrals to unlock this one-time reward.'),
      reward: 0.04,
      target: 20,
      value: current.referralsTotal,
      icon: UsersRound,
      tone: 'violet',
      action: 'invite',
    },
    {
      id: 'referrals_50',
      title: text('وصل إلى 50 إحالة', 'Reach 50 referrals'),
      description: text('واصل مشاركة رابطك وافتح مكافأة هذا الإنجاز.', 'Keep sharing your link to unlock this milestone reward.'),
      reward: 0.1,
      target: 50,
      value: current.referralsTotal,
      icon: UsersRound,
      tone: 'cyan',
      action: 'invite',
    },
    {
      id: 'referrals_100',
      title: text('وصل إلى 100 إحالة', 'Reach 100 referrals'),
      description: text('أكمل 100 إحالة مسجّلة للحصول على أعلى مكافأة إحالات.', 'Reach 100 registered referrals for the top referral milestone.'),
      reward: 0.2,
      target: 100,
      value: current.referralsTotal,
      icon: Sparkles,
      tone: 'amber',
      action: 'invite',
    },
    {
      id: 'browse_100',
      title: text('أكمل 100 عملية تصفّح', 'Complete 100 browsing sessions'),
      description: text('تُحتسب جلسات التصفح المكتملة والمسجّلة في رصيدك.', 'Completed, server-recorded browsing sessions count toward this goal.'),
      reward: 0.01,
      target: 100,
      value: current.browsingSessions,
      icon: Eye,
      tone: 'blue',
      action: 'browse',
    },
    {
      id: 'monetag_500',
      title: text('أكمل 500 جلسة Monetag', 'Complete 500 Monetag sessions'),
      description: text('كل مرة ينجح فيها الإعلانان وتُسجَّل مكافأتهما تُحتسب جلسة واحدة.', 'One session counts only after both ads succeed and their reward is recorded.'),
      reward: 0.02,
      target: 500,
      value: current.monetagSessions,
      icon: Clapperboard,
      tone: 'violet',
      action: 'monetag',
    },
  ], [current, isArabic]);

  const claim = async (task: Achievement) => {
    if (claiming) return;
    if (task.value < task.target) {
      onNavigate(task.action === 'invite' ? 'publish' : 'ads');
      return;
    }
    setClaiming(task.id);
    setError('');
    try {
      const result = await apiPost<{ reward: number; progress: AchievementSnapshot }>('achievements/claim', { id: task.id });
      setSnapshot(result.progress);
      onNotify?.('success', text('تم استلام المكافأة', 'Reward claimed'), text(`أُضيفت $${Number(result.reward).toFixed(3)} إلى رصيدك.`, `$${Number(result.reward).toFixed(3)} was added to your balance.`));
    } catch (claimError) {
      const message = claimError instanceof Error && /already claimed/i.test(claimError.message)
        ? text('سبق استلام مكافأة هذا الإنجاز.', 'This achievement has already been claimed.')
        : text('لم تكتمل المهمة بعد أو تعذّر تسجيل المكافأة. حدّث التقدم وحاول مجددًا.', 'The goal is not complete yet, or the reward could not be recorded. Refresh and try again.');
      setError(message);
      onNotify?.('warning', text('تعذّر استلام المكافأة', 'Could not claim reward'), message);
      await loadProgress(true);
    } finally {
      setClaiming(null);
    }
  };

  const todayClaimed = new Set(current.claimedToday);
  const onceClaimed = new Set(current.claimed);
  const dailyTask = tasks[0];
  const oneTimeTasks = tasks.slice(1);
  const totalClaimed = tasks.filter((task) => task.daily ? todayClaimed.has(task.id) : onceClaimed.has(task.id)).length;
  const Arrow = isArabic ? ArrowLeft : ArrowRight;

  const renderCard = (task: Achievement) => {
    const Icon = task.icon;
    const reached = task.value >= task.target;
    const claimed = task.daily ? todayClaimed.has(task.id) : onceClaimed.has(task.id);
    const isClaiming = claiming === task.id;
    const percent = Math.min(100, Math.round((task.value / task.target) * 100));
    const tone = {
      blue: 'bg-blue-50 text-blue-600 ring-blue-100',
      violet: 'bg-violet-50 text-violet-600 ring-violet-100',
      cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
      amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    }[task.tone];

    return (
      <article key={task.id} data-testid={`achievement-${task.id}`} className={`group relative overflow-hidden rounded-[22px] border bg-white p-4 shadow-[0_8px_30px_rgba(20,43,88,.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(20,43,88,.09)] sm:p-5 ${claimed ? 'border-emerald-200/80' : 'border-slate-200/80'}`}>
        <div className="flex min-w-0 items-start gap-3.5">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[17px] ring-1 ${tone}`}><Icon className="h-[22px] w-[22px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-extrabold tracking-tight text-[#14254b] sm:text-[15px]">{task.title}</h3>
              {task.daily && <span className="rounded-full bg-[#eff4ff] px-2 py-1 text-[9px] font-bold text-[#1557ee]">{text('يومية', 'DAILY')}</span>}
              {claimed && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700"><BadgeCheck className="h-3 w-3" />{text('مكتملة', 'CLAIMED')}</span>}
            </div>
            <p className="mt-1.5 text-[11px] leading-[1.8] text-slate-500">{task.description}</p>
          </div>
          <div className="hidden shrink-0 text-left sm:block" dir="ltr">
            <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-100 bg-[#f0fbf7] px-2.5 py-1.5 text-[13px] font-extrabold tabular-nums text-[#139477]"><CircleDollarSign className="h-4 w-4" />{task.reward.toFixed(3)}$</span>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold">
              <span className="text-slate-500">{text('التقدم', 'Progress')}</span>
              <span className="shrink-0 tabular-nums text-[#23385f]" dir="ltr">{Math.min(task.value, task.target).toLocaleString()} / {task.target.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.min(task.value, task.target)} aria-valuemin={0} aria-valuemax={task.target} aria-label={task.title}>
              <div className={`h-full rounded-full transition-all duration-700 ${claimed ? 'bg-emerald-400' : reached ? 'bg-[#19b88a]' : 'bg-gradient-to-l from-[#2d69f6] to-[#70a7ff]'}`} style={{ width: `${percent}%` }} />
            </div>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#139477] sm:hidden" dir="ltr"><Gift className="h-3.5 w-3.5" />{task.reward.toFixed(3)}$</span>
          </div>
          <Button
            type="button"
            data-testid={`button-achievement-${task.id}`}
            onClick={() => void claim(task)}
            disabled={loading || Boolean(claiming) || claimed}
            variant="unstyled"
            size="fit"
            className={`flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-extrabold transition sm:min-w-[126px] sm:px-4 sm:text-[11px] ${claimed ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : reached ? 'bg-[#1557ee] text-white shadow-[0_7px_16px_rgba(21,87,238,.2)] hover:bg-[#104bd1]' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-[#1557ee]'}`}
          >
            {isClaiming ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : claimed ? <Check className="h-3.5 w-3.5" /> : reached ? <Gift className="h-3.5 w-3.5" /> : <Arrow className="h-3.5 w-3.5" />}
            {isClaiming
              ? text('جارٍ الاستلام', 'Claiming')
              : claimed
                ? text('تم الاستلام', 'Claimed')
                : reached
                  ? text('احصل على المكافأة', 'Claim reward')
                  : text(task.action === 'invite' ? 'ادعُ أصدقاءك' : 'ابدأ الآن', task.action === 'invite' ? 'Invite friends' : 'Start now')}
          </Button>
        </div>
      </article>
    );
  };

  return (
    <main data-testid="page-achievements" dir={dir} className="mx-auto w-full max-w-[1180px] px-4 pb-32 pt-6 text-[#12234b] sm:px-6 md:px-8 md:pb-12 md:pt-9 lg:px-10">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-[#102754] px-5 py-6 text-white shadow-[0_18px_50px_rgba(16,39,84,.18)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_8%_0%,rgba(66,139,255,.55),transparent_38%),radial-gradient(ellipse_at_90%_110%,rgba(42,204,193,.25),transparent_44%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 -z-10 h-48 w-48 rounded-full border border-white/[.07] sm:h-64 sm:w-64" />
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3 py-1.5 text-[10px] font-bold text-blue-100"><Sparkles className="h-3.5 w-3.5 text-cyan-300" />{text('مكافآتك على كل إنجاز', 'REWARDS FOR EVERY MILESTONE')}</div>
            <h1 className="font-display text-[25px] font-extrabold tracking-tight sm:text-[32px]">{text('إنجازاتك', 'Your achievements')}</h1>
            <p className="mt-2 max-w-md text-[11px] leading-6 text-blue-100/75 sm:text-[13px]">{text('تابع تقدمك، أكمل المهام، واستلم مكافآتك مباشرة في رصيدك.', 'Track your progress, complete goals, and claim rewards straight to your balance.')}</p>
          </div>
          <div className="hidden h-[76px] w-[76px] shrink-0 place-items-center rounded-[24px] border border-white/15 bg-white/[.08] sm:grid"><AwardMark /></div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2.5 sm:mt-8 sm:max-w-[540px] sm:gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.07] px-3 py-3"><div className="text-[9px] font-medium text-blue-100/65 sm:text-[10px]">{text('إجمالي الإحالات', 'Total referrals')}</div><div className="mt-1.5 text-[19px] font-extrabold tabular-nums sm:text-[23px]">{current.referralsTotal.toLocaleString()}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.07] px-3 py-3"><div className="text-[9px] font-medium text-blue-100/65 sm:text-[10px]">{text('إنجازات مستلمة', 'Rewards claimed')}</div><div className="mt-1.5 text-[19px] font-extrabold tabular-nums sm:text-[23px]">{totalClaimed}<span className="ms-1 text-[10px] font-semibold text-blue-100/60">/ 6</span></div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.07] px-3 py-3"><div className="text-[9px] font-medium text-blue-100/65 sm:text-[10px]">{text('جلسات التصفح', 'Browsing sessions')}</div><div className="mt-1.5 text-[19px] font-extrabold tabular-nums sm:text-[23px]">{current.browsingSessions.toLocaleString()}</div></div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-[10px] leading-5 text-blue-100/60">{text('يتم التحقق من التقدم والمكافآت عبر الخادم.', 'Progress and rewards are verified by the server.')}</span>
          <Button type="button" data-testid="button-refresh-achievements" onClick={() => void loadProgress(true)} disabled={loading || refreshing} variant="unstyled" size="fit" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[.08] px-3 text-[10px] font-bold text-white transition hover:bg-white/[.15]">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{text('تحديث', 'Refresh')}
          </Button>
        </div>
      </section>

      {error && <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900"><span>{error}</span><button type="button" onClick={() => void loadProgress(true)} className="shrink-0 font-bold underline underline-offset-2">{text('إعادة المحاولة', 'Retry')}</button></div>}

      <section className="mt-7 sm:mt-9">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><div className="text-[10px] font-bold tracking-wide text-[#1557ee]">{text('تتجدد كل يوم', 'RESETS DAILY')}</div><h2 className="mt-1 text-[18px] font-extrabold tracking-tight text-[#14254b] sm:text-xl">{text('إنجاز اليوم', 'Today’s challenge')}</h2></div>
          <span className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[9px] font-bold text-slate-500">{text('مهمة يومية واحدة', '1 daily task')}</span>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-2">{loading ? <LoadingCards /> : renderCard(dailyTask)}</div>
      </section>

      <section className="mt-8 sm:mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><div className="text-[10px] font-bold tracking-wide text-[#159b89]">{text('تُستلم مرة واحدة', 'ONE-TIME REWARDS')}</div><h2 className="mt-1 text-[18px] font-extrabold tracking-tight text-[#14254b] sm:text-xl">{text('إنجازات دائمة', 'Lifetime achievements')}</h2></div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-bold text-slate-500">{text('5 مهام', '5 tasks')}</span>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-2">{loading ? <LoadingCards /> : oneTimeTasks.map(renderCard)}</div>
      </section>
      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-[10px] leading-6 text-slate-500"><BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#159b89]" /><p>{text('تُضاف المكافآت إلى رصيدك مرة واحدة بعد التحقق. مكافأة الدعوات اليومية قابلة للاستلام مجددًا في يوم جديد عند استيفاء الشرط.', 'Rewards are credited to your balance once verified. The daily invitation reward can be claimed again on a new day after meeting its goal.')}</p></div>
    </main>
  );
}

function AwardMark() {
  return <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-400 text-[#693d09] shadow-[0_10px_28px_rgba(255,190,72,.2)]"><Sparkles className="h-6 w-6" /></span>;
}

function LoadingCards() {
  return <div className="min-h-[185px] animate-pulse rounded-[22px] border border-slate-200/80 bg-white p-5"><div className="h-10 w-10 rounded-2xl bg-slate-100" /><div className="mt-4 h-3 w-1/2 rounded bg-slate-100" /><div className="mt-3 h-2 w-full rounded bg-slate-100" /><div className="mt-5 h-9 w-28 rounded-xl bg-slate-100" /></div>;
}
