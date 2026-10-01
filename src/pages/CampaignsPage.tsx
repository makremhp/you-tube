import { useState } from 'react';
import {
  ArrowDownLeft, BarChart3, CheckCircle2, Clock3, DollarSign, Eye, FileText,
  Film, MoreHorizontal, Plus, TrendingUp, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { SiTelegram, SiTiktok, SiYoutube } from 'react-icons/si';
import {
  formatDuration, getGreetingName, StatCard, VideoArtwork,
  type PromotionCampaign, type TelegramUser, type Video,
} from '@/legacy/shared';

function parseViews(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CampaignsPage({
  videos,
  platformCampaigns,
  telegramUser,
  tab,
  onTab,
  onAdd,
  onWatch,
}: {
  videos: Video[];
  platformCampaigns: PromotionCampaign[];
  telegramUser: TelegramUser | null;
  tab: 'all' | 'active' | 'drafts';
  onTab: (tab: 'all' | 'active' | 'drafts') => void;
  onAdd: () => void;
  onWatch: (video: Video) => void;
}) {
  const [campaignView, setCampaignView] = useState<'youtube' | 'telegram' | 'tiktok'>('youtube');
  const { dir, isArabic } = useLanguage();
  const scopedVideos = campaignView === 'youtube' ? videos : [];
  const scopedCampaigns = platformCampaigns.filter((campaign) => campaign.platform === campaignView);
  const visibleVideos = scopedVideos.filter((video) => tab === 'all' || (tab === 'active' ? video.status === 'نشط' : video.status === 'مسودة'));
  const visiblePlatformCampaigns = scopedCampaigns.filter((campaign) => tab === 'all' || (tab === 'active' ? campaign.status === 'نشط' : campaign.status !== 'نشط'));
  const platformLabel = campaignView === 'youtube' ? 'YouTube' : campaignView === 'telegram' ? 'Telegram' : 'TikTok';
  const listTitle = `إعلانات ${platformLabel}`;
  const scopedTotal = scopedVideos.length + scopedCampaigns.length;
  const scopedActiveCount = scopedVideos.filter((video) => video.status === 'نشط').length
    + scopedCampaigns.filter((campaign) => campaign.status === 'نشط').length;
  const visibleVideoViews = visibleVideos.reduce((total, video) => total + parseViews(video.views), 0);
  const youtubeSpend = visibleVideos.reduce((total, video) => total + parseViews(video.views) * video.cpm / 1000, 0);
  const campaignBudget = visiblePlatformCampaigns.reduce((total, campaign) => total + campaign.price, 0);
  const campaignAudience = visiblePlatformCampaigns.reduce((total, campaign) => total + campaign.targetCount, 0);
  const totalSpend = campaignView === 'youtube' ? youtubeSpend : campaignBudget;
  const averageCpm = visibleVideos.length
    ? visibleVideos.reduce((total, video) => total + video.cpm, 0) / visibleVideos.length
    : 0;
  const spendBars = campaignView === 'youtube'
    ? visibleVideos.map((video) => parseViews(video.views) * video.cpm / 1000)
    : visiblePlatformCampaigns.map((campaign) => campaign.price);
  const positiveSpendBars = spendBars.filter((spend) => spend > 0);
  const maxSpendBar = Math.max(...positiveSpendBars, 0);
  const activeRate = scopedTotal ? Math.round(scopedActiveCount / scopedTotal * 100) : 0;
  const formatCount = (value: number) => value.toLocaleString(isArabic ? 'ar' : 'en-US');
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const statCards = campaignView === 'youtube'
    ? [
        { icon: Eye, label: 'إجمالي المشاهدات', value: formatCount(visibleVideoViews), tone: 'blue' as const },
        { icon: DollarSign, label: 'الإنفاق المحسوب حسب CPM', value: formatCurrency(youtubeSpend), tone: 'cyan' as const },
        { icon: Film, label: 'عدد الفيديوهات', value: formatCount(visibleVideos.length), tone: 'navy' as const },
        { icon: TrendingUp, label: 'متوسط CPM', value: formatCurrency(averageCpm), tone: 'sand' as const },
      ]
    : [
        { icon: FileText, label: 'عدد الحملات', value: formatCount(visiblePlatformCampaigns.length), tone: 'blue' as const },
        { icon: DollarSign, label: 'إجمالي الميزانية', value: formatCurrency(campaignBudget), tone: 'cyan' as const },
        { icon: Users, label: campaignView === 'telegram' ? 'المشتركون المستهدفون' : 'المتابعون المستهدفون', value: formatCount(campaignAudience), tone: 'navy' as const },
        { icon: CheckCircle2, label: 'الحملات النشطة', value: formatCount(visiblePlatformCampaigns.filter((campaign) => campaign.status === 'نشط').length), tone: 'sand' as const },
      ];
  return (
    <main className="mx-auto w-full max-w-[1370px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <section className="animate-rise flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#1557ee]"><span className="h-1.5 w-1.5 rounded-full bg-[#23bdc9]" /> الثلاثاء، ٢٤ ديسمبر ٢٠٢٤</div>
          <h1 data-testid="text-greeting-campaigns" className="creator-greeting flex items-baseline gap-2 whitespace-nowrap font-display text-[25px] font-bold leading-tight tracking-[-.04em] text-[#12234b] sm:text-[29px] md:text-[36px]">
            <span>صباح الخير{' '}</span>
            <span className="text-[#1557ee]">{getGreetingName(telegramUser)}..</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">هذه لمحة سريعة عن أثر إعلاناتك اليوم.</p>
        </div>
        <Button type="button" data-testid="button-add-video-main" onClick={onAdd} variant="primary" size="lg" className="flex items-center justify-center gap-2 text-sm font-bold">
          <Plus className="h-4 w-4" /> أضف إعلان جديد
        </Button>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="تصفية الإعلانات حسب المنصة">
        {([
          { value: 'youtube', label: 'YouTube', Icon: SiYoutube },
          { value: 'telegram', label: 'Telegram', Icon: SiTelegram },
          { value: 'tiktok', label: 'TikTok', Icon: SiTiktok },
        ] as const).map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            data-testid={`button-campaign-platform-${value}`}
            aria-pressed={campaignView === value}
            onClick={() => { setCampaignView(value); onTab('all'); }}
            variant="unstyled"
            size="fit"
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-bold transition sm:min-h-14 sm:text-sm ${
              campaignView === value
                ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee] shadow-sm'
                : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-[#1557ee]'
            }`}
          >
            <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${value === 'youtube' ? 'text-[#FF0000]' : value === 'telegram' ? 'text-[#229ED9]' : 'text-[#111111]'}`} />
            <span>{label}</span>
          </Button>
        ))}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {statCards.map((stat, index) => (
          <div key={stat.label} className={`animate-rise ${index ? `delay-${index}` : ''}`}>
            <StatCard icon={stat.icon} label={stat.label} value={stat.value} tone={stat.tone} />
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_.85fr]">
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div>
              <h2 className="font-display text-lg font-bold text-[#12234b]">{listTitle}</h2>
              <p className="mt-1 text-xs text-slate-400">راقب أداء المحتوى المنشور مؤخراً</p>
            </div>
            <div className="flex rounded-lg bg-slate-50 p-1 text-xs font-semibold">
              {([['all', 'الكل'], ['active', 'نشطة'], ['drafts', 'مسودات']] as const).map(([value, label]) => (
                <Button type="button" key={value} data-testid={`button-tab-${value}`} onClick={() => onTab(value)} variant="unstyled" size="fit" className={`rounded-md px-3 py-2 transition ${tab === value ? 'bg-white text-[#1557ee] shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>{label}</Button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleVideos.length === 0 && visiblePlatformCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><FileText className="h-6 w-6" /></div>
                <h3 className="mt-4 text-sm font-bold text-slate-800">لا توجد إعلانات هنا بعد</h3>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">ابدأ بإضافة إعلان جديد وامنح المشاهدين تجربة تستحق وقتهم.</p>
                <Button type="button" data-testid="button-empty-add" onClick={onAdd} variant="ghost" size="fit" className="mt-4 text-xs font-bold text-[#1557ee]">إضافة أول إعلان</Button>
              </div>
            ) : visibleVideos.map((video) => (
              <div key={video.id} data-testid={`row-video-${video.id}`} className="group flex items-center gap-3 p-4 transition hover:bg-[#fbfcff] md:gap-4 md:p-5">
                <div className="relative w-[105px] shrink-0 overflow-hidden rounded-xl md:w-[132px]"><VideoArtwork video={video} compact /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${video.status === 'نشط' ? 'bg-[#19b39f]' : 'bg-[#f4ad45]'}`} />
                    <span className={`text-[10px] font-bold ${video.status === 'نشط' ? 'text-[#159b89]' : 'text-[#cc841c]'}`}>{video.status}</span>
                    <span className="text-[10px] text-slate-300">· {video.created}</span>
                  </div>
                  <h3 className="mt-1 truncate text-sm font-bold text-slate-800">{video.title}</h3>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.views}</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDuration(video.duration)}</span>
                  </div>
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-bold text-[#12234b]">{video.reward}</div>
                  <div className="mt-1 text-[10px] text-slate-400">لكل إكمال</div>
                </div>
                <Button type="button" data-testid={`button-video-menu-${video.id}`} onClick={() => onWatch(video)} variant="ghost" size="icon" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 opacity-60 transition hover:bg-[#edf3ff] hover:text-[#1557ee] group-hover:opacity-100" aria-label="خيارات الإعلان"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            )).concat(visiblePlatformCampaigns.map((campaign) => (
              <div key={campaign.id} data-testid={`row-campaign-${campaign.id}`} className="group flex items-center gap-3 p-4 transition hover:bg-[#fbfcff] md:gap-4 md:p-5">
                <div className="relative h-[60px] w-[105px] shrink-0 overflow-hidden rounded-xl bg-[#eaf2fc] md:h-[74px] md:w-[132px]">
                  {campaign.image ? <img src={campaign.image} alt={campaign.title} className="h-full w-full object-cover" /> : <div className="media-art grid h-full place-items-center text-white/80">{campaign.platform === 'telegram' ? <SiTelegram aria-hidden="true" className="h-5 w-5" /> : <SiTiktok aria-hidden="true" className="h-5 w-5" />}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${campaign.status === 'نشط' ? 'bg-[#19b39f]' : 'bg-[#f4ad45]'}`} />
                    <span className={`text-[10px] font-bold ${campaign.status === 'نشط' ? 'text-[#159b89]' : 'text-[#cc841c]'}`}>{campaign.status}</span>
                    <span className="text-[10px] text-slate-300">· {campaign.created}</span>
                  </div>
                  <h3 className="mt-1 truncate text-sm font-bold text-slate-800">{campaign.title}</h3>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                    <span>{campaign.platform === 'telegram' ? 'Telegram' : 'TikTok'}</span>
                    <span>{campaign.targetCount.toLocaleString(isArabic ? 'ar' : 'en-US')} {campaign.platform === 'telegram' ? 'مشترك' : 'متابع'}</span>
                  </div>
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-bold text-[#12234b]">${campaign.price.toFixed(2)}</div>
                  <div className="mt-1 text-[10px] text-slate-400">ميزانية الحملة</div>
                </div>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${campaign.platform === 'telegram' ? 'bg-[#eaf8fd] text-[#229ED9]' : 'bg-slate-100 text-[#111111]'}`}>
                  {campaign.platform === 'telegram' ? <SiTelegram aria-hidden="true" className="h-4 w-4" /> : <SiTiktok aria-hidden="true" className="h-4 w-4" />}
                </span>
              </div>
            )))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <span className="text-[11px] text-slate-400">{`عرض ${visibleVideos.length + visiblePlatformCampaigns.length} من ${scopedTotal} إعلاناً`}</span>
            <Button type="button" data-testid="button-view-all-videos" onClick={() => onTab('all')} variant="ghost" size="fit" className="flex items-center gap-1 text-xs font-bold text-[#1557ee]">عرض الكل <ArrowDownLeft className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-7">
          <div className="absolute -left-14 -top-14 h-40 w-40 rounded-full border border-cyan-300/15" />
          <div className="absolute -left-2 top-2 h-16 w-16 rounded-full border border-cyan-300/15" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-100">إنفاق إعلانات {platformLabel}</span>
                <p className="mt-1 text-[10px] text-blue-100/60">{campaignView === 'youtube' ? 'محسوب من المشاهدات وCPM' : 'ميزانيات حملات هذه المنصة فقط'}</p>
              </div>
            </div>
            <div className="mt-7 flex items-end justify-between">
              <div>
                <div className="text-[31px] font-bold tracking-tight">{formatCurrency(totalSpend)}</div>
                <div className="mt-1 text-[11px] text-cyan-300">{campaignView === 'youtube' ? 'تقدير التكلفة وفق CPM لكل فيديو' : 'مجموع ميزانيات الحملات المعروضة'}</div>
              </div>
              <DollarSign className="mb-2 h-7 w-7 text-cyan-300/70" />
            </div>
            {positiveSpendBars.length ? (
              <div role="img" aria-label={`توزيع الإنفاق على ${positiveSpendBars.length} إعلانات ${platformLabel}`} className="mt-8 flex h-[100px] items-end gap-2 border-b border-white/10 pb-0">
                {positiveSpendBars.slice(0, 12).map((spend, index) => {
                  const height = maxSpendBar ? Math.max(6, spend / maxSpendBar * 100) : 6;
                  return (
                    <div key={`${campaignView}-spend-${index}`} className="group flex h-full flex-1 items-end">
                      <div className="w-full rounded-t-sm bg-blue-300/50 transition-all group-hover:bg-cyan-200" style={{ height: `${height}%` }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-8 grid h-[100px] place-items-center rounded-xl border border-white/10 text-xs text-blue-100/60">لا توجد بيانات إنفاق لهذه المنصة بعد.</div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-center justify-between">
          <div><h2 className="font-display text-lg font-bold text-[#12234b]">حالة إعلانات {platformLabel}</h2><p className="mt-1 text-xs text-slate-400">الأرقام التالية تخص هذه المنصة فقط.</p></div>
          <BarChart3 className="h-5 w-5 text-[#1557ee]" />
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-semibold text-slate-600">{formatCount(scopedActiveCount)} نشط من {formatCount(scopedTotal)} إعلان</span>
            <span className="font-bold text-[#1557ee]">{activeRate}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#f1f4f9]" role="progressbar" aria-label={`نسبة إعلانات ${platformLabel} النشطة`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={activeRate}>
            <div className="h-full rounded-full bg-gradient-to-l from-[#1557ee] to-[#23bdc9] transition-all" style={{ width: `${activeRate}%` }} />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">{scopedTotal ? `${formatCount(scopedTotal - scopedActiveCount)} إعلان غير نشط على ${platformLabel}.` : `لا توجد إعلانات على ${platformLabel} بعد.`}</p>
        </div>
      </section>
    </main>
  );
}

