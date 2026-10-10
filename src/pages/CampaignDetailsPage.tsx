import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownLeft, CheckCircle2, Clock3, DollarSign, ExternalLink, Eye, Link2, Pause, Play, Save, Target, Trash2, Users } from 'lucide-react';
import { SiTelegram, SiTiktok, SiYoutube } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { formatDuration, formatUsd, getEmbedUrl, type PromotionCampaign, type Video } from '@/legacy/shared';

type CampaignDetailsPageProps = {
  video?: Video;
  campaign?: PromotionCampaign;
  onBack: () => void;
  onSaveVideo: (video: Video) => void;
  onSaveCampaign: (campaign: PromotionCampaign) => void;
  onDelete: () => void;
  onToggle: () => void;
};

function parseViews(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function InfoCell({ label, value, testId, ltr }: { label: string; value: ReactNode; testId?: string; ltr?: boolean }) {
  return (
    <div className="rounded-xl bg-[#f5f8fe] p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div data-testid={testId} dir={ltr ? 'ltr' : undefined} className={`mt-1 break-words font-bold text-[#12234b] ${ltr ? 'text-left' : ''}`}>{value}</div>
    </div>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{label}</span><span className="text-[#1557ee]">{value}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f1f4f9]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="h-full rounded-full bg-gradient-to-l from-[#1557ee] to-[#23bdc9]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function CampaignDetailsPage({
  video, campaign, onBack, onSaveVideo, onSaveCampaign, onDelete, onToggle,
}: CampaignDetailsPageProps) {
  const { dir } = useLanguage();
  const [title, setTitle] = useState(video?.title ?? campaign?.title ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const embedUrl = useMemo(() => getEmbedUrl(video?.link ?? ''), [video?.link]);
  const formatCount = (n: number) => n.toLocaleString(dir === 'rtl' ? 'ar' : 'en-US');

  if (!video && !campaign) return null;

  const platform: 'youtube' | 'telegram' | 'tiktok' = video ? 'youtube' : campaign?.platform === 'telegram' ? 'telegram' : 'tiktok';
  const platformLabel = platform === 'youtube' ? 'YouTube' : platform === 'telegram' ? 'Telegram' : 'TikTok';
  const PlatformIcon = platform === 'youtube' ? SiYoutube : platform === 'telegram' ? SiTelegram : SiTiktok;
  const platformColor = platform === 'youtube' ? 'text-[#FF0000]' : platform === 'telegram' ? 'text-[#229ED9]' : 'text-[#111111]';
  const status = video?.status ?? campaign?.status ?? '';
  const paused = status === 'موقوف';
  const link = video?.link ?? campaign?.link ?? '';
  const audienceWord = platform === 'telegram' ? 'مشترك' : 'متابع';

  // أرقام YouTube كما أدخلها المعلن وقت الإنشاء
  const deliveredViews = video ? parseViews(video.views) : 0;
  const requestedViews = video?.requestedViews ?? 0;
  const spent = video ? deliveredViews * video.cpm / 1000 : 0;
  // أرقام Telegram / TikTok
  const target = campaign?.targetCount ?? 0;
  const joined = campaign?.joinedCount ?? 0;
  const completedCount = campaign?.completedCount ?? 0;

  const saveChanges = () => {
    if (video) onSaveVideo({ ...video, title: title.trim() || video.title });
    else if (campaign) onSaveCampaign({ ...campaign, title: title.trim() || campaign.title });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const linkLabel = platform === 'youtube' ? 'رابط الفيديو' : platform === 'telegram' ? 'رابط القناة' : 'رابط حساب TikTok';
  const openLabel = platform === 'youtube' ? 'فتح رابط YouTube' : platform === 'telegram' ? 'فتح قناة Telegram' : 'فتح حساب TikTok';

  return (
    <main dir={dir} className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-6 md:px-8 md:pt-9 lg:px-10 lg:pb-12">
      <Button type="button" data-testid="button-campaign-details-back" onClick={onBack} variant="ghost" size="fit" className="mb-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-500">
        <ArrowDownLeft className="h-4 w-4" /> العودة إلى إعلاناتي
      </Button>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold text-[#1557ee]"><PlatformIcon aria-hidden="true" className={`h-3.5 w-3.5 ${platformColor}`} />{platformLabel} / تفاصيل الإعلان</p>
          <h1 data-testid="text-campaign-detail-title" className="mt-1 break-words font-display text-2xl font-extrabold text-[#12234b] md:text-3xl">{video?.title ?? campaign?.title}</h1>
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
            {platform === 'youtube'
              ? (embedUrl ? <iframe title="معاينة فيديو الإعلان" data-testid="iframe-youtube-campaign-preview" src={embedUrl} className="h-full w-full border-0" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /> : <div className="grid h-full place-items-center text-sm text-blue-100">لا تتوفر معاينة لهذا الفيديو</div>)
              : campaign?.image ? <img src={campaign.image} alt={campaign.title} className="h-full w-full object-cover" /> : <div className="media-art grid h-full place-items-center text-sm text-white/80">لا توجد صورة للحملة</div>}
          </div>
          <div className="space-y-4 p-5 md:p-6">
            <label className="grid gap-2 text-xs font-bold text-slate-600">عنوان الإعلان
              <input data-testid="input-campaign-detail-title" value={title} maxLength={platform === 'youtube' ? 100 : 60} onChange={(event) => setTitle(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-[#fbfcff] px-3 text-sm text-slate-800 outline-none focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" />
            </label>

            {platform === 'youtube' && video && (
              <div className="grid grid-cols-2 gap-3">
                <InfoCell label="المدة المطلوبة" value={formatDuration(video.duration)} testId="value-video-duration" />
                <InfoCell label="المشاهدات المطلوبة" value={requestedViews ? formatCount(requestedViews) : '—'} testId="value-video-requested-views" />
                <InfoCell label="المشاهدات المنفذة" value={video.views} testId="value-video-views" />
                <InfoCell label="تاريخ الإنشاء" value={video.created || '—'} />
              </div>
            )}

            {platform !== 'youtube' && campaign && (
              <div className="grid grid-cols-2 gap-3">
                <InfoCell label={platform === 'telegram' ? 'المشتركون المستهدفون' : 'المتابعون المستهدفون'} value={`${formatCount(target)} ${audienceWord}`} testId="value-campaign-target" />
                <InfoCell label="الميزانية" value={`$${campaign.price.toFixed(2)}`} testId="value-campaign-price" />
                <InfoCell label="تاريخ الإنشاء" value={campaign.created || '—'} />
                <InfoCell label="المنصة" value={platformLabel} />
              </div>
            )}

            {link ? <InfoCell label={linkLabel} value={link} ltr testId="value-campaign-link" /> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              {link ? <a data-testid="link-campaign-open" href={link} target="_blank" rel="noreferrer" dir="ltr" className="inline-flex items-center gap-2 text-xs font-bold text-[#1557ee]"><ExternalLink className="h-4 w-4" /> {openLabel}</a> : <span />}
              <span data-testid="status-campaign-detail" className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${paused || status === 'بانتظار تحقق البوت' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{status}</span>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          {platform === 'youtube' && video && (
            <>
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><Clock3 className="h-5 w-5" /></span><div><h2 className="font-bold text-[#12234b]">إعدادات المشاهدة</h2><p className="mt-1 text-xs text-slate-400">الإعدادات التي اخترتها عند إنشاء الإعلان.</p></div></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <InfoCell label="المدة" value={formatDuration(video.duration)} />
                <InfoCell label="CPM" value={`$${video.cpm.toFixed(2)}`} testId="value-campaign-cpm" />
                <InfoCell label="مكافأة المشاهد" value={video.reward} />
                <InfoCell label="الميزانية" value={video.budget ? formatUsd(video.budget) : '—'} testId="value-campaign-detail-budget" />
              </div>
              <div className="mt-5">
                <ProgressBar percent={requestedViews ? deliveredViews / requestedViews * 100 : 0} label={`${formatCount(deliveredViews)} / ${formatCount(requestedViews)} مشاهدة`} />
              </div>
              <div className="mt-5 rounded-2xl bg-[#0e2452] p-5 text-white">
                <div className="flex items-center justify-between"><div className="text-xs text-blue-100/75">المصروف حتى الآن</div><Eye className="h-5 w-5 text-cyan-300/70" /></div>
                <div data-testid="value-campaign-spent" className="mt-1 text-3xl font-extrabold">${spent.toFixed(2)}</div>
              </div>
            </>
          )}

          {platform !== 'youtube' && campaign && (
            <>
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><Users className="h-5 w-5" /></span><div><h2 className="font-bold text-[#12234b]">{platform === 'telegram' ? 'أداء حملة القناة' : 'أداء حملة المتابعين'}</h2><p className="mt-1 text-xs text-slate-400">الباقة التي اخترتها عند إنشاء الإعلان.</p></div></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <InfoCell label={platform === 'telegram' ? 'انضموا' : 'أرسلوا إثباتًا'} value={formatCount(joined)} testId="value-campaign-joined" />
                <InfoCell label={platform === 'telegram' ? 'اكتملوا' : 'اعتُمدوا'} value={formatCount(completedCount)} testId="value-campaign-completed" />
              </div>
              <div className="mt-5">
                <ProgressBar percent={target ? completedCount / target * 100 : 0} label={`${formatCount(completedCount)} / ${formatCount(target)} ${audienceWord}`} />
              </div>
              {platform === 'telegram' && status === 'بانتظار تحقق البوت' && (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">لن يظهر الإعلان للمستخدمين حتى يُضاف البوت مشرفًا على القناة ويتم التحقق منه.</p>
              )}
              <div className="mt-5 rounded-2xl bg-[#0e2452] p-5 text-white">
                <div className="flex items-center justify-between"><div className="text-xs text-blue-100/75">ميزانية الحملة</div><DollarSign className="h-5 w-5 text-cyan-300/70" /></div>
                <div data-testid="value-campaign-detail-budget" className="mt-1 text-3xl font-extrabold">${campaign.price.toFixed(2)}</div>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-blue-100/70"><span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {formatCount(target)} {audienceWord}</span><span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {formatCount(completedCount)}</span><span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> {platformLabel}</span></div>
              </div>
            </>
          )}
          <Button type="button" data-testid="button-save-campaign-details" onClick={saveChanges} variant="primary" size="lg" className="mt-6 flex w-full items-center justify-center gap-2 font-bold"><Save className="h-4 w-4" />{saved ? 'تم الحفظ' : 'حفظ التغييرات'}</Button>
        </section>
      </div>

      {confirmDelete && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#061333]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h2 className="font-extrabold text-[#12234b]">حذف الإعلان؟</h2><p className="mt-2 text-sm leading-6 text-slate-500">سيُحذف الإعلان من قائمتك ولا يمكن التراجع عن ذلك.</p><div className="mt-5 grid grid-cols-2 gap-2"><Button type="button" data-testid="button-cancel-campaign-delete" onClick={() => setConfirmDelete(false)} variant="secondary" size="lg" className="border-slate-200 font-bold">إلغاء</Button><Button type="button" data-testid="button-confirm-campaign-delete" onClick={onDelete} variant="primary" size="lg" className="bg-rose-600 font-bold hover:bg-rose-700">حذف الإعلان</Button></div></section></div>}
    </main>
  );
}
