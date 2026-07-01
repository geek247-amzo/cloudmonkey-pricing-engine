# CloudMonkey Competitor Intelligence PRD

## Product Summary
CloudMonkey Competitor Intelligence is a managed AI service that shows businesses what competitors are doing better online and what to do next. The product is positioned as a business growth command centre, with SEO as one module inside a broader competitor intelligence workflow.

Primary promise: see what your competitors are doing online, where they are beating you, and what to fix next.

## Target Users
- South African SMEs that need practical growth direction without managing SEO tooling themselves.
- CloudMonkey customers buying managed websites, hosting, domains, AI agents, or managed SEO.
- CloudMonkey operators who need repeatable intelligence reports for client accounts.

## MVP Scope
The first implementation is a paid authenticated dashboard MVP.

Included:
- Create an intelligence project with business name, website URL, location, industry, services/products, and target keywords.
- Add up to 3 competitor URLs manually.
- Trigger an n8n-orchestrated scan.
- Store scan status, crawl data, SERP results, SEO issues, content gaps, recommendations, and AI reports.
- Show a project overview with visibility, SEO, content gap, local SEO readiness, technical health, and AI recommendations.
- Show competitor comparison, keyword gaps, SEO audit issues, and report views.
- Generate an AI report from a normalized insight packet using Gemini.
- Support PDF report generation using the existing Chromium/Playwright pattern.
- Capture free owned-site signals from Google Search Console when a Google account is linked.
- Run a free live crawl fingerprint for page metadata, headings, schema, headers, and technology hints.

Deferred:
- Public free scan funnel.
- Ads intelligence, backlink analysis, white-label reports, agency dashboards, and automated content briefs.

## Data Sources
- DataForSEO: SERP, keyword rankings, competitor discovery, and keyword gaps.
- Google Search Console: owned-site queries, clicks, impressions, and page performance when linked.
- n8n: scan orchestration, provider calls, notifications, and workflow retries.
- Playwright crawler: page metadata, screenshots, headings, links, schema presence, robots/sitemap checks, and basic technical SEO signals.
- Gemini: AI summaries, recommended actions, and executive reports.
- PageSpeed Insights: optional performance data when `PAGESPEED_API_KEY` is configured.

## Core Workflow
1. User creates a project.
2. User adds website details, target keywords, and competitors.
3. User starts a scan.
4. CloudMonkey creates an intelligence job and calls the n8n webhook.
5. n8n runs discovery, SERP checks, crawling, scoring, and AI reporting.
6. n8n calls CloudMonkey webhook endpoints with job updates and results.
7. CloudMonkey stores normalized records and refreshes the dashboard.
8. User reviews prioritized recommendations and report.

## Scoring Model
Each project stores score snapshots from 0 to 100:
- Visibility score
- Technical SEO score
- Content SEO score
- Content gap score
- Local SEO readiness score
- Performance score
- AI readiness score
- Overall opportunity score

Scores should be explainable through source records, such as page issues, keyword gaps, competitor pages, or SERP observations.

## AI Report Requirements
AI output must be based on a structured insight packet, not raw crawler dumps.

The report must include:
- Executive summary
- What competitors are doing better
- Priority fixes
- Growth opportunities
- Competitor weaknesses
- 30-day action plan
- Managed CloudMonkey execution opportunities

Every recommendation must link back to stored source data where possible.

## Access Control
- Subscribed users can create and view their own intelligence projects.
- Admin and owner users can view and manage all projects.
- Users without a qualifying active subscription see the feature but cannot create projects or run scans.

## Environment Variables
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `GEMINI_API_KEY`
- `N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_URL`
- `N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_SECRET`
- `PAGESPEED_API_KEY` optional

## Success Criteria
- A subscribed user can create a project, add competitors/keywords, trigger a scan, and view stored scan/report data.
- n8n can update job status and submit results through authenticated webhooks.
- Recommendations are persisted with priority, impact, effort, category, and source references.
- The dashboard communicates business actions, not only SEO diagnostics.
- The system degrades clearly when external provider credentials are missing.
