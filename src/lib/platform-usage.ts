/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, sql } from "drizzle-orm";

export const PLATFORM_PROVIDERS = ["mailjet", "openai", "anthropic", "gemini"] as const;
export type PlatformProvider = (typeof PLATFORM_PROVIDERS)[number];
export const PLATFORM_CREDENTIAL_STATUSES = ["active", "invalid", "revoked"] as const;

// USD per one million tokens. Keep this map aligned with the Business Overview pricing sheet.
export const PROVIDER_RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
};

export const PLATFORM_MARKUP_BPS = 17000;
export const WALLET_TOKENS_PER_ZAR = 100;

export function providerCostMicrousd(model: string, inputTokens: number, outputTokens: number) {
  const rate = PROVIDER_RATES[model] ?? { input: 0, output: 0 };
  return Math.max(
    0,
    Math.ceil(
      ((Math.max(0, inputTokens) * rate.input + Math.max(0, outputTokens) * rate.output) /
        1_000_000) *
        1_000_000,
    ),
  );
}

export function chargedWalletTokens(providerCost: number) {
  const markedUpUsd = (providerCost * PLATFORM_MARKUP_BPS) / 10000 / 1_000_000;
  const usdToZar = Number(process.env.USD_TO_ZAR_RATE ?? 18.5);
  return Math.max(1, Math.ceil(markedUpUsd * usdToZar * WALLET_TOKENS_PER_ZAR));
}

export async function recordPlatformApiUsage(input: {
  db: any;
  makeId: (prefix: string) => string;
  platformApiUsage: any;
  credentialId?: string | null;
  userId?: string | null;
  provider: PlatformProvider;
  model: string;
  featureKey: string;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, unknown>;
}) {
  const cost = providerCostMicrousd(input.model, input.inputTokens, input.outputTokens);
  const charged = Math.ceil((cost * PLATFORM_MARKUP_BPS) / 10000);
  const tokens = chargedWalletTokens(cost);
  return input.db
    .insert(input.platformApiUsage)
    .values({
      id: input.makeId("apiusage"),
      credentialId: input.credentialId ?? null,
      userId: input.userId ?? null,
      provider: input.provider,
      model: input.model,
      featureKey: input.featureKey,
      inputTokens: Math.max(0, input.inputTokens),
      outputTokens: Math.max(0, input.outputTokens),
      providerCostMicrousd: cost,
      chargedCostMicrousd: charged,
      chargedTokens: tokens,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: new Date(),
    })
    .returning();
}

export async function chargePlatformUsage(input: {
  db: any;
  makeId: (prefix: string) => string;
  tokenWallet: any;
  tokenWalletLedger: any;
  userId: string;
  usageId: string;
  featureKey: string;
  chargedTokens: number;
}) {
  return input.db.transaction(async (tx: any) => {
    const wallet = await tx.query.tokenWallet.findFirst({
      where: (row: any, operators: any) => operators.eq(row.userId, input.userId),
    });
    if (!wallet) throw Object.assign(new Error("Token wallet not found"), { status: 404 });
    await tx.execute(
      sql`select 1 from ${input.tokenWallet} where ${input.tokenWallet.id} = ${wallet.id} for update`,
    );
    const available = Number(wallet.balanceTokens) - Number(wallet.reservedTokens);
    if (available < input.chargedTokens) {
      throw Object.assign(new Error("Insufficient token balance"), { status: 409 });
    }
    const [updated] = await tx
      .update(input.tokenWallet)
      .set({
        balanceTokens: Number(wallet.balanceTokens) - input.chargedTokens,
        updatedAt: new Date(),
      })
      .where(eq(input.tokenWallet.id, wallet.id))
      .returning();
    await tx.insert(input.tokenWalletLedger).values({
      id: input.makeId("walledger"),
      walletId: wallet.id,
      userId: input.userId,
      entryType: "usage_charge",
      direction: "debit",
      amountTokens: input.chargedTokens,
      balanceBeforeTokens: Number(wallet.balanceTokens),
      balanceAfterTokens: Number(updated.balanceTokens),
      reservedBeforeTokens: Number(wallet.reservedTokens),
      reservedAfterTokens: Number(wallet.reservedTokens),
      featureKey: input.featureKey,
      sourceType: "platform_api_usage",
      sourceId: input.usageId,
      idempotencyKey: `platform-api:${input.usageId}`,
      metadataJson: JSON.stringify({ usageId: input.usageId, markupBps: PLATFORM_MARKUP_BPS }),
      createdAt: new Date(),
    });
    return updated;
  });
}

export async function loadActivePlatformCredential(
  db: any,
  platformApiCredential: any,
  provider: string,
) {
  return db.query.platformApiCredential.findFirst({
    where: (row: any, operators: any) =>
      operators.and(eq(row.provider, provider), eq(row.status, "active")),
    orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
  });
}
