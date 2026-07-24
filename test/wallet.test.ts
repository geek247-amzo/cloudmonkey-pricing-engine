import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  tokenFeatureRate,
  tokenTopupIntent,
  tokenWallet,
  tokenWalletLedger,
  tokenWalletReservation,
  user,
} from "../src/db/schema";
import {
  commitWalletReservation,
  createWalletHandlers,
  processPaystackTopUpWebhook,
  releaseWalletReservation,
  reserveWalletUsage,
  sweepExpiredReservations,
} from "../src/lib/domain/wallet";

type WalletFixture = {
  userId: string;
  walletId: string;
  featureKey: string;
};

type WalletDeps = Parameters<typeof reserveWalletUsage>[0];

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function makeDeps(): WalletDeps {
  return {
    db,
    json: () => new Response(),
    parseBody: async () => ({}),
    requireSession: async () => ({}),
    requireAdmin: async () => ({}),
    recordAudit: async () => undefined,
    makeId,
    initializePayment: async () => {
      throw new Error("not used");
    },
    tokenWallet,
    tokenWalletLedger,
    tokenWalletReservation,
    tokenFeatureRate,
    tokenTopupIntent,
    user,
  };
}

async function createWalletFixture(balanceTokens = 500): Promise<WalletFixture> {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const userId = `wallet-user-${suffix}`;
  const walletId = `wallet-${suffix}`;
  const featureKey = `wallet-feature-${suffix}`;
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    name: "Wallet Tester",
    email: `wallet-${suffix}@test.local`,
    emailVerified: true,
    image: null,
    whatsapp: null,
    role: "customer",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(tokenFeatureRate).values({
    featureKey,
    displayName: "Wallet test feature",
    baseTokenCost: 100,
    multiplierBps: 10000,
    active: true,
    notes: "test feature for wallet coverage",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(tokenWallet).values({
    id: walletId,
    userId,
    balanceTokens,
    reservedTokens: 0,
    currencyCode: "ZAR",
    unitLabel: "tokens",
    status: "active",
    autoTopUpEnabled: false,
    autoTopUpThresholdTokens: 0,
    autoTopUpAmountTokens: 0,
    lastLowBalanceAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { userId, walletId, featureKey };
}

async function cleanupWalletFixture(fixture: WalletFixture) {
  await db.delete(tokenWalletLedger).where(eq(tokenWalletLedger.walletId, fixture.walletId));
  await db.delete(tokenWalletReservation).where(eq(tokenWalletReservation.walletId, fixture.walletId));
  await db.delete(tokenTopupIntent).where(eq(tokenTopupIntent.walletId, fixture.walletId));
  await db.delete(tokenWallet).where(eq(tokenWallet.id, fixture.walletId));
  await db.delete(tokenFeatureRate).where(eq(tokenFeatureRate.featureKey, fixture.featureKey));
  await db.delete(user).where(eq(user.id, fixture.userId));
}

async function insertTopUpIntent(fixture: WalletFixture, amountTokens: number, reference: string) {
  const now = new Date();
  const [intent] = await db
    .insert(tokenTopupIntent)
    .values({
      id: makeId("topup"),
      walletId: fixture.walletId,
      userId: fixture.userId,
      amountTokens,
      status: "pending",
      paystackReference: reference,
      paystackUrl: null,
      paymentMethod: "gateway",
      metadataJson: JSON.stringify({ reference, amountTokens }),
      createdAt: now,
      paidAt: null,
      failedAt: null,
      updatedAt: now,
    })
    .returning();
  return intent;
}

async function reserveForFixture(fixture: WalletFixture, requestIdempotencyKey: string) {
  return reserveWalletUsage(makeDeps(), {
    userId: fixture.userId,
    featureKey: fixture.featureKey,
    requestIdempotencyKey,
    sourceType: "ai_usage",
    sourceId: requestIdempotencyKey,
  });
}

describe("wallet domain", () => {
  test("reserves once per idempotency key, commits on success, and releases on failure", async () => {
    const fixture = await createWalletFixture();
    try {
      const reservation = await reserveForFixture(fixture, "wallet-reservation-1");
      expect(reservation.reused).toBe(false);
      expect(reservation.chargeTokens).toBe(100);
      expect(reservation.reservation.status).toBe("pending");

      const duplicate = await reserveForFixture(fixture, "wallet-reservation-1");
      expect(duplicate.reused).toBe(true);
      expect(duplicate.reservation.id).toBe(reservation.reservation.id);

      const committed = await commitWalletReservation(makeDeps(), {
        reservationId: reservation.reservation.id,
        sourceId: "job-1",
        metadata: { result: "ok" },
      });

      expect(committed.committed).toBe(true);
      expect(committed.alreadySettled).toBe(false);

      const walletAfterCommit = await db.query.tokenWallet.findFirst({
        where: eq(tokenWallet.id, fixture.walletId),
      });
      expect(walletAfterCommit?.balanceTokens).toBe(400);
      expect(walletAfterCommit?.reservedTokens).toBe(0);

      const releaseReservation = await reserveForFixture(fixture, "wallet-reservation-2");
      const released = await releaseWalletReservation(makeDeps(), {
        reservationId: releaseReservation.reservation.id,
        reason: "ai call failed",
      });

      expect(released.released).toBe(true);
      expect(released.alreadySettled).toBe(false);

      const walletAfterRelease = await db.query.tokenWallet.findFirst({
        where: eq(tokenWallet.id, fixture.walletId),
      });
      expect(walletAfterRelease?.balanceTokens).toBe(400);
      expect(walletAfterRelease?.reservedTokens).toBe(0);

      const committedRelease = await releaseWalletReservation(makeDeps(), {
        reservationId: reservation.reservation.id,
        reason: "should fail",
      }).catch((error: any) => error);

      expect(committedRelease.status).toBe(409);
    } finally {
      await cleanupWalletFixture(fixture);
    }
  });

  test("sweeper only expires pending reservations", async () => {
    const fixture = await createWalletFixture();
    try {
      const pending = await reserveForFixture(fixture, "wallet-reservation-pending");
      const committed = await reserveForFixture(fixture, "wallet-reservation-committed");

      await commitWalletReservation(makeDeps(), {
        reservationId: committed.reservation.id,
        sourceId: "job-committed",
      });

      const released = await reserveForFixture(fixture, "wallet-reservation-released");
      await releaseWalletReservation(makeDeps(), {
        reservationId: released.reservation.id,
        reason: "user cancelled",
      });

      const expiredAt = new Date(Date.now() - 60_000);
      await db
        .update(tokenWalletReservation)
        .set({ expiresAt: expiredAt, updatedAt: new Date() })
        .where(eq(tokenWalletReservation.id, pending.reservation.id));
      await db
        .update(tokenWalletReservation)
        .set({ expiresAt: expiredAt, updatedAt: new Date() })
        .where(eq(tokenWalletReservation.id, committed.reservation.id));
      await db
        .update(tokenWalletReservation)
        .set({ expiresAt: expiredAt, updatedAt: new Date() })
        .where(eq(tokenWalletReservation.id, released.reservation.id));

      const result = await sweepExpiredReservations(makeDeps(), new Date());

      expect(result.scanned).toBeGreaterThanOrEqual(2);
      expect(result.expired).toBe(1);
      expect(result.skipped).toBeGreaterThanOrEqual(1);

      const pendingAfter = await db.query.tokenWalletReservation.findFirst({
        where: eq(tokenWalletReservation.id, pending.reservation.id),
      });
      const committedAfter = await db.query.tokenWalletReservation.findFirst({
        where: eq(tokenWalletReservation.id, committed.reservation.id),
      });
      const releasedAfter = await db.query.tokenWalletReservation.findFirst({
        where: eq(tokenWalletReservation.id, released.reservation.id),
      });
      const walletAfter = await db.query.tokenWallet.findFirst({
        where: eq(tokenWallet.id, fixture.walletId),
      });

      expect(pendingAfter?.status).toBe("expired");
      expect(committedAfter?.status).toBe("committed");
      expect(releasedAfter?.status).toBe("released");
      expect(walletAfter?.balanceTokens).toBe(400);
      expect(walletAfter?.reservedTokens).toBe(0);
    } finally {
      await cleanupWalletFixture(fixture);
    }
  });

  test("duplicate Paystack top-up webhooks only credit the wallet once", async () => {
    const fixture = await createWalletFixture(0);
    try {
      const reference = `paystack-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      const intent = await insertTopUpIntent(fixture, 250, reference);

      const deps = {
        db,
        recordAudit: async () => undefined,
        makeId,
        tokenWallet,
        tokenWalletLedger,
        tokenWalletReservation,
        tokenTopupIntent,
      };

      const first = await processPaystackTopUpWebhook(deps, {
        reference,
        metadata: { reference },
        amountTokens: 250,
      });
      expect(first.ok).toBe(true);
      expect(first.skipped).toBe(false);

      const second = await processPaystackTopUpWebhook(deps, {
        reference,
        metadata: { reference },
        amountTokens: 250,
      });
      expect(second.ok).toBe(true);
      expect(second.skipped).toBe(true);

      const walletAfter = await db.query.tokenWallet.findFirst({
        where: eq(tokenWallet.id, fixture.walletId),
      });
      const ledgerRows = await db.query.tokenWalletLedger.findMany({
        where: eq(tokenWalletLedger.walletId, fixture.walletId),
      });
      const intentAfter = await db.query.tokenTopupIntent.findFirst({
        where: eq(tokenTopupIntent.id, intent.id),
      });

      expect(walletAfter?.balanceTokens).toBe(250);
      expect(ledgerRows.filter((row) => row.entryType === "topup_credit")).toHaveLength(1);
      expect(intentAfter?.status).toBe("paid");
    } finally {
      await cleanupWalletFixture(fixture);
    }
  });

  test("rejects reservations when the available balance is insufficient", async () => {
    const fixture = await createWalletFixture(50);
    try {
      const error = await reserveWalletUsage(makeDeps(), {
        userId: fixture.userId,
        featureKey: fixture.featureKey,
        requestIdempotencyKey: "wallet-reservation-insufficient",
        sourceType: "ai_usage",
        sourceId: "source-insufficient",
      }).catch((caught: any) => caught);

      expect(error.status).toBe(409);
      expect(String(error.message)).toContain("Insufficient token balance");

      const walletAfter = await db.query.tokenWallet.findFirst({
        where: eq(tokenWallet.id, fixture.walletId),
      });
      const reservations = await db.query.tokenWalletReservation.findMany({
        where: eq(tokenWalletReservation.walletId, fixture.walletId),
      });

      expect(walletAfter?.balanceTokens).toBe(50);
      expect(walletAfter?.reservedTokens).toBe(0);
      expect(reservations).toHaveLength(0);
    } finally {
      await cleanupWalletFixture(fixture);
    }
  });

  test("admin wallet visibility and adjustments are exposed through the handler", async () => {
    const fixture = await createWalletFixture(25);
    const adminId = `admin-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const audits: Array<Record<string, unknown>> = [];
    const handlers = createWalletHandlers({
      db,
      json: (data: unknown, init?: ResponseInit | number) => {
        const responseInit = typeof init === "number" ? { status: init } : init;
        return new Response(JSON.stringify(data), {
          ...responseInit,
          headers: { "content-type": "application/json", ...(responseInit?.headers ?? {}) },
        });
      },
      parseBody: async (request, schema) => schema.parse(await request.json()),
      requireSession: async () => ({
        session: {
          user: {
            id: adminId,
            name: "Admin Tester",
            email: "admin@test.local",
            role: "admin",
          },
        },
      }),
      requireAdmin: async () => ({
        session: {
          user: {
            id: adminId,
            name: "Admin Tester",
            email: "admin@test.local",
            role: "admin",
          },
        },
      }),
      recordAudit: async (entry) => {
        audits.push(entry);
      },
      makeId,
      initializePayment: async () => {
        throw new Error("not used");
      },
      tokenWallet,
      tokenWalletLedger,
      tokenWalletReservation,
      tokenFeatureRate,
      tokenTopupIntent,
      user,
    });

    try {
      const adjustment = await handlers.handleAdminWalletAdjustments(
        new Request("https://cloudmonkey.co.za/api/admin/wallet/adjust", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: fixture.userId,
            amountTokens: 75,
            reason: "manual wallet adjustment",
            direction: "credit",
          }),
        }),
      );

      expect(adjustment.status).toBe(201);

      const walletResponse = await handlers.handleAdminWallet(
        new Request("https://cloudmonkey.co.za/api/admin/wallet", { method: "GET" }),
      );
      const walletBody = (await walletResponse.json()) as any;

      expect(walletBody.wallets.some((row: any) => row.id === fixture.walletId && row.balanceTokens === 100)).toBe(
        true,
      );
      expect(walletBody.wallets.some((row: any) => row.user?.id === fixture.userId)).toBe(true);
      expect(walletBody.featureRates.length).toBeGreaterThan(0);
      expect(audits.some((entry) => entry.action === "wallet.manual_adjustment")).toBe(true);
    } finally {
      await cleanupWalletFixture(fixture);
    }
  });
});
