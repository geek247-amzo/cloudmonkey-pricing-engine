import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { db } from "../src/db";
import {
  user,
  website,
  websiteApprovalToken,
  websiteDesignOption,
  websiteDomain,
  websiteReviewRequest,
  websiteRuntimeServer,
  websiteStore,
} from "../src/db/schema";
import { createWebsiteHandlers } from "../src/lib/domain/websites";

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

function safeJsonParse(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function makeWebsiteHandlers(
  fetchIpv4Override: ((input: string | URL, init?: { timeoutMs?: number }) => Promise<Response>) | null = null,
) {
  const counters = new Map<string, number>();
  return createWebsiteHandlers({
    db,
    json: jsonResponse,
    parseBody: async (request, schema) => schema.parse(await request.json()),
    requireSession: async () => ({
      session: {
        user: {
          id: "customer-test-user",
          name: "Customer Tester",
          email: "customer@test.local",
          role: "customer",
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
    sendEmail: async () => undefined,
    makeId: (prefix: string) => {
      const current = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, current);
      return `${prefix}_${current}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    },
    safeJsonParse,
    addDays: (date: Date, days: number) => {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    },
    getWorkspaceSettings: async () => ({}),
    getUserWebsiteDetail: async (userId: string, websiteId: string) => {
      const site = await db.query.website.findFirst({
        where: eq(website.id, websiteId),
      });
      if (!site || site.userId !== userId) return null;
      const store = await db.query.websiteStore.findFirst({
        where: eq(websiteStore.websiteId, websiteId),
      });
      return {
        ...site,
        store,
        onboardingAnswers: safeJsonParse(site.onboardingAnswers),
        provisioningPlan: safeJsonParse(site.provisioningPlan),
      };
    },
    getUserWebsiteDashboardRows: async () => [],
    createWebsiteProjectFromOnboarding: async () => null,
    buildStoreDatabaseRecord: async () => null,
    buildWebsiteProvisioningPlan: async () => ({ steps: [] }),
    slugifySiteName: (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "site",
    sendN8nWebsiteDesignPreviews: async () => ({ ok: true, workflow: "test", options: [] }),
    getWebsiteDesignGenerationContext: () => ({}),
    createMedusaProductForWebsite: async () => null,
    storeProductCreateSchema: z.object({
      title: z.string().min(2),
      description: z.string().optional().default(""),
      sku: z.string().optional().default(""),
      price: z.coerce.number().min(0),
      inventoryQuantity: z.coerce.number().int().min(0).default(0),
      trackInventory: z.boolean().optional().default(true),
      status: z.enum(["draft", "active", "archived"]).default("active"),
    }),
    buildBasicWebsiteManifest: () => ({}),
    sendN8nBasicWebsiteBuild: async () => ({ buildManifest: {}, workflow: "basic" }),
    provisionWebsiteRuntime: async () => ({ ok: true }),
    fetchIpv4:
      fetchIpv4Override ??
      (async () =>
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })),
    createApprovalToken: () => ({
      raw: `approval_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
      hash: crypto.randomBytes(32).toString("hex"),
    }),
    website: website,
    websiteStore,
    websiteStoreDatabase: {} as any,
    websiteDomain,
    websitePluginInstall: {} as any,
    websiteDesignOption,
    websiteReviewRequest,
    websiteApprovalToken,
    websiteRuntimeServer,
    onboardingSubmission: {} as any,
    subscription: {} as any,
    servicePlan: {} as any,
    storeProduct: {} as any,
    storeProductVariant: {} as any,
    user,
    invoice: {} as any,
    readFile: async () => new Uint8Array(),
    stat: async () => ({ isFile: () => false } as any),
    mkdir: async () => undefined,
    writeFile: async () => undefined,
    WEBSITE_UPLOAD_DIR: "/tmp/cloudmonkey-websites",
    WEBSITE_MAX_DESIGN_BYTES: 5_000_000,
    ALLOWED_WEBSITE_DESIGN_TYPES: new Set(["image/png", "image/jpeg", "image/webp"]),
    sanitizeFileName: (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_"),
    isUploadedFile: (value: unknown): value is File =>
      Boolean(value) && typeof value === "object" && "arrayBuffer" in value,
    adminWebsiteProjectCreateSchema: z.object({
      userId: z.string().min(1),
      siteType: z.enum(["website", "ecommerce"]),
      planId: z.string().min(1),
      subscriptionId: z.string().optional().nullable(),
      githubRepo: z.string().optional().nullable(),
      businessName: z.string().min(2),
      businessDescription: z.string().optional().default(""),
      industry: z.string().optional().default(""),
      preferredSlug: z.string().optional().default(""),
      subscriptionStatus: z.enum(["pending", "active", "trialing"]).default("active"),
    }),
    adminDesignOptionSchema: z.object({
      styleLabel: z.string().min(1),
      notes: z.string().optional().default(""),
      imageUrl: z.string().optional().default(""),
    }),
    adminWebsiteDesignInputsSchema: z.object({
      designBrief: z.string().optional().default(""),
      contentNotes: z.string().optional().default(""),
      preferredStyle: z.string().optional().default(""),
      mustHaveSections: z.string().optional().default(""),
    }),
    userWebsiteCreateSchema: z.object({
      siteType: z.enum(["website", "ecommerce"]).default("website"),
      businessName: z.string().min(2).max(120),
      businessDescription: z.string().max(1000).optional().default(""),
      industry: z.string().max(120).optional().default(""),
      targetCustomers: z.string().max(500).optional().default(""),
      whatsapp: z.string().max(80).optional().default(""),
      email: z.union([z.string().email(), z.literal("")]).optional().default(""),
      preferredSlug: z.string().max(80).optional().default(""),
      productCount: z.coerce.number().int().min(0).max(100000).optional().default(0),
      needsInventory: z.boolean().optional().default(false),
      needsDelivery: z.boolean().optional().default(false),
      needsPos: z.boolean().optional().default(false),
    }),
    websiteOnboardingSchema: z.object({
      subscriptionId: z.string().min(1),
      answers: z.record(z.unknown()),
    }),
    runtimeServerSchema: z.object({}),
    websiteSchema: z.object({
      userId: z.string().min(1),
      domain: z.string().min(1),
      plan: z.string().min(1),
      status: z.string().default("online"),
      githubRepo: z.string().optional().nullable(),
    }),
  } as any);
}

async function requestJson(path: string, method: string, body?: JsonBody) {
  return new Request(`https://cloudmonkey.co.za${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("website handlers", () => {
  test("create and design selection transition a website, and missing design assets return 404", async () => {
    const handlers = makeWebsiteHandlers();
    const customerUserId = "customer-test-user";
    const now = new Date();
    const websiteName = `Website ${crypto.randomUUID().slice(0, 8)}`;
    let websiteId = "";
    let designOptionId = "";

    await db.insert(user).values({
      id: customerUserId,
      name: "Website Tester",
      email: `website-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const createResponse = await handlers.handleUserWebsites(
        await requestJson("/api/user/websites", "POST", {
          siteType: "website",
          businessName: websiteName,
          businessDescription: "Test site for extraction coverage",
          industry: "services",
          targetCustomers: "SMEs",
          whatsapp: "+27110000000",
          email: "hello@example.com",
          preferredSlug: "website-test",
          productCount: 0,
          needsInventory: false,
          needsDelivery: false,
          needsPos: false,
        }),
      );
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json()) as {
        id: string;
        temporaryDomain: string;
        status: string;
        siteType: string;
        plan: string;
      };
      websiteId = created.id;
      expect(created.siteType).toBe("website");
      expect(created.status).toBe("onboarding");
      expect(created.temporaryDomain.endsWith(".cloudmonkey.co.za")).toBe(true);

      const websiteRow = await db.query.website.findFirst({
        where: eq(website.id, websiteId),
      });
      expect(websiteRow?.businessName).toBe(websiteName);
      const storeRow = await db.query.websiteStore.findFirst({
        where: eq(websiteStore.websiteId, websiteId),
      });
      expect(storeRow?.siteType).toBe("website");
      const domainRow = await db.query.websiteDomain.findFirst({
        where: eq(websiteDomain.websiteId, websiteId),
      });
      expect(domainRow?.isPrimary).toBe(true);

      const publicMissingImage = await handlers.handlePublicWebsiteDesignImage(
        new Request(
          `https://cloudmonkey.co.za/api/public/website-design-options/design_missing/image`,
        ),
      );
      expect(publicMissingImage.status).toBe(404);

      designOptionId = `design_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      await db.insert(websiteDesignOption).values({
        id: designOptionId,
        websiteId,
        userId: customerUserId,
        styleLabel: "Concept A",
        imageUrl: null,
        thumbnailUrl: null,
        designManifest: JSON.stringify({
          storagePath: null,
          mimeType: "image/png",
          note: "missing storage path edge case",
        }),
        promptVersion: "test",
        createdAt: now,
      });
      await db
        .update(website)
        .set({ status: "awaiting_design_selection", aiGenerationStatus: "awaiting_design_selection" })
        .where(eq(website.id, websiteId));

      const selectionResponse = await handlers.handleUserWebsites(
        await requestJson(
          `/api/user/websites/${websiteId}/design-options/${designOptionId}/select`,
          "POST",
        ),
      );
      expect(selectionResponse.status).toBe(200);
      const selection = (await selectionResponse.json()) as {
        website: { selectedDesignOptionId: string; buildManifest: Record<string, unknown> };
      };
      expect(selection.website.selectedDesignOptionId).toBe(designOptionId);
      expect(selection.website.buildManifest.selectedDesignOptionId).toBe(designOptionId);

      const updatedWebsite = await db.query.website.findFirst({
        where: eq(website.id, websiteId),
      });
      expect(updatedWebsite?.selectedDesignOptionId).toBe(designOptionId);
      const updatedBuildManifest = safeJsonParse(updatedWebsite?.buildManifest ?? null) as
        | Record<string, unknown>
        | null;
      expect(updatedBuildManifest?.selectedDesignOptionId).toBe(designOptionId);
      expect(updatedBuildManifest?.baseRepo).toBe("cloudmonkey-website-template");
    } finally {
      if (designOptionId) {
      await db.delete(websiteDesignOption).where(eq(websiteDesignOption.id, designOptionId));
      }
      if (websiteId) {
        await db.delete(websiteDomain).where(eq(websiteDomain.websiteId, websiteId));
        await db.delete(websiteStore).where(eq(websiteStore.websiteId, websiteId));
        await db.delete(website).where(eq(website.id, websiteId));
      }
      await db.delete(user).where(eq(user.id, customerUserId));
    }
  });

  test("design selection is rejected until the site is ready for review", async () => {
    const handlers = makeWebsiteHandlers();
    const customerUserId = "customer-test-user";
    const now = new Date();
    const websiteName = `Blocked ${crypto.randomUUID().slice(0, 8)}`;
    const websiteId = `web_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const designOptionId = `design_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

    await db.insert(user).values({
      id: customerUserId,
      name: "Website Tester",
      email: `website-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await db.insert(website).values({
        id: websiteId,
        userId: customerUserId,
        domain: `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.cloudmonkey.co.za`,
        plan: "trial",
        status: "active",
        siteType: "website",
        name: websiteName,
        businessName: websiteName,
        temporaryDomain: `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.cloudmonkey.co.za`,
        primaryDomain: `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.cloudmonkey.co.za`,
        aiGenerationStatus: "ready",
        containerStatus: "running",
        trialStartedAt: now,
        trialEndsAt: now,
        graceEndsAt: now,
        terminationScheduledAt: now,
        createdAt: now,
        updatedAt: now,
      } as any);
      await db.insert(websiteStore).values({
        id: `store_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
        websiteId,
        userId: customerUserId,
        name: websiteName,
        siteType: "website",
        status: "active",
        paymentMode: "cloudmonkey_gateway",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(websiteDesignOption).values({
        id: designOptionId,
        websiteId,
        userId: customerUserId,
        styleLabel: "Blocked Concept",
        imageUrl: null,
        thumbnailUrl: null,
        designManifest: JSON.stringify({
          storagePath: null,
          mimeType: "image/png",
        }),
        promptVersion: "test",
        createdAt: now,
      });

      const selectionResponse = await handlers.handleUserWebsites(
        await requestJson(
          `/api/user/websites/${websiteId}/design-options/${designOptionId}/select`,
          "POST",
        ),
      );

      expect(selectionResponse.status).toBe(409);
      await expect(selectionResponse.json()).resolves.toMatchObject({
        error: "Design options can only be selected after the site is ready for review",
      });
    } finally {
      await db.delete(websiteDesignOption).where(eq(websiteDesignOption.id, designOptionId));
      await db.delete(websiteStore).where(eq(websiteStore.websiteId, websiteId));
      await db.delete(website).where(eq(website.id, websiteId));
      await db.delete(user).where(eq(user.id, customerUserId));
    }
  });

  test("re-triggering provisioning on an already provisioned site is rejected", async () => {
    const handlers = makeWebsiteHandlers();
    const customerUserId = "customer-test-user";
    const now = new Date();
    const websiteId = `web_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const websiteName = `Provisioned ${crypto.randomUUID().slice(0, 8)}`;

    await db.insert(user).values({
      id: customerUserId,
      name: "Website Tester",
      email: `website-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await db.insert(website).values({
        id: websiteId,
        userId: customerUserId,
        domain: `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.cloudmonkey.co.za`,
        plan: "trial",
        status: "active",
        siteType: "website",
        name: websiteName,
        businessName: websiteName,
        temporaryDomain: `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.cloudmonkey.co.za`,
        primaryDomain: `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.cloudmonkey.co.za`,
        aiGenerationStatus: "ready",
        containerStatus: "running",
        trialStartedAt: now,
        trialEndsAt: now,
        graceEndsAt: now,
        terminationScheduledAt: now,
        createdAt: now,
        updatedAt: now,
      } as any);
      await db.insert(websiteStore).values({
        id: `store_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
        websiteId,
        userId: customerUserId,
        name: websiteName,
        siteType: "website",
        status: "active",
        paymentMode: "cloudmonkey_gateway",
        createdAt: now,
        updatedAt: now,
      });

      const provisionResponse = await handlers.handleUserWebsites(
        await requestJson(`/api/user/websites/${websiteId}/provision`, "POST"),
      );

      expect(provisionResponse.status).toBe(409);
      await expect(provisionResponse.json()).resolves.toMatchObject({
        error: "Website runtime is already provisioned",
      });
    } finally {
      await db.delete(websiteStore).where(eq(websiteStore.websiteId, websiteId));
      await db.delete(website).where(eq(website.id, websiteId));
      await db.delete(user).where(eq(user.id, customerUserId));
    }
  });

  test("runtime health failure does not overwrite the last successful health timestamp", async () => {
    const staleAt = new Date("2026-06-01T08:30:00.000Z");
    const handlers = makeWebsiteHandlers(async () => {
      throw new Error("IPv4 fetch timed out after 15000ms");
    });
    const runtimeId = `runtime_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const now = new Date();

    await db.insert(websiteRuntimeServer).values({
      id: runtimeId,
      hostname: "runtime-test.local",
      provisionerUrl: "http://runtime-test.local:8787",
      provisionerSecret: "test-runtime-secret-12345",
      status: "active",
      activeSiteCount: 1,
      maxSiteCount: 40,
      lastHealthCheckAt: staleAt,
      createdAt: now,
      updatedAt: now,
    } as any);

    try {
      const response = await handlers.handleAdminWebsiteRuntimeServers(
        new Request(`https://cloudmonkey.co.za/api/admin/website-runtime-servers/${runtimeId}/health`, {
          method: "GET",
        }),
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: "IPv4 fetch timed out after 15000ms",
      });

      const row = await db.query.websiteRuntimeServer.findFirst({
        where: eq(websiteRuntimeServer.id, runtimeId),
      });
      expect(row?.lastHealthCheckAt?.toISOString()).toBe(staleAt.toISOString());
      expect(row?.lastError).toBe("IPv4 fetch timed out after 15000ms");
    } finally {
      await db.delete(websiteRuntimeServer).where(eq(websiteRuntimeServer.id, runtimeId));
    }
  });

  test("approval tokens cannot be replayed after consumption", async () => {
    const handlers = makeWebsiteHandlers();
    const customerUserId = "customer-test-user";
    const now = new Date();
    const websiteName = `Replay ${crypto.randomUUID().slice(0, 8)}`;
    let websiteId = "";
    let designOptionId = "";
    const rawToken = `approval_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await db.insert(user).values({
      id: customerUserId,
      name: "Website Tester",
      email: `website-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const createResponse = await handlers.handleUserWebsites(
        await requestJson("/api/user/websites", "POST", {
          siteType: "website",
          businessName: websiteName,
          businessDescription: "Replay test",
          industry: "services",
          targetCustomers: "SMEs",
          whatsapp: "+27110000000",
          email: "hello@example.com",
          preferredSlug: "website-replay",
        }),
      );
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json()) as { id: string };
      websiteId = created.id;

      designOptionId = `design_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      await db.insert(websiteDesignOption).values({
        id: designOptionId,
        websiteId,
        userId: customerUserId,
        styleLabel: "Concept Replay",
        imageUrl: null,
        thumbnailUrl: null,
        designManifest: JSON.stringify({
          storagePath: null,
          mimeType: "image/png",
        }),
        promptVersion: "test",
        createdAt: now,
      });
      await db.insert(websiteApprovalToken).values({
        id: `token_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
        websiteId,
        userId: customerUserId,
        tokenHash,
        actionType: "design_approval",
        targetId: designOptionId,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const approveResponse = await handlers.handlePublicWebsiteApproval(
        new Request(`https://cloudmonkey.co.za/api/public/website-approvals/${rawToken}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "approve", designOptionId }),
        }),
      );
      expect(approveResponse.status).toBe(200);

      const replayResponse = await handlers.handlePublicWebsiteApproval(
        new Request(`https://cloudmonkey.co.za/api/public/website-approvals/${rawToken}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "approve", designOptionId }),
        }),
      );
      expect(replayResponse.status).toBe(410);
      await expect(replayResponse.json()).resolves.toMatchObject({
        error: "Approval link has already been used",
      });
    } finally {
      if (designOptionId) {
        await db.delete(websiteDesignOption).where(eq(websiteDesignOption.id, designOptionId));
      }
      if (websiteId) {
        await db.delete(websiteApprovalToken).where(eq(websiteApprovalToken.websiteId, websiteId));
        await db.delete(websiteDomain).where(eq(websiteDomain.websiteId, websiteId));
        await db.delete(websiteStore).where(eq(websiteStore.websiteId, websiteId));
        await db.delete(website).where(eq(website.id, websiteId));
      }
      await db.delete(user).where(eq(user.id, customerUserId));
    }
  });
});
