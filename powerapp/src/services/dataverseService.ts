// Code Apps data service — same query shape as webapp/src/services/dataverseService.ts
// but uses the Power Apps Code Apps SDK instead of MSAL.
//
// Auth is handled automatically by the Power Apps host.
// User identity starts from getContext(), then maps to the Dataverse
// systemuserid via the systemusers table for owner/co-owner labelling.
//
// NOTE: Generated services are refreshed via add-data-source commands, for example:
//   pac code add-data-source -a dataverse -t bot
//   pac code add-data-source -a dataverse -t conversationtranscript

import { getContext } from '@microsoft/power-apps/app';
import { BotsService } from '@/generated/services/BotsService';
import { ConversationtranscriptsService } from '@/generated/services/ConversationtranscriptsService';
import { OrganizationsService } from '@/generated/services/OrganizationsService';
import { SystemusersService } from '@/generated/services/SystemusersService';
import type { CopilotAgent, ConversationTranscript, PowerPlatformEnvironment, WhoAmIResponse } from '@/types';

const BOT_SELECT = [
  'botid', 'name', 'iconbase64', 'statecode', 'statuscode', 'publishedon',
  'createdon', 'modifiedon', '_owninguser_value',
  'ownerid', 'language', 'runtimeprovider', 'schemaname',
];

const TRANSCRIPT_SELECT = [
  'conversationtranscriptid', 'name', 'createdon', 'modifiedon',
  'content', 'schematype', 'conversationstarttime', '_bot_conversationtranscriptid_value',
];

const SYSTEM_USER_SELECT = [
  'systemuserid', 'azureactivedirectoryobjectid', 'domainname', 'fullname',
];

const ORGANIZATION_SELECT = ['organizationid', 'name'];

/**
 * Resolves the current signed-in user.
 * Uses Power Apps host context to identify the AAD user, then resolves the
 * matching Dataverse systemuserid via the systemusers table.
 */
export async function whoAmI(): Promise<WhoAmIResponse> {
  const ctx = await getContext();

  const objectId = ctx.user.objectId?.trim();
  const userPrincipalName = ctx.user.userPrincipalName?.trim();

  if (objectId) {
    const byAzureObjectId = await SystemusersService.getAll({
      select: SYSTEM_USER_SELECT,
      filter: `azureactivedirectoryobjectid eq '${objectId}'`,
      top: 1,
    });

    const matchedUser = byAzureObjectId.data?.[0];
    if (matchedUser?.systemuserid) {
      return {
        UserId: matchedUser.systemuserid,
        BusinessUnitId: '',
        OrganizationId: '',
      };
    }
  }

  if (userPrincipalName) {
    const byDomainName = await SystemusersService.getAll({
      select: SYSTEM_USER_SELECT,
      filter: `domainname eq '${userPrincipalName.replace(/'/g, "''")}'`,
      top: 1,
    });

    const matchedUser = byDomainName.data?.[0];
    if (matchedUser?.systemuserid) {
      return {
        UserId: matchedUser.systemuserid,
        BusinessUnitId: '',
        OrganizationId: '',
      };
    }
  }

  return {
    UserId: objectId ?? '',
    BusinessUnitId: '',
    OrganizationId: '',
  };
}

/**
 * Returns all Dataverse bots visible to the signed-in user.
 * Dataverse row-level security automatically scopes results to accessible records.
 */
export async function getAgents(): Promise<CopilotAgent[]> {
  const result = await BotsService.getAll({
    select: BOT_SELECT,
    orderBy: ['modifiedon desc'],
  });
  return (result.data ?? []).map((b) => ({
    botid: b.botid,
    name: b.name ?? '(Unnamed agent)',
    iconbase64: b.iconbase64 ?? null,
    statecode: b.statecode,
    statuscode: b.statuscode ?? 1,
    publishedon: b.publishedon ?? null,
    createdon: b.createdon ?? new Date(0).toISOString(),
    modifiedon: b.modifiedon ?? b.createdon ?? new Date(0).toISOString(),
    _owninguser_value: b._owninguser_value ?? null,
    _ownerid_value: b.ownerid ?? null,
    description: null,
    language: b.language ?? 1033,
    runtimeprovider: b.runtimeprovider ?? null,
    schemaname: b.schemaname ?? null,
    environmentId: null,
    environmentDisplayName: null,
  }));
}

/**
 * Returns all transcripts for a given bot, newest first, capped at 200.
 */
export async function getTranscripts(botId: string): Promise<ConversationTranscript[]> {
  const result = await ConversationtranscriptsService.getAll({
    select: TRANSCRIPT_SELECT,
    filter: `_bot_conversationtranscriptid_value eq '${botId}'`,
    orderBy: ['createdon desc'],
    top: 200,
  });
  return (result.data ?? []).map((t) => ({
    conversationtranscriptid: t.conversationtranscriptid,
    name: t.name ?? null,
    createdon: t.createdon ?? t.conversationstarttime,
    modifiedon: t.modifiedon ?? t.createdon ?? t.conversationstarttime,
    content: t.content ?? null,
    schematype: t.schematype ?? null,
    _bot_conversationtranscriptid_value: t._bot_conversationtranscriptid_value ?? null,
  }));
}

// ── Multi-environment support ─────────────────────────────────────────────────
//
// Cross-environment discovery requires acquiring OAuth tokens for arbitrary
// Power Platform resources. The Code Apps SDK (v1) does not expose a public
// token acquisition API for resources outside the deployed environment.
//
// The Code App remains current-environment only. We return the current
// environment as a single-item list so the UI can show its real name, but
// cross-environment discovery is still not supported here.

/**
 * Returns the list of accessible Power Platform environments.
 * In Code Apps, cross-environment discovery is not available. We return the
 * current environment only, using the organization table for its display name.
 */
export async function getEnvironments(): Promise<PowerPlatformEnvironment[]> {
  const ctx = await getContext();
  const organizationResult = await OrganizationsService.getAll({
    select: ORGANIZATION_SELECT,
    top: 1,
  });
  const organization = organizationResult.data?.[0];

  return [{
    environmentId: ctx.app.environmentId,
    displayName: organization?.name ?? 'Current environment',
    instanceUrl: '',
  }];
}

/**
 * Fetches agents for a given environment.
 * In Code Apps, only the current environment is supported via the generated service.
 * The `env` parameter is kept for interface parity with the webapp.
 */
export async function getAgentsForEnvironment(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _env: PowerPlatformEnvironment
): Promise<CopilotAgent[]> {
  // Delegate to the current-environment generated service regardless of env.
  return getAgents();
}
