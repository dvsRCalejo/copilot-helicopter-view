import { Configuration, PopupRequest } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_CLIENT_ID as string;
const tenantId = import.meta.env.VITE_TENANT_ID as string;

const missingConfig: string[] = [];
if (!clientId) missingConfig.push('VITE_CLIENT_ID');
if (!tenantId) missingConfig.push('VITE_TENANT_ID');

export const isAuthConfigured = missingConfig.length === 0;
export const missingAuthConfig = missingConfig;

if (!isAuthConfigured) {
  console.error(
    `[msalConfig] Missing environment variables: ${missingConfig.join(', ')}. Copy .env.example -> .env and fill in the values.`
  );
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/** Returns the Dataverse OAuth scope for a given environment instance URL. */
export function dataverseScopesFor(instanceUrl: string): string[] {
  return [`${instanceUrl.replace(/\/$/, '')}/user_impersonation`];
}

/** Initial login: minimal scope only. Resource-specific scopes added via incremental consent. */
export const loginRequest: PopupRequest = {
  scopes: ['User.Read'],
};
