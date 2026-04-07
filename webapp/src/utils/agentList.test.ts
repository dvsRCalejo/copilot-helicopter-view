import { describe, expect, it } from 'vitest';
import { filterAgents, searchAndSortAgents } from './agentList';
import type { CopilotAgent } from '@/types';

const baseAgents: CopilotAgent[] = [
  {
    botid: '1',
    name: 'Sales Copilot',
    iconbase64: null,
    statecode: 0,
    statuscode: 1,
    publishedon: null,
    createdon: '2026-01-01T00:00:00Z',
    modifiedon: '2026-04-02T00:00:00Z',
    _owninguser_value: null,
    _ownerid_value: null,
    description: 'Pipeline helper',
    language: 1033,
    runtimeprovider: 1,
    schemaname: 'sales',
    isOwner: true,
    environmentId: null,
    environmentDisplayName: null,
  },
  {
    botid: '2',
    name: 'HR Assistant',
    iconbase64: null,
    statecode: 1,
    statuscode: 2,
    publishedon: null,
    createdon: '2026-01-02T00:00:00Z',
    modifiedon: '2026-03-01T00:00:00Z',
    _owninguser_value: null,
    _ownerid_value: null,
    description: 'Benefits and policy bot',
    language: 1033,
    runtimeprovider: 0,
    schemaname: 'hr',
    isOwner: false,
    environmentId: null,
    environmentDisplayName: null,
  },
  {
    botid: '3',
    name: 'Support Agent',
    iconbase64: null,
    statecode: 0,
    statuscode: 1,
    publishedon: null,
    createdon: '2026-01-03T00:00:00Z',
    modifiedon: '2026-02-15T00:00:00Z',
    _owninguser_value: null,
    _ownerid_value: null,
    description: 'Customer issue triage',
    language: 1033,
    runtimeprovider: 1,
    schemaname: 'support',
    isOwner: false,
    environmentId: null,
    environmentDisplayName: null,
  },
];

describe('filterAgents', () => {
  it('returns only owned agents for owned filter', () => {
    const result = filterAgents(baseAgents, 'owned');
    expect(result.map((a) => a.botid)).toEqual(['1']);
  });

  it('returns only shared agents for shared filter', () => {
    const result = filterAgents(baseAgents, 'shared');
    expect(result.map((a) => a.botid)).toEqual(['2', '3']);
  });

  it('returns only active agents for active filter', () => {
    const result = filterAgents(baseAgents, 'active');
    expect(result.map((a) => a.botid)).toEqual(['1', '3']);
  });
});

describe('searchAndSortAgents', () => {
  it('searches by name and description case-insensitively', () => {
    const byName = searchAndSortAgents(baseAgents, 'support');
    const byDescription = searchAndSortAgents(baseAgents, 'benefits');

    expect(byName.map((a) => a.botid)).toEqual(['3']);
    expect(byDescription.map((a) => a.botid)).toEqual(['2']);
  });

  it('sorts by modified date newest first', () => {
    const result = searchAndSortAgents(baseAgents, '');
    expect(result.map((a) => a.botid)).toEqual(['1', '2', '3']);
  });
});
