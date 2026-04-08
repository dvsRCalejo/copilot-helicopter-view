import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getTranscripts } from '@/services/dataverseService';
import { extractConfiguredChannels, getChannelInfo } from '@/types';
import type { ConversationTranscript, CopilotAgent } from '@/types';

/**
 * Batch-fetches transcripts for a list of agents and extracts de-duplicated
 * channel info per bot from agent publish/config metadata.
 * Shares the same TanStack cache as useTranscripts.
 * Also returns all transcripts flattened (for dashboard activity metrics).
 */
export function useAgentChannelsMap(agents: CopilotAgent[]) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const botIds = useMemo(() => agents.map((a) => a.botid), [agents]);

  const results = useQueries({
    queries: botIds.map((botId) => ({
      queryKey: ['transcripts', botId],
      queryFn: async () => {
        if (import.meta.env.DEV) {
          const { MOCK_AGENT, MOCK_TRANSCRIPTS } = await import('@/dev/mockData');
          if (botId === MOCK_AGENT.botid) return MOCK_TRANSCRIPTS;
        }
        const agent = agents.find((a) => a.botid === botId);
        if (!agent?.instanceUrl) return [];
        return getTranscripts(botId, agent.instanceUrl, instance, account);
      },
      enabled: !!account,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const channelsMap = useMemo(() => {
    const map = new Map<string, { label: string; icon: string }[]>();
    agents.forEach((agent) => {
      const labelMap = new Map<string, { label: string; icon: string }>();
      const configuredChannels = extractConfiguredChannels(agent.configuration);
      for (const channelId of configuredChannels) {
        const info = getChannelInfo(channelId);
        if (!labelMap.has(info.label)) labelMap.set(info.label, info);
      }
      if (labelMap.size > 0) {
        map.set(agent.botid, Array.from(labelMap.values()));
      }
    });
    return map;
  }, [agents]);

  const allTranscripts = useMemo(() => {
    const all: ConversationTranscript[] = [];
    for (const r of results) {
      if (r.data) all.push(...r.data);
    }
    return all;
  }, [results]);

  return { channelsMap, allTranscripts };
}
