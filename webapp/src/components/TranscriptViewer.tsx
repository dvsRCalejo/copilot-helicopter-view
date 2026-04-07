import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  makeStyles,
  tokens,
  Text,
  Spinner,
  Button,
  Badge,
  MessageBar,
  MessageBarBody,
  Input,
  Label,
} from '@fluentui/react-components';
import type { ConversationTranscript, BotActivity } from '@/types';
import { extractChannel, getChannelInfo } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '12px 16px',
    borderRadius: '12px',
    backgroundColor: 'rgba(244, 248, 252, 0.85)',
    border: '1px solid rgba(9, 30, 66, 0.06)',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  filterCount: {
    marginLeft: 'auto',
    color: tokens.colorNeutralForeground3,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '12px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: '1px solid rgba(9, 30, 66, 0.08)',
    marginBottom: '6px',
    cursor: 'pointer',
    transitionProperty: 'border-color, box-shadow, transform',
    transitionDuration: '0.15s',
    ':hover': {
      borderColor: '#0f6cbd' as unknown as undefined,
      boxShadow: '0 4px 14px rgba(15, 108, 189, 0.1)',
      transform: 'translateY(-1px)',
    },
  },
  listMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
    flex: 1,
  },
  preview: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '500px',
    color: tokens.colorNeutralForeground3,
  },
  arrow: {
    fontSize: '16px',
    color: tokens.colorNeutralForeground3,
    transitionProperty: 'transform, color',
    transitionDuration: '0.15s',
  },
  /* Full-page modal overlay */
  drawerOverlay: {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animationName: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    animationDuration: '0.2s',
    padding: '24px',
  },
  drawer: {
    width: 'min(640px, 94vw)',
    maxHeight: 'min(88vh, 900px)',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.25)',
    borderRadius: '20px',
    animationName: {
      from: { transform: 'scale(0.95)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
    animationDuration: '0.25s',
    overflow: 'hidden',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #e8e8e8',
    gap: '12px',
    flexShrink: 0,
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
  },
  drawerHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  drawerTitle: {
    fontSize: '18px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  drawerBadges: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  drawerChat: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  chatRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    maxWidth: '90%',
  },
  chatRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  chatRowBot: {
    alignSelf: 'flex-start',
  },
  chatAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  chatContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  chatBubble: {
    padding: '10px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: '1.55',
    wordBreak: 'break-word',
  },
  chatBubbleUser: {
    background: 'linear-gradient(135deg, #0f6cbd, #1a7fd4)',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  chatBubbleBot: {
    backgroundColor: '#f5f5f5',
    color: '#242424',
    borderBottomLeftRadius: '4px',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  chatTime: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    padding: '0 4px',
  },
  chatTimeUser: { textAlign: 'right' },
  chatTimeBot: { textAlign: 'left' },
  empty: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalXXXL} 0`,
    color: tokens.colorNeutralForeground3,
  },
});

function parseActivities(content: string | null): BotActivity[] {
  if (!content) return [];
  try {
    const parsed: unknown = JSON.parse(content);
    const activities: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { activities?: unknown[] }).activities ?? [];
    return (activities as BotActivity[]).filter((a) => a.type === 'message' && !!a.text);
  } catch {
    return [];
  }
}

interface TranscriptDrawerProps {
  transcript: ConversationTranscript;
  onClose: () => void;
}

function TranscriptDrawer({ transcript, onClose }: TranscriptDrawerProps) {
  const styles = useStyles();
  const activities = parseActivities(transcript.content);
  const channel = getChannelInfo(extractChannel(transcript.content));

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderLeft}>
            <Text className={styles.drawerTitle} as="h3">
              {transcript.name ?? `Session ${transcript.conversationtranscriptid.slice(0, 8)}`}
            </Text>
            <div className={styles.drawerBadges}>
              <Badge appearance="outline" size="small">
                {new Date(transcript.createdon).toLocaleString()}
              </Badge>
              <Badge appearance="outline" size="small">
                {activities.length} message{activities.length !== 1 ? 's' : ''}
              </Badge>
              <Badge appearance="outline" size="small">
                {channel.icon} {channel.label}
              </Badge>
            </div>
          </div>
          <Button appearance="subtle" size="small" onClick={onClose} aria-label="Close">✕</Button>
        </div>

        <div className={styles.drawerChat}>
          {activities.length === 0 ? (
            <MessageBar intent="warning">
              <MessageBarBody>No message activities found in this transcript.</MessageBarBody>
            </MessageBar>
          ) : (
            activities.map((act, i) => {
              const isUser = act.from?.role?.toLowerCase() === 'user';
              return (
                <div
                  key={act.id ?? i}
                  className={`${styles.chatRow} ${isUser ? styles.chatRowUser : styles.chatRowBot}`}
                >
                  <div className={styles.chatAvatar}>{isUser ? '👤' : '🤖'}</div>
                  <div className={styles.chatContent}>
                    <div className={`${styles.chatBubble} ${isUser ? styles.chatBubbleUser : styles.chatBubbleBot}`}>
                      {act.text}
                    </div>
                    <span className={`${styles.chatTime} ${isUser ? styles.chatTimeUser : styles.chatTimeBot}`}>
                      {isUser ? 'User' : 'Bot'}
                      {act.timestamp
                        ? ` · ${new Date(act.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
                        : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface TranscriptViewerProps {
  transcripts: ConversationTranscript[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function TranscriptViewer({ transcripts, isLoading, error }: TranscriptViewerProps) {
  const styles = useStyles();
  const [open, setOpen] = useState<ConversationTranscript | null>(null);
  const [page, setPage] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const PAGE_SIZE = 20;

  const availableChannels = useMemo(() => {
    const labelMap = new Map<string, { label: string; icon: string }>();
    for (const t of transcripts ?? []) {
      const ch = extractChannel(t.content);
      if (ch) {
        const info = getChannelInfo(ch);
        if (!labelMap.has(info.label)) labelMap.set(info.label, info);
      }
    }
    return Array.from(labelMap.values());
  }, [transcripts]);

  const filtered = useMemo(() => {
    let items = transcripts ?? [];
    if (startDate) {
      const from = new Date(startDate).getTime();
      items = items.filter((t) => new Date(t.createdon).getTime() >= from);
    }
    if (endDate) {
      const to = new Date(endDate).getTime() + 86_400_000;
      items = items.filter((t) => new Date(t.createdon).getTime() < to);
    }
    if (channelFilter) {
      items = items.filter((t) => {
        const ch = getChannelInfo(extractChannel(t.content));
        return ch.label === channelFilter;
      });
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      items = items.filter((t) => {
        const name = (t.name ?? '').toLowerCase();
        if (name.includes(kw)) return true;
        const activities = parseActivities(t.content);
        return activities.some((a) => a.text?.toLowerCase().includes(kw));
      });
    }
    return items;
  }, [transcripts, startDate, endDate, channelFilter, keyword]);

  if (isLoading) return <Spinner label="Loading transcripts…" />;

  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>Failed to load transcripts: {error.message}</MessageBarBody>
      </MessageBar>
    );
  }

  const allCount = (transcripts ?? []).length;
  const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);

  return (
    <div className={styles.root}>
      {/* ── Filter bar ─────────────────────────────────── */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <Label size="small" style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>From</Label>
          <Input
            type="date"
            size="small"
            value={startDate}
            onChange={(_, d) => { setStartDate(d.value); setPage(0); }}
          />
        </div>
        <div className={styles.filterGroup}>
          <Label size="small" style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>To</Label>
          <Input
            type="date"
            size="small"
            value={endDate}
            onChange={(_, d) => { setEndDate(d.value); setPage(0); }}
          />
        </div>
        {availableChannels.length > 0 && (
          <div className={styles.filterGroup}>
            <Label size="small" style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>Channel</Label>
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setPage(0); }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(9,30,66,0.12)', fontSize: '13px', background: '#fff' }}
            >
              <option value="">All channels</option>
              {availableChannels.map((ch) => (
                <option key={ch.label} value={ch.label}>{ch.icon} {ch.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className={styles.filterGroup} style={{ flex: 1, minWidth: '140px' }}>
          <Label size="small" style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>Search</Label>
          <Input
            size="small"
            placeholder="Keyword…"
            value={keyword}
            onChange={(_, d) => { setKeyword(d.value); setPage(0); }}
            contentBefore={<span aria-hidden="true" style={{ fontSize: '13px' }}>🔎</span>}
          />
        </div>
        {(startDate || endDate || channelFilter || keyword) && (
          <Button
            appearance="subtle"
            size="small"
            onClick={() => { setStartDate(''); setEndDate(''); setChannelFilter(''); setKeyword(''); setPage(0); }}
          >
            Clear all
          </Button>
        )}
        <Text size={200} className={styles.filterCount}>
          {filtered.length === allCount
            ? `${allCount} transcript${allCount !== 1 ? 's' : ''}`
            : `${filtered.length} of ${allCount} transcripts`}
        </Text>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <Text>
            {allCount === 0
              ? 'No transcripts for this agent yet.'
              : 'No transcripts match the current filters.'}
          </Text>
        </div>
      ) : (
        <>
          {paged.map((t) => {
            const activities = parseActivities(t.content);
            const preview = activities.find((a) => a.from?.role?.toLowerCase() === 'user')?.text;
            const ch = getChannelInfo(extractChannel(t.content));
            return (
              <div
                key={t.conversationtranscriptid}
                className={styles.listItem}
                onClick={() => setOpen(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setOpen(t)}
              >
                <div className={styles.listMeta}>
                  <Text weight="semibold" size={300}>
                    {t.name ?? `Session ${t.conversationtranscriptid.slice(0, 8)}`}
                  </Text>
                  {preview && (
                    <Text size={200} className={styles.preview}>{preview}</Text>
                  )}
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {new Date(t.createdon).toLocaleString()} · {activities.length} msg{activities.length !== 1 ? 's' : ''}
                  </Text>
                </div>
                <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' }}>
                  <Badge appearance="outline" size="small">{ch.icon} {ch.label}</Badge>
                  <span className={styles.arrow}>→</span>
                </div>
              </div>
            );
          })}

          {paged.length < filtered.length && (
            <Button
              appearance="subtle"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more ({filtered.length - paged.length} remaining)
            </Button>
          )}
        </>
      )}

      {open && createPortal(
        <TranscriptDrawer transcript={open} onClose={() => setOpen(null)} />,
        document.body
      )}
    </div>
  );
}

