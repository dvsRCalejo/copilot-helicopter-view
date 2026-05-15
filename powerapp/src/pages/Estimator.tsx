import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAgents } from '@/hooks/useAgents';
import { useTranscripts } from '@/hooks/useTranscripts';
import {
  buildDefaultInput,
  creditRates,
  detectAgentFeatures,
  estimateAutoPerSession,
  estimateMonthlyCost,
  formatCredits,
  formatUsd,
  inferFromTranscripts,
} from '@/utils/costEstimator';

export function Estimator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBotId = searchParams.get('botId');

  const { data: agents = [] } = useAgents();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(initialBotId);
  const selectedAgent = useMemo(
    () => agents.find((a) => a.botid === selectedBotId) ?? null,
    [agents, selectedBotId],
  );

  const [agentTypeId, setAgentTypeId] = useState<string>('standard');
  const [sessionsPerMonth, setSessionsPerMonth] = useState<number>(1000);
  const [perSession, setPerSession] = useState<Record<string, number>>(
    () => buildDefaultInput(selectedAgent, 'standard').perSession,
  );

  const { data: transcripts, isLoading: transcriptsLoading } = useTranscripts(
    selectedAgent?.botid,
  );

  const baseline = useMemo(
    () =>
      selectedAgent && transcripts && transcripts.length > 0
        ? inferFromTranscripts(transcripts, selectedAgent, agentTypeId)
        : null,
    [selectedAgent, transcripts, agentTypeId],
  );

  const detection = useMemo(() => {
    if (!selectedAgent) return null;
    return baseline?.detection ?? detectAgentFeatures(selectedAgent, agentTypeId);
  }, [selectedAgent, agentTypeId, baseline]);

  const appliedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!baseline?.hasSignal) return;
    const key = `${selectedAgent?.botid ?? ''}|${agentTypeId}`;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;
    setSessionsPerMonth(baseline.input.sessionsPerMonth);
    setPerSession(baseline.input.perSession);
  }, [baseline, selectedAgent?.botid, agentTypeId]);

  const applyDefaults = (typeId: string, agent = selectedAgent) => {
    const def = buildDefaultInput(agent, typeId);
    setAgentTypeId(typeId);
    setSessionsPerMonth(def.sessionsPerMonth);
    setPerSession(def.perSession);
    appliedKeyRef.current = null;
  };

  const applyTranscriptBaseline = () => {
    if (!baseline?.hasSignal) return;
    setSessionsPerMonth(baseline.input.sessionsPerMonth);
    setPerSession(baseline.input.perSession);
  };

  const result = useMemo(
    () => estimateMonthlyCost({ agentTypeId, sessionsPerMonth, perSession }),
    [agentTypeId, sessionsPerMonth, perSession],
  );

  const applicableFeatures = useMemo(
    () => creditRates.features.filter((f) => f.appliesTo.includes(agentTypeId)),
    [agentTypeId],
  );

  const autoPerSession = useMemo(() => {
    if (!selectedAgent) return null;
    if (baseline?.hasSignal) return baseline.input.perSession;

    const defaultConversationalUnits = agentTypeId === 'autonomous'
      ? 1
      : selectedAgent.runtimeprovider === 0
        ? 3
        : 2;
    return estimateAutoPerSession(
      selectedAgent,
      agentTypeId,
      defaultConversationalUnits,
    ).perSession;
  }, [selectedAgent, baseline, agentTypeId]);

  const maxDetectionCount = useMemo(() => {
    if (!detection) return 0;
    return applicableFeatures.reduce(
      (max, f) => Math.max(max, detection.byFeature[f.id] ?? 0),
      0,
    );
  }, [detection, applicableFeatures]);

  return (
    <div className="page">
      <button className="btn btn--ghost" onClick={() => navigate('/')}>
        ← Back to dashboard
      </button>

      <section className="hero-panel">
        <div className="hero-panel__copy">
          <div className="page__title-block">
            <span className="hero-panel__icon">💸</span>
            <div>
              <h1 className="page__title page__title--hero">Copilot Credit Estimator</h1>
              <p className="hero-panel__subtitle">
                Forecast monthly Copilot credit consumption for a Copilot Studio agent. Defaults
                are inferred from each agent's runtime; tweak per-session feature usage and
                sessions/month to match expected workload.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="estimator__layout">
        <section className="surface-panel estimator__inputs">
          <h2 className="estimator__section-title">Inputs</h2>

          {selectedAgent && (
            <div
              className={`estimator__baseline${
                baseline?.hasSignal ? ' estimator__baseline--signal' : ''
              }`}
            >
              {transcriptsLoading ? (
                <>
                  <span className="spinner spinner--xs" />
                  <span>Reading transcripts for <strong>{selectedAgent.name}</strong>…</span>
                </>
              ) : baseline?.hasSignal ? (
                <>
                  <span className="badge badge--success">Baseline from transcripts</span>
                  <span>
                    {baseline.stats.totalSessions} session
                    {baseline.stats.totalSessions === 1 ? '' : 's'} observed
                    {baseline.extrapolated
                      ? ` (over ${baseline.stats.daysObserved} day${
                          baseline.stats.daysObserved === 1 ? '' : 's'
                        }, extrapolated to /month)`
                      : ' in the last 30 days'}
                    {' · '}avg {baseline.stats.avgMessagesPerSession.toFixed(1)} msgs/session
                    {' · '}~{Math.max(1, Math.round(baseline.stats.avgBotRepliesPerSession))} bot
                    {Math.max(1, Math.round(baseline.stats.avgBotRepliesPerSession)) === 1
                      ? ' reply'
                      : ' replies'}
                    /session
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={applyTranscriptBaseline}
                  >
                    Re-apply
                  </button>
                </>
              ) : (
                <span>
                  No transcripts found for <strong>{selectedAgent.name}</strong> — using
                  runtime-based defaults.
                </span>
              )}
            </div>
          )}

          <div className="estimator__field-grid">
            <label className="estimator__field">
              <span className="estimator__field-label">Agent (optional)</span>
              <select
                className="estimator__select"
                value={selectedBotId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setSelectedBotId(id);
                  appliedKeyRef.current = null;
                  const agent = agents.find((a) => a.botid === id) ?? null;
                  applyDefaults(agentTypeId, agent);
                }}
              >
                <option value="">No agent selected</option>
                {agents.map((a) => (
                  <option key={a.botid} value={a.botid}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="estimator__field">
              <span className="estimator__field-label">Agent type</span>
              <select
                className="estimator__select"
                value={agentTypeId}
                onChange={(e) => applyDefaults(e.target.value)}
              >
                {creditRates.agentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="estimator__field">
              <span className="estimator__field-label">Sessions / month</span>
              <input
                className="estimator__input"
                type="number"
                min={0}
                value={sessionsPerMonth}
                onChange={(e) => setSessionsPerMonth(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <div className="estimator__field">
              <span className="estimator__field-label">&nbsp;</span>
              <button
                className="btn btn--ghost"
                onClick={() => applyDefaults(agentTypeId)}
                type="button"
              >
                Reset to defaults
              </button>
            </div>
          </div>

          <hr className="estimator__divider" />

          <h3 className="estimator__section-title estimator__section-title--sub">
            Per-session feature usage
          </h3>
          <p className="estimator__feature-explainer">
            Auto/session = suggested value per session from transcripts + detected feature signals.
            You can override it in Per session.
          </p>
          <p className="estimator__feature-disclaimer">
            Disclaimer: Feature detection and Auto/session values are heuristic estimates based on
            available configuration and transcript patterns. They may be incomplete or inaccurate,
            so validate before business or contractual decisions.
          </p>
          <div className="estimator__feature-table">
            <div className="estimator__feature-row estimator__feature-row--head">
              <span>Feature</span>
              <span>Credits / unit</span>
              <span title="Auto/session is the suggested per-session value inferred from transcripts and agent-configuration feature signals. You can override it in the Per session column.">
                Auto / session
              </span>
              <span>Per session</span>
            </div>
            {applicableFeatures.map((f) => (
              <div key={f.id} className="estimator__feature-row">
                <div className="estimator__feature-label">
                  <span className="estimator__feature-name">{f.label}</span>
                  <span className="estimator__feature-hint">{f.description}</span>
                  {selectedAgent && (
                    (() => {
                      const count = detection?.byFeature[f.id] ?? 0;
                      const pct = maxDetectionCount > 0
                        ? Math.max(6, Math.round((count / maxDetectionCount) * 100))
                        : 0;
                      return (
                        <span className="estimator__feature-detection-hint">
                          <span
                            className="estimator__detection-pill"
                            style={count > 0
                              ? { background: '#1db95422', color: '#1a4d2e', border: '1px solid #1db954' }
                              : { background: '#f3f3f3', color: '#888', border: '1px solid #d1d1d1' }}
                          >
                            {count > 0 ? 'Detected' : 'Not detected'}: {count}
                          </span>
                          <span className="estimator__detection-meter-track" aria-hidden="true">
                            <span
                              className="estimator__detection-meter-fill"
                              style={{ width: `${count > 0 ? pct : 0}%` }}
                            />
                          </span>
                        </span>
                      );
                    })()
                  )}
                </div>

                <span className="estimator__feature-credits">{f.credits}</span>
                <span className="estimator__feature-auto">
                  {autoPerSession ? (autoPerSession[f.id] ?? 0) : '-'}
                </span>
                <input
                  className="estimator__input"
                  type="number"
                  min={0}
                  value={perSession[f.id] ?? 0}
                  onChange={e => setPerSession(prev => ({
                    ...prev,
                    [f.id]: Math.max(0, Number(e.target.value) || 0),
                  }))}
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="surface-panel estimator__results">
          <h2 className="estimator__section-title">Estimated monthly cost</h2>
          <div className="estimator__totals">
            <span className="estimator__total-number">{formatUsd(result.totalUsd)}</span>
            <span className="estimator__total-label">
              {formatCredits(result.totalCredits)} Copilot credits / month
            </span>
            <span className="estimator__total-label">
              {formatCredits(result.perSessionCredits)} credits / session ·{' '}
              {formatUsd(result.perSessionUsd)} / session
            </span>
          </div>

          <hr className="estimator__divider" />
          <h3 className="estimator__section-title estimator__section-title--sub">Breakdown</h3>
          {result.breakdown.filter((b) => b.perSession > 0).length === 0 ? (
            <p className="estimator__empty">Set at least one feature above to see a breakdown.</p>
          ) : (
            result.breakdown
              .filter((b) => b.perSession > 0)
              .map((b) => (
                <div key={b.featureId} className="estimator__breakdown-row">
                  <span className="estimator__breakdown-label">{b.label}</span>
                  <span className="estimator__breakdown-value">{formatUsd(b.monthlyUsd)}</span>
                </div>
              ))
          )}

          <hr className="estimator__divider" />
          <p className="estimator__disclaimer">
            1 Copilot credit = ${creditRates.creditUnitUsd.toFixed(2)} USD. Defaults are based on
            the public{' '}
            <a
              href="https://microsoft.github.io/copilot-studio-estimator/"
              target="_blank"
              rel="noreferrer"
            >
              Copilot Studio Estimator
            </a>
            . This is an informational estimate only — verify against official Microsoft pricing
            before contractual decisions.
          </p>
        </aside>
      </div>
    </div>
  );
}
