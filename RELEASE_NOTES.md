# Release Notes

## 2026-05-15

### Copilot Credit Estimator

- Added interactive cost forecasting tool for monthly Copilot credit consumption estimation
- Feature-by-feature cost breakdown: classic answers, generative answers, enterprise data grounding, actions, AI Builder prompts, autonomous tasks, and more
- Automatic baseline inference from agent transcripts: sessions/month, message depth, and feature usage patterns extracted from conversation data
- Per-session adjustment controls: users can override any parameter to explore cost sensitivities and scenarios
- Agent type selection: Standard Copilot Studio vs. Enterprise variants with different credit rate profiles
- Per-feature transparency: each row shows credits per unit, auto-detected session counts, and per-session cost
- Integration with agent grid: "💸 Estimate cost" button on each agent card and detail page
- Disclaimer and validation reminders: feature detection is heuristic-based; costs should be validated against official Microsoft pricing before business decisions
- Parity across both implementations: estimator available in both Power App Code App and static webapp
- Pure utility library for cost calculations: `costEstimator.ts` with shared logic, test coverage, and centralized credit rate config

### Implementation details

- New pages: `webapp/src/pages/Estimator.tsx` and `powerapp/src/pages/Estimator.tsx`
- Utility functions: `costEstimator.ts` with transcript inference, feature detection, and cost computation
- Config: `src/data/copilotCreditRates.json` with 8 feature types, credit values, and billing rules
- Tests: `costEstimator.test.ts` with coverage for inference and calculation logic
- UI components: hero section, left-panel inputs (agent selector, sessions, feature toggles), right-panel breakdown with live cost totals
- Both apps build successfully with zero TypeScript errors

---

## 2026-04-09

### Power App Dataverse binding fix

- Fixed the Power App deployment workflow so Dataverse table bindings are treated as required local configuration, preventing silent no-data publishes.
- Added `powerapp/power.config.example.json` with the required `databaseReferences` for `bot`, `conversationtranscript`, `systemuser`, and `organization`.
- Stopped tracking `powerapp/power.config.json` in git because it contains tenant-specific ids.
- Added `npm run validate:power-config` and wired `npm run code:push` to validate config before publishing.
- Updated setup docs to prefer the example-based config workflow over relying on `power-apps init`.
- Added `npm run code:reset-auth` and `npm run code:list` to make the CLI auth/environment workarounds easier to use.
- Added `npm run code:bootstrap` and pinned the Power Apps CLI version used by this repo.

### Deployment verification

- Local validation passed with `npm run validate:power-config`.
- Local Power App production build passed with `npm run build`.
- Publish to Power Apps succeeded with `npm run code:push`.
- Final live verification remains a tenant-side check: open the published Power App in the target environment and confirm that agents, transcript counts, and user-linked telemetry appear.
