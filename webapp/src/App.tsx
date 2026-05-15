import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeStyles, tokens, Button, Spinner } from '@fluentui/react-components';
import { useMsal } from '@azure/msal-react';
import { Dashboard } from '@/pages/Dashboard';

const AgentDetail = lazy(() => import('@/pages/AgentDetail').then((m) => ({ default: m.AgentDetail })));
const Estimator = lazy(() => import('@/pages/Estimator').then((m) => ({ default: m.Estimator })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const useStyles = makeStyles({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: [
      'radial-gradient(circle at top left, rgba(110, 193, 255, 0.22), transparent 28%)',
      'radial-gradient(circle at top right, rgba(74, 222, 128, 0.14), transparent 24%)',
      'linear-gradient(180deg, #f4f8fc 0%, #eef4f8 42%, #f8fafc 100%)',
    ].join(','),
  },
  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    minHeight: '72px',
    background: 'rgba(7, 26, 44, 0.84)',
    backdropFilter: 'blur(14px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `0 clamp(16px, 3vw, 32px)`,
    flexShrink: 0,
  },
  topBarContent: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  topBarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
  },
  topBarBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '22px',
    background: 'linear-gradient(135deg, rgba(110, 193, 255, 0.28), rgba(20, 184, 166, 0.16))',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
    flexShrink: 0,
  },
  topBarCopy: {
    display: 'flex',
    minWidth: 0,
  },
  topBarTitle: {
    color: '#f8fbff',
    fontWeight: tokens.fontWeightBold,
    fontSize: '18px',
    lineHeight: 1.2,
  },
  topBarNav: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  topBarLink: {
    color: '#dcefff',
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    padding: '6px 10px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  main: {
    flex: 1,
    minHeight: 0,
    padding: 'clamp(16px, 3vw, 32px)',
    width: '100%',
    boxSizing: 'border-box',
  },
  signOutButton: {
    color: '#f8fbff',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
  },
});

function TopBar() {
  const { instance, accounts } = useMsal();
  const styles = useStyles();
  const name = accounts[0]?.name ?? accounts[0]?.username ?? '';

  return (
    <div className={styles.topBar}>
      <div className={styles.topBarContent}>
        <div className={styles.topBarBrand}>
          <div className={styles.topBarBadge}>🚁</div>
          <div className={styles.topBarCopy}>
            <span className={styles.topBarTitle}>Copilot Helicopter View</span>
          </div>
        </div>
        <div className={styles.topBarNav}>
          <Button
            appearance="subtle"
            className={styles.signOutButton}
            onClick={() => instance.logoutRedirect()}
            size="small"
          >
            Sign out {name ? `(${name})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const styles = useStyles();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className={styles.shell}>
          <TopBar />
          <main className={styles.main}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/agent/:botId"
                element={
                  <Suspense fallback={<Spinner label="Loading page..." />}>
                    <AgentDetail />
                  </Suspense>
                }
              />
              <Route
                path="/estimator"
                element={
                  <Suspense fallback={<Spinner label="Loading page..." />}>
                    <Estimator />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
