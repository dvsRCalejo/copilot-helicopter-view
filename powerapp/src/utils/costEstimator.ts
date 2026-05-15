import ratesJson from '@/data/copilotCreditRates.json';
import type { CopilotAgent } from '@/types';

export interface FeatureRate {
  id: string;
  label: string;
  credits: number;
  defaultPerSession: number;
  appliesTo: string[];
  description: string;
}

export interface AgentTypeRate {
  id: string;
  label: string;
  description: string;
}

export interface CreditRates {
  creditUnitUsd: number;
  agentTypes: AgentTypeRate[];
  features: FeatureRate[];
}

/** Loaded rates. Exported so the UI can render labels/descriptions from the same source. */
export const creditRates: CreditRates = {
  creditUnitUsd: ratesJson.creditUnitUsd,
  agentTypes: ratesJson.agentTypes,
  features: ratesJson.features,
};

export interface EstimatorInput {
  /** Agent type id (must match one of `creditRates.agentTypes[].id`). */
  agentTypeId: string;
  /** Expected billable sessions/runs per month. */
  sessionsPerMonth: number;
  /** Map of feature id -> occurrences per session (or per autonomous run). */
  perSession: Record<string, number>;
}

export interface EstimatorBreakdownItem {
  featureId: string;
  label: string;
  perSession: number;
  unitCredits: number;
  monthlyCredits: number;
  monthlyUsd: number;
}

export interface EstimatorResult {
  totalCredits: number;
  totalUsd: number;
  perSessionCredits: number;
  perSessionUsd: number;
  breakdown: EstimatorBreakdownItem[];
}

const sanitize = (n: number): number => (Number.isFinite(n) && n >= 0 ? n : 0);

/**
 * Pure computation: monthly Copilot credit estimate for a single agent.
 * Mirrors the public Copilot Studio Estimator math: sum(featureCount * unitCredits) * sessions/month.
 */
export function estimateMonthlyCost(
  input: EstimatorInput,
  rates: CreditRates = creditRates,
): EstimatorResult {
  const sessions = sanitize(input.sessionsPerMonth);
  const applicable = rates.features.filter((f) => f.appliesTo.includes(input.agentTypeId));

  const breakdown: EstimatorBreakdownItem[] = applicable.map((f) => {
    const perSession = sanitize(input.perSession[f.id] ?? 0);
    const monthlyCredits = perSession * f.credits * sessions;
    return {
      featureId: f.id,
      label: f.label,
      perSession,
      unitCredits: f.credits,
      monthlyCredits,
      monthlyUsd: monthlyCredits * rates.creditUnitUsd,
    };
  });

  const perSessionCredits = breakdown.reduce(
    (acc, item) => acc + item.perSession * item.unitCredits,
    0,
  );
  const totalCredits = breakdown.reduce((acc, item) => acc + item.monthlyCredits, 0);

  return {
    totalCredits,
    totalUsd: totalCredits * rates.creditUnitUsd,
    perSessionCredits,
    perSessionUsd: perSessionCredits * rates.creditUnitUsd,
    breakdown,
  };
}

/**
 * Build sensible default inputs for an agent. Uses the agent's runtimeprovider
 * (1 = Generative, 0 = Classic) to pick generative vs. classic answer mix.
 * Pure function — no React, safe to share with Power App.
 */
export function buildDefaultInput(
  agent: Pick<CopilotAgent, 'runtimeprovider'> | null,
  agentTypeId: string = 'standard',
  rates: CreditRates = creditRates,
): EstimatorInput {
  const perSession: Record<string, number> = {};
  for (const f of rates.features) {
    if (!f.appliesTo.includes(agentTypeId)) continue;
    perSession[f.id] = f.defaultPerSession;
  }

  // Heuristic: classic agents lean on scripted topics; generative agents on generative answers.
  if (agentTypeId === 'standard' && agent) {
    if (agent.runtimeprovider === 0) {
      // Classic
      if ('classicAnswer' in perSession) perSession.classicAnswer = 3;
      if ('generativeAnswer' in perSession) perSession.generativeAnswer = 0;
    } else if (agent.runtimeprovider === 1) {
      // Generative
      if ('classicAnswer' in perSession) perSession.classicAnswer = 1;
      if ('generativeAnswer' in perSession) perSession.generativeAnswer = 2;
    }
  }

  return {
    agentTypeId,
    sessionsPerMonth: 1000,
    perSession,
  };
}

export const formatCredits = (n: number): string =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export const formatUsd = (n: number): string =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** Minimal transcript shape needed for cost-baseline inference. */
export interface TranscriptLike {
  createdon: string;
  content: string | null;
}

export interface TranscriptSampleStats {
  /** Sessions in the trailing 30 days. */
  sessionsLast30Days: number;
  /** Total transcripts in the sample. */
  totalSessions: number;
  /** Span (days) from oldest transcript to now, min 1. */
  daysObserved: number;
  /** Approximate bot reply turns per session (used as the answer count). */
  avgBotRepliesPerSession: number;
  /** Total messages across sessions (for display). */
  avgMessagesPerSession: number;
}

export interface DetectedFeatureInfo {
  featureId: string;
  score: number;
}

export interface FeatureDetectionResult {
  byFeature: Record<string, number>;
  detected: DetectedFeatureInfo[];
}

function countSessionStats(t: TranscriptLike): { messages: number; botReplies: number } {
  if (!t.content) return { messages: 0, botReplies: 0 };
  try {
    const parsed: unknown = JSON.parse(t.content);
    const activities: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { activities?: unknown[] }).activities ?? [];
    let messages = 0;
    let botReplies = 0;
    for (const a of activities) {
      const act = a as { type?: string; text?: string; from?: { role?: string | number } };
      if (act?.type !== 'message' || !act.text) continue;
      messages++;
      const r = act.from?.role;
      const isUser = typeof r === 'number' ? r === 0 : String(r ?? '').toLowerCase() === 'user';
      if (!isUser) botReplies++;
    }
    return { messages, botReplies };
  } catch {
    return { messages: 0, botReplies: 0 };
  }
}

function countKeyword(raw: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  const matches = raw.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Heuristic feature detection from agent configuration JSON/text.
 * Scores are relative signal strengths, not exact invocation counts.
 */
export function detectAgentFeatures(
  agent: Pick<CopilotAgent, 'runtimeprovider' | 'configuration'> | null,
  agentTypeId: string = 'standard',
  rates: CreditRates = creditRates,
): FeatureDetectionResult {
  const byFeature: Record<string, number> = {};
  const applicable = rates.features.filter((f) => f.appliesTo.includes(agentTypeId));
  for (const f of applicable) byFeature[f.id] = 0;

  if (!agent) {
    return { byFeature, detected: [] };
  }

  const cfg = (agent.configuration ?? '').toLowerCase();
  const signals: Record<string, string[]> = {
    classicAnswer: ['topic', 'trigger', 'dialog', 'scripted'],
    generativeAnswer: ['generative', 'genai', 'llm', 'answer'],
    generativeAnswerEnterprise: ['dataverse', 'sharepoint', 'file', 'knowledge', 'document'],
    tenantGraphGrounding: ['microsoft graph', 'graph', 'calendar', 'email', 'outlook'],
    action: ['action', 'connector', 'power automate', 'flow', 'plugin', 'api'],
    aiBuilderPrompt: ['ai builder', 'aibuilder', 'prompt'],
    autonomousTask: ['autonomous', 'trigger', 'schedule', 'event'],
    autonomousAction: ['autonomous', 'action', 'flow', 'connector'],
  };

  for (const feature of applicable) {
    const kws = signals[feature.id] ?? [];
    byFeature[feature.id] = kws.reduce((acc, kw) => acc + countKeyword(cfg, kw), 0);
  }

  // Runtime hint when configuration has no obvious signal.
  if (agentTypeId === 'standard') {
    if ((byFeature.classicAnswer ?? 0) === 0 && (byFeature.generativeAnswer ?? 0) === 0) {
      if (agent.runtimeprovider === 0) byFeature.classicAnswer = 1;
      if (agent.runtimeprovider === 1) byFeature.generativeAnswer = 1;
    }
  }
  if (agentTypeId === 'autonomous' && (byFeature.autonomousTask ?? 0) === 0) {
    byFeature.autonomousTask = 1;
  }

  const detected = Object.entries(byFeature)
    .filter(([, score]) => score > 0)
    .map(([featureId, score]) => ({ featureId, score }))
    .sort((a, b) => b.score - a.score);

  return { byFeature, detected };
}

function distributeEvenly(total: number, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (total <= 0 || ids.length === 0) return out;
  const q = Math.floor(total / ids.length);
  let r = total % ids.length;
  ids.forEach((id) => {
    out[id] = q + (r > 0 ? 1 : 0);
    if (r > 0) r--;
  });
  return out;
}

function distributeByScore(
  total: number,
  ids: string[],
  scoreByFeature: Record<string, number>,
): Record<string, number> {
  if (total <= 0 || ids.length === 0) return {};

  const weights = ids.map((id) => Math.max(0, scoreByFeature[id] ?? 0));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return distributeEvenly(total, ids);

  const raw = weights.map((w) => (total * w) / weightSum);
  const floorVals = raw.map((v) => Math.floor(v));
  let assigned = floorVals.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = floorVals[i];
  });

  const fractions = ids
    .map((id, i) => ({ id, frac: raw[i] - floorVals[i] }))
    .sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (assigned < total && fractions.length > 0) {
    const id = fractions[idx % fractions.length].id;
    out[id] = (out[id] ?? 0) + 1;
    assigned++;
    idx++;
  }

  return out;
}

export interface AutoPerSessionEstimate {
  perSession: Record<string, number>;
  detection: FeatureDetectionResult;
}

/**
 * Builds per-feature auto estimates from detected configuration signals.
 * `conversationalUnits` is the total answer turns to allocate per session.
 */
export function estimateAutoPerSession(
  agent: Pick<CopilotAgent, 'runtimeprovider' | 'configuration'> | null,
  agentTypeId: string = 'standard',
  conversationalUnits: number = 2,
  rates: CreditRates = creditRates,
): AutoPerSessionEstimate {
  const base = buildDefaultInput(agent, agentTypeId, rates).perSession;
  const perSession = { ...base };
  const detection = detectAgentFeatures(agent, agentTypeId, rates);

  if (agentTypeId === 'standard') {
    const conversationalIds = [
      'classicAnswer',
      'generativeAnswer',
      'generativeAnswerEnterprise',
      'tenantGraphGrounding',
    ].filter((id) => id in perSession);

    for (const id of conversationalIds) perSession[id] = 0;

    const detectedConversationalIds = conversationalIds.filter(
      (id) => (detection.byFeature[id] ?? 0) > 0,
    );
    const totalUnits = Math.max(0, Math.round(conversationalUnits));

    if (detectedConversationalIds.length > 0) {
      const weighted = distributeByScore(totalUnits, detectedConversationalIds, detection.byFeature);
      for (const id of detectedConversationalIds) {
        perSession[id] = weighted[id] ?? 0;
      }
    } else if (agent?.runtimeprovider === 0) {
      perSession.classicAnswer = totalUnits;
      if ('generativeAnswer' in perSession) perSession.generativeAnswer = 0;
    } else {
      if ('classicAnswer' in perSession) perSession.classicAnswer = 0;
      perSession.generativeAnswer = totalUnits;
    }

    if ('action' in perSession) perSession.action = detection.byFeature.action > 0 ? 1 : 0;
    if ('aiBuilderPrompt' in perSession) {
      perSession.aiBuilderPrompt = detection.byFeature.aiBuilderPrompt > 0 ? 1 : 0;
    }
  } else if (agentTypeId === 'autonomous') {
    if ('autonomousTask' in perSession) perSession.autonomousTask = 1;
    if ('autonomousAction' in perSession) {
      perSession.autonomousAction = detection.byFeature.autonomousAction > 0 ? 1 : 0;
    }
  }

  return { perSession, detection };
}

/**
 * Pure summarization of transcripts to feed the estimator with realistic numbers.
 * No React, no I/O — both apps share this.
 */
export function summarizeTranscripts(transcripts: TranscriptLike[]): TranscriptSampleStats {
  if (!transcripts.length) {
    return {
      sessionsLast30Days: 0,
      totalSessions: 0,
      daysObserved: 0,
      avgBotRepliesPerSession: 0,
      avgMessagesPerSession: 0,
    };
  }
  const now = Date.now();
  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  let sessionsLast30Days = 0;
  let totalMessages = 0;
  let totalBotReplies = 0;
  let oldest = now;
  for (const t of transcripts) {
    const ts = Date.parse(t.createdon);
    if (Number.isFinite(ts)) {
      if (now - ts <= MS_30D) sessionsLast30Days++;
      if (ts < oldest) oldest = ts;
    }
    const s = countSessionStats(t);
    totalMessages += s.messages;
    totalBotReplies += s.botReplies;
  }
  const daysObserved = Math.max(1, Math.round((now - oldest) / (24 * 60 * 60 * 1000)));
  return {
    sessionsLast30Days,
    totalSessions: transcripts.length,
    daysObserved,
    avgBotRepliesPerSession: transcripts.length ? totalBotReplies / transcripts.length : 0,
    avgMessagesPerSession: transcripts.length ? totalMessages / transcripts.length : 0,
  };
}

export interface InferredBaseline {
  input: EstimatorInput;
  stats: TranscriptSampleStats;
  /** True when transcripts produced a non-default baseline. */
  hasSignal: boolean;
  /** True when sessionsPerMonth was extrapolated (sample < 30 days). */
  extrapolated: boolean;
  detection: FeatureDetectionResult;
}

/**
 * Produces an estimator baseline grounded in real transcript activity.
 * Falls back to `buildDefaultInput` when there's no usable signal.
 */
export function inferFromTranscripts(
  transcripts: TranscriptLike[],
  agent: Pick<CopilotAgent, 'runtimeprovider' | 'configuration'> | null,
  agentTypeId: string = 'standard',
  rates: CreditRates = creditRates,
): InferredBaseline {
  const stats = summarizeTranscripts(transcripts);
  const base = buildDefaultInput(agent, agentTypeId, rates);
  const fallbackAuto = estimateAutoPerSession(agent, agentTypeId, 2, rates);

  if (stats.totalSessions === 0) {
    return {
      input: base,
      stats,
      hasSignal: false,
      extrapolated: false,
      detection: fallbackAuto.detection,
    };
  }

  let sessionsPerMonth = stats.sessionsLast30Days;
  let extrapolated = false;
  if (sessionsPerMonth === 0 && stats.daysObserved > 0) {
    sessionsPerMonth = Math.round((stats.totalSessions * 30) / stats.daysObserved);
    extrapolated = true;
  }
  if (sessionsPerMonth === 0) sessionsPerMonth = stats.totalSessions;

  const answers = Math.max(1, Math.round(stats.avgBotRepliesPerSession));
  const auto = estimateAutoPerSession(agent, agentTypeId, answers, rates);

  return {
    input: { agentTypeId, sessionsPerMonth, perSession: auto.perSession },
    stats,
    hasSignal: true,
    extrapolated,
    detection: auto.detection,
  };
}
