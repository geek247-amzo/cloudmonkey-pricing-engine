# CloudMonkey Competitor Intelligence TODO

## Documentation
- [x] Create `prd.md` with MVP scope, architecture, workflow, and acceptance criteria.
- [x] Create `todo.md` as the working implementation checklist.

## Database
- [x] Add intelligence project, competitor, keyword, job, crawl, audit, issue, SERP, content gap, recommendation, report, scheduled report, and integration tables.
- [x] Add Drizzle relations for the new intelligence records.
- [x] Add SQL migration for the new tables and indexes.

## Backend
- [x] Add Zod schemas for project creation, competitors, keywords, scan triggers, n8n callbacks, reports, and recommendations.
- [x] Add user APIs for listing, creating, updating, and reading intelligence projects.
- [x] Add user APIs for competitors, keywords, scans, overview data, recommendations, and reports.
- [x] Add admin APIs for viewing all projects and job state.
- [x] Add secure n8n webhook endpoints for job status and result ingestion.
- [x] Add scan trigger helper that sends a normalized payload to n8n.
- [x] Add subscription gate for non-admin users.

## Frontend
- [x] Add dashboard navigation entry for Competitor Intelligence.
- [x] Add project list and project creation form.
- [x] Add project detail dashboard with overview scorecards.
- [x] Add competitor comparison, keyword gap, SEO audit, recommendations, and reports sections.
- [x] Add loading, empty, failed, and missing subscription states.

## n8n Workflow Contract
- [x] Configure `N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_URL`.
- [x] Configure `N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_SECRET`.
- [x] Implement starter n8n workflow that posts callback payloads and generates the first report/recommendations.
- [ ] Add DataForSEO credentials and replace starter keyword placeholders with live SERP/ranking enrichment.
- [ ] Add crawler execution and retry/error paths that update CloudMonkey job status.

## Verification
- [x] Run production build.
- [ ] Test access control for unsubscribed, subscribed, and admin users.
- [x] Test webhook secret validation.
- [ ] Test project creation, competitor creation, keyword creation, scan trigger, and callback persistence.
- [ ] Test dashboard populated and empty states.
