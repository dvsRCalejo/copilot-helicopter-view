import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { whoAmI } from '@/services/dataverseService';
import { useEnvironments } from './useEnvironments';

export function useCurrentUser() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const { data: envs } = useEnvironments();

  // Use the first available environment's URL — WhoAmI returns the same user across all envs.
  const firstEnvUrl = envs?.[0]?.instanceUrl ?? null;

  return useQuery({
    queryKey: ['currentUser', firstEnvUrl],
    queryFn: () => whoAmI(firstEnvUrl!, instance, account),
    enabled: !!account && !!firstEnvUrl,
    staleTime: Infinity, // User ID never changes mid-session
  });
}
