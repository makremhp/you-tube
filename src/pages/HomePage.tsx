import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  History, LayoutDashboard, Megaphone, Plus, WalletCards,
} from 'lucide-react';
import { SiTelegram, SiTiktok, SiYoutube } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import {
  createBlockchainTxId, createBrowserWatchUrl, createUniqueIdentifier,
  calculateViewerReward, getCompletedVideoIds, getTelegramUser,
  getTelegramUserFromHash, initialVideos, readLocalState,
  promotionCampaignsStorageKey, taskProofsStorageKey, ToastViewport, Sidebar,
  Header, WatchPanel,
  type AdvertisementSession, type AdvertisementSessionStatus, type AppScreen,
  type DepositRecord, type PromotionCampaign, type TaskProof, type TelegramUser,
  type ToastTone, type ToastMessage, type Video, type WithdrawRecord,
} from '@/legacy/shared';
import { initialDepositHistory, initialWithdrawHistory } from '@/lib/data';
import { AddVideo } from '@/pages/AddCampaignPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { DepositPage } from '@/pages/DepositPage';
import { DepositHistoryPage } from '@/pages/DepositHistoryPage';
import { WithdrawHistoryPage } from '@/pages/WithdrawHistoryPage';
import { CreatorOverview } from '@/pages/OverviewPage';
import { PlatformTasksPage } from '@/pages/PlatformTasksPage';
import { TikTokTaskPage } from '@/pages/TikTokTaskPage';
import { PublishingSystemPage } from '@/pages/PublishingPage';
import { ViewerView } from '@/pages/ViewerPage';
import { WithdrawPage } from '@/pages/WithdrawPage';
import { AdsPage } from '@/pages/AdsPage';

type HomePageProps = {
  initialMode: 'creator' | 'viewer';
  initialScreen: 'watch' | 'add' | null;
  onModeChange: (mode: 'creator' | 'viewer') => void;
};

export function HomePage({ initialMode, initialScreen, onModeChange }: HomePageProps) {
  const { t } = useLanguage();
  const [browserEarningPage] = useState(() => new URLSearchParams(window.location.search).get('view') === 'earn');
  const [mode, setMode] = useState<'creator' | 'viewer'>(() => browserEarningPage ? 'viewer' : initialMode);
  const [screen, setScreen] = useState<AppScreen>(() => browserEarningPage
    ? 'watch'
    : initialScreen ?? (initialMode === 'viewer' ? 'watch' : 'overview'));
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(() => getTelegramUser() ?? getTelegramUserFromHash());
  const [insideTelegram, setInsideTelegram] = useState(() => !browserEarningPage && Boolean(window.Telegram?.WebApp?.initData));
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [platformCampaigns, setPlatformCampaigns] = useState<PromotionCampaign[]>(() => readLocalState(promotionCampaignsStorageKey, []));
  const [taskProofs, setTaskProofs] = useState<TaskProof[]>(() => readLocalState(taskProofsStorageKey, []));
  const [completedVideoIds, setCompletedVideoIds] = useState<Set<number>>(() => getCompletedVideoIds());
  const [tab, setTab] = useState<'all' | 'active' | 'drafts'>('all');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedTikTokTask, setSelectedTikTokTask] = useState<PromotionCampaign | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [advertiserBalance, setAdvertiserBalance] = useState(250);
  const [viewerBalance, setViewerBalance] = useState(12.84);
  const [depositHistory, setDepositHistory] = useState<DepositRecord[]>(initialDepositHistory);
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawRecord[]>(initialWithdrawHistory);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [watchSession, setWatchSession] = useState<AdvertisementSession | null>(null);
  const watchElapsedRef = useRef(0);
  const watchSegmentStartedRef = useRef<number | null>(null);
  const externalWatchPendingRef = useRef(false);
  const watchSessionRef = useRef<AdvertisementSession | null>(null);
  const creditedVideosRef = useRef(new Set<number>());
  const toastSequenceRef = useRef(0);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData && !browserEarningPage) {
      webApp.ready();
      webApp.expand();
      setTelegramUser(webApp.initDataUnsafe?.user ?? null);
      setInsideTelegram(true);
    }
  }, [browserEarningPage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(promotionCampaignsStorageKey, JSON.stringify(platformCampaigns));
      window.localStorage.setItem(taskProofsStorageKey, JSON.stringify(taskProofs));
    } catch {
      // Keep the original app usable if browser storage is unavailable or full.
    }
  }, [platformCampaigns, taskProofs]);

  const saveWatchSession = (
    video: Video,
    elapsedMs = watchElapsedRef.current,
    status: AdvertisementSessionStatus = elapsedMs >= video.duration * 1000 ? 'completed' : 'paused',
    stoppedAt = Date.now(),
  ) => {
    const previousSession = watchSessionRef.current;
    const nextSession: AdvertisementSession = {
      id: previousSession?.videoId === video.id ? previousSession.id : createUniqueIdentifier('ADS'),
      videoId: video.id,
      elapsedMs: Math.min(elapsedMs, video.duration * 1000),
      requiredMs: video.duration * 1000,
      status,
      lastStartedAt: previousSession?.lastStartedAt,
      lastStoppedAt: status === 'active' ? previousSession?.lastStoppedAt : stoppedAt,
      credited: creditedVideosRef.current.has(video.id),
    };
    watchSessionRef.current = nextSession;
    setWatchSession((current) => current?.id === nextSession.id && current.status === nextSession.status ? current : nextSession);
    try {
      window.localStorage.setItem(`vidreward.watch.${video.id}`, JSON.stringify(nextSession));
    } catch {
      // Local storage may be unavailable in a restricted browser context.
    }
  };

  const notify = useCallback((tone: ToastTone, title: string, message: string) => {
    const id = ++toastSequenceRef.current;
    setToasts((current) => [...current.slice(-3), { id, tone, title, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6000);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (
          externalWatchPendingRef.current &&
          selectedVideo &&
          watchSegmentStartedRef.current === null &&
          !creditedVideosRef.current.has(selectedVideo.id)
        ) {
          const startedAt = Date.now();
          watchSegmentStartedRef.current = startedAt;
          setIsPlaying(true);
          const currentSession = watchSessionRef.current;
          if (currentSession?.videoId === selectedVideo.id) {
            watchSessionRef.current = { ...currentSession, status: 'active', lastStartedAt: startedAt };
          }
          saveWatchSession(selectedVideo, watchElapsedRef.current, 'active');
        }
        return;
      }

      if (document.visibilityState === 'visible' && selectedVideo && watchSegmentStartedRef.current !== null) {
        const returnedAt = Date.now();
        const segmentElapsed = Math.max(0, returnedAt - watchSegmentStartedRef.current);
        const requiredMs = selectedVideo.duration * 1000;
        const elapsed = Math.min(
          requiredMs,
          watchElapsedRef.current + segmentElapsed,
        );
        watchSegmentStartedRef.current = null;
        externalWatchPendingRef.current = false;
        setIsPlaying(false);

        if (segmentElapsed < requiredMs) {
          watchElapsedRef.current = 0;
          setProgress(0);
          saveWatchSession(selectedVideo, 0, 'paused', returnedAt);
          notify('warning', 'المدة غير مكتملة', 'عد إلى فيديو YouTube وأكمل المدة المطلوبة من البداية؛ تم تصفير عدّاد المشاهدة.');
          return;
        }

        watchElapsedRef.current = elapsed;
        setProgress(Math.floor(elapsed / 1000));
        saveWatchSession(selectedVideo, elapsed, elapsed >= selectedVideo.duration * 1000 ? 'completed' : 'paused');
        if (elapsed < requiredMs) {
          notify('warning', 'الإعلان غير مكتمل', 'تم حفظ تقدم المشاهدة. ارجع وأكمل الوقت المطلوب لاستلام المكافأة.');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [selectedVideo]);

  const completed = Boolean(selectedVideo && progress >= selectedVideo.duration);
  const viewerCount = useMemo(() => videos.filter((video) => video.status === 'نشط').length, [videos]);

  const selectVideo = (video: Video) => {
    const now = Date.now();
    let restoredElapsed = 0;
    let restoredCredited = false;
    let restoredSessionId = '';
    let restoredStatus: AdvertisementSessionStatus = 'paused';
    try {
      const stored = window.localStorage.getItem(`vidreward.watch.${video.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AdvertisementSession>;
        if (parsed.videoId === video.id) {
          const savedElapsed = Math.max(0, Number(parsed.elapsedMs) || 0);
          const lastStartedAt = Number(parsed.lastStartedAt);
          const activeElapsed = parsed.status === 'active' && Number.isFinite(lastStartedAt)
            ? Math.max(0, now - lastStartedAt)
            : 0;
          restoredElapsed = Math.min(savedElapsed + activeElapsed, video.duration * 1000);
          restoredCredited = Boolean(parsed.credited);
          restoredSessionId = parsed.id ?? '';
          restoredStatus = parsed.status === 'completed' ? 'completed' : 'paused';
        }
      }
    } catch {
      restoredElapsed = 0;
    }
    const nextSession: AdvertisementSession = {
      id: restoredSessionId || createUniqueIdentifier('ADS'),
      videoId: video.id,
      elapsedMs: restoredElapsed,
      requiredMs: video.duration * 1000,
      status: restoredElapsed >= video.duration * 1000 ? 'completed' : restoredStatus,
      credited: restoredCredited,
      lastStoppedAt: now,
    };
    watchSessionRef.current = nextSession;
    setWatchSession(nextSession);
    try {
      window.localStorage.setItem(`vidreward.watch.${video.id}`, JSON.stringify(nextSession));
    } catch {
      // The current watch session should still work when storage is unavailable.
    }
    if (restoredCredited) creditedVideosRef.current.add(video.id);
    externalWatchPendingRef.current = false;
    if (restoredElapsed > 0 && restoredElapsed < video.duration * 1000 && !restoredCredited) {
      notify('warning', 'الإعلان غير مكتمل', 'تمت استعادة تقدم المشاهدة دون مكافأة. أكمل المدة المطلوبة ثم تحقق.');
    }
    watchElapsedRef.current = restoredElapsed;
    watchSegmentStartedRef.current = null;
    setSelectedVideo(video);
    setProgress(Math.floor(restoredElapsed / 1000));
    setIsPlaying(false);
  };

  const addVideo = (video: Omit<Video, 'id' | 'views' | 'status' | 'created' | 'art'>) => {
    setVideos((current) => [{ ...video, id: Date.now(), views: '0', status: 'نشط', created: 'الآن', art: 'media-art' }, ...current]);
  };

  const addPromotionCampaign = (campaign: PromotionCampaign) => {
    setPlatformCampaigns((current) => [campaign, ...current]);
    setScreen('campaigns');
    notify(
      campaign.status === 'نشط' ? 'success' : 'info',
      campaign.status === 'نشط' ? 'تم نشر الحملة' : 'الحملة بانتظار إعداد البوت',
      campaign.status === 'نشط' ? 'أضيف إعلان TikTok إلى قائمة إعلاناتك.' : 'لن تظهر حملة Telegram كحملة نشطة حتى يتم التحقق من صلاحيات البوت.',
    );
  };

  const submitTaskProof = (campaignId: string, image: string) => {
    if (taskProofs.some((proof) => proof.campaignId === campaignId)) return;
    setTaskProofs((current) => [{ campaignId, image, status: 'قيد المراجعة', submittedAt: new Date().toISOString() }, ...current]);
    notify('info', 'الإثبات قيد المراجعة', 'تم تسجيل صورة الإثبات محليًا للمراجعة اليدوية.');
  };

  const openTikTokTask = (campaign: PromotionCampaign) => {
    setSelectedTikTokTask(campaign);
    setScreen('tiktok-task');
  };

  const withdrawEarnings = (record: WithdrawRecord) => {
    setViewerBalance((current) => Number(Math.max(0, current - record.amount).toFixed(4)));
    setWithdrawHistory((current) => [record, ...current]);
    notify('success', 'تم إرسال طلب السحب', `أضيف الطلب ${record.id} إلى سجل السحب بحالة قيد المعالجة.`);
  };

  const requestDeposit = (record: DepositRecord) => {
    setDepositHistory((current) => [record, ...current]);
    notify('info', 'تم إنشاء الفاتورة', `المعرّف الداخلي ${record.id} · Memo / Tag ${record.memoTag}`);
  };

  const completeDeposit = (id: string) => {
    const record = depositHistory.find((item) => item.id === id);
    const blockchainTxId = record?.blockchainTxId ?? createBlockchainTxId();
    setDepositHistory((current) => current.map((item) => item.id === id ? { ...item, status: 'تم', blockchainTxId } : item));
    if (record) {
      setAdvertiserBalance((current) => Number((current + record.amount).toFixed(2)));
      notify('success', 'تم تأكيد الإيداع', `تمت إضافة ${record.amount.toFixed(2)} USDT إلى رصيد المعلن.`);
    }
  };

  const expireDeposit = (id: string) => {
    setDepositHistory((current) => current.map((record) => record.id === id ? { ...record, status: 'تم الإلغاء' } : record));
    notify('warning', 'انتهت صلاحية الفاتورة', 'لم يصل تحويل مؤكد قبل انتهاء مدة الفاتورة.');
  };

  const creditViewer = (video: Video) => {
    if (creditedVideosRef.current.has(video.id)) return;
    creditedVideosRef.current.add(video.id);
    setCompletedVideoIds((current) => new Set(current).add(video.id));
    saveWatchSession(video, video.duration * 1000, 'completed');
    setViewerBalance((current) => Number((current + calculateViewerReward(video.cpm)).toFixed(4)));
    notify('success', 'تمت إضافة المكافأة', `أضيفت ${video.reward} إلى رصيدك بعد إكمال المدة المطلوبة.`);
  };

  const creditAdReward = (amount: number, title: string, message: string) => {
    setViewerBalance((current) => Number((current + amount).toFixed(4)));
    notify('success', title, message);
  };

  const openWatchInBrowser = (_video: Video) => {
    const url = createBrowserWatchUrl(telegramUser);
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openLink) {
      webApp.openLink(url, { try_instant_view: false });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const changeMode = (nextMode: 'creator' | 'viewer') => {
    setMode(nextMode);
    setScreen(nextMode === 'creator' ? 'overview' : 'watch');
    onModeChange(nextMode);
  };

  const openAdvertiserCampaignForm = () => {
    setMode('creator');
    setScreen('add');
    onModeChange('creator');
  };

  return (
    <div className="min-h-[100dvh] bg-[#f7f9fc] text-[#12234b]">
      <div className={`flex min-h-[100dvh] ${browserEarningPage ? '' : 'lg:gap-5 lg:p-5'}`}>
        {!browserEarningPage && <Sidebar mode={mode} screen={screen} telegramUser={telegramUser} onModeChange={changeMode} onNavigate={setScreen} onAdd={openAdvertiserCampaignForm} open={mobileMenu} onClose={() => setMobileMenu(false)} />}
        {!browserEarningPage && mobileMenu && <Button type="button" aria-label="إغلاق خلفية القائمة" data-testid="button-close-menu-overlay" onClick={() => setMobileMenu(false)} variant="unstyled" size="fit" className="fixed inset-0 z-40 bg-[#061333]/30 backdrop-blur-sm lg:hidden" />}
        <div className={`min-w-0 flex-1 ${browserEarningPage ? '' : 'overflow-hidden rounded-none bg-[#f7f9fc] lg:rounded-[26px] lg:border lg:border-slate-200/80 lg:bg-[#fbfcfe]'}`}>
          {!browserEarningPage && <Header mode={mode} screen={screen} telegramUser={telegramUser} onMenu={() => setMobileMenu(true)} onAdd={openAdvertiserCampaignForm} />}
          {screen === 'add' && mode === 'creator' ? <AddVideo telegramUser={telegramUser} onBack={() => setScreen('campaigns')} onPromotionSubmit={addPromotionCampaign} onSubmit={(video) => { addVideo(video); notify('success', 'تم نشر الإعلان', 'أصبح الفيديو نشطًا ويمكن للمشاهدين اكتشافه الآن.'); }} />
            : screen === 'deposit' && mode === 'creator' ? <DepositPage advertiserBalance={advertiserBalance} telegramUser={telegramUser} onDepositRequested={requestDeposit} onDepositCompleted={completeDeposit} onDepositExpired={expireDeposit} />
                : screen === 'deposit-history' && mode === 'creator' ? <DepositHistoryPage records={depositHistory} onDeposit={() => setScreen('deposit')} />
                : screen === 'withdraw' && mode === 'viewer' ? <WithdrawPage viewerBalance={viewerBalance} telegramUser={telegramUser} onWithdraw={withdrawEarnings} />
                  : screen === 'withdraw-history' && mode === 'viewer' ? <WithdrawHistoryPage records={withdrawHistory} onWithdraw={() => setScreen('withdraw')} />
                : screen === 'campaigns' && mode === 'creator' ? <CampaignsPage videos={videos} platformCampaigns={platformCampaigns} telegramUser={telegramUser} tab={tab} onTab={setTab} onAdd={() => setScreen('add')} onWatch={selectVideo} />
                    : screen === 'telegram-tasks' && mode === 'viewer' ? <PlatformTasksPage platform="telegram" campaigns={platformCampaigns} proofs={taskProofs} onNotify={notify} telegramUserId={telegramUser?.id ?? null} />
                     : screen === 'tiktok-tasks' && mode === 'viewer' ? <PlatformTasksPage platform="tiktok" campaigns={platformCampaigns} proofs={taskProofs} onStartTask={openTikTokTask} onNotify={notify} telegramUserId={telegramUser?.id ?? null} />
                      : screen === 'tiktok-task' && mode === 'viewer' && selectedTikTokTask ? <TikTokTaskPage campaign={selectedTikTokTask} proof={taskProofs.find((item) => item.campaignId === selectedTikTokTask.id)} onSubmitProof={submitTaskProof} onBack={() => setScreen('tiktok-tasks')} />
                         : screen === 'ads' && mode === 'viewer' ? <AdsPage key={telegramUser?.id ?? 'guest'} userId={telegramUser?.id ?? null} onReward={creditAdReward} />
                 : screen === 'publish' && mode === 'viewer' ? <PublishingSystemPage telegramUser={telegramUser} />
                : screen === 'watch' && mode === 'viewer' ? <ViewerView videos={videos} onSelect={selectVideo} insideTelegram={insideTelegram} onOpenBrowser={openWatchInBrowser} completedVideoIds={completedVideoIds} browserMode={browserEarningPage} />
                   : <CreatorOverview telegramUser={telegramUser} platformCampaigns={platformCampaigns} onAdd={() => setScreen('add')} onDeposit={() => setScreen('deposit')} />}
          {!browserEarningPage && <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">
             <div className={`mx-auto grid max-w-md ${mode === 'viewer' ? 'grid-cols-5' : 'grid-cols-4'} items-end gap-1`}>
              {mode === 'creator' ? (
                <>
                   <Button type="button" data-testid="button-mobile-creator" onClick={() => setScreen('campaigns')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-bold leading-tight ${screen === 'campaigns' ? 'text-[#1557ee]' : 'text-slate-400'}`}><LayoutDashboard className="h-5 w-5" /> <span className="max-w-full truncate">{t('إعلاناتي')}</span></Button>
                   <Button type="button" data-testid="button-mobile-add" onClick={() => setScreen('add')} variant="primary" size="icon" className="mx-auto grid h-11 w-11 -translate-y-4 place-items-center rounded-2xl"><Plus className="h-5 w-5" /></Button>
                    <Button type="button" data-testid="button-mobile-ad-wallet" onClick={() => setScreen('deposit')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-bold leading-tight ${screen === 'deposit' ? 'text-[#1557ee]' : 'text-slate-400'}`}><WalletCards className="h-5 w-5" /> <span className="max-w-full truncate">{t('إيداع رصيد')}</span></Button>
                    <Button type="button" data-testid="button-mobile-deposit-history" onClick={() => setScreen('deposit-history')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-bold leading-tight ${screen === 'deposit-history' ? 'text-[#1557ee]' : 'text-slate-400'}`}><History className="h-5 w-5" /> <span className="max-w-full truncate">{t('سجل الإيداع')}</span></Button>
                </>
              ) : (
                <>
                    <Button type="button" data-testid="button-mobile-earn" onClick={() => setScreen('watch')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[9px] font-bold leading-tight ${screen === 'watch' ? 'text-[#1557ee]' : 'text-slate-400'}`}><SiYoutube aria-hidden="true" className="h-5 w-5" /> <span className="max-w-full truncate">{t('شاهد واربح')}</span></Button>
                    <Button type="button" data-testid="button-mobile-telegram-tasks" onClick={() => setScreen('telegram-tasks')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[9px] font-bold leading-tight ${screen === 'telegram-tasks' ? 'text-[#1557ee]' : 'text-slate-400'}`}><SiTelegram aria-hidden="true" className="h-5 w-5" /> <span className="max-w-full truncate">Telegram</span></Button>
                    <Button type="button" data-testid="button-mobile-tiktok-tasks" onClick={() => setScreen('tiktok-tasks')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[9px] font-bold leading-tight ${screen === 'tiktok-tasks' ? 'text-[#1557ee]' : 'text-slate-400'}`}><SiTiktok aria-hidden="true" className="h-5 w-5" /> <span className="max-w-full truncate">TikTok</span></Button>
                    <Button type="button" data-testid="button-mobile-ads" onClick={() => setScreen('ads')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[9px] font-bold leading-tight ${screen === 'ads' ? 'text-[#1557ee]' : 'text-slate-400'}`}><Megaphone className="h-5 w-5" /> <span className="max-w-full truncate">Ads</span></Button>
                    <Button type="button" data-testid="button-mobile-earnings" onClick={() => setScreen('withdraw')} variant="unstyled" size="fit" className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[9px] font-bold leading-tight ${screen === 'withdraw' ? 'text-[#1557ee]' : 'text-slate-400'}`}><WalletCards className="h-5 w-5" /> <span className="max-w-full truncate">{t('سحب الأرباح')}</span></Button>
                </>
              )}
            </div>
          </div>}
        </div>
      </div>
      {selectedVideo && <WatchPanel video={selectedVideo} progress={progress} isPlaying={isPlaying} completed={completed} session={watchSession} onOpenVideo={() => {
        if (!creditedVideosRef.current.has(selectedVideo.id)) externalWatchPendingRef.current = true;
      }} onComplete={() => creditViewer(selectedVideo)} onClose={() => {
        externalWatchPendingRef.current = false;
        setSelectedVideo(null);
        setIsPlaying(false);
        setWatchSession(null);
      }} />}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      <span className="sr-only" data-testid="text-viewer-count">{viewerCount} فيديو متاح</span>
    </div>
  );
}
