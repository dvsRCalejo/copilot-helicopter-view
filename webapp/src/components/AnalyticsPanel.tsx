import { useState, useMemo, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Card,
  Button,
} from '@fluentui/react-components';
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

/* ────────────────────────────────────────────────── */
/*  Styles                                            */
/* ────────────────────────────────────────────────── */

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
    gap: '14px',
  },
  kpiCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '6px',
    borderRadius: '16px',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    background: [
      'radial-gradient(circle at top right, rgba(110, 193, 255, 0.10), transparent 40%)',
      'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246, 250, 253, 0.94))',
    ].join(','),
    boxShadow: '0 8px 20px rgba(15, 43, 70, 0.05)',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  kpiCardActive: {
    borderTopColor: '#0078d4',
    borderRightColor: '#0078d4',
    borderBottomColor: '#0078d4',
    borderLeftColor: '#0078d4',
    boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.25), 0 8px 20px rgba(15, 43, 70, 0.08)',
  },
  kpiLabel: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontWeight: 500,
  },
  kpiValue: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: 1.1,
    color: tokens.colorNeutralForeground1,
  },
  kpiDelta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: '6px',
    width: 'fit-content',
  },
  deltaUp:      { color: '#107c10', backgroundColor: 'rgba(16, 124, 16, 0.08)' },
  deltaDown:    { color: '#c50f1f', backgroundColor: 'rgba(197, 15, 31, 0.08)' },
  deltaNeutral: { color: tokens.colorNeutralForeground3, backgroundColor: 'rgba(0,0,0,0.04)' },

  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '12px',
    background: 'rgba(0, 120, 212, 0.06)',
    border: '1px solid rgba(0, 120, 212, 0.18)',
  },

  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
    gap: '14px',
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '4px',
    borderRadius: '14px',
    border: '1px solid rgba(9, 30, 66, 0.06)',
    background: 'rgba(244, 248, 252, 0.8)',
  },

  recsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
    gap: '14px',
  },
  recCard: {
    display: 'flex',
    gap: '14px',
    padding: '18px 20px',
    borderRadius: '16px',
    border: '1px solid',
    alignItems: 'flex-start',
  },
  recIcon: { fontSize: '22px', lineHeight: 1, flexShrink: 0, paddingTop: '2px' },
  recBody: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },

  chartWrapper: {
    padding: '20px',
    borderRadius: '18px',
    border: '1px solid rgba(9, 30, 66, 0.08)',
    boxShadow: '0 8px 20px rgba(15, 43, 70, 0.05)',
    background: 'rgba(255,255,255,0.96)',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  splitRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
    '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
  },
  outcomeDonutCenter: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center' as const,
    pointerEvents: 'none' as const,
  },
  outcomeLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    justifyContent: 'center',
    paddingLeft: '16px',
  },
  outcomeLegendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '8px',
    transition: 'background 0.12s',
  },
  outcomeDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  noData: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalXXXL} 0`,
    color: tokens.colorNeutralForeground3,
  },
});

/* ────────────────────────────────────────────────── */
/*  Sub-components                                    */
/* ────────────────────────────────────────────────── */

const SEVERITY_STYLES: Record<RecommendationSeverity, { bg: string; border: string; color: string }> = {
  critical: { bg: 'rgba(197, 15, 31, 0.06)', border: 'rgba(197, 15, 31, 0.25)', color: '#a4262c' },
  warning:  { bg: 'rgba(255, 185, 0, 0.08)', border: 'rgba(255, 185, 0, 0.30)', color: '#835c00' },
  info:     { bg: 'rgba(0, 120, 212, 0.06)', border: 'rgba(0, 120, 212, 0.20)', color: '#0078d4' },
  success:  { bg: 'rgba(16, 124, 16, 0.06)', border: 'rgba(16, 124, 16, 0.20)', color: '#107c10' },
};

function DeltaBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const styles = useStyles();
  const isUp = value > 0;
  const isDown = value < 0;
  const cls = isUp ? styles.deltaUp : isDown ? styles.deltaDown : styles.deltaNeutral;
  const arrow = isUp ? '↑' : isDown ? '↓' : '→';
  return (
    <span className={`${styles.kpiDelta} ${cls}`}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

/* ────────────────────────────────────────────────── */
/*  Main component                                    */
/* ────────────────────────────────────────────────── */

interface AnalyticsPanelProps {
  analytics: AgentAnalytics;
  sessions: SessionMeta[];
}

export function AnalyticsPanel({ analytics, sessions }: AnalyticsPanelProps) {
  const styles = useStyles();
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
    <div className={styles.root}>
      {/* ── 1. Overview: KPIs + Metrics + Recommendations ── */}
      <Text className={styles.sectionTitle}>Overview</Text>
      <div className={styles.kpiRow}>
        <Card
          className={`${styles.kpiCard} ${!isFiltered ? styles.kpiCardActive : ''}`}
          onClick={() => setFilter(null)}
        >
          <span className={styles.kpiLabel}>Total sessions</span>
          <span className={styles.kpiValue}>{analytics.totalSessions}</span>
          <DeltaBadge value={analytics.sessionsChange} />
        </Card>

        <Card
          className={`${styles.kpiCard} ${filter?.type === 'outcome' && filter.value === 'resolved' ? styles.kpiCardActive : ''}`}
          onClick={() => toggleFilter({ type: 'outcome', value: 'resolved' })}
        >
          <span className={styles.kpiLabel}>Resolution rate</span>
          <span className={styles.kpiValue}>{analytics.successRate.toFixed(1)}%</span>
          <DeltaBadge value={analytics.successRateChange} suffix=" pp" />
        </Card>

        <Card
          className={`${styles.kpiCard} ${filter?.type === 'outcome' && filter.value === 'abandoned' ? styles.kpiCardActive : ''}`}
          onClick={() => toggleFilter({ type: 'outcome', value: 'abandoned' })}
        >
          <span className={styles.kpiLabel}>Abandoned</span>
          <span className={styles.kpiValue}>
            {total > 0 ? ((analytics.outcomes.abandoned / total) * 100).toFixed(1) : 0}%
          </span>
        </Card>

        <Card className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Avg duration</span>
          <span className={styles.kpiValue}>{formatDuration(analytics.avgDurationSeconds)}</span>
          <DeltaBadge value={analytics.durationChange} />
        </Card>

        <Card className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Avg response time</span>
          <span className={styles.kpiValue}>{formatDuration(analytics.avgResponseTimeSeconds)}</span>
        </Card>
      </div>

      {/* Key Metrics inline */}
      <div className={styles.metricsRow}>
        <Card className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Avg messages / session</Text>
          <Text size={500} weight="bold">{analytics.avgMessagesPerSession.toFixed(1)}</Text>
        </Card>
        <Card className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Engagement rate</Text>
          <Text size={500} weight="bold">{analytics.engagementRate.toFixed(1)}%</Text>
        </Card>
        <Card className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Sessions (7d / 30d)</Text>
          <Text size={500} weight="bold">{analytics.sessionsLast7Days} / {analytics.sessionsLast30Days}</Text>
        </Card>
        <Card className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Last activity</Text>
          <Text size={500} weight="bold">
            {analytics.lastActivity
              ? new Date(analytics.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </Text>
        </Card>
      </div>

      {/* Recommendations inline */}
      {recommendations.length > 0 && (
        <div className={styles.recsGrid}>
          {recommendations.map((rec, i) => {
            const sv = SEVERITY_STYLES[rec.severity];
            return (
              <Card key={i} className={styles.recCard} style={{ background: sv.bg, borderColor: sv.border }}>
                <span className={styles.recIcon}>{rec.icon}</span>
                <div className={styles.recBody}>
                  <Text weight="semibold" style={{ color: sv.color }}>{rec.title}</Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{rec.description}</Text>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Filter pill ─────────────────────────────────── */}
      {isFiltered && (
        <div className={styles.filterBar}>
          <Text size={200} weight="semibold" style={{ color: '#0078d4' }}>
            Filtered: {filterLabel(filter)} ({filteredCount} session{filteredCount !== 1 ? 's' : ''})
          </Text>
          <Button size="small" appearance="subtle" onClick={() => setFilter(null)}>✕ Clear</Button>
        </div>
      )}

      {/* ── 2. Conversation Outcomes ───────────────────── */}
      <Text className={styles.sectionTitle}>Conversation Outcomes</Text>
      <div className={styles.splitRow}>
        <Card className={styles.chartWrapper}>
          <div className={styles.chartHeader}>
            <Text weight="semibold">Outcomes — last 30 days</Text>
          </div>
          {chartData.outcomesByDate.length === 0 ? (
            <div className={styles.noData}><Text>No conversation data.</Text></div>
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <Tooltip labelFormatter={(l: string) => `Date: ${l}`} />
                <Legend />
                <Area type="monotone" dataKey="resolved" stackId="1" stroke={OUTCOME_COLORS.resolved} fill="url(#gradResolved)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="abandoned" stackId="1" stroke={OUTCOME_COLORS.abandoned} fill="url(#gradAbandoned)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="unengaged" stackId="1" stroke={OUTCOME_COLORS.unengaged} fill="url(#gradUnengaged)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className={styles.chartWrapper}>
          <div className={styles.chartHeader}>
            <Text weight="semibold">Outcome breakdown</Text>
          </div>
          {total === 0 ? (
            <div className={styles.noData}><Text>No data.</Text></div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 160, height: 160 }}>
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
                <div className={styles.outcomeDonutCenter}>
                  <Text size={600} weight="bold">{isFiltered ? filteredCount : total}</Text>
                  <br />
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                    {isFiltered ? 'filtered' : 'total'}
                  </Text>
                </div>
              </div>
              <div className={styles.outcomeLegend}>
                {donutData.map((d) => (
                  <div
                    key={d.name}
                    className={styles.outcomeLegendItem}
                    style={{
                      opacity: filter?.type === 'outcome' && filter.value !== d.key ? 0.4 : 1,
                      fontWeight: filter?.type === 'outcome' && filter.value === d.key ? 700 : 400,
                    }}
                    onClick={() => toggleFilter({ type: 'outcome', value: d.key })}
                  >
                    <span className={styles.outcomeDot} style={{ background: d.color }} />
                    <span>{d.name}</span>
                    <Text weight="semibold" style={{ marginLeft: 'auto' }}>
                      {d.value} ({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── 3. Session Depth + Activity Patterns ───────── */}
      <Text className={styles.sectionTitle}>Engagement Intelligence</Text>
      <div className={styles.splitRow}>
        <Card className={styles.chartWrapper}>
          <div className={styles.chartHeader}>
            <Text weight="semibold">Session depth (messages per session)</Text>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.depthDistribution} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
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
        </Card>

        <Card className={styles.chartWrapper}>
          <div className={styles.chartHeader}>
            <Text weight="semibold">Peak activity hours</Text>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.hourlyDistribution} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={formatHour} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
              <Tooltip labelFormatter={(h: number) => `${formatHour(h)} — ${formatHour(h + 1)}`} />
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
        </Card>
      </div>

      {/* ── 4. Response Performance ────────────────────── */}
      <Text className={styles.sectionTitle}>Response Performance</Text>
      <Card className={styles.chartWrapper}>
        <div className={styles.chartHeader}>
          <Text weight="semibold">Avg bot response time — last 30 days</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Overall avg: {formatDuration(analytics.avgResponseTimeSeconds)}
          </Text>
        </div>
        {chartData.responseTimeByDate.length === 0 ? (
          <div className={styles.noData}><Text>No response time data available.</Text></div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData.responseTimeByDate} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} width={36} tickFormatter={(v: number) => `${v.toFixed(0)}s`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}s`, 'Avg response time']}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="avgSeconds" stroke="#0078d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
