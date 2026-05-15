import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useAgents } from '@/hooks/useAgents';
import { useTranscripts } from '@/hooks/useTranscripts';
import { estimateMonthlyCost, formatCredits, formatUsd, inferFromTranscripts } from '@/utils/costEstimator';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  panel: {
    padding: '18px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(9, 30, 66, 0.08)',
  },
  list: {
    margin: '8px 0 0',
    padding: '0 0 0 18px',
  },
});

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

const DevAgentCost = () => {
  const styles = useStyles();
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
    selectedAgent?.instanceUrl,
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
    <div className={styles.root}>
      <div className={styles.row}>
        <Button appearance="subtle" onClick={() => navigate('/')}>
          ← Back to dashboard
        </Button>
        <Text as="h1" size={700} weight="bold">
          Real Agent Cost (Per Agent)
        </Text>
      </div>

      <div className={styles.panel}>
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
        <div className={styles.panel}>
          <Spinner label="Loading live agent usage data from Dataverse..." />
        </div>
      )}

      {!agentsLoading && !selectedAgent && (
        <div className={styles.panel}>
          <Text>No accessible agents were found for this account/environment.</Text>
        </div>
      )}

      {selectedAgent && baseline && result && (
        <>
          <div className={styles.panel}>
            <div className={styles.row}>
              <Badge appearance="tint" color="success">Live data</Badge>
              <Text>Source: Dataverse transcripts + agent configuration</Text>
            </div>
            <div className={styles.row}>
              <Text weight="semibold">Agent:</Text>
              <Text>{selectedAgent.name}</Text>
            </div>
            <div className={styles.row}>
              <Text weight="semibold">Billing mode (inferred):</Text>
              <Text>{billing.mode}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                confidence: {billing.confidence}
              </Text>
            </div>
            <div className={styles.row}>
              <Text weight="semibold">Sessions/month (from transcripts):</Text>
              <Text>{baseline.input.sessionsPerMonth.toLocaleString()}</Text>
            </div>
            <div className={styles.row}>
              <Text weight="semibold">Observed transcripts:</Text>
              <Text>{baseline.stats.totalSessions.toLocaleString()}</Text>
            </div>
            <div className={styles.row}>
              <Text weight="semibold">Avg bot replies/session:</Text>
              <Text>{baseline.stats.avgBotRepliesPerSession.toFixed(2)}</Text>
            </div>
          </div>

          <div className={styles.panel}>
            <Text as="h2" size={500} weight="semibold" block>
              Estimated monthly cost (usage-backed)
            </Text>
            <div className={styles.row}>
              <Text weight="semibold">Credits:</Text>
              <Text>{formatCredits(result.totalCredits)}</Text>
            </div>
            <div className={styles.row}>
              <Text weight="semibold">USD:</Text>
              <Text>{formatUsd(result.totalUsd)}</Text>
            </div>
            <ul className={styles.list}>
              {result.breakdown
                .filter((item) => item.monthlyCredits > 0)
                .map((item) => (
                  <li key={item.featureId}>
                    {item.label}: {item.perSession}/session x {item.unitCredits} credits = {formatCredits(item.monthlyCredits)} credits
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default DevAgentCost;