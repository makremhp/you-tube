import { Clock3, DollarSign, ExternalLink, Film, PlaySquare, ShieldCheck, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { SiYoutube } from 'react-icons/si';
import {
  calculateViewerReward, formatDuration, formatUsd, VideoArtwork, WalletArtwork,
  type Video,
} from '@/legacy/shared';

export function ViewerView({
  videos,
  onSelect,
  balance,
  onWithdraw,
  insideTelegram,
  onOpenBrowser,
  completedVideoIds,
  browserMode = false,
}: {
  videos: Video[];
  onSelect: (video: Video) => void;
  balance: number;
  onWithdraw: () => void;
  insideTelegram: boolean;
  onOpenBrowser: (video: Video) => void;
  completedVideoIds: Set<number>;
  browserMode?: boolean;
}) {
  const { dir } = useLanguage();
  const activeVideos = videos.filter((video) => video.status === 'نشط' && !completedVideoIds.has(video.id));
  const totalVideoRewards = activeVideos.reduce((total, video) => total + calculateViewerReward(video.cpm), 0);
  return (
    <main className={`browser-watch-shell mx-auto w-full max-w-[1370px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12 ${browserMode ? 'browser-watch-page' : ''}`} dir={dir}>
      {browserMode && (
        <section className="browser-orientation mb-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-3 py-2.5 text-right shadow-[var(--shadow-soft)]" aria-label="إرشادات المشاهدة">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[#1557ee]"><PlaySquare className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold text-[#12234b]">أنت في صفحة المشاهدة</div>
            <div className="mt-0.5 truncate text-[10px] text-slate-400">اختر فيديو لبدء جلسة مشاهدة موثقة</div>
          </div>
          <span className="mr-auto flex shrink-0 items-center gap-1 rounded-full bg-[#eafbf8] px-2 py-1 text-[9px] font-bold text-[#159b89]"><ShieldCheck className="h-3 w-3" /> آمنة</span>
        </section>
      )}
      <section className="viewer-earnings-summary mb-5 grid h-10 grid-cols-2 gap-2 sm:gap-3" aria-label="ملخص أرباح المشاهدة">
        <div data-testid="viewer-summary-available" className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-blue-100 bg-white px-2.5 shadow-[var(--shadow-soft)] sm:px-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[#1557ee]"><Film className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-500 sm:text-[11px]">فيديوهات متاحة</span>
          <strong className="shrink-0 text-sm font-bold tabular-nums text-[#12234b]" aria-label={`${activeVideos.length} فيديو متاح`}>{activeVideos.length}</strong>
        </div>
        <div data-testid="viewer-summary-rewards" className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-emerald-100 bg-[#f6fcfb] px-2.5 shadow-[var(--shadow-soft)] sm:px-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eafbf8] text-[#159b89]"><DollarSign className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-500 sm:text-[11px]">إجمالي المكافآت</span>
          <strong className="shrink-0 text-[13px] font-bold tabular-nums text-[#159b89]" aria-label={`${formatUsd(totalVideoRewards)} إجمالي المكافآت`}>{formatUsd(totalVideoRewards)}</strong>
        </div>
      </section>
      <section className="mb-5 flex flex-col gap-4 rounded-[22px] border border-blue-100 bg-white p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef4ff]">
            <WalletArtwork method="balance" size="md" className="h-12 w-12" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">رصيدك القابل للسحب</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-[#12234b]">{formatUsd(balance)}</div>
          </div>
        </div>
        <Button type="button" data-testid="button-withdraw" onClick={onWithdraw} disabled={balance <= 0} variant="secondary" size="default" className="flex items-center justify-center gap-2 border-[#1557ee] text-xs font-bold text-[#1557ee] disabled:border-slate-200 disabled:text-slate-300">
          <WalletArtwork method="balance" size="xs" className="h-7 w-7" /> سحب الأرباح
        </Button>
      </section>
      {insideTelegram ? (
        <section className="animate-rise mx-auto mt-8 flex min-h-[340px] max-w-3xl flex-col items-center justify-center rounded-[26px] border border-blue-100 bg-white px-6 py-10 text-center shadow-[var(--shadow-soft)] md:px-10">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><PlaySquare className="h-8 w-8" /></div>
          <h2 className="mt-5 font-display text-2xl font-bold text-[#12234b]">شاهد واربح من المتصفح</h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">مشغلات YouTube لا تظهر داخل Telegram. افتح صفحة المشاهدة في المتصفح لمشاهدة الفيديوهات مباشرةً دون قوائم التطبيق.</p>
          {activeVideos[0] ? (
            <Button type="button" data-testid="button-open-browser-watch" onClick={() => onOpenBrowser(activeVideos[0])} variant="primary" size="lg" className="mt-7 flex items-center justify-center gap-2 text-sm font-bold">
              <ExternalLink className="h-4 w-4" /> اذهب للمتصفح للمشاهدة والربح
            </Button>
          ) : (
            <p className="mt-7 rounded-xl bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-500">لا توجد فيديوهات جديدة للمشاهدة حاليًا.</p>
          )}
          <p className="mt-4 text-[10px] leading-5 text-slate-400">ستفتح صفحة مشاهدة مستقلة تعرض الفيديو المختار فقط.</p>
        </section>
      ) : (
        <>
      <section className="animate-rise relative overflow-hidden rounded-[26px] bg-[#0e2452] px-6 py-8 text-white md:px-10 md:py-10">
        <div className="grid-dots absolute inset-0 opacity-20" />
        <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full border border-cyan-200/15" />
        <div className="relative max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold text-cyan-300"><Target className="h-4 w-4" /> اربح من وقتك</div>
          <h1 className="font-display text-[28px] font-bold leading-[1.35] tracking-[-.04em] md:text-[39px]">شاهد ما تحب،<br /><span className="text-cyan-300">واكسب مقابل وقتك.</span></h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-blue-100/70">أكمل المدة المطلوبة، واحصل على رصيدك مباشرة. لا تعقيد، فقط محتوى يستحق وقتك.</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-blue-100/75">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> أرباح موثوقة</span>
            <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-cyan-300" /> مدد واضحة</span>
          </div>
        </div>
        <div className="absolute bottom-8 left-8 hidden h-32 w-32 rounded-full border border-cyan-200/15 md:block"><div className="m-6 h-20 w-20 rounded-full border border-cyan-200/15" /></div>
      </section>
      <div className="mt-8 flex items-end justify-between">
          <div><h2 className="font-display text-xl font-bold text-[#12234b]">الفيديوهات المتاحة</h2><p className="mt-1 text-xs text-slate-400">كل مشاهدة مكتملة تضيف إلى رصيدك</p></div>
        <span className="hidden rounded-full bg-[#eafbf8] px-3 py-1.5 text-[10px] font-bold text-[#159b89] sm:block">{activeVideos.length} فيديو متاح الآن</span>
      </div>
      {activeVideos.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-[var(--shadow-soft)]">
          <div className="text-sm font-bold text-[#12234b]">لا توجد فيديوهات جديدة الآن</div>
          <p className="mt-2 text-xs text-slate-400">ستظهر هنا الفيديوهات التي لم تشاهدها بعد.</p>
        </div>
      ) : <div className="browser-watch-list mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {activeVideos.map((video, index) => (
          <Button type="button" key={video.id} data-testid={`card-reward-${video.id}`} onClick={() => onSelect(video)} variant="unstyled" size="fit" className={`group flex w-full items-stretch overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[var(--shadow-lift)] md:block ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <div className="my-auto w-[38%] min-w-[112px] max-w-[168px] shrink-0 p-2 md:my-0 md:w-full md:max-w-none md:p-0">
              <VideoArtwork video={video} compact />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between p-3 md:p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[10px] text-slate-400">فيديو {String(index + 1).padStart(2, '0')}</span>
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-[#edf3ff] px-2 py-1 text-[10px] font-bold text-[#1557ee]"><Clock3 className="h-3 w-3" /> {formatDuration(video.duration)}</span>
              </div>
              <h3 className="mt-2 line-clamp-2 text-start text-sm font-bold leading-5 text-[#12234b] md:mt-3 md:leading-6">{video.title}</h3>
              <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 md:mt-4 md:pt-3">
                <span className="min-w-0 truncate text-[10px] text-slate-400 md:text-[11px]">{video.creator}</span>
                <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#159b89] md:text-sm"><SiYoutube aria-hidden="true" className="h-3.5 w-3.5 text-[#ff0033]" /> + {video.reward}</span>
              </div>
            </div>
          </Button>
        ))}
      </div>}
        </>
      )}
    </main>
  );
}

