import { describe, expect, it } from 'vitest';
import {
  buildDefaultInput,
  creditRates,
  estimateAutoPerSession,
  estimateMonthlyCost,
  type EstimatorInput,
} from './costEstimator';
import type { CopilotAgent } from '@/types';

const makeAgent = (runtime: number | null): CopilotAgent => ({
  botid: 'x',
  name: 'x',
  iconbase64: null,
  statecode: 0,
  statuscode: 1,
  publishedon: null,
  createdon: '2026-01-01',
  modifiedon: '2026-01-01',
  _owninguser_value: null,
  _ownerid_value: null,
  description: null,
  language: 1033,
  runtimeprovider: runtime,
  configuration: null,
  schemaname: null,
  environmentId: null,
  environmentDisplayName: null,
  instanceUrl: null,
});

describe('estimateMonthlyCost', () => {
  it('returns zero for zero sessions', () => {
    const input: EstimatorInput = {
      agentTypeId: 'standard',
      sessionsPerMonth: 0,
      perSession: { classicAnswer: 5, generativeAnswer: 5 },
    };
    const result = estimateMonthlyCost(input);
    expect(result.totalCredits).toBe(0);
    expect(result.totalUsd).toBe(0);
    expect(result.perSessionCredits).toBe(1 * 5 + 2 * 5);
  });

  it('multiplies per-session credits by sessions/month for a standard agent', () => {
    const input: EstimatorInput = {
      agentTypeId: 'standard',
      sessionsPerMonth: 1000,
      perSession: { classicAnswer: 2, generativeAnswer: 1 },
    };
    const result = estimateMonthlyCost(input);
    // (2*1 + 1*2) * 1000 = 4000 credits => $40
    expect(result.totalCredits).toBe(4000);
    expect(result.totalUsd).toBeCloseTo(40);
  });

  it('only includes features applicable to the chosen agent type', () => {
    const input: EstimatorInput = {
      agentTypeId: 'autonomous',
      sessionsPerMonth: 100,
      // classicAnswer is not applicable to autonomous and must be ignored
      perSession: { classicAnswer: 50, autonomousTask: 1 },
    };
    const result = estimateMonthlyCost(input);
    // Only autonomousTask counts: 1 * 25 * 100 = 2500 credits
    expect(result.totalCredits).toBe(2500);
    expect(result.breakdown.find((b) => b.featureId === 'classicAnswer')).toBeUndefined();
  });

  it('treats negative or NaN values as zero', () => {
    const input: EstimatorInput = {
      agentTypeId: 'standard',
      sessionsPerMonth: Number.NaN,
      perSession: { classicAnswer: -5 },
    };
    const result = estimateMonthlyCost(input);
    expect(result.totalCredits).toBe(0);
  });
});

describe('buildDefaultInput', () => {
  it('biases generative agents towards generative answers', () => {
    const input = buildDefaultInput(makeAgent(1), 'standard');
    expect(input.perSession.generativeAnswer).toBeGreaterThan(0);
  });

  it('biases classic agents towards scripted answers', () => {
    const input = buildDefaultInput(makeAgent(0), 'standard');
    expect(input.perSession.classicAnswer).toBeGreaterThan(0);
    expect(input.perSession.generativeAnswer ?? 0).toBe(0);
  });

  it('returns defaults applicable to the chosen agent type only', () => {
    const input = buildDefaultInput(null, 'autonomous');
    const featureIds = Object.keys(input.perSession);
    for (const id of featureIds) {
      const def = creditRates.features.find((f) => f.id === id);
      expect(def?.appliesTo).toContain('autonomous');
    }
  });
});

describe('estimateAutoPerSession', () => {
  it('distributes conversational units weighted by detected scores', () => {
    const r = estimateAutoPerSession(
      {
        runtimeprovider: 1,
        configuration: '{"generative":true,"dataverse":true,"sharepoint":true,"graph":true,"graph2":true}',
      },
      'standard',
      4,
    );

    // Detection should include at least these conversational features.
    expect(r.detection.byFeature.generativeAnswer).toBeGreaterThan(0);
    expect(r.detection.byFeature.generativeAnswerEnterprise).toBeGreaterThan(0);
    expect(r.detection.byFeature.tenantGraphGrounding).toBeGreaterThan(0);

    const allocated =
      (r.perSession.generativeAnswer ?? 0) +
      (r.perSession.generativeAnswerEnterprise ?? 0) +
      (r.perSession.tenantGraphGrounding ?? 0) +
      (r.perSession.classicAnswer ?? 0);
    expect(allocated).toBe(4);
  });

  it('sets action prompt toggles to 1 when detected', () => {
    const r = estimateAutoPerSession(
      {
        runtimeprovider: 1,
        configuration: '{"action":"flow","prompt":"ai builder"}',
      },
      'standard',
      2,
    );

    expect(r.perSession.action).toBe(1);
    expect(r.perSession.aiBuilderPrompt).toBe(1);
  });
});

describe('summarizeTranscripts + inferFromTranscripts', () => {
  const mkContent = (msgs: Array<{ role: 'user' | 'bot'; text: string }>) =>
    JSON.stringify(msgs.map((m) => ({ type: 'message', text: m.text, from: { role: m.role === 'user' ? 'user' : 'bot' } })));

  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const older = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

  it('counts last-30-day sessions and avg replies', async () => {
    const { summarizeTranscripts } = await import('./costEstimator');
    const stats = summarizeTranscripts([
      { createdon: recent, content: mkContent([{ role: 'user', text: 'hi' }, { role: 'bot', text: 'hello' }, { role: 'bot', text: 'how can i help?' }]) },
      { createdon: recent, content: mkContent([{ role: 'user', text: 'q' }, { role: 'bot', text: 'a' }]) },
    ]);
    expect(stats.sessionsLast30Days).toBe(2);
    expect(stats.totalSessions).toBe(2);
    expect(stats.avgBotRepliesPerSession).toBeCloseTo(1.5);
  });

  it('extrapolates when sample older than 30 days', async () => {
    const { inferFromTranscripts } = await import('./costEstimator');
    const result = inferFromTranscripts(
      [{ createdon: older, content: mkContent([{ role: 'user', text: 'q' }, { role: 'bot', text: 'a' }]) }],
      { runtimeprovider: 1, configuration: null },
    );
    expect(result.hasSignal).toBe(true);
    expect(result.extrapolated).toBe(true);
  });

  it('falls back to default input when no transcripts', async () => {
    const { inferFromTranscripts } = await import('./costEstimator');
    const r = inferFromTranscripts([], { runtimeprovider: 1, configuration: null });
    expect(r.hasSignal).toBe(false);
    expect(r.input.sessionsPerMonth).toBe(1000);
  });

  it('routes inferred answers to generativeAnswer for runtimeprovider 1', async () => {
    const { inferFromTranscripts } = await import('./costEstimator');
    const r = inferFromTranscripts(
      Array.from({ length: 3 }, () => ({
        createdon: recent,
        content: mkContent([
          { role: 'user', text: 'q' },
          { role: 'bot', text: 'a' },
          { role: 'bot', text: 'b' },
        ]),
      })),
      { runtimeprovider: 1, configuration: null },
    );
    expect(r.input.perSession.generativeAnswer).toBe(2);
    expect(r.input.perSession.classicAnswer).toBe(0);
    expect(r.input.sessionsPerMonth).toBe(3);
  });

  it('routes inferred answers to classicAnswer for runtimeprovider 0', async () => {
    const { inferFromTranscripts } = await import('./costEstimator');
    const r = inferFromTranscripts(
      [{ createdon: recent, content: mkContent([{ role: 'user', text: 'q' }, { role: 'bot', text: 'a' }]) }],
      { runtimeprovider: 0, configuration: null },
    );
    expect(r.input.perSession.classicAnswer).toBe(1);
    expect(r.input.perSession.generativeAnswer).toBe(0);
  });

  it('detects multiple conversational features and splits answers evenly', async () => {
    const { inferFromTranscripts } = await import('./costEstimator');
    const r = inferFromTranscripts(
      [
        {
          createdon: recent,
          content: mkContent([
            { role: 'user', text: 'q1' },
            { role: 'bot', text: 'a1' },
            { role: 'bot', text: 'a2' },
            { role: 'bot', text: 'a3' },
          ]),
        },
      ],
      {
        runtimeprovider: 1,
        configuration:
          '{"generative":true,"knowledgeSources":["dataverse","sharepoint"],"grounding":"microsoft graph"}',
      },
    );

    expect(r.detection.byFeature.generativeAnswer).toBeGreaterThan(0);
    expect(r.detection.byFeature.generativeAnswerEnterprise).toBeGreaterThan(0);
    expect(r.detection.byFeature.tenantGraphGrounding).toBeGreaterThan(0);
    expect(r.input.perSession.generativeAnswer).toBe(1);
    expect(r.input.perSession.generativeAnswerEnterprise).toBe(1);
    expect(r.input.perSession.tenantGraphGrounding).toBe(1);
  });
});
