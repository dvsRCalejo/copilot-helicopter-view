// TypeScript interfaces mirroring the Dataverse bot and conversationtranscript entities.
// Kept in sync with webapp/src/types/index.ts

export interface PowerPlatformEnvironment {
  environmentId: string;
  displayName: string;
  instanceUrl: string;
}

export interface CopilotAgent {
  botid: string;
  name: string;
  iconbase64: string | null;
  /** 0 = Active, 1 = Inactive */
  statecode: number;
  statuscode: number;
  publishedon: string | null;
  createdon: string;
  modifiedon: string;
  /** ID of the owning user (Dataverse systemuserid) */
  _owninguser_value: string | null;
  /** Display name of the owning principal */
  _ownerid_value: string | null;
  description: string | null;
  /** LCID language code */
  language: number;
  /** 0 = Classic, 1 = Generative */
  runtimeprovider: number | null;
  schemaname: string | null;
  /** Computed by the app — true when owner principal matches the signed-in user */
  isOwner?: boolean;
  /** Power Platform environment this agent was loaded from */
  environmentId: string | null;
  environmentDisplayName: string | null;
}

export interface ConversationTranscript {
  conversationtranscriptid: string;
  name: string | null;
  createdon: string;
  modifiedon: string;
  /** Raw JSON string — Bot Framework Activity array */
  content: string | null;
  schematype: string | null;
  conversationstarttime?: string;
  _bot_conversationtranscriptid_value: string | null;
}

/** Parsed Bot Framework Activity (subset we render) */
export interface BotActivity {
  type: string;
  id?: string;
  timestamp?: string;
  channelId?: string;
  from?: {
    id: string;
    name?: string;
    role?: string | number;
  };
  text?: string;
}

/**
 * Safely check whether an activity's from.role represents a user.
 * Real Dataverse transcripts may store role as a number (0 = user)
 * instead of the string "user".
 */
export function isUserRole(activity: BotActivity): boolean {
  const r = activity.from?.role;
  if (r == null) return false;
  if (typeof r === 'number') return r === 0;
  return String(r).toLowerCase() === 'user';
}

const CHANNEL_LABELS: Record<string, { label: string; icon: string }> = {
  msteams:       { label: 'Teams',       icon: '💬' },
  directline:    { label: 'Web Chat',    icon: '🌐' },
  webchat:       { label: 'Web Chat',    icon: '🌐' },
  facebook:      { label: 'Facebook',    icon: '📘' },
  slack:         { label: 'Slack',       icon: '💼' },
  telegram:      { label: 'Telegram',    icon: '✈️' },
  email:         { label: 'Email',       icon: '📧' },
  sms:           { label: 'SMS',         icon: '📱' },
  line:          { label: 'LINE',        icon: '💚' },
  twilio:        { label: 'Twilio',      icon: '📞' },
  omnichannel:   { label: 'Omnichannel', icon: '🔄' },
  test:          { label: 'Test',        icon: '🧪' },
};

/** Friendly channel display info from a channelId string */
export function getChannelInfo(channelId: string | undefined): { label: string; icon: string } {
  if (!channelId) return { label: 'Unknown', icon: '❓' };
  const key = channelId.toLowerCase().replace(/-/g, '');
  return CHANNEL_LABELS[key] ?? { label: channelId, icon: '💬' };
}

/** Extract the channelId from the first activity in a transcript's content JSON */
export function extractChannel(content: string | null): string | undefined {
  if (!content) return undefined;
  try {
    const parsed: unknown = JSON.parse(content);
    const activities: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { activities?: unknown[] }).activities ?? [];
    const first = activities[0] as BotActivity | undefined;
    return first?.channelId ?? undefined;
  } catch {
    return undefined;
  }
}

/** Dataverse WhoAmI response — in Code Apps this is resolved via systemusers */
export interface WhoAmIResponse {
  BusinessUnitId: string;
  OrganizationId: string;
  UserId: string; // Dataverse systemuserid of the current user
}

export interface AgentAnalytics {
  totalSessions: number;
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  byDate: Array<{ date: string; count: number; successful: number; failed: number }>;
  lastActivity: string | null;
  /** Percentage of sessions with at least one bot reply (0–100) */
  successRate: number;
  /** Average session duration in seconds (first→last activity) */
  avgDurationSeconds: number;
  /** Average message count per session */
  avgMessagesPerSession: number;
  /** Period-over-period deltas (current 7d vs previous 7d) */
  sessionsChange: number;
  successRateChange: number;
  durationChange: number;

  /* ── Advanced analytics ───────────────────────────── */
  /** % of sessions where user sent ≥2 messages (returned for more) */
  engagementRate: number;
  /** Avg seconds between a user message and the next bot reply */
  avgResponseTimeSeconds: number;
  /** Conversation outcome breakdown */
  outcomes: { resolved: number; abandoned: number; unengaged: number };
  /** Daily outcome breakdown for stacked chart */
  outcomesByDate: Array<{
    date: string;
    resolved: number;
    abandoned: number;
    unengaged: number;
  }>;
  /** Message-depth histogram buckets */
  depthDistribution: Array<{ range: string; count: number }>;
  /** Sessions by hour-of-day (0-23) */
  hourlyDistribution: Array<{ hour: number; count: number }>;
  /** Avg response time by date for trend chart */
  responseTimeByDate: Array<{ date: string; avgSeconds: number }>;
}

export interface SessionMeta {
  outcome: 'resolved' | 'abandoned' | 'unengaged';
  messageCount: number;
  userMessageCount: number;
  durationSeconds: number;
  responseTimes: number[];
  dateKey: string;
  hour: number;
  depthBucket: string;
}

export type AnalyticsFilter =
  | { type: 'outcome'; value: 'resolved' | 'abandoned' | 'unengaged' }
  | { type: 'depth'; value: string }
  | { type: 'hour'; value: number }
  | null;

export type RecommendationSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface Recommendation {
  severity: RecommendationSeverity;
  icon: string;
  title: string;
  description: string;
}

/** Pure rule-based recommendations derived from AgentAnalytics. */
export function getRecommendations(a: AgentAnalytics): Recommendation[] {
  if (a.totalSessions === 0) return [];
  const recs: Recommendation[] = [];
  const total = a.outcomes.resolved + a.outcomes.abandoned + a.outcomes.unengaged;
  const abandonRate = total > 0 ? (a.outcomes.abandoned / total) * 100 : 0;
  const unengagedRate = total > 0 ? (a.outcomes.unengaged / total) * 100 : 0;

  // Resolution rate
  if (a.successRate < 50) {
    recs.push({ severity: 'critical', icon: '🚨', title: 'Low resolution rate', description: `Only ${a.successRate.toFixed(0)}% of sessions are resolved. Review topic coverage and knowledge sources to ensure the agent can answer common questions.` });
  } else if (a.successRate < 75) {
    recs.push({ severity: 'warning', icon: '⚠️', title: 'Resolution rate could improve', description: `${a.successRate.toFixed(0)}% resolution rate. Analyze abandoned sessions to identify gaps in topic coverage or unclear prompts.` });
  } else if (a.successRate >= 90) {
    recs.push({ severity: 'success', icon: '✅', title: 'Excellent resolution rate', description: `${a.successRate.toFixed(0)}% of conversations are resolved successfully. The agent is handling user queries effectively.` });
  }

  // Abandonment
  if (abandonRate > 30) {
    recs.push({ severity: 'critical', icon: '🚪', title: 'High abandonment rate', description: `${abandonRate.toFixed(0)}% of sessions are abandoned. Users may be frustrated. Consider adding fallback responses, clarification prompts, or escalation paths.` });
  } else if (abandonRate > 15) {
    recs.push({ severity: 'warning', icon: '🚪', title: 'Moderate abandonment', description: `${abandonRate.toFixed(0)}% of sessions are abandoned. Review conversation flows where users stop responding mid-session.` });
  }

  // Unengaged
  if (unengagedRate > 40) {
    recs.push({ severity: 'warning', icon: '👻', title: 'Many unengaged sessions', description: `${unengagedRate.toFixed(0)}% of sessions have no meaningful interaction. The greeting message may not be compelling enough, or users might be reaching the bot accidentally.` });
  }

  // Engagement rate
  if (a.engagementRate < 40) {
    recs.push({ severity: 'warning', icon: '💬', title: 'Low engagement rate', description: `Only ${a.engagementRate.toFixed(0)}% of users send more than one message. Improve the welcome experience and initial prompts to encourage continued conversation.` });
  } else if (a.engagementRate >= 80) {
    recs.push({ severity: 'success', icon: '🤝', title: 'Strong engagement', description: `${a.engagementRate.toFixed(0)}% of users engage in multi-turn conversations. Users find the agent useful enough to continue interacting.` });
  }

  // Response time
  if (a.avgResponseTimeSeconds > 30) {
    recs.push({ severity: 'critical', icon: '🐢', title: 'Slow response time', description: `Average bot response takes ${a.avgResponseTimeSeconds.toFixed(0)}s. Users expect near-instant replies. Check for slow knowledge source lookups, heavy topic flows, or API call bottlenecks.` });
  } else if (a.avgResponseTimeSeconds > 10) {
    recs.push({ severity: 'warning', icon: '⏱️', title: 'Response time above ideal', description: `Average response is ${a.avgResponseTimeSeconds.toFixed(0)}s. Aim for under 5 seconds. Consider simplifying complex topic trees or caching external data.` });
  } else if (a.avgResponseTimeSeconds > 0 && a.avgResponseTimeSeconds <= 3) {
    recs.push({ severity: 'success', icon: '⚡', title: 'Fast response time', description: `Average ${a.avgResponseTimeSeconds.toFixed(1)}s response time. Users experience quick, responsive interactions.` });
  }

  // Session depth
  const shortSessions = a.depthDistribution.find(d => d.range === '1-2')?.count ?? 0;
  const shortRate = a.totalSessions > 0 ? (shortSessions / a.totalSessions) * 100 : 0;
  if (shortRate > 60) {
    recs.push({ severity: 'warning', icon: '📉', title: 'Most sessions are very short', description: `${shortRate.toFixed(0)}% of sessions have only 1-2 messages. Users may not be finding what they need. Consider richer initial responses or proactive suggestions.` });
  }

  // Volume trend
  if (a.sessionsChange < -30) {
    recs.push({ severity: 'warning', icon: '📊', title: 'Declining usage', description: `Session volume dropped ${Math.abs(a.sessionsChange).toFixed(0)}% vs previous week. Monitor for discoverability issues or user dissatisfaction.` });
  } else if (a.sessionsChange > 50) {
    recs.push({ severity: 'info', icon: '📈', title: 'Strong growth', description: `Session volume grew ${a.sessionsChange.toFixed(0)}% week-over-week. Ensure the agent scales well and monitor error rates as load increases.` });
  }

  // Peak hours insight
  const peakHour = a.hourlyDistribution.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0 });
  if (peakHour.count > 0) {
    const h = peakHour.hour % 12 || 12;
    const ampm = peakHour.hour < 12 ? 'AM' : 'PM';
    recs.push({ severity: 'info', icon: '🕐', title: `Peak usage at ${h} ${ampm}`, description: `Most conversations happen around ${h}:00 ${ampm}. Schedule any maintenance or updates outside this window to minimize user disruption.` });
  }

  return recs;
}

export type FilterMode = 'all' | 'owned' | 'shared' | 'active';
export type SortMode = 'newest' | 'oldest';
