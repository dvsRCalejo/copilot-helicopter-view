import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Badge,
  Spinner,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  SelectTabData,
} from '@fluentui/react-components';
import { useAgents } from '@/hooks/useAgents';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { extractConfiguredChannels, getChannelInfo } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
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
    gap: '18px',
    padding: 'clamp(18px, 3vw, 28px)',
    borderRadius: '26px',
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    boxShadow: '0 18px 42px rgba(15, 43, 70, 0.08)',
    backdropFilter: 'blur(10px)',
  },
  agentHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  badges: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  metaCard: {
    textAlign: 'right',
    padding: '16px 18px',
    borderRadius: '18px',
    background: 'rgba(244, 248, 252, 0.92)',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    minWidth: '220px',
  },
  tabShell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: 'clamp(16px, 2.2vw, 24px)',
    borderRadius: '26px',
    background: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    boxShadow: '0 18px 42px rgba(15, 43, 70, 0.06)',
    backdropFilter: 'blur(10px)',
  },
  tabContent: {
    minHeight: 0,
  },
  title: {
    fontSize: 'clamp(28px, 3vw, 40px)',
    lineHeight: 1,
  },
  '@media (max-width: 720px)': {
    metaCard: {
      textAlign: 'left',
      width: '100%',
    },
  },
});

type TabKey = 'analytics' | 'transcripts';

export function AgentDetail() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const styles = useStyles();
  const [tab, setTab] = useState<TabKey>('analytics');

  const { data: agents = [], isLoading: agentsLoading } = useAgents();
  const agent = agents.find((a) => a.botid === botId);

  const {
    data: transcripts,
    isLoading: transcriptsLoading,
    error: transcriptsError,
  } = useTranscripts(botId, agent?.instanceUrl);

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
      <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXXL }}>
        <Spinner label="Loading agent…" />
      </div>
    );
  }

  if (!agent) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>
          Agent not found or you do not have access. <Button appearance="transparent" onClick={() => navigate('/')}>Go back</Button>
        </MessageBarBody>
      </MessageBar>
    );
  }

  const isActive = agent.statecode === 0;
  const agentStudioUrl = agent.environmentId
    ? `https://copilotstudio.microsoft.com/environments/${encodeURIComponent(agent.environmentId)}/bots/${encodeURIComponent(agent.botid)}`
    : null;

  return (
    <div className={styles.root}>
      {/* Back navigation */}
      <div className={styles.backRow}>
        <Button
          appearance="subtle"
          onClick={() => navigate('/')}
        >
          ← All agents
        </Button>
        <Button
          appearance="secondary"
          onClick={() => navigate(`/estimator?botId=${encodeURIComponent(botId ?? '')}`)}
        >
          💸 Estimate cost
        </Button>
      </div>

      {/* Agent heading */}
      <div className={styles.hero}>
        <div className={styles.agentHeader}>
          <div className={styles.titleBlock}>
            <Text as="h1" className={styles.title} weight="bold">
            {agent.name}
            </Text>
            <div className={styles.badges}>
              <Badge color={isActive ? 'success' : 'severe'} appearance="tint">
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge color={agent.isOwner ? 'brand' : 'informative'} appearance="tint">
                {agent.isOwner ? 'Owner' : 'Co-owner'}
              </Badge>
              {agent.runtimeprovider === 1 && (
                <Badge color="success" appearance="tint">
                  Generative
                </Badge>
              )}
            </div>
            {channels.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Channels
                </Text>
                {channels.map((ch) => (
                  <Badge key={ch.label} appearance="outline">
                    {ch.icon} {ch.label}
                  </Badge>
                ))}
              </div>
            )}
            {agent.description && (
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                {agent.description}
              </Text>
            )}
            {agentStudioUrl && (
              <Button
                as="a"
                href={agentStudioUrl}
                target="_blank"
                rel="noreferrer"
                appearance="subtle"
                size="small"
              >
                Open in Copilot Studio ↗
              </Button>
            )}
          </div>

          <div className={styles.metaCard}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }} block>
              Published:{' '}
              {agent.publishedon
                ? new Date(agent.publishedon).toLocaleDateString()
                : 'Never'}
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }} block>
              Modified: {new Date(agent.modifiedon).toLocaleDateString()}
            </Text>
            {agent.schemaname && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }} block>
                Schema: {agent.schemaname}
              </Text>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabShell}>
        <TabList
          selectedValue={tab}
          onTabSelect={(_: unknown, d: SelectTabData) => setTab(d.value as TabKey)}
        >
          <Tab value="analytics">Analytics</Tab>
          <Tab value="transcripts">
            Transcripts{transcripts ? ` (${transcripts.length})` : ''}
          </Tab>
        </TabList>

        <div className={styles.tabContent}>
          {tab === 'analytics' && (
            <AnalyticsPanel analytics={analytics} sessions={sessions} />
          )}
          {tab === 'transcripts' && (
            <TranscriptViewer
              transcripts={transcripts}
              isLoading={transcriptsLoading}
              error={transcriptsError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
