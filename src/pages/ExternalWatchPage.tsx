import { Clock3, ExternalLink, Play, PlaySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { formatDuration, UserAvatar, type TelegramUser } from '@/legacy/shared';

export function ExternalWatchPage() {
  const { dir } = useLanguage();
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('v') ?? '';
  const validVideoId = /^[\w-]{11}$/.test(videoId);
  const title = (params.get('title') ?? 'مشاهدة الفيديو').slice(0, 160);
  const creator = (params.get('creator') ?? 'VidReward').slice(0, 100);
  const duration = Math.max(1, Math.min(3600, Number(params.get('duration')) || 0));
  const reward = (params.get('reward') ?? '').slice(0, 24);
  let telegramUser: TelegramUser | null = null;
  try {
    const serializedUser = new URLSearchParams(window.location.hash.slice(1)).get('telegram');
    if (serializedUser) {
      const parsed = JSON.parse(serializedUser) as Partial<TelegramUser>;
      const photoUrl = typeof parsed.photo_url === 'string' && /^https?:\/\//i.test(parsed.photo_url)
        ? parsed.photo_url
        : undefined;
      if (Number.isSafeInteger(parsed.id) && Number(parsed.id) > 0 && typeof parsed.first_name === 'string') {
        telegramUser = {
          id: Number(parsed.id),
          first_name: parsed.first_name.slice(0, 80),
          last_name: typeof parsed.last_name === 'string' ? parsed.last_name.slice(0, 80) : undefined,
          username: typeof parsed.username === 'string' ? parsed.username.replace(/^@/, '').slice(0, 64) : undefined,
          photo_url: photoUrl,
        };
      }
    }
  } catch {
    telegramUser = null;
  }

  return (
    <main className="browser-watch-shell browser-watch-page min-h-[100dvh] bg-[#071632] px-4 py-6 text-white sm:px-8 sm:py-10" dir={dir}>
      <div className="mx-auto w-full max-w-5xl">
        <header className="browser-orientation mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1557ee]"><Play className="h-4 w-4 fill-current" /></span>
            <div><div className="font-display text-base font-bold">VidReward · المشاهدة</div><div className="mt-1 text-[10px] text-blue-100/60">صفحة فيديو مستقلة للمتصفح</div></div>
          </div>
          {telegramUser && (
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[.06] px-3 py-2">
              <UserAvatar user={telegramUser} className="ring-0" />
              <div className="min-w-0"><div className="truncate text-xs font-bold">{telegramUser.first_name} {telegramUser.last_name ?? ''}</div>{telegramUser.username && <div className="mt-0.5 truncate text-[10px] text-cyan-200" dir="ltr">@{telegramUser.username}</div>}<div className="mt-0.5 text-[10px] text-blue-100/60" dir="ltr">ID: {telegramUser.id}</div></div>
            </div>
          )}
        </header>
        <section className="browser-video-card overflow-hidden rounded-[24px] border border-white/10 bg-[#0d2041] shadow-2xl">
          {validVideoId ? (
            <div className="browser-video-stage min-w-0 max-w-full overflow-hidden aspect-video w-full bg-black" dir="ltr">
              <iframe
                title={title}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
                className="block h-full max-w-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="browser-video-stage flex min-w-0 max-w-full aspect-video flex-col items-center justify-center overflow-hidden px-6 text-center">
              <PlaySquare className="h-12 w-12 text-cyan-300" />
              <h1 className="mt-4 text-lg font-bold">تعذّر العثور على فيديو YouTube</h1>
              <p className="mt-2 text-sm leading-6 text-blue-100/60">ارجع إلى VidReward واختر فيديو YouTube نشطًا ثم افتحه في المتصفح.</p>
            </div>
          )}
          <div className="browser-video-details flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-7">{title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-blue-100/60">
                <span>{creator}</span>
                <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(duration)}</span>
                {reward && <span className="font-bold text-cyan-300">المكافأة المعروضة: {reward}</span>}
              </div>
            </div>
            {validVideoId && (
              <Button asChild variant="secondary" size="default" className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-transparent px-4 py-3 text-xs font-bold text-white transition hover:bg-white/10">
                <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> فتح في YouTube
                </a>
              </Button>
            )}
          </div>
        </section>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-6 text-blue-100/50">يمكنك مشاهدة هذا الفيديو هنا مباشرةً. بيانات Telegram المعروضة في الصفحة للتعريف فقط، ولا تُستخدم لتأكيد الهوية أو صرف الأرباح.</p>
      </div>
    </main>
  );
}
