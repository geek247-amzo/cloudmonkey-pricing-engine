import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  affiliate,
  affiliateCommission,
  affiliateFraudFlag,
  affiliatePayout,
  affiliateReferral,
  invoice,
  subscription,
  user,
} from "../src/db/schema";
import {
  createAffiliateCommissionForPayment,
  createAffiliateHandlers,
} from "../src/lib/domain/affiliates";

type JsonBody = Record<string, unknown>;

function jsonResponse(data: unknown, init?: ResponseInit | number) {
  const normalized = typeof init === "number" ? { status: init } : init ?? { status: 200 };
  return new Response(JSON.stringify(data), {
    ...normalized,
    headers: {
      "content-type": "application/json",
      ...(normalized.headers ?? {}),
    },
  });
}

function makeAffiliateHandlers(
  sessionUserId = "affiliate-test-user",
  role: "customer" | "admin" = "customer",
  sessionEmail?: string,
) {
  const counters = new Map<string, number>();
  return createAffiliateHandlers({
    db,
    json: jsonResponse,
    parseBody: async (request, schema) => schema.parse(await request.json()),
    requireSession: async () => ({
      session: {
        user: {
          id: sessionUserId,
          name: role === "admin" ? "Admin Tester" : "Affiliate Tester",
          email: sessionEmail ?? `${role}-${crypto.randomUUID().slice(0, 8)}@example.com`,
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
    encryptSecret: (value) => `enc:${value}`,
    decryptSecret: (value) => (value.startsWith("enc:") ? value.slice(4) : value),
    affiliate,
    affiliateCommission,
    affiliateFraudFlag,
    affiliatePayout,
    affiliateReferral,
    user,
  });
}

async function requestJson(path: string, method: string, body?: JsonBody) {
  return new Request(`https://cloudmonkey.co.za${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function cleanupAffiliateFixtures(ids: {
  userIds?: string[];
  affiliateIds?: string[];
  referralIds?: string[];
  commissionIds?: string[];
  payoutIds?: string[];
  flagIds?: string[];
}) {
  for (const id of ids.flagIds ?? []) {
    await db.delete(affiliateFraudFlag).where(eq(affiliateFraudFlag.id, id));
  }
  for (const id of ids.payoutIds ?? []) {
    await db.delete(affiliatePayout).where(eq(affiliatePayout.id, id));
  }
  for (const id of ids.commissionIds ?? []) {
    await db.delete(affiliateCommission).where(eq(affiliateCommission.id, id));
  }
  for (const id of ids.referralIds ?? []) {
    await db.delete(affiliateReferral).where(eq(affiliateReferral.id, id));
  }
  for (const id of ids.affiliateIds ?? []) {
    await db.delete(affiliate).where(eq(affiliate.id, id));
  }
  for (const id of ids.userIds ?? []) {
    await db.delete(user).where(eq(user.id, id));
  }
}

describe("affiliate handlers", () => {
  test("public click, application, and signup attribution create a fraud flag for self-referral", async () => {
    const userId = `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const email = `partner-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const handlers = makeAffiliateHandlers(userId, "customer", email);

    await db.insert(user).values({
      id: userId,
      name: "Affiliate Lead",
      email,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const applicationResponse = await handlers.handlePublicAffiliateApplication(
        await requestJson("/api/public/affiliate-application", "POST", {
          fullName: "Partner Person",
          email,
          phone: null,
          companyName: "Partner Co",
          website: "https://partner.example.com",
          socialLinks: null,
          affiliateType: "agency",
          expectedReferralMethod: "Referrals from existing clients",
          payoutMethod: "manual_eft",
          payoutDetails: "Bank details",
          termsAccepted: true,
        }),
      );
      expect(applicationResponse.status).toBe(201);
      const applicationBody = await applicationResponse.json();
      const affiliateId = applicationBody.affiliate.id;
      const referralCode = applicationBody.affiliate.referralCode;

      await db
        .update(affiliate)
        .set({
          status: "active",
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(affiliate.id, affiliateId));

      const clickResponse = await handlers.handlePublicAffiliateClick(
        await requestJson("/api/public/affiliate-click", "POST", {
          referralCode,
          visitorId: "visitor_123",
          sourceUrl: "https://google.com",
          landingPage: "/pricing",
        }),
      );
      expect(clickResponse.status).toBe(200);
      const clickBody = await clickResponse.json();
      expect(clickBody.tracked).toBe(true);

      await db
        .update(user)
        .set({ createdAt: new Date(), updatedAt: new Date() })
        .where(eq(user.id, userId));

      const attributeResponse = await handlers.handleUserAffiliate(
        await requestJson("/api/user/affiliate/attribute-signup", "POST", {
          referralCode,
          visitorId: "visitor_123",
        }),
      );
      expect(attributeResponse.status).toBe(200);
      const attributeBody = await attributeResponse.json();
      expect(attributeBody.attributed).toBe(true);
      expect(attributeBody.referral.customerId).toBe(userId);

      const flags = await db.query.affiliateFraudFlag.findMany({
        where: eq(affiliateFraudFlag.affiliateId, affiliateId),
      });
      expect(flags.length).toBe(1);
      expect(flags[0]?.flagType).toBe("self_referral");
    } finally {
      const affiliates = await db.query.affiliate.findMany({ where: eq(affiliate.email, email) });
      const referrals = affiliates.length
        ? await db.query.affiliateReferral.findMany({
            where: eq(affiliateReferral.affiliateId, affiliates[0].id),
          })
        : [];
      const flagRows = affiliates.length
        ? await db.query.affiliateFraudFlag.findMany({
            where: eq(affiliateFraudFlag.affiliateId, affiliates[0].id),
          })
        : [];
      await cleanupAffiliateFixtures({
        userIds: [userId],
        affiliateIds: affiliates.map((row) => row.id),
        referralIds: referrals.map((row) => row.id),
        flagIds: flagRows.map((row) => row.id),
      });
    }
  });

  test("commission creation is idempotent for the same invoice", async () => {
    const affiliateId = `aff_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const userId = `cust_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const referralId = `ref_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const invoiceId = `inv_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const subscriptionId = `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

    await db.insert(user).values({
      id: userId,
      name: "Customer",
      email: `customer-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(invoice).values({
      id: invoiceId,
      userId,
      invoiceNumber: `INV-${invoiceId.slice(-6)}`,
      invoiceSource: "checkout",
      amount: 10000,
      status: "paid",
      dueDate: new Date(),
      issuedAt: new Date(),
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(),
      currency: "ZAR",
      vatRateBps: 0,
      customerName: "Customer",
      customerEmail: `customer-${crypto.randomUUID().slice(0, 8)}@example.com`,
      paymentMethod: "gateway",
      collectionStatus: "paid",
      collectionDayCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(subscription).values({
      id: subscriptionId,
      userId,
      planId: null,
      bundleId: null,
      name: "Managed Service",
      status: "active",
      amount: 10000,
      interval: "month",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      agreementSigned: false,
      agreementSignedAt: null,
      requiredAgreementTemplateId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(affiliate).values({
      id: affiliateId,
      userId: null,
      fullName: "Partner Person",
      email: `partner-${crypto.randomUUID().slice(0, 8)}@example.com`,
      phone: null,
      companyName: null,
      website: null,
      socialLinks: null,
      affiliateType: "agency",
      expectedReferralMethod: "Referrals",
      tier: "starter",
      status: "active",
      referralCode: `code_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
      commissionType: "once_off",
      commissionRateBps: 1500,
      recurringDurationMonths: 1,
      payoutMethod: "manual_eft",
      payoutDetails: null,
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      approvedAt: new Date(),
      rejectedAt: null,
      suspendedAt: null,
      updatedAt: new Date(),
      notes: null,
    });
    await db.insert(affiliateReferral).values({
      id: referralId,
      affiliateId,
      referralCode: "refcode_123",
      visitorId: "visitor_123",
      leadId: null,
      customerId: userId,
      sourceUrl: null,
      landingPage: "/",
      ipAddress: null,
      userAgent: null,
      attributionType: "signup",
      attributionModel: "last_click",
      status: "signup",
      tierAtSignup: "starter",
      commissionTypeAtSignup: "once_off",
      commissionRateBpsAtSignup: 1500,
      recurringDurationMonthsAtSignup: 1,
      createdAt: new Date(),
      clickedAt: new Date(),
      signedUpAt: new Date(),
      convertedAt: null,
    });

    try {
      const first = await createAffiliateCommissionForPayment(
        {
          db,
          json: jsonResponse,
          parseBody: async () => {
            throw new Error("unused");
          },
          requireSession: async () => ({ response: undefined }),
          requireAdmin: async () => ({ response: undefined }),
          recordAudit: async () => undefined,
          makeId: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
          encryptSecret: (value) => value,
          decryptSecret: (value) => value,
          affiliate,
          affiliateCommission,
          affiliateFraudFlag,
          affiliatePayout,
          affiliateReferral,
          user,
        },
        {
          invoiceId,
          customerId: userId,
          amount: 10000,
          subscriptionId,
          paymentId: "pay_1",
        },
      );
      const second = await createAffiliateCommissionForPayment(
        {
          db,
          json: jsonResponse,
          parseBody: async () => {
            throw new Error("unused");
          },
          requireSession: async () => ({ response: undefined }),
          requireAdmin: async () => ({ response: undefined }),
          recordAudit: async () => undefined,
          makeId: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
          encryptSecret: (value) => value,
          decryptSecret: (value) => value,
          affiliate,
          affiliateCommission,
          affiliateFraudFlag,
          affiliatePayout,
          affiliateReferral,
          user,
        },
        {
          invoiceId,
          customerId: userId,
          amount: 10000,
          subscriptionId,
          paymentId: "pay_1",
        },
      );

      expect(first?.id).toBeTruthy();
      expect(second?.id).toBe(first?.id);

      const commissions = await db.query.affiliateCommission.findMany({
        where: eq(affiliateCommission.invoiceId, invoiceId),
      });
      expect(commissions).toHaveLength(1);
      expect(commissions[0]?.commissionAmount).toBe(1500);
      expect(commissions[0]?.status).toBe("pending");
      const referral = await db.query.affiliateReferral.findFirst({
        where: eq(affiliateReferral.id, referralId),
      });
      expect(referral?.status).toBe("converted");
    } finally {
      await db.delete(affiliateCommission).where(eq(affiliateCommission.invoiceId, invoiceId));
      await db.delete(subscription).where(eq(subscription.id, subscriptionId));
      await db.delete(invoice).where(eq(invoice.id, invoiceId));
      await cleanupAffiliateFixtures({
        userIds: [userId],
        affiliateIds: [affiliateId],
        referralIds: [referralId],
      });
    }
  });

  test("admin payout processing marks commissions paid once and rejects replay", async () => {
    const adminUserId = "admin-test-user";
    const adminHandlers = makeAffiliateHandlers(adminUserId, "admin");
    const affiliateId = `aff_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const commissionId = `com_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const customerId = `cust_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const invoiceId = `inv_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const subscriptionId = `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

    await db.insert(user).values({
      id: customerId,
      name: "Commission Customer",
      email: `commission-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(user).values({
      id: adminUserId,
      name: "Admin Tester",
      email: "admin@test.local",
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(invoice).values({
      id: invoiceId,
      userId: customerId,
      invoiceNumber: "INV-000001",
      invoiceSource: "checkout",
      amount: 10000,
      status: "paid",
      dueDate: new Date(),
      issuedAt: new Date(),
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(),
      currency: "ZAR",
      vatRateBps: 0,
      customerName: "Commission Customer",
      customerEmail: `commission-${crypto.randomUUID().slice(0, 8)}@example.com`,
      paymentMethod: "gateway",
      collectionStatus: "paid",
      collectionDayCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(subscription).values({
      id: subscriptionId,
      userId: customerId,
      planId: null,
      bundleId: null,
      name: "Managed Service",
      status: "active",
      amount: 10000,
      interval: "month",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      agreementSigned: false,
      agreementSignedAt: null,
      requiredAgreementTemplateId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(affiliate).values({
      id: affiliateId,
      userId: null,
      fullName: "Partner Person",
      email: `partner-${crypto.randomUUID().slice(0, 8)}@example.com`,
      phone: null,
      companyName: null,
      website: null,
      socialLinks: null,
      affiliateType: "agency",
      expectedReferralMethod: "Referrals",
      tier: "starter",
      status: "active",
      referralCode: `code_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
      commissionType: "once_off",
      commissionRateBps: 1500,
      recurringDurationMonths: 1,
      payoutMethod: "manual_eft",
      payoutDetails: null,
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      approvedAt: new Date(),
      rejectedAt: null,
      suspendedAt: null,
      updatedAt: new Date(),
      notes: null,
    });
    await db.insert(affiliateCommission).values({
      id: commissionId,
      affiliateId,
      referralId: null,
      customerId,
      paymentId: "pay_1",
      invoiceId,
      subscriptionId,
      commissionType: "once_off",
      commissionRateBps: 1500,
      commissionAmount: 1500,
      commissionMonthNumber: 1,
      status: "approved",
      holdUntilDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      approvedAt: new Date(),
      payableAt: null,
      paidAt: null,
      cancelledAt: null,
      adminNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const firstResponse = await adminHandlers.handleAdminAffiliates(
        await requestJson("/api/admin/affiliates/payouts", "POST", {
          affiliateId,
          commissionIds: [commissionId],
          payoutReference: "EFT-001",
          notes: "Manual EFT payout",
        }),
      );
      expect(firstResponse.status).toBe(201);
      const firstBody = await firstResponse.json();
      expect(firstBody.payout.totalAmount).toBe(1500);

      const paidCommission = await db.query.affiliateCommission.findFirst({
        where: eq(affiliateCommission.id, commissionId),
      });
      expect(paidCommission?.status).toBe("paid");

      const repeatResponse = await adminHandlers.handleAdminAffiliates(
        await requestJson("/api/admin/affiliates/payouts", "POST", {
          affiliateId,
          commissionIds: [commissionId],
          payoutReference: "EFT-001",
          notes: "Manual EFT payout",
        }),
      );
      expect(repeatResponse.status).toBe(409);
    } finally {
      await db.delete(affiliateCommission).where(eq(affiliateCommission.id, commissionId));
      await db.delete(subscription).where(eq(subscription.id, subscriptionId));
      await db.delete(invoice).where(eq(invoice.id, invoiceId));
      const payouts = await db.query.affiliatePayout.findMany({
        where: eq(affiliatePayout.affiliateId, affiliateId),
      });
      await cleanupAffiliateFixtures({
        userIds: [customerId, adminUserId],
        affiliateIds: [affiliateId],
        payoutIds: payouts.map((row) => row.id),
      });
    }
  });
});
