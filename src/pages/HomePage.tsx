import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  History, LayoutDashboard, Megaphone, Plus, WalletCards,
} from 'lucide-react';
import { SiTelegram, SiTiktok, SiYoutube } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import {
  createBrowserWatchUrl, createUniqueIdentifier,
  formatUsd, getTelegramUser,
  getTelegramUserFromHash, ToastViewport, Sidebar,
  Header, WatchPanel,
  type AdvertisementSession, type AdvertisementSessionStatus, type AppScreen,
  type DepositRecord, type PromotionCampaign, type TaskProof, type TelegramUser,
  type ToastTone, type ToastMessage, type Video, type WithdrawRecord,
} from '@/legacy/shared';
import {
  apiDelete, apiGet, apiPatch, apiPost, toDepositRecord, toPromotion, toTaskProof, toVideo, toWithdrawRecord,
  ApiError, type ApiBalance, type ApiCampaignRow, type ApiHistoryRecordRow, type ApiProofRecordRow,
} from '@/lib/api';
import { AddVideo } from '@/pages/AddCampaignPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { CampaignDetailsPage } from '@/pages/CampaignDetailsPage';
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
import { AdminConsole } from '@/pages/AdminConsole';

type HomePageProps = {
  initialMode: 'creator' | 'viewer';
  initialScreen: 'watch' | 'add' | null;
  onModeChange: (mode: 'creator' | 'viewer') => void;
};

export function HomePage({ initialMode, initialScreen, onModeChange }: HomePageProps) {
  const { t, language } = useLanguage();
  const [browserEarningPage] = useState(() => new URLSearchParams(window.location.search).get('view') === 'earn');
  const [mode, setMode] = useState<'creator' | 'viewer' | 'admin'>(() => browserEarningPage ? 'viewer' : initialMode);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [screen, setScreen] = useState<AppScreen>(() => browserEarningPage
    ? 'watch'
    : initialScreen ?? (initialMode === 'viewer' ? 'watch' : 'overview'));
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(() => getTelegramUser() ?? getTelegramUserFromHash());
  const [insideTelegram, setInsideTelegram] = useState(() => !browserEarningPage && Boolean(window.Telegram?.WebApp?.initData));
  const [videos, setVideos] = useState<Video[]>([]);
  const [taskVideos, setTaskVideos] = useState<Video[]>([]);
  const [taskProofs, setTaskProofs] = useState<TaskProof[]>([]);
  const [platformCampaigns, setPlatformCampaigns] = useState<PromotionCampaign[]>([]);
  const [taskCampaigns, setTaskCampaigns] = useState<PromotionCampaign[]>([]);
  const [completedVideoIds, setCompletedVideoIds] = useState<Set<number>>(() => new Set());
  const [tab, setTab] = useState<'all' | 'active' | 'drafts'>('all');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedTikTokTask, setSelectedTikTokTask] = useState<PromotionCampaign | null>(null);
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<{ video?: Video; campaign?: PromotionCampaign } | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [advertiserBalance, setAdvertiserBalance] = useState(0);
  const [viewerBalance, setViewerBalance] = useState(0);
  const [banned, setBanned] = useState(false);
  const bannedRef = useRef(false);
  const [depositHistory, setDepositHistory] = useState<DepositRecord[]>([]);
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [watchSession, setWatchSession] = useState<AdvertisementSession | null>(null);
  const watchElapsedRef = useRef(0);
  const watchSegmentStartedRef = useRef<number | null>(null);
  const externalWatchPendingRef = useRef(false);
  const watchSessionRef = useRef<AdvertisementSession | null>(null);
  const creditedVideosRef = useRef(new Set<number>());
  const toastSequenceRef = useRef(0);
  const auditedInitDataRef = useRef('');

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData && !browserEarningPage) {
      webApp.ready();
      webApp.expand();
      setTelegramUser(webApp.initDataUnsafe?.user ?? null);
      setInsideTelegram(true);
    }
  }, [browserEarningPage]);

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

  const refreshData = useCallback(async () => {
    try {
      const [balance, ownCampaigns, tasks, proofs, deposits, withdrawals] = await Promise.all([
        apiGet<ApiBalance>('balance'),
        apiGet<ApiCampaignRow[]>('campaigns'),
        apiGet<ApiCampaignRow[]>('tasks'),
        apiGet<ApiProofRecordRow[]>('proofs'),
        apiGet<ApiHistoryRecordRow[]>('deposits'),
        apiGet<ApiHistoryRecordRow[]>('withdrawals'),
      ]);
      setAdvertiserBalance(Number(balance?.advertiserBalance ?? 0));
      setViewerBalance(Number(balance?.viewerBalance ?? 0));
      setVideos(ownCampaigns.filter((row) => row.platform === 'youtube').map(toVideo));
      setPlatformCampaigns(ownCampaigns.filter((row) => row.platform !== 'youtube').map(toPromotion));
      setTaskVideos(tasks.filter((row) => row.platform === 'youtube').map(toVideo));
      setTaskCampaigns(tasks.filter((row) => row.platform !== 'youtube').map(toPromotion));
      const completedIds = new Set(tasks.filter((row) => row.platform === 'youtube' && row.completed).map((row) => Number(row.id)));
      creditedVideosRef.current = new Set([...creditedVideosRef.current, ...completedIds]);
      setCompletedVideoIds(completedIds);
      setTaskProofs(proofs.map(toTaskProof));
      setDepositHistory(deposits.map((row) => toDepositRecord(row, language)));
      setWithdrawHistory(withdrawals.map((row) => toWithdrawRecord(row, language)));
      bannedRef.current = false;
      setBanned(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.message === 'Account banned') {
        bannedRef.current = true;
        setBanned(true);
        return;
      }
      notify('warning', 'تعذر تحميل البيانات', 'تعذر الاتصال بالخادم. أعد المحاولة بعد قليل.');
    }
  }, [language, notify]);

  // تحديث الرصيد دوريًا وعند العودة للتطبيق حتى لا تظهر قيمة قديمة بعد تعديل الإدارة.
  const refreshBalance = useCallback(async () => {
    if (!window.Telegram?.WebApp?.initData) return;
    try {
      const balance = await apiGet<ApiBalance>('balance');
      setAdvertiserBalance(Number(balance?.advertiserBalance ?? 0));
      setViewerBalance(Number(balance?.viewerBalance ?? 0));
      if (bannedRef.current) {
        bannedRef.current = false;
        setBanned(false);
        void refreshData();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.message === 'Account banned') {
        bannedRef.current = true;
        setBanned(true);
      }
    }
  }, [refreshData]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void refreshBalance(); };
    const timer = window.setInterval(tick, 8000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [refreshBalance]);

  useEffect(() => {
    let active = true;
    void apiGet<{ isAdmin?: boolean } | null>('user')
      .then((user) => {
        if (active) setAdminEnabled(Boolean(user?.isAdmin));
      })
      .catch(() => {
        if (active) setAdminEnabled(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadOnEntry = async () => {
      const initData = window.Telegram?.WebApp?.initData ?? '';
      if (initData && auditedInitDataRef.current !== initData) {
        auditedInitDataRef.current = initData;
        try {
          const audit = await apiPost<{
            checkedChannels: number;
            unavailableChannels: number;
            revokedTasks: number;
            reversedAmount: number;
          }>('session/entry');
          if (active && audit.revokedTasks > 0) {
            notify(
              'warning',
              'أُعيد فتح مهام Telegram',
              `غادرت ${audit.revokedTasks} قناة قبل إكمال 3 أيام، فتم خصم ${formatUsd(audit.reversedAmount)} من رصيد المهام وإتاحتها للانضمام مجددًا.`,
            );
          } else if (active && audit.unavailableChannels > 0) {
            notify('info', 'تعذر فحص بعض القنوات', 'لم يُخصم أي رصيد عن قناة لم يؤكد Telegram حالة عضويتها.');
          }
        } catch {
          if (active) notify('warning', 'تعذر فحص عضوية Telegram', 'لم يُعدّل الرصيد أو تُفتح المهام؛ سيُعاد التحقق عند فتح التطبيق مجددًا.');
        }
      }
      if (active) await refreshData();
    };
    void loadOnEntry();
    return () => { active = false; };
  }, [refreshData, telegramUser?.id, notify]);

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
  const viewerCount = useMemo(() => taskVideos.filter((video) => video.status === 'نشط').length, [taskVideos]);

  const selectVideo = (video: Video) => {
    const now = Date.now();
    let restoredElapsed = 0;
    let restoredCredited = completedVideoIds.has(video.id);
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
    if (restoredCredited) {
      creditedVideosRef.current.add(video.id);
    } else {
      apiPost(`tasks/${video.id}/start`).catch(() => {
        notify('warning', 'تعذر بدء المهمة', 'لم يسجل الخادم بداية المشاهدة. أغلق الفيديو وافتحه مرة أخرى.');
      });
    }
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

  const addVideo = async (
    video: Omit<Video, 'id' | 'views' | 'status' | 'created' | 'art' | 'reward'> & { requestedViews: number },
    requestId: string,
  ) => {
    try {
      await apiPost('campaigns', {
        platform: 'youtube',
        title: video.title,
        creator: video.creator,
        link: video.link,
        cpm: video.cpm,
        duration: video.duration,
        requestedViews: video.requestedViews,
      }, requestId);
      await refreshData();
      notify('success', 'تم نشر الإعلان', 'أصبح الفيديو نشطًا ويمكن للمشاهدين اكتشافه الآن.');
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : 'لم يحفظ الخادم الإعلان. تحقق من الاتصال وحاول مرة أخرى.';
      notify('warning', 'تعذر نشر الإعلان', message);
      throw error;
    }
  };

  const saveCampaignDetailVideo = async (updated: Video) => {
    try {
      await apiPatch(`campaigns/${updated.id}`, { title: updated.title, link: updated.link, status: updated.status });
      await refreshData();
    } catch {
      notify('warning', 'تعذر حفظ التعديل', 'لم يحفظ الخادم التعديل. حاول مرة أخرى.');
    }
  };
  const saveCampaignDetailPlatform = async (updated: PromotionCampaign) => {
    try {
      await apiPatch(`campaigns/${updated.id}`, { title: updated.title, link: updated.link, status: updated.status });
      await refreshData();
    } catch {
      notify('warning', 'تعذر حفظ التعديل', 'لم يحفظ الخادم التعديل. حاول مرة أخرى.');
    }
  };
  const toggleCampaignDetailStatus = async () => {
    if (selectedCampaignDetail?.video) {
      const selected = selectedCampaignDetail.video;
      const next = { ...selected, status: selected.status === 'موقوف' ? 'نشط' as const : 'موقوف' as const };
      await saveCampaignDetailVideo(next);
      setSelectedCampaignDetail({ video: next });
    } else if (selectedCampaignDetail?.campaign) {
      const selected = selectedCampaignDetail.campaign;
      const next = { ...selected, status: selected.status === 'موقوف' ? (selected.platform === 'telegram' ? 'بانتظار تحقق البوت' as const : 'نشط' as const) : 'موقوف' as const };
      await saveCampaignDetailPlatform(next);
      setSelectedCampaignDetail({ campaign: next });
    }
  };
  const deleteCampaignDetail = async () => {
    const targetId = selectedCampaignDetail?.video?.id ?? selectedCampaignDetail?.campaign?.id;
    if (targetId === undefined) return;
    try {
      await apiDelete(`campaigns/${targetId}`);
      await refreshData();
      setSelectedCampaignDetail(null);
      setScreen('campaigns');
      notify('success', 'تم حذف الإعلان', 'تمت إزالة الإعلان من قائمتك.');
    } catch {
      notify('warning', 'تعذر حذف الإعلان', 'لم يحذف الخادم الإعلان. حاول مرة أخرى.');
    }
  };

  const addPromotionCampaign = async (campaign: PromotionCampaign) => {
    const platformName = campaign.platform === 'telegram' ? 'Telegram' : 'TikTok';
    try {
      const saved = await apiPost<{ id: string; status: PromotionCampaign['status'] }>('campaigns', {
        platform: campaign.platform,
        title: campaign.title,
        link: campaign.link,
        image: campaign.image,
        targetCount: campaign.targetCount,
        price: campaign.price,
      });
      await refreshData();
      setScreen('campaigns');
      const isLive = saved.status === 'نشط';
      notify(
        isLive ? 'success' : 'info',
        isLive ? `تم نشر إعلان ${platformName}` : `إعلان ${platformName} بانتظار إعداد البوت`,
        isLive
          ? `تمت إضافة إعلان ${platformName} إلى قائمة إعلاناتك بنجاح.`
          : `أُضيف إعلان ${platformName} إلى القائمة، ولن يظهر حتى يتم التحقق من صلاحيات البوت على القناة.`,
      );
    } catch {
      notify('warning', `تعذر نشر إعلان ${platformName}`, 'لم يحفظ الخادم الإعلان. تحقق من البيانات وحاول مرة أخرى.');
    }
  };

  const recordCampaignCompletion = async (campaignId: string) => {
    try {
      const result = await apiPost<{ reward: number }>(`tasks/${campaignId}/complete`);
      await refreshData();
      notify('success', 'تمت إضافة المكافأة', `أضيفت ${formatUsd(result.reward)} إلى رصيدك بعد التحقق من المهمة.`);
    } catch {
      notify('warning', 'تعذر احتساب المهمة', 'لم يؤكد الخادم اكتمال المهمة. تأكد من إتمامها ثم حاول مرة أخرى.');
    }
  };

  const submitTaskProof = async (campaignId: string, image: string) => {
    const userId = telegramUser?.id;
    if (taskProofs.some((proof) => proof.campaignId === campaignId && proof.userId === userId)) return;
    try {
      await apiPost(`tasks/${campaignId}/proof`, { image });
      await refreshData();
      notify('info', 'الإثبات قيد المراجعة', 'تم إرسال صورة الإثبات للمراجعة اليدوية.');
    } catch {
      notify('warning', 'تعذر إرسال الإثبات', 'لم يستلم الخادم الإثبات. حاول مرة أخرى.');
    }
  };

  const openTikTokTask = (campaign: PromotionCampaign) => {
    setSelectedTikTokTask(campaign);
    setScreen('tiktok-task');
  };

  const withdrawEarnings = async (record: WithdrawRecord) => {
    try {
      await apiPost<ApiHistoryRecordRow>('withdrawals', {
        amount: record.amount,
        method: record.method,
        destination: record.destination,
      });
      await refreshData();
      notify('success', 'تم إرسال طلب السحب', '');
    } catch {
      notify('warning', 'تعذر إرسال طلب السحب', 'لم يقبل الخادم الطلب. تحقق من الرصيد والوجهة وحاول مرة أخرى.');
    }
  };

  const requestDeposit = (record: DepositRecord) => {
    setDepositHistory((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    notify('info', 'تم إنشاء الفاتورة', `المعرّف الداخلي ${record.id} · Memo / Tag ${record.memoTag}`);
  };

  const completeDeposit = async (id: string) => {
    await refreshData();
    notify('info', 'تم استلام الدفع', `سيتم تحديث رصيد المعلن بعد تأكيد الإيداع ${id} من الخادم.`);
  };

  const expireDeposit = (id: string) => {
    setDepositHistory((current) => current.map((record) => record.id === id && record.status === 'قيد المعالجة' ? { ...record, status: 'تم الإلغاء' } : record));
    notify('warning', 'انتهت صلاحية الفاتورة', 'لم يصل تحويل مؤكد قبل انتهاء مدة الفاتورة.');
  };

  const creditViewer = async (video: Video) => {
    if (creditedVideosRef.current.has(video.id)) return;
    creditedVideosRef.current.add(video.id);
    try {
      const result = await apiPost<{ reward: number }>(`tasks/${video.id}/complete`);
      setCompletedVideoIds((current) => new Set(current).add(video.id));
      saveWatchSession(video, video.duration * 1000, 'completed');
      notify('success', 'تمت إضافة المكافأة', `أضيفت ${formatUsd(result.reward)} إلى رصيدك بعد إكمال المدة المطلوبة.`);
      void refreshData();
    } catch {
      creditedVideosRef.current.delete(video.id);
      notify('warning', 'تعذر احتساب المكافأة', 'لم يؤكد الخادم اكتمال المشاهدة. أكمل المدة كاملة ثم حاول مرة أخرى.');
    }
  };

  const creditAdReward = async (_amount: number, title: string, message: string) => {
    // المكافأة سُجّلت فعلًا على الخادم من صفحة الإعلانات (ads/reward/<provider>)؛ هنا نحدّث الرصيد فقط.
    await refreshData();
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

  const changeMode = (nextMode: 'creator' | 'viewer' | 'admin') => {
    if (nextMode === 'admin' && !adminEnabled) return;
    setMode(nextMode);
    setScreen(nextMode === 'creator' ? 'overview' : nextMode === 'admin' ? 'admin-overview' : 'watch');
    if (nextMode !== 'admin') onModeChange(nextMode);
  };

  const openAdvertiserCampaignForm = () => {
    setMode('creator');
    setScreen('add');
    onModeChange('creator');
  };

  if (banned) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#101a32] px-5 text-white">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.06] p-7 text-center shadow-2xl">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-400/15 text-3xl text-rose-300">⛔</span>
          <h1 className="mt-5 text-2xl font-extrabold">تم حظر حسابك</h1>
          <p className="mt-3 text-sm leading-6 text-blue-100/70">لا يمكنك استخدام المنصة حاليًا. تواصل مع الدعم إذا كنت تعتقد أن ذلك خطأ.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f7f9fc] text-[#12234b]">
      <div className={`flex min-h-[100dvh] ${browserEarningPage ? '' : 'lg:gap-5 lg:p-5'}`}>
        {!browserEarningPage && <Sidebar mode={mode} screen={screen} telegramUser={telegramUser} adminEnabled={adminEnabled} onModeChange={changeMode} onNavigate={setScreen} onAdd={openAdvertiserCampaignForm} open={mobileMenu} onClose={() => setMobileMenu(false)} />}
        {!browserEarningPage && mobileMenu && <Button type="button" aria-label="إغلاق خلفية القائمة" data-testid="button-close-menu-overlay" onClick={() => setMobileMenu(false)} variant="unstyled" size="fit" className="fixed inset-0 z-40 bg-[#061333]/30 backdrop-blur-sm lg:hidden" />}
        <div className={`min-w-0 flex-1 ${browserEarningPage ? '' : 'overflow-hidden rounded-none bg-[#f7f9fc] lg:rounded-[26px] lg:border lg:border-slate-200/80 lg:bg-[#fbfcfe]'}`}>
          {!browserEarningPage && <Header mode={mode} screen={screen} telegramUser={telegramUser} viewerBalance={viewerBalance} advertiserBalance={advertiserBalance} onMenu={() => setMobileMenu(true)} onAdd={openAdvertiserCampaignForm} />}
            {mode === 'admin' ? <AdminConsole activeScreen={screen} onPageChange={(page) => setScreen(`admin-${page}` as AppScreen)} />
             : screen === 'add' && mode === 'creator' ? <AddVideo telegramUser={telegramUser} onBack={() => setScreen('campaigns')} onPromotionSubmit={addPromotionCampaign} onSubmit={(video, requestId) => addVideo(video, requestId)} />
            : screen === 'deposit' && mode === 'creator' ? <DepositPage advertiserBalance={advertiserBalance} telegramUser={telegramUser} onDepositRequested={requestDeposit} onDepositCompleted={completeDeposit} onDepositExpired={expireDeposit} />
                : screen === 'deposit-history' && mode === 'creator' ? <DepositHistoryPage records={depositHistory} onDeposit={() => setScreen('deposit')} />
                : screen === 'withdraw' && mode === 'viewer' ? <WithdrawPage viewerBalance={viewerBalance} telegramUser={telegramUser} onWithdraw={withdrawEarnings} />
                  : screen === 'withdraw-history' && mode === 'viewer' ? <WithdrawHistoryPage records={withdrawHistory} onWithdraw={() => setScreen('withdraw')} />
             : screen === 'campaigns' && mode === 'creator' ? <CampaignsPage videos={videos} platformCampaigns={platformCampaigns} telegramUser={telegramUser} tab={tab} onTab={setTab} onAdd={() => setScreen('add')} onDetails={(item) => { setSelectedCampaignDetail(item); setScreen('campaign-detail'); }} />
               : screen === 'campaign-detail' && mode === 'creator' ? <CampaignDetailsPage video={selectedCampaignDetail?.video} campaign={selectedCampaignDetail?.campaign} onBack={() => setScreen('campaigns')} onSaveVideo={(video) => { saveCampaignDetailVideo(video); setSelectedCampaignDetail({ video }); }} onSaveCampaign={(campaign) => { saveCampaignDetailPlatform(campaign); setSelectedCampaignDetail({ campaign }); }} onDelete={deleteCampaignDetail} onToggle={toggleCampaignDetailStatus} />
                      : screen === 'telegram-tasks' && mode === 'viewer' ? <PlatformTasksPage platform="telegram" campaigns={taskCampaigns} proofs={taskProofs} onTaskCompleted={recordCampaignCompletion} onNotify={notify} telegramUserId={telegramUser?.id ?? null} />
                      : screen === 'tiktok-tasks' && mode === 'viewer' ? <PlatformTasksPage platform="tiktok" campaigns={taskCampaigns} proofs={taskProofs} onTaskCompleted={recordCampaignCompletion} onStartTask={openTikTokTask} onNotify={notify} telegramUserId={telegramUser?.id ?? null} />
                       : screen === 'tiktok-task' && mode === 'viewer' && selectedTikTokTask ? <TikTokTaskPage campaign={selectedTikTokTask} proof={taskProofs.find((item) => item.campaignId === selectedTikTokTask.id && item.userId === telegramUser?.id)} onSubmitProof={submitTaskProof} onBack={() => setScreen('tiktok-tasks')} />
                         : screen === 'ads' && mode === 'viewer' ? <AdsPage key={telegramUser?.id ?? 'guest'} userId={telegramUser?.id ?? null} onReward={creditAdReward} />
                 : screen === 'publish' && mode === 'viewer' ? <PublishingSystemPage telegramUser={telegramUser} />
                : screen === 'watch' && mode === 'viewer' ? <ViewerView videos={taskVideos} onSelect={selectVideo} insideTelegram={insideTelegram} onOpenBrowser={openWatchInBrowser} completedVideoIds={completedVideoIds} browserMode={browserEarningPage} />
                    : <CreatorOverview telegramUser={telegramUser} platformCampaigns={platformCampaigns} videos={videos} onAdd={() => setScreen('add')} onDeposit={() => setScreen('deposit')} />}
           {!browserEarningPage && mode !== 'admin' && <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">
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
