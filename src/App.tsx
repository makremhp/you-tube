import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider, useLanguage } from '@/i18n';
import { Router } from '@/pages/Router';
import { LandingIntro } from '@/components/landing-intro';
import { Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const LANDING_SEEN_KEY = 'vidreward-landing-seen';

function ProductExperience() {
  const { language, setLanguage } = useLanguage();
  const [showLanding, setShowLanding] = useState(() => {
    try {
      return window.localStorage.getItem(LANDING_SEEN_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const startEarning = () => {
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
          onStart={startEarning}
        />
      ) : (
        <Router />
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