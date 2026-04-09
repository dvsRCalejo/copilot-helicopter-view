# Release Notes

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