import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/pages/Dashboard';
import './App.css';

const AgentDetail = lazy(() =>
  import('@/pages/AgentDetail').then((m) => ({ default: m.AgentDetail }))
);
const Estimator = lazy(() =>
  import('@/pages/Estimator').then((m) => ({ default: m.Estimator }))
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div className="shell">
          <header className="topbar">
            <div className="topbar__content">
              <div className="topbar__brand">
                <span className="topbar__badge">🚁</span>
                <div className="topbar__copy">
                  <span className="topbar__title">Copilot Helicopter View</span>
                </div>
              </div>
            </div>
          </header>
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/agent/:botId"
                element={
                  <Suspense
                    fallback={
                      <div className="spinner-container">
                        <span className="spinner" />
                        Loading…
                      </div>
                    }
                  >
                    <AgentDetail />
                  </Suspense>
                }
              />
              <Route
                path="/estimator"
                element={
                  <Suspense
                    fallback={
                      <div className="spinner-container">
                        <span className="spinner" />
                        Loading…
                      </div>
                    }
                  >
                    <Estimator />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </QueryClientProvider>
  );
}
