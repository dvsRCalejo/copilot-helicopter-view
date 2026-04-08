import { useState, useMemo } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Input,
  Button,
} from '@fluentui/react-components';
import { AgentGrid } from '@/components/AgentGrid';
import { useAgents } from '@/hooks/useAgents';
import { useEnvironments } from '@/hooks/useEnvironments';
import { useAgentChannelsMap } from '@/hooks/useAgentChannelsMap';
import type { FilterMode } from '@/types';
import { searchAndSortAgents } from '@/utils/agentList';

const DATAVERSE_URL = (import.meta.env.VITE_DATAVERSE_URL as string | undefined)?.replace(/\/$/, '');

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    gap: '24px',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: 'clamp(20px, 4vw, 36px)',
    borderRadius: '28px',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    background: [
      'radial-gradient(circle at top right, rgba(110, 193, 255, 0.28), transparent 32%)',
      'linear-gradient(135deg, rgba(7, 26, 44, 0.96), rgba(15, 108, 189, 0.92) 52%, rgba(15, 141, 158, 0.84))',
    ].join(','),
    color: '#f8fbff',
    boxShadow: '0 24px 60px rgba(15, 43, 70, 0.16)',
  },
  heroCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  heroLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)',
    alignItems: 'start',
    gap: '18px',
  },
  titleBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  heroIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '22px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '36px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 18px 34px rgba(0, 0, 0, 0.16)',
  },
  title: {
    fontSize: 'clamp(28px, 4vw, 44px)',
    lineHeight: 1,
  },
  subtitle: {
    color: 'rgba(238, 247, 255, 0.82)',
    maxWidth: '64ch',
    fontSize: '15px',
  },
  envSummary: {
    color: 'rgba(238, 247, 255, 0.74)',
    fontSize: '13px',
  },
  heroStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 168px))',
    gap: '10px',
    width: 'fit-content',
    maxWidth: '100%',
  },
  heroStat: {
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.14)',
    backdropFilter: 'blur(12px)',
  },
  heroStatValue: {
    fontSize: '20px',
    color: '#ffffff',
  },
  heroActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '12px',
    padding: '16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.16)',
    backdropFilter: 'blur(14px)',
  },
  searchBar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '10px',
    width: '100%',
  },
  searchInput: {
    width: '100%',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    width: '100%',
  },
  insightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
    width: '100%',
  },
  insightCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 16px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(10px)',
    minWidth: 0,
  },
  insightEyebrow: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(238, 247, 255, 0.62)',
  },
  insightValue: {
    fontSize: '22px',
    lineHeight: 1.1,
    color: '#ffffff',
  },
  insightLabel: {
    fontSize: '12px',
    color: 'rgba(238, 247, 255, 0.78)',
  },
  sparkline: {
    width: '100%',
    height: '36px',
    marginTop: '2px',
  },
  lastUpdatedName: {
    fontSize: '14px',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lastUpdatedTime: {
    fontSize: '12px',
    color: 'rgba(238, 247, 255, 0.68)',
  },
  surface: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: 'clamp(16px, 2.4vw, 24px)',
    borderRadius: '28px',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    background: 'rgba(255,255,255,0.76)',
    boxShadow: '0 20px 48px rgba(15, 43, 70, 0.08)',
    backdropFilter: 'blur(12px)',
  },
  content: {
    minHeight: 0,
  },
  '@media (max-width: 720px)': {
    hero: {
      borderRadius: '22px',
    },
    heroLayout: {
      gridTemplateColumns: '1fr',
    },
    heroActions: {
      padding: '14px',
    },
    heroStats: {
      gridTemplateColumns: '1fr',
      width: '100%',
    },
    insightGrid: {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
});

export function Dashboard() {
  const styles = useStyles();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [environmentId, setEnvironmentId] = useState<string | null>(null);

  const { data: environments = [], isLoading: envsLoading, error: envsError } = useEnvironments();
  const { data: agents = [], isLoading: agentsLoading, error: agentsError, refetch } = useAgents(filter, environmentId);
  const isLoading = envsLoading || agentsLoading;
  const error = envsError ?? agentsError;

  const sorted = searchAndSortAgents(agents, search);
  const { channelsMap, allTranscripts } = useAgentChannelsMap(agents);
  const activeCount = agents.filter((agent) => agent.statecode === 0).length;
  const ownedCount = agents.filter((agent) => agent.isOwner).length;
  const sharedCount = Math.max(agents.length - ownedCount, 0);
  const conversationsLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return allTranscripts.filter((t) => {
      const created = Date.parse(t.createdon);
      return Number.isFinite(created) && created >= cutoff;
    }).length;
  }, [allTranscripts]);

  // 7-day sparkline data (conversations per day)
  const dayMs = 86_400_000;
  const nowMs = Date.now();
  const sparkData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const lo = nowMs - (6 - i) * dayMs;
    return allTranscripts.filter((t) => { const c = Date.parse(t.createdon); return c >= lo && c < lo + dayMs; }).length;
  }), [allTranscripts, nowMs]);
  const sparkMax = Math.max(...sparkData, 1);
  const sparkPoints = sparkData.map((v, i) => `${(i / 6) * 100},${100 - (v / sparkMax) * 80}`).join(' ');

  // Last updated agent
  const lastUpdatedAgent = agents.length
    ? [...agents].sort((a, b) => Date.parse(b.modifiedon) - Date.parse(a.modifiedon))[0]
    : null;
  const timeAgo = (ds: string) => {
    const d = Date.now() - Date.parse(ds);
    const m = Math.floor(d / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const currentEnvironmentName =
    environments.find((env) => env.instanceUrl.replace(/\/$/, '') === DATAVERSE_URL)?.displayName ??
    environments[0]?.displayName ??
    'Current environment';
  const environmentSummary =
    environmentId === null
      ? environments.length > 1
        ? 'Environment: All accessible environments'
        : `Environment: ${currentEnvironmentName}`
      : `Environment: ${environments.find((env) => env.environmentId === environmentId)?.displayName ?? currentEnvironmentName}`;

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <div className={styles.titleBlock}>
              <div className={styles.heroIcon}>🚁</div>
              <div>
                <Text as="h1" className={styles.title} weight="bold" block>
                  Copilot Helicopter View
                </Text>
                <Text className={styles.subtitle}>
                  Scan ownership, activity, and rollout status across your Copilot Studio agents in a denser, faster command surface.
                </Text>
                <Text className={styles.envSummary}>{environmentSummary}</Text>
              </div>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <Text className={styles.heroStatValue} weight="bold" block>{sorted.length}</Text>
                <Text size={200} style={{ color: 'rgba(238, 247, 255, 0.76)' }}>Visible in current view</Text>
              </div>
              <div className={styles.heroStat}>
                <Text className={styles.heroStatValue} weight="bold" block>{activeCount}</Text>
                <Text size={200} style={{ color: 'rgba(238, 247, 255, 0.76)' }}>Active agents</Text>
              </div>
            </div>
          </div>
          <div className={styles.heroActions}>
            <div className={styles.searchBar}>
              <Input
                className={styles.searchInput}
                contentBefore={<span aria-hidden="true">🔎</span>}
                placeholder="Search agents, schema names, descriptions..."
                value={search}
                onChange={(_, d) => setSearch(d.value)}
              />
              <div className={styles.toolbar}>
                <Button appearance="secondary" onClick={() => refetch()} disabled={isLoading}>
                  Reload
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.insightGrid}>
          <div className={styles.insightCard}>
            <Text className={styles.insightEyebrow}>Ownership</Text>
            <Text className={styles.insightValue} weight="bold">{ownedCount}</Text>
            <Text className={styles.insightLabel}>Owned by you</Text>
          </div>
          <div className={styles.insightCard}>
            <Text className={styles.insightEyebrow}>Collaboration</Text>
            <Text className={styles.insightValue} weight="bold">{sharedCount}</Text>
            <Text className={styles.insightLabel}>Shared with you</Text>
          </div>
          <div className={styles.insightCard}>
            <Text className={styles.insightEyebrow}>Conversations · 7 days</Text>
            <Text className={styles.insightValue} weight="bold">{conversationsLast7Days}</Text>
            <svg className={styles.sparkline} viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={`0,100 ${sparkPoints} 100,100`} fill="rgba(110, 193, 255, 0.15)" stroke="none" />
              <polyline points={sparkPoints} fill="none" stroke="rgba(110,193,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.insightCard}>
            <Text className={styles.insightEyebrow}>Last updated</Text>
            {lastUpdatedAgent ? (
              <>
                <Text className={styles.lastUpdatedName} title={lastUpdatedAgent.name}>{lastUpdatedAgent.name}</Text>
                <Text className={styles.lastUpdatedTime}>{timeAgo(lastUpdatedAgent.modifiedon)}</Text>
              </>
            ) : (
              <Text className={styles.insightLabel}>—</Text>
            )}
          </div>
        </div>
      </section>

      <div className={styles.surface}>
        <AgentGrid
          agents={sorted}
          filter={filter}
          onFilterChange={setFilter}
          isLoading={isLoading}
          error={error}
          environments={environments}
          selectedEnvironmentId={environmentId}
          onEnvironmentChange={setEnvironmentId}
          channelsMap={channelsMap}
        />
      </div>
    </div>
  );
}
