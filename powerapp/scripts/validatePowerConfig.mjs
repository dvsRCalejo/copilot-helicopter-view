import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const configPath = path.resolve(process.cwd(), 'power.config.json');

const requiredDataSources = {
  agents: { entitySetName: 'bots', logicalName: 'bot' },
  conversationtranscripts: {
    entitySetName: 'conversationtranscripts',
    logicalName: 'conversationtranscript',
  },
  users: { entitySetName: 'systemusers', logicalName: 'systemuser' },
  organizations: { entitySetName: 'organizations', logicalName: 'organization' },
};

function fail(message) {
  console.error(`\n[validate:power-config] ${message}\n`);
  process.exit(1);
}

if (!existsSync(configPath)) {
  fail(
    'Missing power.config.json. Copy power.config.example.json to power.config.json and set your local environment values before pushing.',
  );
}

let config;

try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  fail(`power.config.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

if (!config.environmentId || config.environmentId === '00000000-0000-0000-0000-000000000000') {
  fail('power.config.json must contain a real environmentId.');
}

const dataSources = config.databaseReferences?.['default.cds']?.dataSources;

if (!dataSources || typeof dataSources !== 'object') {
  fail('power.config.json is missing databaseReferences.default.cds.dataSources.');
}

for (const [key, expected] of Object.entries(requiredDataSources)) {
  const actual = dataSources[key];

  if (!actual) {
    fail(`Missing required Dataverse data source '${key}'.`);
  }

  if (actual.entitySetName !== expected.entitySetName || actual.logicalName !== expected.logicalName) {
    fail(
      `Data source '${key}' must be entitySetName='${expected.entitySetName}' and logicalName='${expected.logicalName}'.`,
    );
  }
}

console.log('[validate:power-config] power.config.json looks valid.');