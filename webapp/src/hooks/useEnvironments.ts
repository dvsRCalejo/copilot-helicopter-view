import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getEnvironments } from '@/services/dataverseService';
import type { PowerPlatformEnvironment } from '@/types';

export function useEnvironments() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  return useQuery<PowerPlatformEnvironment[], Error>({
    queryKey: ['environments'],
    queryFn: () => getEnvironments(instance, account),
    enabled: !!account,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}
