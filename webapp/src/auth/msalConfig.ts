import { Configuration, PopupRequest } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_CLIENT_ID as string;
const tenantId = import.meta.env.VITE_TENANT_ID as string;
const dataverseUrl = import.meta.env.VITE_DATAVERSE_URL as string;

const missingConfig: string[] = [];
if (!clientId) missingConfig.push('VITE_CLIENT_ID');
if (!tenantId) missingConfig.push('VITE_TENANT_ID');
if (!dataverseUrl) missingConfig.push('VITE_DATAVERSE_URL');

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

/** Scopes required to call the Dataverse Web API as the signed-in user */
export const dataverseScopes: string[] = [`${dataverseUrl}/.default`];

export const loginRequest: PopupRequest = {
  scopes: dataverseScopes,
};
