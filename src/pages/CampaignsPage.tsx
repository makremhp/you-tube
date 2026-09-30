import { useState } from 'react';
import {
  ArrowDownLeft, ArrowUpLeft, BarChart3, ChevronLeft, Clock3, DollarSign, Eye,
  FileText, MoreHorizontal, Plus, Target, TrendingUp, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import {
  formatDuration, getGreetingName, StatCard, VideoArtwork, WalletArtwork,
  type PromotionCampaign, type TelegramUser, type Video,
} from '@/legacy/shared';

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
  const [spendPeriod, setSpendPeriod] = useState<'آخر ٧ أيام' | 'آخر ٣٠ يومًا'>('آخر ٧ أيام');
  const { dir } = useLanguage();
  const visibleVideos = videos.filter((video) => tab === 'all' || (tab === 'active' ? video.status === 'نشط' : video.status === 'مسودة'));
  const visiblePlatformCampaigns = platformCampaigns.filter((campaign) => tab === 'all' || (tab === 'active' ? campaign.status === 'نشط' : campaign.status !== 'نشط'));
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

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="animate-rise"><StatCard icon={Eye} label="إجمالي المشاهدات" value="27,584" change="12.8%" tone="blue" /></div>
        <div className="animate-rise delay-1"><StatCard icon={DollarSign} label="إجمالي الإنفاق الإعلاني" value="$124.80" change="8.4%" tone="cyan" /></div>
        <div className="animate-rise delay-2"><StatCard icon={Users} label="مشاهدون جدد" value="1,892" change="18.2%" tone="navy" /></div>
        <div className="animate-rise delay-3"><StatCard icon={TrendingUp} label="متوسط الإكمال" value="76.4%" change="4.6%" tone="sand" /></div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-[20px] border border-blue-100 bg-[#eff4ff] p-5">
          <div>
            <div className="text-xs font-semibold text-slate-500">رصيد المعلن</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-[#12234b]">$250.00</div>
            <div className="mt-1 text-[10px] text-slate-400">متاح لتمويل الحملات</div>
          </div>
           <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white"><WalletArtwork method="balance" size="sm" className="h-[29px] w-[29px]" /></div>
        </div>
        <div className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]">
          <div>
            <div className="text-xs font-semibold text-slate-500">الإنفاق على الإعلانات</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-[#12234b]">$124.80</div>
            <div className="mt-1 text-[10px] text-slate-400">منذ بداية الشهر</div>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eafbf8] text-[#159b89]"><DollarSign className="h-5 w-5" /></div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_.85fr]">
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div>
              <h2 className="font-display text-lg font-bold text-[#12234b]">أحدث إعلاناتك</h2>
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
                  {campaign.image ? <img src={campaign.image} alt={campaign.title} className="h-full w-full object-cover" /> : <div className="media-art grid h-full place-items-center text-white/80">{campaign.platform === 'telegram' ? <Users className="h-5 w-5" /> : <Target className="h-5 w-5" />}</div>}
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
                    <span>{campaign.targetCount.toLocaleString('ar')} {campaign.platform === 'telegram' ? 'مشترك' : 'متابع'}</span>
                  </div>
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-bold text-[#12234b]">${campaign.price.toFixed(2)}</div>
                  <div className="mt-1 text-[10px] text-slate-400">ميزانية الحملة</div>
                </div>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${campaign.platform === 'telegram' ? 'bg-[#eaf8fd] text-[#168fb8]' : 'bg-slate-100 text-[#12234b]'}`}>
                  {campaign.platform === 'telegram' ? <Users className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                </span>
              </div>
            )))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <span className="text-[11px] text-slate-400">عرض {visibleVideos.length + visiblePlatformCampaigns.length} من {videos.length + platformCampaigns.length} إعلاناً</span>
            <Button type="button" data-testid="button-view-all-videos" onClick={() => onTab('all')} variant="ghost" size="fit" className="flex items-center gap-1 text-xs font-bold text-[#1557ee]">عرض الكل <ArrowDownLeft className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-7">
          <div className="absolute -left-14 -top-14 h-40 w-40 rounded-full border border-cyan-300/15" />
          <div className="absolute -left-2 top-2 h-16 w-16 rounded-full border border-cyan-300/15" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-100">ملخص الإنفاق</span>
               <Button type="button" data-testid="button-spend-period" onClick={() => setSpendPeriod((current) => current === 'آخر ٧ أيام' ? 'آخر ٣٠ يومًا' : 'آخر ٧ أيام')} variant="unstyled" size="fit" className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] text-blue-100 transition hover:border-cyan-200/40 hover:text-cyan-200">{spendPeriod} <ChevronLeft className="mr-1 inline h-3 w-3 rotate-[-90deg]" /></Button>
            </div>
            <div className="mt-7 flex items-end justify-between">
              <div>
                <div className="text-[31px] font-bold tracking-tight">$124.80</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-cyan-300"><ArrowUpLeft className="h-3 w-3" /> +14.8% عن الأسبوع الماضي</div>
              </div>
              <DollarSign className="mb-2 h-7 w-7 text-cyan-300/70" />
            </div>
            <div className="mt-8 flex h-[100px] items-end gap-2 border-b border-white/10 pb-0">
              {[32, 46, 40, 64, 55, 74, 67, 86, 77, 96, 87, 100].map((height, i) => (
                <div key={i} className="group flex h-full flex-1 items-end">
                  <div className={`w-full rounded-t-sm transition-all group-hover:bg-cyan-200 ${i === 9 ? 'bg-cyan-300' : 'bg-blue-300/30'}`} style={{ height: `${height}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-blue-100/45"><span>١٨ ديسمبر</span><span>٢٤ ديسمبر</span></div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-center justify-between">
          <div><h2 className="font-display text-lg font-bold text-[#12234b]">أداء هذا الشهر</h2><p className="mt-1 text-xs text-slate-400">مقارنة المشاهدات المكتملة بالأسبوع السابق</p></div>
          <BarChart3 className="h-5 w-5 text-[#1557ee]" />
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_220px] md:items-center">
          <div className="relative h-20 overflow-hidden rounded-xl bg-[#f7f9fd]">
            <div className="absolute inset-x-0 bottom-0 h-full opacity-80" style={{ clipPath: 'polygon(0 72%, 8% 60%, 16% 69%, 24% 38%, 32% 48%, 40% 30%, 50% 44%, 58% 19%, 66% 32%, 75% 14%, 83% 27%, 92% 8%, 100% 15%, 100% 100%, 0 100%)', background: 'linear-gradient(180deg, rgba(21,87,238,.25), rgba(21,87,238,.01))' }} />
            <div className="absolute inset-x-0 bottom-0 h-px bg-[#1557ee]" style={{ clipPath: 'polygon(0 72%, 8% 60%, 16% 69%, 24% 38%, 32% 48%, 40% 30%, 50% 44%, 58% 19%, 66% 32%, 75% 14%, 83% 27%, 92% 8%, 100% 15%, 100% 100%, 0 100%)' }} />
          </div>
          <div className="flex justify-between gap-4 md:block">
            <div><div className="text-[11px] text-slate-400">إكمالات الفيديو</div><div className="mt-1 text-xl font-bold text-[#12234b]">9,428</div></div>
            <div className="mt-0 md:mt-4"><div className="text-[11px] text-slate-400">معدل التحويل</div><div className="mt-1 text-xl font-bold text-[#12234b]">8.7%</div></div>
          </div>
        </div>
      </section>
    </main>
  );
}

