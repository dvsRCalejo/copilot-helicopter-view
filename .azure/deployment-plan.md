# Deployment Plan: MyCopilotHelicopterView

## Overview

Helicopter-view dashboard for all **Copilot Studio agents** in the tenant where the current user is **owner or co-owner**. Displays agent analytics and conversation transcripts in one consolidated place.

Two deliverables sharing the same user-facing workflow and core data model:

| Part                  | Stack                                                         | Deployment                           |
| --------------------- | ------------------------------------------------------------- | ------------------------------------ |
| **1. Power App**      | Power Apps Code Apps (Vite + React + `@microsoft/power-apps`) | Push to a Power Platform environment |
| **2. Static Website** | React 18 + TypeScript + Vite + Fluent UI v9                   | Docker container (nginx)             |

---

## Shared Data Architecture

- **Identity**: Microsoft Entra ID — delegated user permissions (user signs in with their own account)
- **Data source**: Dataverse Web API (`https://{org}.crm.dynamics.com/api/data/v9.2`)
- **Key entities**:
  | Dataverse Entity | Display Name | Purpose |
  |-----------------|-------------|---------|
  | `bots` | Copilots | Agent metadata; Dataverse security filtering auto-scopes to accessible records |
  | `conversationtranscripts` | Conversation Transcripts | Full conversation JSON, analytics source |
  | `systemusers` | Users | Power App only: map Entra identity to Dataverse `systemuserid` for owner labelling |
- **Ownership logic**:
  - Webapp: `WhoAmI()` returns the current Dataverse `systemuserid`
  - Power App: host Entra user is resolved through `systemusers.azureactivedirectoryobjectid` to the Dataverse `systemuserid`
  - Owner badge: compare current Dataverse `systemuserid` against bot owner fields (`_owninguser_value`, `_ownerid_value`)
  - All other visible records remain shared/co-owner (Dataverse implicit security)
- **Environment scope**:
  - Webapp: multi-environment aggregation and filtering
  - Power App: current-environment only
- **Analytics**: Derived from `conversationtranscript` records (count by date, total sessions, last activity)

---

## Project Structure

```
MyCopilotHelicopterView/
├── .azure/
│   └── deployment-plan.md        ← this file
├── powerapp/
│   ├── README.md                  ← setup & import guide
│   ├── CanvasManifest.json
│   ├── App.yaml
│   ├── Screens/
│   │   ├── HomeScreen.yaml
│   │   ├── AgentDetailScreen.yaml
│   │   └── TranscriptViewerScreen.yaml
│   └── DataSources/
│       ├── Copilots.json
│       ├── ConversationTranscripts.json
│       └── Office365Users.json
├── webapp/
│   ├── src/
│   │   ├── auth/                  (MSAL config + AuthProvider)
│   │   ├── services/              (Dataverse API client)
│   │   ├── hooks/                 (React Query hooks)
│   │   ├── components/            (AgentCard, AnalyticsPanel, TranscriptViewer…)
│   │   ├── pages/                 (Dashboard, AgentDetail)
│   │   ├── types/                 (TypeScript interfaces)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

---

## Prerequisites

| Prerequisite                                        | Part 1 (Power App)      | Part 2 (Webapp)                 |
| --------------------------------------------------- | ----------------------- | ------------------------------- |
| Power Platform environment with Copilot Studio      | ✅ Required             | ✅ Required (as data source)    |
| Azure App Registration (Entra ID)                   | Not needed              | ✅ Required                     |
| Dataverse delegated permission `user_impersonation` | Implicit via Power Apps | ✅ Required on App Registration |
| PAC CLI (`pac` ≥ 1.30)                              | ✅ To pack & import     | Not needed                      |
| Docker                                              | Not needed              | ✅ To run container             |
| Node.js 20+                                         | Not needed              | ✅ For local dev                |

---

## Execution Steps

- [x] Research Copilot Studio Dataverse API
- [x] Create deployment plan
- [x] Scaffold Power App (PAC CLI YAML source)
- [x] Scaffold React webapp (auth, services, hooks, components, pages)
- [x] Add Docker + nginx configuration
- [x] Add root README

---

## Security Posture

- Auth is delegated — users only ever see agents they own or that are shared with them (enforced by Dataverse row-level security, not the app)
- No secrets stored in frontend code — App Registration uses Public Client flow (PKCE) with no client secret
- Docker image uses `nginx:alpine` with hardened CSP headers
- No admin-consent required beyond standard `user_impersonation` on the Dataverse resource
