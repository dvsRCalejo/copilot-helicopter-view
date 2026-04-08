import { useState, useMemo } from 'react';
import { AgentGrid } from '@/components/AgentGrid';
import { useAgents } from '@/hooks/useAgents';
import { useEnvironments } from '@/hooks/useEnvironments';
import { useAgentChannelsMap } from '@/hooks/useAgentChannelsMap';
import type { FilterMode } from '@/types';
import { searchAndSortAgents } from '@/utils/agentList';

export function Dashboard() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [environmentId, setEnvironmentId] = useState<string | null>(null);

  const { data: environments = [] } = useEnvironments();
  const { data: agents = [], isLoading, error, refetch } = useAgents(filter, environmentId);
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

  const currentEnvironmentName = environments[0]?.displayName ?? 'Current environment';
  const environmentSummary =
    environmentId === null
      ? environments.length > 1
        ? 'Environment: All accessible environments'
        : `Environment: ${currentEnvironmentName}`
      : `Environment: ${environments.find((env) => env.environmentId === environmentId)?.displayName ?? currentEnvironmentName}`;

  return (
    <div className="page">
      <section className="hero-panel">
        <div className="hero-panel__layout">
          <div className="hero-panel__copy">
            <div className="page__title-block">
              <span className="hero-panel__icon">🚁</span>
              <div>
                <h1 className="page__title page__title--hero">Copilot Helicopter View</h1>
                <p className="hero-panel__subtitle">
                  Scan ownership, activity, and rollout status across your Copilot Studio agents in a denser, faster command surface.
                </p>
                <p className="hero-panel__env">{environmentSummary}</p>
              </div>
            </div>
            <div className="hero-panel__stats">
              <div className="hero-panel__stat">
                <span className="hero-panel__stat-value">{sorted.length}</span>
                <span className="hero-panel__stat-label">Visible in current view</span>
              </div>
              <div className="hero-panel__stat">
                <span className="hero-panel__stat-value">{activeCount}</span>
                <span className="hero-panel__stat-label">Active agents</span>
              </div>
            </div>
          </div>
          <div className="hero-panel__actions">
            <div className="page__controls page__controls--inline">
              <input
                className="search-input search-input--wide"
                placeholder="🔎 Search agents, schema names, descriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="page__toolbar-row">
                <button
                  className="btn btn--ghost btn--sm btn--on-dark"
                  onClick={() => void refetch()}
                  disabled={isLoading}
                >
                  Reload
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-panel__insight-grid">
          <div className="hero-panel__insight-card">
            <span className="hero-panel__insight-eyebrow">Ownership</span>
            <span className="hero-panel__insight-value">{ownedCount}</span>
            <span className="hero-panel__insight-label">Owned by you</span>
          </div>
          <div className="hero-panel__insight-card">
            <span className="hero-panel__insight-eyebrow">Collaboration</span>
            <span className="hero-panel__insight-value">{sharedCount}</span>
            <span className="hero-panel__insight-label">Shared with you</span>
          </div>
          <div className="hero-panel__insight-card">
            <span className="hero-panel__insight-eyebrow">Conversations · 7 days</span>
            <span className="hero-panel__insight-value">{conversationsLast7Days}</span>
            <svg className="hero-panel__sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={`0,100 ${sparkPoints} 100,100`} fill="rgba(110, 193, 255, 0.15)" stroke="none" />
              <polyline points={sparkPoints} fill="none" stroke="rgba(110,193,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="hero-panel__insight-card">
            <span className="hero-panel__insight-eyebrow">Last updated</span>
            {lastUpdatedAgent ? (
              <>
                <span className="hero-panel__last-updated-name" title={lastUpdatedAgent.name}>{lastUpdatedAgent.name}</span>
                <span className="hero-panel__last-updated-time">{timeAgo(lastUpdatedAgent.modifiedon)}</span>
              </>
            ) : (
              <span className="hero-panel__insight-label">—</span>
            )}
          </div>
        </div>
      </section>

      <section className="surface-panel">
        <div className="page__header page__header--compact">
          <div>
            <p className="page__subtitle page__subtitle--panel">
              All Copilot Studio agents you own or have access to
            </p>
          </div>
        </div>

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
      </section>
    </div>
  );
}
