import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowDownLeft,
  ArrowUpLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clipboard,
  Clock3,
  Copy,
  DollarSign,
  Eye,
  ExternalLink,
  FileText,
  Film,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  WalletCards,
  X,
  PlaySquare,
  Info,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { LanguageProvider, useLanguage } from '@/i18n';

const queryClient = new QueryClient();

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { user?: TelegramUser };
  ready: () => void;
  expand: () => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openInvoice?: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function getTelegramUser(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

function getTelegramUserFromHash(): TelegramUser | null {
  try {
    const serializedUser = new URLSearchParams(window.location.hash.slice(1)).get('telegram');
    if (!serializedUser) return null;
    const parsed = JSON.parse(serializedUser) as Partial<TelegramUser>;
    const photoUrl = typeof parsed.photo_url === 'string' && /^https?:\/\//i.test(parsed.photo_url)
      ? parsed.photo_url
      : undefined;
    if (!Number.isSafeInteger(parsed.id) || Number(parsed.id) <= 0 || typeof parsed.first_name !== 'string') return null;
    return {
      id: Number(parsed.id),
      first_name: parsed.first_name.slice(0, 80),
      last_name: typeof parsed.last_name === 'string' ? parsed.last_name.slice(0, 80) : undefined,
      username: typeof parsed.username === 'string' ? parsed.username.replace(/^@/, '').slice(0, 64) : undefined,
      photo_url: photoUrl,
    };
  } catch {
    return null;
  }
}

function getShortName(name?: string) {
  return Array.from((name ?? '').trim()).slice(0, 5).join('') || 'زائر';
}

function getUserDisplayName(user: TelegramUser | null, fallback = 'محمد العتيبي') {
  if (user?.username) return `@${user.username.replace(/^@/, '')}`;
  if (user) return [user.first_name, user.last_name].filter(Boolean).join(' ');
  return fallback;
}

function getGreetingName(user: TelegramUser | null, fallback = 'محمد') {
  return Array.from((user?.first_name?.trim() || fallback)).slice(0, 5).join('');
}

function getCompletedVideoIds() {
  const completedIds = new Set<number>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith('vidreward.watch.')) continue;
      const session = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Partial<AdvertisementSession> | null;
      if (session?.credited && Number.isSafeInteger(session.videoId)) completedIds.add(Number(session.videoId));
    }
  } catch {
    // Local storage may be unavailable or contain an invalid session.
  }
  return completedIds;
}

function UserAvatar({ user, className = '' }: { user: TelegramUser | null; className?: string }) {
  const initials = getShortName(user?.first_name).slice(0, 1);
  return (
    <div
      className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0e2452] text-xs font-bold text-white ring-2 ring-white ${className}`}
      title={user ? `${user.first_name} · Telegram ID: ${user.id}` : 'حساب المستخدم'}
      aria-label={user ? `حساب ${user.first_name}` : 'حساب المستخدم'}
    >
      {user?.photo_url ? (
        <img src={user.photo_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : initials}
    </div>
  );
}

type Video = {
  id: number;
  title: string;
  creator: string;
  views: string;
  reward: string;
  cpm: number;
  duration: number;
  status: 'نشط' | 'مسودة' | 'مكتمل';
  created: string;
  art: string;
  link: string;
};

type PromotionPlatform = 'telegram' | 'tiktok';
type PromotionCampaign = {
  id: string;
  platform: PromotionPlatform;
  title: string;
  link: string;
  image?: string;
  targetCount: number;
  price: number;
  status: 'نشط' | 'بانتظار تحقق البوت';
  created: string;
};
type TaskProof = {
  campaignId: string;
  image: string;
  status: 'قيد المراجعة';
  submittedAt: string;
};

const promotionCampaignsStorageKey = 'vidreward.promotion-campaigns.v1';
const taskProofsStorageKey = 'vidreward.task-proofs.v1';
const telegramPackageOptions = [
  { count: 100, price: 0.7 },
  { count: 300, price: 1.9 },
  { count: 500, price: 2.6 },
  { count: 700, price: 3 },
];
const tiktokPackageOptions = [
  { count: 100, price: 2 },
  { count: 200, price: 3.9 },
  { count: 350, price: 5.5 },
  { count: 500, price: 7 },
];

function readLocalState<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function formatDuration(seconds: number) {
  return `${seconds}s`;
}

const durationOptions = [
  { seconds: 10, cpm: '1.5', label: formatDuration(10) },
  { seconds: 20, cpm: '2', label: formatDuration(20) },
  { seconds: 40, cpm: '2.8', label: formatDuration(40) },
  { seconds: 80, cpm: '3.2', label: formatDuration(80) },
];

type TransactionStatus = 'تم' | 'قيد المعالجة' | 'تم الإلغاء' | 'مرفوض';
type PaymentMethod = 'stars' | 'binance' | 'web3';
type DepositMethod = 'stars' | 'web3';
type WithdrawMethod = 'binance' | 'web3';
type AppScreen = 'overview' | 'campaigns' | 'watch' | 'publish' | 'add' | 'deposit' | 'withdraw' | 'deposit-history' | 'withdraw-history' | 'telegram-tasks' | 'tiktok-tasks';

type DepositRecord = {
  id: string;
  amount: number;
  method: DepositMethod;
  destination: string;
  memoTag: string;
  blockchainTxId?: string;
  createdAt: string;
  status: TransactionStatus;
};

type WithdrawRecord = {
  id: string;
  amount: number;
  method: WithdrawMethod;
  destination: string;
  memoTag: string;
  blockchainTxId?: string;
  createdAt: string;
  status: TransactionStatus;
};

type AdvertisementSessionStatus = 'active' | 'paused' | 'completed';

type AdvertisementSession = {
  id: string;
  videoId: number;
  elapsedMs: number;
  requiredMs: number;
  status: AdvertisementSessionStatus;
  lastStartedAt?: number;
  lastStoppedAt?: number;
  credited: boolean;
};

function calculateViewerReward(cpm: number) {
  return cpm / 1000 * 0.2;
}

function formatUsd(amount: number) {
  return `$${amount.toFixed(4)}`;
}

const initialVideos: Video[] = [
  {
    id: 1,
    title: 'كيف صنعت أول منتج رقمي لي؟',
    creator: 'سارة العتيبي',
    views: '12,480',
    reward: formatUsd(calculateViewerReward(2.8)),
    cpm: 2.8,
    duration: 40,
    status: 'نشط',
    created: 'منذ يومين',
    art: 'media-art',
    link: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  },
  {
    id: 2,
    title: 'جولة صباحية في استوديو التصميم',
    creator: 'محمود ناصر',
    views: '8,920',
    reward: formatUsd(calculateViewerReward(2)),
    cpm: 2,
    duration: 20,
    status: 'نشط',
    created: 'منذ 4 أيام',
    art: 'media-art-alt',
    link: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    id: 3,
    title: 'ثلاث أفكار لتطوير عاداتك',
    creator: 'نوف الحربي',
    views: '6,184',
    reward: formatUsd(calculateViewerReward(1.5)),
    cpm: 1.5,
    duration: 10,
    status: 'نشط',
    created: 'منذ أسبوع',
    art: 'media-art-dark',
    link: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
  },
  {
    id: 4,
    title: 'دليل المبتدئين إلى التصوير بالهاتف',
    creator: 'ستوديو عدسة',
    views: '—',
    reward: formatUsd(calculateViewerReward(3.2)),
    cpm: 3.2,
    duration: 80,
    status: 'مسودة',
    created: 'منذ 9 أيام',
    art: 'media-art-alt',
    link: '',
  },
];

function getEmbedUrl(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}?rel=0`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : url;
    }
    return url;
  } catch {
    return '';
  }
}

function getYoutubeVideoId(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') ?? '';
  } catch {
    return '';
  }
  return '';
}

function getVideoThumbnail(url: string) {
  const videoId = getYoutubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

function createBrowserWatchUrl(user: TelegramUser | null) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = new URL(`${basePath}/`, window.location.origin);
  url.searchParams.set('view', 'earn');
  if (user) {
    // The fragment is not sent to the web server; it carries display-only profile context.
    url.hash = new URLSearchParams({
      telegram: JSON.stringify({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url,
      }),
    }).toString();
  }
  return url.toString();
}

function IconButton({
  label,
  children,
  onClick,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      aria-label={label}
      data-testid={`button-${label}`}
      onClick={onClick}
      variant="icon"
      size="icon"
      className={`grid place-items-center rounded-xl ${className}`}
    >
      {children}
    </Button>
  );
}

function BrandMark() {
  const { dir } = useLanguage();
  return (
    <div className="flex items-center gap-3" dir={dir}>
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-[#1557ee] shadow-[0_8px_20px_rgba(21,87,238,.24)]">
        <img src="/assets/vidreward-mark.png" alt="VidReward" className="h-full w-full object-contain" />
      </div>
      <div className="leading-none">
        <div className="font-display text-[17px] font-bold tracking-tight text-[#0f1f46]">VidReward</div>
        <div className="mt-1 text-[9px] font-semibold tracking-[.18em] text-slate-400">WATCH · EARN · GROW</div>
      </div>
    </div>
  );
}

type WalletArtworkMethod = PaymentMethod | 'balance';

const walletArtwork: Record<WalletArtworkMethod, { src: string; alt: string }> = {
  stars: { src: '/assets/stars-wallet.png', alt: 'Stars wallet' },
  web3: { src: '/assets/web3-wallet.png', alt: 'محفظة Web3' },
  binance: { src: '/assets/binance-wallet.png', alt: 'محفظة Binance' },
  balance: { src: '/assets/dollar-balance.png', alt: 'رصيد بالدولار' },
};

function WalletArtwork({
  method,
  size = 'sm',
  className = '',
}: {
  method: WalletArtworkMethod;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-7 w-7',
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  };
  return (
    <img
      src={walletArtwork[method].src}
      alt={walletArtwork[method].alt}
      className={`wallet-artwork shrink-0 ${sizes[size]} ${className}`}
      data-testid={`img-wallet-${method}`}
    />
  );
}

function PaymentMethodBadge({ method, compact = false }: { method: PaymentMethod; compact?: boolean }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 font-bold ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      <WalletArtwork method={method} size="xs" />
      <span className="truncate">{t(methodLabel(method))}</span>
    </span>
  );
}

function Sidebar({
  mode,
  screen,
  telegramUser,
  onModeChange,
  onNavigate,
  onAdd,
  onClose,
  open,
}: {
  mode: 'creator' | 'viewer';
  screen: AppScreen;
  telegramUser: TelegramUser | null;
  onModeChange: (mode: 'creator' | 'viewer') => void;
  onNavigate: (screen: AppScreen) => void;
  onAdd: () => void;
  onClose?: () => void;
  open?: boolean;
}) {
  const { dir } = useLanguage();
  const navItems = mode === 'creator'
    ? [
        { icon: BarChart3, label: 'نظرة عامة', screen: 'overview' as AppScreen },
        { icon: Film, label: 'إعلاناتي', screen: 'campaigns' as AppScreen },
        { icon: WalletCards, label: 'إيداع رصيد', screen: 'deposit' as AppScreen },
        { icon: History, label: 'سجل الإيداع', screen: 'deposit-history' as AppScreen },
      ]
    : [
        { icon: Eye, label: 'شاهد واربح', screen: 'watch' as AppScreen },
        { icon: Users, label: 'مهام Telegram', screen: 'telegram-tasks' as AppScreen },
        { icon: Target, label: 'مهام TikTok', screen: 'tiktok-tasks' as AppScreen },
        { icon: Share2, label: 'نظام النشر', screen: 'publish' as AppScreen },
        { icon: WalletCards, label: 'سحب الأرباح', screen: 'withdraw' as AppScreen },
        { icon: History, label: 'سجل السحب', screen: 'withdraw-history' as AppScreen },
      ];

  return (
    <aside
      className={`${open ? 'translate-x-0' : 'translate-x-full'} fixed inset-y-0 right-0 z-50 flex min-h-0 w-[236px] flex-col overflow-y-auto overscroll-contain border-l border-slate-200 bg-white p-4 shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:w-[224px] lg:translate-x-0 lg:rounded-l-[28px] lg:border lg:shadow-none`}
      dir={dir}
    >
      <div className="flex items-center justify-between lg:block">
        <BrandMark />
        <IconButton label="إغلاق القائمة" onClick={onClose} className="lg:hidden">
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="mt-10 rounded-[18px] border border-blue-100 bg-[#f4f8ff] p-1.5">
        <Button
          type="button"
          data-testid="button-switch-creator"
          onClick={() => { onModeChange('creator'); onClose?.(); }}
          variant="unstyled"
          size="fit"
          className={`flex w-full items-center gap-3 rounded-[13px] px-3 py-3 text-right text-sm font-semibold transition ${mode === 'creator' ? 'bg-white text-[#1557ee] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <LayoutDashboard className="h-[18px] w-[18px]" />
          <span>نشر إعلان</span>
          {mode === 'creator' && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[#1557ee]" />}
        </Button>
        <Button
          type="button"
          data-testid="button-switch-viewer"
          onClick={() => { onModeChange('viewer'); onClose?.(); }}
          variant="unstyled"
          size="fit"
          className={`flex w-full items-center gap-3 rounded-[13px] px-3 py-3 text-right text-sm font-semibold transition ${mode === 'viewer' ? 'bg-white text-[#1557ee] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Eye className="h-[18px] w-[18px]" />
          <span>اربح</span>
          {mode === 'viewer' && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[#1557ee]" />}
        </Button>
      </div>
      <div className="mt-8">
        <div className="mb-3 px-3 text-[10px] font-bold tracking-[.16em] text-slate-400">{mode === 'creator' ? 'إدارة الإعلانات' : 'مساحة الربح'}</div>
        <nav className="space-y-1 pb-4">
          {navItems.map(({ icon: NavIcon, label, screen: itemScreen }, index) => (
            <Button
              type="button"
              key={label}
              data-testid={`button-side-${index}`}
              onClick={() => { onNavigate(itemScreen); onClose?.(); }}
              variant="unstyled"
              size="fit"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-medium transition ${screen === itemScreen ? 'bg-[#edf3ff] font-bold text-[#1557ee]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <NavIcon className="h-[17px] w-[17px]" />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
      </div>
      <div className="mt-auto">
        <div className="mb-4 rounded-2xl bg-[#0e2452] p-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Sparkles className="h-4 w-4 text-cyan-300" /></span>
            <span className="text-[10px] font-semibold text-blue-200">ميزة جديدة</span>
          </div>
          <p className="text-sm font-bold">{mode === 'creator' ? 'موّل إعلانك بسهولة' : 'ابدأ بجمع أرباحك'}</p>
          <p className="mt-1 text-[11px] leading-5 text-blue-100/65">{mode === 'creator' ? 'أضف إعلاناً جديداً وحدد ميزانيته.' : 'أكمل المشاهدة وأضف الأرباح إلى رصيدك.'}</p>
           <Button type="button" data-testid="button-sidebar-add" onClick={() => mode === 'creator' ? onAdd() : onNavigate('watch')} variant="unstyled" size="fit" className="mt-4 flex items-center gap-1 text-xs font-bold text-cyan-300">
             {mode === 'creator' ? 'أضف إعلان الآن' : 'اذهب إلى المشاهدة'} <ArrowUpLeft className="h-3.5 w-3.5" />
           </Button>
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <UserAvatar user={telegramUser} className="bg-[#dbe8ff] text-[#1557ee] ring-0" />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-slate-800">{telegramUser ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') : 'محمد العتيبي'}</div>
            <div className="mt-0.5 truncate text-[10px] text-slate-400">{telegramUser ? `Telegram ID: ${telegramUser.id}` : 'حساب منشئ'}</div>
          </div>
          <Settings2 className="mr-auto h-4 w-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

type ToastTone = 'success' | 'info' | 'warning';

type ToastMessage = {
  id: number;
  tone: ToastTone;
  title: string;
  message: string;
};

function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  const { dir } = useLanguage();
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[90] flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:items-end" dir={dir} aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} data-testid={`toast-${toast.id}`} className="pointer-events-auto flex w-full max-w-[390px] items-start gap-3 rounded-2xl border border-white/10 bg-[#0e2452] p-4 text-right text-white shadow-[0_16px_40px_rgba(14,36,82,.28)] backdrop-blur-md animate-rise">
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toast.tone === 'success' ? 'bg-emerald-400/15 text-emerald-300' : toast.tone === 'warning' ? 'bg-amber-300/15 text-amber-300' : 'bg-cyan-300/15 text-cyan-200'}`}>
            {toast.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : toast.tone === 'warning' ? <Timer className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white">{toast.title}</div>
            <div className="mt-1 text-[11px] leading-5 text-blue-100/75">{toast.message}</div>
          </div>
           <Button type="button" data-testid={`button-dismiss-toast-${toast.id}`} onClick={() => onDismiss(toast.id)} variant="ghost" size="icon" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-blue-100/60 transition hover:bg-white/10 hover:text-white" aria-label="إغلاق التنبيه">
            <X className="h-3.5 w-3.5" />
           </Button>
        </div>
      ))}
    </div>
  );
}

function Header({
  mode,
  screen,
  telegramUser,
  onMenu,
  onAdd,
}: {
  mode: 'creator' | 'viewer';
  screen: AppScreen;
  telegramUser: TelegramUser | null;
  onMenu: () => void;
  onAdd: () => void;
}) {
  const pageTitle = screen === 'deposit'
    ? 'إيداع رصيد'
    : screen === 'withdraw'
      ? 'سحب الأرباح'
      : screen === 'deposit-history'
        ? 'سجل الإيداع'
        : screen === 'withdraw-history'
          ? 'سجل السحب'
      : screen === 'add'
        ? 'إعلان جديد'
        : screen === 'campaigns'
          ? 'إعلاناتي'
          : screen === 'watch'
            ? 'شاهد واربح'
              : screen === 'telegram-tasks'
                ? 'مهام Telegram'
                : screen === 'tiktok-tasks'
                  ? 'مهام TikTok'
        : screen === 'publish'
          ? 'نظام النشر'
            : mode === 'creator' ? 'نظرة عامة' : 'شاهد واربح';

  return (
    <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur md:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        <IconButton label="فتح القائمة" onClick={onMenu} className="lg:hidden">
          <Menu className="h-5 w-5" />
        </IconButton>
        <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
          <span>الرئيسية</span>
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-700">{pageTitle}</span>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {mode === 'creator' && (
          <Button type="button" data-testid="button-header-add" onClick={onAdd} variant="primary" size="sm" className="hidden items-center gap-2 text-xs font-bold sm:flex">
            <Plus className="h-4 w-4" /> إضافة إعلان
          </Button>
        )}
        <div className="hidden h-9 w-px bg-slate-200 sm:block" />
        <UserAvatar user={telegramUser} />
      </div>
    </header>
  );
}

function StatCard({
  icon: StatIcon,
  label,
  value,
  change,
  tone,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  change: string;
  tone: 'blue' | 'cyan' | 'navy' | 'sand';
}) {
  const tones = {
    blue: 'bg-[#eff4ff] text-[#1557ee]',
    cyan: 'bg-[#e9fbfc] text-[#0796a5]',
    navy: 'bg-[#eef1f8] text-[#253961]',
    sand: 'bg-[#fff6e8] text-[#c98017]',
  };
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><StatIcon className="h-[19px] w-[19px]" /></div>
        <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#13a18c]"><ArrowUpLeft className="h-3 w-3" /> {change}</span>
      </div>
      <div className="mt-5 text-[12px] font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-[25px] font-bold tracking-tight text-[#12234b]">{value}</div>
    </div>
  );
}

function VideoArtwork({ video, compact = false }: { video: Video; compact?: boolean }) {
  const thumbnail = getVideoThumbnail(video.link);

  return (
    <div className={`relative aspect-video overflow-hidden ${compact ? 'w-full rounded-xl' : 'mr-1 mt-1 w-[calc(100%-0.25rem)] rounded-[20px]'} ${thumbnail ? 'bg-slate-900' : video.art}`}>
      {thumbnail ? (
        <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(120deg,transparent_25%,white_25%,white_27%,transparent_27%,transparent_62%,white_62%,white_64%,transparent_64%)]" />
      )}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="absolute h-[45px] w-[45px] rounded-full border border-white/25" />
        <span className="relative z-10 grid h-[34px] w-[34px] place-items-center rounded-full border border-white/50 bg-white/20 text-white backdrop-blur-md">
          <Play className="mr-[-1px] h-4 w-4 fill-current" />
        </span>
      </div>
    </div>
  );
}

function WatchPanel({
  video,
  progress,
  isPlaying,
  completed,
  session,
  onOpenVideo,
  onComplete,
  onClose,
}: {
  video: Video;
  progress: number;
  isPlaying: boolean;
  completed: boolean;
  session: AdvertisementSession | null;
  onOpenVideo: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const { dir } = useLanguage();
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(Boolean(session?.credited));
  const percent = Math.min(100, (progress / video.duration) * 100);

  const openVideo = () => {
    onOpenVideo();
    window.open(video.link, '_blank', 'noopener,noreferrer');
    setHasOpenedVideo(true);
  };

  return (
    <div className="watch-modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-[#061333]/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" dir={dir}>
      <div className="watch-modal-card max-h-[94vh] w-full max-w-[920px] overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1557ee]"><Sparkles className="h-4 w-4" /> جلسة مشاهدة موثقة</div>
          </div>
          <IconButton label="إغلاق المشاهدة" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="grid md:grid-cols-[1.1fr_.9fr]">
          <div className="p-4 md:p-7">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#0e2452]">
              <div className={`h-full w-full ${video.art} flex flex-col items-center justify-center px-6 text-center text-white`}>
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-sm"><PlaySquare className="h-7 w-7" /></div>
                <div className="mt-4 text-sm font-bold">الفيديو جاهز للمشاهدة</div>
                <p className="mt-1 max-w-[260px] text-[11px] leading-5 text-white/70">افتح الفيديو على YouTube ثم عد إلى هنا لإكمال التحقق.</p>
                <Button type="button" data-testid="button-open-youtube" onClick={openVideo} variant="secondary" size="sm" className="mt-4 flex items-center gap-2 bg-white text-xs font-bold text-[#12234b]">
                  <ExternalLink className="h-3.5 w-3.5" /> فتح الفيديو على YouTube
                </Button>
              </div>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-bold leading-7 text-[#12234b]">{video.title}</h2><p className="mt-1 text-xs text-slate-400">{video.creator}</p></div>
              <span className="shrink-0 rounded-lg bg-[#eafbf8] px-2.5 py-2 text-sm font-bold text-[#159b89]">+ {video.reward}</span>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-[10px] text-slate-400"><span>تقدم المشاهدة</span><span>{progress} / {formatDuration(video.duration)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1557ee] transition-all duration-500" style={{ width: `${percent}%` }} /></div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-[#fbfcff] p-5 md:border-r md:border-t-0 md:p-7">
            {rewardClaimed || session?.credited ? (
              <div className="flex h-full min-h-[270px] flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[#eafbf8] text-[#159b89]"><Check className="h-8 w-8" /></div>
                <h3 className="mt-5 text-xl font-bold text-[#12234b]">أحسنت، تمت المشاهدة</h3>
                <p className="mt-2 max-w-[230px] text-xs leading-6 text-slate-400">أضيفت الأرباح إلى رصيدك بنجاح.</p>
                <div className="mt-5 rounded-xl bg-white px-7 py-3 text-lg font-bold text-[#159b89] shadow-sm">+ {video.reward}</div>
                <Button type="button" data-testid="button-close-complete" onClick={onClose} variant="ghost" size="fit" className="mt-5 text-xs font-bold text-[#1557ee]">مشاهدة فيديو آخر</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-[#12234b]">أكمل المدة المطلوبة</span><Clock3 className="h-4 w-4 text-[#1557ee]" /></div>
                <div className="mt-5 rounded-2xl border border-blue-100 bg-[#eff4ff] p-4">
                  <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1557ee]"><Clock3 className="h-5 w-5" /></div><div><div className="text-[11px] text-slate-500">المدة المطلوبة</div><div className="mt-0.5 text-xl font-bold text-[#12234b]">{formatDuration(video.duration)}</div></div></div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-500">سيتم احتساب المكافأة بعد إكمال المشاهدة دون تخطي.</p>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-xs"><span className="text-slate-500">المكافأة المتوقعة</span><span className="font-bold text-[#159b89]">+ {video.reward}</span></div>
                   <div className="flex items-center justify-between text-xs"><span className="text-slate-500">حالة المشاهدة</span><span className={`font-bold ${isPlaying ? 'text-[#1557ee]' : completed ? 'text-[#159b89]' : hasOpenedVideo ? 'text-amber-600' : 'text-slate-400'}`}>{isPlaying ? 'الفيديو مفتوح — الوقت يُحتسب' : completed ? 'اكتملت المدة — جاهز للتحقق' : hasOpenedVideo ? 'المدة غير مكتملة' : 'افتح الفيديو أولاً'}</span></div>
                </div>
                 {!completed && hasOpenedVideo && !isPlaying && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] leading-5 text-amber-700">لم تكتمل المدة بعد. ارجع إلى الفيديو وأكمل الوقت المطلوب؛ لن تُصرف المكافأة قبل إكماله.</div>}
                <Button type="button" data-testid="button-start-watch" onClick={() => { if (completed && !isPlaying) { onComplete(); setRewardClaimed(true); } }} disabled={isPlaying || !hasOpenedVideo || !completed} variant="primary" size="lg" className="mt-7 flex w-full items-center justify-center gap-2 text-sm font-bold">
                  <Check className="h-4 w-4" /> {completed ? 'تحقق واستلم المكافأة' : 'تحقق بعد إكمال مدة المشاهدة'}
                </Button>
                <div className="mt-5 flex items-center gap-2 text-[10px] leading-5 text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-[#159b89]" /> يُحتسب الوقت أثناء وجود التطبيق بالخلفية، وتُصرف المكافأة بعد العودة والتحقق.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformSelector({
  selected,
  onSelect,
}: {
  selected: 'youtube' | PromotionPlatform;
  onSelect: (platform: 'youtube' | PromotionPlatform) => void;
}) {
  const options = [
    { value: 'youtube' as const, label: 'YouTube' },
    { value: 'telegram' as const, label: 'Telegram' },
    { value: 'tiktok' as const, label: 'TikTok' },
  ];
  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="اختيار منصة الإعلان" data-testid="platform-selector">
      {options.map((option) => (
        <Button
          type="button"
          key={option.value}
          data-testid={`button-platform-${option.value}`}
          onClick={() => onSelect(option.value)}
          variant="unstyled"
          size="fit"
          aria-pressed={selected === option.value}
          className={`flex min-w-0 items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-bold transition sm:gap-2 sm:px-4 ${selected === option.value ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee] shadow-[0_0_0_2px_rgba(21,87,238,.08)]' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-[#1557ee]'}`}
        >
          {selected === option.value && <Check className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{option.label}</span>
        </Button>
      ))}
    </div>
  );
}

const depositAddress = '0x71B4f6eA8D9c3A17F48E6b5D2A0C9e12B7F1a4C8';
const depositBinanceId = '782946315';
const invoiceLifetime = 15 * 60;
const demoUserId = '62182212';
const memoSequenceStorageKey = 'vidreward.memo-sequence';
const generatedIdentifiers = new Set<string>();
let nextMemoSequence = 3;

function createUniqueIdentifier(prefix: string, size = 10) {
  let identifier = '';
  do {
    const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, size).toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(-size).toUpperCase();
    identifier = `${prefix}-${Date.now().toString(36).slice(-6).toUpperCase()}-${randomPart}`;
  } while (generatedIdentifiers.has(identifier));
  generatedIdentifiers.add(identifier);
  return identifier;
}

function createMemoTag(telegramUserId?: number) {
  let sequence = nextMemoSequence;
  try {
    const storedSequence = Number(window.localStorage.getItem(memoSequenceStorageKey));
    if (Number.isFinite(storedSequence)) sequence = Math.max(sequence, storedSequence);
    window.localStorage.setItem(memoSequenceStorageKey, String(sequence + 1));
  } catch {
    // Local storage may be unavailable in a restricted browser context.
  }
  nextMemoSequence = sequence + 1;
  return `${telegramUserId ?? demoUserId}#${sequence}`;
}

function createBlockchainTxId() {
  const entropy = createUniqueIdentifier('TX', 20).replace('TX-', '').toLowerCase();
  return `0x${entropy.padEnd(64, '0').slice(0, 64)}`;
}

function formatHistoryDate(date = new Date(), language: 'ar' | 'en' = 'ar') {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-TN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function methodLabel(method: PaymentMethod) {
  if (method === 'stars') return 'Stars';
  return method === 'binance' ? 'Binance ID' : 'محفظة Web3';
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const { t } = useLanguage();
  const styles = {
    'تم': 'bg-[#eafbf8] text-[#159b89]',
    'قيد المعالجة': 'bg-amber-50 text-amber-700',
    'تم الإلغاء': 'bg-slate-100 text-slate-500',
    'مرفوض': 'bg-rose-50 text-rose-600',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{t(status)}</span>;
}

function CopyableIdentifier({ label, value, tone = 'text-[#12234b]' }: { label: string; value: string; tone?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be unavailable in an embedded preview.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold text-slate-400">{label}</div>
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <code dir="ltr" className={`min-w-0 flex-1 truncate text-[10px] font-bold ${tone}`} title={value}>{value}</code>
        <Button type="button" onClick={copy} variant="ghost" size="icon" className="copy-action grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:text-[#1557ee]" aria-label={`نسخ ${label}`}>
          {copied ? <Check className="h-3 w-3 text-[#159b89]" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

function TransactionIdentifiers({ record }: { record: DepositRecord | WithdrawRecord }) {
  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-[#fbfcff] p-3 sm:grid-cols-3">
      <CopyableIdentifier label="المعرّف الداخلي" value={record.id} />
      <CopyableIdentifier label="TXID الشبكة" value={record.blockchainTxId ?? 'سيظهر بعد التأكيد'} tone="text-[#1557ee]" />
      <CopyableIdentifier label="Memo / Tag" value={record.memoTag} tone="text-[#159b89]" />
    </div>
  );
}

function CompactInvoiceValue({
  label,
  value,
  tone = 'text-[#12234b]',
  action,
}: {
  label: string;
  value: string;
  tone?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-[60px] min-w-0 items-center gap-3 rounded-[16px] border border-slate-100 bg-[#fbfcff] px-3.5 transition hover:border-blue-100 hover:bg-[#f7faff]">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[9px] font-bold tracking-wide text-slate-400">{label}</div>
        <code dir="ltr" className={`mt-1 block truncate text-[11px] font-bold ${tone}`} title={value}>{value}</code>
      </div>
      {action}
    </div>
  );
}

function HistoryStat({
  label,
  value,
  tone = 'text-[#12234b]',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex h-[60px] items-center justify-between rounded-[16px] border border-slate-200 bg-white px-4 shadow-[var(--shadow-soft)]">
      <span className="text-[10px] font-semibold text-slate-400">{label}</span>
      <strong className={`text-lg font-bold tracking-tight ${tone}`}>{value}</strong>
    </div>
  );
}

function CompactCopyableIdentifier({
  label,
  value,
  tone = 'text-[#12234b]',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be unavailable in an embedded preview.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-w-0">
      <div className="truncate text-[9px] font-semibold text-slate-400">{label}</div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <code dir="ltr" className={`min-w-0 flex-1 truncate text-[10px] font-bold ${tone}`} title={value}>{value}</code>
        <Button type="button" onClick={copy} variant="ghost" size="icon" className="copy-action grid h-5 w-5 shrink-0 place-items-center rounded-md text-slate-400 transition hover:text-[#1557ee]" aria-label={`نسخ ${label}`}>
          {copied ? <Check className="h-2.5 w-2.5 text-[#159b89]" /> : <Copy className="h-2.5 w-2.5" />}
        </Button>
      </div>
    </div>
  );
}

function CompactHistoryRow({
  record,
  kind,
}: {
  record: DepositRecord | WithdrawRecord;
  kind: 'deposit' | 'withdraw';
}) {
  const isDeposit = kind === 'deposit';
  const amount = isDeposit ? record.amount.toFixed(2) : record.amount.toFixed(4);
  const iconTone = isDeposit ? 'bg-[#edf3ff] text-[#1557ee]' : 'bg-[#eafbf8] text-[#159b89]';

  return (
    <div data-testid={`row-${kind}-${record.id}`} className="overflow-x-hidden border-t border-slate-100 first:border-t-0 md:overflow-x-auto">
      <div className="hidden h-[60px] min-w-[1180px] grid-cols-[1.25fr_.9fr_.8fr_1.15fr_1.1fr_1.2fr_auto_1.5fr] items-center gap-4 px-5 transition hover:bg-[#fbfcff] md:grid md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${iconTone}`}>
            {isDeposit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpLeft className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold text-[#12234b]">{isDeposit ? 'إيداع' : 'سحب'} {amount} USDT</div>
            <div className="mt-0.5 truncate text-[9px] text-slate-400">{record.createdAt}</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-semibold text-slate-400">الطريقة</div>
          <div className="mt-0.5 min-w-0 truncate text-[10px] font-bold text-slate-600"><PaymentMethodBadge method={record.method} compact /></div>
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-semibold text-slate-400">نوع Memo</div>
          <div className="mt-0.5 truncate text-[10px] font-bold text-slate-600">Memo / Tag</div>
        </div>
        <CompactCopyableIdentifier label="Memo / Tag" value={record.memoTag} tone="text-[#159b89]" />
        <CompactCopyableIdentifier label="رقم العملية" value={record.id} tone="text-[#1557ee]" />
        <div className="min-w-0">
          <div className="truncate text-[9px] font-semibold text-slate-400">{record.method === 'binance' ? 'الوجهة · Binance ID' : 'الوجهة'}</div>
          <code dir="ltr" className="mt-0.5 block truncate text-[10px] font-bold text-slate-600" title={record.destination}>{record.destination}</code>
        </div>
        <StatusBadge status={record.status} />
        <CompactCopyableIdentifier label="TXID الشبكة" value={record.blockchainTxId ?? 'بعد التأكيد'} tone="text-[#253961]" />
      </div>
      <div className="grid gap-3 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${iconTone}`}>
              {isDeposit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpLeft className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-bold text-[#12234b]">{isDeposit ? 'إيداع' : 'سحب'} {amount} USDT</div>
              <div className="mt-0.5 truncate text-[9px] text-slate-400">{record.createdAt}</div>
            </div>
          </div>
          <StatusBadge status={record.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[14px] bg-[#fbfcff] px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[9px] font-semibold text-slate-400">الطريقة</div>
            <div className="mt-0.5 min-w-0 truncate text-[10px] font-bold text-slate-600"><PaymentMethodBadge method={record.method} compact /></div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[9px] font-semibold text-slate-400">{record.method === 'binance' ? 'الوجهة · Binance ID' : 'الوجهة'}</div>
            <code dir="ltr" className="mt-0.5 block truncate text-[10px] font-bold text-slate-600" title={record.destination}>{record.destination}</code>
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-semibold text-slate-400">نوع Memo</div>
            <div className="mt-0.5 truncate text-[10px] font-bold text-slate-600">Memo / Tag</div>
          </div>
          <CompactCopyableIdentifier label="Memo / Tag" value={record.memoTag} tone="text-[#159b89]" />
          <CompactCopyableIdentifier label="رقم العملية" value={record.id} tone="text-[#1557ee]" />
          <CompactCopyableIdentifier label="TXID الشبكة" value={record.blockchainTxId ?? 'بعد التأكيد'} tone="text-[#253961]" />
        </div>
      </div>
    </div>
  );
}

export type {
  TelegramUser,
  Video,
  PromotionPlatform,
  PromotionCampaign,
  TaskProof,
  TransactionStatus,
  PaymentMethod,
  DepositMethod,
  WithdrawMethod,
  AppScreen,
  DepositRecord,
  WithdrawRecord,
  AdvertisementSessionStatus,
  AdvertisementSession,
  ToastTone,
  ToastMessage,
};

export {
  getTelegramUser,
  getTelegramUserFromHash,
  getUserDisplayName,
  getGreetingName,
  getCompletedVideoIds,
  readLocalState,
  formatDuration,
  calculateViewerReward,
  formatUsd,
  getEmbedUrl,
  getYoutubeVideoId,
  getVideoThumbnail,
  createBrowserWatchUrl,
  createUniqueIdentifier,
  createMemoTag,
  createBlockchainTxId,
  formatHistoryDate,
  formatRemaining,
  methodLabel,
  UserAvatar,
  IconButton,
  BrandMark,
  WalletArtwork,
  PaymentMethodBadge,
  Sidebar,
  ToastViewport,
  Header,
  StatCard,
  VideoArtwork,
  WatchPanel,
  PlatformSelector,
  StatusBadge,
  CopyableIdentifier,
  TransactionIdentifiers,
  CompactInvoiceValue,
  HistoryStat,
  CompactCopyableIdentifier,
  CompactHistoryRow,
  promotionCampaignsStorageKey,
  taskProofsStorageKey,
  telegramPackageOptions,
  tiktokPackageOptions,
  durationOptions,
  initialVideos,
  depositAddress,
  depositBinanceId,
  invoiceLifetime,
  demoUserId,
  memoSequenceStorageKey,
};
