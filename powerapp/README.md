# Power Apps Code Apps Workspace

This folder is the rebuilt Code Apps project for Helicopter View using the official template from:

- https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/npm-quickstart

The previous PAC/canvas implementation was archived to [../powerapp-canvas-legacy](../powerapp-canvas-legacy).

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

2. Initialize app metadata in your Power Platform environment:

```powershell
npx power-apps init --display-name "Copilot Helicopter View" --environment-id <ENVIRONMENT_ID>
```

If you prefer interactive prompts:

```powershell
npx power-apps init
```

3. Run local development:

```powershell
npm run dev
```

4. Build and push to Power Apps:

```powershell
npm run build
npx power-apps push
```

## NPM Scripts

- `npm run dev` - Start local dev server.
- `npm run build` - Type-check and build production assets.
- `npm run code:init` - Shortcut for `power-apps init`.
- `npm run code:push` - Shortcut for `power-apps push`.

## Next Build Goals

1. Dashboard with filters: All / Owned / Shared / Active.
2. Search by name and description.
3. Sort by modified date: newest/oldest.
4. Agent detail analytics and transcript viewer.
