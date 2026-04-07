import { AgentCard } from './AgentCard';
import type { CopilotAgent, FilterMode, PowerPlatformEnvironment } from '@/types';

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

export function AgentGrid({ agents, filter, onFilterChange, isLoading, error, environments, selectedEnvironmentId, onEnvironmentChange, channelsMap }: AgentGridProps) {
  const showEnvBadge = selectedEnvironmentId === null && environments.length > 1;

  return (
    <div className="agent-grid">
      {environments.length > 1 && (
        <div className="agent-grid__section">
          <div className="agent-grid__env-row">
            <span className="agent-grid__env-label">Environment scope</span>
            <button
              className={`chip${selectedEnvironmentId === null ? ' chip--active' : ''}`}
              onClick={() => onEnvironmentChange(null)}
            >
              All environments
            </button>
            {environments.map((env) => (
              <button
                key={env.environmentId}
                className={`chip${selectedEnvironmentId === env.environmentId ? ' chip--active' : ''}`}
                onClick={() => onEnvironmentChange(env.environmentId)}
              >
                {env.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="agent-grid__section">
        <div className="agent-grid__filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip${filter === f.key ? ' chip--active' : ''}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </button>
          ))}
          {!isLoading && (
            <span className="agent-grid__count">
              {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="message message--error">
          Failed to load agents: {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="spinner-container">
          <span className="spinner" />
          Loading agents…
        </div>
      ) : agents.length === 0 ? (
        <div className="empty-state">No agents found for this filter.</div>
      ) : (
        <div className="agent-grid__cards">
          {agents.map((agent) => (
            <AgentCard
              key={`${agent.environmentId ?? 'default'}-${agent.botid}`}
              agent={agent}
              showEnvironment={showEnvBadge}
              channels={channelsMap?.get(agent.botid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
