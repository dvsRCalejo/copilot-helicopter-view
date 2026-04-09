import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const configPath = path.resolve(process.cwd(), 'power.config.json');
const examplePath = path.resolve(process.cwd(), 'power.config.example.json');
const allowedRegions = new Set(['prod', 'preview', 'gccmoderate', 'gcchigh']);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = 'true';
    }
  }

  return args;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeRegion(region) {
  if (!region) {
    return undefined;
  }

  const normalized = region.trim().toLowerCase();
  return allowedRegions.has(normalized) ? normalized : undefined;
}

function isPlaceholderEnvironmentId(value) {
  return !value || value === '00000000-0000-0000-0000-000000000000';
}

const args = parseArgs(process.argv.slice(2));

if (!existsSync(examplePath)) {
  console.error('[code:bootstrap] Missing power.config.example.json.');
  process.exit(1);
}

if (!existsSync(configPath)) {
  copyFileSync(examplePath, configPath);
  console.log('[code:bootstrap] Created power.config.json from power.config.example.json');
}

const config = loadJson(configPath);
const readline = createInterface({ input, output });

try {
  const currentEnvironmentId = isPlaceholderEnvironmentId(config.environmentId) ? '' : config.environmentId;
  const currentRegion = normalizeRegion(config.region) ?? 'prod';
  const currentDisplayName = config.appDisplayName ?? 'Copilot Helicopter View CodeApp';

  const environmentId = (args['environment-id'] ?? '').trim() || (await readline.question(`Environment ID${currentEnvironmentId ? ` [${currentEnvironmentId}]` : ''}: `)).trim() || currentEnvironmentId;

  if (!environmentId) {
    console.error('[code:bootstrap] A real environment ID is required.');
    process.exit(1);
  }

  const regionInput = (args.region ?? '').trim() || (await readline.question(`Region (${Array.from(allowedRegions).join(', ')}) [${currentRegion}]: `)).trim() || currentRegion;
  const region = normalizeRegion(regionInput);

  if (!region) {
    console.error(`[code:bootstrap] Invalid region '${regionInput}'. Expected one of: ${Array.from(allowedRegions).join(', ')}.`);
    process.exit(1);
  }

  const appDisplayName = (args['display-name'] ?? '').trim() || (await readline.question(`App display name [${currentDisplayName}]: `)).trim() || currentDisplayName;

  config.environmentId = environmentId;
  config.region = region;
  config.appDisplayName = appDisplayName;
  config.appId = config.appId ?? null;

  saveJson(configPath, config);
  console.log('[code:bootstrap] Updated power.config.json');
  console.log('[code:bootstrap] Next steps: npm run validate:power-config');
  console.log('[code:bootstrap] Optional: npm run code:list');
} finally {
  readline.close();
}