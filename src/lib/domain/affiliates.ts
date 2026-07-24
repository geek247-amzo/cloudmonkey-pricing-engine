/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  affiliate,
  affiliateCommission,
  affiliateFraudFlag,
  affiliatePayout,
  affiliateReferral,
  user,
} from "../../db/schema";

export type AffiliateDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  makeId: (prefix: string) => string;
  encryptSecret: (value: string) => string;
  decryptSecret: (value: string) => string;
  affiliate: any;
  affiliateCommission: any;
  affiliateFraudFlag: any;
  affiliatePayout: any;
  affiliateReferral: any;
  user: any;
};

const affiliateTierRules = {
  starter: {
    label: "Starter Affiliate",
    commissionType: "once_off",
    commissionRateBps: 1000,
    recurringDurationMonths: 1,
  },
  growth: {
    label: "Growth Partner",
    commissionType: "recurring",
    commissionRateBps: 2000,
    recurringDurationMonths: 6,
  },
  strategic: {
    label: "Strategic Partner",
    commissionType: "recurring",
    commissionRateBps: 3500,
    recurringDurationMonths: 12,
  },
} as const;

type AffiliateTier = keyof typeof affiliateTierRules;

const affiliateApplicationSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  socialLinks: z.string().optional().nullable(),
  affiliateType: z
    .enum([
      "individual",
      "agency",
      "msp",
      "it_consultant",
      "web_designer_developer",
      "existing_customer",
      "other",
    ])
    .default("individual"),
  expectedReferralMethod: z.string().min(1),
  payoutMethod: z.string().optional().default("manual_eft"),
  payoutDetails: z.string().optional().nullable(),
  termsAccepted: z.boolean().refine(Boolean, "Affiliate terms must be accepted"),
});

const affiliateClickSchema = z.object({
  referralCode: z.string().min(2),
  visitorId: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  landingPage: z.string().optional().nullable(),
});

const affiliateProfileSchema = z.object({
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  socialLinks: z.string().optional().nullable(),
  expectedReferralMethod: z.string().optional().nullable(),
  payoutMethod: z.string().optional().default("manual_eft"),
  payoutDetails: z.string().optional().nullable(),
});

const adminAffiliateUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "suspended", "active", "inactive"]).optional(),
  tier: z.enum(["starter", "growth", "strategic"]).optional(),
  commissionType: z.enum(["once_off", "recurring"]).optional(),
  commissionRateBps: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  recurringDurationMonths: z.coerce.number().int().min(1).max(120).optional().nullable(),
  notes: z.string().optional().nullable(),
  payoutMethod: z.string().optional().nullable(),
  payoutDetails: z.string().optional().nullable(),
});

const commissionActionSchema = z.object({
  status: z.enum(["approved", "payable", "paid", "cancelled", "reversed"]),
  commissionAmount: z.coerce.number().int().nonnegative().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
});

const payoutMarkPaidSchema = z.object({
  affiliateId: z.string().min(1),
  commissionIds: z.array(z.string().min(1)).min(1),
  payoutReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const manualAttributionSchema = z.object({
  affiliateId: z.string().min(1),
  customerId: z.string().min(1),
  reason: z.string().min(3),
});

function normalizeAffiliateTier(value: string | null | undefined): AffiliateTier {
  return value === "growth" || value === "strategic" ? value : "starter";
}

function getAffiliateTierRule(value: string | null | undefined) {
  return affiliateTierRules[normalizeAffiliateTier(value)];
}

function generateReferralCode(nameOrEmail: string) {
  const base =
    nameOrEmail
      .toLowerCase()
      .replace(/@.*$/, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "partner";
  return `${base}${crypto.randomBytes(3).toString("hex")}`;
}

function buildReferralLink(origin: string, code: string) {
  return `${origin}/auth/sign-up?ref=${encodeURIComponent(code)}`;
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function canGenerateCommission(status: string | null | undefined) {
  return status === "approved" || status === "active";
}

function sanitizeAffiliate(deps: AffiliateDeps, row: typeof affiliate.$inferSelect, origin: string, includePayout = false) {
  let payoutDetails: string | undefined;
  if (includePayout && row.payoutDetails) {
    try {
      payoutDetails = deps.decryptSecret(row.payoutDetails);
    } catch {
      payoutDetails = undefined;
    }
  }
  return {
    ...row,
    payoutDetails,
    referralLink: buildReferralLink(origin, row.referralCode),
  };
}

async function generateUniqueReferralCode(deps: AffiliateDeps, nameOrEmail: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code =
      attempt === 0
        ? generateReferralCode(nameOrEmail)
        : `${generateReferralCode(nameOrEmail)}${crypto.randomBytes(attempt + 1).toString("hex")}`;
    const existing = await deps.db.query.affiliate.findFirst({
      where: eq(deps.affiliate.referralCode, code),
    });
    if (!existing) return code;
  }
  return `${generateReferralCode(nameOrEmail)}${crypto.randomBytes(2).toString("hex")}`;
}

async function createFraudFlag(
  deps: AffiliateDeps,
  input: {
    affiliateId?: string | null;
    referralId?: string | null;
    customerId?: string | null;
    flagType: string;
    detail: string;
    severity?: string;
    metadata?: unknown;
  },
) {
  await deps.db.insert(deps.affiliateFraudFlag).values({
    id: deps.makeId("affflag"),
    affiliateId: input.affiliateId ?? null,
    referralId: input.referralId ?? null,
    customerId: input.customerId ?? null,
    flagType: input.flagType,
    severity: input.severity ?? "review",
    detail: input.detail,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

function affiliateSummary(input: {
  referrals: Array<typeof affiliateReferral.$inferSelect>;
  commissions: Array<typeof affiliateCommission.$inferSelect>;
}) {
  const signups = input.referrals.filter((row) => !!row.customerId || !!row.signedUpAt).length;
  const payingCustomers = new Set(input.commissions.map((row) => row.customerId)).size;
  const totalClicks = input.referrals.length;
  return {
    totalClicks,
    totalLeads: input.referrals.filter((row) => row.leadId).length,
    totalSignups: signups,
    totalPayingCustomers: payingCustomers,
    conversionRate: totalClicks ? Math.round((signups / totalClicks) * 1000) / 10 : 0,
    pendingCommission: input.commissions
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + row.commissionAmount, 0),
    approvedCommission: input.commissions
      .filter((row) => row.status === "approved" || row.status === "payable")
      .reduce((sum, row) => sum + row.commissionAmount, 0),
    paidCommission: input.commissions
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + row.commissionAmount, 0),
    cancelledCommission: input.commissions
      .filter((row) => row.status === "cancelled" || row.status === "reversed")
      .reduce((sum, row) => sum + row.commissionAmount, 0),
  };
}

function groupByAffiliate<T extends { affiliateId: string }>(rows: Array<T>) {
  return rows.reduce((map, row) => {
    const current = map.get(row.affiliateId) ?? [];
    current.push(row);
    map.set(row.affiliateId, current);
    return map;
  }, new Map<string, Array<T>>());
}

export async function attributeSignupToAffiliate(
  deps: AffiliateDeps,
  input: {
    userId: string;
    email: string;
    referralCode?: string | null;
    visitorId?: string | null;
    request: Request;
  },
) {
  const code = input.referralCode?.trim();
  if (!code) return null;

  const affiliateRow = await deps.db.query.affiliate.findFirst({
    where: eq(deps.affiliate.referralCode, code),
  });
  if (!affiliateRow) return null;

  const now = new Date();
  const clickedAfter = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const candidateRows = await deps.db.query.affiliateReferral.findMany({
    where: eq(deps.affiliateReferral.referralCode, code),
    orderBy: (affiliateReferral: any, { desc }: any) => [desc(affiliateReferral.clickedAt)],
  });
  const click = candidateRows.find((row) => {
    if (row.customerId) return false;
    return new Date(row.clickedAt).getTime() >= clickedAfter;
  });
  const customerRow = await deps.db.query.user.findFirst({
    where: eq(deps.user.id, input.userId),
  });
  if (customerRow) {
    const userCreatedAt = new Date(customerRow.createdAt).getTime();
    if (click && userCreatedAt < new Date(click.clickedAt).getTime()) return null;
    if (!click && now.getTime() - userCreatedAt > 10 * 60 * 1000) return null;
  }

  const rule = getAffiliateTierRule(affiliateRow.tier);
  const [referral] = click
    ? await deps.db
        .update(deps.affiliateReferral)
        .set({
          customerId: input.userId,
          status: "signup",
          signedUpAt: now,
          tierAtSignup: affiliateRow.tier,
          commissionTypeAtSignup: affiliateRow.commissionType ?? rule.commissionType,
          commissionRateBpsAtSignup: affiliateRow.commissionRateBps ?? rule.commissionRateBps,
          recurringDurationMonthsAtSignup:
            affiliateRow.recurringDurationMonths ?? rule.recurringDurationMonths,
        })
        .where(eq(deps.affiliateReferral.id, click.id))
        .returning()
    : await deps.db
        .insert(deps.affiliateReferral)
        .values({
          id: deps.makeId("affref"),
          affiliateId: affiliateRow.id,
          referralCode: code,
          visitorId: input.visitorId ?? null,
          customerId: input.userId,
          sourceUrl: null,
          landingPage: new URL(input.request.url).pathname,
          ipAddress: getClientIp(input.request),
          userAgent: input.request.headers.get("user-agent"),
          attributionType: "signup",
          status: "signup",
          signedUpAt: now,
          tierAtSignup: affiliateRow.tier,
          commissionTypeAtSignup: affiliateRow.commissionType ?? rule.commissionType,
          commissionRateBpsAtSignup: affiliateRow.commissionRateBps ?? rule.commissionRateBps,
          recurringDurationMonthsAtSignup:
            affiliateRow.recurringDurationMonths ?? rule.recurringDurationMonths,
        })
        .returning();

  if (
    affiliateRow.email.toLowerCase() === input.email.toLowerCase() ||
    affiliateRow.userId === input.userId
  ) {
    await createFraudFlag(deps, {
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.userId,
      flagType: "self_referral",
      severity: "high",
      detail: "Affiliate and referred customer appear to be the same person.",
    });
  }

  if (referral.ipAddress && referral.ipAddress === getClientIp(input.request)) {
    await createFraudFlag(deps, {
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.userId,
      flagType: "same_ip",
      detail: "Referral click and customer signup used the same IP address.",
    });
  }

  await deps.recordAudit({
    actorUserId: input.userId,
    action: "affiliate.referral.attributed",
    entityType: "affiliate_referral",
    entityId: referral.id,
    message: `Signup attributed to affiliate ${affiliateRow.email}`,
    metadata: { affiliateId: affiliateRow.id, referralCode: code },
  });

  return referral;
}

export async function createAffiliateCommissionForPayment(
  deps: AffiliateDeps,
  input: {
    invoiceId: string;
    customerId: string;
    amount: number;
    subscriptionId?: string | null;
    paymentId?: string | null;
  },
) {
  const existing = await deps.db.query.affiliateCommission.findFirst({
    where: eq(deps.affiliateCommission.invoiceId, input.invoiceId),
  });
  if (existing) return existing;

  const referrals = await deps.db.query.affiliateReferral.findMany({
    where: eq(deps.affiliateReferral.customerId, input.customerId),
    orderBy: (affiliateReferral: any, { desc }: any) => [desc(affiliateReferral.signedUpAt)],
  });
  const referral = referrals[0];
  if (!referral) return null;

  const affiliateRow = await deps.db.query.affiliate.findFirst({
    where: eq(deps.affiliate.id, referral.affiliateId),
  });
  if (!affiliateRow) return null;

  if (!canGenerateCommission(affiliateRow.status)) {
    await createFraudFlag(deps, {
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.customerId,
      flagType: "inactive_affiliate_payment",
      detail: "A referred customer paid while the affiliate was not approved or active.",
    });
    return null;
  }

  const commissions = await deps.db.query.affiliateCommission.findMany({
    where: eq(deps.affiliateCommission.customerId, input.customerId),
  });
  const commissionType = referral.commissionTypeAtSignup ?? affiliateRow.commissionType;
  const commissionRateBps = referral.commissionRateBpsAtSignup ?? affiliateRow.commissionRateBps;
  const recurringDurationMonths =
    referral.recurringDurationMonthsAtSignup ?? affiliateRow.recurringDurationMonths;
  const priorCommissionCount = commissions.filter(
    (row) =>
      row.affiliateId === affiliateRow.id &&
      row.status !== "cancelled" &&
      row.status !== "reversed",
  ).length;
  const nextMonthNumber = priorCommissionCount + 1;

  if (commissionType === "once_off" && priorCommissionCount > 0) return null;
  if (commissionType === "recurring" && nextMonthNumber > recurringDurationMonths) return null;

  const holdUntilDate = new Date();
  holdUntilDate.setDate(holdUntilDate.getDate() + 30);
  const commissionAmount = Math.round((input.amount * commissionRateBps) / 10000);

  const [created] = await deps.db
    .insert(deps.affiliateCommission)
    .values({
      id: deps.makeId("affcom"),
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.customerId,
      paymentId: input.paymentId ?? input.invoiceId,
      invoiceId: input.invoiceId,
      subscriptionId: input.subscriptionId ?? input.invoiceId,
      commissionType,
      commissionRateBps,
      commissionAmount,
      commissionMonthNumber: nextMonthNumber,
      status: "pending",
      holdUntilDate,
    })
    .returning();

  await deps.db
    .update(deps.affiliateReferral)
    .set({
      status: "converted",
      convertedAt: new Date(),
    })
    .where(eq(deps.affiliateReferral.id, referral.id));

  await deps.recordAudit({
    action: "affiliate.commission.created",
    entityType: "affiliate_commission",
    entityId: created.id,
    message: `Affiliate commission created for invoice ${input.invoiceId}`,
    metadata: { affiliateId: affiliateRow.id, customerId: input.customerId, amount: input.amount },
  });

  return created;
}

export function createAffiliateHandlers(deps: AffiliateDeps) {
  async function handlePublicAffiliateClick(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      const body = await deps.parseBody(request, affiliateClickSchema);
      const affiliateRow = await deps.db.query.affiliate.findFirst({
        where: eq(deps.affiliate.referralCode, body.referralCode.trim()),
      });
      if (!affiliateRow || !canGenerateCommission(affiliateRow.status)) {
        return deps.json({ ok: true, tracked: false });
      }

      const [created] = await deps.db
        .insert(deps.affiliateReferral)
        .values({
          id: deps.makeId("affref"),
          affiliateId: affiliateRow.id,
          referralCode: affiliateRow.referralCode,
          visitorId: body.visitorId ?? null,
          sourceUrl: body.sourceUrl ?? request.headers.get("referer"),
          landingPage: body.landingPage ?? url.pathname,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
          attributionType: "link",
          attributionModel: "last_click",
          status: "clicked",
        })
        .returning();

      return deps.json({ ok: true, tracked: true, referralId: created.id });
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handlePublicAffiliateApplication(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      const body = await deps.parseBody(request, affiliateApplicationSchema);
      const email = body.email.toLowerCase();
      const existing = await deps.db.query.affiliate.findFirst({
        where: eq(deps.affiliate.email, email),
      });
      if (existing) {
        return deps.json(
          { error: "An affiliate application already exists for this email" },
          409,
        );
      }

      const [created] = await deps.db
        .insert(deps.affiliate)
        .values({
          id: deps.makeId("aff"),
          fullName: body.fullName,
          email,
          phone: body.phone ?? null,
          companyName: body.companyName ?? null,
          website: body.website ?? null,
          socialLinks: body.socialLinks ?? null,
          affiliateType: body.affiliateType,
          expectedReferralMethod: body.expectedReferralMethod,
          status: "pending",
          referralCode: await generateUniqueReferralCode(deps, body.fullName || email),
          payoutMethod: body.payoutMethod ?? "manual_eft",
          payoutDetails: body.payoutDetails ? deps.encryptSecret(body.payoutDetails) : null,
          termsAcceptedAt: new Date(),
        })
        .returning();

      await deps.recordAudit({
        action: "affiliate.application.created",
        entityType: "affiliate",
        entityId: created.id,
        message: `Affiliate application submitted by ${created.email}`,
        metadata: { affiliateType: created.affiliateType },
      });

      return deps.json({ affiliate: sanitizeAffiliate(deps, created, url.origin) }, 201);
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleUserAffiliate(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname.startsWith("/api/user/affiliate/attribute-signup") &&
      request.method === "POST"
    ) {
      const { session, response } = await deps.requireSession(request);
      if (response) return response;

      try {
        const body = await deps.parseBody(
          request,
          z.object({
            referralCode: z.string().min(2),
            visitorId: z.string().optional().nullable(),
          }),
        );
        const referral = await attributeSignupToAffiliate(deps, {
          userId: session.user.id,
          email: session.user.email ?? "",
          referralCode: body.referralCode,
          visitorId: body.visitorId,
          request,
        });
        return deps.json({ attributed: !!referral, referral });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (request.method === "GET") {
      try {
        const affiliateRow =
          (await deps.db.query.affiliate.findFirst({
            where: eq(deps.affiliate.email, (session.user.email ?? "").toLowerCase()),
          })) ??
          (await deps.db.query.affiliate.findFirst({
            where: eq(deps.affiliate.userId, session.user.id),
          }));

        if (!affiliateRow) return deps.json({ affiliate: null });
        if (!affiliateRow.userId) {
          await deps.db
            .update(deps.affiliate)
            .set({ userId: session.user.id, updatedAt: new Date() })
            .where(eq(deps.affiliate.id, affiliateRow.id));
          affiliateRow.userId = session.user.id;
        }

        const [referrals, commissions, payouts, flags] = await Promise.all([
          deps.db.query.affiliateReferral.findMany({
            where: eq(deps.affiliateReferral.affiliateId, affiliateRow.id),
            orderBy: (affiliateReferral: any, { desc }: any) => [desc(affiliateReferral.createdAt)],
          }),
          deps.db.query.affiliateCommission.findMany({
            where: eq(deps.affiliateCommission.affiliateId, affiliateRow.id),
            orderBy: (affiliateCommission: any, { desc }: any) => [desc(affiliateCommission.createdAt)],
          }),
          deps.db.query.affiliatePayout.findMany({
            where: eq(deps.affiliatePayout.affiliateId, affiliateRow.id),
            orderBy: (affiliatePayout: any, { desc }: any) => [desc(affiliatePayout.createdAt)],
          }),
          deps.db.query.affiliateFraudFlag.findMany({
            where: eq(deps.affiliateFraudFlag.affiliateId, affiliateRow.id),
            orderBy: (affiliateFraudFlag: any, { desc }: any) => [desc(affiliateFraudFlag.createdAt)],
          }),
        ]);
        const customerRows = await Promise.all(
          referrals
            .filter((row) => row.customerId)
            .map((row) => deps.db.query.user.findFirst({ where: eq(deps.user.id, row.customerId!) })),
        );
        const customers = new Map(customerRows.filter(Boolean).map((row) => [row!.id, row!]));

        return deps.json({
          affiliate: sanitizeAffiliate(deps, affiliateRow, url.origin, true),
          summary: affiliateSummary({ referrals, commissions }),
          referrals: referrals.map((row) => {
            const customer = row.customerId ? customers.get(row.customerId) : null;
            const rowCommissions = commissions.filter((item) => item.referralId === row.id);
            return {
              id: row.id,
              customerName: customer?.name ?? customer?.email ?? "Lead",
              signupDate: row.signedUpAt,
              status: row.status,
              commissionStatus: rowCommissions[0]?.status ?? "pending",
            };
          }),
          commissions,
          payouts,
          flags: flags.filter((row) => row.status === "open"),
        });
      } catch (error: any) {
        console.error("Affiliate profile fetch error:", error);
        return deps.json({ error: "Failed to load affiliate profile" }, 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await deps.parseBody(request, affiliateProfileSchema);
        const affiliateRow =
          (await deps.db.query.affiliate.findFirst({
            where: eq(deps.affiliate.userId, session.user.id),
          })) ??
          (await deps.db.query.affiliate.findFirst({
            where: eq(deps.affiliate.email, (session.user.email ?? "").toLowerCase()),
          }));
        if (!affiliateRow) return deps.json({ error: "Affiliate profile not found" }, 404);
        const [updated] = await deps.db
          .update(deps.affiliate)
          .set({
            phone: body.phone ?? affiliateRow.phone,
            companyName: body.companyName ?? affiliateRow.companyName,
            website: body.website ?? affiliateRow.website,
            socialLinks: body.socialLinks ?? affiliateRow.socialLinks,
            expectedReferralMethod:
              body.expectedReferralMethod ?? affiliateRow.expectedReferralMethod,
            payoutMethod: body.payoutMethod ?? affiliateRow.payoutMethod,
            payoutDetails: body.payoutDetails
              ? deps.encryptSecret(body.payoutDetails)
              : affiliateRow.payoutDetails,
            userId: session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(deps.affiliate.id, affiliateRow.id))
          .returning();
        return deps.json({ affiliate: sanitizeAffiliate(deps, updated, url.origin, true) });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Not found" }, 404);
  }

  async function handleAdminAffiliates(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (url.pathname === "/api/admin/affiliates" && request.method === "GET") {
      const [affiliates, referrals, commissions, payouts, flags] = await Promise.all([
        deps.db.query.affiliate.findMany({
          orderBy: (affiliate: any, { desc }: any) => [desc(affiliate.createdAt)],
        }),
        deps.db.query.affiliateReferral.findMany({
          orderBy: (affiliateReferral: any, { desc }: any) => [desc(affiliateReferral.createdAt)],
        }),
        deps.db.query.affiliateCommission.findMany({
          orderBy: (affiliateCommission: any, { desc }: any) => [desc(affiliateCommission.createdAt)],
        }),
        deps.db.query.affiliatePayout.findMany({
          orderBy: (affiliatePayout: any, { desc }: any) => [desc(affiliatePayout.createdAt)],
        }),
        deps.db.query.affiliateFraudFlag.findMany({
          orderBy: (affiliateFraudFlag: any, { desc }: any) => [desc(affiliateFraudFlag.createdAt)],
        }),
      ]);
      const referralsByAffiliate = groupByAffiliate(referrals);
      const commissionsByAffiliate = groupByAffiliate(commissions);
      const payoutsByAffiliate = groupByAffiliate(payouts);
      const flagsByAffiliate = groupByAffiliate(flags);

      return deps.json({
        affiliates: affiliates.map((row) => {
          const affiliateReferrals = referralsByAffiliate.get(row.id) ?? [];
          const affiliateCommissions = commissionsByAffiliate.get(row.id) ?? [];
          const affiliatePayouts = payoutsByAffiliate.get(row.id) ?? [];
          const affiliateFlags = flagsByAffiliate.get(row.id) ?? [];
          return {
            ...sanitizeAffiliate(deps, row, url.origin, true),
            summary: affiliateSummary({
              referrals: affiliateReferrals,
              commissions: affiliateCommissions,
            }),
            referrals: affiliateReferrals,
            commissions: affiliateCommissions,
            payouts: affiliatePayouts,
            flags: affiliateFlags,
          };
        }),
        commissions,
        payouts,
        flags: flags.filter((row) => row.status === "open"),
      });
    }

    const payoutMatch = url.pathname.match(/^\/api\/admin\/affiliates\/payouts$/);
    if (payoutMatch && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, payoutMarkPaidSchema);
        const commissionIds = [...new Set(body.commissionIds)];
        const commissions = await deps.db.query.affiliateCommission.findMany({
          where: inArray(deps.affiliateCommission.id, commissionIds),
        });
        if (!commissions.length || commissions.length !== commissionIds.length) {
          return deps.json({ error: "One or more commissions were not found" }, 404);
        }
        if (commissions.some((row) => row.affiliateId !== body.affiliateId)) {
          return deps.json({ error: "Select payable commissions for one affiliate" }, 400);
        }
        if (commissions.some((row) => row.status === "paid")) {
          return deps.json({ error: "Selected commissions are already paid" }, 409);
        }
        if (commissions.some((row) => !["approved", "payable"].includes(row.status))) {
          return deps.json({ error: "Selected commissions must be approved or payable" }, 400);
        }

        const now = new Date();
        const totalAmount = commissions.reduce((sum, row) => sum + row.commissionAmount, 0);
        const payoutPeriodStart = commissions.reduce(
          (earliest, row) => (row.createdAt < earliest ? row.createdAt : earliest),
          commissions[0].createdAt,
        );
        const payoutPeriodEnd = commissions.reduce(
          (latest, row) => (row.createdAt > latest ? row.createdAt : latest),
          commissions[0].createdAt,
        );
        const [payout] = await deps.db
          .insert(deps.affiliatePayout)
          .values({
            id: deps.makeId("affpay"),
            affiliateId: body.affiliateId,
            payoutPeriodStart,
            payoutPeriodEnd,
            totalAmount,
            payoutMethod: "manual_eft",
            payoutReference: body.payoutReference ?? null,
            status: "paid",
            paidAt: now,
            adminId: session.user.id,
            notes: body.notes ?? null,
          })
          .returning();

        const updatedCommissions = await deps.db
          .update(deps.affiliateCommission)
          .set({
            status: "paid",
            paidAt: now,
            updatedAt: now,
          })
          .where(inArray(deps.affiliateCommission.id, commissionIds))
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "affiliate.payout.paid",
          entityType: "affiliate_payout",
          entityId: payout.id,
          message: `Affiliate payout marked paid for ${body.affiliateId}`,
          metadata: { affiliateId: body.affiliateId, commissionIds, totalAmount },
        });

        return deps.json({ payout, commissions: updatedCommissions }, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const manualAttributionMatch = url.pathname.match(/^\/api\/admin\/affiliates\/manual-attribution$/);
    if (manualAttributionMatch && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, manualAttributionSchema);
        const affiliateRow = await deps.db.query.affiliate.findFirst({
          where: eq(deps.affiliate.id, body.affiliateId),
        });
        if (!affiliateRow) return deps.json({ error: "Affiliate not found" }, 404);
        const customerRow = await deps.db.query.user.findFirst({
          where: eq(deps.user.id, body.customerId),
        });
        if (!customerRow) return deps.json({ error: "Customer not found" }, 404);

        const rule = getAffiliateTierRule(affiliateRow.tier);
        const existing = await deps.db.query.affiliateReferral.findFirst({
          where: and(
            eq(deps.affiliateReferral.affiliateId, affiliateRow.id),
            eq(deps.affiliateReferral.customerId, body.customerId),
          ),
        });
        const now = new Date();
        const values = {
          affiliateId: affiliateRow.id,
          referralCode: affiliateRow.referralCode,
          visitorId: null,
          customerId: body.customerId,
          sourceUrl: null,
          landingPage: null,
          ipAddress: null,
          userAgent: null,
          attributionType: "manual",
          attributionModel: "manual",
          status: "signup",
          tierAtSignup: affiliateRow.tier,
          commissionTypeAtSignup: affiliateRow.commissionType ?? rule.commissionType,
          commissionRateBpsAtSignup: affiliateRow.commissionRateBps ?? rule.commissionRateBps,
          recurringDurationMonthsAtSignup:
            affiliateRow.recurringDurationMonths ?? rule.recurringDurationMonths,
          signedUpAt: now,
          convertedAt: null,
        };

        const [referral] = existing
          ? await deps.db
              .update(deps.affiliateReferral)
              .set(values)
              .where(eq(deps.affiliateReferral.id, existing.id))
              .returning()
          : await deps.db
              .insert(deps.affiliateReferral)
              .values({
                id: deps.makeId("affref"),
                ...values,
              })
              .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "affiliate.referral.manual_attribution",
          entityType: "affiliate_referral",
          entityId: referral.id,
          message: `Manual attribution created for ${customerRow.email}`,
          metadata: { affiliateId: affiliateRow.id, customerId: body.customerId, reason: body.reason },
        });

        return deps.json({ referral }, existing ? 200 : 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const commissionMatch = url.pathname.match(/^\/api\/admin\/affiliates\/commissions\/([^/]+)$/);
    if (commissionMatch && request.method === "PUT") {
      try {
        const commissionId = decodeURIComponent(commissionMatch[1]);
        const body = await deps.parseBody(request, commissionActionSchema);
        const commissionRow = await deps.db.query.affiliateCommission.findFirst({
          where: eq(deps.affiliateCommission.id, commissionId),
        });
        if (!commissionRow) return deps.json({ error: "Commission not found" }, 404);

        const updates: Record<string, unknown> = {
          status: body.status,
          adminNotes: body.adminNotes ?? commissionRow.adminNotes,
          commissionAmount:
            body.commissionAmount ?? commissionRow.commissionAmount,
          updatedAt: new Date(),
        };
        const now = new Date();
        if (body.status === "approved") updates.approvedAt = now;
        if (body.status === "payable") updates.payableAt = now;
        if (body.status === "paid") updates.paidAt = now;
        if (body.status === "cancelled" || body.status === "reversed") updates.cancelledAt = now;

        const [updated] = await deps.db
          .update(deps.affiliateCommission)
          .set(updates)
          .where(eq(deps.affiliateCommission.id, commissionId))
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "affiliate.commission.updated",
          entityType: "affiliate_commission",
          entityId: updated.id,
          message: `Affiliate commission ${updated.status} for ${updated.affiliateId}`,
          metadata: { commissionId: updated.id, status: updated.status },
        });

        return deps.json({ commission: updated });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const affiliateMatch = url.pathname.match(/^\/api\/admin\/affiliates\/([^/]+)$/);
    if (affiliateMatch && request.method === "PUT") {
      try {
        const affiliateId = decodeURIComponent(affiliateMatch[1]);
        const body = await deps.parseBody(request, adminAffiliateUpdateSchema);
        const affiliateRow = await deps.db.query.affiliate.findFirst({
          where: eq(deps.affiliate.id, affiliateId),
        });
        if (!affiliateRow) return deps.json({ error: "Affiliate not found" }, 404);

        const now = new Date();
        const [updated] = await deps.db
          .update(deps.affiliate)
          .set({
            status: body.status ?? affiliateRow.status,
            tier: body.tier ?? affiliateRow.tier,
            commissionType: body.commissionType ?? affiliateRow.commissionType,
            commissionRateBps: body.commissionRateBps ?? affiliateRow.commissionRateBps,
            recurringDurationMonths:
              body.recurringDurationMonths ?? affiliateRow.recurringDurationMonths,
            notes: body.notes ?? affiliateRow.notes,
            payoutMethod: body.payoutMethod ?? affiliateRow.payoutMethod,
            payoutDetails: body.payoutDetails
              ? deps.encryptSecret(body.payoutDetails)
              : affiliateRow.payoutDetails,
            approvedAt:
              body.status === "approved" || body.status === "active" ? now : affiliateRow.approvedAt,
            rejectedAt: body.status === "rejected" ? now : affiliateRow.rejectedAt,
            suspendedAt: body.status === "suspended" ? now : affiliateRow.suspendedAt,
            updatedAt: now,
          })
          .where(eq(deps.affiliate.id, affiliateRow.id))
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "affiliate.updated",
          entityType: "affiliate",
          entityId: updated.id,
          message: `Affiliate ${updated.email} updated`,
          metadata: { affiliateId: updated.id, status: updated.status, tier: updated.tier },
        });

        return deps.json({ affiliate: sanitizeAffiliate(deps, updated, url.origin, true) });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Not found" }, 404);
  }

  return {
    handlePublicAffiliateClick,
    handlePublicAffiliateApplication,
    handleUserAffiliate,
    handleAdminAffiliates,
  };
}
