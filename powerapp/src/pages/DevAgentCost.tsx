import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAgents } from '@/hooks/useAgents';
import { useTranscripts } from '@/hooks/useTranscripts';
import { estimateMonthlyCost, formatCredits, formatUsd, inferFromTranscripts } from '@/utils/costEstimator';

function inferBillingMode(configuration: string | null | undefined): { mode: string; confidence: 'low' | 'medium' } {
  const cfg = (configuration ?? '').toLowerCase();
  if (!cfg) return { mode: 'unknown', confidence: 'low' };
  if (cfg.includes('paygo') || cfg.includes('pay as you go')) {
    return { mode: 'paygo', confidence: 'medium' };
  }
  if (cfg.includes('license') || cfg.includes('m365')) {
    return { mode: 'm365-license', confidence: 'medium' };
  }
  if (cfg.includes('credit')) {
    return { mode: 'credits', confidence: 'medium' };
  }
  return { mode: 'unknown', confidence: 'low' };
}

export function DevAgentCost() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBotId = searchParams.get('botId');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(initialBotId);

  const { data: agents = [], isLoading: agentsLoading } = useAgents();

  useEffect(() => {
    setSelectedBotId(initialBotId);
  }, [initialBotId]);

  useEffect(() => {
    if (!selectedBotId && agents.length > 0) {
      const fallbackBotId = agents[0].botid;
      setSelectedBotId(fallbackBotId);
      setSearchParams({ botId: fallbackBotId }, { replace: true });
    }
  }, [agents, selectedBotId, setSearchParams]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.botid === selectedBotId) ?? null,
    [agents, selectedBotId],
  );

  const { data: transcripts = [], isLoading: transcriptsLoading } = useTranscripts(
    selectedAgent?.botid,
  );

  const baseline = useMemo(() => {
    if (!selectedAgent) return null;
    return inferFromTranscripts(transcripts, selectedAgent, 'standard');
  }, [selectedAgent, transcripts]);

  const result = useMemo(() => {
    if (!baseline) return null;
    return estimateMonthlyCost(baseline.input);
  }, [baseline]);

  const billing = useMemo(
    () => inferBillingMode(selectedAgent?.configuration),
    [selectedAgent?.configuration],
  );

  return (
    <section className="page" aria-label="Real Agent Cost Per Agent">
      <div className="surface-panel" style={{ padding: 20 }}>
        <div className="page__header page__header--compact" style={{ marginBottom: 10 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
            ← Back to dashboard
          </button>
          <h1 className="page__title" style={{ margin: 0 }}>
            Real Agent Cost (Per Agent)
          </h1>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="agent-select">Agent</label>
          <div style={{ marginTop: 8 }}>
            <select
              id="agent-select"
              value={selectedAgent?.botid ?? ''}
              onChange={(e) => {
                const botId = e.target.value;
                setSelectedBotId(botId);
                setSearchParams({ botId }, { replace: true });
              }}
              style={{ minWidth: 320, maxWidth: '100%', padding: '8px 10px' }}
            >
              {agents.map((agent) => (
                <option key={agent.botid} value={agent.botid}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(agentsLoading || transcriptsLoading) && (
          <div className="spinner-container" style={{ justifyContent: 'flex-start' }}>
            <span className="spinner" />
            Loading live agent usage data from Dataverse...
          </div>
        )}

        {!agentsLoading && !selectedAgent && (
          <p>No accessible agents were found for this account/environment.</p>
        )}

        {selectedAgent && baseline && result && (
          <>
            <p className="page__subtitle" style={{ marginBottom: 8 }}>
              Source: Dataverse transcripts + agent configuration
            </p>
            <div className="agent-detail__meta agent-detail__meta--panel" style={{ marginBottom: 16 }}>
              <span>Agent: {selectedAgent.name}</span>
              <span>
                Billing mode (inferred): {billing.mode} (confidence: {billing.confidence})
              </span>
              <span>Sessions/month (from transcripts): {baseline.input.sessionsPerMonth.toLocaleString()}</span>
              <span>Observed transcripts: {baseline.stats.totalSessions.toLocaleString()}</span>
              <span>Avg bot replies/session: {baseline.stats.avgBotRepliesPerSession.toFixed(2)}</span>
            </div>

            <h2 className="page__title" style={{ fontSize: 22, marginBottom: 8 }}>
              Estimated monthly cost (usage-backed)
            </h2>
            <p style={{ marginTop: 0 }}>Credits: {formatCredits(result.totalCredits)}</p>
            <p>USD: {formatUsd(result.totalUsd)}</p>
            <ul>
              {result.breakdown
                .filter((item) => item.monthlyCredits > 0)
                .map((item) => (
                  <li key={item.featureId}>
                    {item.label}: {item.perSession}/session x {item.unitCredits} credits = {formatCredits(item.monthlyCredits)} credits
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
