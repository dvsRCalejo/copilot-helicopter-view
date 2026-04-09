# Power Apps Code Apps Workspace

This folder is the rebuilt Code Apps project for Helicopter View using the official template from:

- https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/npm-quickstart

## Prerequisites

1. Power Platform environment with Code Apps enabled.
2. Node.js LTS.
3. Git.
4. Power Apps Code Apps CLI via the `@microsoft/power-apps` package (already installed in this project).

## Setup

From this folder:

1. Install dependencies:

```powershell
npm install
```

Node.js 22 LTS is the recommended runtime for the Power Apps CLI used in this project.

2. Create your local Power Apps config with the repo bootstrap command:

```powershell
npm run code:bootstrap
```

You can also pass values non-interactively:

```powershell
npm run code:bootstrap -- --environment-id <ENVIRONMENT_ID> --region prod --display-name "Copilot Helicopter View"
```

This creates `power.config.json` from the checked-in example and fills the local environment-specific values.

If you prefer to do it by hand, copy the example manually:

```powershell
Copy-Item power.config.example.json power.config.json
```

Then edit `power.config.json` with your own environment-specific values:

- `environmentId` - your Power Platform environment id
- `region` - `prod`, `preview`, `gccmoderate`, or `gcchigh`
- `appId` - keep `null` for first push, then preserve the generated value

Important: keep `databaseReferences` intact. This app requires these Dataverse tables to be bound at runtime:

- `bot`
- `conversationtranscript`
- `systemuser`
- `organization`

You can verify the local config before pushing:

```powershell
npm run validate:power-config
```

If you need to confirm the signed-in account can see Code Apps in the target environment, you can list them with:

```powershell
npm run code:list
```

3. (Optional) If you want to run CLI init, use:

```powershell
npx power-apps init --display-name "Copilot Helicopter View" --environment-id <ENVIRONMENT_ID>
```

If you prefer interactive prompts:

```powershell
npx power-apps init
```

If `init` does not resolve your environment in your tenant, continue using the example-based config workflow above.

4. Run local development:

```powershell
npm run dev
```

5. Build and push to Power Apps:

```powershell
npm run build
npx power-apps push
```

Or use the guarded push script, which validates `power.config.json` before publishing:

```powershell
npm run code:push
```

`power.config.json` is intentionally ignored by git because it contains tenant/environment-specific ids.

## CLI Caveats

The current npm Power Apps CLI is still rough around environment initialization and cached authentication. For this repo:

- Prefer the checked-in `power.config.example.json` over relying on `power-apps init`.
- If `power-apps init` reports that your environment does not exist, continue with manual config instead of blocking on init.
- If `power-apps push` resolves the wrong tenant, run `npm run code:reset-auth`, then clear the secure-store entry named `power-apps` for your platform if silent sign-in still persists.
- Harmless telemetry initialization errors from the CLI can be ignored if the push itself succeeds.

The CLI stores its file cache under `~/.powerapps-cli/cache/auth/msal_cache.json`.

Platform-specific follow-up commands if a cached login keeps selecting the wrong tenant:

- macOS: `security delete-generic-password -s "power-apps" -a "power-apps" 2>/dev/null`
- Linux: `secret-tool clear service power-apps account power-apps`
- Windows: remove any `power-apps` entry from Windows Credential Manager if one is present

If you ever need to recreate the Dataverse bindings manually, add these data sources again:

```powershell
pac code add-data-source -a dataverse -t bot
pac code add-data-source -a dataverse -t conversationtranscript
pac code add-data-source -a dataverse -t systemuser
pac code add-data-source -a dataverse -t organization
```

## NPM Scripts

- `npm run dev` - Start local dev server.
- `npm run build` - Type-check and build production assets.
- `npm run code:bootstrap` - Create or update `power.config.json` from the repo template.
- `npm run code:list` - List Code Apps visible to the signed-in account.
- `npm run code:init` - Shortcut for `power-apps init`.
- `npm run code:reset-auth` - Clear the local Power Apps CLI auth cache and print platform-specific next steps.
- `npm run code:push` - Shortcut for `power-apps push`.

## Next Build Goals

1. Dashboard with filters: All / Owned / Shared / Active.
2. Search by name and description.
3. Sort by modified date: newest/oldest.
4. Agent detail analytics and transcript viewer.
