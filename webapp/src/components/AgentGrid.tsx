import {
  Button,
  makeStyles,
  tokens,
  Text,
  Spinner,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { AgentCard } from './AgentCard';
import type { CopilotAgent, FilterMode, PowerPlatformEnvironment } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    borderRadius: '20px',
    background: 'rgba(247, 250, 252, 0.92)',
    border: '1px solid rgba(9, 30, 66, 0.08)',
  },
  envRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  envLabel: {
    color: tokens.colorNeutralForeground2,
    marginRight: tokens.spacingHorizontalXS,
    fontWeight: tokens.fontWeightSemibold,
  },
  filters: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  countLabel: {
    marginLeft: 'auto',
    color: tokens.colorNeutralForeground2,
    alignSelf: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
    gap: '18px',
  },
  empty: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalXXXL} 0`,
    color: tokens.colorNeutralForeground3,
  },
});

const FILTERS: Array<{ key: FilterMode; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'owned', label: 'Owned by me' },
  { key: 'shared', label: 'Shared with me' },
  { key: 'active', label: 'Active only' },
];

interface AgentGridProps {
  agents: CopilotAgent[];
  filter: FilterMode;
  onFilterChange: (f: FilterMode) => void;
  isLoading: boolean;
  error: Error | null;
  environments: PowerPlatformEnvironment[];
  selectedEnvironmentId: string | null;
  onEnvironmentChange: (id: string | null) => void;
  channelsMap?: Map<string, { label: string; icon: string }[]>;
}

export function AgentGrid({
  agents,
  filter,
  onFilterChange,
  isLoading,
  error,
  environments,
  selectedEnvironmentId,
  onEnvironmentChange,
  channelsMap,
}: AgentGridProps) {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      {environments.length > 1 && (
        <div className={styles.panel}>
          <div className={styles.envRow}>
            <Text size={200} className={styles.envLabel}>Environment scope</Text>
            <Button
              appearance={selectedEnvironmentId === null ? 'primary' : 'outline'}
              shape="circular"
              size="small"
              onClick={() => onEnvironmentChange(null)}
            >
              All environments
            </Button>
            {environments.map((env) => (
              <Button
                key={env.environmentId}
                appearance={selectedEnvironmentId === env.environmentId ? 'primary' : 'outline'}
                shape="circular"
                size="small"
                onClick={() => onEnvironmentChange(env.environmentId)}
              >
                {env.displayName}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.panel}>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              appearance={filter === f.key ? 'primary' : 'outline'}
              shape="circular"
              size="small"
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </Button>
          ))}
          {!isLoading && (
            <Text size={200} className={styles.countLabel}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </Text>
          )}
        </div>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            Failed to load agents: {error.message}
          </MessageBarBody>
        </MessageBar>
      )}

      {isLoading ? (
        <Spinner label="Loading agents…" />
      ) : agents.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>No agents found for this filter.</Text>
        </div>
      ) : (
        <div className={styles.grid}>
          {agents.map((agent) => (
            <AgentCard
              key={`${agent.environmentId ?? 'default'}-${agent.botid}`}
              agent={agent}
              showEnvironment={selectedEnvironmentId === null && environments.length > 1}
              channels={channelsMap?.get(agent.botid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
