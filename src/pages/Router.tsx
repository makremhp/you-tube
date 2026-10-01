import { type ReactNode } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { ExternalWatchPage } from '@/pages/ExternalWatchPage';
import { HomePage } from '@/pages/HomePage';

type RouterProps = {
  initialMode: 'creator' | 'viewer';
  initialScreen: 'watch' | 'add' | null;
  onModeChange: (mode: 'creator' | 'viewer') => void;
};

export function Router({ initialMode, initialScreen, onModeChange }: RouterProps) {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/watch" component={ExternalWatchPage} />
        <Route path="/">
          {() => (
            <HomePage
              initialMode={initialMode}
              initialScreen={initialScreen}
              onModeChange={onModeChange}
            />
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
