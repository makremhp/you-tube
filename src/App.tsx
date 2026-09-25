import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
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
  LayoutDashboard,
  Link2,
  Loader2,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  WalletCards,
  X,
  PlaySquare,
  Info,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

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
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function getTelegramUser(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

function getShortName(name?: string) {
  return Array.from((name ?? '').trim()).slice(0, 5).join('') || 'زائر';
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

const durationOptions = [
  { seconds: 10, cpm: '1.5', label: '10 ثوانٍ' },
  { seconds: 20, cpm: '2', label: '20 ثانية' },
  { seconds: 40, cpm: '2.8', label: '40 ثانية' },
  { seconds: 80, cpm: '3.2', label: '80 ثانية' },
];

type TransactionStatus = 'تم' | 'قيد المعالجة' | 'تم الإلغاء' | 'مرفوض';
type PaymentMethod = 'binance' | 'web3';
type AppScreen = 'overview' | 'campaigns' | 'watch' | 'add' | 'deposit' | 'withdraw' | 'deposit-history' | 'withdraw-history';

type DepositRecord = {
  id: string;
  amount: number;
  method: PaymentMethod;
  destination: string;
  memoTag: string;
  blockchainTxId?: string;
  createdAt: string;
  status: TransactionStatus;
};

type WithdrawRecord = {
  id: string;
  amount: number;
  method: PaymentMethod;
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

function createBrowserWatchUrl(video: Video, user: TelegramUser | null) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = new URL(`${basePath}/watch`, window.location.origin);
  const videoId = getYoutubeVideoId(video.link);
  if (videoId) url.searchParams.set('v', videoId);
  url.searchParams.set('title', video.title);
  url.searchParams.set('creator', video.creator);
  url.searchParams.set('duration', String(video.duration));
  url.searchParams.set('reward', video.reward);
  if (user) {
    // The fragment is not sent to the web server; it carries display-only profile context.
    url.hash = new URLSearchParams({
      telegram: JSON.stringify({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
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
    <button
      type="button"
      aria-label={label}
      data-testid={`button-${label}`}
      onClick={onClick}
      className={`grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-600 ${className}`}
    >
      {children}
    </button>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3" dir="rtl">
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[13px] bg-[#1557ee] text-white shadow-[0_8px_20px_rgba(21,87,238,.24)]">
        <span className="absolute -left-1 -top-2 h-7 w-7 rounded-full border-[5px] border-cyan-300/80" />
        <Play className="relative mr-0.5 h-4 w-4 fill-current" />
      </div>
      <div className="leading-none">
        <div className="font-display text-[17px] font-bold tracking-tight text-[#0f1f46]">VidReward</div>
        <div className="mt-1 text-[9px] font-semibold tracking-[.18em] text-slate-400">WATCH · EARN · GROW</div>
      </div>
    </div>
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
  const navItems = mode === 'creator'
    ? [
        { icon: BarChart3, label: 'نظرة عامة', screen: 'overview' as AppScreen },
        { icon: Film, label: 'إعلاناتي', screen: 'campaigns' as AppScreen },
        { icon: WalletCards, label: 'إيداع رصيد', screen: 'deposit' as AppScreen },
        { icon: History, label: 'سجل الإيداع', screen: 'deposit-history' as AppScreen },
      ]
    : [
        { icon: Eye, label: 'شاهد واربح', screen: 'watch' as AppScreen },
        { icon: WalletCards, label: 'سحب الأرباح', screen: 'withdraw' as AppScreen },
        { icon: History, label: 'سجل السحب', screen: 'withdraw-history' as AppScreen },
      ];

  return (
    <aside
      className={`${open ? 'translate-x-0' : 'translate-x-full'} fixed inset-y-0 right-0 z-50 flex min-h-0 w-[236px] flex-col overflow-y-auto overscroll-contain border-l border-slate-200 bg-white p-4 shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:w-[224px] lg:translate-x-0 lg:rounded-l-[28px] lg:border lg:shadow-none`}
      dir="rtl"
    >
      <div className="flex items-center justify-between lg:block">
        <BrandMark />
        <IconButton label="إغلاق القائمة" onClick={onClose} className="lg:hidden">
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="mt-10 rounded-[18px] border border-blue-100 bg-[#f4f8ff] p-1.5">
        <button
          type="button"
          data-testid="button-switch-creator"
          onClick={() => { onModeChange('creator'); onClose?.(); }}
          className={`flex w-full items-center gap-3 rounded-[13px] px-3 py-3 text-right text-sm font-semibold transition ${mode === 'creator' ? 'bg-white text-[#1557ee] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <LayoutDashboard className="h-[18px] w-[18px]" />
          <span>نشر إعلان</span>
          {mode === 'creator' && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[#1557ee]" />}
        </button>
        <button
          type="button"
          data-testid="button-switch-viewer"
          onClick={() => { onModeChange('viewer'); onClose?.(); }}
          className={`flex w-full items-center gap-3 rounded-[13px] px-3 py-3 text-right text-sm font-semibold transition ${mode === 'viewer' ? 'bg-white text-[#1557ee] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Eye className="h-[18px] w-[18px]" />
          <span>اربح</span>
          {mode === 'viewer' && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[#1557ee]" />}
        </button>
      </div>
      <div className="mt-8">
        <div className="mb-3 px-3 text-[10px] font-bold tracking-[.16em] text-slate-400">{mode === 'creator' ? 'إدارة الإعلانات' : 'مساحة الربح'}</div>
        <nav className="space-y-1 pb-4">
          {navItems.map(({ icon: NavIcon, label, screen: itemScreen }, index) => (
            <button
              type="button"
              key={label}
              data-testid={`button-side-${index}`}
              onClick={() => { onNavigate(itemScreen); onClose?.(); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-medium transition ${screen === itemScreen ? 'bg-[#edf3ff] font-bold text-[#1557ee]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <NavIcon className="h-[17px] w-[17px]" />
              <span>{label}</span>
            </button>
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
           <button type="button" data-testid="button-sidebar-add" onClick={() => mode === 'creator' ? onAdd() : onNavigate('watch')} className="mt-4 flex items-center gap-1 text-xs font-bold text-cyan-300">
             {mode === 'creator' ? 'أضف إعلان الآن' : 'اذهب إلى المشاهدة'} <ArrowUpLeft className="h-3.5 w-3.5" />
          </button>
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
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[90] flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:items-end" dir="rtl" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} data-testid={`toast-${toast.id}`} className="pointer-events-auto flex w-full max-w-[390px] items-start gap-3 rounded-2xl border border-white/10 bg-[#0e2452] p-4 text-right text-white shadow-[0_16px_40px_rgba(14,36,82,.28)] backdrop-blur-md animate-rise">
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toast.tone === 'success' ? 'bg-emerald-400/15 text-emerald-300' : toast.tone === 'warning' ? 'bg-amber-300/15 text-amber-300' : 'bg-cyan-300/15 text-cyan-200'}`}>
            {toast.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : toast.tone === 'warning' ? <Timer className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white">{toast.title}</div>
            <div className="mt-1 text-[11px] leading-5 text-blue-100/75">{toast.message}</div>
          </div>
          <button type="button" data-testid={`button-dismiss-toast-${toast.id}`} onClick={() => onDismiss(toast.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-blue-100/60 transition hover:bg-white/10 hover:text-white" aria-label="إغلاق التنبيه">
            <X className="h-3.5 w-3.5" />
          </button>
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
  const [searchOpen, setSearchOpen] = useState(false);
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
          <button type="button" data-testid="button-header-add" onClick={onAdd} className="hidden items-center gap-2 rounded-xl bg-[#1557ee] px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(21,87,238,.2)] transition hover:-translate-y-0.5 hover:bg-[#0f48d0] sm:flex">
            <Plus className="h-4 w-4" /> إضافة إعلان
          </button>
        )}
        <div className="relative">
          <IconButton label="البحث" onClick={() => setSearchOpen((current) => !current)}><Search className="h-4 w-4" /></IconButton>
          {searchOpen && (
            <div className="absolute left-0 top-12 z-40 w-[min(80vw,280px)] rounded-2xl border border-slate-200 bg-white p-3 text-right shadow-[var(--shadow-lift)]" dir="rtl">
              <div className="mb-2 text-[10px] font-bold text-slate-500">ابحث في مساحة VidReward</div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfcff] px-3 py-2.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input autoFocus data-testid="input-global-search" placeholder="عنوان إعلان أو سجل..." className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-300" onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} />
              </div>
              <p className="mt-2 text-[10px] leading-5 text-slate-400">اكتب للعثور على ما تحتاجه بسرعة.</p>
            </div>
          )}
        </div>
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
    <div className={`relative aspect-video w-full overflow-hidden ${thumbnail ? 'bg-slate-900' : video.art}`}>
      {thumbnail ? (
        <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(120deg,transparent_25%,white_25%,white_27%,transparent_27%,transparent_62%,white_62%,white_64%,transparent_64%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
      <div className="absolute right-5 top-5 h-16 w-16 rounded-full border border-white/20" />
      {!compact && (
        <div className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] font-bold text-white backdrop-blur-sm">
          {video.duration} ث
        </div>
      )}
      <div className={`absolute inset-0 grid place-items-center ${compact ? '' : 'group-hover:scale-105'} transition-transform`}>
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/50 bg-white/20 text-white backdrop-blur-md">
          <Play className="mr-[-2px] h-5 w-5 fill-current" />
        </span>
      </div>
    </div>
  );
}

function CampaignsPage({
  videos,
  tab,
  onTab,
  onAdd,
  onWatch,
}: {
  videos: Video[];
  tab: 'all' | 'active' | 'drafts';
  onTab: (tab: 'all' | 'active' | 'drafts') => void;
  onAdd: () => void;
  onWatch: (video: Video) => void;
}) {
  const [spendPeriod, setSpendPeriod] = useState<'آخر ٧ أيام' | 'آخر ٣٠ يومًا'>('آخر ٧ أيام');
  const visibleVideos = videos.filter((video) => tab === 'all' || (tab === 'active' ? video.status === 'نشط' : video.status === 'مسودة'));
  return (
    <main className="mx-auto w-full max-w-[1370px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <section className="animate-rise flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#1557ee]"><span className="h-1.5 w-1.5 rounded-full bg-[#23bdc9]" /> الثلاثاء، ٢٤ ديسمبر ٢٠٢٤</div>
          <h1 className="font-display text-[29px] font-bold tracking-[-.04em] text-[#12234b] md:text-[36px]">صباح الخير، محمد <span className="text-[#1557ee]">.</span></h1>
          <p className="mt-2 text-sm text-slate-500">هذه لمحة سريعة عن أثر إعلاناتك اليوم.</p>
        </div>
        <button type="button" data-testid="button-add-video-main" onClick={onAdd} className="flex items-center justify-center gap-2 rounded-xl bg-[#1557ee] px-5 py-3 text-sm font-bold text-white shadow-[0_9px_22px_rgba(21,87,238,.2)] transition hover:-translate-y-0.5 hover:bg-[#0f48d0]">
          <Plus className="h-4 w-4" /> أضف إعلان جديد
        </button>
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
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#1557ee]"><WalletCards className="h-5 w-5" /></div>
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
                <button type="button" key={value} data-testid={`button-tab-${value}`} onClick={() => onTab(value)} className={`rounded-md px-3 py-2 transition ${tab === value ? 'bg-white text-[#1557ee] shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><FileText className="h-6 w-6" /></div>
                <h3 className="mt-4 text-sm font-bold text-slate-800">لا توجد إعلانات هنا بعد</h3>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">ابدأ بإضافة إعلان جديد وامنح المشاهدين تجربة تستحق وقتهم.</p>
                <button type="button" data-testid="button-empty-add" onClick={onAdd} className="mt-4 text-xs font-bold text-[#1557ee]">إضافة أول إعلان</button>
              </div>
            ) : visibleVideos.map((video, index) => (
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
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {video.duration} ثانية</span>
                  </div>
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-bold text-[#12234b]">{video.reward}</div>
                  <div className="mt-1 text-[10px] text-slate-400">لكل إكمال</div>
                </div>
                <button type="button" data-testid={`button-video-menu-${video.id}`} onClick={() => onWatch(video)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 opacity-60 transition hover:bg-[#edf3ff] hover:text-[#1557ee] group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <span className="text-[11px] text-slate-400">عرض {visibleVideos.length} من {videos.length} فيديوهات</span>
            <button type="button" data-testid="button-view-all-videos" onClick={() => onTab('all')} className="flex items-center gap-1 text-xs font-bold text-[#1557ee]">عرض الكل <ArrowDownLeft className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-7">
          <div className="absolute -left-14 -top-14 h-40 w-40 rounded-full border border-cyan-300/15" />
          <div className="absolute -left-2 top-2 h-16 w-16 rounded-full border border-cyan-300/15" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-100">ملخص الإنفاق</span>
               <button type="button" data-testid="button-spend-period" onClick={() => setSpendPeriod((current) => current === 'آخر ٧ أيام' ? 'آخر ٣٠ يومًا' : 'آخر ٧ أيام')} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] text-blue-100 transition hover:border-cyan-200/40 hover:text-cyan-200">{spendPeriod} <ChevronLeft className="mr-1 inline h-3 w-3 rotate-[-90deg]" /></button>
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

function CreatorOverview({
  advertiserBalance,
  telegramUser,
  onAdd,
  onDeposit,
}: {
  advertiserBalance: number;
  telegramUser: TelegramUser | null;
  onAdd: () => void;
  onDeposit: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[1370px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <section className="animate-rise flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#1557ee]"><span className="h-1.5 w-1.5 rounded-full bg-[#23bdc9]" /> الأربعاء، ٢٣ سبتمبر ٢٠٢٦</div>
          <h1 className="font-display text-[29px] font-bold tracking-[-.04em] text-[#12234b] md:text-[36px]">صباح الخير، {telegramUser ? getShortName(telegramUser.first_name) : 'محمد'}<span className="text-[#1557ee]">:</span></h1>
          <p className="mt-2 text-sm text-slate-500">ملخص أداء حملاتك ورصيدك في مكان واحد.</p>
        </div>
        <button type="button" data-testid="button-add-video-main" onClick={onAdd} className="flex items-center justify-center gap-2 rounded-xl bg-[#1557ee] px-5 py-3 text-sm font-bold text-white shadow-[0_9px_22px_rgba(21,87,238,.2)] transition hover:-translate-y-0.5 hover:bg-[#0f48d0]">
          <Plus className="h-4 w-4" /> أضف إعلان جديد
        </button>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="animate-rise"><StatCard icon={Eye} label="إجمالي المشاهدات" value="27,584" change="12.8%" tone="blue" /></div>
        <div className="animate-rise delay-1"><StatCard icon={DollarSign} label="إجمالي الإنفاق" value="$124.80" change="8.4%" tone="cyan" /></div>
        <div className="animate-rise delay-2"><StatCard icon={Users} label="مشاهدون جدد" value="1,892" change="18.2%" tone="navy" /></div>
        <div className="animate-rise delay-3"><StatCard icon={TrendingUp} label="متوسط الإكمال" value="76.4%" change="4.6%" tone="sand" /></div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[22px] border border-blue-100 bg-[#eff4ff] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500">رصيد الإعلانات</div>
              <div className="mt-1 text-3xl font-bold tracking-tight text-[#12234b]">${advertiserBalance.toFixed(2)}</div>
              <div className="mt-2 text-[11px] text-slate-400">متاح لتمويل الحملات القادمة</div>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#1557ee]"><WalletCards className="h-5 w-5" /></div>
          </div>
          <button type="button" data-testid="button-overview-deposit" onClick={onDeposit} className="mt-6 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#1557ee] shadow-sm transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" /> إيداع رصيد جديد
          </button>
        </div>
        <div className="rounded-[22px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)]">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">أداء هذا الشهر</span><BarChart3 className="h-5 w-5 text-cyan-300" /></div>
          <div className="mt-6 flex items-end justify-between">
            <div><div className="text-3xl font-bold">9,428</div><div className="mt-1 text-[11px] text-blue-100/60">إكمالات الفيديو</div></div>
            <div className="text-left"><div className="text-xl font-bold text-cyan-300">+14.8%</div><div className="mt-1 text-[10px] text-blue-100/60">مقارنة بالأسبوع الماضي</div></div>
          </div>
          <div className="mt-7 flex h-16 items-end gap-2 border-b border-white/10">
            {[32, 46, 40, 64, 55, 74, 67, 86, 77, 96, 87, 100].map((height, i) => <div key={i} className="flex h-full flex-1 items-end"><div className={`w-full rounded-t-sm ${i === 11 ? 'bg-cyan-300' : 'bg-blue-300/30'}`} style={{ height: `${height}%` }} /></div>)}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#12234b]">خطواتك التالية</h2><p className="mt-1 text-xs text-slate-400">أكمل هذه الخطوات لتحصل على أفضل نتيجة.</p></div><Sparkles className="h-5 w-5 text-[#1557ee]" /></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {([
            { number: '01', title: 'أضف إعلانك الأول', description: 'شارك فيديو يستحق وقت المشاهدين.', action: onAdd },
            { number: '02', title: 'موّل حملتك', description: 'أنشئ فاتورة إيداع آمنة بعملة USDT.', action: onDeposit },
            { number: '03', title: 'راجع الأداء', description: 'تابع المشاهدات والإكمالات من صفحة الإعلانات.' },
          ] as Array<{ number: string; title: string; description: string; action?: () => void }>).map(({ number, title, description, action }) => (
            <button type="button" key={number} onClick={typeof action === 'function' ? action : undefined} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-[#fbfcff] p-4 text-right transition hover:border-blue-100 hover:bg-[#f4f8ff]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[10px] font-bold text-[#1557ee]">{number}</span>
              <span><span className="block text-xs font-bold text-[#12234b]">{title}</span><span className="mt-1 block text-[11px] leading-5 text-slate-400">{description}</span></span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function ViewerView({
  videos,
  onSelect,
  balance,
  onWithdraw,
  telegramUser,
  insideTelegram,
  onOpenBrowser,
}: {
  videos: Video[];
  onSelect: (video: Video) => void;
  balance: number;
  onWithdraw: () => void;
  telegramUser: TelegramUser | null;
  insideTelegram: boolean;
  onOpenBrowser: (video: Video) => void;
}) {
  const activeVideos = videos.filter((video) => video.status === 'نشط');
  return (
    <main className="mx-auto w-full max-w-[1370px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-blue-100 bg-white px-5 py-4 shadow-[var(--shadow-soft)]">
        <div>
          <h1 className="font-display text-xl font-bold text-[#12234b]">صباح الخير، {getShortName(telegramUser?.first_name)}<span className="text-[#1557ee]">:</span></h1>
          {telegramUser ? (
            <p className="mt-1 text-[11px] text-slate-400" dir="ltr">Telegram ID: {telegramUser.id}</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">أهلاً بك في مساحة المشاهدة والربح</p>
          )}
        </div>
        {telegramUser && <span className="max-w-full truncate rounded-full bg-[#f4f8ff] px-3 py-2 text-[10px] font-semibold text-[#1557ee]">حساب Telegram مرتبط</span>}
      </section>
      <section className="mb-5 flex flex-col gap-4 rounded-[22px] border border-blue-100 bg-white p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eafbf8] text-[#159b89]"><WalletCards className="h-6 w-6" /></div>
          <div>
            <div className="text-xs font-semibold text-slate-400">رصيدك القابل للسحب</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-[#12234b]">{formatUsd(balance)}</div>
          </div>
        </div>
        <button type="button" data-testid="button-withdraw" onClick={onWithdraw} disabled={balance <= 0} className="flex items-center justify-center gap-2 rounded-xl border border-[#1557ee] px-5 py-3 text-xs font-bold text-[#1557ee] transition hover:bg-[#edf3ff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300">
          <WalletCards className="h-4 w-4" /> سحب الأرباح
        </button>
      </section>
      {insideTelegram ? (
        <section className="animate-rise mx-auto mt-8 flex min-h-[340px] max-w-3xl flex-col items-center justify-center rounded-[26px] border border-blue-100 bg-white px-6 py-10 text-center shadow-[var(--shadow-soft)] md:px-10">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><PlaySquare className="h-8 w-8" /></div>
          <h2 className="mt-5 font-display text-2xl font-bold text-[#12234b]">شاهد واربح من المتصفح</h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">مشغلات YouTube لا تظهر داخل Telegram. افتح صفحة المشاهدة في المتصفح لمشاهدة الفيديوهات مباشرةً دون قوائم التطبيق.</p>
          {activeVideos[0] ? (
            <button type="button" data-testid="button-open-browser-watch" onClick={() => onOpenBrowser(activeVideos[0])} className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#1557ee] px-6 py-4 text-sm font-bold text-white shadow-[0_10px_20px_rgba(21,87,238,.2)] transition hover:-translate-y-0.5 hover:bg-[#0f48d0]">
              <ExternalLink className="h-4 w-4" /> اذهب للمتصفح للمشاهدة والربح
            </button>
          ) : (
            <p className="mt-7 rounded-xl bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-500">لا توجد فيديوهات نشطة حاليًا.</p>
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
          <div><h2 className="font-display text-xl font-bold text-[#12234b]">اختر إعلاناً وابدأ</h2><p className="mt-1 text-xs text-slate-400">كل مشاهدة مكتملة تضيف إلى رصيدك</p></div>
        <span className="hidden rounded-full bg-[#eafbf8] px-3 py-1.5 text-[10px] font-bold text-[#159b89] sm:block">{activeVideos.length} فيديو متاح الآن</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {activeVideos.map((video, index) => (
          <button type="button" key={video.id} data-testid={`card-reward-${video.id}`} onClick={() => onSelect(video)} className="group overflow-hidden rounded-[20px] border border-slate-200 bg-white text-right shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[var(--shadow-lift)]">
            <VideoArtwork video={video} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">فيديو {String(index + 1).padStart(2, '0')}</span>
                <span className="flex items-center gap-1 rounded-md bg-[#edf3ff] px-2 py-1 text-[10px] font-bold text-[#1557ee]"><Clock3 className="h-3 w-3" /> {video.duration} ثانية</span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-[#12234b]">{video.title}</h3>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[11px] text-slate-400">{video.creator}</span>
                <span className="text-sm font-bold text-[#159b89]">+ {video.reward}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
        </>
      )}
    </main>
  );
}

function WatchPanel({
  video,
  progress,
  isPlaying,
  completed,
  session,
  onPlay,
  onComplete,
  onClose,
}: {
  video: Video;
  progress: number;
  isPlaying: boolean;
  completed: boolean;
  session: AdvertisementSession | null;
  onPlay: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const [credited, setCredited] = useState(false);
  const percent = Math.min(100, (progress / video.duration) * 100);

  useEffect(() => {
    if (completed && !credited) {
      setCredited(true);
      onComplete();
    }
  }, [completed, credited, onComplete]);

  const openVideo = () => {
    window.open(video.link, '_blank', 'noopener,noreferrer');
    setHasOpenedVideo(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#061333]/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" dir="rtl">
      <div className="max-h-[94vh] w-full max-w-[920px] overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1557ee]"><Sparkles className="h-4 w-4" /> جلسة مشاهدة موثقة</div>
            <code dir="ltr" className="mt-1 block truncate text-[9px] font-bold text-slate-400">Session ID: {session?.id ?? 'سيُنشأ عند البدء'}</code>
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
                <button type="button" data-testid="button-open-youtube" onClick={openVideo} className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#12234b] transition hover:-translate-y-0.5 hover:bg-cyan-50">
                  <ExternalLink className="h-3.5 w-3.5" /> فتح الفيديو على YouTube
                </button>
              </div>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-bold leading-7 text-[#12234b]">{video.title}</h2><p className="mt-1 text-xs text-slate-400">{video.creator}</p></div>
              <span className="shrink-0 rounded-lg bg-[#eafbf8] px-2.5 py-2 text-sm font-bold text-[#159b89]">+ {video.reward}</span>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-[10px] text-slate-400"><span>تقدم المشاهدة</span><span>{progress} / {video.duration} ثانية</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1557ee] transition-all duration-500" style={{ width: `${percent}%` }} /></div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-[#fbfcff] p-5 md:border-r md:border-t-0 md:p-7">
            {completed ? (
              <div className="flex h-full min-h-[270px] flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[#eafbf8] text-[#159b89]"><Check className="h-8 w-8" /></div>
                <h3 className="mt-5 text-xl font-bold text-[#12234b]">أحسنت، تمت المشاهدة</h3>
                <p className="mt-2 max-w-[230px] text-xs leading-6 text-slate-400">أضيفت الأرباح إلى رصيدك بنجاح.</p>
                <div className="mt-5 rounded-xl bg-white px-7 py-3 text-lg font-bold text-[#159b89] shadow-sm">+ {video.reward}</div>
                <button type="button" data-testid="button-close-complete" onClick={onClose} className="mt-5 text-xs font-bold text-[#1557ee]">مشاهدة فيديو آخر</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-[#12234b]">أكمل المدة المطلوبة</span><Clock3 className="h-4 w-4 text-[#1557ee]" /></div>
                <div className="mt-5 rounded-2xl border border-blue-100 bg-[#eff4ff] p-4">
                  <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1557ee]"><Clock3 className="h-5 w-5" /></div><div><div className="text-[11px] text-slate-500">المدة المطلوبة</div><div className="mt-0.5 text-xl font-bold text-[#12234b]">{video.duration} ثانية</div></div></div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-500">سيتم احتساب المكافأة بعد إكمال المشاهدة دون تخطي.</p>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-xs"><span className="text-slate-500">المكافأة المتوقعة</span><span className="font-bold text-[#159b89]">+ {video.reward}</span></div>
                   <div className="flex items-center justify-between text-xs"><span className="text-slate-500">حالة الجلسة</span><span className={`font-bold ${isPlaying ? 'text-[#1557ee]' : session?.status === 'paused' ? 'text-amber-600' : hasOpenedVideo ? 'text-[#159b89]' : 'text-slate-400'}`}>{isPlaying ? 'جارٍ التحقق' : session?.status === 'paused' ? 'غير مكتملة — عد للتحقق' : hasOpenedVideo ? 'تم فتح الفيديو' : 'افتح الفيديو أولاً'}</span></div>
                </div>
                 {session?.status === 'paused' && progress < video.duration && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] leading-5 text-amber-700">لم تكتمل هذه الجلسة بعد. لا تُحتسب المكافأة حتى يسجل النظام {video.duration} ثانية مشاهدة فعلية.</div>}
                <button type="button" data-testid="button-start-watch" onClick={onPlay} disabled={isPlaying || !hasOpenedVideo} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1557ee] py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_rgba(21,87,238,.2)] transition hover:bg-[#0f48d0] disabled:cursor-default disabled:opacity-60">
                  {isPlaying ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحقق من المشاهدة...</> : <><Check className="h-4 w-4" /> تحقق من إتمام المشاهدة</>}
                </button>
                <div className="mt-5 flex items-center gap-2 text-[10px] leading-5 text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-[#159b89]" /> تتوقف الجلسة عند مغادرة الصفحة، ولا تُحتسب المكافأة إلا بعد وقت مشاهدة فعلي.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddVideo({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (video: Omit<Video, 'id' | 'views' | 'status' | 'created' | 'art'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [duration, setDuration] = useState(20);
  const [submitted, setSubmitted] = useState(false);
  const selected = durationOptions.find((option) => option.seconds === duration) ?? durationOptions[1];
  const embedUrl = getEmbedUrl(link);
  const valid = title.trim().length > 2 && link.trim().length > 5;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      link: link.trim(),
      duration,
      creator: 'محمد العتيبي',
      cpm: Number(selected.cpm),
      reward: formatUsd(calculateViewerReward(Number(selected.cpm))),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[780px] items-center justify-center px-4 py-12" dir="rtl">
        <div className="animate-rise w-full rounded-[26px] border border-slate-200 bg-white p-7 text-center shadow-[var(--shadow-lift)] md:p-12">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#eafbf8] text-[#159b89]"><Check className="h-9 w-9" /></div>
          <div className="mt-6 text-xs font-bold text-[#159b89]">تم النشر بنجاح</div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">فيديوك جاهز للوصول إلى جمهور جديد</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">أصبح الفيديو نشطاً الآن. سيظهر للمشاهدين الذين يبحثون عن محتوى جديد مع مكافآت عادلة.</p>
          <div className="mx-auto mt-7 flex max-w-sm items-center justify-between rounded-2xl bg-[#f5f8fe] p-4 text-right"><div><div className="text-xs font-bold text-[#12234b]">{title}</div><div className="mt-1 text-[10px] text-slate-400">{duration} ثانية · CPM ${selected.cpm}</div></div><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#1557ee] text-white"><Film className="h-4 w-4" /></div></div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" data-testid="button-success-back" onClick={onBack} className="rounded-xl bg-[#1557ee] px-6 py-3 text-sm font-bold text-white">العودة إلى لوحة التحكم</button><button type="button" data-testid="button-success-another" onClick={() => { setSubmitted(false); setTitle(''); setLink(''); }} className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600">إضافة إعلان آخر</button></div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <div className="mb-7 flex items-center gap-3"><button type="button" data-testid="button-back-add" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-[#1557ee]"><ArrowDownLeft className="h-4 w-4" /></button><div><div className="text-xs font-semibold text-[#1557ee]">نشر إعلان / إعلان جديد</div><h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">انشر إعلانك</h1></div></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-7">
          <div className="mb-7"><h2 className="font-display text-lg font-bold text-[#12234b]">تفاصيل الفيديو</h2><p className="mt-1 text-xs text-slate-400">أخبر المشاهدين لماذا يستحق هذا الفيديو وقتهم.</p></div>
          <label className="block text-xs font-bold text-slate-700">عنوان الفيديو <span className="text-[#1557ee]">*</span><input value={title} onChange={(event) => setTitle(event.target.value)} data-testid="input-video-title" placeholder="مثال: كيف تبدأ مشروعك من الصفر؟" className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /></label>
          <label className="mt-5 block text-xs font-bold text-slate-700">رابط الفيديو <span className="text-[#1557ee]">*</span><div className="relative mt-2"><Link2 className="absolute right-4 top-3.5 h-4 w-4 text-slate-400" /><input value={link} onChange={(event) => setLink(event.target.value)} data-testid="input-video-link" dir="ltr" placeholder="https://youtube.com/watch?v=..." className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] py-3 pl-4 pr-11 text-left text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /></div></label>
          <div className="mt-7">
            <div className="flex items-center justify-between"><div><h3 className="text-xs font-bold text-slate-700">المدة الإلزامية للمشاهدة</h3><p className="mt-1 text-[10px] text-slate-400">اختر الوقت الذي سيكمله المشاهد قبل احتساب المكافأة.</p></div><Clock3 className="h-5 w-5 text-[#1557ee]" /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {durationOptions.map((option) => <button type="button" key={option.seconds} data-testid={`button-duration-${option.seconds}`} onClick={() => setDuration(option.seconds)} className={`rounded-xl border p-3 text-right transition ${duration === option.seconds ? 'border-[#1557ee] bg-[#edf3ff] text-[#1557ee] shadow-[0_0_0_2px_rgba(21,87,238,.08)]' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}><div className="text-sm font-bold">{option.label}</div><div className="mt-1 text-[10px] opacity-70">CPM ${option.cpm}</div></button>)}
            </div>
          </div>
          <div className="mt-7 flex items-center justify-between rounded-2xl bg-[#f4f8ff] p-4"><div><div className="text-[11px] text-slate-500">تكلفة الألف مشاهدة (CPM)</div><div className="mt-1 text-2xl font-bold text-[#12234b]">${selected.cpm}</div></div><div className="text-left text-[10px] leading-5 text-slate-400">كلما زادت المدة،<br />زادت جودة التفاعل</div></div>
           <button type="button" data-testid="button-submit-video" disabled={!valid} onClick={submit} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1557ee] py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_rgba(21,87,238,.18)] transition hover:bg-[#0f48d0] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"><Upload className="h-4 w-4" /> نشر الإعلان</button>
        </section>
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-[#12234b]">المعاينة المباشرة</h2><p className="mt-1 text-xs text-slate-400">هكذا سيظهر الفيديو للمشاهدين.</p></div><span className="flex items-center gap-1 rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]"><span className="h-1.5 w-1.5 rounded-full bg-current" /> مباشر</span></div>
          <div className="mt-5 overflow-hidden rounded-2xl bg-[#0e2452]">
            <div className="aspect-video">{embedUrl ? <iframe title="معاينة الفيديو" src={embedUrl} className="h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="media-art relative grid h-full place-items-center"><div className="text-center text-white/80"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-white/15"><Play className="h-5 w-5 fill-current" /></div><p className="mt-3 text-[11px]">ستظهر المعاينة هنا</p></div></div>}</div>
            <div className="border-t border-white/10 bg-[#0b1e47] p-4"><h3 className="truncate text-sm font-bold text-white">{title || 'عنوان الفيديو سيظهر هنا'}</h3><div className="mt-2 flex items-center justify-between text-[10px] text-blue-100/60"><span>محمد العتيبي</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {duration} ثانية</span></div></div>
          </div>
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-[11px] leading-6 text-slate-400"><div className="mb-1 flex items-center gap-2 font-bold text-slate-600"><PlaySquare className="h-4 w-4 text-[#f04444]" /> روابط مدعومة</div>يمكنك استخدام روابط YouTube أو أي رابط فيديو مباشر قابل للتشغيل.</div>
        </section>
      </div>
    </main>
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

function formatHistoryDate(date = new Date()) {
  return new Intl.DateTimeFormat('ar-TN', {
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
  return method === 'binance' ? 'Binance ID' : 'Web3 Wallet';
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const styles = {
    'تم': 'bg-[#eafbf8] text-[#159b89]',
    'قيد المعالجة': 'bg-amber-50 text-amber-700',
    'تم الإلغاء': 'bg-slate-100 text-slate-500',
    'مرفوض': 'bg-rose-50 text-rose-600',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
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
        <button type="button" onClick={copy} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-[#1557ee]" aria-label={`نسخ ${label}`}>
          {copied ? <Check className="h-3 w-3 text-[#159b89]" /> : <Copy className="h-3 w-3" />}
        </button>
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

function DepositPage({
  advertiserBalance,
  telegramUser,
  onDepositRequested,
  onDepositCompleted,
  onDepositExpired,
}: {
  advertiserBalance: number;
  telegramUser: TelegramUser | null;
  onDepositRequested: (record: DepositRecord) => void;
  onDepositCompleted: (id: string) => void;
  onDepositExpired: (id: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('binance');
  const [invoice, setInvoice] = useState<{ id: string; amount: number; method: PaymentMethod; destination: string; memoTag: string; telegramUserId: number | null; expiresAt: number } | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<'pending' | 'completed' | 'expired'>('pending');
  const [remainingSeconds, setRemainingSeconds] = useState(invoiceLifetime);
  const [pollCount, setPollCount] = useState(0);
  const [finalizedInvoiceId, setFinalizedInvoiceId] = useState('');
  const [copied, setCopied] = useState('');
  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= 1;

  const copyValue = async (value: string, key: string) => {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard may be unavailable in preview */ }
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1800);
  };

  const createInvoice = () => {
    if (!validAmount) return;
    const createdAt = Date.now();
    const destination = method === 'binance' ? depositBinanceId : depositAddress;
    const transactionId = createUniqueIdentifier('DEP');
    const nextInvoice = {
      id: transactionId,
      amount: numericAmount,
      method,
      destination,
      memoTag: createMemoTag(telegramUser?.id),
      telegramUserId: telegramUser?.id ?? null,
      expiresAt: createdAt + invoiceLifetime * 1000,
    };
    setInvoice(nextInvoice);
    setInvoiceStatus('pending');
    setRemainingSeconds(invoiceLifetime);
    setPollCount(0);
    setFinalizedInvoiceId('');
    onDepositRequested({
      id: nextInvoice.id,
      amount: nextInvoice.amount,
      method: nextInvoice.method,
      destination: nextInvoice.destination,
      memoTag: nextInvoice.memoTag,
      createdAt: formatHistoryDate(new Date(createdAt)),
      status: 'قيد المعالجة',
    });
  };

  useEffect(() => {
    if (!invoice || invoiceStatus !== 'pending') return;
    const timer = window.setInterval(() => setPollCount((current) => Math.min(current + 1, 3)), 2000);
    return () => window.clearInterval(timer);
  }, [invoice, invoiceStatus]);

  useEffect(() => {
    if (!invoice || invoiceStatus !== 'pending' || pollCount < 3) return;
    setInvoiceStatus('completed');
  }, [invoice, invoiceStatus, pollCount]);

  useEffect(() => {
    if (!invoice || invoiceStatus !== 'pending') return;
    const updateCountdown = () => {
      const next = Math.max(0, Math.ceil((invoice.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) setInvoiceStatus('expired');
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [invoice, invoiceStatus]);

  useEffect(() => {
    if (!invoice || finalizedInvoiceId === invoice.id) return;
    if (invoiceStatus === 'completed') {
      setFinalizedInvoiceId(invoice.id);
      onDepositCompleted(invoice.id);
    } else if (invoiceStatus === 'expired') {
      setFinalizedInvoiceId(invoice.id);
      onDepositExpired(invoice.id);
    }
  }, [invoice, invoiceStatus, finalizedInvoiceId, onDepositCompleted, onDepositExpired]);

  const invoiceHeading = invoice?.method === 'binance'
    ? `أرسل ${invoice.amount.toFixed(2)} USDT إلى معرّف Binance التالي`
    : `أرسل ${invoice?.amount.toFixed(2)} USDT إلى العنوان التالي`;
  const statusLabel = invoiceStatus === 'completed' ? 'تم التأكيد تلقائيًا' : invoiceStatus === 'expired' ? 'انتهت صلاحية الفاتورة' : 'جاري المعالجة';

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <div className="mb-7">
        <div className="text-xs font-semibold text-[#1557ee]">إدارة الإعلانات / الإيداع</div>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">إيداع رصيد الإعلانات</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">أنشئ فاتورة، أرسل المبلغ، وسنتحقق من العملية تلقائيًا دون الحاجة إلى تأكيد يدوي.</p>
      </div>

      {!invoice ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] md:p-8">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><DollarSign className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold text-[#12234b]">بيانات الإيداع</h2><p className="mt-1 text-xs text-slate-400">اختر Binance ID أو محفظة Web3</p></div></div>
            <div className="mt-7">
              <div className="mb-2 text-xs font-bold text-slate-700">طريقة الدفع</div>
              <div className="grid grid-cols-2 gap-2">
                  {([
                   { value: 'binance', title: 'Binance ID', Icon: WalletCards },
                   { value: 'web3', title: 'Web3 Wallet', Icon: Wallet },
                 ] as Array<{ value: PaymentMethod; title: string; Icon: typeof Wallet }>).map(({ value, title, Icon }) => (
                   <button type="button" key={value} data-testid={`button-deposit-method-${value}`} onClick={() => setMethod(value)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-right transition ${method === value ? 'border-[#1557ee] bg-[#eff4ff] text-[#1557ee]' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                     <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white"><Icon className="h-4 w-4" /></span>
                     <span className="truncate whitespace-nowrap text-[11px] font-bold">{title}</span>
                    {method === value && <CheckCircle2 className="mr-auto h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-6 block text-xs font-bold text-slate-700">المبلغ المطلوب (USDT)<div className="relative mt-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" step="0.01" placeholder="مثال: 50.00" data-testid="input-deposit-amount" className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 pl-16 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /><span className="absolute left-4 top-3 rounded-md bg-[#eafbf8] px-2 py-1 text-[10px] font-bold text-[#159b89]">USDT</span></div></label>
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[11px] leading-5 text-amber-800"><div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> تنبيه قبل التحويل</div><p className="mt-1">{method === 'binance' ? 'أرسل المبلغ إلى Binance ID الظاهر في الفاتورة، وليس إلى عنوان محفظة.' : 'استخدم شبكة BEP20 فقط، وأرسل المبلغ نفسه الموضح في الفاتورة.'}</p></div>
            <button type="button" data-testid="button-create-invoice" onClick={createInvoice} disabled={!validAmount} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1557ee] py-3.5 text-sm font-bold text-white transition hover:bg-[#0f48d0] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><FileText className="h-4 w-4" /> إنشاء فاتورة الإيداع</button>
          </section>
          <section className="rounded-[24px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-8">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">الرصيد الحالي</span><WalletCards className="h-5 w-5 text-cyan-300" /></div>
            <div className="mt-7 text-4xl font-bold tracking-tight">${advertiserBalance.toFixed(2)}</div>
            <p className="mt-2 text-xs leading-5 text-blue-100/65">الرصيد الذي يمكنك استخدامه لتمويل إعلاناتك. ستظهر الإيداعات بعد التحقق التلقائي.</p>
            <div className="mt-8 border-t border-white/10 pt-5"><div className="text-[10px] font-bold text-blue-100/60">معلومات الشبكة</div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-blue-100/70">الشبكة</span><span className="font-bold text-cyan-300">BNB Smart Chain</span></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-blue-100/70">العملة</span><span className="font-bold text-cyan-300">USDT (BEP20)</span></div></div>
          </section>
        </div>
      ) : (
        <section className="animate-rise rounded-[24px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] md:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center"><div><div className={`flex items-center gap-2 text-xs font-bold ${invoiceStatus === 'completed' ? 'text-[#159b89]' : invoiceStatus === 'expired' ? 'text-rose-500' : 'text-amber-600'}`}><span className={`h-2 w-2 rounded-full ${invoiceStatus === 'completed' ? 'bg-[#159b89]' : invoiceStatus === 'expired' ? 'bg-rose-500' : 'animate-pulse bg-amber-500'}`} /> {statusLabel}</div><h2 className="mt-2 font-display text-xl font-bold text-[#12234b]">{invoiceHeading}</h2><p className="mt-1 text-xs text-slate-400">طريقة الدفع: {methodLabel(invoice.method)} · {invoice.method === 'binance' ? 'تحويل مباشر' : 'شبكة BEP20'}</p></div><div className="grid h-16 w-16 place-items-center rounded-xl bg-[#f4f8ff] text-[#1557ee]"><QrCode className="h-9 w-9" /></div></div>
          <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-[#f4f8ff] p-4"><div className="mb-2 text-[11px] font-bold text-slate-500">{invoice.method === 'binance' ? 'معرّف Binance للإيداع' : 'عنوان الإيداع (BEP20)'}</div><div className="flex items-center gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all text-xs font-bold text-[#12234b]">{invoice.destination}</code><button type="button" data-testid="button-copy-deposit-destination" onClick={() => copyValue(invoice.destination, 'destination')} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#1557ee]">{copied === 'destination' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div></div>
               <div className="rounded-2xl border border-cyan-100 bg-[#effcfd] p-4"><div className="mb-2 text-[11px] font-bold text-slate-500">Memo / Tag فريد لهذه العملية</div><div className="flex items-center gap-2"><code dir="ltr" className="flex-1 text-sm font-bold tracking-wider text-[#12234b]">{invoice.memoTag}</code><button type="button" data-testid="button-copy-deposit-memo" onClick={() => copyValue(invoice.memoTag, 'memo')} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#1557ee]">{copied === 'memo' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div><p className="mt-2 text-[10px] font-semibold leading-5 text-slate-600">أرسل هذا الرمز في خانة الملاحظات (Memo / Tag) عند تنفيذ التحويل.</p></div>
              <div className="rounded-xl bg-[#f7f9fd] p-4"><div className="text-[10px] text-slate-400">المعرّف الداخلي للفاتورة</div><code dir="ltr" className="mt-1 block truncate text-xs font-bold text-[#12234b]">{invoice.id}</code></div>
              {invoice.telegramUserId !== null && <div className="rounded-xl border border-blue-100 bg-[#f4f8ff] p-4"><div className="text-[10px] text-slate-400">معرّف Telegram المرتبط بالفاتورة</div><code dir="ltr" className="mt-1 block text-xs font-bold text-[#1557ee]">{invoice.telegramUserId}</code></div>}
              <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f7f9fd] p-4"><div className="text-[10px] text-slate-400">المبلغ</div><div className="mt-1 text-lg font-bold text-[#12234b]">{invoice.amount.toFixed(2)} USDT</div></div><div className="rounded-xl bg-[#f7f9fd] p-4"><div className="text-[10px] text-slate-400">طريقة الدفع</div><div className="mt-1 text-sm font-bold text-[#12234b]">{methodLabel(invoice.method)}</div></div><div className="rounded-xl bg-[#f7f9fd] p-4"><div className="text-[10px] text-slate-400">الوقت المتبقي</div><div className={`mt-1 text-sm font-bold ${invoiceStatus === 'pending' ? 'text-amber-600' : 'text-[#159b89]'}`}>{invoiceStatus === 'pending' ? formatRemaining(remainingSeconds) : invoiceStatus === 'completed' ? 'تمت العملية' : 'منتهية'}</div></div></div>
              <div className={`rounded-2xl border p-4 ${invoiceStatus === 'pending' ? 'border-amber-100 bg-amber-50' : invoiceStatus === 'completed' ? 'border-emerald-100 bg-[#eafbf8]' : 'border-rose-100 bg-rose-50'}`}><div className={`flex items-center gap-2 text-xs font-bold ${invoiceStatus === 'pending' ? 'text-amber-700' : invoiceStatus === 'completed' ? 'text-[#159b89]' : 'text-rose-600'}`}><Timer className="h-4 w-4" /> {invoiceStatus === 'pending' ? `يتم تحديث الحالة تلقائيًا كل ثانيتين · تنتهي الفاتورة خلال ${formatRemaining(remainingSeconds)}` : invoiceStatus === 'completed' ? 'تم العثور على التحويل وتأكيد الإيداع تلقائيًا.' : 'انتهت الفاتورة قبل وصول التحويل.'}</div><p className="mt-1 text-[11px] leading-5 text-slate-500">{invoiceStatus === 'pending' ? 'لا تغلق الصفحة بعد إرسال المبلغ. لا تحتاج إلى الضغط على أي زر للتأكيد.' : 'يمكنك الرجوع إلى صفحة الإيداع لإنشاء فاتورة جديدة.'}</p></div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#fbfcff] p-5 text-center"><div className="grid h-36 w-36 place-items-center rounded-xl border-4 border-white bg-[#eef3ff] text-[#1557ee] shadow-sm"><QrCode className="h-24 w-24" /></div><p className="mt-4 text-[10px] leading-5 text-slate-400">{invoice.method === 'binance' ? 'حوّل من حساب Binance إلى المعرّف الظاهر.' : 'امسح الرمز من محفظتك ثم أرسل المبلغ المحدد.'}</p></div>
          </div>
          {invoiceStatus !== 'pending' && <div className="mt-7 flex justify-end border-t border-slate-100 pt-6"><button type="button" onClick={() => setInvoice(null)} className="flex items-center justify-center gap-2 rounded-xl bg-[#1557ee] px-5 py-3 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" /> إنشاء فاتورة جديدة</button></div>}
        </section>
      )}
    </main>
  );
}

function WithdrawPage({
  viewerBalance,
  telegramUser,
  onWithdraw,
}: {
  viewerBalance: number;
  telegramUser: TelegramUser | null;
  onWithdraw: (record: WithdrawRecord) => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('binance');
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('');
  const numericAmount = Number(amount);
  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(destination.trim());
  const validBinanceId = /^\d{3,20}$/.test(destination.trim());
  const validDestination = method === 'binance' ? validBinanceId : validAddress;
  const valid = Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= viewerBalance && validDestination;

  const submit = () => {
    if (!valid) return;
    const transactionId = createUniqueIdentifier('WDR');
    onWithdraw({
      id: transactionId,
      amount: numericAmount,
      method,
      destination: destination.trim(),
      memoTag: createMemoTag(telegramUser?.id),
      createdAt: formatHistoryDate(),
      status: 'قيد المعالجة',
    });
    setMessage(`تم إنشاء طلب السحب بقيمة ${numericAmount.toFixed(4)} USDT. الحالة: قيد المعالجة.`);
    setAmount('');
    setDestination('');
  };

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <div className="mb-7"><div className="text-xs font-semibold text-[#1557ee]">مساحة الربح / السحب</div><h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">سحب الأرباح</h1><p className="mt-2 text-sm leading-6 text-slate-500">اختر Binance ID أو محفظة Web3 لاستلام أرباحك، ثم أرسل الطلب للمراجعة.</p></div>
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[24px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-8"><div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">الرصيد المتاح</span><WalletCards className="h-5 w-5 text-cyan-300" /></div><div className="mt-7 text-4xl font-bold tracking-tight">{formatUsd(viewerBalance)}</div><p className="mt-2 text-xs leading-5 text-blue-100/65">الحد الأدنى للسحب 1 USDT. يتم خصم الرصيد عند إرسال الطلب للمراجعة.</p><div className="mt-8 border-t border-white/10 pt-5"><div className="flex items-center gap-2 text-xs font-bold text-cyan-300"><ShieldCheck className="h-4 w-4" /> تحويل آمن</div><p className="mt-2 text-[11px] leading-5 text-blue-100/60">{method === 'binance' ? 'أرسل الأرباح إلى Binance ID مباشرة دون استخدام عنوان محفظة.' : 'استخدم عنوانًا صحيحًا على شبكة BNB Smart Chain (BEP20).'}</p></div></section>
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] md:p-8"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eafbf8] text-[#159b89]"><ArrowUpLeft className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold text-[#12234b]">بيانات الاستلام</h2><p className="mt-1 text-xs text-slate-400">يتم حفظ الطلب في سجل السحب بحالة قيد المعالجة.</p></div></div>
           <div className="mt-7 grid grid-cols-2 gap-2">
            {([
              { value: 'binance', title: 'Binance ID', Icon: WalletCards },
              { value: 'web3', title: 'Web3 Wallet', Icon: Wallet },
            ] as Array<{ value: PaymentMethod; title: string; Icon: typeof Wallet }>).map(({ value, title, Icon }) => (
              <button type="button" key={value} data-testid={`button-withdraw-method-${value}`} onClick={() => setMethod(value)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-right transition ${method === value ? 'border-[#1557ee] bg-[#eff4ff] text-[#1557ee]' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white"><Icon className="h-4 w-4" /></span><span className="truncate whitespace-nowrap text-[11px] font-bold">{title}</span>{method === value && <CheckCircle2 className="mr-auto h-4 w-4" />}</button>
            ))}
          </div>
          <label className="mt-6 block text-xs font-bold text-slate-700">{method === 'binance' ? 'معرّف Binance الرقمي' : 'عنوان محفظة USDT (BEP20)'}<div className="relative mt-2"><Clipboard className="absolute right-4 top-3.5 h-4 w-4 text-slate-400" /><input value={destination} onChange={(event) => setDestination(method === 'binance' ? event.target.value.replace(/\D/g, '') : event.target.value)} inputMode={method === 'binance' ? 'numeric' : 'text'} pattern={method === 'binance' ? '[0-9]*' : undefined} dir="ltr" placeholder={method === 'binance' ? 'مثال: 782946315' : '0x...'} data-testid={method === 'binance' ? 'input-withdraw-binance-id' : 'input-withdraw-address'} className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] py-3 pl-4 pr-11 text-left text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /></div>{destination && !validDestination && <span className="mt-2 block text-[10px] font-medium text-rose-500">{method === 'binance' ? 'أدخل Binance ID رقميًا فقط (3 إلى 20 رقمًا).' : 'أدخل عنوان BEP20 صحيحاً مكوناً من 42 رمزاً.'}</span>}</label>
          <label className="mt-5 block text-xs font-bold text-slate-700">المبلغ (USDT)<div className="relative mt-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" max={viewerBalance} step="0.0001" placeholder={`المتاح: ${viewerBalance.toFixed(4)}`} data-testid="input-withdraw-amount" className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 pl-16 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /><span className="absolute left-4 top-3 rounded-md bg-[#eafbf8] px-2 py-1 text-[10px] font-bold text-[#159b89]">USDT</span></div></label>
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[11px] leading-5 text-amber-800"><div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> راجع البيانات قبل الإرسال</div><p className="mt-1">ستظهر العملية في سجل السحب بحالة قيد المعالجة، ولا يمكن إلغاؤها بعد بدء التحويل.</p></div><button type="button" data-testid="button-submit-withdraw" onClick={submit} disabled={!valid} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1557ee] py-3.5 text-sm font-bold text-white transition hover:bg-[#0f48d0] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><ArrowUpLeft className="h-4 w-4" /> إرسال طلب السحب</button>{message && <div className="mt-4 rounded-xl bg-[#eafbf8] p-3 text-center text-xs font-bold leading-5 text-[#159b89]">{message}</div>}</section>
      </div>
    </main>
  );
}

function DepositHistoryPage({ records }: { records: DepositRecord[] }) {
  const completedTotal = records.filter((record) => record.status === 'تم').reduce((total, record) => total + record.amount, 0);
  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <div className="mb-7"><div className="text-xs font-semibold text-[#1557ee]">إدارة الإعلانات / سجل الإيداع</div><h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">سجل الإيداع</h1><p className="mt-2 text-sm leading-6 text-slate-500">كل فواتير تمويل الإعلانات في صفحة مستقلة، مع حالة كل عملية وطريقة الدفع المستخدمة.</p></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]"><div className="text-[11px] text-slate-400">إجمالي العمليات</div><div className="mt-2 text-2xl font-bold text-[#12234b]">{records.length}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]"><div className="text-[11px] text-slate-400">الإيداعات المكتملة</div><div className="mt-2 text-2xl font-bold text-[#159b89]">${completedTotal.toFixed(2)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]"><div className="text-[11px] text-slate-400">قيد المراجعة</div><div className="mt-2 text-2xl font-bold text-amber-600">{records.filter((record) => record.status === 'قيد المعالجة').length}</div></div></div>
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]"><div className="border-b border-slate-100 px-5 py-5 md:px-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><ArrowDownLeft className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-bold text-[#12234b]">عمليات الإيداع</h2><p className="mt-1 text-xs text-slate-400">المبلغ، طريقة التحويل، والحالة الحالية</p></div></div></div><div className="divide-y divide-slate-100">{records.map((record) => <div key={record.id} data-testid={`row-deposit-${record.id}`} className="px-5 py-5 transition hover:bg-[#fbfcff] md:px-7"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4f8ff] text-[#1557ee]"><DollarSign className="h-4 w-4" /></div><div><div className="text-sm font-bold text-[#12234b]">إيداع {record.amount.toFixed(2)} USDT</div><div className="mt-1 text-[10px] text-slate-400">{record.createdAt}</div></div></div><div className="flex flex-wrap items-center gap-4 text-xs"><div><div className="text-[10px] text-slate-400">الطريقة</div><div className="mt-1 font-bold text-slate-600">{methodLabel(record.method)}</div></div><div className="max-w-[180px]"><div className="text-[10px] text-slate-400">الوجهة</div><code dir="ltr" className="mt-1 block truncate text-[11px] font-bold text-slate-600">{record.destination}</code></div><StatusBadge status={record.status} /></div></div><TransactionIdentifiers record={record} /></div>)}</div></section>
    </main>
  );
}

function WithdrawHistoryPage({ records }: { records: WithdrawRecord[] }) {
  const completedTotal = records.filter((record) => record.status === 'تم').reduce((total, record) => total + record.amount, 0);
  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir="rtl">
      <div className="mb-7"><div className="text-xs font-semibold text-[#1557ee]">مساحة الربح / سجل السحب</div><h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">سجل السحب</h1><p className="mt-2 text-sm leading-6 text-slate-500">تابع جميع طلبات سحب أرباحك بشكل مستقل عن سجل الإيداع.</p></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]"><div className="text-[11px] text-slate-400">إجمالي الطلبات</div><div className="mt-2 text-2xl font-bold text-[#12234b]">{records.length}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]"><div className="text-[11px] text-slate-400">تم تحويله</div><div className="mt-2 text-2xl font-bold text-[#159b89]">${completedTotal.toFixed(2)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-soft)]"><div className="text-[11px] text-slate-400">طلبات قيد المعالجة</div><div className="mt-2 text-2xl font-bold text-amber-600">{records.filter((record) => record.status === 'قيد المعالجة').length}</div></div></div>
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]"><div className="border-b border-slate-100 px-5 py-5 md:px-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eafbf8] text-[#159b89]"><ArrowUpLeft className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-bold text-[#12234b]">طلبات السحب</h2><p className="mt-1 text-xs text-slate-400">وجهة التحويل وحالة مراجعة كل طلب</p></div></div></div><div className="divide-y divide-slate-100">{records.map((record) => <div key={record.id} data-testid={`row-withdraw-${record.id}`} className="px-5 py-5 transition hover:bg-[#fbfcff] md:px-7"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1fcfa] text-[#159b89]"><ArrowUpLeft className="h-4 w-4" /></div><div><div className="text-sm font-bold text-[#12234b]">سحب {record.amount.toFixed(4)} USDT</div><div className="mt-1 text-[10px] text-slate-400">{record.createdAt}</div></div></div><div className="flex flex-wrap items-center gap-4 text-xs"><div><div className="text-[10px] text-slate-400">الطريقة</div><div className="mt-1 font-bold text-slate-600">{methodLabel(record.method)}</div></div><div className="max-w-[180px]"><div className="text-[10px] text-slate-400">الوجهة</div><code dir="ltr" className="mt-1 block truncate text-[11px] font-bold text-slate-600">{record.destination}</code></div><StatusBadge status={record.status} /></div></div><TransactionIdentifiers record={record} /></div>)}</div></section>
    </main>
  );
}

const initialDepositHistory: DepositRecord[] = [
  { id: 'DEP-1042', amount: 120, method: 'binance', destination: depositBinanceId, memoTag: '62182212#1', blockchainTxId: createBlockchainTxId(), createdAt: 'اليوم، 10:12 ص', status: 'تم' },
  { id: 'DEP-1037', amount: 75, method: 'web3', destination: depositAddress, memoTag: '62182212#2', createdAt: '18 سبتمبر، 04:36 م', status: 'تم الإلغاء' },
];

const initialWithdrawHistory: WithdrawRecord[] = [
  { id: 'WDR-2081', amount: 4.25, method: 'binance', destination: '563820147', memoTag: '62182212#3', createdAt: 'أمس، 08:20 م', status: 'قيد المعالجة' },
  { id: 'WDR-2054', amount: 2.8, method: 'web3', destination: '0x4a2F...9C10', memoTag: '62182212#4', blockchainTxId: createBlockchainTxId(), createdAt: '14 سبتمبر، 01:05 م', status: 'تم' },
  { id: 'WDR-2022', amount: 1.5, method: 'binance', destination: '417903628', memoTag: '62182212#5', createdAt: '10 سبتمبر، 11:40 ص', status: 'مرفوض' },
];

function Home() {
  const [mode, setMode] = useState<'creator' | 'viewer'>('creator');
  const [screen, setScreen] = useState<AppScreen>('overview');
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(() => getTelegramUser());
  const [insideTelegram, setInsideTelegram] = useState(() => Boolean(window.Telegram?.WebApp?.initData));
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [tab, setTab] = useState<'all' | 'active' | 'drafts'>('all');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
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
  const watchSessionRef = useRef<AdvertisementSession | null>(null);
  const creditedVideosRef = useRef(new Set<number>());
  const toastSequenceRef = useRef(0);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData) {
      webApp.ready();
      webApp.expand();
      setTelegramUser(webApp.initDataUnsafe?.user ?? null);
      setInsideTelegram(true);
    }
  }, []);

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

  const notify = (tone: ToastTone, title: string, message: string) => {
    const id = ++toastSequenceRef.current;
    setToasts((current) => [...current.slice(-2), { id, tone, title, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  };

  useEffect(() => {
    if (!isPlaying || !selectedVideo || watchSegmentStartedRef.current === null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || watchSegmentStartedRef.current === null) return;
      const elapsed = Math.min(
        selectedVideo.duration * 1000,
        watchElapsedRef.current + (Date.now() - watchSegmentStartedRef.current),
      );
      watchElapsedRef.current = elapsed;
      setProgress(Math.floor(elapsed / 1000));
      saveWatchSession(selectedVideo, elapsed, elapsed >= selectedVideo.duration * 1000 ? 'completed' : 'active');
      if (elapsed >= selectedVideo.duration * 1000) {
        watchSegmentStartedRef.current = null;
        setIsPlaying(false);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPlaying, selectedVideo]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isPlaying && selectedVideo && watchSegmentStartedRef.current !== null) {
        const elapsed = Math.min(
          selectedVideo.duration * 1000,
          watchElapsedRef.current + (Date.now() - watchSegmentStartedRef.current),
        );
        watchElapsedRef.current = elapsed;
        watchSegmentStartedRef.current = null;
        setProgress(Math.floor(elapsed / 1000));
        setIsPlaying(false);
        saveWatchSession(selectedVideo, elapsed, elapsed >= selectedVideo.duration * 1000 ? 'completed' : 'paused');
        if (elapsed < selectedVideo.duration * 1000) {
          notify('warning', 'الإعلان غير مكتمل', 'توقفت المشاهدة قبل إكمال المدة المطلوبة، ولم تُحتسب المكافأة.');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, selectedVideo]);

  const completed = Boolean(selectedVideo && progress >= selectedVideo.duration);
  const viewerCount = useMemo(() => videos.filter((video) => video.status === 'نشط').length, [videos]);

  const selectVideo = (video: Video) => {
    let restoredElapsed = 0;
    let restoredCredited = false;
    let restoredSessionId = '';
    let restoredStatus: AdvertisementSessionStatus = 'paused';
    try {
      const stored = window.localStorage.getItem(`vidreward.watch.${video.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AdvertisementSession>;
        if (parsed.videoId === video.id) {
          restoredElapsed = Math.min(Number(parsed.elapsedMs) || 0, video.duration * 1000);
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
    };
    watchSessionRef.current = nextSession;
    setWatchSession(nextSession);
    if (restoredCredited) creditedVideosRef.current.add(video.id);
    if (restoredElapsed > 0 && restoredElapsed < video.duration * 1000 && !restoredCredited) {
      notify('warning', 'الإعلان غير مكتمل', `تمت استعادة الجلسة ${nextSession.id} دون مكافأة. أكمل المدة المطلوبة ثم أعد التحقق.`);
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
    saveWatchSession(video, video.duration * 1000);
    setViewerBalance((current) => Number((current + calculateViewerReward(video.cpm)).toFixed(4)));
    notify('success', 'تمت إضافة المكافأة', `أضيفت ${video.reward} إلى رصيدك بعد إكمال المدة المطلوبة.`);
  };

  const openWatchInBrowser = (video: Video) => {
    const url = createBrowserWatchUrl(video, telegramUser);
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openLink) {
      webApp.openLink(url, { try_instant_view: false });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f7f9fc] text-[#12234b]">
      <div className="flex min-h-[100dvh] lg:gap-5 lg:p-5">
        <Sidebar mode={mode} screen={screen} telegramUser={telegramUser} onModeChange={(nextMode) => { setMode(nextMode); setScreen(nextMode === 'creator' ? 'overview' : 'watch'); }} onNavigate={setScreen} onAdd={() => { setMode('creator'); setScreen('add'); }} open={mobileMenu} onClose={() => setMobileMenu(false)} />
        {mobileMenu && <button type="button" aria-label="إغلاق خلفية القائمة" data-testid="button-close-menu-overlay" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-40 bg-[#061333]/30 backdrop-blur-sm lg:hidden" />}
        <div className="min-w-0 flex-1 overflow-hidden rounded-none bg-[#f7f9fc] lg:rounded-[26px] lg:border lg:border-slate-200/80 lg:bg-[#fbfcfe]">
          <Header mode={mode} screen={screen} telegramUser={telegramUser} onMenu={() => setMobileMenu(true)} onAdd={() => { setMode('creator'); setScreen('add'); }} />
          {screen === 'add' && mode === 'creator' ? <AddVideo onBack={() => setScreen('campaigns')} onSubmit={(video) => { addVideo(video); notify('success', 'تم نشر الإعلان', 'أصبح الفيديو نشطًا ويمكن للمشاهدين اكتشافه الآن.'); }} />
            : screen === 'deposit' && mode === 'creator' ? <DepositPage advertiserBalance={advertiserBalance} telegramUser={telegramUser} onDepositRequested={requestDeposit} onDepositCompleted={completeDeposit} onDepositExpired={expireDeposit} />
              : screen === 'deposit-history' && mode === 'creator' ? <DepositHistoryPage records={depositHistory} />
                : screen === 'withdraw' && mode === 'viewer' ? <WithdrawPage viewerBalance={viewerBalance} telegramUser={telegramUser} onWithdraw={withdrawEarnings} />
                  : screen === 'withdraw-history' && mode === 'viewer' ? <WithdrawHistoryPage records={withdrawHistory} />
                : screen === 'campaigns' && mode === 'creator' ? <CampaignsPage videos={videos} tab={tab} onTab={setTab} onAdd={() => setScreen('add')} onWatch={selectVideo} />
                : screen === 'watch' && mode === 'viewer' ? <ViewerView videos={videos} balance={viewerBalance} onWithdraw={() => setScreen('withdraw')} onSelect={selectVideo} telegramUser={telegramUser} insideTelegram={insideTelegram} onOpenBrowser={openWatchInBrowser} />
                  : <CreatorOverview advertiserBalance={advertiserBalance} telegramUser={telegramUser} onAdd={() => setScreen('add')} onDeposit={() => setScreen('deposit')} />}
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-md justify-around">
              {mode === 'creator' ? (
                <>
                  <button type="button" data-testid="button-mobile-creator" onClick={() => setScreen('campaigns')} className={`flex flex-col items-center gap-1 px-5 py-1.5 text-[10px] font-bold ${screen === 'campaigns' ? 'text-[#1557ee]' : 'text-slate-400'}`}><LayoutDashboard className="h-5 w-5" /> إعلاناتي</button>
                  <button type="button" data-testid="button-mobile-add" onClick={() => setScreen('add')} className="grid h-11 w-11 -translate-y-4 place-items-center rounded-2xl bg-[#1557ee] text-white shadow-[0_8px_20px_rgba(21,87,238,.25)]"><Plus className="h-5 w-5" /></button>
                   <button type="button" data-testid="button-mobile-ad-wallet" onClick={() => setScreen('deposit')} className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[10px] font-bold ${screen === 'deposit' ? 'text-[#1557ee]' : 'text-slate-400'}`}><WalletCards className="h-5 w-5" /> إيداع رصيد</button>
                   <button type="button" data-testid="button-mobile-deposit-history" onClick={() => setScreen('deposit-history')} className={`flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-bold ${screen === 'deposit-history' ? 'text-[#1557ee]' : 'text-slate-400'}`}><History className="h-5 w-5" /> سجل الإيداع</button>
                </>
              ) : (
                <>
                   <button type="button" data-testid="button-mobile-earn" onClick={() => setScreen('watch')} className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[10px] font-bold ${screen === 'watch' ? 'text-[#1557ee]' : 'text-slate-400'}`}><Eye className="h-5 w-5" /> شاهد واربح</button>
                   <button type="button" data-testid="button-mobile-earnings" onClick={() => setScreen('withdraw')} className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[10px] font-bold ${screen === 'withdraw' ? 'text-[#1557ee]' : 'text-slate-400'}`}><WalletCards className="h-5 w-5" /> سحب الأرباح</button>
                   <button type="button" data-testid="button-mobile-withdraw-history" onClick={() => setScreen('withdraw-history')} className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[10px] font-bold ${screen === 'withdraw-history' ? 'text-[#1557ee]' : 'text-slate-400'}`}><History className="h-5 w-5" /> سجل السحب</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedVideo && <WatchPanel video={selectedVideo} progress={progress} isPlaying={isPlaying} completed={completed} session={watchSession} onPlay={() => {
        if (!completed && document.visibilityState === 'visible') {
          watchSegmentStartedRef.current = Date.now();
          const currentSession = watchSessionRef.current ?? {
            id: createUniqueIdentifier('ADS'),
            videoId: selectedVideo.id,
            elapsedMs: watchElapsedRef.current,
            requiredMs: selectedVideo.duration * 1000,
            status: 'paused' as AdvertisementSessionStatus,
            credited: creditedVideosRef.current.has(selectedVideo.id),
          };
          watchSessionRef.current = { ...currentSession, status: 'active', lastStartedAt: Date.now() };
          setWatchSession(watchSessionRef.current);
          saveWatchSession(selectedVideo, watchElapsedRef.current, 'active');
          setIsPlaying(true);
        }
      }} onComplete={() => creditViewer(selectedVideo)} onClose={() => {
        if (watchSegmentStartedRef.current !== null) {
          watchElapsedRef.current = Math.min(selectedVideo.duration * 1000, watchElapsedRef.current + (Date.now() - watchSegmentStartedRef.current));
          watchSegmentStartedRef.current = null;
          saveWatchSession(selectedVideo, watchElapsedRef.current, watchElapsedRef.current >= selectedVideo.duration * 1000 ? 'completed' : 'paused');
          if (watchElapsedRef.current < selectedVideo.duration * 1000) {
            notify('warning', 'Verification Required', 'لم تكتمل مشاهدة الإعلان، لذلك لم تُحتسب المكافأة.');
          }
        }
        setSelectedVideo(null);
        setIsPlaying(false);
        setWatchSession(null);
      }} />}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      <span className="sr-only" data-testid="text-viewer-count">{viewerCount} فيديو متاح</span>
    </div>
  );
}

function ExternalWatchPage() {
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
          photo_url: photoUrl,
        };
      }
    }
  } catch {
    telegramUser = null;
  }

  return (
    <main className="min-h-[100dvh] bg-[#071632] px-4 py-6 text-white sm:px-8 sm:py-10" dir="rtl">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1557ee]"><Play className="h-4 w-4 fill-current" /></span>
            <div><div className="font-display text-base font-bold">VidReward · المشاهدة</div><div className="mt-1 text-[10px] text-blue-100/60">صفحة فيديو مستقلة للمتصفح</div></div>
          </div>
          {telegramUser && (
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[.06] px-3 py-2">
              <UserAvatar user={telegramUser} className="ring-0" />
              <div className="min-w-0"><div className="truncate text-xs font-bold">{telegramUser.first_name} {telegramUser.last_name ?? ''}</div><div className="mt-0.5 text-[10px] text-blue-100/60" dir="ltr">ID: {telegramUser.id}</div></div>
            </div>
          )}
        </header>
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0d2041] shadow-2xl">
          {validVideoId ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                title={title}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center px-6 text-center">
              <PlaySquare className="h-12 w-12 text-cyan-300" />
              <h1 className="mt-4 text-lg font-bold">تعذّر العثور على فيديو YouTube</h1>
              <p className="mt-2 text-sm leading-6 text-blue-100/60">ارجع إلى VidReward واختر فيديو YouTube نشطًا ثم افتحه في المتصفح.</p>
            </div>
          )}
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-7">{title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-blue-100/60">
                <span>{creator}</span>
                <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {duration} ثانية</span>
                {reward && <span className="font-bold text-cyan-300">المكافأة المعروضة: {reward}</span>}
              </div>
            </div>
            {validVideoId && (
              <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/10">
                <ExternalLink className="h-4 w-4" /> فتح في YouTube
              </a>
            )}
          </div>
        </section>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-6 text-blue-100/50">يمكنك مشاهدة هذا الفيديو هنا مباشرةً. بيانات Telegram المعروضة في الصفحة للتعريف فقط، ولا تُستخدم لتأكيد الهوية أو صرف الأرباح.</p>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/watch" component={ExternalWatchPage} />
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;