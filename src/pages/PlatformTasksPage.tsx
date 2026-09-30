import { useEffect, useState, type ChangeEvent } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, ExternalLink, ImagePlus, LoaderCircle, ShieldCheck } from 'lucide-react';
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
  onSubmitProof,
  telegramUserId,
}: {
  platform: PromotionPlatform;
  campaigns: PromotionCampaign[];
  proofs: TaskProof[];
  onSubmitProof: (campaignId: string, image: string) => void;
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
  const [proofImages, setProofImages] = useState<Record<string, string>>({});

  const handleProofImage = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2_000_000) {
      window.alert('حجم الإثبات يجب أن يكون أقل من 2 ميغابايت.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofImages((current) => ({ ...current, [taskId]: String(reader.result ?? '') }));
    reader.readAsDataURL(file);
  };

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
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf8fd] text-[#229ED9]">
                    <SiTelegram aria-hidden="true" className="h-5 w-5" />
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
            <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[var(--shadow-soft)] transition hover:border-blue-200 hover:shadow-[var(--shadow-lift)]">
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#111111]">
                    <SiTiktok aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">حساب TikTok</span>
                      <span className="rounded-full bg-[#eafbf8] px-2 py-0.5 text-[9px] font-bold text-[#159b89]">متابعة</span>
                    </div>
                    <h2 className="line-clamp-2 text-sm font-bold leading-5 text-[#12234b]">{task.title}</h2>
                    <a href={task.link} target="_blank" rel="noreferrer" dir="ltr" className="mt-1 block truncate text-left text-[10px] text-slate-400">{task.link}</a>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]">{isTelegram ? '$0.02' : '$0.01'}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                  <span>هدف المتابعة</span>
                  <span className="font-semibold text-slate-600">{task.targetCount.toLocaleString()} متابع <span className="mx-1 text-slate-300">·</span> $0.01 لكل متابعة</span>
                </div>
              </div>
              <div className="border-t border-slate-100 bg-[#fbfcff] px-4 py-4 sm:px-5">
                {proof ? (
                  <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white p-3">
                    <img src={proof.image} alt="إثبات المتابعة" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-bold text-[#2456b8]"><Clock3 className="h-3.5 w-3.5" /> قيد المراجعة</p><p className="mt-1 text-[10px] leading-4 text-slate-400">وصل الإثبات، وسيُراجع قبل اعتماد المكافأة.</p></div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <div className="flex flex-col gap-2">
                      <Button type="button" data-testid={`button-open-${task.id}`} onClick={() => window.open(task.link, '_blank', 'noopener,noreferrer')} variant="secondary" size="sm" className="justify-center gap-2 border-slate-200 bg-white text-xs font-bold text-[#12234b]">
                        <ArrowUpRight className="h-3.5 w-3.5" /> افتح حساب TikTok
                      </Button>
                      <div className="flex items-start gap-2 rounded-xl bg-white p-3 text-[10px] leading-5 text-slate-500">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 font-bold text-slate-600">1</span>
                        <span>تابع الحساب ثم التقط صورة تظهر اسم الحساب بوضوح.</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-center text-[10px] font-bold text-slate-600 transition hover:border-[#1557ee] hover:text-[#1557ee]">
                        <ImagePlus className="h-4 w-4 text-[#1557ee]" /> {proofImages[task.id] ? 'تم اختيار صورة الإثبات' : 'اختر صورة الإثبات'}
                        <input type="file" data-testid={`input-proof-${task.id}`} accept="image/*" onChange={(event) => handleProofImage(task.id, event)} className="sr-only" />
                      </label>
                      <Button type="button" data-testid={`button-submit-proof-${task.id}`} disabled={!proofImages[task.id]} onClick={() => onSubmitProof(task.id, proofImages[task.id])} variant="primary" size="sm" className="justify-center gap-2 text-xs font-bold disabled:opacity-50">
                        <ShieldCheck className="h-3.5 w-3.5" /> أرسل الإثبات للمراجعة
                      </Button>
                    </div>
                    {proofImages[task.id] && <img src={proofImages[task.id]} alt="معاينة صورة الإثبات" className="col-span-full h-36 w-full rounded-xl border border-slate-200 object-cover" />}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
