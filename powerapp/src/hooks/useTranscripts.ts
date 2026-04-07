// Identical logic to webapp/src/hooks/useTranscripts.ts
// Difference: uses Code Apps dataverseService (no MSAL params needed).
import { useQuery } from '@tanstack/react-query';
import { getTranscripts } from '@/services/dataverseService';

export function useTranscripts(botId: string | undefined) {
  return useQuery({
    queryKey: ['transcripts', botId],
    queryFn: async () => {
      // DEV-ONLY: return mock transcripts for the dummy agent
      if (import.meta.env.DEV) {
        const { MOCK_AGENT, MOCK_TRANSCRIPTS } = await import('@/dev/mockData');
        if (botId === MOCK_AGENT.botid) return MOCK_TRANSCRIPTS;
      }
      return getTranscripts(botId!);
    },
    enabled: !!botId,
    staleTime: 5 * 60 * 1000,
  });
}
