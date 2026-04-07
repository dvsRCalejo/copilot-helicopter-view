// Identical logic to webapp/src/utils/agentList.ts — keep in sync.
import type { CopilotAgent, FilterMode } from '@/types';

export function filterAgents(agents: CopilotAgent[], filter: FilterMode): CopilotAgent[] {
  return agents.filter((agent) => {
    switch (filter) {
      case 'owned':
        return agent.isOwner === true;
      case 'shared':
        return agent.isOwner === false;
      case 'active':
        return agent.statecode === 0;
      default:
        return true;
    }
  });
}

export function searchAndSortAgents(
  agents: CopilotAgent[],
  search: string
): CopilotAgent[] {
  const term = search.trim().toLowerCase();

  const searched = term
    ? agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(term) ||
          (agent.description ?? '').toLowerCase().includes(term)
      )
    : agents;

  return [...searched].sort((a, b) => {
    const aTime = new Date(a.modifiedon).getTime();
    const bTime = new Date(b.modifiedon).getTime();
    return bTime - aTime;
  });
}
