import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgents } from '@/hooks/useAgents';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { extractConfiguredChannels, getChannelInfo } from '@/types';

type TabKey = 'analytics' | 'transcripts';

export function AgentDetail() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('analytics');

  const { data: agents = [], isLoading: agentsLoading } = useAgents();
  const agent = agents.find((a) => a.botid === botId);

  const {
    data: transcripts,
    isLoading: transcriptsLoading,
    error: transcriptsError,
  } = useTranscripts(botId);

  const { analytics, sessions } = useAnalytics(transcripts);

  const channels = useMemo(() => {
    if (!agent?.configuration) return [];
    const labelMap = new Map<string, { label: string; icon: string }>();
    for (const channelId of extractConfiguredChannels(agent.configuration)) {
      const info = getChannelInfo(channelId);
      if (!labelMap.has(info.label)) labelMap.set(info.label, info);
    }
    return Array.from(labelMap.values());
  }, [agent?.configuration]);

  if (agentsLoading) {
    return (
      <div className="spinner-container">
        <span className="spinner" />
        Loading agent…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="message message--error">
        Agent not found or you do not have access.{' '}
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
          Go back
        </button>
      </div>
    );
  }

  const isActive = agent.statecode === 0;
  const agentStudioUrl = agent.environmentId
    ? `https://copilotstudio.microsoft.com/environments/${encodeURIComponent(agent.environmentId)}/bots/${encodeURIComponent(agent.botid)}`
    : null;

  return (
    <div className="page">
      <button className="btn btn--ghost" onClick={() => navigate('/')}>
        ← All agents
      </button>

      <section className="surface-panel surface-panel--detail-hero">
        <div className="agent-detail__header">
          <div>
            <h1 className="agent-detail__name">{agent.name}</h1>
            <div className="agent-detail__badges">
              <span className={`badge badge--${isActive ? 'success' : 'danger'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
              <span className={`badge badge--${agent.isOwner ? 'brand' : 'info'}`}>
                {agent.isOwner ? 'Owner' : 'Co-owner'}
              </span>
              {agent.runtimeprovider === 1 && (
                <span className="badge badge--success">Generative</span>
              )}
            </div>
            {channels.length > 0 && (
              <div className="agent-detail__channels">
                <span className="agent-detail__channels-label">Channels</span>
                {channels.map((ch) => (
                  <span key={ch.label} className="badge badge--outline">
                    {ch.icon} {ch.label}
                  </span>
                ))}
              </div>
            )}
            {agent.description && <p className="agent-detail__desc">{agent.description}</p>}
            {agentStudioUrl && (
              <p className="agent-detail__desc" style={{ marginTop: 8 }}>
                <a href={agentStudioUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                  Open in Copilot Studio ↗
                </a>
              </p>
            )}
          </div>

          <div className="agent-detail__meta agent-detail__meta--panel">
            <span>
              Published:{' '}
              {agent.publishedon
                ? new Date(agent.publishedon).toLocaleDateString()
                : 'Never'}
            </span>
            <span>Modified: {new Date(agent.modifiedon).toLocaleDateString()}</span>
            {agent.schemaname && <span>Schema: {agent.schemaname}</span>}
          </div>
        </div>
      </section>

      <section className="surface-panel surface-panel--tab-shell">
        <div className="tabs">
          {(['analytics', 'transcripts'] as TabKey[]).map((t) => (
            <button
              key={t}
              className={`tab${tab === t ? ' tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'analytics'
                ? 'Analytics'
                : `Transcripts${transcripts ? ` (${transcripts.length})` : ''}`}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'analytics' && <AnalyticsPanel analytics={analytics} sessions={sessions} />}
          {tab === 'transcripts' && (
            <TranscriptViewer
              transcripts={transcripts}
              isLoading={transcriptsLoading}
              error={transcriptsError}
            />
          )}
        </div>
      </section>
    </div>
  );
}
