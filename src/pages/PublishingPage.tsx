import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, Clipboard, Clock3, Copy, History, Image as ImageIcon, Info,
  Link2, LoaderCircle, Share2, Target, Trash2, Upload, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import type { TelegramUser } from '@/legacy/shared';

type PublishStatus = 'idle' | 'pending' | 'approved' | 'rejected';

type PublishRecord = {
  id: string;
  status: 'قيد المراجعة' | 'معتمد' | 'مرفوض';
  reward: number;
  imageCount: number;
  today: boolean;
  rejectionReason: string;
  createdAt: string;
};

const MAX_PROOF_IMAGES = 5;

// تصغير الصورة قبل الرفع حتى يبقى الطلب (حتى 5 صور) ضمن حد جسم الطلب في الخادم.
function readProofImage(file: File): Promise<string> {
  const readRaw = () => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read')));
    reader.onerror = () => reject(reader.error ?? new Error('read'));
    reader.readAsDataURL(file);
  });
  return readRaw().then((raw) => new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { resolve(raw); return; }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = () => resolve(raw);
    image.src = raw;
  }));
}

export function PublishingSystemPage({
  telegramUser,
  onNotify,
}: {
  telegramUser: TelegramUser | null;
  onNotify?: (tone: 'success' | 'info' | 'warning', title: string, message: string) => void;
}) {
  const { isArabic, dir } = useLanguage();
  const [copied, setCopied] = useState<'post' | 'link' | ''>('');
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [records, setRecords] = useState<PublishRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const referralCode = telegramUser?.id ? String(telegramUser.id) : '00000';
  const promotionalLink = `https://t.me/youTubeVieewBot/ads?startapp=ref_${referralCode}`;
  const promotionalPost = isArabic
    ? `بصراحة تجربة VidReward عجبتني 😄 بدأت أشاهد فيديوهات قصيرة في وقت فراغي، وكل مشاهدة مكتملة تضيف لي مكافأة على رصيدي 💸\n\nوالأجمل أنني أربح 20% من أرباح أي شخص يدخل عن طريق رابط الإحالة الخاص بي. إذا تحب تجربها وتربح من وقتك، ادخل من هنا 👇\n${promotionalLink}`
    : `Honestly, I have been enjoying VidReward 😄 I started watching short videos in my free time, and every completed view adds a reward to my balance 💸\n\nEven better, I earn 20% of the rewards of anyone who joins through my referral link. If you want to try it and earn from your time, join here 👇\n${promotionalLink}`;
  const [invitedUsers, setInvitedUsers] = useState(0);
  useEffect(() => {
    apiGet<{ invited: number }>('referrals').then((result) => setInvitedUsers(Number(result.invited) || 0)).catch(() => undefined);
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      setRecords(await apiGet<PublishRecord[]>('publish/proofs'));
    } catch {
      // يبقى آخر عرض معروف؛ تُعاد المحاولة في الدورة التالية.
    }
  }, []);
  useEffect(() => { void loadRecords(); }, [loadRecords]);

  // حالة اليوم تأتي من الخادم: آخر طلب اليوم (إن وُجد) هو الحالة الحالية.
  const todayRecord = records.find((record) => record.today);
  const status: PublishStatus = !todayRecord ? 'idle'
    : todayRecord.status === 'معتمد' ? 'approved'
      : todayRecord.status === 'مرفوض' ? 'rejected' : 'pending';
  const alreadySubmittedToday = status === 'pending' || status === 'approved';

  // أثناء انتظار المراجعة نُحدّث الحالة دوريًا حتى يظهر الاعتماد/الرفض دون إعادة فتح الصفحة.
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRecords();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [status, loadRecords]);

  const referralEarnings = '$0.00';
  const statusConfig: Record<PublishStatus, {
    title: string;
    description: string;
    amount: string;
    icon: typeof Clock3;
    className: string;
    iconClassName: string;
  }> = {
    idle: {
      title: 'لم يتم الإرسال بعد',
      description: 'أرسل إثبات نشر اليوم لاستلام المكافأة',
      amount: '$0.02',
      icon: Clock3,
      className: 'border-slate-200 bg-white',
      iconClassName: 'bg-slate-100 text-slate-400',
    },
    pending: {
      title: 'قيد المراجعة',
      description: 'بانتظار مراجعة فريق الإدارة',
      amount: '$0.02',
      icon: Clock3,
      className: 'border-amber-100 bg-[#fff9ef]',
      iconClassName: 'bg-[#fff0cf] text-[#c98017]',
    },
    approved: {
      title: 'تمت الموافقة',
      description: 'تم اعتماد المهمة وإضافة المكافأة',
      amount: '$0.02',
      icon: CheckCircle2,
      className: 'border-emerald-100 bg-[#f2fcf8]',
      iconClassName: 'bg-[#e1f8ef] text-[#159b89]',
    },
    rejected: {
      title: 'تحتاج إلى تعديل',
      description: todayRecord?.rejectionReason || 'راجع الإثبات وأرسله مرة أخرى',
      amount: '$0.02',
      icon: Info,
      className: 'border-rose-100 bg-[#fff5f5]',
      iconClassName: 'bg-[#ffe4e4] text-[#d95757]',
    },
  };
  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;

  const copyText = async (value: string, key: 'post' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be unavailable in an embedded preview.
    }
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1600);
  };

  const addProofImage = async (file?: File) => {
    if (!file || proofImages.length >= MAX_PROOF_IMAGES) return;
    if (!file.type.startsWith('image/')) {
      onNotify?.('warning', 'ملف غير صالح', 'اختر صورة (لقطة شاشة) لإثبات النشر.');
      return;
    }
    try {
      const image = await readProofImage(file);
      setProofImages((current) => [...current, image].slice(0, MAX_PROOF_IMAGES));
    } catch {
      onNotify?.('warning', 'تعذر قراءة الصورة', 'جرّب صورة أخرى.');
    }
  };

  const submitProofs = async () => {
    if (!proofImages.length || submitLockRef.current || alreadySubmittedToday) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await apiPost('publish/proof', { images: proofImages });
      setProofImages([]);
      await loadRecords();
      onNotify?.('info', 'الإثبات قيد المراجعة', 'تم إرسال صور الإثبات للمراجعة اليدوية.');
    } catch (error) {
      const message = error instanceof ApiError && (error.status === 400 || error.status === 409)
        ? error.message
        : error instanceof ApiError && error.status === 401
          ? 'افتح التطبيق من Telegram لإرسال الإثبات.'
          : 'تعذر إرسال الإثبات. تحقق من الاتصال ثم حاول مرة أخرى.';
      onNotify?.('warning', 'تعذر إرسال الإثبات', message);
      if (error instanceof ApiError && error.status === 409) void loadRecords();
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const removeProofImage = (index: number) => {
    setProofImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  };

  return (
    <main className="mx-auto w-full max-w-[1180px] overflow-hidden px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <section className="animate-rise relative overflow-hidden rounded-[26px] bg-[#0e2452] px-5 py-7 text-white shadow-[0_5px_16px_rgba(14,36,82,.12)] md:px-8 md:py-8">
        <div className="grid-dots absolute inset-0 opacity-15" />
        <div className="absolute -left-14 -top-20 h-56 w-56 rounded-full border border-cyan-200/15" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-cyan-300"><Share2 className="h-4 w-4" /> مساحة المشاركة</div>
            <h1 className="font-display text-[27px] font-bold leading-tight tracking-[-.04em] md:text-[36px]">نظام النشر</h1>
             <p className="mt-3 max-w-md text-sm leading-7 text-blue-100/70">انشر تجربتك، استخدم رابطك الشخصي، واحصل على مكافأتك اليومية بالإضافة إلى 20% من أرباح المستخدمين الذين دعوتهم.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.07] px-4 py-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/15 text-cyan-300"><Share2 className="h-5 w-5" /></span>
            <div>
              <div className="text-[10px] font-semibold text-blue-100/60">المكافأة اليومية</div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight">$0.02</div>
            </div>
            <span className="mr-1 rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">متاحة اليوم</span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(18,32,77,.05)] md:p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="font-display text-lg font-bold text-[#12234b]">مهمتك اليوم</h2><p className="mt-1 text-[11px] text-slate-400">أكمل خطوات بسيطة لاستلام المكافأة</p></div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><Target className="h-5 w-5" /></span>
          </div>
           <div className="mt-6">
             <div className="flex items-center justify-between gap-3 text-xs">
               <span className="flex items-center gap-2 font-semibold text-slate-600"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf3ff] text-[#1557ee]"><Share2 className="h-3.5 w-3.5" /></span>إثباتات النشر اليوم</span>
               <strong className="tabular-nums text-[#12234b]">{todayRecord ? todayRecord.imageCount : proofImages.length} / 5</strong>
             </div>
             <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1557ee] transition-all" style={{ width: `${Math.min(100, ((todayRecord ? todayRecord.imageCount : proofImages.length) / MAX_PROOF_IMAGES) * 100)}%` }} /></div>
             <p className="mt-3 text-[10px] leading-5 text-slate-400">ارفع صورًا من أي منصة نشرت فيها، حتى 5 صور في طلب واحد.</p>
           </div>
        </div>
        <div className="rounded-[22px] border border-blue-100 bg-[#f4f8ff] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
             <div><div className="text-xs font-bold text-[#1557ee]">دليل سريع</div><h2 className="mt-1 font-display text-lg font-bold text-[#12234b]">كيف تحصل على المكافأة؟</h2><p className="mt-2 max-w-lg text-xs leading-6 text-slate-500">انسخ المنشور والرابط، انشرهما في مكان مناسب، ثم أرفق صورًا واضحة من النشر ليتم التحقق من المهمة.</p></div>
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[#1557ee] shadow-[0_2px_6px_rgba(18,32,77,.06)] sm:grid"><CheckCircle2 className="h-6 w-6" /></span>
          </div>
           <div className="mt-5 grid gap-2 text-[10px] font-semibold text-slate-500 sm:grid-cols-3">
             <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[#1557ee]">1</span><span><b className="block text-[#12234b]">انسخ</b><span className="font-normal">المنشور والرابط</span></span></div>
             <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eafbf8] text-[#159b89]">2</span><span><b className="block text-[#12234b]">انشر</b><span className="font-normal">في مجتمع مناسب</span></span></div>
             <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#fff6e8] text-[#c98017]">3</span><span><b className="block text-[#12234b]">أثبت</b><span className="font-normal">وأرسل للمراجعة</span></span></div>
          </div>
        </div>
      </section>

       <section className="mt-5 rounded-[22px] border border-emerald-100 bg-[#f2fcf8] p-5 shadow-[0_4px_14px_rgba(18,32,77,.05)] md:p-6">
         <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
           <div className="max-w-xl">
             <div className="flex items-center gap-2 text-xs font-bold text-[#159b89]"><Users className="h-4 w-4" /> برنامج الإحالة</div>
             <h2 className="mt-2 font-display text-xl font-bold text-[#12234b]">اربح من كل مستخدم يدخل من رابطك</h2>
             <p className="mt-2 text-xs leading-6 text-slate-500">كل مستخدم جديد يسجل عبر رابط الإحالة الخاص بك يمنحك 20% من أرباحه وفق نظام VidReward. شارك الرابط مع أصدقائك ومجتمعاتك وتابع نتيجتك هنا.</p>
           </div>
           <div className="grid grid-cols-3 gap-2 lg:min-w-[390px]">
             <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-center"><div className="text-[10px] text-slate-400">نسبة الإحالة</div><div className="mt-1 text-xl font-bold text-[#159b89]">20%</div></div>
             <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-center"><div className="text-[10px] text-slate-400">المستخدمون المدعوون</div><div className="mt-1 text-xl font-bold text-[#12234b]">{invitedUsers}</div></div>
             <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-center"><div className="text-[10px] text-slate-400">ربح الإحالات</div><div className="mt-1 text-xl font-bold text-[#159b89]">{referralEarnings}</div></div>
           </div>
         </div>
         <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-3 sm:flex-row sm:items-center">
           <div className="min-w-0 flex-1">
             <div className="text-[10px] font-bold text-slate-400">رابط الإحالة الخاص بك</div>
             <div dir="ltr" className="mt-1 truncate rounded-xl bg-[#f7faf9] px-3 py-2 text-left text-xs font-semibold text-[#12234b]">{promotionalLink}</div>
           </div>
           <Button type="button" variant="secondary" size="sm" onClick={() => copyText(promotionalLink, 'link')} className="flex shrink-0 items-center justify-center gap-2 bg-[#eafbf8] text-xs font-bold text-[#159b89]"><Link2 className="h-3.5 w-3.5" />{copied === 'link' ? 'تم نسخ الرابط' : 'نسخ الرابط'}</Button>
         </div>
       </section>

       <section className="mt-5">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(18,32,77,.05)] md:p-6">
           <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-[#12234b]">منشور ترويجي جاهز</h2><p className="mt-1 text-[11px] text-slate-400">نص بسيط وطبيعي للمشاركة مع رابطك المباشر</p></div><Clipboard className="h-5 w-5 text-[#1557ee]" /></div>
           <div className="mt-5 whitespace-pre-line rounded-[18px] border border-slate-200 bg-[#fbfcff] p-4 text-sm leading-7 text-slate-600">{promotionalPost}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={() => copyText(promotionalPost, 'post')} className="flex items-center gap-2 text-xs font-bold"><Copy className="h-3.5 w-3.5" />{copied === 'post' ? 'تم النسخ' : 'نسخ المنشور'}</Button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(18,32,77,.05)] md:p-6">
         <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-[#12234b]">صور إثباتات</h2><p className="mt-1 text-[11px] text-slate-400">اجمع صور Telegram وFacebook وأي منصة أخرى في طلب واحد</p></div><ImageIcon className="h-5 w-5 text-[#1557ee]" /></div>
         <div className="mt-5 rounded-[18px] border border-dashed border-[#b8c8e8] bg-[#fbfcff] p-4">
           <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
             <div className="flex items-center gap-3">
               <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><Upload className="h-5 w-5" /></span>
               <div><div className="text-sm font-bold text-[#12234b]">أضف صور إثباتات النشر</div><div className="mt-1 text-[10px] leading-5 text-slate-400">يمكنك إضافة حتى 5 صور واضحة من نفس المهمة.</div></div>
             </div>
             <label className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#b8c8e8] bg-white px-3 text-xs font-bold text-[#1557ee] transition hover:bg-[#edf3ff] ${proofImages.length >= 5 ? 'pointer-events-none opacity-50' : ''}`}>
               <Upload className="h-3.5 w-3.5" /> إضافة صورة
               <input
                 type="file"
                 accept="image/*"
                 className="sr-only"
                 disabled={proofImages.length >= 5}
                 onChange={(event) => {
                   const file = event.currentTarget.files?.[0];
                   event.currentTarget.value = '';
                   void addProofImage(file);
                 }}
               />
             </label>
           </div>
           <div className="mt-4 flex items-center justify-between text-[10px] font-semibold text-slate-400"><span>صور الإثبات المضافة</span><span className="text-[#1557ee]">{proofImages.length} / 5</span></div>
           {proofImages.length > 0 ? (
             <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
               {proofImages.map((image, index) => (
                 <div key={`${image.slice(-12)}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
                   <img src={image} alt={`صورة إثبات ${index + 1}`} className="h-full w-full object-cover" />
                   <Button type="button" variant="danger" size="icon" onClick={() => removeProofImage(index)} className="absolute right-1 top-1 grid h-6 w-6 min-h-0 rounded-md p-0 opacity-0 transition group-hover:opacity-100" aria-label={`حذف صورة إثبات ${index + 1}`}>
                     <Trash2 className="h-3 w-3" />
                   </Button>
                 </div>
               ))}
             </div>
           ) : (
             <div className="mt-2 rounded-xl bg-white px-3 py-5 text-center text-[10px] text-slate-400">لم تتم إضافة صور بعد — ارفع لقطة شاشة يظهر فيها المنشور بوضوح.</div>
           )}
         </div>
        <Button type="button" data-testid="button-submit-publish-proof" variant="primary" size="lg" disabled={!proofImages.length || isSubmitting || alreadySubmittedToday} aria-busy={isSubmitting} onClick={() => { void submitProofs(); }} className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-bold disabled:opacity-50">{isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} {isSubmitting ? 'جارٍ الإرسال…' : alreadySubmittedToday ? 'تم إرسال إثبات اليوم' : 'إرسال للمراجعة'}</Button>
      </section>

      <section className={`mt-5 rounded-[22px] border p-5 shadow-[0_4px_14px_rgba(18,32,77,.05)] md:p-6 ${currentStatus.className}`}>
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${currentStatus.iconClassName}`}><StatusIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><div className="text-[10px] font-bold text-slate-400">حالة المهمة الحالية</div><h2 className="mt-1 font-display text-lg font-bold text-[#12234b]">{currentStatus.title}</h2><p className="mt-1 text-xs text-slate-500">{currentStatus.description}</p></div>
          <strong className="shrink-0 text-lg font-bold text-[#159b89]">{currentStatus.amount}</strong>
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-end justify-between"><div><h2 className="font-display text-lg font-bold text-[#12234b]">سجل المهام</h2><p className="mt-1 text-[11px] text-slate-400">آخر طلبات النشر التي أرسلتها</p></div><History className="h-5 w-5 text-slate-400" /></div>
        {records.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-6 text-center text-[11px] text-slate-400">لا توجد طلبات نشر بعد.</div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {records.slice(0, 6).map((record) => {
              const tone = record.status === 'معتمد' ? 'text-[#159b89] bg-[#eafbf8]' : record.status === 'مرفوض' ? 'text-[#d95757] bg-[#ffe4e4]' : 'text-[#c98017] bg-[#fff6e8]';
              const date = new Date(record.createdAt);
              return (
                <div key={record.id} className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 shadow-[0_3px_10px_rgba(18,32,77,.04)]">
                  <div><div className="text-xs font-bold text-[#12234b]">{Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(isArabic ? 'ar' : 'en-US', { day: 'numeric', month: 'short' })}</div><div className="mt-1 text-[10px] text-slate-400">{record.imageCount} / 5 صور</div></div>
                  <div className="text-left"><div className="text-sm font-bold text-[#159b89]">${record.reward.toFixed(2)}</div><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[9px] font-bold ${tone}`}>{record.status}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

