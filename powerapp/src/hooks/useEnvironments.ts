// Identical logic to webapp/src/hooks/useEnvironments.ts
// Difference: uses Code Apps dataverseService (no MSAL params needed).
import { useQuery } from '@tanstack/react-query';
import { getEnvironments } from '@/services/dataverseService';
import type { PowerPlatformEnvironment } from '@/types';

export function useEnvironments() {
  return useQuery<PowerPlatformEnvironment[], Error>({
    queryKey: ['environments'],
    queryFn: getEnvironments,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}
