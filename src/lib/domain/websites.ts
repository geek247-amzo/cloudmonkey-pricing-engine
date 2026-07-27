/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { isAdmin } from "../auth-guards";

const websiteApprovalResponseSchema = z.object({
  action: z.enum(["approve", "changes_requested"]).default("approve"),
  designOptionId: z.string().optional(),
  comments: z.string().max(2000).optional().default(""),
});

export const runtimeServerSchema = z.object({
  id: z.string().min(3).optional(),
  provider: z.string().default("manual"),
  providerInstanceId: z.string().optional().nullable(),
  profileName: z.string().default("geek247-compatible-docker-host"),
  hostname: z.string().min(1),
  publicIp: z.string().optional().nullable(),
  privateIp: z.string().optional().nullable(),
  provisionerUrl: z.string().url(),
  provisionerSecret: z.string().min(16),
  ingressHostname: z.string().optional().nullable(),
  ingressIp: z.string().optional().nullable(),
  dockerNetworkName: z.string().default("cm_runtime"),
  proxyMode: z.enum(["caddy", "traefik", "nginx"]).default("caddy"),
  region: z.string().optional().nullable(),
  status: z.enum(["planned", "active", "maintenance", "draining", "offline"]).default("active"),
  cpuTotal: z.coerce.number().int().min(0).default(0),
  memoryTotalMb: z.coerce.number().int().min(0).default(0),
  diskTotalGb: z.coerce.number().int().min(0).default(0),
  maxSiteCount: z.coerce.number().int().min(0).default(0),
});

export type WebsitesDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  sendEmail: (input: any) => Promise<void> | void;
  makeId: (prefix: string) => string;
  safeJsonParse: (value: string | null | undefined) => any;
  addDays: (date: Date, days: number) => Date;
  getWorkspaceSettings: () => Promise<any>;
  getUserWebsiteDetail: (
    userId: string,
    websiteId: string,
    actingAsAdmin?: boolean,
  ) => Promise<any>;
  getUserWebsiteDashboardRows: (userId: string) => Promise<any>;
  createWebsiteProjectFromOnboarding: (input: any) => Promise<any>;
  buildStoreDatabaseRecord: (input: { websiteId: string; storeId: string; userId: string }) => any;
  buildWebsiteProvisioningPlan: (input: any) => any;
  slugifySiteName: (value: string) => string;
  sendN8nWebsiteDesignPreviews: (input: any) => Promise<any>;
  getWebsiteDesignGenerationContext: (siteType: string) => any;
  createMedusaProductForWebsite: (site: any, body: any) => Promise<any>;
  storeProductCreateSchema: any;
  buildBasicWebsiteManifest: (site: any) => any;
  sendN8nBasicWebsiteBuild: (input: any) => Promise<any>;
  provisionWebsiteRuntime: (
    userId: string,
    websiteId: string,
    options?: { skipAgreementCheck?: boolean },
  ) => Promise<any>;
  callRuntimeProvisioner: <T>(runtime: any, pathname: string, body: unknown) => Promise<T>;
  fetchIpv4: (input: string | URL, init?: { timeoutMs?: number }) => Promise<Response>;
  reserveWalletUsage: (input: any) => Promise<any>;
  commitWalletReservation: (input: any) => Promise<any>;
  releaseWalletReservation: (input: any) => Promise<any>;
  createApprovalToken: () => { raw: string; hash: string };
  website: any;
  websiteStore: any;
  websiteStoreDatabase: any;
  websiteDomain: any;
  websitePluginInstall: any;
  websiteDesignOption: any;
  websiteReviewRequest: any;
  websiteApprovalToken: any;
  websiteRuntimeServer: any;
  onboardingSubmission: any;
  subscription: any;
  servicePlan: any;
  storeProduct: any;
  storeProductVariant: any;
  user: any;
  invoice: any;
  readFile: typeof readFile;
  stat: typeof stat;
  mkdir: typeof mkdir;
  writeFile: typeof writeFile;
  WEBSITE_UPLOAD_DIR: string;
  WEBSITE_MAX_DESIGN_BYTES: number;
  ALLOWED_WEBSITE_DESIGN_TYPES: Set<string>;
  sanitizeFileName: (value: string) => string;
  isUploadedFile: (value: unknown) => value is File;
  adminWebsiteProjectCreateSchema: any;
  adminDesignOptionSchema: any;
  adminWebsiteDesignInputsSchema: any;
  userWebsiteCreateSchema: any;
  websiteOnboardingSchema: any;
  runtimeServerSchema: any;
  websiteSchema: any;
};

function publicDesignImageUrl(id: string) {
  return `/api/public/website-design-options/${encodeURIComponent(id)}/image`;
}

function approvalPageUrl(token: string) {
  return `/website-approval/${encodeURIComponent(token)}`;
}

async function getWebsiteProject(deps: WebsitesDeps, id: string) {
  const site = await deps.db.query.website.findFirst({
    where: eq(deps.website.id, id),
    with: { user: true, subscription: { with: { plan: true, bundle: true } }, invoice: true },
  });
  if (!site) return null;
  const detail = await deps.getUserWebsiteDetail(site.userId, site.id);
  const submissions = await deps.db.query.onboardingSubmission.findMany({
    where: site.subscriptionId
      ? eq(deps.onboardingSubmission.subscriptionId, site.subscriptionId)
      : eq(deps.onboardingSubmission.userId, site.userId),
    orderBy: (onboardingSubmission: any, { desc }: any) => [desc(onboardingSubmission.createdAt)],
  });
  const reviews = await deps.db.query.websiteReviewRequest.findMany({
    where: eq(deps.websiteReviewRequest.websiteId, site.id),
    orderBy: (websiteReviewRequest: any, { desc }: any) => [desc(websiteReviewRequest.createdAt)],
  });
  return {
    ...detail,
    user: site.user,
    subscription: site.subscription,
    invoice: site.invoice,
    onboardingSubmissions: submissions.map((row: any) => ({
      ...row,
      answers: deps.safeJsonParse(row.answers),
    })),
    reviewRequests: reviews,
  };
}

export function createWebsiteHandlers(deps: WebsitesDeps) {
  async function handlePublicWebsiteDesignImage(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const designOptionId = decodeURIComponent(parts[3] ?? "");
    const option = designOptionId
      ? await deps.db.query.websiteDesignOption.findFirst({
          where: eq(deps.websiteDesignOption.id, designOptionId),
        })
      : null;
    const manifest = deps.safeJsonParse(option?.designManifest);
    const storagePath = manifest?.storagePath ? String(manifest.storagePath) : null;
    if (!option || !storagePath) return deps.json({ error: "Design image not found" }, 404);
    const fileStat = await deps.stat(storagePath).catch(() => null);
    if (!fileStat?.isFile()) return deps.json({ error: "Design image file not found" }, 404);
    return new Response(await deps.readFile(storagePath), {
      headers: {
        "Content-Type": String(manifest.mimeType || "application/octet-stream"),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  async function handlePublicWebsiteApproval(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = decodeURIComponent(url.pathname.split("/").filter(Boolean)[3] ?? "");
    if (!token) return deps.json({ error: "Approval token is required" }, 400);

    const tokenRow = await deps.db.query.websiteApprovalToken.findFirst({
      where: eq(
        deps.websiteApprovalToken.tokenHash,
        crypto.createHash("sha256").update(token).digest("hex"),
      ),
    });
    if (!tokenRow) return deps.json({ error: "Approval link is invalid" }, 404);
    if (tokenRow.usedAt) return deps.json({ error: "Approval link has already been used" }, 410);
    if (tokenRow.expiresAt.getTime() < Date.now())
      return deps.json({ error: "Approval link has expired" }, 410);

    const site = await deps.getUserWebsiteDetail(tokenRow.userId, tokenRow.websiteId);
    if (!site) return deps.json({ error: "Website not found" }, 404);

    if (request.method === "GET") {
      return deps.json({
        token: {
          actionType: tokenRow.actionType,
          targetId: tokenRow.targetId,
          expiresAt: tokenRow.expiresAt,
        },
        website: site,
      });
    }

    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const body = await deps.parseBody(request, websiteApprovalResponseSchema);
      const respondedAt = new Date();
      const review = await deps.db.query.websiteReviewRequest.findFirst({
        where: eq(deps.websiteReviewRequest.targetId, tokenRow.targetId ?? tokenRow.websiteId),
        orderBy: (websiteReviewRequest: any, { desc }: any) => [
          desc(websiteReviewRequest.createdAt),
        ],
      });

      if (tokenRow.actionType === "design_approval") {
        const designOptionId = body.designOptionId ?? tokenRow.targetId;
        if (!designOptionId) return deps.json({ error: "Design option is required" }, 400);
        const selectedOption = await deps.db.query.websiteDesignOption.findFirst({
          where: eq(deps.websiteDesignOption.id, designOptionId),
        });
        if (!selectedOption || selectedOption.websiteId !== tokenRow.websiteId) {
          return deps.json({ error: "Design option not found" }, 404);
        }
        if (body.action !== "approve") {
          if (review) {
            await deps.db
              .update(deps.websiteReviewRequest)
              .set({
                status: "changes_requested",
                response: body.comments || null,
                respondedAt,
                updatedAt: respondedAt,
              })
              .where(eq(deps.websiteReviewRequest.id, review.id));
          }
          await deps.db
            .update(deps.websiteApprovalToken)
            .set({ usedAt: respondedAt })
            .where(eq(deps.websiteApprovalToken.id, tokenRow.id));
          await deps.db
            .update(deps.website)
            .set({ status: "design_changes_requested", updatedAt: respondedAt })
            .where(eq(deps.website.id, tokenRow.websiteId));
          return deps.json({ ok: true, status: "changes_requested" });
        }

        const designManifest = deps.safeJsonParse(selectedOption.designManifest) ?? {};
        const buildManifest = {
          websiteId: tokenRow.websiteId,
          selectedDesignOptionId: designOptionId,
          styleLabel: selectedOption.styleLabel,
          designManifest,
          siteType: site.siteType,
          businessName: site.businessName,
          temporaryDomain: site.temporaryDomain,
          baseRepo:
            site.siteType === "ecommerce"
              ? "cloudmonkey-commerce-template"
              : "cloudmonkey-website-template",
          approvedAt: respondedAt.toISOString(),
        };
        await deps.db
          .update(deps.websiteDesignOption)
          .set({ selectedAt: null })
          .where(eq(deps.websiteDesignOption.websiteId, tokenRow.websiteId));
        await deps.db
          .update(deps.websiteDesignOption)
          .set({ selectedAt: respondedAt })
          .where(eq(deps.websiteDesignOption.id, designOptionId));
        await deps.db
          .update(deps.website)
          .set({
            selectedDesignOptionId: designOptionId,
            buildManifest: JSON.stringify(buildManifest),
            baseRepo: buildManifest.baseRepo,
            aiGenerationStatus: "design_selected",
            status: "design_selected",
            updatedAt: respondedAt,
          })
          .where(eq(deps.website.id, tokenRow.websiteId));
        if (review) {
          await deps.db
            .update(deps.websiteReviewRequest)
            .set({
              status: "approved",
              response: body.comments || null,
              respondedAt,
              updatedAt: respondedAt,
            })
            .where(eq(deps.websiteReviewRequest.id, review.id));
        }
        await deps.db
          .update(deps.websiteApprovalToken)
          .set({ usedAt: respondedAt })
          .where(eq(deps.websiteApprovalToken.id, tokenRow.id));
        await deps.recordAudit({
          actorUserId: tokenRow.userId,
          action: "website.design_approved",
          entityType: "website",
          entityId: tokenRow.websiteId,
          message: `Design approved for ${site.businessName || site.domain}`,
          metadata: { designOptionId },
        });
        return deps.json({ ok: true, status: "approved", designOptionId });
      }

      if (tokenRow.actionType === "staging_review") {
        const approved = body.action === "approve";
        if (approved && site.containerStatus !== "running") {
          return deps.json(
            { error: "Staging cannot be approved before the runtime is provisioned" },
            409,
          );
        }
        if (review) {
          await deps.db
            .update(deps.websiteReviewRequest)
            .set({
              status: approved ? "approved" : "changes_requested",
              response: body.comments || null,
              respondedAt,
              updatedAt: respondedAt,
            })
            .where(eq(deps.websiteReviewRequest.id, review.id));
        }
        await deps.db
          .update(deps.websiteApprovalToken)
          .set({ usedAt: respondedAt })
          .where(eq(deps.websiteApprovalToken.id, tokenRow.id));
        await deps.db
          .update(deps.website)
          .set({
            status: approved ? "staging_approved" : "staging_changes_requested",
            updatedAt: respondedAt,
          })
          .where(eq(deps.website.id, tokenRow.websiteId));
        await deps.recordAudit({
          actorUserId: tokenRow.userId,
          action: approved ? "website.staging_approved" : "website.staging_changes_requested",
          entityType: "website",
          entityId: tokenRow.websiteId,
          message: `Staging ${approved ? "approved" : "changes requested"} for ${site.businessName || site.domain}`,
          metadata: { comments: body.comments || null },
        });
        return deps.json({ ok: true, status: approved ? "approved" : "changes_requested" });
      }

      return deps.json({ error: "Unsupported approval action" }, 400);
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleUserWebsiteOnboarding(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const body = await deps.parseBody(request, deps.websiteOnboardingSchema);
      const activeSubscription = await deps.db.query.subscription.findFirst({
        where: eq(deps.subscription.id, body.subscriptionId),
        with: {
          plan: { with: { service: true, features: true } },
          bundle: { with: { features: true } },
        },
      });

      if (!activeSubscription || activeSubscription.userId !== session.user.id) {
        return deps.json({ error: "Subscription not found" }, 404);
      }
      if (
        !String(activeSubscription.planId ?? "").startsWith("web-") &&
        !String(activeSubscription.planId ?? "").startsWith("ecom-")
      ) {
        return deps.json({ error: "This wizard is only for website and ecommerce plans" }, 400);
      }
      if (!["active", "trialing"].includes(activeSubscription.status)) {
        return deps.json(
          { error: "Payment or trial activation is required before onboarding can be submitted" },
          402,
        );
      }

      const websiteProject = await deps.createWebsiteProjectFromOnboarding({
        userId: session.user.id,
        subscription: activeSubscription,
        invoiceId:
          (
            await deps.db.query.invoice.findFirst({
              where: eq(deps.invoice.id, activeSubscription.id),
            })
          )?.id ?? null,
        answers: body.answers,
      });

      const existingSubmission = await deps.db.query.onboardingSubmission.findFirst({
        where: eq(deps.onboardingSubmission.subscriptionId, activeSubscription.id),
      });
      const submittedAt = new Date();
      const submissionValues = {
        userId: session.user.id,
        subscriptionId: activeSubscription.id,
        productType: activeSubscription.planId ? "plan" : "bundle",
        productId:
          activeSubscription.planId ?? activeSubscription.bundleId ?? activeSubscription.id,
        status: "submitted",
        answers: JSON.stringify(body.answers),
        submittedAt,
        updatedAt: new Date(),
      };
      const savedSubmission = existingSubmission
        ? (
            await deps.db
              .update(deps.onboardingSubmission)
              .set(submissionValues)
              .where(eq(deps.onboardingSubmission.id, existingSubmission.id))
              .returning()
          )[0]
        : (
            await deps.db
              .insert(deps.onboardingSubmission)
              .values({
                id: deps.makeId("onboard"),
                ...submissionValues,
              })
              .returning()
          )[0];

      const settings = await deps.getWorkspaceSettings();
      const adminEmail = settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        deps
          .sendEmail({
            template: "onboarding_received",
            to: adminEmail,
            subject: `Website onboarding submitted: ${websiteProject.businessName || activeSubscription.name}`,
            data: {
              customerEmail: session.user.email,
              firstName: "team",
              subscriptionName: activeSubscription.name,
              primaryCtaText: "Open website projects",
              primaryCtaUrl: `${new URL(request.url).origin}/dashboard/website-projects`,
            },
            idempotencyKey: `website-onboarding:${websiteProject.id}:notification`,
          })
          .catch(() => undefined);
      }

      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "website_onboarding.submitted",
        entityType: "onboarding_submission",
        entityId: savedSubmission.id,
        message: `Website onboarding submitted for ${activeSubscription.name}`,
        metadata: { subscriptionId: activeSubscription.id, websiteId: websiteProject.id },
      });

      return deps.json(
        {
          submission: savedSubmission,
          website: {
            ...websiteProject,
            onboardingAnswers: deps.safeJsonParse(websiteProject.onboardingAnswers),
            provisioningPlan: deps.safeJsonParse(websiteProject.provisioningPlan),
          },
        },
        201,
      );
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleUserWebsites(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    const actingAsAdmin = isAdmin(session);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const websiteId = parts[3];
    const subresource = parts[4];
    if (!websiteId) {
      if (request.method === "POST") {
        try {
          const body = await deps.parseBody(request, deps.userWebsiteCreateSchema);
          const now = new Date();
          const trialEndsAt = deps.addDays(now, 7);
          const graceEndsAt = deps.addDays(trialEndsAt, 30);
          const baseSlug = deps.slugifySiteName(body.preferredSlug || body.businessName);
          const slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
          const temporaryDomain = `${slug}.cloudmonkey.co.za`;
          const websiteId = deps.makeId("web");
          const storeId = deps.makeId("store");
          const onboardingAnswers = {
            businessName: body.businessName,
            businessDescription: body.businessDescription,
            industry: body.industry,
            targetCustomers: body.targetCustomers,
            whatsapp: body.whatsapp,
            email: body.email || null,
            productCount: body.productCount,
            needsInventory: body.needsInventory,
            needsDelivery: body.needsDelivery,
            needsPos: body.needsPos,
          };
          const databaseRecord =
            body.siteType === "ecommerce"
              ? deps.buildStoreDatabaseRecord({
                  websiteId,
                  storeId,
                  userId: session.user.id,
                })
              : null;
          const provisioningPlan = deps.buildWebsiteProvisioningPlan({
            websiteId,
            storeId,
            temporaryDomain,
            siteType: body.siteType,
            database: databaseRecord ?? undefined,
          });
          const baseRepo =
            body.siteType === "ecommerce"
              ? "cloudmonkey-commerce-template"
              : "cloudmonkey-website-template";

          const [createdWebsite] = await deps.db
            .insert(deps.website)
            .values({
              id: websiteId,
              userId: session.user.id,
              domain: temporaryDomain,
              plan: "trial",
              status: "onboarding",
              siteType: body.siteType,
              name: body.businessName,
              businessName: body.businessName,
              businessDescription: body.businessDescription,
              industry: body.industry,
              temporaryDomain,
              primaryDomain: temporaryDomain,
              onboardingAnswers: JSON.stringify(onboardingAnswers),
              provisioningPlan: JSON.stringify(provisioningPlan),
              aiGenerationStatus: "not_started",
              containerStatus: "not_provisioned",
              baseRepo,
              trialStartedAt: now,
              trialEndsAt,
              graceEndsAt,
              terminationScheduledAt: graceEndsAt,
            })
            .returning();

          const [createdStore] = await deps.db
            .insert(deps.websiteStore)
            .values({
              id: storeId,
              websiteId,
              userId: session.user.id,
              name: body.businessName,
              siteType: body.siteType,
              status: "trial",
              paymentMode: "cloudmonkey_gateway",
              trialStartedAt: now,
              trialEndsAt,
              terminationScheduledAt: graceEndsAt,
            })
            .returning();

          const [createdDatabase] = databaseRecord
            ? await deps.db.insert(deps.websiteStoreDatabase).values(databaseRecord).returning()
            : [null];
          const [createdDomain] = await deps.db
            .insert(deps.websiteDomain)
            .values({
              id: deps.makeId("webdomain"),
              websiteId,
              userId: session.user.id,
              domain: temporaryDomain,
              type: "temporary",
              status: "reserved",
              dnsTarget: "wildcard.cloudmonkey.co.za",
              sslStatus: "pending",
              isPrimary: true,
            })
            .returning();

          if (body.siteType === "ecommerce") {
            await deps.db.insert(deps.websitePluginInstall).values([
              {
                id: deps.makeId("webplugin"),
                websiteId,
                storeId,
                userId: session.user.id,
                pluginKey: "cloudmonkey-paystack-gateway",
                status: "planned",
                config: JSON.stringify({ transactionFeeBps: 700, currency: "ZAR" }),
              },
              {
                id: deps.makeId("webplugin"),
                websiteId,
                storeId,
                userId: session.user.id,
                pluginKey: "basic-seo",
                status: "planned",
                config: JSON.stringify({ sitemap: true, robots: true }),
              },
            ]);
          }

          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "website.created",
            entityType: "website",
            entityId: websiteId,
            message: `${body.businessName} ${body.siteType === "ecommerce" ? "ecommerce runtime created with dedicated SQL container" : "static website runtime created"}`,
            metadata: {
              siteType: body.siteType,
              temporaryDomain,
              databaseContainer: databaseRecord?.containerName ?? null,
            },
          });

          return deps.json(
            {
              ...createdWebsite,
              onboardingAnswers,
              provisioningPlan,
              store: {
                ...createdStore,
                database: createdDatabase
                  ? {
                      id: createdDatabase.id,
                      engine: createdDatabase.engine,
                      version: createdDatabase.version,
                      host: createdDatabase.host,
                      port: createdDatabase.port,
                      databaseName: createdDatabase.databaseName,
                      username: createdDatabase.username,
                      containerName: createdDatabase.containerName,
                      volumeName: createdDatabase.volumeName,
                      status: createdDatabase.status,
                      backupStatus: createdDatabase.backupStatus,
                    }
                  : null,
              },
              domains: [createdDomain],
              plugins:
                body.siteType === "ecommerce"
                  ? [
                      { pluginKey: "cloudmonkey-paystack-gateway", status: "planned" },
                      { pluginKey: "basic-seo", status: "planned" },
                    ]
                  : [],
            },
            201,
          );
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (request.method !== "GET") return deps.json({ error: "Method not allowed" }, 405);
      return deps.json(await deps.getUserWebsiteDashboardRows(session.user.id));
    }

    if (request.method === "GET" && !subresource) {
      const detail = await deps.getUserWebsiteDetail(session.user.id, websiteId);
      if (!detail) return deps.json({ error: "Website not found" }, 404);
      return deps.json(detail);
    }

    if (subresource === "design-options" && parts[5] === "generate" && request.method === "POST") {
      try {
        const detail = await deps.getUserWebsiteDetail(session.user.id, websiteId);
        if (!detail?.store) return deps.json({ error: "Website store not found" }, 404);

        const walletReservation = await deps.reserveWalletUsage({
          userId: session.user.id,
          featureKey: "website_design_preview",
          requestIdempotencyKey: `website-design:${websiteId}:${detail.status}:${detail.updatedAt?.toISOString?.() ?? "initial"}`,
          sourceType: "website_design_generation",
          sourceId: websiteId,
          metadata: {
            siteType: detail.siteType,
            websiteId,
            state: detail.status,
          },
        });

        let settled = false;
        try {
          await deps.db
            .update(deps.website)
            .set({
              aiGenerationStatus: "design_generating",
              updatedAt: new Date(),
            })
            .where(eq(deps.website.id, websiteId));

          const n8nResult = await deps.sendN8nWebsiteDesignPreviews({
            website: {
              id: detail.id,
              siteType: detail.siteType,
              businessName: detail.businessName,
              name: detail.name,
              industry: detail.industry,
              domain: detail.domain,
              temporaryDomain: detail.temporaryDomain,
              status: detail.status,
            },
            onboardingAnswers: detail.onboardingAnswers,
            provisioningPlan: detail.provisioningPlan,
            generationContext: deps.getWebsiteDesignGenerationContext(detail.siteType),
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            },
            idempotencyKey: `website-design-${websiteId}-${Date.now()}`,
          });

          await deps.commitWalletReservation({
            reservationId: walletReservation.reservation.id,
            sourceId: websiteId,
            metadata: {
              workflow: (n8nResult as any).workflow,
              siteType: detail.siteType,
            },
          });
          settled = true;

          const options = Array.isArray((n8nResult as any).options)
            ? (n8nResult as any).options.slice(0, 4)
            : [];
          if (!options.length) throw new Error("No design options were returned");

          await deps.db
            .delete(deps.websiteDesignOption)
            .where(eq(deps.websiteDesignOption.websiteId, websiteId));
          const saved = await deps.db
            .insert(deps.websiteDesignOption)
            .values(
              options.map((option: any, index: number) => ({
                id: deps.makeId("design"),
                websiteId,
                userId: session.user.id,
                styleLabel: String(option.styleLabel || `Concept ${index + 1}`),
                imageUrl: option.imageUrl || null,
                thumbnailUrl: option.thumbnailUrl || option.imageUrl || null,
                designManifest: JSON.stringify(option.designManifest || option),
                promptVersion: String(
                  (n8nResult as any).workflow || "cloudmonkey-website-design-previews",
                ),
                tokenCost: Number(option.tokenCost || 0),
                imageCost: Number(option.imageCost || 0),
              })),
            )
            .returning();

          const [updatedSite] = await deps.db
            .update(deps.website)
            .set({
              aiGenerationStatus: "awaiting_design_selection",
              status: "awaiting_design_selection",
              updatedAt: new Date(),
            })
            .where(eq(deps.website.id, websiteId))
            .returning();

          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "website.design_options.generated",
            entityType: "website",
            entityId: websiteId,
            message: `Design previews generated for ${detail.businessName || detail.domain}`,
            metadata: { workflow: (n8nResult as any).workflow, optionCount: saved.length },
          });

          return deps.json({
            website: updatedSite,
            n8n: { ok: (n8nResult as any).ok ?? true, workflow: (n8nResult as any).workflow },
            designOptions: saved.map((option: any) => ({
              ...option,
              designManifest: deps.safeJsonParse(option.designManifest),
            })),
          });
        } catch (error: any) {
          if (!settled) {
            await deps
              .releaseWalletReservation({
                reservationId: walletReservation.reservation.id,
                reason: error.message,
                metadata: { websiteId, state: detail.status },
              })
              .catch((releaseError: any) => {
                console.error(
                  "Failed to release wallet reservation after design preview failure:",
                  releaseError,
                );
              });
          }
          throw error;
        }
      } catch (error: any) {
        console.error("Website design generation failed", {
          websiteId,
          message: error?.message ?? String(error),
        });
        await deps.db
          .update(deps.website)
          .set({
            aiGenerationStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(deps.website.id, websiteId));
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (subresource === "design-options" && parts[6] === "select" && request.method === "POST") {
      try {
        const designOptionId = parts[5];
        if (!designOptionId) return deps.json({ error: "Design option id is required" }, 400);

        const detail = await deps.getUserWebsiteDetail(session.user.id, websiteId, actingAsAdmin);
        if (!detail?.store) return deps.json({ error: "Website store not found" }, 404);
        const designSelectionReady =
          ["design_options_uploaded", "awaiting_design_selection"].includes(String(detail.status)) ||
          detail.aiGenerationStatus === "awaiting_design_selection";
        if (!designSelectionReady) {
          return deps.json(
            { error: "Design options can only be selected after the site is ready for review" },
            409,
          );
        }

        const selectedOption = await deps.db.query.websiteDesignOption.findFirst({
          where: eq(deps.websiteDesignOption.id, designOptionId),
        });
        if (
          !selectedOption ||
          selectedOption.websiteId !== websiteId ||
          (!actingAsAdmin && selectedOption.userId !== session.user.id)
        ) {
          return deps.json({ error: "Design option not found" }, 404);
        }

        const selectedAt = new Date();
        const designManifest = deps.safeJsonParse(selectedOption.designManifest) ?? {};
        const buildManifest = {
          websiteId,
          selectedDesignOptionId: designOptionId,
          styleLabel: selectedOption.styleLabel,
          designManifest,
          siteType: detail.siteType,
          businessName: detail.businessName,
          temporaryDomain: detail.temporaryDomain,
          baseRepo:
            detail.siteType === "ecommerce"
              ? "cloudmonkey-commerce-template"
              : "cloudmonkey-website-template",
          createdAt: selectedAt.toISOString(),
        };

        await deps.db
          .update(deps.websiteDesignOption)
          .set({ selectedAt: null })
          .where(eq(deps.websiteDesignOption.websiteId, websiteId));
        const [updatedOption] = await deps.db
          .update(deps.websiteDesignOption)
          .set({ selectedAt })
          .where(eq(deps.websiteDesignOption.id, designOptionId))
          .returning();
        const [updatedSite] = await deps.db
          .update(deps.website)
          .set({
            selectedDesignOptionId: designOptionId,
            buildManifest: JSON.stringify(buildManifest),
            baseRepo: buildManifest.baseRepo,
            aiGenerationStatus: "design_selected",
            status: "design_selected",
            updatedAt: selectedAt,
          })
          .where(eq(deps.website.id, websiteId))
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: actingAsAdmin
            ? "admin.website.design_option.select"
            : "website.design_option.selected",
          entityType: "website",
          entityId: websiteId,
          message: `${actingAsAdmin ? "Admin selected" : "Design option selected"} for ${detail.businessName || detail.domain}`,
          metadata: {
            designOptionId,
            styleLabel: selectedOption.styleLabel,
            targetUserId: selectedOption.userId,
            actedOnBehalfOf: actingAsAdmin,
          },
        });

        return deps.json({
          website: { ...updatedSite, buildManifest },
          designOption: { ...updatedOption, designManifest },
        });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (subresource === "provision" && request.method === "POST") {
      const detail = await deps.getUserWebsiteDetail(session.user.id, websiteId);
      if (
        detail &&
        (["active", "running"].includes(String(detail.status)) ||
          detail.containerStatus === "running")
      ) {
        return deps.json({ error: "Website runtime is already provisioned" }, 409);
      }
      return deps.json(
        { error: "CloudMonkey admins provision managed website runtimes after design approval" },
        403,
      );
    }

    if (subresource === "products" && request.method === "POST") {
      try {
        const detail = await deps.getUserWebsiteDetail(session.user.id, websiteId, actingAsAdmin);
        if (!detail?.store) return deps.json({ error: "Website store not found" }, 404);
        if (detail.siteType !== "ecommerce")
          return deps.json({ error: "Products are only available for ecommerce stores" }, 400);

        const body = await deps.parseBody(request, deps.storeProductCreateSchema);
        if (detail.containerStatus === "running" && detail.temporaryDomain) {
          const created = await deps.createMedusaProductForWebsite(detail, body);
          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "store.medusa_product.created",
            entityType: "website",
            entityId: websiteId,
            message: `${body.title} added to ${detail.businessName || detail.domain} through Medusa`,
            metadata: { websiteId, storeId: detail.store.id, engine: "medusa" },
          });
          return deps.json(created, 201);
        }

        const productId = deps.makeId("storeprod");
        const slug = `${deps.slugifySiteName(body.title)}-${crypto.randomBytes(2).toString("hex")}`;
        const priceCents = Math.round(body.price * 100);

        const [createdProduct] = await deps.db
          .insert(deps.storeProduct)
          .values({
            id: productId,
            storeId: detail.store.id,
            userId: detail.userId,
            title: body.title,
            slug,
            description: body.description,
            sku: body.sku || null,
            status: body.status,
            price: priceCents,
            trackInventory: body.trackInventory,
          })
          .returning();

        const [createdVariant] = await deps.db
          .insert(deps.storeProductVariant)
          .values({
            id: deps.makeId("storevar"),
            productId,
            storeId: detail.store.id,
            sku: body.sku || null,
            title: "Default",
            price: priceCents,
            inventoryQuantity: body.inventoryQuantity,
            status: body.status === "archived" ? "archived" : "active",
          })
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "store.product.created",
          entityType: "store_product",
          entityId: productId,
          message: `${body.title} added to ${detail.businessName || detail.domain}`,
          metadata: {
            websiteId,
            storeId: detail.store.id,
            actedOnBehalfOf: actingAsAdmin,
            targetUserId: detail.userId,
          },
        });

        return deps.json({ ...createdProduct, variants: [createdVariant] }, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.userWebsiteCreateSchema);
        const now = new Date();
        const trialEndsAt = deps.addDays(now, 7);
        const graceEndsAt = deps.addDays(trialEndsAt, 30);
        const baseSlug = deps.slugifySiteName(body.preferredSlug || body.businessName);
        const slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
        const temporaryDomain = `${slug}.cloudmonkey.co.za`;
        const websiteId = deps.makeId("web");
        const storeId = deps.makeId("store");
        const onboardingAnswers = {
          businessName: body.businessName,
          businessDescription: body.businessDescription,
          industry: body.industry,
          targetCustomers: body.targetCustomers,
          whatsapp: body.whatsapp,
          email: body.email || null,
          productCount: body.productCount,
          needsInventory: body.needsInventory,
          needsDelivery: body.needsDelivery,
          needsPos: body.needsPos,
        };
        const databaseRecord =
          body.siteType === "ecommerce"
            ? deps.buildStoreDatabaseRecord({
                websiteId,
                storeId,
                userId: session.user.id,
              })
            : null;
        const provisioningPlan = deps.buildWebsiteProvisioningPlan({
          websiteId,
          storeId,
          temporaryDomain,
          siteType: body.siteType,
          database: databaseRecord ?? undefined,
        });
        const baseRepo =
          body.siteType === "ecommerce"
            ? "cloudmonkey-commerce-template"
            : "cloudmonkey-website-template";

        const [createdWebsite] = await deps.db
          .insert(deps.website)
          .values({
            id: websiteId,
            userId: session.user.id,
            domain: temporaryDomain,
            plan: "trial",
            status: "onboarding",
            siteType: body.siteType,
            name: body.businessName,
            businessName: body.businessName,
            businessDescription: body.businessDescription,
            industry: body.industry,
            temporaryDomain,
            primaryDomain: temporaryDomain,
            onboardingAnswers: JSON.stringify(onboardingAnswers),
            provisioningPlan: JSON.stringify(provisioningPlan),
            aiGenerationStatus: "not_started",
            containerStatus: "not_provisioned",
            baseRepo,
            trialStartedAt: now,
            trialEndsAt,
            graceEndsAt,
            terminationScheduledAt: graceEndsAt,
          })
          .returning();

        const [createdStore] = await deps.db
          .insert(deps.websiteStore)
          .values({
            id: storeId,
            websiteId,
            userId: session.user.id,
            name: body.businessName,
            siteType: body.siteType,
            status: "trial",
            paymentMode: "cloudmonkey_gateway",
            trialStartedAt: now,
            trialEndsAt,
            terminationScheduledAt: graceEndsAt,
          })
          .returning();

        const [createdDatabase] = databaseRecord
          ? await deps.db.insert(deps.websiteStoreDatabase).values(databaseRecord).returning()
          : [null];
        const [createdDomain] = await deps.db
          .insert(deps.websiteDomain)
          .values({
            id: deps.makeId("webdomain"),
            websiteId,
            userId: session.user.id,
            domain: temporaryDomain,
            type: "temporary",
            status: "reserved",
            dnsTarget: "wildcard.cloudmonkey.co.za",
            sslStatus: "pending",
            isPrimary: true,
          })
          .returning();

        if (body.siteType === "ecommerce") {
          await deps.db.insert(deps.websitePluginInstall).values([
            {
              id: deps.makeId("webplugin"),
              websiteId,
              storeId,
              userId: session.user.id,
              pluginKey: "cloudmonkey-paystack-gateway",
              status: "planned",
              config: JSON.stringify({ transactionFeeBps: 700, currency: "ZAR" }),
            },
            {
              id: deps.makeId("webplugin"),
              websiteId,
              storeId,
              userId: session.user.id,
              pluginKey: "basic-seo",
              status: "planned",
              config: JSON.stringify({ sitemap: true, robots: true }),
            },
          ]);
        }

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website.created",
          entityType: "website",
          entityId: websiteId,
          message: `${body.businessName} ${body.siteType === "ecommerce" ? "ecommerce runtime created with dedicated SQL container" : "static website runtime created"}`,
          metadata: {
            siteType: body.siteType,
            temporaryDomain,
            databaseContainer: databaseRecord?.containerName ?? null,
          },
        });

        return deps.json(
          {
            ...createdWebsite,
            onboardingAnswers,
            provisioningPlan,
            store: {
              ...createdStore,
              database: createdDatabase
                ? {
                    id: createdDatabase.id,
                    engine: createdDatabase.engine,
                    version: createdDatabase.version,
                    host: createdDatabase.host,
                    port: createdDatabase.port,
                    databaseName: createdDatabase.databaseName,
                    username: createdDatabase.username,
                    containerName: createdDatabase.containerName,
                    volumeName: createdDatabase.volumeName,
                    status: createdDatabase.status,
                    backupStatus: createdDatabase.backupStatus,
                  }
                : null,
            },
            domains: [createdDomain],
            plugins:
              body.siteType === "ecommerce"
                ? [
                    { pluginKey: "cloudmonkey-paystack-gateway", status: "planned" },
                    { pluginKey: "basic-seo", status: "planned" },
                  ]
                : [],
          },
          201,
        );
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (request.method !== "GET") return deps.json({ error: "Method not allowed" }, 405);
    return deps.json(await deps.getUserWebsiteDashboardRows(session.user.id));
  }

  async function handleAdminWebsiteRuntimeServers(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;

    const url = new URL(request.url);
    const runtimeParts = url.pathname.split("/").filter(Boolean);
    const runtimeId = runtimeParts[3];
    const runtimeAction = runtimeParts[4];
    if (runtimeId && runtimeAction === "health" && request.method === "GET") {
      const runtime = await deps.db.query.websiteRuntimeServer.findFirst({
        where: eq(deps.websiteRuntimeServer.id, runtimeId),
      });
      if (!runtime) return deps.json({ error: "Runtime server not found" }, 404);
      if (!runtime.provisionerUrl)
        return deps.json({ error: "Runtime server has no provisioner URL" }, 400);
      try {
        const healthResponse = await deps.fetchIpv4(
          `${runtime.provisionerUrl.replace(/\/+$/, "")}/health`,
        );
        const text = await healthResponse.text();
        let payload: unknown = text;
        try {
          payload = JSON.parse(text);
        } catch {}
        await deps.db
          .update(deps.websiteRuntimeServer)
          .set({
            status: healthResponse.ok ? "active" : runtime.status,
            lastHealthCheckAt: new Date(),
            lastError: healthResponse.ok ? null : `Health check failed: ${healthResponse.status}`,
            updatedAt: new Date(),
          })
          .where(eq(deps.websiteRuntimeServer.id, runtime.id));
        return deps.json({ ok: healthResponse.ok, status: healthResponse.status, health: payload });
      } catch (error: any) {
        await deps.db
          .update(deps.websiteRuntimeServer)
          .set({
            lastError: error.message,
            updatedAt: new Date(),
          })
          .where(eq(deps.websiteRuntimeServer.id, runtime.id));
        return deps.json({ ok: false, error: error.message }, 502);
      }
    }

    if (request.method === "POST" || request.method === "PUT") {
      try {
        const body = await deps.parseBody(request, deps.runtimeServerSchema);
        const runtimeId = body.id ?? deps.makeId("runtime");
        const values = {
          ...body,
          id: runtimeId,
          provisionerSecret: body.provisionerSecret
            ? `enc:${body.provisionerSecret}`
            : body.provisionerSecret,
          updatedAt: new Date(),
        };
        const [saved] = await deps.db
          .insert(deps.websiteRuntimeServer)
          .values(values)
          .onConflictDoUpdate({
            target: deps.websiteRuntimeServer.id,
            set: {
              provider: values.provider,
              providerInstanceId: values.providerInstanceId,
              profileName: values.profileName,
              hostname: values.hostname,
              publicIp: values.publicIp,
              privateIp: values.privateIp,
              provisionerUrl: values.provisionerUrl,
              provisionerSecret: values.provisionerSecret,
              ingressHostname: values.ingressHostname,
              ingressIp: values.ingressIp,
              dockerNetworkName: values.dockerNetworkName,
              proxyMode: values.proxyMode,
              region: values.region,
              status: values.status,
              cpuTotal: values.cpuTotal,
              memoryTotalMb: values.memoryTotalMb,
              diskTotalGb: values.diskTotalGb,
              maxSiteCount: values.maxSiteCount,
              lastError: null,
              updatedAt: new Date(),
            },
          })
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website_runtime_server.saved",
          entityType: "website_runtime_server",
          entityId: saved.id,
          message: `Website runtime server saved: ${saved.hostname}`,
        });
        return deps.json(
          { ...saved, provisionerSecret: "********" },
          request.method === "POST" ? 201 : 200,
        );
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const rows = await deps.db.query.websiteRuntimeServer.findMany({
      orderBy: (websiteRuntimeServer: any, { desc }: any) => [desc(websiteRuntimeServer.updatedAt)],
    });
    return deps.json(
      rows.map((row: any) => ({
        ...row,
        provisionerSecret: row.provisionerSecret ? "********" : null,
      })),
    );
  }

  async function handleAdminWebsiteProjects(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;

    const url = new URL(request.url);
    const websiteId = url.pathname.split("/").filter(Boolean)[3];
    const action = url.pathname.split("/").filter(Boolean)[4];

    if (!websiteId && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.adminWebsiteProjectCreateSchema);
        const [targetUser, selectedPlan] = await Promise.all([
          deps.db.query.user.findFirst({ where: eq(deps.user.id, body.userId) }),
          deps.db.query.servicePlan.findFirst({
            where: eq(deps.servicePlan.id, body.planId),
            with: { service: true },
          }),
        ]);
        if (!targetUser) return deps.json({ error: "Customer not found" }, 404);
        if (!selectedPlan) return deps.json({ error: "Package not found" }, 404);

        const planSiteType = selectedPlan.id.startsWith("ecom-") ? "ecommerce" : "website";
        if (
          (body.siteType === "ecommerce" && !selectedPlan.id.startsWith("ecom-")) ||
          (body.siteType === "website" && !selectedPlan.id.startsWith("web-"))
        ) {
          return deps.json(
            {
              error: `Choose a ${body.siteType === "ecommerce" ? "ecommerce" : "website"} package for this project`,
            },
            400,
          );
        }

        let linkedSubscription: any = null;
        if (body.subscriptionId) {
          const existingSubscription = await deps.db.query.subscription.findFirst({
            where: eq(deps.subscription.id, body.subscriptionId),
            with: { plan: true },
          });
          if (!existingSubscription || existingSubscription.userId !== body.userId) {
            return deps.json({ error: "Subscription does not belong to this customer" }, 400);
          }
          if (existingSubscription.planId !== selectedPlan.id) {
            return deps.json(
              { error: "Selected subscription does not match the selected package" },
              400,
            );
          }
          const existingProject = await deps.db.query.website.findFirst({
            where: eq(deps.website.subscriptionId, existingSubscription.id),
          });
          if (existingProject)
            return deps.json({ error: "This subscription already has a website project" }, 409);
          linkedSubscription = existingSubscription;
        }

        const now = new Date();
        const interval = selectedPlan.unit?.toLowerCase().includes("year") ? "year" : "month";
        const subscriptionStatus =
          body.subscriptionStatus === "trialing" && !selectedPlan.trialDays
            ? "active"
            : body.subscriptionStatus;
        const currentPeriodEnd =
          subscriptionStatus === "trialing"
            ? deps.addDays(now, selectedPlan.trialDays ?? 7)
            : (() => {
                const end = new Date(now);
                end.setMonth(end.getMonth() + (interval === "year" ? 12 : 1));
                return end;
              })();

        if (!linkedSubscription) {
          const [createdSubscription] = await deps.db
            .insert(deps.subscription)
            .values({
              id: deps.makeId("sub"),
              userId: body.userId,
              planId: selectedPlan.id,
              name: selectedPlan.name,
              status: subscriptionStatus,
              amount: parseInt(selectedPlan.priceZar ?? "0", 10),
              interval,
              currentPeriodStart: now,
              currentPeriodEnd,
            })
            .returning();
          linkedSubscription = { ...createdSubscription, plan: selectedPlan };
        }

        const businessName = body.businessName.trim();
        const baseSlug = deps.slugifySiteName(body.preferredSlug || businessName);
        const slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
        const temporaryDomain = `${slug}.cloudmonkey.co.za`;
        const websiteIdNew = deps.makeId("web");
        const storeId = deps.makeId("store");
        const trialEndsAt =
          linkedSubscription.status === "trialing" ? linkedSubscription.currentPeriodEnd : null;
        const graceEndsAt = trialEndsAt ? deps.addDays(trialEndsAt, 30) : null;
        const databaseRecord =
          body.siteType === "ecommerce"
            ? deps.buildStoreDatabaseRecord({
                websiteId: websiteIdNew,
                storeId,
                userId: body.userId,
              })
            : null;
        const provisioningPlan = deps.buildWebsiteProvisioningPlan({
          websiteId: websiteIdNew,
          storeId,
          temporaryDomain,
          siteType: body.siteType,
          database: databaseRecord ?? undefined,
        });
        const baseRepo =
          body.siteType === "ecommerce"
            ? "cloudmonkey-commerce-template"
            : "cloudmonkey-website-template";

        const [createdWebsite] = await deps.db.transaction(async (tx: any) => {
          const [siteRow] = await tx
            .insert(deps.website)
            .values({
              id: websiteIdNew,
              userId: body.userId,
              subscriptionId: linkedSubscription.id,
              domain: temporaryDomain,
              plan: selectedPlan.id,
              status: "onboarding_shell",
              siteType: body.siteType,
              githubRepo: body.githubRepo || null,
              name: businessName,
              businessName,
              businessDescription: body.businessDescription || null,
              industry: body.industry || null,
              temporaryDomain,
              primaryDomain: temporaryDomain,
              onboardingAnswers: null,
              requirementManifest: JSON.stringify({
                source: "admin-created",
                siteType: body.siteType,
                planId: selectedPlan.id,
                subscriptionId: linkedSubscription.id,
                createdBy: session.user.id,
                createdAt: now.toISOString(),
              }),
              provisioningPlan: JSON.stringify(provisioningPlan),
              aiGenerationStatus: "manual_design_pending",
              containerStatus: "not_provisioned",
              baseRepo,
              trialStartedAt:
                linkedSubscription.status === "trialing"
                  ? linkedSubscription.currentPeriodStart
                  : null,
              trialEndsAt,
              graceEndsAt,
              terminationScheduledAt: graceEndsAt,
            })
            .returning();

          await tx.insert(deps.websiteStore).values({
            id: storeId,
            websiteId: websiteIdNew,
            userId: body.userId,
            name: businessName,
            siteType: body.siteType,
            status: linkedSubscription.status === "trialing" ? "trial" : "planned",
            paymentMode: "cloudmonkey_gateway",
            trialStartedAt:
              linkedSubscription.status === "trialing"
                ? linkedSubscription.currentPeriodStart
                : null,
            trialEndsAt,
            terminationScheduledAt: graceEndsAt,
          });
          if (databaseRecord) {
            await tx.insert(deps.websiteStoreDatabase).values(databaseRecord);
          }
          await tx.insert(deps.websiteDomain).values({
            id: deps.makeId("webdomain"),
            websiteId: websiteIdNew,
            userId: body.userId,
            domain: temporaryDomain,
            type: "temporary",
            status: "reserved",
            dnsTarget: "wildcard.cloudmonkey.co.za",
            sslStatus: "pending",
            isPrimary: true,
          });
          if (body.siteType === "ecommerce") {
            await tx.insert(deps.websitePluginInstall).values([
              {
                id: deps.makeId("webplugin"),
                websiteId: websiteIdNew,
                storeId,
                userId: body.userId,
                pluginKey: "cloudmonkey-paystack-gateway",
                status: "planned",
                config: JSON.stringify({ transactionFeeBps: 700, currency: "ZAR" }),
              },
              {
                id: deps.makeId("webplugin"),
                websiteId: websiteIdNew,
                storeId,
                userId: body.userId,
                pluginKey: "basic-seo",
                status: "planned",
                config: JSON.stringify({ sitemap: true, robots: true }),
              },
            ]);
          }
          return [siteRow];
        });

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website_project.admin_created",
          entityType: "website",
          entityId: createdWebsite.id,
          message: `Admin created ${planSiteType} project for ${targetUser.email}`,
          metadata: {
            userId: body.userId,
            subscriptionId: linkedSubscription.id,
            planId: selectedPlan.id,
            siteType: body.siteType,
            temporaryDomain,
            databaseContainer: databaseRecord?.containerName ?? null,
          },
        });

        const project = await getWebsiteProject(deps, createdWebsite.id);
        return deps.json(project ?? createdWebsite, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (!websiteId && request.method === "GET") {
      const sites = await deps.db.query.website.findMany({
        with: { user: true, subscription: { with: { plan: true, bundle: true } }, invoice: true },
        orderBy: (website: any, { desc }: any) => [desc(website.createdAt)],
      });
      const rows = sites
        .filter(
          (site: any) =>
            site.siteType === "ecommerce" ||
            site.siteType === "website" ||
            Boolean(site.subscriptionId),
        )
        .map((site: any) => ({
          ...site,
          onboardingAnswers: deps.safeJsonParse(site.onboardingAnswers),
          requirementManifest: deps.safeJsonParse(site.requirementManifest),
          buildManifest: deps.safeJsonParse(site.buildManifest),
          provisioningPlan: deps.safeJsonParse(site.provisioningPlan),
          user: site.user,
          subscription: site.subscription,
          invoice: site.invoice,
          nextAction: !site.onboardingAnswers
            ? "awaiting_onboarding"
            : !site.selectedDesignOptionId
              ? "upload_or_send_designs"
              : site.containerStatus === "not_provisioned"
                ? "provision_runtime"
                : site.status === "staging_approved"
                  ? "mark_live"
                  : "review_staging",
        }));
      return deps.json(rows);
    }

    if (!websiteId) return deps.json({ error: "Website id is required" }, 400);

    const site = await deps.db.query.website.findFirst({ where: eq(deps.website.id, websiteId) });
    if (!site) return deps.json({ error: "Website project not found" }, 404);

    if (request.method === "GET" && !action) {
      const project = await getWebsiteProject(deps, websiteId);
      return project ? deps.json(project) : deps.json({ error: "Website project not found" }, 404);
    }

    if (action === "terminate" && request.method === "POST") {
      const site = await deps.db.query.website.findFirst({
        where: eq(deps.website.id, websiteId),
      });
      if (!site) return deps.json({ error: "Website project not found" }, 404);

      const store = await deps.db.query.websiteStore.findFirst({
        where: eq(deps.websiteStore.websiteId, websiteId),
      });
      const database = store
        ? await deps.db.query.websiteStoreDatabase.findFirst({
            where: eq(deps.websiteStoreDatabase.storeId, store.id),
          })
        : null;
      const runtime = site.runtimeServerId
        ? await deps.db.query.websiteRuntimeServer.findFirst({
            where: eq(deps.websiteRuntimeServer.id, site.runtimeServerId),
          })
        : null;

      if (!runtime) {
        return deps.json({ error: "Website runtime server not found for termination" }, 404);
      }
      if (!runtime.provisionerUrl || !runtime.provisionerSecret) {
        return deps.json({ error: "Runtime server is missing termination credentials" }, 400);
      }

      const now = new Date();
      try {
        await deps.callRuntimeProvisioner(runtime, "/terminate", {
          website: {
            id: site.id,
            userId: site.userId,
            siteType: site.siteType,
            name: site.name,
            businessName: site.businessName || site.name,
            domain: site.domain,
            temporaryDomain: site.temporaryDomain,
            primaryDomain: site.primaryDomain,
            status: site.status,
            containerStatus: site.containerStatus,
          },
          store: store
            ? {
                id: store.id,
                websiteId: store.websiteId,
                userId: store.userId,
                name: store.name,
                siteType: store.siteType,
                status: store.status,
                paymentMode: store.paymentMode,
              }
            : null,
          database: database
            ? {
                id: database.id,
                websiteId: database.websiteId,
                storeId: database.storeId,
                engine: database.engine,
                version: database.version,
                databaseName: database.databaseName,
                username: database.username,
                containerName: database.containerName,
                volumeName: database.volumeName,
                status: database.status,
                backupStatus: database.backupStatus,
              }
            : null,
          runtime: {
            id: runtime.id,
            hostname: runtime.hostname,
            ingressHostname: runtime.ingressHostname,
            region: runtime.region,
            status: runtime.status,
            proxyMode: runtime.proxyMode,
          },
          cleanRoute: true,
        });

        await deps.db.transaction(async (tx) => {
          await tx
            .update(deps.website)
            .set({
              status: "terminated",
              containerStatus: "terminated",
              runtimeServerId: null,
              terminationScheduledAt: now,
              suspendedAt: now,
              updatedAt: now,
            })
            .where(eq(deps.website.id, websiteId));

          if (store) {
            await tx
              .update(deps.websiteStore)
              .set({
                status: "cancelled",
                terminationScheduledAt: now,
                updatedAt: now,
              })
              .where(eq(deps.websiteStore.id, store.id));
          }

          if (database) {
            await tx
              .delete(deps.websiteStoreDatabase)
              .where(eq(deps.websiteStoreDatabase.id, database.id));
          }

          await tx.delete(deps.websiteDomain).where(eq(deps.websiteDomain.websiteId, websiteId));
          await tx
            .delete(deps.websiteDesignOption)
            .where(eq(deps.websiteDesignOption.websiteId, websiteId));
          await tx
            .delete(deps.websiteReviewRequest)
            .where(eq(deps.websiteReviewRequest.websiteId, websiteId));
          await tx
            .delete(deps.websiteApprovalToken)
            .where(eq(deps.websiteApprovalToken.websiteId, websiteId));
          await tx
            .delete(deps.websitePluginInstall)
            .where(eq(deps.websitePluginInstall.websiteId, websiteId));
        });

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website.terminated",
          entityType: "website",
          entityId: websiteId,
          message: `Website terminated: ${site.businessName || site.domain}`,
          metadata: {
            runtimeServerId: runtime.id,
            siteType: site.siteType,
            storeId: store?.id ?? null,
            databaseId: database?.id ?? null,
            cleanedRoute: true,
          },
        });

        return deps.json({ ok: true, websiteId, runtimeServerId: runtime.id });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (action === "design-options" && request.method === "POST") {
      try {
        let styleLabel = "";
        let notes = "";
        let imageUrl = "";
        let uploadMeta: Record<string, unknown> = {};
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("multipart/form-data")) {
          const form = await request.formData();
          styleLabel = String(form.get("styleLabel") || form.get("label") || "Design option");
          notes = String(form.get("notes") || "");
          imageUrl = String(form.get("imageUrl") || "");
          const file = form.get("image");
          if (deps.isUploadedFile(file) && file.size > 0) {
            const mimeType = file.type || "application/octet-stream";
            if (!deps.ALLOWED_WEBSITE_DESIGN_TYPES.has(mimeType))
              return deps.json({ error: "Unsupported design image type" }, 400);
            if (file.size > deps.WEBSITE_MAX_DESIGN_BYTES)
              return deps.json({ error: "Design image is too large" }, 413);
            const optionId = deps.makeId("design");
            const extension =
              path.extname(file.name || "") || `.${mimeType.split("/")[1] || "bin"}`;
            const storageDir = path.join(deps.WEBSITE_UPLOAD_DIR, websiteId);
            await deps.mkdir(storageDir, { recursive: true });
            const storagePath = path.join(storageDir, `${optionId}${extension}`);
            await deps.writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
            uploadMeta = {
              optionId,
              storagePath,
              mimeType,
              fileName: deps.sanitizeFileName(file.name || `${optionId}${extension}`),
              sizeBytes: file.size,
            };
            imageUrl = publicDesignImageUrl(optionId);
          }
        } else {
          const body = await deps.parseBody(request, deps.adminDesignOptionSchema);
          styleLabel = body.styleLabel;
          notes = body.notes;
          imageUrl = body.imageUrl || "";
        }
        const designOptionId = String(uploadMeta.optionId || deps.makeId("design"));
        const [created] = await deps.db
          .insert(deps.websiteDesignOption)
          .values({
            id: designOptionId,
            websiteId,
            userId: site.userId,
            styleLabel,
            imageUrl: imageUrl || null,
            thumbnailUrl: imageUrl || null,
            designManifest: JSON.stringify({
              source: "admin_upload",
              notes,
              uploadedBy: session.user.id,
              ...uploadMeta,
            }),
            promptVersion: "admin-upload",
          })
          .returning();
        await deps.db
          .update(deps.website)
          .set({
            status: "design_options_uploaded",
            aiGenerationStatus: "awaiting_design_selection",
            updatedAt: new Date(),
          })
          .where(eq(deps.website.id, websiteId));
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website.design_option.uploaded",
          entityType: "website",
          entityId: websiteId,
          message: `Design option uploaded for ${site.businessName || site.domain}`,
          metadata: { designOptionId: created.id, styleLabel },
        });
        return deps.json(
          { ...created, designManifest: deps.safeJsonParse(created.designManifest) },
          201,
        );
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (action === "design-inputs" && request.method === "POST") {
      try {
        let body = deps.adminWebsiteDesignInputsSchema.parse({});
        const uploadedAssets: Array<Record<string, unknown>> = [];
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("multipart/form-data")) {
          const form = await request.formData();
          body = deps.adminWebsiteDesignInputsSchema.parse({
            designBrief: form.get("designBrief") || "",
            contentNotes: form.get("contentNotes") || "",
            preferredStyle: form.get("preferredStyle") || "",
            mustHaveSections: form.get("mustHaveSections") || "",
          });
          const files = form.getAll("assets");
          for (const file of files) {
            if (!deps.isUploadedFile(file) || file.size <= 0) continue;
            const mimeType = file.type || "application/octet-stream";
            if (!deps.ALLOWED_WEBSITE_DESIGN_TYPES.has(mimeType))
              return deps.json({ error: "Unsupported asset image type" }, 400);
            if (file.size > deps.WEBSITE_MAX_DESIGN_BYTES)
              return deps.json({ error: "Asset image is too large" }, 413);
            const assetId = deps.makeId("asset");
            const extension =
              path.extname(file.name || "") || `.${mimeType.split("/")[1] || "bin"}`;
            const storageDir = path.join(deps.WEBSITE_UPLOAD_DIR, websiteId, "assets");
            await deps.mkdir(storageDir, { recursive: true });
            const safeFileName = deps.sanitizeFileName(file.name || `${assetId}${extension}`);
            const storagePath = path.join(storageDir, `${assetId}${extension}`);
            await deps.writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
            uploadedAssets.push({
              id: assetId,
              storagePath,
              fileName: safeFileName,
              mimeType,
              sizeBytes: file.size,
              uploadedAt: new Date().toISOString(),
            });
          }
        } else {
          body = await deps.parseBody(request, deps.adminWebsiteDesignInputsSchema);
        }

        const currentRequirement =
          (deps.safeJsonParse(site.requirementManifest) as Record<string, any> | null) ?? {};
        const existingInputs =
          currentRequirement.designInputs &&
          typeof currentRequirement.designInputs === "object" &&
          !Array.isArray(currentRequirement.designInputs)
            ? currentRequirement.designInputs
            : {};
        const existingAssets = Array.isArray(existingInputs.assets) ? existingInputs.assets : [];
        const designInputs = {
          ...existingInputs,
          ...body,
          assets: [...existingAssets, ...uploadedAssets],
          updatedBy: session.user.id,
          updatedAt: new Date().toISOString(),
        };
        const [updated] = await deps.db
          .update(deps.website)
          .set({
            requirementManifest: JSON.stringify({ ...currentRequirement, designInputs }),
            updatedAt: new Date(),
          })
          .where(eq(deps.website.id, websiteId))
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website.design_inputs.saved",
          entityType: "website",
          entityId: websiteId,
          message: `Design inputs saved for ${site.businessName || site.domain}`,
          metadata: { uploadedAssetCount: uploadedAssets.length },
        });
        return deps.json({
          ok: true,
          designInputs,
          requirementManifest: deps.safeJsonParse(updated.requirementManifest),
        });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (action === "send-design-email" && request.method === "POST") {
      try {
        const project = await getWebsiteProject(deps, websiteId);
        if (!project?.designOptions?.length)
          return deps.json({ error: "Upload at least one design option first" }, 400);
        const { raw, hash } = deps.createApprovalToken();
        const expiresAt = deps.addDays(new Date(), 14);
        const reviewId = deps.makeId("review");
        await deps.db.insert(deps.websiteReviewRequest).values({
          id: reviewId,
          websiteId,
          userId: site.userId,
          type: "design",
          status: "sent",
          targetId: websiteId,
          message: "Design choices sent for approval",
        });
        await deps.db.insert(deps.websiteApprovalToken).values({
          id: deps.makeId("webtoken"),
          websiteId,
          userId: site.userId,
          tokenHash: hash,
          actionType: "design_approval",
          targetId: websiteId,
          expiresAt,
        });
        await deps.db
          .update(deps.website)
          .set({ status: "design_review_sent", updatedAt: new Date() })
          .where(eq(deps.website.id, websiteId));
        const approvalUrl = approvalPageUrl(raw);
        await deps.sendEmail({
          template: "generic",
          to: project.user?.email ?? "",
          subject: `Choose your CloudMonkey website design`,
          data: {
            firstName: project.user?.name,
            emailTitle: "Your website designs are ready",
            emailIntro:
              "Please review the design concepts and approve the direction CloudMonkey should build.",
            emailBody: `Project: ${site.businessName || site.domain}\nTemporary domain: ${site.temporaryDomain || site.domain}`,
            primaryCtaText: "Review designs",
            primaryCtaUrl: approvalUrl,
          },
          idempotencyKey: `website:${websiteId}:design-review:${reviewId}`,
        });
        await deps.db
          .update(deps.websiteReviewRequest)
          .set({ sentAt: new Date(), updatedAt: new Date() })
          .where(eq(deps.websiteReviewRequest.id, reviewId));
        return deps.json({ ok: true, approvalUrl, expiresAt });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (action === "provision" && request.method === "POST") {
      try {
        let siteForProvision = site;
        if (!siteForProvision.buildManifest && !siteForProvision.githubRepo) {
          const storeRow = await deps.db.query.websiteStore.findFirst({
            where: eq(deps.websiteStore.websiteId, websiteId),
          });
          if (!storeRow)
            return deps.json({ error: "Website store must exist before provisioning" }, 404);
          const databaseRow = await deps.db.query.websiteStoreDatabase.findFirst({
            where: eq(deps.websiteStoreDatabase.storeId, storeRow.id),
          });
          const basicManifest = deps.buildBasicWebsiteManifest(siteForProvision);
          const walletReservation = await deps.reserveWalletUsage({
            userId: session.user.id,
            featureKey: "website_basic_build",
            requestIdempotencyKey: `website-basic-build:${websiteId}:${siteForProvision.status}`,
            sourceType: "website_basic_runtime_build",
            sourceId: websiteId,
            metadata: {
              siteType: siteForProvision.siteType,
              websiteId,
              state: siteForProvision.status,
            },
          });

          let settled = false;
          try {
            const n8nResult = await deps.sendN8nBasicWebsiteBuild({
              site: siteForProvision,
              store: storeRow,
              database: databaseRow,
              buildManifest: basicManifest,
              idempotencyKey: `website-basic-runtime-${websiteId}-${Date.now()}`,
            });
            await deps.commitWalletReservation({
              reservationId: walletReservation.reservation.id,
              sourceId: websiteId,
              metadata: { workflow: n8nResult.workflow, siteType: siteForProvision.siteType },
            });
            settled = true;
            const [updatedSite] = await deps.db
              .update(deps.website)
              .set({
                buildManifest: JSON.stringify(n8nResult.buildManifest),
                status:
                  siteForProvision.status === "onboarding_shell" ||
                  siteForProvision.status === "design_options_uploaded" ||
                  siteForProvision.status === "design_review_sent"
                    ? "awaiting_provisioning"
                    : siteForProvision.status,
                aiGenerationStatus: "basic_runtime_ready",
                updatedAt: new Date(),
              })
              .where(eq(deps.website.id, websiteId))
              .returning();
            siteForProvision = updatedSite;
            await deps.recordAudit({
              actorUserId: session.user.id,
              action: "website.basic_runtime_manifest.created",
              entityType: "website",
              entityId: websiteId,
              message: `Basic runtime manifest created for ${site.businessName || site.domain}`,
              metadata: {
                workflow: n8nResult.workflow,
                warning: n8nResult.warning ?? null,
                designApproved: Boolean(site.selectedDesignOptionId),
              },
            });
          } catch (error: any) {
            if (!settled) {
              await deps
                .releaseWalletReservation({
                  reservationId: walletReservation.reservation.id,
                  reason: error.message,
                  metadata: { websiteId, state: siteForProvision.status },
                })
                .catch((releaseError: any) => {
                  console.error(
                    "Failed to release wallet reservation after basic runtime failure:",
                    releaseError,
                  );
                });
            }
            throw error;
          }
        }
        const result = await deps.provisionWebsiteRuntime(site.userId, websiteId, {
          skipAgreementCheck: true,
        });
        return deps.json(result);
      } catch (error: any) {
        console.error("Admin website provisioning failed", {
          websiteId,
          message: error?.message ?? String(error),
        });
        await deps.db
          .update(deps.website)
          .set({ containerStatus: "failed", status: "failed", updatedAt: new Date() })
          .where(eq(deps.website.id, websiteId));
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (action === "send-staging-email" && request.method === "POST") {
      try {
        const project = await getWebsiteProject(deps, websiteId);
        if (!project) return deps.json({ error: "Website project not found" }, 404);
        if (site.containerStatus !== "running") {
          return deps.json({ error: "Provision the runtime before sending staging review" }, 409);
        }
        const { raw, hash } = deps.createApprovalToken();
        const expiresAt = deps.addDays(new Date(), 14);
        const reviewId = deps.makeId("review");
        await deps.db.insert(deps.websiteReviewRequest).values({
          id: reviewId,
          websiteId,
          userId: site.userId,
          type: "staging",
          status: "sent",
          targetId: websiteId,
          message: "Staging review sent",
        });
        await deps.db.insert(deps.websiteApprovalToken).values({
          id: deps.makeId("webtoken"),
          websiteId,
          userId: site.userId,
          tokenHash: hash,
          actionType: "staging_review",
          targetId: websiteId,
          expiresAt,
        });
        await deps.db
          .update(deps.website)
          .set({ status: "staging_review_sent", updatedAt: new Date() })
          .where(eq(deps.website.id, websiteId));
        const approvalUrl = approvalPageUrl(raw);
        await deps.sendEmail({
          template: "generic",
          to: project.user?.email ?? "",
          subject: `Review your CloudMonkey staging site`,
          data: {
            firstName: project.user?.name,
            emailTitle: "Your staging site is ready",
            emailIntro: "Please review the staging site and either approve it or send edit notes.",
            emailBody: `Project: ${site.businessName || site.domain}\nStaging URL: https://${site.primaryDomain || site.temporaryDomain || site.domain}`,
            primaryCtaText: "Review staging",
            primaryCtaUrl: approvalUrl,
          },
          idempotencyKey: `website:${websiteId}:staging-review:${reviewId}`,
        });
        await deps.db
          .update(deps.websiteReviewRequest)
          .set({ sentAt: new Date(), updatedAt: new Date() })
          .where(eq(deps.websiteReviewRequest.id, reviewId));
        return deps.json({ ok: true, approvalUrl, expiresAt });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (action === "mark-live" && request.method === "POST") {
      const now = new Date();
      const [updated] = await deps.db
        .update(deps.website)
        .set({
          status: "active",
          containerStatus:
            site.containerStatus === "not_provisioned" ? "running" : site.containerStatus,
          updatedAt: now,
        })
        .where(eq(deps.website.id, websiteId))
        .returning();
      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "website.marked_live",
        entityType: "website",
        entityId: websiteId,
        message: `Website marked live: ${site.businessName || site.domain}`,
      });
      return deps.json(updated);
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminWebsites(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.websiteSchema);
        const [created] = await deps.db
          .insert(deps.website)
          .values({ id: deps.makeId("site"), ...body })
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "website.created",
          entityType: "website",
          entityId: created.id,
          message: `Website added: ${created.domain}`,
        });
        return deps.json(created, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }
    const rows = await deps.db.query.website.findMany({
      with: { user: true },
      orderBy: (website: any, { desc }: any) => [desc(website.createdAt)],
    });
    return deps.json(rows);
  }

  return {
    handlePublicWebsiteDesignImage,
    handlePublicWebsiteApproval,
    handleUserWebsiteOnboarding,
    handleUserWebsites,
    handleAdminWebsiteRuntimeServers,
    handleAdminWebsiteProjects,
    handleAdminWebsites,
  };
}
