import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardFooter,
  Badge,
  Text,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { CopilotAgent } from '@/types';

const useStyles = makeStyles({
  card: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    gap: '14px',
    padding: '20px',
    borderRadius: '24px',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    background: [
      'radial-gradient(circle at top right, rgba(110, 193, 255, 0.16), transparent 30%)',
      'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248, 251, 255, 0.94))',
    ].join(','),
    boxShadow: '0 18px 42px rgba(15, 43, 70, 0.08)',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    ':hover': {
      transform: 'translateY(-3px)',
      boxShadow: '0 24px 48px rgba(15, 43, 70, 0.14)',
      border: '1px solid rgba(15, 108, 189, 0.18)',
    },
  },
  headerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  meta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXL,
    padding: '14px 0 4px',
    borderTop: '1px solid rgba(9, 30, 66, 0.08)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  description: {
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.5,
    maxHeight: '3em',
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    objectFit: 'cover',
    border: '1px solid rgba(9, 30, 66, 0.1)',
    backgroundColor: '#eff5fb',
  },
  title: {
    fontSize: '18px',
  },
  iconFallback: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '24px',
    background: 'rgba(15, 108, 189, 0.08)',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 0,
  },
});

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
  const styles = useStyles();
  const iconSrc = toDataUri(agent.iconbase64);

  const isActive = agent.statecode === 0;
  const lastMod = new Date(agent.modifiedon).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      className={styles.card}
      onClick={() => navigate(`/agent/${agent.botid}`)}
      role="article"
      aria-label={`Agent: ${agent.name}`}
    >
      <div className={styles.headerWrap}>
        <CardHeader
          image={
            iconSrc ? (
              <img className={styles.avatar} src={iconSrc} alt="" aria-hidden="true" />
            ) : (
              <div className={styles.iconFallback}>🤖</div>
            )
          }
          header={
            <Text weight="semibold" className={styles.title}>
              {agent.name}
            </Text>
          }
          description={
            <div className={styles.meta}>
              <Badge
                appearance="tint"
                color={isActive ? 'success' : 'severe'}
                size="small"
              >
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge
                appearance="tint"
                color={agent.isOwner ? 'brand' : 'informative'}
                size="small"
              >
                {agent.isOwner ? 'Owner' : 'Co-owner'}
              </Badge>
              {agent.runtimeprovider === 1 && (
                <Badge appearance="tint" color="success" size="small">
                  Generative
                </Badge>
              )}
              {showEnvironment && agent.environmentDisplayName && (
                <Badge appearance="outline" size="small">
                  {agent.environmentDisplayName}
                </Badge>
              )}
            </div>
          }
        />

        {agent.description && (
          <Text size={200} className={styles.description}>
            {agent.description}
          </Text>
        )}
      </div>

      {channels && channels.length > 0 && (
        <div className={styles.meta} style={{ gap: '4px' }}>
          {channels.map((ch) => (
            <Badge key={ch.label} appearance="outline" size="small">
              {ch.icon} {ch.label}
            </Badge>
          ))}
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <Text size={300} weight="semibold">
            {agent.publishedon
              ? new Date(agent.publishedon).toLocaleDateString()
              : 'Never'}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Published
          </Text>
        </div>
        <div className={styles.statItem}>
          <Text size={300} weight="semibold">
            {lastMod}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Last modified
          </Text>
        </div>
      </div>

      <CardFooter className={styles.footer}>
        <Button
          appearance="primary"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/agent/${agent.botid}`);
          }}
        >
          View details →
        </Button>
      </CardFooter>
    </Card>
  );
}
