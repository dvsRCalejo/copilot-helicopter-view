import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getAgentsForEnvironment } from '@/services/dataverseService';
import { useCurrentUser } from './useCurrentUser';
import { useEnvironments } from './useEnvironments';
import type { CopilotAgent, FilterMode } from '@/types';
import { filterAgents } from '@/utils/agentList';

// DEV-ONLY: static import — tree-shaken in production builds
let MOCK_AGENT: CopilotAgent | undefined;
if (import.meta.env.DEV) {
  import('@/dev/mockData').then((m) => { MOCK_AGENT = m.MOCK_AGENT; });
}

function normalizeGuid(value: string | null | undefined): string {
  return (value ?? '').replace(/[{}]/g, '').toLowerCase();
}

function isOwnedByCurrentUser(agent: CopilotAgent, userId: string | null | undefined): boolean {
  const normalizedUserId = normalizeGuid(userId);
  if (!normalizedUserId) return false;

  return [agent._owninguser_value, agent._ownerid_value]
    .map((value) => normalizeGuid(value))
    .some((value) => value === normalizedUserId);
}

/**
 * @param filter     - Active filter mode
 * @param environmentId - null = aggregate all environments, string = single environment
 */
export function useAgents(filter: FilterMode = 'all', environmentId: string | null = null) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const { data: currentUser } = useCurrentUser();
  const { data: allEnvs = [] } = useEnvironments();

  const query = useQuery({
    queryKey: ['agents', environmentId, allEnvs.map((e) => e.environmentId).join(',')],
    queryFn: async () => {
      const envs = environmentId !== null
        ? allEnvs.filter((e) => e.environmentId === environmentId)
        : allEnvs;
      if (envs.length === 0) return [];
      const results = await Promise.allSettled(
        envs.map((env) => getAgentsForEnvironment(env, instance, account))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<CopilotAgent[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);
    },
    enabled: !!account && allEnvs.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const agents: CopilotAgent[] = (query.data ?? []).map((a) => ({
    ...a,
    isOwner: isOwnedByCurrentUser(a, currentUser?.UserId),
  }));

  // DEV-ONLY: inject a dummy agent for local testing
  if (import.meta.env.DEV && MOCK_AGENT && !agents.some((a) => a.botid === MOCK_AGENT!.botid)) {
    agents.unshift({ ...MOCK_AGENT, isOwner: true });
  }

  const filtered = filterAgents(agents, filter);

  return { ...query, data: filtered, all: agents };
}
