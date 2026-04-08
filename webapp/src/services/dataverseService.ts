import { AccountInfo, IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { dataverseScopes } from '@/auth/msalConfig';
import type { CopilotAgent, ConversationTranscript, PowerPlatformEnvironment, WhoAmIResponse } from '@/types';

const DATAVERSE_URL = import.meta.env.VITE_DATAVERSE_URL as string;
const API_BASE = `${DATAVERSE_URL}/api/data/v9.2`;

/** Power Platform API token scope */
const POWER_PLATFORM_SCOPE = 'https://service.powerapps.com/.default';

const DEFAULT_HEADERS = {
  'OData-MaxVersion': '4.0',
  'OData-Version': '4.0',
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
};

async function acquireToken(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  scopes: string[] = dataverseScopes
): Promise<string> {
  try {
    const result = await msalInstance.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await msalInstance.acquireTokenPopup({ account, scopes });
      return result.accessToken;
    }
    throw err;
  }
}

async function dataverseFetch<T>(
  path: string,
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<T> {
  const token = await acquireToken(msalInstance, account);
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Dataverse ${response.status}: ${response.statusText} — ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function whoAmI(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<WhoAmIResponse> {
  return dataverseFetch<WhoAmIResponse>('WhoAmI()', msalInstance, account);
}

export async function getAgents(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<CopilotAgent[]> {
  // Dataverse implicit row-level security returns only records the signed-in
  // user can read (owned + shared). No client-side security filter needed.
  const select = [
    'botid',
    'name',
    'iconbase64',
    'statecode',
    'statuscode',
    'publishedon',
    'createdon',
    'modifiedon',
    '_owninguser_value',
    '_ownerid_value',
    'description',
    'language',
    'runtimeprovider',
    'schemaname',
    'configuration',
  ].join(',');

  const result = await dataverseFetch<{ value: CopilotAgent[] }>(
    `bots?$select=${select}&$orderby=modifiedon%20desc`,
    msalInstance,
    account
  );
  return result.value.map((a) => ({ ...a, environmentId: null, environmentDisplayName: null }));
}

export async function getTranscripts(
  botId: string,
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<ConversationTranscript[]> {
  const select = [
    'conversationtranscriptid',
    'name',
    'createdon',
    'modifiedon',
    'content',
    'schematype',
    'conversationstarttime',
    '_bot_conversationtranscriptid_value',
  ].join(',');

  // Encode the bot GUID for safe URL embedding
  const filter = `_bot_conversationtranscriptid_value%20eq%20${encodeURIComponent(botId)}`;
  const result = await dataverseFetch<{ value: ConversationTranscript[] }>(
    `conversationtranscripts?$select=${select}&$filter=${filter}&$orderby=createdon%20desc&$top=200`,
    msalInstance,
    account
  );
  return result.value;
}

// ── Multi-environment support ─────────────────────────────────────────────────

interface BapEnvironmentResponse {
  value: Array<{
    name: string; // environment GUID
    properties: {
      displayName: string;
      linkedEnvironmentMetadata?: {
        instanceUrl: string;
      };
    };
  }>;
}

/**
 * Lists all Power Platform environments accessible to the signed-in user.
 * Uses the Business Application Platform (BAP) API.
 */
export async function getEnvironments(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<PowerPlatformEnvironment[]> {
  const token = await acquireToken(msalInstance, account, [POWER_PLATFORM_SCOPE]);
  const response = await fetch(
    'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/environments?api-version=2016-11-01',
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`BAP environments ${response.status}: ${response.statusText} — ${text.slice(0, 200)}`);
  }
  const data = (await response.json()) as BapEnvironmentResponse;
  return data.value
    .filter((e) => !!e.properties.linkedEnvironmentMetadata?.instanceUrl)
    .map((e) => ({
      environmentId: e.name,
      displayName: e.properties.displayName,
      instanceUrl: e.properties.linkedEnvironmentMetadata!.instanceUrl.replace(/\/$/, ''),
    }));
}

/**
 * Fetches bots from a specific environment's Dataverse endpoint.
 * Used for cross-environment fan-out. Tags each agent with environment metadata.
 */
export async function getAgentsForEnvironment(
  env: PowerPlatformEnvironment,
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<CopilotAgent[]> {
  const envApiBase = `${env.instanceUrl}/api/data/v9.2`;
  const scope = `${env.instanceUrl}/.default`;
  const token = await acquireToken(msalInstance, account, [scope]);

  const select = [
    'botid', 'name', 'iconbase64', 'statecode', 'statuscode', 'publishedon',
    'createdon', 'modifiedon', '_owninguser_value', '_ownerid_value',
    'description', 'language', 'runtimeprovider', 'schemaname',
  ].join(',');

  const response = await fetch(
    `${envApiBase}/bots?$select=${select}&$orderby=modifiedon%20desc`,
    {
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Dataverse [${env.displayName}] ${response.status}: ${response.statusText} — ${text.slice(0, 200)}`);
  }
  const data = (await response.json()) as { value: CopilotAgent[] };
  return data.value.map((a) => ({
    ...a,
    environmentId: env.environmentId,
    environmentDisplayName: env.displayName,
  }));
}
