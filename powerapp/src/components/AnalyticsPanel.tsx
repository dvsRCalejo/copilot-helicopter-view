import { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { AgentAnalytics, SessionMeta, AnalyticsFilter, RecommendationSeverity } from '@/types';
import { getRecommendations } from '@/types';

/* ────────────────────────────────────────────────── */
/*  Constants & helpers                               */
/* ────────────────────────────────────────────────── */

const OUTCOME_COLORS = {
  resolved: '#107c10',
  abandoned: '#c50f1f',
  unengaged: '#8764b8',
};

const DEPTH_LABELS = ['1-2', '3-5', '6-10', '11-20', '20+'];

function applyFilter(sessions: SessionMeta[], filter: AnalyticsFilter): SessionMeta[] {
  if (!filter) return sessions;
  switch (filter.type) {
    case 'outcome': return sessions.filter((s) => s.outcome === filter.value);
    case 'depth':   return sessions.filter((s) => s.depthBucket === filter.value);
    case 'hour':    return sessions.filter((s) => s.hour === filter.value);
  }
}

function deriveChartData(sessions: SessionMeta[]) {
  const outcomeMap = new Map<string, { resolved: number; abandoned: number; unengaged: number }>();
  const depthCounts = new Map<string, number>();
  const hourCounts = new Array(24).fill(0) as number[];
  const responseTimeMap = new Map<string, { total: number; count: number }>();

  for (const s of sessions) {
    const o = outcomeMap.get(s.dateKey) ?? { resolved: 0, abandoned: 0, unengaged: 0 };
    o[s.outcome]++;
    outcomeMap.set(s.dateKey, o);
    depthCounts.set(s.depthBucket, (depthCounts.get(s.depthBucket) ?? 0) + 1);
    hourCounts[s.hour]++;
    if (s.responseTimes.length > 0) {
      const rt = responseTimeMap.get(s.dateKey) ?? { total: 0, count: 0 };
      for (const t of s.responseTimes) { rt.total += t; rt.count++; }
      responseTimeMap.set(s.dateKey, rt);
    }
  }

  return {
    outcomesByDate: Array.from(outcomeMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    depthDistribution: DEPTH_LABELS.map((range) => ({
      range,
      count: depthCounts.get(range) ?? 0,
    })),
    hourlyDistribution: hourCounts.map((count, hour) => ({ hour, count })),
    responseTimeByDate: Array.from(responseTimeMap.entries())
      .map(([date, v]) => ({ date, avgSeconds: v.count > 0 ? v.total / v.count : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function DeltaBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const cls = isUp ? 'delta delta--up' : isDown ? 'delta delta--down' : 'delta delta--neutral';
  const arrow = isUp ? '↑' : isDown ? '↓' : '→';
  return (
    <span className={cls}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? 'a' : 'p'}`;
}

function filterLabel(filter: AnalyticsFilter): string {
  if (!filter) return '';
  switch (filter.type) {
    case 'outcome': return `Outcome: ${filter.value}`;
    case 'depth':   return `Depth: ${filter.value} messages`;
    case 'hour': {
      const h = filter.value % 12 || 12;
      const ampm = filter.value < 12 ? 'AM' : 'PM';
      return `Hour: ${h} ${ampm}`;
    }
  }
}

const SEVERITY_STYLES: Record<RecommendationSeverity, { bg: string; border: string; color: string }> = {
  critical: { bg: 'rgba(197, 15, 31, 0.06)', border: 'rgba(197, 15, 31, 0.25)', color: '#a4262c' },
  warning:  { bg: 'rgba(255, 185, 0, 0.08)', border: 'rgba(255, 185, 0, 0.30)', color: '#835c00' },
  info:     { bg: 'rgba(0, 120, 212, 0.06)', border: 'rgba(0, 120, 212, 0.20)', color: '#0078d4' },
  success:  { bg: 'rgba(16, 124, 16, 0.06)', border: 'rgba(16, 124, 16, 0.20)', color: '#107c10' },
};

/* ────────────────────────────────────────────────── */
/*  Main component                                    */
/* ────────────────────────────────────────────────── */

interface AnalyticsPanelProps {
  analytics: AgentAnalytics;
  sessions: SessionMeta[];
}

export function AnalyticsPanel({ analytics, sessions }: AnalyticsPanelProps) {
  const [filter, setFilter] = useState<AnalyticsFilter>(null);

  const toggleFilter = useCallback((f: AnalyticsFilter) => {
    setFilter((prev) => {
      if (!f || !prev) return f;
      if (prev.type === f.type && JSON.stringify(prev.value) === JSON.stringify(f.value)) return null;
      return f;
    });
  }, []);

  const filtered = useMemo(() => applyFilter(sessions, filter), [sessions, filter]);
  const chartData = useMemo(() => deriveChartData(filtered), [filtered]);

  const total = analytics.outcomes.resolved + analytics.outcomes.abandoned + analytics.outcomes.unengaged;
  const donutData = [
    { name: 'Resolved', value: analytics.outcomes.resolved, color: OUTCOME_COLORS.resolved, key: 'resolved' as const },
    { name: 'Abandoned', value: analytics.outcomes.abandoned, color: OUTCOME_COLORS.abandoned, key: 'abandoned' as const },
    { name: 'Unengaged', value: analytics.outcomes.unengaged, color: OUTCOME_COLORS.unengaged, key: 'unengaged' as const },
  ];
  const recommendations = getRecommendations(analytics);
  const isFiltered = filter !== null;
  const filteredCount = filtered.length;

  return (
    <div className="analytics">
      {/* ── 1. Overview: KPIs + Metrics + Recommendations ── */}
      <p className="analytics__section-title">Overview</p>
      <div className="analytics__kpi-row">
        <div
          className={`kpi-card ${!isFiltered ? 'kpi-card--active' : ''}`}
          onClick={() => setFilter(null)}
        >
          <span className="kpi-card__label">Total sessions</span>
          <span className="kpi-card__value">{analytics.totalSessions}</span>
          <DeltaBadge value={analytics.sessionsChange} />
        </div>

        <div
          className={`kpi-card ${filter?.type === 'outcome' && filter.value === 'resolved' ? 'kpi-card--active' : ''}`}
          onClick={() => toggleFilter({ type: 'outcome', value: 'resolved' })}
        >
          <span className="kpi-card__label">Resolution rate</span>
          <span className="kpi-card__value">{analytics.successRate.toFixed(1)}%</span>
          <DeltaBadge value={analytics.successRateChange} suffix=" pp" />
        </div>

        <div
          className={`kpi-card ${filter?.type === 'outcome' && filter.value === 'abandoned' ? 'kpi-card--active' : ''}`}
          onClick={() => toggleFilter({ type: 'outcome', value: 'abandoned' })}
        >
          <span className="kpi-card__label">Abandoned</span>
          <span className="kpi-card__value">
            {total > 0 ? ((analytics.outcomes.abandoned / total) * 100).toFixed(1) : 0}%
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Avg duration</span>
          <span className="kpi-card__value">{formatDuration(analytics.avgDurationSeconds)}</span>
          <DeltaBadge value={analytics.durationChange} />
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Avg response time</span>
          <span className="kpi-card__value">{formatDuration(analytics.avgResponseTimeSeconds)}</span>
        </div>
      </div>

      {/* Key Metrics inline */}
      <div className="analytics__metrics-row">
        <div className="metric-card">
          <span className="metric-card__label">Avg messages / session</span>
          <span className="metric-card__value">{analytics.avgMessagesPerSession.toFixed(1)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Engagement rate</span>
          <span className="metric-card__value">{analytics.engagementRate.toFixed(1)}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Sessions (7d / 30d)</span>
          <span className="metric-card__value">{analytics.sessionsLast7Days} / {analytics.sessionsLast30Days}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Last activity</span>
          <span className="metric-card__value">
            {analytics.lastActivity
              ? new Date(analytics.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </span>
        </div>
      </div>

      {/* Recommendations inline */}
      {recommendations.length > 0 && (
        <div className="analytics__recs-grid">
          {recommendations.map((rec, i) => {
            const sv = SEVERITY_STYLES[rec.severity];
            return (
              <div
                key={i}
                className="rec-card"
                style={{ background: sv.bg, borderColor: sv.border }}
              >
                <span className="rec-card__icon">{rec.icon}</span>
                <div className="rec-card__body">
                  <span className="rec-card__title" style={{ color: sv.color }}>{rec.title}</span>
                  <span className="rec-card__desc">{rec.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Filter pill ─────────────────────────────────── */}
      {isFiltered && (
        <div className="analytics__filter-bar">
          <span className="analytics__filter-label">
            Filtered: {filterLabel(filter)} ({filteredCount} session{filteredCount !== 1 ? 's' : ''})
          </span>
          <button className="analytics__filter-clear" onClick={() => setFilter(null)}>✕ Clear</button>
        </div>
      )}

      {/* ── 2. Conversation Outcomes ───────────────────── */}
      <p className="analytics__section-title">Conversation Outcomes</p>
      <div className="analytics__split-row">
        <div className="analytics__chart">
          <div className="analytics__chart-header">
            <p className="analytics__chart-title">Outcomes — last 30 days</p>
          </div>
          {chartData.outcomesByDate.length === 0 ? (
            <div className="empty-state">No conversation data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData.outcomesByDate} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUTCOME_COLORS.resolved} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={OUTCOME_COLORS.resolved} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradAbandoned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUTCOME_COLORS.abandoned} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={OUTCOME_COLORS.abandoned} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradUnengaged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUTCOME_COLORS.unengaged} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={OUTCOME_COLORS.unengaged} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <Tooltip labelFormatter={(l) => `Date: ${String(l)}`} />
                <Legend />
                <Area type="monotone" dataKey="resolved" stackId="1" stroke={OUTCOME_COLORS.resolved} fill="url(#gradResolved)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="abandoned" stackId="1" stroke={OUTCOME_COLORS.abandoned} fill="url(#gradAbandoned)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="unengaged" stackId="1" stroke={OUTCOME_COLORS.unengaged} fill="url(#gradUnengaged)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics__chart">
          <div className="analytics__chart-header">
            <p className="analytics__chart-title">Outcome breakdown</p>
          </div>
          {total === 0 ? (
            <div className="empty-state">No data.</div>
          ) : (
            <div className="analytics__donut-layout">
              <div className="analytics__donut-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={45} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                      {donutData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          cursor="pointer"
                          opacity={filter?.type === 'outcome' && filter.value !== entry.key ? 0.3 : 1}
                          onClick={() => toggleFilter({ type: 'outcome', value: entry.key })}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="analytics__donut-center">
                  <span className="analytics__donut-total">{isFiltered ? filteredCount : total}</span>
                  <span className="analytics__donut-label">{isFiltered ? 'filtered' : 'total'}</span>
                </div>
              </div>
              <div className="analytics__outcome-legend">
                {donutData.map((d) => (
                  <div
                    key={d.name}
                    className="analytics__outcome-legend-item"
                    style={{
                      opacity: filter?.type === 'outcome' && filter.value !== d.key ? 0.4 : 1,
                      fontWeight: filter?.type === 'outcome' && filter.value === d.key ? 700 : 400,
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleFilter({ type: 'outcome', value: d.key })}
                  >
                    <span className="analytics__outcome-dot" style={{ background: d.color }} />
                    <span>{d.name}</span>
                    <strong style={{ marginLeft: 'auto' }}>
                      {d.value} ({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Session Depth + Activity Patterns ───────── */}
      <p className="analytics__section-title">Engagement Intelligence</p>
      <div className="analytics__split-row">
        <div className="analytics__chart">
          <div className="analytics__chart-header">
            <p className="analytics__chart-title">Session depth (messages per session)</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.depthDistribution} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#0078d4"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
                cursor="pointer"
                onClick={(_data: unknown, index: number) =>
                  toggleFilter({ type: 'depth', value: DEPTH_LABELS[index] })
                }
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics__chart">
          <div className="analytics__chart-header">
            <p className="analytics__chart-title">Peak activity hours</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.hourlyDistribution} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={formatHour} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
              <Tooltip labelFormatter={(h) => `${formatHour(h as number)} — ${formatHour((h as number) + 1)}`} />
              <Bar
                dataKey="count"
                fill="#8764b8"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                cursor="pointer"
                onClick={(_data: unknown, index: number) =>
                  toggleFilter({ type: 'hour', value: index })
                }
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 4. Response Performance ────────────────────── */}
      <p className="analytics__section-title">Response Performance</p>
      <div className="analytics__chart">
        <div className="analytics__chart-header">
          <p className="analytics__chart-title">Avg bot response time — last 30 days</p>
          <span className="analytics__chart-subtitle">
            Overall avg: {formatDuration(analytics.avgResponseTimeSeconds)}
          </span>
        </div>
        {chartData.responseTimeByDate.length === 0 ? (
          <div className="empty-state">No response time data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData.responseTimeByDate} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={36}
                tickFormatter={(v: number) => `${v.toFixed(0)}s`}
              />
              <Tooltip
                formatter={(_value) => [`${(_value as number).toFixed(1)}s`, 'Avg response time']}
                labelFormatter={(label) => `Date: ${String(label)}`}
              />
              <Line type="monotone" dataKey="avgSeconds" stroke="#0078d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
