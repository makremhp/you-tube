import { type ReactNode } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { ExternalWatchPage } from '@/pages/ExternalWatchPage';
import { HomePage } from '@/pages/HomePage';

export function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/watch" component={ExternalWatchPage} />
        <Route path="/" component={HomePage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
