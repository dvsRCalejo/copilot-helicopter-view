# Vibe Coding with Power Apps Code Apps and GitHub Copilot

This guide is for the workflow you requested: use Power Apps Code Apps with Copilot-driven, prompt-first development.

## What This Is

- Use Power Apps Code Apps as the primary app-authoring experience.
- Use GitHub Copilot in VS Code to iterate on app code, formulas, and structure.
- Keep behavior parity with the web app in [webapp/src](../webapp/src).

## What To Avoid

- Do not start from legacy PAC unpacked starter files if your intent is Code Apps.
- Do not treat this as classic click-only Canvas Studio work.

## Recommended Workflow

1. Create the app in Power Apps Code Apps (vibe-style prompt flow).
2. Connect the app to this repository and a feature branch.
3. Open the branch in VS Code and iterate with Copilot.
4. Sync changes back and preview in Power Apps.
5. Run parity checks against the web app behavior.

## Initial Prompt (Copy/Paste)

Create a Copilot Helicopter View app connected to Dataverse tables bots and conversationtranscripts.
The app should show a dashboard of all agents the current user can access.
Add filter chips: All, Owned by me, Shared with me, Active only.
Add search by agent name and description.
Add sort toggle by modified date: newest first and oldest first.
Each result row should show: agent name, owner/co-owner badge, active/inactive status, transcript count, and last modified date.
Add an agent detail view with analytics cards (total sessions, last 7 days, last 30 days), plus daily trend.
Add transcript list and transcript viewer.
Use a modern card-based UI with strong visual hierarchy and spacing.

## Copilot Prompt Pack (Code Apps Iteration)

Use these one-by-one inside VS Code Copilot Chat.

1. Build dashboard state model

Implement local state and formulas for filter, search, and sort over the loaded agents collection.
Ensure search is case-insensitive over name and description.

2. Enforce ownership logic

Compute IsOwner by comparing owning user id with current user id from WhoAmI.
All visible records must rely on Dataverse security scope.

3. Add analytics derivation

Derive total sessions, last 7 days, last 30 days, and a per-day series from conversationtranscripts.

4. Add transcript viewer robustness

Parse transcript content defensively to support activity arrays or { activities: [] } shape.
Render user and bot messages clearly with timestamps.

5. Add empty and error states

For dashboard, detail, and transcript views add clear empty and error states with recovery actions.

## Behavior Parity Checklist

Match the web app behavior in:

- [webapp/src/pages/Dashboard.tsx](../webapp/src/pages/Dashboard.tsx)
- [webapp/src/hooks/useAgents.ts](../webapp/src/hooks/useAgents.ts)
- [webapp/src/utils/agentList.ts](../webapp/src/utils/agentList.ts)
- [webapp/src/pages/AgentDetail.tsx](../webapp/src/pages/AgentDetail.tsx)
- [webapp/src/components/TranscriptViewer.tsx](../webapp/src/components/TranscriptViewer.tsx)

Parity checks:

1. Filter logic returns correct subsets.
2. Search works on both name and description.
3. Sort flips correctly by modified date.
4. Ownership badge labels match expected user context.
5. Transcript counts and analytics totals are consistent.

## Suggested Branching Model

- `feature/codeapps-helicopter-v1`
- `feature/codeapps-analytics-v2`
- `feature/codeapps-transcripts-v2`

Keep changes small and test each branch in Power Apps preview before merge.

## If You Already Have a Generated Code App

Once the generated files are in this repo, ask Copilot:

Refactor this Code App to align with the Helicopter View parity checklist in powerapp/VIBE-CODE-APPS.md.
List exact files changed and explain why each change is needed.

This will let us continue directly in your generated Code App files instead of legacy starter artifacts.
