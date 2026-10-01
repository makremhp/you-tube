import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider, useLanguage } from '@/i18n';
import { Router } from '@/pages/Router';
import { LandingIntro, type LandingDestination } from '@/components/landing-intro';
import { Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const LANDING_SEEN_KEY = 'vidreward-landing-seen';
const ENTRY_MODE_KEY = 'vidreward-entry-mode';

function ProductExperience() {
  const { language, setLanguage } = useLanguage();
  const [initialMode, setInitialMode] = useState<'creator' | 'viewer'>(() => {
    try {
      return window.localStorage.getItem(ENTRY_MODE_KEY) === 'viewer' ? 'viewer' : 'creator';
    } catch {
      return 'creator';
    }
  });
  const [initialScreen, setInitialScreen] = useState<'watch' | 'add' | null>(null);
  const [showLanding, setShowLanding] = useState(() => {
    try {
      return window.localStorage.getItem(LANDING_SEEN_KEY) !== 'true';
    } catch {
      return true;
    }
  });

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

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      {showLanding ? (
        <LandingIntro
          language={language}
          onLanguageChange={setLanguage}
          onStart={startExperience}
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