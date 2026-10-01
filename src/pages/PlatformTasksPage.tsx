import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, ExternalLink, ImageIcon, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import type { PromotionCampaign, PromotionPlatform, TaskProof } from '@/legacy/shared';
import { SiTelegram, SiTiktok } from 'react-icons/si';

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
  telegramUserId,
}: {
  platform: PromotionPlatform;
  campaigns: PromotionCampaign[];
  proofs: TaskProof[];
  onStartTask?: (campaign: PromotionCampaign) => void;
  telegramUserId: number | null;
}) {
  const { dir } = useLanguage();
  const isTelegram = platform === 'telegram';
  const BrandIcon = isTelegram ? SiTelegram : SiTiktok;
  const brandColor = isTelegram ? '#229ED9' : '#111111';
  const activeCampaigns = campaigns.filter((campaign) => campaign.platform === platform && campaign.status === 'نشط');
  const demoTasks: PromotionCampaign[] = isTelegram
    ? [
        { id: 'demo-telegram-1', platform, title: 'قناة أخبار التقنية العربية', link: 'https://t.me/telegram', targetCount: 100, price: 0.7, status: 'نشط', created: 'مثال' },
        { id: 'demo-telegram-2', platform, title: 'مجتمع المبدعين الرقميين', link: 'https://t.me/telegram', targetCount: 100, price: 0.7, status: 'نشط', created: 'مثال' },
      ]
    : [
        { id: 'demo-tiktok-1', platform, title: 'اكتشف حساب صناع المحتوى', link: 'https://www.tiktok.com/@tiktok', targetCount: 100, price: 2, status: 'نشط', created: 'مثال' },
        { id: 'demo-tiktok-2', platform, title: 'تابع أحدث المقاطع القصيرة', link: 'https://www.tiktok.com/@tiktok', targetCount: 100, price: 2, status: 'نشط', created: 'مثال' },
      ];
  const tasks = activeCampaigns.length ? activeCampaigns : demoTasks;
  const [joiningId, setJoiningId] = useState('');
  const [returnedIds, setReturnedIds] = useState<Record<string, boolean>>({});
  const [verification, setVerification] = useState<Record<string, TaskVerification>>({});
  const verifyMembership = async (task: PromotionCampaign) => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      setVerification((current) => ({
        ...current,
        [task.id]: { state: 'error', message: 'افتح التطبيق من Telegram للتحقق الآلي من العضوية.' },
      }));
      return;
    }
    setVerification((current) => ({ ...current, [task.id]: { state: 'checking' } }));
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/telegram/verify-bot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'verify-member', channelUrl: task.link, initData }),
      });
      const result = await response.json() as MembershipResponse;
      if (!response.ok) throw new Error(result.message || 'تعذر التحقق الآن. حاول مرة أخرى.');
      setVerification((current) => ({
        ...current,
        [task.id]: result.member
          ? { state: 'member', message: 'تم التحقق من اشتراكك عبر Telegram.' }
          : { state: 'not-member', message: 'لم يظهر اشتراكك بعد. انضم إلى القناة ثم أعد التحقق.' },
      }));
    } catch (error) {
      setVerification((current) => ({
        ...current,
        [task.id]: { state: 'error', message: error instanceof Error ? error.message : 'تعذر التحقق الآن. حاول مرة أخرى.' },
      }));
    }
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
          <div className="text-xs font-semibold text-[#1557ee]">مساحة الربح / {isTelegram ? 'Telegram' : 'TikTok'}</div>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">{isTelegram ? 'مهام Telegram' : 'مهام TikTok'}</h1>
          <p className="mt-1 text-xs leading-5 text-slate-500">{isTelegram ? 'انضم إلى القناة، ثم تحقّق تلقائيًا من اشتراكك.' : 'تابع الحساب وارفع لقطة شاشة واضحة لإثبات المتابعة.'}</p>
        </div>
      </div>
      {!activeCampaigns.length && <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-[#f4f8ff] px-4 py-3 text-[11px] leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1557ee]" /><span>هذه أمثلة للمعاينة فقط. ستظهر الحملات الحقيقية هنا بعد نشرها.</span></div>}
      {isTelegram && campaigns.some((campaign) => campaign.platform === 'telegram' && campaign.status !== 'نشط') && <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span>هناك حملة تنتظر تأكيد صلاحيات البوت قبل ظهورها للمهام.</span></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((task) => {
          const proof = proofs.find((item) => item.campaignId === task.id);
          const verificationState = verification[task.id] ?? { state: 'idle' as const };
          if (isTelegram) {
            return (
              <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="h-[60px] max-h-[60px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-2 shadow-[var(--shadow-soft)] transition hover:border-[#b9e6f5] hover:shadow-[var(--shadow-lift)] sm:px-3">
                <div className="flex h-full min-w-0 items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eaf8fd] text-[#229ED9] sm:h-12 sm:w-12">
                    {task.image
                      ? <img src={task.image} alt={`صورة حملة ${task.title}`} className="h-full w-full object-cover" />
                      : <ImageIcon aria-hidden="true" className="h-4 w-4 text-slate-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[11px] font-bold leading-4 text-[#12234b]">{task.title}</h2>
                    <p className={`truncate text-[9px] leading-3 ${verificationState.state === 'member' ? 'text-[#159b89]' : verificationState.state === 'error' || verificationState.state === 'not-member' ? 'text-amber-700' : 'text-slate-400'}`} role={verificationState.state === 'idle' ? undefined : 'status'}>
                      {verificationState.message ?? (returnedIds[task.id] && !telegramUserId ? 'افتح التطبيق من Telegram للتحقق الآلي من العضوية.' : `${task.targetCount.toLocaleString()} مشترك · ${task.link}`)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eafbf8] px-2 py-1 text-[9px] font-bold text-[#159b89]">{isTelegram ? '$0.02' : '$0.01'}</span>
                  <Button
                    type="button"
                    data-testid={`button-join-${task.id}`}
                    disabled={verificationState.state === 'checking' || verificationState.state === 'member' || (returnedIds[task.id] && !telegramUserId)}
                    onClick={() => returnedIds[task.id] ? void verifyMembership(task) : (window.open(task.link, '_blank', 'noopener,noreferrer'), setJoiningId(task.id))}
                    variant={returnedIds[task.id] ? 'primary' : 'secondary'}
                    size="fit"
                    aria-label={returnedIds[task.id] ? 'تحقق من الاشتراك' : 'انضم إلى القناة'}
                    className={`flex h-9 min-w-[58px] shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[9px] font-bold ${returnedIds[task.id] ? 'text-white' : 'border-slate-200 bg-white text-[#12234b]'}`}
                  >
                    {verificationState.state === 'checking' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : verificationState.state === 'member' ? <CheckCircle2 className="h-3.5 w-3.5" /> : returnedIds[task.id] ? <ShieldCheck className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    {verificationState.state === 'checking' ? 'تحقق…' : verificationState.state === 'member' ? 'مكتمل' : returnedIds[task.id] ? 'تحقق' : 'انضم'}
                  </Button>
                </div>
              </article>
            );
          }
          return (
            <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="h-[70px] max-h-[70px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-2 shadow-[var(--shadow-soft)] transition hover:border-blue-200 hover:shadow-[var(--shadow-lift)] sm:px-3">
              <div className="flex h-full min-w-0 items-center gap-2 sm:gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-[#f2f5f8] sm:h-12 sm:w-12">
                  {task.image
                    ? <img src={task.image} alt={`صورة حملة ${task.title}`} className="h-full w-full object-cover" />
                    : <ImageIcon aria-hidden="true" className="h-4 w-4 text-slate-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[11px] font-bold leading-4 text-[#12234b] sm:text-xs">{task.title}</h2>
                  <p className={`truncate text-[9px] leading-3 ${proof ? 'font-semibold text-[#2456b8]' : 'text-slate-400'}`} dir="ltr">
                    {proof ? 'الإثبات قيد المراجعة' : `${task.targetCount.toLocaleString()} متابع · ${task.link}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#eafbf8] px-2 py-1 text-[9px] font-bold text-[#159b89]">$0.01</span>
                <Button
                  type="button"
                  data-testid={`button-start-${task.id}`}
                  onClick={() => onStartTask?.(task)}
                  variant="secondary"
                  size="fit"
                  className="flex h-9 min-w-[74px] shrink-0 items-center justify-center gap-1 rounded-lg border-[#c9e9f4] bg-white px-2 text-[9px] font-bold text-[#147fa7] transition hover:border-[#229ed9] hover:bg-[#effaff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#229ed9]"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  ابدأ المهمة
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
