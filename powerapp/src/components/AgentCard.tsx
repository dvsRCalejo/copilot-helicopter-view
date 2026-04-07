import { useNavigate } from 'react-router-dom';
import type { CopilotAgent } from '@/types';

interface AgentCardProps {
  agent: CopilotAgent;
  showEnvironment?: boolean;
  channels?: Array<{ label: string; icon: string }>;
}

function toDataUri(iconbase64: string | null | undefined): string | null {
  if (!iconbase64) return null;
  if (iconbase64.startsWith('data:')) return iconbase64;
  return `data:image/png;base64,${iconbase64}`;
}

export function AgentCard({ agent, showEnvironment = false, channels }: AgentCardProps) {
  const navigate = useNavigate();
  const isActive = agent.statecode === 0;
  const iconSrc = toDataUri(agent.iconbase64);

  const lastMod = new Date(agent.modifiedon).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="agent-card"
      onClick={() => navigate(`/agent/${agent.botid}`)}
      role="article"
      aria-label={`Agent: ${agent.name}`}
    >
      <div className="agent-card__header">
        {iconSrc ? (
          <img className="agent-card__avatar" src={iconSrc} alt="" aria-hidden="true" />
        ) : (
          <span className="agent-card__icon">🤖</span>
        )}
        <div className="agent-card__title-block">
          <span className="agent-card__name">{agent.name}</span>
          <div className="agent-card__badges">
            <span className={`badge badge--${isActive ? 'success' : 'danger'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`badge badge--${agent.isOwner ? 'brand' : 'info'}`}>
              {agent.isOwner ? 'Owner' : 'Co-owner'}
            </span>
            {agent.runtimeprovider === 1 && (
              <span className="badge badge--success">Generative</span>
            )}
            {showEnvironment && agent.environmentDisplayName && (
              <span className="badge badge--outline">{agent.environmentDisplayName}</span>
            )}
          </div>
        </div>
      </div>

      {agent.description && (
        <p className="agent-card__description">{agent.description}</p>
      )}

      {channels && channels.length > 0 && (
        <div className="agent-card__badges" style={{ gap: '4px' }}>
          {channels.map((ch) => (
            <span key={ch.label} className="badge badge--outline">
              {ch.icon} {ch.label}
            </span>
          ))}
        </div>
      )}

      <div className="agent-card__stats">
        <div className="agent-card__stat">
          <span className="agent-card__stat-value">
            {agent.publishedon
              ? new Date(agent.publishedon).toLocaleDateString()
              : 'Never'}
          </span>
          <span className="agent-card__stat-label">Published</span>
        </div>
        <div className="agent-card__stat">
          <span className="agent-card__stat-value">{lastMod}</span>
          <span className="agent-card__stat-label">Last modified</span>
        </div>
      </div>

      <div className="agent-card__footer">
        <button
          className="btn btn--primary btn--sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/agent/${agent.botid}`);
          }}
        >
          View details →
        </button>
      </div>
    </div>
  );
}
