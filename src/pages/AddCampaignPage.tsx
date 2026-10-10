import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle, ArrowDownLeft, Check, CheckCircle2, Clock3, Film, Image as ImageIcon, Link2, LoaderCircle, Play, ShieldCheck,
  PlaySquare, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTaskReward, useTaskRewards } from '@/lib/useTaskRewards';
import { useLanguage } from '@/i18n';
import { SiTelegram, SiTiktok, SiYoutube } from 'react-icons/si';
import { useLocalPricing } from '@/legacy/pricing';
import { apiGet, ApiError, type YoutubeCampaignSettings } from '@/lib/api';
import {
  createUniqueIdentifier, durationOptions, formatDuration,
  getEmbedUrl, getUserDisplayName, PlatformSelector,
  telegramPackageOptions, tiktokPackageOptions,
  type PromotionCampaign, type PromotionPlatform, type TelegramUser, type Video,
} from '@/legacy/shared';

export function AddPlatformCampaign({
  platform,
  onSelectPlatform,
  onBack,
  onSubmit,
}: {
  platform: PromotionPlatform;
  onSelectPlatform: (platform: 'youtube' | PromotionPlatform) => void;
  onBack: () => void;
  onSubmit: (campaign: PromotionCampaign) => void;
}) {
  const { dir } = useLanguage();
  const rewards = useTaskRewards();
  const pricing = useLocalPricing();
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [selectedCount, setSelectedCount] = useState(platform === 'telegram' ? 100 : 100);
  const [botCheckStatus, setBotCheckStatus] = useState<'idle' | 'checking' | 'verified' | 'error'>('idle');
  const [botCheckMessage, setBotCheckMessage] = useState('');
  const [botVerifiedChannel, setBotVerifiedChannel] = useState('');
  const botCheckRequestId = useRef(0);
  const isTelegram = platform === 'telegram';
  const PlatformIcon = isTelegram ? SiTelegram : SiTiktok;
  const packages = (isTelegram ? pricing.telegram : pricing.tiktok).map(({ value, price }) => ({ count: value, price }));
  const selectedPackage = packages.find((item) => item.count === selectedCount) ?? packages[0];
  const validLink = (() => {
    try {
      const parsed = new URL(link);
      const host = parsed.hostname.toLowerCase();
      return isTelegram
        ? (host === 't.me' || host.endsWith('.t.me') || host === 'telegram.me')
        : (host === 'tiktok.com' || host.endsWith('.tiktok.com')) && parsed.pathname.startsWith('/@');
    } catch {
      return false;
    }
  })();
  const canSubmit = title.trim().length > 1 && validLink && Boolean(image)
    && (!isTelegram || (botCheckStatus === 'verified' && botVerifiedChannel === link));

  const verifyTelegramBot = async (channelUrl: string) => {
    const requestId = ++botCheckRequestId.current;
    setBotCheckStatus('checking');
    setBotCheckMessage('جارٍ التحقق من البوت وصلاحياته على القناة…');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/telegram/verify-bot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'verify-bot', channelUrl }),
      });
      const result = await response.json() as { verified?: boolean; message?: string; botUsername?: string; channelTitle?: string };
      if (!response.ok || !result.verified) throw new Error(result.message || 'تعذر تأكيد صلاحيات البوت على القناة.');
      if (requestId !== botCheckRequestId.current) return;
      setBotCheckStatus('verified');
      setBotVerifiedChannel(channelUrl);
      setBotCheckMessage(`تم التحقق من @${result.botUsername ?? 'bot'} كمشرف على ${result.channelTitle || 'القناة'}.`);
    } catch (error) {
      if (requestId !== botCheckRequestId.current) return;
      setBotCheckStatus('error');
      setBotCheckMessage(error instanceof Error ? error.message : 'تعذر التحقق. تأكد من إضافة البوت مشرفًا ثم حاول مجددًا.');
    }
  };

  useEffect(() => {
    if (!isTelegram) return;
    setBotCheckStatus('idle');
    setBotCheckMessage('');
    setBotVerifiedChannel('');
    if (!validLink) return;
    const timer = window.setTimeout(() => { void verifyTelegramBot(link); }, 650);
    return () => {
      window.clearTimeout(timer);
      botCheckRequestId.current += 1;
    };
  }, [isTelegram, link, validLink]);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2_000_000) {
      window.alert('حجم الصورة يجب أن يكون أقل من 2 ميغابايت.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      id: createUniqueIdentifier('CAM'),
      platform,
      title: title.trim(),
      link: link.trim(),
      image,
      targetCount: selectedPackage.count,
      price: selectedPackage.price,
      status: 'نشط',
      created: 'الآن',
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <PlatformSelector selected={platform} onSelect={onSelectPlatform} />
      <div className="mb-7 flex items-center gap-3">
        <Button type="button" data-testid="button-back-add" onClick={onBack} variant="icon" size="icon" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-[#1557ee]" aria-label="العودة">
          <ArrowDownLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1557ee]"><PlatformIcon aria-hidden="true" className="h-3.5 w-3.5" /> نشر إعلان / {isTelegram ? 'Telegram' : 'TikTok'}</div>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">{isTelegram ? 'نمّ قناتك على Telegram' : 'اجذب متابعين جدد على TikTok'}</h1>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-7">
          <div className="mb-7">
            <h2 className="font-display text-lg font-bold text-[#12234b]">تفاصيل الحملة</h2>
            <p className="mt-1 text-xs text-slate-400">{isTelegram ? 'أدخل رابط القناة وصورة الإعلان واختر عدد المشتركين.' : 'أدخل رابط الحساب وصورة الإعلان واختر عدد المتابعين.'}</p>
          </div>
          <label className="block text-xs font-bold text-slate-700">
            عنوان الحملة <span className="text-[#1557ee]">*</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} data-testid="input-platform-campaign-title" maxLength={60} placeholder={isTelegram ? 'مثال: انضم إلى قناتنا التقنية' : 'مثال: تابع محتوى التصميم اليومي'} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" />
          </label>
          <label className="mt-5 block text-xs font-bold text-slate-700">
            رابط {isTelegram ? 'القناة' : 'حساب TikTok'} <span className="text-[#1557ee]">*</span>
            <div className="relative mt-2">
              <Link2 className="absolute right-4 top-3.5 h-4 w-4 text-slate-400" />
              <input value={link} onChange={(event) => setLink(event.target.value)} data-testid="input-platform-campaign-link" dir="ltr" placeholder={isTelegram ? 'https://t.me/yourchannel' : 'https://www.tiktok.com/@username'} className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] py-3 pl-4 pr-11 text-left text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" />
            </div>
          </label>
          <label className="mt-5 block text-xs font-bold text-slate-700">
            صورة الحملة <span className="text-[#1557ee]">*</span>
            <span className="mt-2 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-[#fbfcff] text-center transition hover:border-blue-300">
              {image ? <img src={image} alt="معاينة صورة الحملة" className="h-36 w-full object-cover" /> : <span className="px-4 py-7 text-xs font-semibold text-slate-400"><ImageIcon className="mx-auto mb-2 h-6 w-6 text-[#1557ee]" />اختر صورة تظهر للمستخدمين في بطاقة المهمة</span>}
              <input type="file" data-testid="input-platform-campaign-image" accept="image/*" onChange={handleImageChange} className="sr-only" />
            </span>
            {image && <button type="button" onClick={() => setImage('')} className="mt-2 text-[10px] font-bold text-[#1557ee]">إزالة الصورة</button>}
          </label>
          <div className="mt-7">
            <div className="flex items-center justify-between"><div><h3 className="text-xs font-bold text-slate-700">باقة {isTelegram ? 'المشتركين' : 'المتابعين'}</h3><p className="mt-1 text-[10px] text-slate-400">اختر الباقة المناسبة لحملتك.</p></div><PlatformIcon aria-hidden="true" className={`h-5 w-5 ${isTelegram ? 'text-[#229ED9]' : 'text-[#111111]'}`} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {packages.map((item) => <Button key={item.count} type="button" data-testid={`button-package-${platform}-${item.count}`} onClick={() => setSelectedCount(item.count)} variant="unstyled" size="fit" aria-pressed={selectedCount === item.count} className={`w-full rounded-xl border p-3 text-right transition ${selectedCount === item.count ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee]' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}><div className="text-sm font-bold">{item.count}</div><div className="mt-1 text-[10px] opacity-70">${item.price.toFixed(2)}</div></Button>)}
            </div>
          </div>

          {isTelegram ? (
            <div className={`mt-6 rounded-2xl border p-4 ${botCheckStatus === 'verified' ? 'border-emerald-200 bg-emerald-50' : botCheckStatus === 'error' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-[#f8faff]'}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${botCheckStatus === 'verified' ? 'bg-white text-[#159b89]' : botCheckStatus === 'error' ? 'bg-white text-amber-700' : 'bg-white text-[#229ED9]'}`}>
                  {botCheckStatus === 'checking' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : botCheckStatus === 'verified' ? <CheckCircle2 className="h-5 w-5" /> : botCheckStatus === 'error' ? <AlertCircle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-[#12234b]">تحقق تلقائي من البوت</h3>
                  <p role="status" className="mt-1 text-[10px] leading-5 text-slate-600">{botCheckMessage || 'أدخل رابط القناة؛ سيتحقق الخادم من أن البوت مضبوط ومشرف فيها.'}</p>
                </div>
                {botCheckStatus === 'error' && validLink && <Button type="button" data-testid="button-retry-telegram-bot-check" onClick={() => void verifyTelegramBot(link)} variant="secondary" size="sm" className="shrink-0 border-slate-200 bg-white text-[10px] font-bold">إعادة التحقق</Button>}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-blue-100 bg-[#f4f8ff] p-4 text-[10px] leading-5 text-slate-600">
              متابعون حقيقيون وتفاعل حقيقي؛ حساب فريد لكل مستخدم. تُراجع إثباتات المتابعة قبل احتساب المهمة، ويُمنع تكرار الحسابات أو التلاعب.
            </div>
          )}
          {isTelegram && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-500">
              مشتركون حقيقيون ومتفاعلون، بحساب فريد لكل مستخدم. يجب أن تستمر العضوية 3 أيام؛ من يغادر قبلها تُلغى مكافأته ويُزال من عدد الإنجازات، دون رد رصيد للمعلن.
            </div>
          )}
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#f4f8ff] p-4"><div><div className="text-[11px] text-slate-500">ميزانية الحملة</div><div className="mt-1 text-2xl font-bold text-[#12234b]">${selectedPackage.price.toFixed(2)}</div></div><div className="text-left text-[10px] leading-5 text-slate-400">{selectedPackage.count.toLocaleString('ar')} {isTelegram ? 'مشترك' : 'متابع'}</div></div>
          <Button type="button" data-testid={`button-submit-${platform}-campaign`} disabled={!canSubmit} onClick={submit} variant="primary" size="lg" className="mt-7 flex w-full items-center justify-center gap-2 text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"><Upload className="h-4 w-4" /> نشر الإعلان</Button>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#12234b]">المعاينة المباشرة</h2><p className="mt-1 text-xs text-slate-400">هكذا ستظهر الحملة في قائمة المهام.</p></div><span className="rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]">معاينة</span></div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="aspect-video">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="media-art grid h-full place-items-center text-white/80"><ImageIcon className="h-7 w-7" /></div>}</div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">{title || (isTelegram ? 'عنوان القناة' : 'عنوان الحملة')}</h3><span className="shrink-0 rounded-full bg-[#eaf8fd] px-2 py-1 text-[9px] font-bold text-[#168fb8]">{isTelegram ? 'Telegram' : 'TikTok'}</span></div>
              <p className="mt-2 truncate text-[10px] text-slate-400" dir="ltr">{link || (isTelegram ? 't.me/yourchannel' : 'tiktok.com/@username')}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px]"><span className="font-bold text-[#159b89]">{formatTaskReward(isTelegram ? rewards.telegramTaskReward : rewards.tiktokTaskReward)}</span><span className="text-slate-400">{selectedPackage.count.toLocaleString('ar')} {isTelegram ? 'مشترك' : 'متابع'}</span></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AddVideo({
  onBack,
  onSubmit,
  onPromotionSubmit,
  telegramUser,
}: {
  onBack: () => void;
  onSubmit: (
    video: Omit<Video, 'id' | 'views' | 'status' | 'created' | 'art' | 'reward'> & { requestedViews: number },
    requestId: string,
  ) => Promise<void>;
  onPromotionSubmit: (campaign: PromotionCampaign) => void;
  telegramUser: TelegramUser | null;
}) {
  const { dir, t } = useLanguage();
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | PromotionPlatform>('youtube');
  const videoTitleMaxLength = 12;
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [duration, setDuration] = useState(20);
  const [requestedViewsInput, setRequestedViewsInput] = useState('1000');
  const [youtubeSettings, setYoutubeSettings] = useState<YoutubeCampaignSettings>({
    defaultCPM: 1.5,
    viewerShare: 30,
    platformShare: 70,
    minimumViews: 1000,
    cpmOptions: { 10: 1.5, 20: 2, 40: 2.8, 80: 3.2 },
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const requestIdRef = useRef('');
  const viewsTouchedRef = useRef(false);
  const durationIndex = Math.max(0, durationOptions.findIndex((option) => option.seconds === duration));
  const serverDurationOptions = durationOptions.map((option) => ({
    ...option,
    cpm: String(youtubeSettings.cpmOptions[option.seconds] ?? Number(option.cpm)),
  }));
  const selected = serverDurationOptions.find((option) => option.seconds === duration) ?? serverDurationOptions[durationIndex];
  const embedUrl = getEmbedUrl(link);
  const publisherName = getUserDisplayName(telegramUser);
  const requestedViews = Number(requestedViewsInput);
  const validViews = Number.isSafeInteger(requestedViews) && requestedViews >= youtubeSettings.minimumViews;
  const campaignBudget = validViews ? (Number(selected.cpm) / 1000) * requestedViews : 0;
  const valid = title.trim().length > 2 && link.trim().length > 5 && validViews;

  useEffect(() => {
    let active = true;
    void apiGet<YoutubeCampaignSettings>('youtube/settings').then((settings) => {
      if (!active) return;
      setYoutubeSettings(settings);
      if (!viewsTouchedRef.current) setRequestedViewsInput(String(settings.minimumViews));
      const defaultOption = Object.entries(settings.cpmOptions).find(([, cpm]) => Number(cpm) === Number(settings.defaultCPM));
      if (defaultOption) setDuration(Number(defaultOption[0]));
    }).catch(() => {
      // The API uses these same defaults; retain the current preview during temporary network failures.
    });
    return () => { active = false; };
  }, []);

  const invalidateRequest = () => {
    requestIdRef.current = '';
    setSubmitError('');
  };

  const campaignRequestId = () => {
    if (!requestIdRef.current) {
      requestIdRef.current = window.crypto?.randomUUID?.() ?? createUniqueIdentifier('CAMPAIGN');
    }
    return requestIdRef.current;
  };

  if (selectedPlatform !== 'youtube') {
    return <AddPlatformCampaign platform={selectedPlatform} onSelectPlatform={setSelectedPlatform} onBack={onBack} onSubmit={onPromotionSubmit} />;
  }

  const submit = async () => {
    if (!valid) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        title: title.trim().slice(0, videoTitleMaxLength),
        link: link.trim(),
        duration: selected.seconds,
        creator: publisherName,
        cpm: Number(selected.cpm),
        requestedViews,
      }, campaignRequestId());
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'تعذر نشر الحملة. حاول مرة أخرى.');
      if (error instanceof ApiError) requestIdRef.current = '';
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[780px] items-center justify-center px-4 py-12" dir={dir}>
        <div className="animate-rise w-full rounded-[26px] border border-slate-200 bg-white p-7 text-center shadow-[var(--shadow-lift)] md:p-12">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#eafbf8] text-[#159b89]"><Check className="h-9 w-9" /></div>
          <div className="mt-6 text-xs font-bold text-[#159b89]">تم النشر بنجاح</div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">فيديوك جاهز للوصول إلى جمهور جديد</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">أصبح الفيديو نشطاً الآن. سيظهر للمشاهدين الذين يبحثون عن محتوى جديد مع مكافآت عادلة.</p>
          <div className={`mx-auto mt-7 flex max-w-sm items-center justify-between rounded-2xl bg-[#f5f8fe] p-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}><div><div className="text-xs font-bold text-[#12234b]">{title}</div><div className="mt-1 text-[10px] text-slate-400">{formatDuration(selected.seconds)} · CPM ${selected.cpm}</div></div><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#1557ee] text-white"><Film className="h-4 w-4" /></div></div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button type="button" data-testid="button-success-back" onClick={onBack} variant="primary" size="lg" className="text-sm font-bold">العودة إلى لوحة التحكم</Button><Button type="button" data-testid="button-success-another" onClick={() => { setSubmitted(false); setTitle(''); setLink(''); }} variant="secondary" size="lg" className="border-slate-200 text-sm font-bold text-slate-600">إضافة إعلان آخر</Button></div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <PlatformSelector selected={selectedPlatform} onSelect={setSelectedPlatform} />
      <div className="mb-7 flex items-center gap-3"><Button type="button" data-testid="button-back-add" onClick={onBack} variant="icon" size="icon" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-[#1557ee]" aria-label={t('العودة')}><ArrowDownLeft className="h-4 w-4" /></Button><div><div className="flex items-center gap-1.5 text-xs font-semibold text-[#1557ee]"><SiYoutube aria-hidden="true" className="h-3.5 w-3.5 text-[#FF0000]" />{t('نشر إعلان / إعلان جديد')}</div><h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">{t('انشر إعلانك')}</h1></div></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-7">
          <div className="mb-7"><h2 className="font-display text-lg font-bold text-[#12234b]">{t('تفاصيل الفيديو')}</h2><p className="mt-1 text-xs text-slate-400">{t('أخبر المشاهدين لماذا يستحق هذا الفيديو وقتهم.')}</p></div>
          <label className="block text-xs font-bold text-slate-700">{t('عنوان الفيديو')} <span className="text-[#1557ee]">*</span><input value={title} maxLength={videoTitleMaxLength} onChange={(event) => { setTitle(event.target.value.slice(0, videoTitleMaxLength)); invalidateRequest(); }} data-testid="input-video-title" placeholder={t('مثال: كيف تبدأ مشروعك من الصفر؟')} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /><span className="mt-1 block text-[10px] font-normal text-slate-400">{t('12 حرفًا كحد أقصى')}</span></label>
          <label className="mt-5 block text-xs font-bold text-slate-700">{t('رابط الفيديو')} <span className="text-[#1557ee]">*</span><div className="relative mt-2"><Link2 className="absolute right-4 top-3.5 h-4 w-4 text-slate-400" /><input value={link} onChange={(event) => { setLink(event.target.value); invalidateRequest(); }} data-testid="input-video-link" dir="ltr" placeholder="https://youtube.com/watch?v=..." className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] py-3 pl-4 pr-11 text-left text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /></div></label>
          <div className="mt-7">
            <div className="flex items-center justify-between"><div><h3 className="text-xs font-bold text-slate-700">المدة الإلزامية للمشاهدة</h3><p className="mt-1 text-[10px] text-slate-400">اختر الوقت الذي سيكمله المشاهد قبل احتساب المكافأة.</p></div><Clock3 className="h-5 w-5 text-[#1557ee]" /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {serverDurationOptions.map((option) => <Button type="button" key={option.seconds} data-testid={`button-duration-${option.seconds}`} onClick={() => { setDuration(option.seconds); invalidateRequest(); }} variant="unstyled" size="fit" className={`w-full rounded-xl border p-3 transition ${dir === 'rtl' ? 'text-right' : 'text-left'} ${selected.seconds === option.seconds ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee] shadow-[0_0_0_2px_rgba(21,87,238,.08)]' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}><div className="text-sm font-bold">{formatDuration(option.seconds)}</div><div className="mt-1 text-[10px] opacity-70">CPM ${option.cpm}</div></Button>)}
            </div>
          </div>
          <label className="mt-6 block text-xs font-bold text-slate-700">
            ما هو عدد المشاهدات الذي تريده؟
            <input
              type="number"
              min={youtubeSettings.minimumViews}
              max={100_000_000}
              step={1}
              value={requestedViewsInput}
              onChange={(event) => {
                viewsTouchedRef.current = true;
                setRequestedViewsInput(event.target.value);
                invalidateRequest();
              }}
              data-testid="input-requested-youtube-views"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 text-sm outline-none transition focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50"
            />
            <span className="mt-1 block text-[10px] font-normal text-slate-400">الحد الأدنى {youtubeSettings.minimumViews.toLocaleString('ar')} مشاهدة.</span>
          </label>
          <div className="mt-7 flex items-center justify-between rounded-2xl bg-[#f4f8ff] p-4">
            <div><div className="text-[11px] text-slate-500">تكلفة الألف مشاهدة (CPM)</div><div className="mt-1 text-2xl font-bold text-[#12234b]">${selected.cpm}</div></div>
            <div className="text-left"><div className="text-[11px] text-slate-500">إجمالي ميزانية الحملة</div><div data-testid="value-youtube-campaign-budget" className="mt-1 text-xl font-bold text-[#12234b]">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(campaignBudget)}</div></div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-500">
            مشاهدات حقيقية من مستخدمين فريدين، مستخدم واحد لكل جهاز. يُمنع تعدد الحسابات أو التلاعب، ويُحتسب التفاعل الحقيقي فقط.
          </div>
          {submitError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{submitError}</p>}
          <Button type="button" data-testid="button-submit-video" disabled={!valid || isSubmitting} onClick={() => { void submit(); }} variant="primary" size="lg" className="mt-7 flex w-full items-center justify-center gap-2 text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"><Upload className="h-4 w-4" /> {isSubmitting ? 'جارٍ النشر…' : 'نشر الإعلان'}</Button>
        </section>
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#12234b]">المعاينة المباشرة</h2><p className="mt-1 text-xs text-slate-400">هكذا سيظهر الفيديو للمشاهدين.</p></div><span className="flex items-center gap-1 rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]"><span className="h-1.5 w-1.5 rounded-full bg-current" /> مباشر</span></div>
          <div className="mt-5 overflow-hidden rounded-2xl bg-[#0e2452]">
            <div className="aspect-video">{embedUrl ? <iframe title="معاينة الفيديو" src={embedUrl} className="h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="media-art relative grid h-full place-items-center"><div className="text-center text-white/80"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-white/15"><Play className="h-5 w-5 fill-current" /></div><p className="mt-3 text-[11px]">ستظهر المعاينة هنا</p></div></div>}</div>
             <div className="border-t border-white/10 bg-[#0b1e47] p-4"><h3 className="truncate text-sm font-bold text-white">{title || 'عنوان الفيديو سيظهر هنا'}</h3><div className="mt-2 flex items-center justify-between text-[10px] text-blue-100/60"><span dir={telegramUser?.username ? 'ltr' : dir}>{publisherName}</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDuration(selected.seconds)}</span></div></div>
          </div>
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-[11px] leading-6 text-slate-400"><div className="mb-1 flex items-center gap-2 font-bold text-slate-600"><PlaySquare className="h-4 w-4 text-[#f04444]" /> روابط مدعومة</div>يمكنك استخدام روابط YouTube أو أي رابط فيديو مباشر قابل للتشغيل.</div>
        </section>
      </div>
    </main>
  );
}

