import { existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const authCacheDirectory = path.join(os.homedir(), '.powerapps-cli', 'cache', 'auth');

if (existsSync(authCacheDirectory)) {
  rmSync(authCacheDirectory, { recursive: true, force: true });
  console.log(`[code:reset-auth] Removed CLI auth cache at ${authCacheDirectory}`);
} else {
  console.log(`[code:reset-auth] No CLI auth cache found at ${authCacheDirectory}`);
}

console.log('[code:reset-auth] If silent sign-in still uses the wrong tenant, clear the secure-store entry named "power-apps" for your OS and retry the next push.');

switch (process.platform) {
  case 'darwin':
    console.log('[code:reset-auth] macOS: run security delete-generic-password -s "power-apps" -a "power-apps" 2>/dev/null');
    break;
  case 'linux':
    console.log('[code:reset-auth] Linux: run secret-tool clear service power-apps account power-apps');
    break;
  case 'win32':
    console.log('[code:reset-auth] Windows: if needed, remove any "power-apps" credential from Windows Credential Manager before retrying.');
    break;
  default:
    console.log('[code:reset-auth] Unknown platform: clear the secure-store entry named "power-apps" manually if silent sign-in persists.');
}