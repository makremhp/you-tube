import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, ExternalLink, ImageIcon, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import type { PromotionCampaign, PromotionPlatform, TaskProof } from '@/legacy/shared';
import { SiTelegram, SiTiktok } from 'react-icons/si';
import { formatTaskReward, useTaskRewards } from '@/lib/useTaskRewards';

type TaskVerification = {
  state: 'idle' | 'checking' | 'member' | 'not-member' | 'error';
  message?: string;
};

type MembershipResponse = {
  member?: boolean;
  message?: string;
};

export function PlatformTasksPage({
  platform,
  campaigns,
  proofs,
  onStartTask,
  onTaskCompleted,
  onNotify,
  telegramUserId,
}: {
  platform: PromotionPlatform;
  campaigns: PromotionCampaign[];
  proofs: TaskProof[];
  onStartTask?: (campaign: PromotionCampaign) => void;
  onTaskCompleted?: (campaignId: string, userId: number) => void;
  onNotify?: (tone: 'success' | 'info' | 'warning', title: string, message: string) => void;
  telegramUserId: number | null;
}) {
  const { dir, t } = useLanguage();
  const rewards = useTaskRewards();
  const isTelegram = platform === 'telegram';
  const BrandIcon = isTelegram ? SiTelegram : SiTiktok;
  const brandColor = isTelegram ? '#229ED9' : '#111111';
  const activeCampaigns = campaigns.filter((campaign) => campaign.platform === platform && campaign.status === 'نشط');
  const tasks = activeCampaigns;
  const [joiningId, setJoiningId] = useState('');
  const [returnedIds, setReturnedIds] = useState<Record<string, boolean>>({});
  const [verification, setVerification] = useState<Record<string, TaskVerification>>({});
  const verifyMembership = async (task: PromotionCampaign) => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      const message = 'افتح التطبيق من Telegram للتحقق الآلي من العضوية.';
      setVerification((current) => ({
        ...current,
        [task.id]: { state: 'error', message },
      }));
      onNotify?.('warning', 'تعذر التحقق من الاشتراك', message);
      return;
    }
    setVerification((current) => ({ ...current, [task.id]: { state: 'checking' } }));
    onNotify?.('info', 'جارٍ التحقق من الاشتراك', 'نراجع عضويتك في القناة الآن.');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/telegram/verify-bot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'verify-member', channelUrl: task.link, initData }),
      });
      const result = await response.json() as MembershipResponse;
      if (!response.ok) throw new Error(result.message || 'تعذر التحقق الآن. حاول مرة أخرى.');
      if (result.member) {
        const message = 'تم التحقق من اشتراكك عبر Telegram.';
        if (telegramUserId !== null) onTaskCompleted?.(task.id, telegramUserId);
        setVerification((current) => ({
          ...current,
          [task.id]: { state: 'member', message },
        }));
        onNotify?.('success', 'تم إكمال مهمة القناة', 'تم التحقق من اشتراكك عبر Telegram وإكمال المهمة.');
      } else {
        const message = 'لم يظهر اشتراكك بعد. انضم إلى القناة ثم أعد التحقق.';
        setVerification((current) => ({
          ...current,
          [task.id]: { state: 'not-member', message },
        }));
        onNotify?.('warning', 'لم يكتمل التحقق', message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر التحقق الآن. حاول مرة أخرى.';
      setVerification((current) => ({
        ...current,
        [task.id]: { state: 'error', message },
      }));
      onNotify?.('warning', 'تعذر التحقق من الاشتراك', message);
    }
  };

  const openTaskChannel = (task: PromotionCampaign) => {
    window.open(task.link, '_blank', 'noopener,noreferrer');
    setJoiningId(task.id);
    onNotify?.('info', 'تم فتح رابط القناة', 'عُد إلى التطبيق بعد الانضمام للتحقق من اشتراكك.');
  };

  useEffect(() => {
    if (!joiningId) return;
    let handledReturn = false;
    const markReturned = () => {
      if (handledReturn || document.visibilityState !== 'visible') return;
      const task = tasks.find((item) => item.id === joiningId);
      if (!task) return;
      handledReturn = true;
      setReturnedIds((current) => ({ ...current, [joiningId]: true }));
      setJoiningId('');
      void verifyMembership(task);
    };
    window.addEventListener('focus', markReturned);
    document.addEventListener('visibilitychange', markReturned);
    return () => {
      window.removeEventListener('focus', markReturned);
      document.removeEventListener('visibilitychange', markReturned);
    };
  }, [joiningId, tasks]);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <div className="mb-7 flex items-center gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${isTelegram ? 'bg-[#eaf8fd]' : 'bg-slate-100'}`} style={{ color: brandColor }}>
          <BrandIcon aria-hidden="true" className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#1557ee]">{t('مساحة الربح')} / {isTelegram ? 'Telegram' : 'TikTok'}</div>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">{t(isTelegram ? 'مهام Telegram' : 'مهام TikTok')}</h1>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t(isTelegram ? 'انضم إلى القناة، ثم تحقّق تلقائيًا من اشتراكك.' : 'تابع الحساب وارفع لقطة شاشة واضحة لإثبات المتابعة.')}</p>
        </div>
      </div>
      {!activeCampaigns.length && <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-[#f4f8ff] px-4 py-3 text-[11px] leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1557ee]" /><span>{t('لا توجد مهام متاحة حاليًا. ستظهر المهام الحقيقية هنا فور إضافتها.')}</span></div>}
      {isTelegram && campaigns.some((campaign) => campaign.platform === 'telegram' && campaign.status !== 'نشط') && <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span>{t('هناك حملة تنتظر تأكيد صلاحيات البوت قبل ظهورها للمهام.')}</span></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((task) => {
          const proof = proofs.find((item) => item.campaignId === task.id
            && (item.userId === telegramUserId || (item.userId === undefined && telegramUserId === null)));
          const verificationState = verification[task.id] ?? { state: 'idle' as const };
          if (isTelegram) {
            return (
              <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="flex h-[108px] min-h-[108px] rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-[var(--shadow-soft)] transition hover:border-[#b9e6f5] hover:shadow-[var(--shadow-lift)] sm:px-3">
                <div className="flex min-h-[76px] min-w-0 flex-1 items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eaf8fd] text-[#229ED9] sm:h-12 sm:w-12">
                    {task.image
                      ? <img src={task.image} alt={t('صورة حملة')} className="h-full w-full object-cover" />
                      : <ImageIcon aria-hidden="true" className="h-4 w-4 text-slate-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[11px] font-bold leading-4 text-[#12234b]">{task.title}</h2>
                    <p className={`truncate text-[9px] leading-3 ${verificationState.state === 'member' ? 'text-[#159b89]' : verificationState.state === 'error' || verificationState.state === 'not-member' ? 'text-amber-700' : 'text-slate-400'}`} role={verificationState.state === 'idle' ? undefined : 'status'}>
                      {t(verificationState.message ?? (returnedIds[task.id] && !telegramUserId ? 'افتح التطبيق من Telegram للتحقق الآلي من العضوية.' : `${task.targetCount.toLocaleString()} ${t('مشترك')} · ${task.link}`))}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eafbf8] px-2 py-1 text-[9px] font-bold text-[#159b89]">{formatTaskReward(isTelegram ? rewards.telegramTaskReward : rewards.tiktokTaskReward)}</span>
                  <Button
                    type="button"
                    data-testid={`button-join-${task.id}`}
                    disabled={verificationState.state === 'checking' || verificationState.state === 'member' || (returnedIds[task.id] && !telegramUserId)}
                    onClick={() => returnedIds[task.id] ? void verifyMembership(task) : openTaskChannel(task)}
                    variant={returnedIds[task.id] ? 'primary' : 'secondary'}
                    size="fit"
                    aria-label={t(returnedIds[task.id] ? 'تحقق من الاشتراك' : 'انضم إلى القناة')}
                    className={`flex h-9 min-w-[66px] shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[9px] font-bold ${returnedIds[task.id] ? 'text-white' : 'border-slate-200 bg-white text-[#12234b]'}`}
                  >
                    {verificationState.state === 'checking' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : verificationState.state === 'member' ? <CheckCircle2 className="h-3.5 w-3.5" /> : returnedIds[task.id] ? <ShieldCheck className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    {verificationState.state === 'checking' ? t('تحقق…') : verificationState.state === 'member' ? t('مكتمل') : returnedIds[task.id] ? t('تحقق') : t('انضم')}
                  </Button>
                </div>
              </article>
            );
          }
          return (
            <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="flex min-h-[112px] rounded-2xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-[var(--shadow-soft)] transition hover:border-blue-200 hover:shadow-[var(--shadow-lift)] sm:min-h-[108px] sm:px-3">
              <div className="flex min-h-[88px] min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-[#f2f5f8] sm:h-12 sm:w-12">
                  {task.image
                    ? <img src={task.image} alt={t('صورة حملة')} className="h-full w-full object-cover" />
                    : <ImageIcon aria-hidden="true" className="h-4 w-4 text-slate-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[11px] font-bold leading-4 text-[#12234b] sm:text-xs">{task.title}</h2>
                  {proof ? (
                    <p className="truncate text-[9px] font-semibold leading-3 text-[#2456b8]">
                      {t('الإثبات قيد المراجعة')}
                    </p>
                  ) : (
                    <div className="mt-0.5 flex min-w-0 flex-col items-start gap-0.5 text-[9px] leading-3 text-slate-400">
                      <span className="block font-semibold text-slate-500" dir="rtl">
                        {task.targetCount.toLocaleString()} {t('متابع')}
                      </span>
                      <span className="block w-full truncate" dir="ltr">{task.link}</span>
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[#eafbf8] px-2 py-1 text-[9px] font-bold text-[#159b89]">{formatTaskReward(rewards.tiktokTaskReward)}</span>
                <Button
                  type="button"
                  data-testid={`button-start-${task.id}`}
                  onClick={() => onStartTask?.(task)}
                  variant="secondary"
                  size="fit"
                  className="flex h-9 min-w-[66px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border-[#c9e9f4] bg-white px-2 text-[9px] font-bold text-[#147fa7] transition hover:border-[#229ed9] hover:bg-[#effaff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#229ed9]"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  {t('ابدأ')}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
