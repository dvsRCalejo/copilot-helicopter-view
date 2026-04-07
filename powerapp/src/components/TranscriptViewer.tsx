import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ConversationTranscript, BotActivity } from '@/types';
import { extractChannel, getChannelInfo } from '@/types';

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
  const activities = parseActivities(transcript.content);
  const messageCount = activities.length;
  const channel = getChannelInfo(extractChannel(transcript.content));

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {/* — Header — */}
        <div className="drawer__header">
          <div className="drawer__header-left">
            <h3 className="drawer__title">
              {transcript.name ?? `Session ${transcript.conversationtranscriptid.slice(0, 8)}`}
            </h3>
            <div className="drawer__badges">
              <span className="badge badge--outline">
                {new Date(transcript.createdon).toLocaleString()}
              </span>
              <span className="badge badge--outline">
                {messageCount} message{messageCount !== 1 ? 's' : ''}
              </span>
              <span className="badge badge--outline">
                {channel.icon} {channel.label}
              </span>
            </div>
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* — Chat — */}
        <div className="drawer__chat">
          {messageCount === 0 ? (
            <div className="message message--warning">
              No message activities found in this transcript.
            </div>
          ) : (
            activities.map((act, i) => {
              const isUser = act.from?.role?.toLowerCase() === 'user';
              return (
                <div key={act.id ?? i} className={`chat-row ${isUser ? 'chat-row--user' : 'chat-row--bot'}`}>
                  <div className="chat-avatar">{isUser ? '👤' : '🤖'}</div>
                  <div className="chat-content">
                    <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--bot'}`}>
                      {act.text}
                    </div>
                    <span className="chat-time">
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

const PAGE_SIZE = 20;

export function TranscriptViewer({ transcripts, isLoading, error }: TranscriptViewerProps) {
  const [open, setOpen] = useState<ConversationTranscript | null>(null);
  const [page, setPage] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [keyword, setKeyword] = useState('');

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
      const to = new Date(endDate).getTime() + 86_400_000; // include the end date fully
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

  if (isLoading) {
    return (
      <div className="spinner-container">
        <span className="spinner" />
        Loading transcripts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="message message--error">Failed to load transcripts: {error.message}</div>
    );
  }

  const allCount = (transcripts ?? []).length;
  const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);

  return (
    <div className="transcript-viewer">
      {/* ── Filter bar ─────────────────────────────────── */}
      <div className="transcript-filter">
        <div className="transcript-filter__group">
          <label className="transcript-filter__label">From</label>
          <input
            type="date"
            className="transcript-filter__input"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
          />
        </div>
        <div className="transcript-filter__group">
          <label className="transcript-filter__label">To</label>
          <input
            type="date"
            className="transcript-filter__input"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
          />
        </div>
        {availableChannels.length > 0 && (
          <div className="transcript-filter__group">
            <label className="transcript-filter__label">Channel</label>
            <select
              className="transcript-filter__input"
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setPage(0); }}
            >
              <option value="">All channels</option>
              {availableChannels.map((ch) => (
                <option key={ch.label} value={ch.label}>{ch.icon} {ch.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="transcript-filter__group" style={{ flex: 1, minWidth: '140px' }}>
          <label className="transcript-filter__label">Search</label>
          <input
            className="transcript-filter__input"
            placeholder="🔎 Keyword…"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
          />
        </div>
        {(startDate || endDate || channelFilter || keyword) && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => { setStartDate(''); setEndDate(''); setChannelFilter(''); setKeyword(''); setPage(0); }}
          >
            Clear all
          </button>
        )}
        <span className="transcript-filter__count">
          {filtered.length === allCount
            ? `${allCount} transcript${allCount !== 1 ? 's' : ''}`
            : `${filtered.length} of ${allCount} transcripts`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {allCount === 0
            ? 'No transcripts for this agent yet.'
            : 'No transcripts match the current filters.'}
        </div>
      ) : (
        <>
          <ul className="transcript-list">
            {paged.map((t) => {
              const activities = parseActivities(t.content);
              const preview = activities.find((a) => a.from?.role?.toLowerCase() === 'user')?.text;
              const ch = getChannelInfo(extractChannel(t.content));
              return (
                <li
                  key={t.conversationtranscriptid}
                  className="transcript-item"
                  onClick={() => setOpen(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setOpen(t)}
                >
                  <div className="transcript-item__meta">
                    <span className="transcript-item__name">
                      {t.name ?? `Session ${t.conversationtranscriptid.slice(0, 8)}`}
                    </span>
                    {preview && (
                      <span className="transcript-item__preview">{preview}</span>
                    )}
                    <span className="transcript-item__date">
                      {new Date(t.createdon).toLocaleString()} · {activities.length} msg{activities.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="transcript-item__actions">
                    <span className="badge badge--outline">{ch.icon} {ch.label}</span>
                    <span className="transcript-item__arrow">→</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {paged.length < filtered.length && (
            <button className="btn btn--ghost" onClick={() => setPage((p) => p + 1)}>
              Load more ({filtered.length - paged.length} remaining)
            </button>
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
