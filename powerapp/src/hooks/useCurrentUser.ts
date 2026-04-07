// Mirrors webapp/src/hooks/useCurrentUser.ts.
// Difference: the Power App resolves the current Dataverse systemuserid via
// systemusers lookup, instead of using the webapp's MSAL-based WhoAmI() call.
import { useQuery } from '@tanstack/react-query';
import { whoAmI } from '@/services/dataverseService';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: whoAmI,
    staleTime: Infinity, // User ID never changes mid-session
  });
}
