import { useMemo, useState, type ChangeEvent } from 'react';
import { ArrowDownLeft, Clock3, ExternalLink, ImageUp, Pause, Play, Save, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { useLocalPricing } from '@/legacy/pricing';
import {
  calculateViewerReward, durationOptions, formatDuration, formatUsd, getEmbedUrl,
  type PromotionCampaign, type Video,
} from '@/legacy/shared';

type CampaignDetailsPageProps = {
  video?: Video;
  campaign?: PromotionCampaign;
  onBack: () => void;
  onSaveVideo: (video: Video) => void;
  onSaveCampaign: (campaign: PromotionCampaign) => void;
  onDelete: () => void;
  onToggle: () => void;
};

export function CampaignDetailsPage({
  video, campaign, onBack, onSaveVideo, onSaveCampaign, onDelete, onToggle,
}: CampaignDetailsPageProps) {
  const { dir } = useLanguage();
  const pricing = useLocalPricing();
  const [title, setTitle] = useState(video?.title ?? campaign?.title ?? '');
  const [duration, setDuration] = useState(video?.duration ?? pricing.youtube[0].value);
  const [count, setCount] = useState(campaign?.targetCount ?? 100);
  const [image, setImage] = useState(campaign?.image ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const isYoutube = Boolean(video);
  const embedUrl = useMemo(() => getEmbedUrl(video?.link ?? ''), [video?.link]);
  const youtubeTiers = durationOptions.map((fallback, index) => ({
    value: pricing.youtube[index]?.value ?? fallback.seconds,
    price: pricing.youtube[index]?.price ?? Number(fallback.cpm),
  }));
  const selectedYoutubeTier = youtubeTiers.find((tier) => tier.value === duration) ?? youtubeTiers[0];
  const campaignPricing = campaign ? pricing[campaign.platform] : [];
  const selectedPackage = campaignPricing.find((tier) => tier.value === count) ?? campaignPricing[0];
  const formatCount = (n: number) => n.toLocaleString(dir === 'rtl' ? 'ar' : 'en-US');

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2_000_000) {
      window.alert('اختر صورة صالحة بحجم أقل من 2 ميغابايت.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result ?? ''));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const saveChanges = () => {
    if (video) {
      const cpm = selectedYoutubeTier.price;
      onSaveVideo({
        ...video,
        title: title.trim() || video.title,
        duration: selectedYoutubeTier.value,
        cpm,
        reward: formatUsd(calculateViewerReward(cpm)),
      });
    } else if (campaign && selectedPackage) {
      onSaveCampaign({
        ...campaign,
        title: title.trim() || campaign.title,
        image,
        targetCount: selectedPackage.value,
        price: selectedPackage.price,
      });
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  if (!video && !campaign) return null;
  const paused = (video?.status ?? campaign?.status) === 'موقوف';

  return (
    <main dir={dir} className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-6 md:px-8 md:pt-9 lg:px-10 lg:pb-12">
      <Button type="button" data-testid="button-campaign-details-back" onClick={onBack} variant="ghost" size="fit" className="mb-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-500">
        <ArrowDownLeft className="h-4 w-4" /> العودة إلى إعلاناتي
      </Button>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#1557ee]">{isYoutube ? 'YouTube' : campaign?.platform === 'telegram' ? 'Telegram' : 'TikTok'} / تفاصيل الإعلان</p>
          <h1 data-testid="text-campaign-detail-title" className="mt-1 font-display text-2xl font-extrabold text-[#12234b] md:text-3xl">{video?.title ?? campaign?.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-testid="button-campaign-pause-resume" onClick={onToggle} variant="secondary" size="sm" className="gap-2 border-slate-200 bg-white font-bold text-slate-700">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{paused ? 'استئناف' : 'إيقاف مؤقت'}
          </Button>
          <Button type="button" data-testid="button-campaign-delete" onClick={() => setConfirmDelete(true)} variant="secondary" size="sm" className="gap-2 border-rose-100 bg-rose-50 font-bold text-rose-700">
            <Trash2 className="h-4 w-4" /> حذف الإعلان
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
          <div className="aspect-video bg-[#0e2452]">
            {video ? (embedUrl ? <iframe title="معاينة فيديو الإعلان" data-testid="iframe-youtube-campaign-preview" src={embedUrl} className="h-full w-full border-0" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /> : <div className="grid h-full place-items-center text-sm text-blue-100">لا تتوفر معاينة لهذا الفيديو</div>)
              : image ? <img src={image} alt={campaign?.title ?? ''} className="h-full w-full object-cover" /> : <div className="media-art grid h-full place-items-center text-sm text-white/80">لا توجد صورة للحملة</div>}
          </div>
          <div className="space-y-4 p-5 md:p-6">
            <label className="grid gap-2 text-xs font-bold text-slate-600">عنوان الإعلان
            <input data-testid="input-campaign-detail-title" value={title} maxLength={video ? 100 : 60} onChange={(event) => setTitle(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-[#fbfcff] px-3 text-sm text-slate-800 outline-none focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" />
            </label>
            {video ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#f5f8fe] p-3"><div className="text-[11px] text-slate-500">المدة المطلوبة</div><div data-testid="value-video-duration" className="mt-1 font-bold text-[#12234b]">{formatDuration(video.duration)}</div></div>
                <div className="rounded-xl bg-[#f5f8fe] p-3"><div className="text-[11px] text-slate-500">عدد المشاهدات</div><div data-testid="value-video-views" className="mt-1 font-bold text-[#12234b]">{video.views}</div></div>
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-2 text-xs font-bold text-slate-600">صورة الحملة</div>
                  <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-[#fbfcff] px-4 py-3 text-xs font-bold text-[#1557ee] hover:border-blue-400">
                    <ImageUp className="h-4 w-4" /> تغيير الصورة
                    <input type="file" accept="image/*" data-testid="input-campaign-detail-image" onChange={uploadImage} className="sr-only" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f5f8fe] p-3"><div className="text-[11px] text-slate-500">الهدف</div><div data-testid="value-campaign-target" className="mt-1 font-bold text-[#12234b]">{formatCount(campaign?.targetCount ?? 0)} {campaign?.platform === 'telegram' ? 'مشترك' : 'متابع'}</div></div>
                  <div className="rounded-xl bg-[#f5f8fe] p-3"><div className="text-[11px] text-slate-500">الميزانية</div><div data-testid="value-campaign-price" className="mt-1 font-bold text-[#12234b]">${(campaign?.price ?? 0).toFixed(2)}</div></div>
                </div>
              </>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              {video?.link ? <a data-testid="link-youtube-campaign" href={video.link} target="_blank" rel="noreferrer" dir="ltr" className="inline-flex items-center gap-2 text-xs font-bold text-[#1557ee]"><ExternalLink className="h-4 w-4" /> فتح رابط YouTube</a> : <span />}
              <span data-testid="status-campaign-detail" className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${paused ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{paused ? 'موقوف' : video?.status ?? campaign?.status}</span>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          {video ? (
            <>
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><Clock3 className="h-5 w-5" /></span><div><h2 className="font-bold text-[#12234b]">خيارات المشاهدة</h2><p className="mt-1 text-xs text-slate-400">اختر مدة التسليم وسيتحدّث CPM مباشرة.</p></div></div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {youtubeTiers.map((tier) => <Button type="button" key={tier.value} data-testid={`button-detail-duration-${tier.value}`} aria-pressed={duration === tier.value} onClick={() => setDuration(tier.value)} variant="unstyled" size="fit" className={`rounded-xl border p-3 text-right ${duration === tier.value ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee]' : 'border-slate-200 text-slate-600'}`}><span className="block text-sm font-bold">{formatDuration(tier.value)}</span><span className="mt-1 block text-[10px]">CPM ${tier.price.toFixed(2)}</span></Button>)}
              </div>
              <div className="mt-5 rounded-2xl bg-[#0e2452] p-5 text-white"><div className="text-xs text-blue-100/75">تكلفة الألف مشاهدة (CPM)</div><div data-testid="value-campaign-cpm" className="mt-1 text-3xl font-extrabold">${selectedYoutubeTier.price.toFixed(2)}</div></div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><Users className="h-5 w-5" /></span><div><h2 className="font-bold text-[#12234b]">باقة الجمهور المستهدف</h2><p className="mt-1 text-xs text-slate-400">اختر إحدى باقات {campaign?.platform === 'telegram' ? 'المشتركين' : 'المتابعين'} المتاحة.</p></div></div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {campaignPricing.map((tier) => <Button type="button" key={tier.value} data-testid={`button-detail-package-${campaign?.platform}-${tier.value}`} aria-pressed={count === tier.value} onClick={() => setCount(tier.value)} variant="unstyled" size="fit" className={`rounded-xl border p-3 text-right ${count === tier.value ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee]' : 'border-slate-200 text-slate-600'}`}><span className="block text-sm font-bold">{formatCount(tier.value)}</span><span className="mt-1 block text-[10px]">${tier.price.toFixed(2)}</span></Button>)}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#f5f8fe] p-3"><div className="text-[11px] text-slate-500">انضموا</div><div data-testid="value-campaign-joined" className="mt-1 text-xl font-extrabold text-[#12234b]">{formatCount(campaign?.joinedCount ?? 0)}</div></div>
                <div className="rounded-xl bg-[#f5f8fe] p-3"><div className="text-[11px] text-slate-500">اكتملوا</div><div data-testid="value-campaign-completed" className="mt-1 text-xl font-extrabold text-[#12234b]">{formatCount(campaign?.completedCount ?? 0)}</div></div>
              </div>
              <div className="mt-5 rounded-2xl bg-[#0e2452] p-5 text-white"><div className="text-xs text-blue-100/75">ميزانية الحملة</div><div data-testid="value-campaign-detail-budget" className="mt-1 text-3xl font-extrabold">${(selectedPackage?.price ?? campaign?.price ?? 0).toFixed(2)}</div></div>
            </>
          )}
          <Button type="button" data-testid="button-save-campaign-details" onClick={saveChanges} variant="primary" size="lg" className="mt-6 flex w-full items-center justify-center gap-2 font-bold"><Save className="h-4 w-4" />{saved ? 'تم الحفظ' : 'حفظ التغييرات'}</Button>
        </section>
      </div>

      {confirmDelete && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#061333]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h2 className="font-extrabold text-[#12234b]">حذف الإعلان؟</h2><p className="mt-2 text-sm leading-6 text-slate-500">سيُحذف الإعلان من قائمتك ولا يمكن التراجع عن ذلك.</p><div className="mt-5 grid grid-cols-2 gap-2"><Button type="button" data-testid="button-cancel-campaign-delete" onClick={() => setConfirmDelete(false)} variant="secondary" size="lg" className="border-slate-200 font-bold">إلغاء</Button><Button type="button" data-testid="button-confirm-campaign-delete" onClick={onDelete} variant="primary" size="lg" className="bg-rose-600 font-bold hover:bg-rose-700">حذف الإعلان</Button></div></section></div>}
    </main>
  );
}