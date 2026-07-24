import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { db } from "../src/db";
import {
  intelligenceProject,
  intelligenceCompetitor,
  intelligenceKeyword,
  intelligenceJob,
  intelligenceCrawlPage,
  intelligenceSeoAudit,
  intelligenceSerpResult,
  intelligenceRecommendation,
  intelligenceReport,
  user,
} from "../src/db/schema";
import {
  buildIntelligenceProjectUpdateSchema,
  createIntelligenceHandlers,
} from "../src/lib/domain/intelligence";

type JsonBody = Record<string, unknown>;

function jsonResponse(data: unknown, init?: ResponseInit | number) {
  const normalized =
    typeof init === "number" ? { status: init } : init ?? { status: 200 };
  return new Response(JSON.stringify(data), {
    ...normalized,
    headers: {
      "content-type": "application/json",
      ...(normalized.headers ?? {}),
    },
  });
}

function makeIntelligenceHandlers(sessionUserId = "owner-test-user", role: "customer" | "admin" = "customer") {
  const counters = new Map<string, number>();
  return createIntelligenceHandlers({
    db,
    json: jsonResponse,
    parseBody: async (request, schema) => schema.parse(await request.json()),
    requireIntelligenceAccess: async () => ({
      session: {
        user: {
          id: sessionUserId,
          name: role === "admin" ? "Admin Tester" : "Owner Tester",
          email: `${role}-${crypto.randomUUID().slice(0, 8)}@example.com`,
          role,
        },
      },
    }),
    requireAdmin: async () => ({
      session: {
        user: {
          id: "admin-test-user",
          name: "Admin Tester",
          email: "admin@test.local",
          role: "admin",
        },
      },
    }),
    recordAudit: async () => undefined,
    makeId: (prefix) => {
      const current = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, current);
      return `${prefix}_${current}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    },
    safeJsonParse: (value) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    publicProjectDto: (row) => ({ ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }),
    publicReportDto: (row) => ({ ...row, reportJson: row.reportJson ? JSON.parse(row.reportJson) : null }),
    getIntelligenceProjectForSession: async (projectId, session) => {
      const project = await db.query.intelligenceProject.findFirst({
        where: eq(intelligenceProject.id, projectId),
      });
      if (!project) return null;
      if (project.userId !== session.user.id && session.user.role !== "admin") return null;
      return project;
    },
    buildIntelligenceOverview: async (project) => ({
      project: { id: project.id },
      recommendations: [],
      reports: [],
    }),
    sendN8nCompetitorIntelligence: async () => {
      throw new Error("sendN8nCompetitorIntelligence should not be called in this test");
    },
    crawlSiteFingerprint: async () => ({
      id: `page_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
      url: "https://example.com",
      target: "primary",
      httpStatus: 200,
      title: "Example",
      metaDescription: "Example",
      h1: "Example",
      h2Count: 0,
      wordCount: 120,
      internalLinkCount: 0,
      externalLinkCount: 0,
      imageMissingAltCount: 0,
      hasCanonical: true,
      hasSchema: true,
      loadTimeMs: 50,
      screenshotUrl: null,
      raw: {},
      observedAt: new Date().toISOString(),
    }),
    fetchGoogleSearchConsoleSnapshot: async () => ({
      connected: false,
      property: null,
      rows: [],
    }),
    intelligenceProject,
    intelligenceCompetitor,
    intelligenceKeyword,
    intelligenceKeywordRanking: {} as any,
    intelligenceJob,
    intelligenceCrawlPage,
    intelligenceSeoAudit,
    intelligenceSerpResult,
    intelligencePageIssue: {} as any,
    intelligenceContentGap: {} as any,
    intelligenceRecommendation,
    intelligenceReport,
    user,
    intelligenceProjectCreateSchema: z.object({
      name: z.string().optional(),
      businessName: z.string().min(2),
      websiteUrl: z.string().url(),
      location: z.string().optional().nullable(),
      industry: z.string().optional().nullable(),
      servicesProducts: z.string().optional().nullable(),
      targetKeywords: z.array(z.string()).optional().default([]),
      competitors: z.array(z.object({ websiteUrl: z.string().url() })).optional().default([]),
    }),
    intelligenceCompetitorSchema: z.object({
      name: z.string().optional().nullable(),
      websiteUrl: z.string().url(),
      competitorType: z.enum(["manual", "organic", "local", "ad", "content", "pricing"]).optional().default("manual"),
    }),
    intelligenceKeywordSchema: z.object({
      keyword: z.string().min(2),
      location: z.string().optional().nullable(),
      device: z.enum(["desktop", "mobile"]).default("desktop"),
      intent: z.string().optional().nullable(),
      priority: z.enum(["low", "medium", "high", "very_high"]).default("medium"),
    }),
    intelligenceScanSchema: z.object({
      scanType: z.enum(["full", "serp", "crawl", "ai_report"]).default("full"),
    }),
    buildIntelligenceProjectUpdateSchema,
  });
}

async function requestJson(path: string, method: string, body?: JsonBody) {
  return new Request(`https://cloudmonkey.co.za${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("intelligence handlers", () => {
  test("update schema accepts partial edits and rejects unknown fields", () => {
    const schema = buildIntelligenceProjectUpdateSchema();

    expect(
      schema.safeParse({
        businessName: "Updated Business",
        websiteUrl: "https://example.com",
      }).success,
    ).toBe(true);

    const invalid = schema.safeParse({
      businessName: "Updated Business",
      unexpectedField: true,
    });

    expect(invalid.success).toBe(false);
  });

  test("a different user cannot read another project's intelligence detail", async () => {
    const ownerUserId = `owner_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const otherUserId = `other_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const projectId = `proj_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const handlers = makeIntelligenceHandlers(otherUserId);

    await db.insert(user).values([
      {
        id: ownerUserId,
        name: "Owner",
        email: `owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: otherUserId,
        name: "Other",
        email: `other-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await db.insert(intelligenceProject).values({
      id: projectId,
      userId: ownerUserId,
      name: "Owner project",
      businessName: "Owner Business",
      websiteUrl: "https://owner.example.com",
      location: null,
      industry: null,
      servicesProducts: null,
      status: "draft",
      metadata: JSON.stringify({}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const response = await handlers.handleUserIntelligence(
        await requestJson(`/api/user/intelligence/${projectId}`, "GET"),
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Project not found");
    } finally {
      await db.delete(intelligenceRecommendation).where(eq(intelligenceRecommendation.projectId, projectId));
      await db.delete(intelligenceReport).where(eq(intelligenceReport.projectId, projectId));
      await db.delete(intelligenceSerpResult).where(eq(intelligenceSerpResult.projectId, projectId));
      await db.delete(intelligenceSeoAudit).where(eq(intelligenceSeoAudit.projectId, projectId));
      await db.delete(intelligenceCrawlPage).where(eq(intelligenceCrawlPage.projectId, projectId));
      await db.delete(intelligenceJob).where(eq(intelligenceJob.projectId, projectId));
      await db.delete(intelligenceKeyword).where(eq(intelligenceKeyword.projectId, projectId));
      await db.delete(intelligenceCompetitor).where(eq(intelligenceCompetitor.projectId, projectId));
      await db.delete(intelligenceProject).where(eq(intelligenceProject.id, projectId));
      await db.delete(user).where(eq(user.id, ownerUserId));
      await db.delete(user).where(eq(user.id, otherUserId));
    }
  });

  test("admin scan rejects malformed payloads before queuing work", async () => {
    const adminUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const ownerUserId = `owner_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const projectId = `proj_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const handlers = makeIntelligenceHandlers(adminUserId, "admin");

    await db.insert(user).values([
      {
        id: adminUserId,
        name: "Admin",
        email: `admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "admin",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: ownerUserId,
        name: "Owner",
        email: `owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await db.insert(intelligenceProject).values({
      id: projectId,
      userId: ownerUserId,
      name: "Owner project",
      businessName: "Owner Business",
      websiteUrl: "https://owner.example.com",
      location: "Cape Town",
      industry: "services",
      servicesProducts: "Consulting",
      status: "draft",
      metadata: JSON.stringify({}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const response = await handlers.handleAdminIntelligence(
        await requestJson(`/api/admin/intelligence/${projectId}/scan`, "POST", {
          scanType: "broken",
        }),
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    } finally {
      await db.delete(intelligenceRecommendation).where(eq(intelligenceRecommendation.projectId, projectId));
      await db.delete(intelligenceReport).where(eq(intelligenceReport.projectId, projectId));
      await db.delete(intelligenceSerpResult).where(eq(intelligenceSerpResult.projectId, projectId));
      await db.delete(intelligenceSeoAudit).where(eq(intelligenceSeoAudit.projectId, projectId));
      await db.delete(intelligenceCrawlPage).where(eq(intelligenceCrawlPage.projectId, projectId));
      await db.delete(intelligenceJob).where(eq(intelligenceJob.projectId, projectId));
      await db.delete(intelligenceKeyword).where(eq(intelligenceKeyword.projectId, projectId));
      await db.delete(intelligenceCompetitor).where(eq(intelligenceCompetitor.projectId, projectId));
      await db.delete(intelligenceProject).where(eq(intelligenceProject.id, projectId));
      await db.delete(user).where(eq(user.id, ownerUserId));
      await db.delete(user).where(eq(user.id, adminUserId));
    }
  });
});
