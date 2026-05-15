import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Dropdown,
  Option,
  Input,
  SpinButton,
  Divider,
  Tooltip,
  Badge,
  Spinner,
} from '@fluentui/react-components';
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

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  backRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: 'clamp(20px, 3vw, 28px)',
    borderRadius: '24px',
    background: [
      'radial-gradient(circle at top right, rgba(110, 193, 255, 0.28), transparent 32%)',
      'linear-gradient(135deg, rgba(7, 26, 44, 0.96), rgba(15, 108, 189, 0.92) 52%, rgba(15, 141, 158, 0.84))',
    ].join(','),
    color: '#f8fbff',
    boxShadow: '0 24px 60px rgba(15, 43, 70, 0.16)',
  },
  heroTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  heroIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '18px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '28px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.18)',
  },
  heroSubtitle: {
    color: 'rgba(238, 247, 255, 0.82)',
    maxWidth: '72ch',
    fontSize: '14px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
    gap: '20px',
    alignItems: 'start',
  },
  card: {
    padding: 'clamp(18px, 2.4vw, 24px)',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.86)',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    boxShadow: '0 18px 42px rgba(15, 43, 70, 0.08)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(7, 26, 44, 0.65)',
  },
  featureRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 110px 110px 120px',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
  },
  featureLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  featureHint: {
    fontSize: '12px',
    color: 'rgba(7, 26, 44, 0.6)',
  },
  featureDetectionHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '8px',
    marginBottom: '4px',
  },
  featureDisclaimer: {
    marginTop: '2px',
    fontSize: '12px',
    color: '#8a6a00',
    background: 'rgba(255, 240, 196, 0.55)',
    border: '1px solid rgba(199, 140, 0, 0.26)',
    borderRadius: '10px',
    padding: '8px 10px',
    lineHeight: 1.4,
  },
  detectionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    lineHeight: 1,
    padding: '4px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(7, 26, 44, 0.16)',
    background: 'rgba(15, 108, 189, 0.08)',
    color: 'rgba(7, 26, 44, 0.82)',
    marginRight: '12px',
  },
  detectionMeterTrack: {
    width: '74px',
    height: '6px',
    borderRadius: '999px',
    background: 'rgba(7, 26, 44, 0.1)',
    overflow: 'hidden',
  },
  detectionMeterFill: {
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #0f6cbd, #14b8a6)',
    transition: 'width 180ms ease',
  },
  totals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '16px 18px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(15, 108, 189, 0.08), rgba(20, 184, 166, 0.06))',
    border: '1px solid rgba(15, 108, 189, 0.18)',
  },
  totalNumber: {
    fontSize: '34px',
    lineHeight: 1,
    color: '#0f6cbd',
  },
  totalLabel: {
    fontSize: '12px',
    color: 'rgba(7, 26, 44, 0.7)',
  },
  disclaimer: {
    fontSize: '11px',
    color: 'rgba(7, 26, 44, 0.6)',
    lineHeight: 1.4,
  },
  '@media (max-width: 960px)': {
    layout: { gridTemplateColumns: '1fr' },
    fieldGrid: { gridTemplateColumns: '1fr' },
    featureRow: { gridTemplateColumns: '1fr 90px 90px 100px' },
  },
});

export function Estimator() {
  const styles = useStyles();
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
  const [perSession, setPerSession] = useState<Record<string, number>>(() =>
    buildDefaultInput(selectedAgent, 'standard').perSession,
  );

  const {
    data: transcripts,
    isLoading: transcriptsLoading,
  } = useTranscripts(selectedAgent?.botid, selectedAgent?.instanceUrl);

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

  // Auto-apply transcript-derived baseline once per (agent + type) combo.
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
    appliedKeyRef.current = null; // allow transcript baseline to re-apply for new type
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
    <div className={styles.root}>
      <div className={styles.backRow}>
        <Button appearance="subtle" onClick={() => navigate('/')}>
          ← Back to dashboard
        </Button>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroTitleRow}>
          <div className={styles.heroIcon}>💸</div>
          <div>
            <Text as="h1" size={800} weight="bold" block>
              Copilot Credit Estimator
            </Text>
            <Text className={styles.heroSubtitle}>
              Forecast monthly Copilot credit consumption for a Copilot Studio agent. Defaults are
              inferred from each agent&apos;s runtime; tweak per-session feature usage and sessions/month
              to match expected workload.
            </Text>
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <div className={styles.card}>
          <Text weight="semibold" size={500}>Inputs</Text>

          {selectedAgent && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: baseline?.hasSignal
                  ? 'rgba(20, 184, 166, 0.10)'
                  : 'rgba(15, 108, 189, 0.06)',
                border: `1px solid ${baseline?.hasSignal ? 'rgba(20, 184, 166, 0.28)' : 'rgba(15, 108, 189, 0.18)'}`,
                fontSize: 13,
                flexWrap: 'wrap',
              }}
            >
              {transcriptsLoading ? (
                <>
                  <Spinner size="tiny" />
                  <Text size={200}>Reading transcripts for <strong>{selectedAgent.name}</strong>…</Text>
                </>
              ) : baseline?.hasSignal ? (
                <>
                  <Badge appearance="tint" color="success">Baseline from transcripts</Badge>
                  <Text size={200}>
                    {baseline.stats.totalSessions} session{baseline.stats.totalSessions === 1 ? '' : 's'} observed
                    {baseline.extrapolated
                      ? ` (over ${baseline.stats.daysObserved} day${baseline.stats.daysObserved === 1 ? '' : 's'}, extrapolated to /month)`
                      : ` in the last 30 days`}{' '}
                    · avg {baseline.stats.avgMessagesPerSession.toFixed(1)} msgs/session
                    {' · '}~{Math.max(1, Math.round(baseline.stats.avgBotRepliesPerSession))} bot
                    {Math.max(1, Math.round(baseline.stats.avgBotRepliesPerSession)) === 1 ? ' reply' : ' replies'}/session
                  </Text>
                  <Button size="small" appearance="subtle" onClick={applyTranscriptBaseline}>
                    Re-apply
                  </Button>
                </>
              ) : (
                <Text size={200} style={{ color: 'rgba(7,26,44,0.7)' }}>
                  No transcripts found for <strong>{selectedAgent.name}</strong> — using runtime-based defaults.
                </Text>
              )}
            </div>
          )}

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Agent (optional)</span>
              <Dropdown
                value={selectedAgent?.name ?? 'No agent selected'}
                selectedOptions={selectedBotId ? [selectedBotId] : []}
                onOptionSelect={(_, d) => {
                  const id = (d.optionValue as string) || null;
                  setSelectedBotId(id);
                  appliedKeyRef.current = null;
                  const agent = agents.find((a) => a.botid === id) ?? null;
                  applyDefaults(agentTypeId, agent);
                }}
              >
                <Option value="" text="No agent selected">No agent selected</Option>
                {agents.map((a) => (
                  <Option key={a.botid} value={a.botid} text={a.name}>
                    {a.name}
                  </Option>
                ))}
              </Dropdown>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Agent type</span>
              <Dropdown
                value={creditRates.agentTypes.find((t) => t.id === agentTypeId)?.label ?? ''}
                selectedOptions={[agentTypeId]}
                onOptionSelect={(_, d) => applyDefaults(String(d.optionValue))}
              >
                {creditRates.agentTypes.map((t) => (
                  <Option key={t.id} value={t.id} text={t.label}>
                    {t.label}
                  </Option>
                ))}
              </Dropdown>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Sessions / month</span>
              <Input
                type="number"
                min={0}
                value={String(sessionsPerMonth)}
                onChange={(_, d) => setSessionsPerMonth(Math.max(0, Number(d.value) || 0))}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>&nbsp;</span>
              <Button
                appearance="secondary"
                onClick={() => applyDefaults(agentTypeId)}
              >
                Reset to defaults
              </Button>
            </div>
          </div>

          <Divider />

          <Text weight="semibold" size={400}>Per-session feature usage</Text>
          <Text size={200} style={{ color: 'rgba(7,26,44,0.7)' }}>
            Auto/session = suggested value per session from transcripts + detected feature signals.
            You can override it in Per session.
          </Text>
          <Text className={styles.featureDisclaimer}>
            Disclaimer: Feature detection and Auto/session values are heuristic estimates based on
            available configuration and transcript patterns. They may be incomplete or inaccurate,
            so validate before business or contractual decisions.
          </Text>
          <div>
            <div className={styles.featureRow} style={{ fontSize: 12, color: 'rgba(7,26,44,0.6)' }}>
              <span>Feature</span>
              <span>Credits / unit</span>
              <Tooltip
                relationship="description"
                content="Auto/session is the suggested per-session value inferred from transcripts and agent-configuration feature signals. You can override it in the Per session column."
              >
                <span style={{ cursor: 'help' }}>Auto / session</span>
              </Tooltip>
              <span>Per session</span>
            </div>
            {applicableFeatures.map((f) => (
              <div key={f.id} className={styles.featureRow} style={{ padding: '12px 0' }}>
                <div className={styles.featureLabel}>
                  <Tooltip content={f.description} relationship="description">
                    <span>{f.label}</span>
                  </Tooltip>
                  <span className={styles.featureHint}>{f.description}</span>
                  {selectedAgent && (
                    (() => {
                      const count = detection?.byFeature[f.id] ?? 0;
                      const pct = maxDetectionCount > 0
                        ? Math.max(6, Math.round((count / maxDetectionCount) * 100))
                        : 0;
                      return (
                        <span className={styles.featureDetectionHint}>
                          <Tooltip content={count > 0 ? 'This feature was inferred from transcripts/config.' : 'No evidence of this feature found.'} relationship="description">
                            <span
                              className={styles.detectionPill}
                              style={count > 0
                                ? { background: '#1db95422', color: '#1a4d2e', border: '1px solid #1db954' }
                                : { background: '#f3f3f3', color: '#888', border: '1px solid #d1d1d1' }}
                            >
                              {count > 0 ? 'Detected' : 'Not detected'}: {count}
                            </span>
                          </Tooltip>
                          <span className={styles.detectionMeterTrack} aria-hidden="true">
                            <span
                              className={styles.detectionMeterFill}
                              style={{ width: `${count > 0 ? pct : 0}%` }}
                            />
                          </span>
                        </span>
                      );
                    })()
                  )}
                </div>
                <Text>{f.credits}</Text>
                <Text size={200} style={{ color: 'rgba(7,26,44,0.72)' }}>
                  {autoPerSession ? (autoPerSession[f.id] ?? 0) : '-'}
                </Text>
                <SpinButton
                  min={0}
                  value={perSession[f.id] ?? 0}
                  onChange={(_, d) => {
                    const v = d.value ?? Number(d.displayValue ?? 0);
                    setPerSession((prev) => ({ ...prev, [f.id]: Math.max(0, Number(v) || 0) }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>


        <div className={styles.card}>
          <Text weight="semibold" size={500}>Estimated monthly cost</Text>
          <div className={styles.totals}>
            <Text className={styles.totalNumber} weight="bold">{formatUsd(result.totalUsd)}</Text>
            <Text className={styles.totalLabel}>
              {formatCredits(result.totalCredits)} Copilot credits / month
            </Text>
            <Text className={styles.totalLabel}>
              {formatCredits(result.perSessionCredits)} credits / session
              {' · '}
              {formatUsd(result.perSessionUsd)} / session
            </Text>
          </div>

          <Divider />
          <Text weight="semibold" size={300}>Breakdown</Text>
          {result.breakdown
            .filter((b) => b.perSession > 0)
            .map((b) => (
              <div key={b.featureId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <Text size={200} style={{ flex: 1, minWidth: 0 }} truncate>{b.label}</Text>
                <Text size={200} weight="semibold">{formatUsd(b.monthlyUsd)}</Text>
              </div>
            ))}
          {result.breakdown.every((b) => b.perSession === 0) && (
            <Text size={200} style={{ color: 'rgba(7,26,44,0.6)' }}>
              Set at least one feature above to see a breakdown.
            </Text>
          )}

          <Divider />
          <Text className={styles.disclaimer}>
            1 Copilot credit = ${creditRates.creditUnitUsd.toFixed(2)} USD. Defaults are based on the
            public{' '}
            <a
              href="https://microsoft.github.io/copilot-studio-estimator/"
              target="_blank"
              rel="noreferrer"
            >
              Copilot Studio Estimator
            </a>
            . This is an informational estimate only — verify against official Microsoft pricing
            before contractual decisions.
          </Text>
        </div>
      </div>
    </div>
  );
}
