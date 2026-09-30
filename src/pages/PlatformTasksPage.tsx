import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, Target, Trash2, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { readLocalState } from '@/legacy/shared';
import type { PromotionCampaign, PromotionPlatform, TaskProof } from '@/legacy/shared';

const telegramVerifiedStorageKey = 'vidreward.telegram-verified.v1';
const telegramTaskReward = 0.02;
const pollIntervalMs = 4000;
const maxPollAttempts = 15;

type TelegramTaskState = { status: 'idle' | 'checking' | 'verified' | 'not-member' | 'error'; message?: string };
type VerifyResult = 'verified' | 'not-member' | 'error';

const verifyErrorMessages: Record<string, string> = {
  needs_telegram: 'افتح التطبيق من Telegram لإكمال التحقق.',
  bot_not_configured: 'التحقق التلقائي غير مفعّل حاليًا.',
  bot_not_admin: 'تعذّر التحقق: البوت غير مشرف في القناة.',
  invalid_channel: 'رابط القناة لا يدعم التحقق التلقائي.',
  invalid_init_data: 'انتهت الجلسة، أعد فتح التطبيق من Telegram.',
  default: 'تعذّر التحقق الآن، حاول مرة أخرى.',
};

function openChannel(link: string) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openTelegramLink && /^https?:\/\/(www\.)?(t|telegram)\.me\//i.test(link)) {
    webApp.openTelegramLink(link);
    return;
  }
  window.open(link, '_blank', 'noopener,noreferrer');
}

function shortLink(link: string) {
  return link.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

function TaskStep({ number, title, done, last = false, children }: { number: number; title: string; done: boolean; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span aria-hidden="true" className={`absolute bottom-0 start-[13px] top-7 w-px ${done ? 'bg-[#159b89]/40' : 'bg-slate-200'}`} />}
      <span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${done ? 'bg-[#159b89] text-white' : 'border border-slate-200 bg-white text-slate-400'}`}>
        {done ? <Check className="h-3.5 w-3.5" /> : number}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className={`text-xs font-bold ${done ? 'text-slate-500' : 'text-[#12234b]'}`}>{title}</div>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}

export function PlatformTasksPage({
  platform,
  campaigns,
  proofs,
  onSubmitProof,
  onTaskVerified,
}: {
  platform: PromotionPlatform;
  campaigns: PromotionCampaign[];
  proofs: TaskProof[];
  onSubmitProof: (campaignId: string, image: string) => void;
  onTaskVerified?: (campaignId: string, reward: number) => void;
}) {
  const { dir } = useLanguage();
  const isTelegram = platform === 'telegram';
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

  // Telegram: automatic membership verification through the server (the bot token never reaches the client).
  const [verifiedIds, setVerifiedIds] = useState<string[]>(() => readLocalState<string[]>(telegramVerifiedStorageKey, []));
  const [telegramStates, setTelegramStates] = useState<Record<string, TelegramTaskState>>({});
  const [joiningId, setJoiningId] = useState('');
  const verifiedRef = useRef(new Set(verifiedIds));
  const inFlightRef = useRef(false);

  // TikTok: manual proof flow.
  const [openedIds, setOpenedIds] = useState<Record<string, boolean>>({});
  const [proofImages, setProofImages] = useState<Record<string, string>>({});

  const setTaskState = (id: string, next: TelegramTaskState) => setTelegramStates((current) => ({ ...current, [id]: next }));

  const markVerified = (task: PromotionCampaign) => {
    setTaskState(task.id, { status: 'verified' });
    if (verifiedRef.current.has(task.id)) return;
    verifiedRef.current.add(task.id);
    const next = [...verifiedRef.current];
    setVerifiedIds(next);
    try {
      window.localStorage.setItem(telegramVerifiedStorageKey, JSON.stringify(next));
    } catch {
      // Storage may be unavailable in a restricted WebView; verification still works for this session.
    }
    onTaskVerified?.(task.id, telegramTaskReward);
  };

  const verifyMembership = async (task: PromotionCampaign): Promise<VerifyResult> => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      setTaskState(task.id, { status: 'error', message: verifyErrorMessages.needs_telegram });
      return 'error';
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/telegram/verify-membership`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initData, link: task.link }),
      });
      const data = await response.json().catch(() => ({})) as { member?: boolean; code?: string };
      if (response.ok && data.member) {
        markVerified(task);
        return 'verified';
      }
      if (response.ok) return 'not-member';
      setTaskState(task.id, { status: 'error', message: verifyErrorMessages[data.code ?? ''] ?? verifyErrorMessages.default });
      return 'error';
    } catch {
      setTaskState(task.id, { status: 'error', message: verifyErrorMessages.default });
      return 'error';
    }
  };

  const latestRef = useRef({ tasks, verifyMembership });
  latestRef.current = { tasks, verifyMembership };

  const joinChannel = (task: PromotionCampaign) => {
    openChannel(task.link);
    setTaskState(task.id, { status: 'checking' });
    setJoiningId(task.id);
  };

  const recheck = async (task: PromotionCampaign) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setTaskState(task.id, { status: 'checking' });
    const result = await verifyMembership(task);
    inFlightRef.current = false;
    if (result === 'not-member') setTaskState(task.id, { status: 'not-member' });
  };

  // After the user taps "Join", keep checking automatically: when they return to the app and on a short interval.
  useEffect(() => {
    if (!joiningId) return;
    let attempts = 0;
    let finished = false;
    const run = async () => {
      if (finished || inFlightRef.current) return;
      const task = latestRef.current.tasks.find((item) => item.id === joiningId);
      if (!task) return;
      inFlightRef.current = true;
      attempts += 1;
      const result = await latestRef.current.verifyMembership(task);
      inFlightRef.current = false;
      if (finished) return;
      if (result !== 'not-member' || attempts >= maxPollAttempts) {
        finished = true;
        if (result === 'not-member') setTaskState(task.id, { status: 'not-member' });
        setJoiningId('');
      }
    };
    const handleReturn = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const timer = window.setInterval(() => void run(), pollIntervalMs);
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleReturn);
    return () => {
      finished = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleReturn);
    };
  }, [joiningId]);

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

  const removeProofImage = (taskId: string) => setProofImages((current) => {
    const next = { ...current };
    delete next[taskId];
    return next;
  });

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <div className="mb-7">
        <div className="text-xs font-semibold text-[#1557ee]">مساحة الربح / {isTelegram ? 'Telegram' : 'TikTok'}</div>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">{isTelegram ? 'مهام Telegram' : 'مهام TikTok'}</h1>
        <p className="mt-2 text-sm text-slate-500">{isTelegram ? 'انضم إلى القناة وسيتم التحقق من اشتراكك تلقائيًا.' : 'اتبع الخطوات الثلاث: تابع الحساب، أرفق صورة الإثبات، ثم أرسلها للمراجعة.'}</p>
      </div>
      {!activeCampaigns.length && <div className="mb-5 rounded-xl border border-blue-100 bg-[#f4f8ff] px-4 py-3 text-[11px] leading-5 text-slate-600">المعروض أدناه أمثلة توضيحية للمهام. الحملات التي تنشئها ستظهر هنا بعد تفعيلها.</div>}
      {isTelegram && campaigns.some((campaign) => campaign.platform === 'telegram' && campaign.status !== 'نشط') && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">توجد حملة Telegram بانتظار التحقق من إعداد البوت؛ لا تُعرض كمهمة نشطة قبل تأكيد الصلاحيات من جهة موثوقة.</div>}

      {isTelegram ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          {tasks.map((task) => {
            const state: TelegramTaskState = verifiedIds.includes(task.id) ? { status: 'verified' } : telegramStates[task.id] ?? { status: 'idle' };
            const subtitle = state.status === 'verified' ? 'تم التحقق من الاشتراك'
              : state.status === 'checking' ? 'جارٍ التحقق تلقائيًا…'
              : state.status === 'not-member' ? 'لم يتم العثور على اشتراكك بعد'
              : state.status === 'error' ? state.message ?? verifyErrorMessages.default
              : shortLink(task.link);
            const subtitleTone = state.status === 'verified' ? 'text-[#159b89]'
              : state.status === 'checking' ? 'text-[#1557ee]'
              : state.status === 'not-member' ? 'text-amber-700'
              : state.status === 'error' ? 'text-rose-600'
              : 'text-slate-400';
            return (
              <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="flex h-[60px] max-h-[60px] items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 shadow-[var(--shadow-soft)]">
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#edf3ff] text-[#1557ee]">
                  {task.image ? <img src={task.image} alt={task.title} className="h-full w-full object-cover" /> : <Users className="h-[18px] w-[18px]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[13px] font-bold leading-5 text-[#12234b]">{task.title}</h2>
                  <p className={`truncate text-[10px] leading-4 ${subtitleTone}`} dir={state.status === 'idle' ? 'ltr' : dir} role={state.status === 'idle' ? undefined : 'status'}>{subtitle}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#eafbf8] px-2 py-1 text-[10px] font-bold text-[#159b89]">$0.02</span>
                <div className="flex w-[76px] shrink-0 justify-end">
                  {state.status === 'verified' ? (
                    <CheckCircle2 aria-label="تم التحقق" data-testid={`status-verified-${task.id}`} className="h-6 w-6 text-[#159b89]" />
                  ) : state.status === 'checking' ? (
                    <Loader2 aria-label="جارٍ التحقق" className="h-5 w-5 animate-spin text-[#1557ee]" />
                  ) : state.status === 'error' ? (
                    <Button type="button" data-testid={`button-retry-${task.id}`} onClick={() => void recheck(task)} variant="secondary" size="sm" className="h-8 min-h-8 w-full gap-1 px-2 text-[11px] font-bold"><RefreshCw className="h-3 w-3" /> تحقق</Button>
                  ) : (
                    <Button type="button" data-testid={`button-join-${task.id}`} onClick={() => joinChannel(task)} variant="primary" size="sm" className="h-8 min-h-8 w-full px-2 text-[11px] font-bold">انضم</Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tasks.map((task) => {
            const proof = proofs.find((item) => item.campaignId === task.id);
            const image = proofImages[task.id];
            const opened = Boolean(openedIds[task.id]) || Boolean(image) || Boolean(proof);
            const completedSteps = proof ? 3 : image ? 2 : opened ? 1 : 0;
            return (
              <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
                <div className="flex gap-1 px-4 pt-4" aria-hidden="true">
                  {[0, 1, 2].map((index) => <span key={index} className={`h-1 flex-1 rounded-full transition-colors ${index < completedSteps ? 'bg-[#159b89]' : 'bg-slate-100'}`} />)}
                </div>
                <div className="flex items-center gap-3 p-4 pb-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#edf3ff] text-[#1557ee]">
                    {task.image ? <img src={task.image} alt={task.title} className="h-full w-full object-cover" /> : <Target className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold text-[#12234b]">{task.title}</h2>
                    <a href={task.link} target="_blank" rel="noreferrer" dir="ltr" className="mt-1 block truncate text-left text-[10px] text-slate-400">{shortLink(task.link)}</a>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]">$0.01</span>
                </div>
                <ol className="border-t border-slate-100 p-4">
                  <TaskStep number={1} title="تابع الحساب على TikTok" done={opened}>
                    <Button type="button" data-testid={`button-open-${task.id}`} onClick={() => { window.open(task.link, '_blank', 'noopener,noreferrer'); setOpenedIds((current) => ({ ...current, [task.id]: true })); }} variant={opened ? 'secondary' : 'primary'} size="sm" className="h-9 min-h-9 gap-1.5 px-3 text-xs font-bold"><ExternalLink className="h-3.5 w-3.5" /> فتح حساب TikTok</Button>
                  </TaskStep>
                  <TaskStep number={2} title="أرفق صورة تثبت المتابعة" done={Boolean(image) || Boolean(proof)}>
                    {proof || image ? (
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#fbfcff] p-2">
                        <img src={proof?.image ?? image} alt={proof ? 'إثبات المتابعة' : 'معاينة صورة الإثبات'} className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-500">{proof ? 'أُرسل الإثبات للمراجعة اليدوية.' : 'الصورة جاهزة للإرسال'}</span>
                        {!proof && <Button type="button" aria-label="إزالة الصورة" onClick={() => removeProofImage(task.id)} variant="ghost" size="icon" className="h-8 min-h-8 w-8 shrink-0 text-slate-400"><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-[#fbfcff] p-3 transition hover:border-[#1557ee] hover:bg-[#f4f8ff]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[#1557ee]"><Upload className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-[#12234b]">اختر صورة الإثبات</span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">PNG أو JPG · حتى 2 ميغابايت</span>
                        </span>
                        <input type="file" data-testid={`input-proof-${task.id}`} accept="image/*" onChange={(event) => handleProofImage(task.id, event)} className="sr-only" />
                      </label>
                    )}
                  </TaskStep>
                  <TaskStep number={3} title="أرسل الإثبات للمراجعة" done={Boolean(proof)} last>
                    {proof ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf3ff] px-3 py-1.5 text-[11px] font-bold text-[#2456b8]"><Clock3 className="h-3.5 w-3.5" /> قيد المراجعة</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" data-testid={`button-submit-proof-${task.id}`} disabled={!image} onClick={() => image && onSubmitProof(task.id, image)} variant="primary" size="sm" className="h-9 min-h-9 px-4 text-xs font-bold disabled:opacity-50">إرسال الإثبات للمراجعة</Button>
                        {!image && <span className="flex items-center gap-1 text-[10px] text-slate-400"><AlertCircle className="h-3 w-3" /> أرفق الصورة أولًا</span>}
                      </div>
                    )}
                  </TaskStep>
                </ol>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
