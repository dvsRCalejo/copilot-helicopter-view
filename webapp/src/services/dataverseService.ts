import { AccountInfo, IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { dataverseScopesFor } from '@/auth/msalConfig';
import type { CopilotAgent, ConversationTranscript, PowerPlatformEnvironment, WhoAmIResponse } from '@/types';

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
  scopes: string[]
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
  instanceUrl: string,
  path: string,
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<T> {
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/data/v9.2`;
  const token = await acquireToken(msalInstance, account, dataverseScopesFor(instanceUrl));
  const response = await fetch(`${apiBase}/${path}`, {
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
  instanceUrl: string,
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<WhoAmIResponse> {
  return dataverseFetch<WhoAmIResponse>(instanceUrl, 'WhoAmI()', msalInstance, account);
}

export async function getTranscripts(
  botId: string,
  instanceUrl: string,
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
    instanceUrl,
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
  const scopes = dataverseScopesFor(env.instanceUrl);
  const token = await acquireToken(msalInstance, account, scopes);

  // Use only universally-available Dataverse fields to avoid 400 errors across different tenants
  const select = [
    'botid', 'name', 'statecode', 'statuscode', 'createdon', 'modifiedon', '_owninguser_value',
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

  const raw = (await response.json()) as { value: Array<Partial<CopilotAgent>> };
  return (raw.value || []).map((a) => ({
    botid: a.botid ?? '',
    name: a.name ?? 'Unnamed agent',
    iconbase64: null,
    statecode: a.statecode ?? 0,
    statuscode: a.statuscode ?? 1,
    publishedon: null,
    createdon: a.createdon ?? '',
    modifiedon: a.modifiedon ?? '',
    _owninguser_value: a._owninguser_value ?? null,
    _ownerid_value: a._ownerid_value ?? null,
    description: null,
    language: 0,
    runtimeprovider: null,
    schemaname: null,
    configuration: null,
    environmentId: env.environmentId,
    environmentDisplayName: env.displayName,
    instanceUrl: env.instanceUrl,
  }));
}
