# Webapp Setup & Installation

## Prerequisites

- Node.js 18+
- Azure AD tenant
- At least one Copilot Studio agent in a Power Platform environment

## Installation

### 1. Create `.env` file

```bash
cd webapp
cp .env.example .env
```

Fill in:

```
VITE_CLIENT_ID=<your-app-client-id>
VITE_TENANT_ID=<your-azure-tenant-id>
```

### 2. Configure Entra App Registration

In [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade):

**Find your app** → **API permissions** → Add the following delegated permissions:

| API                | Permission           | Purpose                                 |
| ------------------ | -------------------- | --------------------------------------- |
| Microsoft Graph    | `User.Read`          | Sign in and read user profile           |
| Power Apps Service | `user_impersonation` | Discover Power Platform environments    |
| Dynamics CRM       | `user_impersonation` | Access Dataverse agents and transcripts |

**Admin consent:** Not required — users can consent individually on first login.

### 3. Run the webapp

```bash
cd webapp
npm run dev
```

Starts on `http://localhost:5173`

## Login Flow

1. Click **Sign in** → popup opens
2. Approve Microsoft Graph consent (basic profile access)
3. Dashboard loads and attempts to discover environments
4. Approve Power Apps Service consent (list your environments)
5. For each environment with agents, approve Dataverse consent on first access

**All agents across all accessible environments** are automatically aggregated and displayed.

## Troubleshooting

**No agents showing after login?**

- Open Browser DevTools (F12) → **Console**
- Look for errors like `Failed to load agents`
- Check that you have Copilot Studio agents created in at least one Power Platform environment
- Verify your Azure AD user has **read access** to the agents and transcripts

**Authentication keeps redirecting?**

- Clear session storage: DevTools → **Application** → **Session Storage** → Delete all for `localhost:5173`
- Refresh and try again

**Popup blocked?**

- Check browser popup settings for `localhost:5173`
- Allow popups for the consent flow to work

**Power App publishes but shows no telemetry data?**

- This usually means the Power App local config is missing required Dataverse `databaseReferences`
- In `powerapp/`, run `npm run validate:power-config` and confirm the config passes before publishing
- Verify `powerapp/power.config.json` includes bindings for `bot`, `conversationtranscript`, `systemuser`, and `organization`
- Re-publish from `powerapp/` with `npm run code:push`
- After publish, open the app in the target environment and confirm the dashboard shows agents and transcript counts instead of an empty state

**Power App CLI resolves the wrong tenant during push?**

- In `powerapp/`, run `npm run code:reset-auth` to clear the local file cache and print the platform-specific next step
- If `power-apps init` reports that the environment does not exist, skip init and use `powerapp/power.config.example.json` as the source for your local `power.config.json`

## Features

- **Multi-environment:** Automatically discovers and displays agents from all environments you have access to
- **Channel badges:** Shows which channels (Teams, M365 Copilot, SharePoint) each agent is deployed to
- **Conversation analytics:** Tracks agent activity and conversation volume over 7 days
- **Agent detail:** Click any agent to view transcripts, analytics, and open in Copilot Studio
- **Ownership tracking:** Shows which agents you own vs. shared with you
