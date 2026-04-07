# Power App — Copilot Helicopter View

Canvas App source for the helicopter view of your Copilot Studio agents.  
Generated in PAC CLI unpack format — import using `pac canvas pack` then upload to Power Apps.

---

## Prerequisites

| Tool | Install |
|------|---------|
| [PAC CLI](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) ≥ 1.30 | `winget install Microsoft.PowerAppsCLI` |
| A Power Platform environment with Copilot Studio | [make.powerapps.com](https://make.powerapps.com) |
| Office 365 license (for `Office365Users` connector) | Included in Microsoft 365 |

---

## Import the App

### Option A — Pack & import via PAC CLI (recommended)

```powershell
# 1. Authenticate to your environment
pac auth create --environment https://<yourorg>.crm.dynamics.com

# 2. Pack the YAML source into a .msapp file
pac canvas pack --sources ./src --msapp CopilotHelicopterView.msapp

# 3. Import the .msapp into Power Apps
#    a. Open https://make.powerapps.com
#    b. Apps → Import canvas app → Upload CopilotHelicopterView.msapp
#    c. Connect the two data sources when prompted (see below)
```

### Option B — Build manually in Power Apps Studio

1. Create a new blank Camera App (tablet layout).
2. Add data sources:
   - **Dataverse** → Tables → **Copilots** and **Conversation Transcripts**
   - **Office 365 Users** connector
3. Copy the Power FX formulas from `Screens/*.yaml` (the `Properties.OnStart`, `OnSelect`, `Items`, etc. values) into the corresponding controls.
4. Recreate controls in approximate positions — exact pixel values are in the YAML `X`/`Y`/`Height`/`Width` properties.

---

## Required Data Connections

| Connection | Type | Why |
|-----------|------|-----|
| Microsoft Dataverse (current environment) | Dataverse | Lists `Copilots` and `Conversation Transcripts` |
| Office 365 Users | Connector | `Office365Users.MyProfileV2()` — identifies the current user |

> Dataverse row-level security automatically restricts data to records the signed-in user can access. No extra OData filters are needed for the security boundary — the `IsOwner` column is cosmetic only (to label owned vs shared).

---

## Screens

| Screen | Purpose |
|--------|---------|
| `HomeScreen` | Gallery of all accessible agents; filter by All / Owned / Shared / Active |
| `AgentDetailScreen` | Analytics bar chart + transcript list for a selected agent |
| `TranscriptViewerScreen` | Renders individual conversation transcript as a chat UI |

---

## Global Variables

| Variable | Type | Set In |
|----------|------|--------|
| `gblCurrentUser` | UserProfile | `App.OnStart` |
| `gblColorPrimary` | Color | `App.OnStart` |
| `gblSelectedAgent` | Bot record | `HomeScreen` → **View details** |
| `gblSelectedTranscript` | Transcript record | `AgentDetailScreen` → **View** |
| `gblFilterMode` | Text ("All","Owned","Shared","Active") | `HomeScreen` filter buttons |
| `gblDetailTab` | Text ("Analytics","Transcripts") | `AgentDetailScreen` tabs |

---

## Collections

| Collection | Contents | Populated In |
|-----------|----------|-------------|
| `colAgents` | All accessible bots with `IsOwner` + `TranscriptCount` columns | `App.OnStart` |
| `colTranscripts` | Transcripts for `gblSelectedAgent` | `AgentDetailScreen.OnVisible` |
| `colAnalyticsByDay` | Group-by day count from `colTranscripts` | `AgentDetailScreen.OnVisible` |
| `colMessages` | Parsed message activities from transcript JSON | `TranscriptViewerScreen.OnVisible` |

---

## Customisation

- **Colours**: Change `gblColorPrimary` in `App.OnStart`.
- **Date range for analytics**: Modify the `colAnalyticsByDay` GroupBy in `AgentDetailScreen.OnVisible` to add a `DateDiff` filter.
- **Transcript content schema**: If your tenant stores transcripts in a different JSON shape than Bot Framework Activity format, update the `ParseJSON` expressions in `TranscriptViewerScreen.OnVisible`.

---

## Regression Checklist

Run this quick checklist after changing formulas in `App.yaml` or `Screens/*.yaml`:

1. **Filter parity**
   - Tap `All`, `Owned by me`, `Shared with me`, `Active only` and confirm counts and records change as expected.
2. **Search parity**
   - Enter a known agent name substring in the search box and verify only matching agents remain.
   - Enter a known description substring and verify matching results.
   - Clear the search box and confirm full filtered list returns.
3. **Sort parity**
   - Tap `Newest first` / `Oldest first` and verify order flips by `modifiedon`.
4. **Cross-screen safety**
   - Open an agent from a searched/sorted list and verify `AgentDetailScreen` still loads analytics and transcripts.
