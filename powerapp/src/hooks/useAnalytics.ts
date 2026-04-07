import { useMemo } from 'react';
import type { ConversationTranscript, AgentAnalytics, BotActivity, SessionMeta } from '@/types';

function parseActivities(content: string | null): BotActivity[] {
  if (!content) return [];
  try {
    const parsed: unknown = JSON.parse(content);
    const activities: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { activities?: unknown[] }).activities ?? [];
    return activities as BotActivity[];
  } catch {
    return [];
  }
}

/** Outcome classification for a single session */
type SessionOutcome = 'resolved' | 'abandoned' | 'unengaged';

interface SessionAnalysis {
  outcome: SessionOutcome;
  messageCount: number;
  userMessageCount: number;
  durationSeconds: number;
  /** Bot response latencies within this session (seconds) */
  responseTimes: number[];
}

function analyzeSession(t: ConversationTranscript): SessionAnalysis {
  const activities = parseActivities(t.content);
  const messages = activities.filter((a) => a.type === 'message' && !!a.text);
  const userMessages = messages.filter((a: BotActivity) => a.from?.role?.toLowerCase() === 'user');
  const botMessages = messages.filter((a) => a.from?.role?.toLowerCase() !== 'user');

  // Duration
  let durationSeconds = 0;
  const timestamps = activities
    .map((a) => (a.timestamp ? new Date(a.timestamp).getTime() : NaN))
    .filter(Number.isFinite);
  if (timestamps.length >= 2) {
    durationSeconds = (Math.max(...timestamps) - Math.min(...timestamps)) / 1000;
  }

  // Bot response latencies: time from each user message to the next bot reply
  const responseTimes: number[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];
    if (
      msg.from?.role?.toLowerCase() === 'user' &&
      next.from?.role?.toLowerCase() !== 'user' &&
      msg.timestamp &&
      next.timestamp
    ) {
      const delta =
        (new Date(next.timestamp).getTime() - new Date(msg.timestamp).getTime()) / 1000;
      if (delta >= 0 && delta < 600) responseTimes.push(delta); // cap at 10 min
    }
  }

  // Outcome classification
  let outcome: SessionOutcome;
  if (userMessages.length <= 1 && botMessages.length === 0) {
    outcome = 'unengaged';
  } else if (botMessages.length === 0) {
    outcome = 'abandoned';
  } else {
    // Check if last user message got a bot reply
    const lastUserIdx = messages.findLastIndex(
      (a: BotActivity) => a.from?.role?.toLowerCase() === 'user'
    );
    const hasReplyAfterLastUser = lastUserIdx >= 0 && lastUserIdx < messages.length - 1;
    outcome = hasReplyAfterLastUser ? 'resolved' : 'abandoned';
  }

  return {
    outcome,
    messageCount: messages.length,
    userMessageCount: userMessages.length,
    durationSeconds,
    responseTimes,
  };
}

const DEPTH_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '1-2', min: 1, max: 2 },
  { label: '3-5', min: 3, max: 5 },
  { label: '6-10', min: 6, max: 10 },
  { label: '11-20', min: 11, max: 20 },
  { label: '20+', min: 21, max: Infinity },
];

/**
 * Derives advanced analytics from conversation transcripts.
 */
export function useAnalytics(
  transcripts: ConversationTranscript[] | undefined
): { analytics: AgentAnalytics; sessions: SessionMeta[] } {
  return useMemo(() => {
    const empty: AgentAnalytics = {
      totalSessions: 0, sessionsLast7Days: 0, sessionsLast30Days: 0,
      byDate: [], lastActivity: null,
      successRate: 0, avgDurationSeconds: 0, avgMessagesPerSession: 0,
      sessionsChange: 0, successRateChange: 0, durationChange: 0,
      engagementRate: 0, avgResponseTimeSeconds: 0,
      outcomes: { resolved: 0, abandoned: 0, unengaged: 0 },
      outcomesByDate: [], depthDistribution: [], hourlyDistribution: [],
      responseTimeByDate: [],
    };
    if (!transcripts || transcripts.length === 0)
      return { analytics: empty, sessions: [] };

    const now = Date.now();
    const MS_7D = 7 * 24 * 60 * 60 * 1000;
    const MS_30D = 30 * 24 * 60 * 60 * 1000;

    let sessionsLast7Days = 0;
    let sessionsLast30Days = 0;
    let sessionsPrev7Days = 0;
    let totalMessages = 0;
    let totalDuration = 0;
    let successCount = 0;
    let successLast7 = 0;
    let successPrev7 = 0;
    let durationLast7 = 0;
    let durationCountLast7 = 0;
    let durationPrev7 = 0;
    let durationCountPrev7 = 0;
    let engagedCount = 0;
    const allResponseTimes: number[] = [];

    const dateMap = new Map<string, { count: number; successful: number; failed: number }>();
    const outcomeMap = new Map<
      string,
      { resolved: number; abandoned: number; unengaged: number }
    >();
    const hourCounts = new Array(24).fill(0) as number[];
    const depthCounts = DEPTH_BUCKETS.map(() => 0);
    const responseTimeMap = new Map<string, { total: number; count: number }>();

    const outcomes = { resolved: 0, abandoned: 0, unengaged: 0 };
    const sessions: SessionMeta[] = [];

    for (const t of transcripts) {
      const ts = new Date(t.createdon).getTime();
      const delta = now - ts;
      const analysis = analyzeSession(t);
      const hasBotReply = analysis.outcome === 'resolved';

      if (hasBotReply) successCount++;
      totalMessages += analysis.messageCount;
      totalDuration += analysis.durationSeconds;
      if (analysis.userMessageCount >= 2) engagedCount++;
      allResponseTimes.push(...analysis.responseTimes);

      // Outcome totals
      outcomes[analysis.outcome]++;

      if (delta <= MS_7D) {
        sessionsLast7Days++;
        if (hasBotReply) successLast7++;
        durationLast7 += analysis.durationSeconds;
        durationCountLast7++;
      } else if (delta <= MS_7D * 2) {
        sessionsPrev7Days++;
        if (hasBotReply) successPrev7++;
        durationPrev7 += analysis.durationSeconds;
        durationCountPrev7++;
      }
      if (delta <= MS_30D) sessionsLast30Days++;

      const dateKey = t.createdon.slice(0, 10);
      const hour = new Date(t.createdon).getHours();

      // Depth bucket
      let depthBucket = '20+';
      for (const b of DEPTH_BUCKETS) {
        if (analysis.messageCount >= b.min && analysis.messageCount <= b.max) {
          depthBucket = b.label;
          break;
        }
      }

      // Build session meta
      sessions.push({
        outcome: analysis.outcome,
        messageCount: analysis.messageCount,
        userMessageCount: analysis.userMessageCount,
        durationSeconds: analysis.durationSeconds,
        responseTimes: analysis.responseTimes,
        dateKey,
        hour,
        depthBucket,
      });

      // Existing success/failed chart
      const entry = dateMap.get(dateKey) ?? { count: 0, successful: 0, failed: 0 };
      entry.count++;
      if (hasBotReply) entry.successful++;
      else entry.failed++;
      dateMap.set(dateKey, entry);

      // Outcome by date
      const oEntry = outcomeMap.get(dateKey) ?? { resolved: 0, abandoned: 0, unengaged: 0 };
      oEntry[analysis.outcome]++;
      outcomeMap.set(dateKey, oEntry);

      // Hour distribution
      hourCounts[hour]++;

      // Depth distribution
      depthCounts[DEPTH_BUCKETS.findIndex((b) => b.label === depthBucket)]++;

      // Response time by date
      if (analysis.responseTimes.length > 0) {
        const rtEntry = responseTimeMap.get(dateKey) ?? { total: 0, count: 0 };
        for (const rt of analysis.responseTimes) {
          rtEntry.total += rt;
          rtEntry.count++;
        }
        responseTimeMap.set(dateKey, rtEntry);
      }
    }

    // Period-over-period changes
    const sessionsChange =
      sessionsPrev7Days > 0
        ? ((sessionsLast7Days - sessionsPrev7Days) / sessionsPrev7Days) * 100
        : 0;
    const rateLast7 = sessionsLast7Days > 0 ? (successLast7 / sessionsLast7Days) * 100 : 0;
    const ratePrev7 = sessionsPrev7Days > 0 ? (successPrev7 / sessionsPrev7Days) * 100 : 0;
    const successRateChange = rateLast7 - ratePrev7;
    const avgDurLast7 = durationCountLast7 > 0 ? durationLast7 / durationCountLast7 : 0;
    const avgDurPrev7 = durationCountPrev7 > 0 ? durationPrev7 / durationCountPrev7 : 0;
    const durationChange =
      avgDurPrev7 > 0 ? ((avgDurLast7 - avgDurPrev7) / avgDurPrev7) * 100 : 0;

    // Chart data — last 30 days, sorted
    const cutoff = new Date(now - MS_30D).toISOString().slice(0, 10);
    const byDate = Array.from(dateMap.entries())
      .filter(([d]) => d >= cutoff)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const outcomesByDate = Array.from(outcomeMap.entries())
      .filter(([d]) => d >= cutoff)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const responseTimeByDate = Array.from(responseTimeMap.entries())
      .filter(([d]) => d >= cutoff)
      .map(([date, v]) => ({ date, avgSeconds: v.count > 0 ? v.total / v.count : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sorted = [...transcripts].sort(
      (a, b) => new Date(b.createdon).getTime() - new Date(a.createdon).getTime()
    );

    const avgResponseTimeSeconds =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((s, v) => s + v, 0) / allResponseTimes.length
        : 0;

    return {
      analytics: {
        totalSessions: transcripts.length,
        sessionsLast7Days,
        sessionsLast30Days,
        byDate,
        lastActivity: sorted[0]?.createdon ?? null,
        successRate: transcripts.length > 0 ? (successCount / transcripts.length) * 100 : 0,
        avgDurationSeconds: transcripts.length > 0 ? totalDuration / transcripts.length : 0,
        avgMessagesPerSession: transcripts.length > 0 ? totalMessages / transcripts.length : 0,
        sessionsChange,
        successRateChange,
        durationChange,
        engagementRate: transcripts.length > 0 ? (engagedCount / transcripts.length) * 100 : 0,
        avgResponseTimeSeconds,
        outcomes,
        outcomesByDate,
        depthDistribution: DEPTH_BUCKETS.map((b, i) => ({ range: b.label, count: depthCounts[i] })),
        hourlyDistribution: hourCounts.map((count, hour) => ({ hour, count })),
        responseTimeByDate,
      },
      sessions,
    };
  }, [transcripts]);
}

