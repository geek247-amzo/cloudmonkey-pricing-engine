/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { buildPaystackReference, initializePayment } from "../paystack";

export type WalletDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  makeId: (prefix: string) => string;
  initializePayment: typeof initializePayment;
  tokenWallet: any;
  tokenWalletLedger: any;
  tokenWalletReservation: any;
  tokenFeatureRate: any;
  tokenTopupIntent: any;
  user: any;
};

export type ReserveWalletUsageInput = {
  userId: string;
  featureKey: string;
  requestIdempotencyKey: string;
  sourceType: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  quantity?: number;
};

export type WalletReservationResult = {
  wallet: any;
  reservation: any;
  chargeTokens: number;
  reused: boolean;
};

type PaystackTopUpWebhookDeps = Pick<
  WalletDeps,
  | "db"
  | "recordAudit"
  | "makeId"
  | "tokenWallet"
  | "tokenWalletLedger"
  | "tokenWalletReservation"
  | "tokenTopupIntent"
>;

export const WALLET_TOKENS_PER_ZAR = 100;
export const WALLET_MIN_TOP_UP_TOKENS = 250 * WALLET_TOKENS_PER_ZAR;
export const WALLET_MAX_SELF_SERVICE_TOP_UP_TOKENS = 10_000 * WALLET_TOKENS_PER_ZAR;
export const WALLET_DEFAULT_LOW_BALANCE_TOKENS = 100 * WALLET_TOKENS_PER_ZAR;
export const WALLET_RECOMMENDED_TOP_UP_TOKENS = 500 * WALLET_TOKENS_PER_ZAR;

const walletTopUpSchema = z.object({
  amountTokens: z.coerce
    .number()
    .int()
    .min(WALLET_MIN_TOP_UP_TOKENS, "Minimum wallet top-up is R250")
    .max(WALLET_MAX_SELF_SERVICE_TOP_UP_TOKENS, "Top-ups above R10,000 require manual approval"),
  paymentMethod: z.string().optional().default("gateway"),
});

const walletSettingsSchema = z
  .object({
    autoTopUpEnabled: z.coerce.boolean().optional().default(false),
    autoTopUpThresholdTokens: z.coerce.number().int().min(0).optional().default(0),
    autoTopUpAmountTokens: z.coerce
      .number()
      .int()
      .min(0)
      .max(WALLET_MAX_SELF_SERVICE_TOP_UP_TOKENS)
      .optional()
      .default(0),
  })
  .superRefine((value, context) => {
    if (value.autoTopUpEnabled && value.autoTopUpAmountTokens < WALLET_MIN_TOP_UP_TOKENS) {
      context.addIssue({
        code: "custom",
        path: ["autoTopUpAmountTokens"],
        message: "Automatic top-up must be at least R250",
      });
    }
  })
  .strict();

const walletAdjustSchema = z.object({
  userId: z.string().min(1),
  amountTokens: z.coerce.number().int(),
  reason: z.string().min(3),
  direction: z.enum(["credit", "debit"]),
});

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toJson(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function normalizeQuantity(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
}

async function lockWalletRow(tx: any, deps: Pick<WalletDeps, "tokenWallet">, walletId: string) {
  await tx.execute(
    sql`select 1 from ${deps.tokenWallet} where ${deps.tokenWallet.id} = ${walletId} for update`,
  );
}

async function lockReservationRow(
  tx: any,
  deps: Pick<WalletDeps, "tokenWalletReservation">,
  reservationId: string,
) {
  await tx.execute(
    sql`select 1 from ${deps.tokenWalletReservation} where ${deps.tokenWalletReservation.id} = ${reservationId} for update`,
  );
}

async function lockTopUpIntentRow(
  tx: any,
  deps: Pick<WalletDeps, "tokenTopupIntent">,
  intentId: string,
) {
  await tx.execute(
    sql`select 1 from ${deps.tokenTopupIntent} where ${deps.tokenTopupIntent.id} = ${intentId} for update`,
  );
}

async function ensureWalletRow(
  tx: any,
  deps: Pick<WalletDeps, "tokenWallet" | "makeId">,
  userId: string,
) {
  const existing = await tx.query.tokenWallet.findFirst({
    where: eq(deps.tokenWallet.userId, userId),
  });
  if (existing) return existing;

  const [created] = await tx
    .insert(deps.tokenWallet)
    .values({
      id: deps.makeId("wallet"),
      userId,
      balanceTokens: 0,
      reservedTokens: 0,
      status: "active",
      autoTopUpEnabled: false,
      autoTopUpThresholdTokens: 0,
      autoTopUpAmountTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const retry = await tx.query.tokenWallet.findFirst({
    where: eq(deps.tokenWallet.userId, userId),
  });
  if (!retry) throw new Error("Failed to create wallet");
  return retry;
}

async function getFeatureRate(
  tx: any,
  deps: Pick<WalletDeps, "tokenFeatureRate">,
  featureKey: string,
) {
  const rate = await tx.query.tokenFeatureRate.findFirst({
    where: eq(deps.tokenFeatureRate.featureKey, featureKey),
  });
  if (!rate || !rate.active) {
    throw Object.assign(new Error(`Token feature rate not found for ${featureKey}`), {
      status: 404,
    });
  }
  return rate;
}

function computeChargeTokens(rate: { baseTokenCost: number; multiplierBps: number }, quantity = 1) {
  const units = normalizeQuantity(quantity);
  return Math.max(
    1,
    Math.ceil((Number(rate.baseTokenCost) * Number(rate.multiplierBps) * units) / 10000),
  );
}

async function insertLedgerRow(
  tx: any,
  deps: Pick<WalletDeps, "tokenWalletLedger" | "makeId">,
  input: {
    walletId: string;
    userId: string;
    entryType: string;
    direction: string;
    amountTokens: number;
    balanceBeforeTokens: number;
    balanceAfterTokens: number;
    reservedBeforeTokens: number;
    reservedAfterTokens: number;
    featureKey?: string | null;
    sourceType: string;
    sourceId?: string | null;
    idempotencyKey: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  const [row] = await tx
    .insert(deps.tokenWalletLedger)
    .values({
      id: deps.makeId("walledger"),
      walletId: input.walletId,
      userId: input.userId,
      entryType: input.entryType,
      direction: input.direction,
      amountTokens: input.amountTokens,
      balanceBeforeTokens: input.balanceBeforeTokens,
      balanceAfterTokens: input.balanceAfterTokens,
      reservedBeforeTokens: input.reservedBeforeTokens,
      reservedAfterTokens: input.reservedAfterTokens,
      featureKey: input.featureKey ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey,
      metadataJson: toJson(input.metadata),
      createdAt: new Date(),
    })
    .returning();
  return row;
}

export async function reserveWalletUsage(
  deps: WalletDeps,
  input: ReserveWalletUsageInput,
): Promise<WalletReservationResult> {
  return deps.db.transaction(async (tx: any) => {
    const wallet = await ensureWalletRow(tx, deps, input.userId);
    await lockWalletRow(tx, deps, wallet.id);

    const existingReservation = await tx.query.tokenWalletReservation.findFirst({
      where: eq(deps.tokenWalletReservation.walletId, wallet.id),
    });
    const duplicate = existingReservation
      ? await tx.query.tokenWalletReservation.findFirst({
          where: eq(deps.tokenWalletReservation.requestIdempotencyKey, input.requestIdempotencyKey),
        })
      : null;
    if (duplicate) {
      return {
        wallet,
        reservation: duplicate,
        chargeTokens: Number(duplicate.reservedTokens),
        reused: true,
      };
    }

    const rate = await getFeatureRate(tx, deps, input.featureKey);
    const chargeTokens = computeChargeTokens(rate, input.quantity);
    const availableTokens = Number(wallet.balanceTokens) - Number(wallet.reservedTokens);
    if (availableTokens < chargeTokens) {
      throw Object.assign(new Error("Insufficient token balance"), { status: 409 });
    }

    const [reservation] = await tx
      .insert(deps.tokenWalletReservation)
      .values({
        id: deps.makeId("walletres"),
        walletId: wallet.id,
        userId: input.userId,
        featureKey: input.featureKey,
        requestIdempotencyKey: input.requestIdempotencyKey,
        reservedTokens: chargeTokens,
        status: "pending",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        metadataJson: toJson(input.metadata),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    if (!reservation) {
      const existing = await tx.query.tokenWalletReservation.findFirst({
        where: eq(deps.tokenWalletReservation.requestIdempotencyKey, input.requestIdempotencyKey),
      });
      if (!existing) {
        throw new Error("Failed to create reservation");
      }
      return {
        wallet,
        reservation: existing,
        chargeTokens: Number(existing.reservedTokens),
        reused: true,
      };
    }

    const [updatedWallet] = await tx
      .update(deps.tokenWallet)
      .set({
        reservedTokens: Number(wallet.reservedTokens) + chargeTokens,
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenWallet.id, wallet.id))
      .returning();

    await insertLedgerRow(tx, deps, {
      walletId: wallet.id,
      userId: input.userId,
      entryType: "reservation_hold",
      direction: "reserve",
      amountTokens: chargeTokens,
      balanceBeforeTokens: Number(wallet.balanceTokens),
      balanceAfterTokens: Number(wallet.balanceTokens),
      reservedBeforeTokens: Number(wallet.reservedTokens),
      reservedAfterTokens: Number(updatedWallet.reservedTokens),
      featureKey: input.featureKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? reservation.id,
      idempotencyKey: input.requestIdempotencyKey,
      metadata: {
        ...input.metadata,
        reservationId: reservation.id,
        featureKey: input.featureKey,
      },
    });

    return {
      wallet: updatedWallet,
      reservation,
      chargeTokens,
      reused: false,
    };
  });
}

export async function commitWalletReservation(
  deps: WalletDeps,
  input: { reservationId: string; sourceId?: string | null; metadata?: Record<string, unknown> },
) {
  return deps.db.transaction(async (tx: any) => {
    const reservation = await tx.query.tokenWalletReservation.findFirst({
      where: eq(deps.tokenWalletReservation.id, input.reservationId),
    });
    if (!reservation) {
      throw Object.assign(new Error("Reservation not found"), { status: 404 });
    }

    await lockWalletRow(tx, deps, reservation.walletId);
    await lockReservationRow(tx, deps, reservation.id);

    const current = await tx.query.tokenWalletReservation.findFirst({
      where: eq(deps.tokenWalletReservation.id, reservation.id),
    });
    if (!current) {
      throw Object.assign(new Error("Reservation not found"), { status: 404 });
    }
    if (current.status === "committed") {
      return { reservation: current, committed: true, alreadySettled: true };
    }
    if (current.status !== "pending") {
      throw Object.assign(new Error("Reservation is no longer pending"), { status: 409 });
    }

    const wallet = await tx.query.tokenWallet.findFirst({
      where: eq(deps.tokenWallet.id, reservation.walletId),
    });
    if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

    const [updatedWallet] = await tx
      .update(deps.tokenWallet)
      .set({
        reservedTokens: Number(wallet.reservedTokens) - Number(current.reservedTokens),
        balanceTokens: Number(wallet.balanceTokens) - Number(current.reservedTokens),
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenWallet.id, wallet.id))
      .returning();

    const [updatedReservation] = await tx
      .update(deps.tokenWalletReservation)
      .set({
        status: "committed",
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenWalletReservation.id, current.id))
      .returning();

    await insertLedgerRow(tx, deps, {
      walletId: wallet.id,
      userId: reservation.userId,
      entryType: "reservation_commit",
      direction: "debit",
      amountTokens: Number(current.reservedTokens),
      balanceBeforeTokens: Number(wallet.balanceTokens),
      balanceAfterTokens: Number(updatedWallet.balanceTokens),
      reservedBeforeTokens: Number(wallet.reservedTokens),
      reservedAfterTokens: Number(updatedWallet.reservedTokens),
      featureKey: reservation.featureKey,
      sourceType: current.sourceType ?? "ai_usage",
      sourceId: input.sourceId ?? current.sourceId ?? current.id,
      idempotencyKey: `${current.id}:commit`,
      metadata: {
        ...(input.metadata ?? {}),
        reservationId: current.id,
      },
    });

    return { reservation: updatedReservation, committed: true, alreadySettled: false };
  });
}

export async function releaseWalletReservation(
  deps: WalletDeps,
  input: {
    reservationId: string;
    reason?: string;
    expired?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  return deps.db.transaction(async (tx: any) => {
    const reservation = await tx.query.tokenWalletReservation.findFirst({
      where: eq(deps.tokenWalletReservation.id, input.reservationId),
    });
    if (!reservation) {
      throw Object.assign(new Error("Reservation not found"), { status: 404 });
    }

    await lockWalletRow(tx, deps, reservation.walletId);
    await lockReservationRow(tx, deps, reservation.id);

    const current = await tx.query.tokenWalletReservation.findFirst({
      where: eq(deps.tokenWalletReservation.id, reservation.id),
    });
    if (!current) {
      throw Object.assign(new Error("Reservation not found"), { status: 404 });
    }
    if (["released", "expired", "failed"].includes(current.status)) {
      return { reservation: current, released: true, alreadySettled: true };
    }
    if (current.status === "committed") {
      throw Object.assign(new Error("Committed reservations cannot be released"), { status: 409 });
    }

    const wallet = await tx.query.tokenWallet.findFirst({
      where: eq(deps.tokenWallet.id, reservation.walletId),
    });
    if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

    const nextStatus = input.expired ? "expired" : "released";
    const [updatedWallet] = await tx
      .update(deps.tokenWallet)
      .set({
        reservedTokens: Number(wallet.reservedTokens) - Number(current.reservedTokens),
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenWallet.id, wallet.id))
      .returning();

    const [updatedReservation] = await tx
      .update(deps.tokenWalletReservation)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenWalletReservation.id, current.id))
      .returning();

    await insertLedgerRow(tx, deps, {
      walletId: wallet.id,
      userId: reservation.userId,
      entryType: nextStatus === "expired" ? "reservation_release" : "reservation_release",
      direction: "release",
      amountTokens: Number(current.reservedTokens),
      balanceBeforeTokens: Number(wallet.balanceTokens),
      balanceAfterTokens: Number(wallet.balanceTokens),
      reservedBeforeTokens: Number(wallet.reservedTokens),
      reservedAfterTokens: Number(updatedWallet.reservedTokens),
      featureKey: reservation.featureKey,
      sourceType: current.sourceType ?? "ai_usage",
      sourceId: input.reason ?? current.sourceId ?? current.id,
      idempotencyKey: `${current.id}:${nextStatus}`,
      metadata: {
        ...(input.metadata ?? {}),
        reservationId: current.id,
        status: nextStatus,
        reason: input.reason ?? null,
      },
    });

    return { reservation: updatedReservation, released: true, alreadySettled: false };
  });
}

export async function sweepExpiredReservations(deps: WalletDeps, ttlCutoff = new Date()) {
  const pending = await deps.db.query.tokenWalletReservation.findMany({
    where: lt(deps.tokenWalletReservation.expiresAt, ttlCutoff),
  });
  let expired = 0;
  let skipped = 0;

  for (const reservation of pending) {
    const result = await deps.db.transaction(async (tx: any) => {
      await lockWalletRow(tx, deps, reservation.walletId);
      await lockReservationRow(tx, deps, reservation.id);

      const current = await tx.query.tokenWalletReservation.findFirst({
        where: eq(deps.tokenWalletReservation.id, reservation.id),
      });
      if (!current || current.status !== "pending") {
        return { skipped: true as const };
      }

      const wallet = await tx.query.tokenWallet.findFirst({
        where: eq(deps.tokenWallet.id, reservation.walletId),
      });
      if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

      const [updatedWallet] = await tx
        .update(deps.tokenWallet)
        .set({
          reservedTokens: Number(wallet.reservedTokens) - Number(current.reservedTokens),
          updatedAt: new Date(),
        })
        .where(eq(deps.tokenWallet.id, wallet.id))
        .returning();

      const [updatedReservation] = await tx
        .update(deps.tokenWalletReservation)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(deps.tokenWalletReservation.id, current.id))
        .returning();

      await insertLedgerRow(tx, deps, {
        walletId: wallet.id,
        userId: reservation.userId,
        entryType: "reservation_release",
        direction: "release",
        amountTokens: Number(current.reservedTokens),
        balanceBeforeTokens: Number(wallet.balanceTokens),
        balanceAfterTokens: Number(wallet.balanceTokens),
        reservedBeforeTokens: Number(wallet.reservedTokens),
        reservedAfterTokens: Number(updatedWallet.reservedTokens),
        featureKey: current.featureKey,
        sourceType: current.sourceType ?? "ai_usage",
        sourceId: current.sourceId ?? current.id,
        idempotencyKey: `${current.id}:expired`,
        metadata: {
          reservationId: current.id,
          status: "expired",
        },
      });

      return { skipped: false as const, reservation: updatedReservation };
    });

    if (result.skipped) skipped += 1;
    else expired += 1;
  }

  return { scanned: pending.length, expired, skipped };
}

export async function createTopUpIntent(
  deps: WalletDeps,
  input: {
    userId: string;
    email: string;
    amountTokens: number;
    callbackUrl?: string;
    paymentMethod?: string;
  },
) {
  const intent = await deps.db.transaction(async (tx: any) => {
    const wallet = await ensureWalletRow(tx, deps, input.userId);
    const reference = buildPaystackReference("wallettopup");
    const intentId = deps.makeId("topup");
    const createdAt = new Date();

    const [intent] = await tx
      .insert(deps.tokenTopupIntent)
      .values({
        id: intentId,
        walletId: wallet.id,
        userId: input.userId,
        amountTokens: input.amountTokens,
        status: "pending",
        paystackReference: reference,
        paymentMethod: input.paymentMethod ?? "gateway",
        createdAt,
        metadataJson: JSON.stringify({
          walletId: wallet.id,
          userId: input.userId,
          amountTokens: input.amountTokens,
          reference,
        }),
      })
      .returning();

    return {
      intent,
      wallet,
      reference,
      intentId,
      createdAt,
    };
  });

  try {
    const payment = await deps.initializePayment({
      email: input.email,
      amountCents: input.amountTokens,
      invoiceId: intent.intentId,
      subscriptionId: intent.intentId,
      userId: input.userId,
      callbackUrl: input.callbackUrl,
      reference: intent.reference,
      metadata: {
        wallet_topup_intent_id: intent.intent.id,
        wallet_id: intent.wallet.id,
        amount_tokens: input.amountTokens,
      },
    });

    const [updated] = await deps.db
      .update(deps.tokenTopupIntent)
      .set({
        paystackUrl: payment.data.authorization_url,
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenTopupIntent.id, intent.intent.id))
      .returning();

    return {
      intent: updated,
      authorization_url: payment.data.authorization_url,
      access_code: payment.data.access_code,
      reference: payment.data.reference,
    };
  } catch (error: any) {
    await deps.db
      .update(deps.tokenTopupIntent)
      .set({
        status: "failed",
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenTopupIntent.id, intent.intent.id));
    throw error;
  }
}

export async function processPaystackTopUpWebhook(
  deps: PaystackTopUpWebhookDeps,
  input: { reference: string; metadata?: Record<string, unknown>; amountTokens?: number },
) {
  return deps.db.transaction(async (tx: any) => {
    const intent = await tx.query.tokenTopupIntent.findFirst({
      where: eq(deps.tokenTopupIntent.paystackReference, input.reference),
    });
    if (!intent) {
      return { ok: false as const, skipped: true as const, reason: "topup_intent_not_found" };
    }

    await lockWalletRow(tx, deps, intent.walletId);
    await lockTopUpIntentRow(tx, deps, intent.id);
    const currentIntent = await tx.query.tokenTopupIntent.findFirst({
      where: eq(deps.tokenTopupIntent.id, intent.id),
    });
    if (!currentIntent) {
      return { ok: false as const, skipped: true as const, reason: "topup_intent_missing" };
    }
    if (currentIntent.status === "paid") {
      return { ok: true as const, skipped: true as const, intent: currentIntent };
    }
    if (["failed", "cancelled", "reversed"].includes(currentIntent.status)) {
      return { ok: false as const, skipped: true as const, intent: currentIntent };
    }

    const wallet = await tx.query.tokenWallet.findFirst({
      where: eq(deps.tokenWallet.id, currentIntent.walletId),
    });
    if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

    const [updatedWallet] = await tx
      .update(deps.tokenWallet)
      .set({
        balanceTokens: Number(wallet.balanceTokens) + Number(currentIntent.amountTokens),
        lastLowBalanceAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenWallet.id, wallet.id))
      .returning();

    const [updatedIntent] = await tx
      .update(deps.tokenTopupIntent)
      .set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deps.tokenTopupIntent.id, currentIntent.id))
      .returning();

    await insertLedgerRow(tx, deps, {
      walletId: wallet.id,
      userId: currentIntent.userId,
      entryType: "topup_credit",
      direction: "credit",
      amountTokens: Number(currentIntent.amountTokens),
      balanceBeforeTokens: Number(wallet.balanceTokens),
      balanceAfterTokens: Number(updatedWallet.balanceTokens),
      reservedBeforeTokens: Number(wallet.reservedTokens),
      reservedAfterTokens: Number(updatedWallet.reservedTokens),
      featureKey: null,
      sourceType: "paystack_topup",
      sourceId: currentIntent.id,
      idempotencyKey: currentIntent.paystackReference,
      metadata: {
        ...input.metadata,
        topupIntentId: currentIntent.id,
        reference: currentIntent.paystackReference,
      },
    });

    await deps.recordAudit({
      actorUserId: currentIntent.userId,
      action: "wallet.topup.paid",
      entityType: "token_topup_intent",
      entityId: currentIntent.id,
      message: `Wallet top-up paid for ${currentIntent.amountTokens} tokens`,
      metadata: {
        reference: currentIntent.paystackReference,
        amountTokens: currentIntent.amountTokens,
        walletId: currentIntent.walletId,
      },
    });

    return {
      ok: true as const,
      skipped: false as const,
      intent: updatedIntent,
      wallet: updatedWallet,
    };
  });
}

export function createWalletHandlers(deps: WalletDeps) {
  async function handleUserWallet(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (request.method === "PATCH") {
      try {
        const body = (await deps.parseBody(request, walletSettingsSchema)) as z.infer<
          typeof walletSettingsSchema
        >;
        const result = await deps.db.transaction(async (tx: any) => {
          const wallet = await ensureWalletRow(tx, deps, session.user.id);
          await lockWalletRow(tx, deps, wallet.id);

          const [updatedWallet] = await tx
            .update(deps.tokenWallet)
            .set({
              autoTopUpEnabled: body.autoTopUpEnabled,
              autoTopUpThresholdTokens: body.autoTopUpThresholdTokens,
              autoTopUpAmountTokens: body.autoTopUpAmountTokens,
              updatedAt: new Date(),
            })
            .where(eq(deps.tokenWallet.id, wallet.id))
            .returning();

          return { wallet: updatedWallet };
        });

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "wallet.settings_updated",
          entityType: "token_wallet",
          entityId: result.wallet.id,
          message: `Wallet auto top-up settings updated`,
          metadata: {
            autoTopUpEnabled: body.autoTopUpEnabled,
            autoTopUpThresholdTokens: body.autoTopUpThresholdTokens,
            autoTopUpAmountTokens: body.autoTopUpAmountTokens,
          },
        });

        return deps.json({ ok: true, wallet: result.wallet });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (request.method !== "GET") return deps.json({ error: "Method not allowed" }, 405);

    const wallet = await deps.db.query.tokenWallet.findFirst({
      where: eq(deps.tokenWallet.userId, session.user.id),
    });
    const recentLedger = wallet
      ? await deps.db.query.tokenWalletLedger.findMany({
          where: eq(deps.tokenWalletLedger.walletId, wallet.id),
          orderBy: (ledger: any, { desc }: any) => [desc(ledger.createdAt)],
        })
      : [];
    const recentReservations = wallet
      ? await deps.db.query.tokenWalletReservation.findMany({
          where: eq(deps.tokenWalletReservation.walletId, wallet.id),
          orderBy: (reservation: any, { desc }: any) => [desc(reservation.createdAt)],
        })
      : [];
    const recentTopUps = wallet
      ? await deps.db.query.tokenTopupIntent.findMany({
          where: eq(deps.tokenTopupIntent.walletId, wallet.id),
          orderBy: (intent: any, { desc }: any) => [desc(intent.createdAt)],
        })
      : [];
    const rates = await deps.db.query.tokenFeatureRate.findMany({
      where: eq(deps.tokenFeatureRate.active, true),
      orderBy: (rate: any, { asc }: any) => [asc(rate.featureKey)],
    });

    return deps.json({
      wallet: wallet ?? null,
      availableTokens: wallet ? Number(wallet.balanceTokens) - Number(wallet.reservedTokens) : 0,
      ledger: recentLedger.slice(0, 25),
      reservations: recentReservations.slice(0, 25),
      topUpIntents: recentTopUps.slice(0, 25),
      featureRates: rates,
    });
  }

  async function handleUserWalletTopUps(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const body = (await deps.parseBody(request, walletTopUpSchema)) as z.infer<
        typeof walletTopUpSchema
      >;
      const email = session.user.email ?? "";
      if (!email) {
        return deps.json({ error: "User email is required to start a wallet top-up" }, 400);
      }
      const result = await createTopUpIntent(deps, {
        userId: session.user.id,
        email,
        amountTokens: body.amountTokens,
        callbackUrl: `${new URL(request.url).origin}/dashboard/wallet`,
        paymentMethod: body.paymentMethod,
      });

      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "wallet.topup.intent.created",
        entityType: "token_topup_intent",
        entityId: result.intent.id,
        message: `Wallet top-up intent created for ${body.amountTokens} tokens`,
        metadata: { amountTokens: body.amountTokens, reference: result.reference },
      });

      return deps.json({ ok: true, ...result }, 201);
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleAdminWallet(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (request.method === "GET") {
      const wallets = await deps.db.query.tokenWallet.findMany({
        orderBy: (wallet: any, { desc }: any) => [desc(wallet.updatedAt)],
      });
      const topUps = await deps.db.query.tokenTopupIntent.findMany({
        orderBy: (intent: any, { desc }: any) => [desc(intent.createdAt)],
      });
      const reservations = await deps.db.query.tokenWalletReservation.findMany({
        orderBy: (reservation: any, { desc }: any) => [desc(reservation.createdAt)],
      });
      const rates = await deps.db.query.tokenFeatureRate.findMany({
        orderBy: (rate: any, { asc }: any) => [asc(rate.featureKey)],
      });
      const owners = await Promise.all(
        wallets.map((wallet: any) =>
          deps.db.query.user.findFirst({ where: eq(deps.user.id, wallet.userId) }),
        ),
      );
      return deps.json({
        wallets: wallets.map((wallet: any, index: number) => ({
          ...wallet,
          user: owners[index] ?? null,
        })),
        topUpIntents: topUps,
        reservations,
        featureRates: rates,
      });
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminWalletAdjustments(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const body = (await deps.parseBody(request, walletAdjustSchema)) as z.infer<
        typeof walletAdjustSchema
      >;
      const now = new Date();
      const result = await deps.db.transaction(async (tx: any) => {
        const wallet = await ensureWalletRow(tx, deps, body.userId);
        await lockWalletRow(tx, deps, wallet.id);
        const delta = body.direction === "credit" ? body.amountTokens : -body.amountTokens;
        const [updatedWallet] = await tx
          .update(deps.tokenWallet)
          .set({
            balanceTokens: Number(wallet.balanceTokens) + delta,
            updatedAt: now,
          })
          .where(eq(deps.tokenWallet.id, wallet.id))
          .returning();

        await insertLedgerRow(tx, deps, {
          walletId: wallet.id,
          userId: body.userId,
          entryType: "manual_adjustment",
          direction: body.direction,
          amountTokens: Math.abs(body.amountTokens),
          balanceBeforeTokens: Number(wallet.balanceTokens),
          balanceAfterTokens: Number(updatedWallet.balanceTokens),
          reservedBeforeTokens: Number(wallet.reservedTokens),
          reservedAfterTokens: Number(updatedWallet.reservedTokens),
          featureKey: null,
          sourceType: "admin_adjustment",
          sourceId: session.user.id,
          idempotencyKey: `manual_adjustment:${wallet.id}:${sha256(`${body.direction}:${body.amountTokens}:${body.reason}:${now.toISOString()}`)}`,
          metadata: {
            reason: body.reason,
            direction: body.direction,
            adminUserId: session.user.id,
          },
        });

        return { wallet: updatedWallet };
      });

      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "wallet.manual_adjustment",
        entityType: "token_wallet",
        entityId: result.wallet.id,
        message: `Wallet ${body.direction} of ${body.amountTokens} tokens for ${body.userId}`,
        metadata: {
          reason: body.reason,
          direction: body.direction,
          amountTokens: body.amountTokens,
        },
      });

      return deps.json({ ok: true, wallet: result.wallet }, 201);
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  return {
    handleUserWallet,
    handleUserWalletTopUps,
    handleAdminWallet,
    handleAdminWalletAdjustments,
  };
}
