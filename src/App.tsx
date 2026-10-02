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

  useEffect(() => {
    const syncTelegramUser = () => {
      const user = getTelegramUser() ?? getTelegramUserFromHash();
      if (user) setTelegramUser(user);
    };
    syncTelegramUser();
    window.addEventListener('hashchange', syncTelegramUser);
    return () => window.removeEventListener('hashchange', syncTelegramUser);
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
      {showLanding ? (
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