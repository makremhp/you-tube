import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider, useLanguage } from '@/i18n';
import { Router } from '@/pages/Router';
import { LandingIntro, type LandingDestination } from '@/components/landing-intro';
import {
  getTelegramUser,
  getTelegramUserFromHash,
  type TelegramUser,
} from '@/legacy/shared';
import { Router as WouterRouter } from 'wouter';
import { apiGet } from '@/lib/api';

const queryClient = new QueryClient();
const LANDING_SEEN_KEY = 'vidreward-landing-seen';
const ENTRY_MODE_KEY = 'vidreward-entry-mode';

function isLandingRoute() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = window.location.pathname;
  const routePath = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : pathname;
  const normalizedRoute = routePath.replace(/\/+$/, '') || '/';
  const isDirectWatchLink = normalizedRoute === '/watch'
    || new URLSearchParams(window.location.search).get('view') === 'earn';

  return !isDirectWatchLink;
}

function ProductExperience() {
  const { language, setLanguage } = useLanguage();
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(
    () => getTelegramUser() ?? getTelegramUserFromHash(),
  );
  const [initialMode, setInitialMode] = useState<'creator' | 'viewer'>(() => {
    try {
      return window.localStorage.getItem(ENTRY_MODE_KEY) === 'viewer' ? 'viewer' : 'creator';
    } catch {
      return 'creator';
    }
  });
  const [initialScreen, setInitialScreen] = useState<'watch' | 'add' | null>(null);
  const [isReturning] = useState(() => {
    try {
      return window.localStorage.getItem(LANDING_SEEN_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showLanding, setShowLanding] = useState(isLandingRoute);
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  useEffect(() => {
    const syncTelegramUser = () => {
      const user = getTelegramUser() ?? getTelegramUserFromHash();
      if (user) setTelegramUser(user);
    };
    syncTelegramUser();
    window.addEventListener('hashchange', syncTelegramUser);
    return () => window.removeEventListener('hashchange', syncTelegramUser);
  }, []);

  useEffect(() => {
    let live = true;
    const checkMaintenance = () => {
      apiGet<{ maintenance: boolean; isAdmin: boolean }>('maintenance')
        .then(result => { if (live) setMaintenanceActive(result.maintenance && !result.isAdmin); })
        .catch(() => undefined);
    };
    checkMaintenance();
    const timer = window.setInterval(checkMaintenance, 30_000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);

  const rememberMode = (mode: 'creator' | 'viewer') => {
    setInitialMode(mode);
    try {
      window.localStorage.setItem(ENTRY_MODE_KEY, mode);
    } catch {
      // The app should still work when browser storage is restricted.
    }
  };

  const startExperience = (destination: LandingDestination) => {
    const mode = destination === 'earn' ? 'viewer' : 'creator';
    rememberMode(mode);
    setInitialScreen(destination === 'earn' ? 'watch' : 'add');
    try {
      window.localStorage.setItem(LANDING_SEEN_KEY, 'true');
    } catch {
      // The app should still open when browser storage is restricted.
    }
    setShowLanding(false);
  };

  const avatarUrl = typeof telegramUser?.photo_url === 'string'
    && /^https?:\/\//i.test(telegramUser.photo_url)
    ? telegramUser.photo_url
    : null;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      {maintenanceActive ? (
        <main dir={language === 'ar' ? 'rtl' : 'ltr'} className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#101827] px-5 py-8 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(251,191,36,.16),transparent_60%)]" />
          <section className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,.42)] backdrop-blur sm:p-9">
            <div className="mx-auto grid h-56 w-56 max-w-full place-items-center rounded-full bg-black/20 p-2">
              <img src={`${import.meta.env.BASE_URL}assets/maintenance-work.png`} alt={language === 'ar' ? 'رسم توضيحي لأعمال الصيانة' : 'Maintenance work illustration'} className="h-full w-full object-contain" />
            </div>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />{language === 'ar' ? 'تحديث مؤقت' : 'TEMPORARY UPDATE'}</span>
            <h1 className="mt-4 text-2xl font-extrabold">{language === 'ar' ? 'المنصة تحت الصيانة' : 'We’ll be back shortly'}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-blue-100/70">{language === 'ar' ? 'نعمل على تحسين الخدمة. بيانات حسابك محفوظة، وستعود المنصة للعمل فور انتهاء التحديث.' : 'We’re improving the service. Your account data is safe, and the platform will return as soon as maintenance is complete.'}</p>
            <button type="button" onClick={() => apiGet<{ maintenance: boolean; isAdmin: boolean }>('maintenance').then((result) => setMaintenanceActive(result.maintenance && !result.isAdmin)).catch(() => undefined)} className="mt-6 min-h-11 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10">{language === 'ar' ? 'إعادة التحقق' : 'Check again'}</button>
          </section>
        </main>
      ) : showLanding ? (
        <LandingIntro
          language={language}
          onLanguageChange={setLanguage}
          onStart={startExperience}
          isReturning={isReturning}
          avatarUrl={avatarUrl}
          avatarName={telegramUser?.first_name ?? null}
        />
      ) : (
        <Router
          initialMode={initialMode}
          initialScreen={initialScreen}
          onModeChange={rememberMode}
        />
      )}
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <ProductExperience />
        </LanguageProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;