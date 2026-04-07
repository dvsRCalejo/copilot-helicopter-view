import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { whoAmI } from '@/services/dataverseService';

export function useCurrentUser() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => whoAmI(instance, account),
    enabled: !!account,
    staleTime: Infinity, // User ID never changes mid-session
  });
}
