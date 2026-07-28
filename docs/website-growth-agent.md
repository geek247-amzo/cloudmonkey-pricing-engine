# Website growth agent

The growth worker is a persistent Docker service. It does not require `tmux` and must not be run from an interactive Codex terminal.

Required production environment values:

- `GROWTH_AGENT_WORKER_TOKEN`: a long random service token shared only by the frontend and worker.
- `CODEX_BIN_PATH`: absolute host path to the installed Codex CLI, normally `/root/.local/bin/codex` on the CloudMonkey host.
- `CODEX_HOME_PATH`: the Codex home containing the worker's non-interactive credentials and approved configuration. Do not mount a personal interactive session into production.
- `GROWTH_AGENT_POLL_SECONDS`: optional polling interval, default 60 seconds.

The worker polls a token-protected CloudMonkey endpoint. The database owns schedules and leases, so restarts do not lose jobs and concurrent workers cannot claim the same run. Proposal-generation runs use Codex `--sandbox read-only`; only a job containing an approved proposal receives `--sandbox workspace-write`. Both modes use an isolated work directory, a 15-minute execution timeout, and ephemeral session state.

After migration and deployment, activate the sponsored pilot through an authenticated admin request or the customer portal:

```bash
curl -X POST https://cloudmonkey.co.za/api/admin/website-growth/WEBSITE_ID/activate \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin-session-cookie>' \
  -d '{"dailyBudgetTokens":50000,"maxChangesPerRun":10}'
```

The customer workspace is `/dashboard/websites/WEBSITE_ID/growth`. It exposes messages, proposals, approval decisions, run history, and platform token usage. This pilot is sponsored: usage is recorded against the customer and website but `chargedTokens` remains zero. If Codex does not return authoritative telemetry, the portal displays `usage unavailable` rather than an invented count.

Only an approved proposal may request deployment. The backend validates proposal ownership and approval state before calling the existing website provisioner.
