/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from "drizzle-orm";
import { z } from "zod";

export type IntelligenceDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireIntelligenceAccess: (
    request: Request,
  ) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  makeId: (prefix: string) => string;
  safeJsonParse: (value: string | null | undefined) => unknown;
  publicProjectDto: (row: any) => any;
  publicReportDto: (row: any) => any;
  getIntelligenceProjectForSession: (projectId: string, session: any) => Promise<any>;
  buildIntelligenceOverview: (project: any) => Promise<any>;
  sendN8nCompetitorIntelligence: (input: any) => Promise<any>;
  crawlSiteFingerprint: (websiteUrl: string, target: "primary" | "competitor") => Promise<any>;
  fetchGoogleSearchConsoleSnapshot: (userId: string, websiteUrl: string) => Promise<any>;
  reserveWalletUsage: (input: any) => Promise<any>;
  commitWalletReservation: (input: any) => Promise<any>;
  releaseWalletReservation: (input: any) => Promise<any>;
  intelligenceProject: any;
  intelligenceCompetitor: any;
  intelligenceKeyword: any;
  intelligenceKeywordRanking: any;
  intelligenceJob: any;
  intelligenceCrawlPage: any;
  intelligenceSeoAudit: any;
  intelligenceSerpResult: any;
  intelligencePageIssue: any;
  intelligenceContentGap: any;
  intelligenceRecommendation: any;
  intelligenceReport: any;
  user: any;
  intelligenceProjectCreateSchema: any;
  intelligenceCompetitorSchema: any;
  intelligenceKeywordSchema: any;
  intelligenceScanSchema: any;
  buildIntelligenceProjectUpdateSchema: () => any;
};

export function buildIntelligenceProjectUpdateSchema() {
  return z
    .object({
    name: z.string().min(2).max(140).optional(),
    businessName: z.string().min(2).max(140).optional(),
    websiteUrl: z.string().url().optional(),
    location: z.string().max(160).optional().nullable(),
    industry: z.string().max(160).optional().nullable(),
    servicesProducts: z.string().max(2000).optional().nullable(),
    })
    .strict();
}

function defaultCompetitorName(websiteUrl: string) {
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl;
  }
}

export function createIntelligenceHandlers(deps: IntelligenceDeps) {
  async function handleUserIntelligence(request: Request): Promise<Response> {
    const { session, response } = await deps.requireIntelligenceAccess(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const detailMatch = url.pathname.match(/^\/api\/user\/intelligence\/([^/]+)(?:\/([^/]+))?$/);
    const updateSchema = deps.buildIntelligenceProjectUpdateSchema();

    if (url.pathname === "/api/user/intelligence/access" && request.method === "GET") {
      return deps.json({ hasAccess: true });
    }

    if (url.pathname === "/api/user/intelligence" && request.method === "GET") {
      const rows = await deps.db.query.intelligenceProject.findMany({
        where: eq(deps.intelligenceProject.userId, session.user.id),
        orderBy: (intelligenceProject: any, { desc }: any) => [desc(intelligenceProject.updatedAt)],
      });
      return deps.json({ projects: rows.map(deps.publicProjectDto) });
    }

    if (url.pathname === "/api/user/intelligence" && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.intelligenceProjectCreateSchema);
        const projectId = deps.makeId("intelproj");
        const createdAt = new Date();
        const projectName = body.name?.trim() || `${body.businessName} intelligence`;

        const [created] = await deps.db
          .insert(deps.intelligenceProject)
          .values({
            id: projectId,
            userId: session.user.id,
            name: projectName,
            businessName: body.businessName,
            websiteUrl: body.websiteUrl,
            location: body.location ?? null,
            industry: body.industry ?? null,
            servicesProducts: body.servicesProducts ?? null,
            status: "draft",
            metadata: JSON.stringify({ source: "dashboard" }),
            createdAt,
            updatedAt: createdAt,
          })
          .returning();

        if (body.targetKeywords?.length) {
          await deps.db.insert(deps.intelligenceKeyword).values(
            body.targetKeywords.map((keyword: string) => ({
              id: deps.makeId("intelkw"),
              projectId,
              userId: session.user.id,
              keyword,
              location: body.location ?? null,
              priority: "medium",
            })),
          );
        }

        if (body.competitors?.length) {
          await deps.db.insert(deps.intelligenceCompetitor).values(
            body.competitors.map((competitorInput: any) => ({
              id: deps.makeId("intelcomp"),
              projectId,
              userId: session.user.id,
              name: competitorInput.name || defaultCompetitorName(competitorInput.websiteUrl),
              websiteUrl: competitorInput.websiteUrl,
              competitorType: competitorInput.competitorType ?? "manual",
              status: "active",
            })),
          );
        }

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "intelligence.project.created",
          entityType: "intelligence_project",
          entityId: created.id,
          message: `Competitor intelligence project created for ${created.businessName}`,
        });

        return deps.json({ project: deps.publicProjectDto(created) }, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (detailMatch) {
      const projectId = decodeURIComponent(detailMatch[1]);
      const child = detailMatch[2] ? decodeURIComponent(detailMatch[2]) : null;
      const project = await deps.getIntelligenceProjectForSession(projectId, session);
      if (!project) return deps.json({ error: "Project not found" }, 404);

      if (!child && request.method === "GET") {
        return deps.json(await deps.buildIntelligenceOverview(project));
      }

      if (!child && request.method === "PATCH") {
        try {
          const body = await deps.parseBody(request, updateSchema);
          const updates: Record<string, any> = {
            updatedAt: new Date(),
          };
          if (body.name !== undefined) updates.name = body.name;
          if (body.businessName !== undefined) updates.businessName = body.businessName;
          if (body.websiteUrl !== undefined) updates.websiteUrl = body.websiteUrl;
          if (body.location !== undefined) updates.location = body.location ?? null;
          if (body.industry !== undefined) updates.industry = body.industry ?? null;
          if (body.servicesProducts !== undefined) updates.servicesProducts = body.servicesProducts ?? null;

          const [updated] = await deps.db
            .update(deps.intelligenceProject)
            .set(updates)
            .where(eq(deps.intelligenceProject.id, project.id))
            .returning();
          return deps.json({ project: deps.publicProjectDto(updated) });
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (child === "overview" && request.method === "GET") {
        return deps.json(await deps.buildIntelligenceOverview(project));
      }

      if (child === "competitors" && request.method === "POST") {
        try {
          const body = await deps.parseBody(request, deps.intelligenceCompetitorSchema);
          const [created] = await deps.db
            .insert(deps.intelligenceCompetitor)
            .values({
              id: deps.makeId("intelcomp"),
              projectId: project.id,
              userId: project.userId,
              name: body.name || defaultCompetitorName(body.websiteUrl),
              websiteUrl: body.websiteUrl,
              competitorType: body.competitorType ?? "manual",
              status: "active",
            })
            .returning();
          await deps.db
            .update(deps.intelligenceProject)
            .set({ updatedAt: new Date() })
            .where(eq(deps.intelligenceProject.id, project.id));
          return deps.json({ competitor: created }, 201);
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (child === "keywords" && request.method === "POST") {
        try {
          const body = await deps.parseBody(request, deps.intelligenceKeywordSchema);
          const [created] = await deps.db
            .insert(deps.intelligenceKeyword)
            .values({
              id: deps.makeId("intelkw"),
              projectId: project.id,
              userId: project.userId,
              keyword: body.keyword,
              location: body.location ?? project.location,
              device: body.device,
              intent: body.intent ?? null,
              priority: body.priority,
              status: "active",
            })
            .returning();
          await deps.db
            .update(deps.intelligenceProject)
            .set({ updatedAt: new Date() })
            .where(eq(deps.intelligenceProject.id, project.id));
          return deps.json({ keyword: created }, 201);
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (child === "submit" && request.method === "POST") {
        try {
          const [competitors, keywords] = await Promise.all([
            deps.db.query.intelligenceCompetitor.findMany({
              where: eq(deps.intelligenceCompetitor.projectId, project.id),
            }),
            deps.db.query.intelligenceKeyword.findMany({
              where: eq(deps.intelligenceKeyword.projectId, project.id),
            }),
          ]);
          const missing = [
            !project.businessName ? "businessName" : null,
            !project.websiteUrl ? "websiteUrl" : null,
            !project.location ? "location" : null,
            !project.industry ? "industry" : null,
            !project.servicesProducts ? "servicesProducts" : null,
            keywords.length < 3 ? "targetKeywords" : null,
            competitors.length < 3 ? "competitors" : null,
          ].filter(Boolean);
          if (missing.length) {
            return deps.json(
              { error: "Complete the required intelligence fields before submitting", missing },
              400,
            );
          }

          const [updated] = await deps.db
            .update(deps.intelligenceProject)
            .set({
              status: "submitted",
              updatedAt: new Date(),
              metadata: JSON.stringify({
                ...(deps.safeJsonParse(project.metadata) ?? {}),
                submittedAt: new Date().toISOString(),
                submittedBy: session.user.id,
              }),
            })
            .where(eq(deps.intelligenceProject.id, project.id))
            .returning();

          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "intelligence.project.submitted",
            entityType: "intelligence_project",
            entityId: project.id,
            message: `Competitor intelligence project submitted for ${project.businessName}`,
          });

          return deps.json({ project: deps.publicProjectDto(updated) });
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (child === "scan" && request.method === "POST") {
        if (session.user.role !== "admin") {
          return deps.json({ error: "Only admins can run Competitor Intelligence reports" }, 403);
        }
        try {
          const body = await deps.parseBody(request, deps.intelligenceScanSchema);
          const [competitors, keywords] = await Promise.all([
            deps.db.query.intelligenceCompetitor.findMany({
              where: eq(deps.intelligenceCompetitor.projectId, project.id),
            }),
            deps.db.query.intelligenceKeyword.findMany({
              where: eq(deps.intelligenceKeyword.projectId, project.id),
            }),
          ]);
          const scanTargets = [project.websiteUrl, ...competitors.map((competitor: any) => competitor.websiteUrl)].slice(0, 4);
          const freeCrawlPages: Array<any> = [];
          for (const [index, targetUrl] of scanTargets.entries()) {
            try {
              const target = index === 0 ? "primary" : "competitor";
              const fingerprint = await deps.crawlSiteFingerprint(targetUrl, target);
              freeCrawlPages.push({
                ...fingerprint,
                projectId: project.id,
                jobId: null,
                userId: project.userId,
                competitorId: index === 0 ? null : (competitors[index - 1]?.id ?? null),
              });
            } catch (crawlError: any) {
              freeCrawlPages.push({
                id: deps.makeId("intelpage"),
                projectId: project.id,
                jobId: null,
                userId: project.userId,
                competitorId: index === 0 ? null : (competitors[index - 1]?.id ?? null),
                url: targetUrl,
                target: index === 0 ? "primary" : "competitor",
                httpStatus: null,
                title: null,
                metaDescription: null,
                h1: null,
                h2Count: 0,
                wordCount: 0,
                internalLinkCount: 0,
                externalLinkCount: 0,
                imageMissingAltCount: 0,
                hasCanonical: false,
                hasSchema: false,
                loadTimeMs: null,
                screenshotUrl: null,
                raw: {
                  error: crawlError.message,
                  sourceUrl: targetUrl,
                  target: index === 0 ? "primary" : "competitor",
                },
                observedAt: new Date().toISOString(),
              });
            }
          }

          const freePrimaryPage = freeCrawlPages[0] ?? null;
          const freeSearchConsoleSnapshot = await deps.fetchGoogleSearchConsoleSnapshot(
            session.user.id,
            project.websiteUrl,
          ).catch(() => null);
          const freeSearchConsoleSerpResults = freeSearchConsoleSnapshot?.connected
            ? freeSearchConsoleSnapshot.rows.slice(0, 25).map((row: any) => ({
                keywordId: null,
                keyword: row.query,
                location: project.location ?? null,
                device: "desktop",
                resultUrl: row.page,
                resultTitle: row.query,
                domain: row.page ? new URL(row.page).hostname.replace(/^www\./, "") : null,
                rank: Math.max(1, Math.round(row.position)),
                resultType: "search_console",
                hasAds: false,
                hasMapPack: false,
                hasAiOverview: false,
                raw: {
                  source: "google-search-console",
                  clicks: row.clicks,
                  impressions: row.impressions,
                  ctr: row.ctr,
                  position: row.position,
                },
                observedAt: new Date().toISOString(),
              }))
            : [];
          const freeAudits = freePrimaryPage
            ? [
                {
                  target: "primary",
                  targetUrl: project.websiteUrl,
                  technicalScore: Math.max(
                    10,
                    100 -
                      freePrimaryPage.imageMissingAltCount * 3 -
                      (freePrimaryPage.hasCanonical ? 0 : 10) -
                      (freePrimaryPage.hasSchema ? 0 : 8),
                  ),
                  contentScore: Math.max(
                    10,
                    Math.min(100, Math.round((freePrimaryPage.wordCount || 0) / 20)),
                  ),
                  localScore: project.location ? 48 : 18,
                  performanceScore: freePrimaryPage.loadTimeMs
                    ? Math.max(10, 100 - Math.round(freePrimaryPage.loadTimeMs / 50))
                    : 40,
                  aiReadinessScore: freePrimaryPage.hasSchema ? 72 : 52,
                  summary:
                    "Free crawl fingerprint generated from the live website without a paid provider.",
                  raw: freePrimaryPage.raw,
                },
              ]
            : [];

          if (freeCrawlPages.length) {
            await deps.db.insert(deps.intelligenceCrawlPage).values(
              freeCrawlPages.map((page: any) => ({
                id: page.id,
                projectId: project.id,
                jobId: null,
                userId: project.userId,
                competitorId: page.competitorId ?? null,
                url: page.url,
                target: page.target,
                httpStatus: page.httpStatus ?? null,
                title: page.title ?? null,
                metaDescription: page.metaDescription ?? null,
                h1: page.h1 ?? null,
                h2Count: page.h2Count ?? 0,
                wordCount: page.wordCount ?? 0,
                internalLinkCount: page.internalLinkCount ?? 0,
                externalLinkCount: page.externalLinkCount ?? 0,
                imageMissingAltCount: page.imageMissingAltCount ?? 0,
                hasCanonical: page.hasCanonical ?? false,
                hasSchema: page.hasSchema ?? false,
                loadTimeMs: page.loadTimeMs ?? null,
                screenshotUrl: page.screenshotUrl ?? null,
                raw: JSON.stringify(page.raw ?? {}),
                observedAt: new Date(page.observedAt ?? new Date()),
              })),
            );
          }

          if (freeAudits.length) {
            await deps.db.insert(deps.intelligenceSeoAudit).values(
              freeAudits.map((audit: any) => ({
                id: deps.makeId("intelaudit"),
                projectId: project.id,
                jobId: null,
                userId: project.userId,
                target: audit.target ?? "primary",
                targetUrl: audit.targetUrl,
                technicalScore: audit.technicalScore ?? 0,
                contentScore: audit.contentScore ?? 0,
                localScore: audit.localScore ?? 0,
                performanceScore: audit.performanceScore ?? 0,
                aiReadinessScore: audit.aiReadinessScore ?? 0,
                summary: audit.summary ?? null,
                raw: JSON.stringify(audit.raw ?? {}),
              })),
            );
          }

          if (freeSearchConsoleSerpResults.length) {
            await deps.db.insert(deps.intelligenceSerpResult).values(
              freeSearchConsoleSerpResults.map((row: any) => ({
                id: deps.makeId("intelserp"),
                projectId: project.id,
                userId: project.userId,
                keywordId: null,
                keyword: row.keyword,
                location: row.location ?? null,
                device: row.device ?? null,
                resultUrl: row.resultUrl ?? null,
                resultTitle: row.resultTitle ?? null,
                domain: row.domain ?? null,
                rank: row.rank ?? null,
                resultType: row.resultType ?? "search_console",
                hasAds: row.hasAds ?? false,
                hasMapPack: row.hasMapPack ?? false,
                hasAiOverview: row.hasAiOverview ?? false,
                raw: JSON.stringify(row.raw ?? {}),
                observedAt: new Date(row.observedAt ?? new Date()),
              })),
            );
          }

          const freeRecommendations: Array<any> = [];
          if (freeSearchConsoleSnapshot?.connected) {
            freeRecommendations.push({
              title: "Use Search Console queries to close ranking gaps",
              description: `Google Search Console is connected to ${freeSearchConsoleSnapshot.property}. Focus on pages with high impressions and positions between 4 and 20.`,
              category: "owned_site_growth",
              priority: "high",
              impact: "high",
              effort: "low",
              sourceType: "search_console",
              sourceId: project.id,
            });
          } else {
            freeRecommendations.push({
              title: "Connect Google Search Console",
              description:
                "This is the best free owned-site data source. It unlocks click, impression, and query data for your own website.",
              category: "integration",
              priority: "medium",
              impact: "high",
              effort: "low",
              sourceType: "integration",
              sourceId: project.id,
            });
          }
          if (freeCrawlPages.length) {
            const primary = freeCrawlPages[0];
            freeRecommendations.push({
              title: "Tighten the free crawl fingerprints",
              description: `The live crawl found ${primary.wordCount || 0} words on the homepage and ${primary.imageMissingAltCount || 0} images missing alt text.`,
              category: "technical_seo",
              priority: "medium",
              impact: "medium",
              effort: "low",
              sourceType: "crawl",
              sourceId: project.id,
            });
          }
          if (freeRecommendations.length) {
            await deps.db.insert(deps.intelligenceRecommendation).values(
              freeRecommendations.map((row: any) => ({
                id: deps.makeId("intelrec"),
                projectId: project.id,
                userId: project.userId,
                title: row.title,
                description: row.description,
                category: row.category,
                priority: row.priority,
                impact: row.impact,
                effort: row.effort,
                sourceType: row.sourceType,
                sourceId: row.sourceId,
                status: "open",
              })),
            );
          }

        const walletReservation = await deps.reserveWalletUsage({
          userId: session.user.id,
          featureKey: "competitor_intelligence_scan",
          requestIdempotencyKey: `intelligence:${project.id}:${body.scanType}:${project.lastScanStatus ?? "draft"}`,
          sourceType: "competitor_intelligence_scan",
          sourceId: project.id,
          metadata: {
            projectId: project.id,
            scanType: body.scanType,
            websiteUrl: project.websiteUrl,
          },
        });

        const [job] = await deps.db
          .insert(deps.intelligenceJob)
          .values({
            id: deps.makeId("inteljob"),
            projectId: project.id,
            userId: project.userId,
            jobType: body.scanType,
            status: "queued",
            provider: "n8n",
            input: JSON.stringify({
              scanType: body.scanType,
              project,
              competitors,
              keywords,
              freeCrawlPages,
              freeAudits,
              freeSearchConsoleSnapshot,
              freeSearchConsoleSerpResults,
            }),
          })
          .returning();

        await deps.db
          .update(deps.intelligenceProject)
          .set({
            lastScanStatus: "queued",
            updatedAt: new Date(),
          })
          .where(eq(deps.intelligenceProject.id, project.id));

        let settled = false;
        try {
          const n8nResponse = await deps.sendN8nCompetitorIntelligence({
            project,
            job,
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            },
            competitors,
            keywords,
            freeCrawlPages,
            freeAudits,
            freeSearchConsoleSnapshot,
            freeSearchConsoleSerpResults,
            origin: url.origin,
            idempotencyKey: `intelligence:${job.id}`,
          });
          await deps.commitWalletReservation({
            reservationId: walletReservation.reservation.id,
            sourceId: job.id,
            metadata: { jobId: job.id, scanType: body.scanType },
          });
          settled = true;
          const [updatedJob] = await deps.db
            .update(deps.intelligenceJob)
            .set({
              status: "sent_to_n8n",
              output: JSON.stringify(n8nResponse),
              startedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceJob.id, job.id))
            .returning();
          await deps.db
            .update(deps.intelligenceProject)
            .set({
              lastScanStatus: "sent_to_n8n",
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceProject.id, project.id));
          return deps.json({ job: updatedJob, n8nStatus: "sent", n8nResponse }, 202);
        } catch (n8nError: any) {
          if (!settled) {
            await deps.releaseWalletReservation({
              reservationId: walletReservation.reservation.id,
              reason: n8nError.message,
              metadata: { jobId: job.id, scanType: body.scanType },
            }).catch((releaseError: any) => {
              console.error("Failed to release wallet reservation after intelligence scan failure:", releaseError);
            });
          }
          const [updatedJob] = await deps.db
            .update(deps.intelligenceJob)
            .set({
              status: "n8n_failed",
              error: n8nError.message,
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceJob.id, job.id))
            .returning();
          await deps.db
            .update(deps.intelligenceProject)
            .set({
              lastScanStatus: "n8n_failed",
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceProject.id, project.id));
          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "intelligence.scan.n8n_failed",
            entityType: "intelligence_job",
            entityId: job.id,
            message: `Competitor intelligence scan saved but n8n failed for ${project.businessName}`,
            level: "error",
            metadata: { error: n8nError.message },
          });
          return deps.json({ job: updatedJob, n8nStatus: "failed", error: n8nError.message }, 202);
        }
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (["recommendations", "reports"].includes(child ?? "") && request.method === "GET") {
        const overview = await deps.buildIntelligenceOverview(project);
        return deps.json(
          child === "reports"
            ? { reports: overview.reports }
            : { recommendations: overview.recommendations },
        );
      }
    }

    return deps.json({ error: "Not found" }, 404);
  }

  async function handleAdminIntelligence(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const detailMatch = url.pathname.match(/^\/api\/admin\/intelligence\/([^/]+)(?:\/([^/]+))?$/);

    if (url.pathname === "/api/admin/intelligence" && request.method === "GET") {
      const rows = await deps.db.query.intelligenceProject.findMany({
        orderBy: (intelligenceProject: any, { desc }: any) => [desc(intelligenceProject.updatedAt)],
      });
      const owners = await Promise.all(
        rows.map((row: any) => deps.db.query.user.findFirst({ where: eq(deps.user.id, row.userId) })),
      );
      const ownerById = new Map(owners.filter(Boolean).map((row: any) => [row!.id, row!]));
      return deps.json({
        projects: rows.map((row: any) => ({
          ...deps.publicProjectDto(row),
          owner: ownerById.get(row.userId)
            ? {
                id: ownerById.get(row.userId)!.id,
                name: ownerById.get(row.userId)!.name,
                email: ownerById.get(row.userId)!.email,
              }
            : null,
        })),
      });
    }

    if (detailMatch && !detailMatch[2] && request.method === "GET") {
      const project = await deps.getIntelligenceProjectForSession(
        decodeURIComponent(detailMatch[1]),
        session,
      );
      if (!project) return deps.json({ error: "Project not found" }, 404);
      return deps.json(await deps.buildIntelligenceOverview(project));
    }

    if (
      detailMatch &&
      decodeURIComponent(detailMatch[2] ?? "") === "scan" &&
      request.method === "POST"
    ) {
      try {
        const project = await deps.getIntelligenceProjectForSession(
          decodeURIComponent(detailMatch[1]),
          session,
        );
        if (!project) return deps.json({ error: "Project not found" }, 404);
        const body = await deps.parseBody(request, deps.intelligenceScanSchema);
        const [competitors, keywords, owner] = await Promise.all([
          deps.db.query.intelligenceCompetitor.findMany({
            where: eq(deps.intelligenceCompetitor.projectId, project.id),
          }),
          deps.db.query.intelligenceKeyword.findMany({
            where: eq(deps.intelligenceKeyword.projectId, project.id),
          }),
          deps.db.query.user.findFirst({ where: eq(deps.user.id, project.userId) }),
        ]);

        const scanTargets = [
          project.websiteUrl,
          ...competitors.map((competitor: any) => competitor.websiteUrl),
        ].slice(0, 4);
        const freeCrawlPages: Array<any> = [];
        for (const [index, targetUrl] of scanTargets.entries()) {
          try {
            const target = index === 0 ? "primary" : "competitor";
            const fingerprint = await deps.crawlSiteFingerprint(targetUrl, target);
            freeCrawlPages.push({
              ...fingerprint,
              projectId: project.id,
              jobId: null,
              userId: project.userId,
              competitorId: index === 0 ? null : (competitors[index - 1]?.id ?? null),
            });
          } catch (crawlError: any) {
            freeCrawlPages.push({
              id: deps.makeId("intelpage"),
              projectId: project.id,
              jobId: null,
              userId: project.userId,
              competitorId: index === 0 ? null : (competitors[index - 1]?.id ?? null),
              url: targetUrl,
              target: index === 0 ? "primary" : "competitor",
              httpStatus: null,
              title: null,
              metaDescription: null,
              h1: null,
              h2Count: 0,
              wordCount: 0,
              internalLinkCount: 0,
              externalLinkCount: 0,
              imageMissingAltCount: 0,
              hasCanonical: false,
              hasSchema: false,
              loadTimeMs: null,
              screenshotUrl: null,
              raw: {
                error: crawlError.message,
                sourceUrl: targetUrl,
                target: index === 0 ? "primary" : "competitor",
              },
              observedAt: new Date().toISOString(),
            });
          }
        }

        const freePrimaryPage = freeCrawlPages[0] ?? null;
        const freeSearchConsoleSnapshot = await deps.fetchGoogleSearchConsoleSnapshot(
          session.user.id,
          project.websiteUrl,
        ).catch(() => null);
        const freeSearchConsoleSerpResults = freeSearchConsoleSnapshot?.connected
          ? freeSearchConsoleSnapshot.rows.slice(0, 25).map((row: any) => ({
              keywordId: null,
              keyword: row.query,
              location: project.location ?? null,
              device: "desktop",
              resultUrl: row.page,
              resultTitle: row.query,
              domain: row.page ? new URL(row.page).hostname.replace(/^www\./, "") : null,
              rank: Math.max(1, Math.round(row.position)),
              resultType: "search_console",
              hasAds: false,
              hasMapPack: false,
              hasAiOverview: false,
              raw: {
                source: "google-search-console",
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
              },
              observedAt: new Date().toISOString(),
            }))
          : [];
        const freeAudits = freePrimaryPage
          ? [
              {
                target: "primary",
                targetUrl: project.websiteUrl,
                technicalScore: Math.max(
                  10,
                  100 -
                    freePrimaryPage.imageMissingAltCount * 3 -
                    (freePrimaryPage.hasCanonical ? 0 : 10) -
                    (freePrimaryPage.hasSchema ? 0 : 8),
                ),
                contentScore: Math.max(
                  10,
                  Math.min(100, Math.round((freePrimaryPage.wordCount || 0) / 20)),
                ),
                localScore: project.location ? 48 : 18,
                performanceScore: freePrimaryPage.loadTimeMs
                  ? Math.max(10, 100 - Math.round(freePrimaryPage.loadTimeMs / 50))
                  : 40,
                aiReadinessScore: freePrimaryPage.hasSchema ? 72 : 52,
                summary:
                  "Free crawl fingerprint generated from the live website without a paid provider.",
                raw: freePrimaryPage.raw,
              },
            ]
          : [];

        if (freeCrawlPages.length) {
          await deps.db.insert(deps.intelligenceCrawlPage).values(
            freeCrawlPages.map((page: any) => ({
              id: page.id,
              projectId: project.id,
              jobId: null,
              userId: project.userId,
              competitorId: page.competitorId ?? null,
              url: page.url,
              target: page.target,
              httpStatus: page.httpStatus ?? null,
              title: page.title ?? null,
              metaDescription: page.metaDescription ?? null,
              h1: page.h1 ?? null,
              h2Count: page.h2Count ?? 0,
              wordCount: page.wordCount ?? 0,
              internalLinkCount: page.internalLinkCount ?? 0,
              externalLinkCount: page.externalLinkCount ?? 0,
              imageMissingAltCount: page.imageMissingAltCount ?? 0,
              hasCanonical: page.hasCanonical ?? false,
              hasSchema: page.hasSchema ?? false,
              loadTimeMs: page.loadTimeMs ?? null,
              screenshotUrl: page.screenshotUrl ?? null,
              raw: JSON.stringify(page.raw ?? {}),
              observedAt: new Date(page.observedAt ?? new Date()),
            })),
          );
        }

        if (freeAudits.length) {
          await deps.db.insert(deps.intelligenceSeoAudit).values(
            freeAudits.map((audit: any) => ({
              id: deps.makeId("intelaudit"),
              projectId: project.id,
              jobId: null,
              userId: project.userId,
              target: audit.target ?? "primary",
              targetUrl: audit.targetUrl,
              technicalScore: audit.technicalScore ?? 0,
              contentScore: audit.contentScore ?? 0,
              localScore: audit.localScore ?? 0,
              performanceScore: audit.performanceScore ?? 0,
              aiReadinessScore: audit.aiReadinessScore ?? 0,
              summary: audit.summary ?? null,
              raw: JSON.stringify(audit.raw ?? {}),
            })),
          );
        }

        if (freeSearchConsoleSerpResults.length) {
          await deps.db.insert(deps.intelligenceSerpResult).values(
            freeSearchConsoleSerpResults.map((row: any) => ({
              id: deps.makeId("intelserp"),
              projectId: project.id,
              userId: project.userId,
              keywordId: null,
              keyword: row.keyword,
              location: row.location ?? null,
              device: row.device ?? null,
              resultUrl: row.resultUrl ?? null,
              resultTitle: row.resultTitle ?? null,
              domain: row.domain ?? null,
              rank: row.rank ?? null,
              resultType: row.resultType ?? "search_console",
              hasAds: row.hasAds ?? false,
              hasMapPack: row.hasMapPack ?? false,
              hasAiOverview: row.hasAiOverview ?? false,
              raw: JSON.stringify(row.raw ?? {}),
              observedAt: new Date(row.observedAt ?? new Date()),
            })),
          );
        }

        const freeRecommendations: Array<any> = [];
        if (freeSearchConsoleSnapshot?.connected) {
          freeRecommendations.push({
            title: "Use Search Console queries to close ranking gaps",
            description: `Google Search Console is connected to ${freeSearchConsoleSnapshot.property}. Focus on pages with high impressions and positions between 4 and 20.`,
            category: "owned_site_growth",
            priority: "high",
            impact: "high",
            effort: "low",
            sourceType: "search_console",
            sourceId: project.id,
          });
        } else {
          freeRecommendations.push({
            title: "Connect Google Search Console",
            description:
              "This is the best free owned-site data source. It unlocks click, impression, and query data for your own website.",
            category: "integration",
            priority: "medium",
            impact: "high",
            effort: "low",
            sourceType: "integration",
            sourceId: project.id,
          });
        }
        if (freeCrawlPages.length) {
          const primary = freeCrawlPages[0];
          freeRecommendations.push({
            title: "Tighten the free crawl fingerprints",
            description: `The live crawl found ${primary.wordCount || 0} words on the homepage and ${primary.imageMissingAltCount || 0} images missing alt text.`,
            category: "technical_seo",
            priority: "medium",
            impact: "medium",
            effort: "low",
            sourceType: "crawl",
            sourceId: project.id,
          });
        }
        if (freeRecommendations.length) {
          await deps.db.insert(deps.intelligenceRecommendation).values(
            freeRecommendations.map((row: any) => ({
              id: deps.makeId("intelrec"),
              projectId: project.id,
              userId: project.userId,
              title: row.title,
              description: row.description,
              category: row.category,
              priority: row.priority,
              impact: row.impact,
              effort: row.effort,
              sourceType: row.sourceType,
              sourceId: row.sourceId,
              status: "open",
            })),
          );
        }

        const [job] = await deps.db
          .insert(deps.intelligenceJob)
          .values({
            id: deps.makeId("inteljob"),
            projectId: project.id,
            userId: project.userId,
            jobType: body.scanType,
            status: "queued",
            provider: "n8n",
            input: JSON.stringify({
              scanType: body.scanType,
              project,
              competitors,
              keywords,
              freeCrawlPages,
              freeAudits,
              freeSearchConsoleSnapshot,
              freeSearchConsoleSerpResults,
            }),
          })
          .returning();

        const walletReservation = await deps.reserveWalletUsage({
          userId: session.user.id,
          featureKey: "competitor_intelligence_scan",
          requestIdempotencyKey: `intelligence:${project.id}:${body.scanType}:${project.lastScanStatus ?? "draft"}`,
          sourceType: "competitor_intelligence_scan",
          sourceId: project.id,
          metadata: {
            projectId: project.id,
            scanType: body.scanType,
            websiteUrl: project.websiteUrl,
          },
        });

        await deps.db
          .update(deps.intelligenceProject)
          .set({
            lastScanStatus: "queued",
            updatedAt: new Date(),
          })
          .where(eq(deps.intelligenceProject.id, project.id));

        let settled = false;
        try {
          const n8nResponse = await deps.sendN8nCompetitorIntelligence({
            project,
            job,
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            },
            competitors,
            keywords,
            freeCrawlPages,
            freeAudits,
            freeSearchConsoleSnapshot,
            freeSearchConsoleSerpResults,
            origin: url.origin,
            idempotencyKey: `intelligence:${job.id}`,
          });
          await deps.commitWalletReservation({
            reservationId: walletReservation.reservation.id,
            sourceId: job.id,
            metadata: { jobId: job.id, scanType: body.scanType },
          });
          settled = true;
          const [updatedJob] = await deps.db
            .update(deps.intelligenceJob)
            .set({
              status: "sent_to_n8n",
              output: JSON.stringify(n8nResponse),
              startedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceJob.id, job.id))
            .returning();
          await deps.db
            .update(deps.intelligenceProject)
            .set({
              lastScanStatus: "sent_to_n8n",
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceProject.id, project.id));
          return deps.json({ job: updatedJob, n8nStatus: "sent", n8nResponse }, 202);
        } catch (n8nError: any) {
          if (!settled) {
            await deps.releaseWalletReservation({
              reservationId: walletReservation.reservation.id,
              reason: n8nError.message,
              metadata: { jobId: job.id, scanType: body.scanType },
            }).catch((releaseError: any) => {
              console.error("Failed to release wallet reservation after intelligence scan failure:", releaseError);
            });
          }
          const [updatedJob] = await deps.db
            .update(deps.intelligenceJob)
            .set({
              status: "n8n_failed",
              error: n8nError.message,
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceJob.id, job.id))
            .returning();
          await deps.db
            .update(deps.intelligenceProject)
            .set({
              lastScanStatus: "n8n_failed",
              updatedAt: new Date(),
            })
            .where(eq(deps.intelligenceProject.id, project.id));
          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "intelligence.scan.n8n_failed",
            entityType: "intelligence_job",
            entityId: job.id,
            message: `Competitor intelligence scan saved but n8n failed for ${project.businessName}`,
            level: "error",
            metadata: { error: n8nError.message },
          });
          return deps.json({ job: updatedJob, n8nStatus: "failed", error: n8nError.message }, 202);
        }
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Not found" }, 404);
  }

  return {
    handleUserIntelligence,
    handleAdminIntelligence,
  };
}
