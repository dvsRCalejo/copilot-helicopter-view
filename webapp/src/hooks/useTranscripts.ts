import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getTranscripts } from '@/services/dataverseService';

export function useTranscripts(botId: string | undefined) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  return useQuery({
    queryKey: ['transcripts', botId],
    queryFn: async () => {
      // DEV-ONLY: return mock transcripts for the dummy agent
      if (import.meta.env.DEV) {
        const { MOCK_AGENT, MOCK_TRANSCRIPTS } = await import('@/dev/mockData');
        if (botId === MOCK_AGENT.botid) return MOCK_TRANSCRIPTS;
      }
      return getTranscripts(botId!, instance, account);
    },
    enabled: !!account && !!botId,
    staleTime: 5 * 60 * 1000,
  });
}
