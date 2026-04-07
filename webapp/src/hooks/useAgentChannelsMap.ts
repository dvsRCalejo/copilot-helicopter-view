import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getTranscripts } from '@/services/dataverseService';
import { extractChannel, getChannelInfo } from '@/types';

/**
 * Batch-fetches transcripts for a list of agents and extracts de-duplicated
 * channel info per bot.  Shares the same TanStack cache as useTranscripts.
 */
export function useAgentChannelsMap(botIds: string[]) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const results = useQueries({
    queries: botIds.map((botId) => ({
      queryKey: ['transcripts', botId],
      queryFn: async () => {
        if (import.meta.env.DEV) {
          const { MOCK_AGENT, MOCK_TRANSCRIPTS } = await import('@/dev/mockData');
          if (botId === MOCK_AGENT.botid) return MOCK_TRANSCRIPTS;
        }
        return getTranscripts(botId, instance, account);
      },
      enabled: !!account,
      staleTime: 5 * 60 * 1000,
    })),
  });

  return useMemo(() => {
    const map = new Map<string, { label: string; icon: string }[]>();
    results.forEach((result, i) => {
      if (!result.data) return;
      const labelMap = new Map<string, { label: string; icon: string }>();
      for (const t of result.data) {
        const ch = extractChannel(t.content);
        if (ch) {
          const info = getChannelInfo(ch);
          if (!labelMap.has(info.label)) labelMap.set(info.label, info);
        }
      }
      if (labelMap.size > 0) {
        map.set(botIds[i], Array.from(labelMap.values()));
      }
    });
    return map;
  }, [results, botIds]);
}
