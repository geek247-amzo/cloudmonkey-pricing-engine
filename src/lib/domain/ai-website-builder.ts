/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { chargePlatformUsage, recordPlatformApiUsage } from "../platform-usage";

const builderRequestSchema = z.object({
  websiteId: z.string().min(1),
  brief: z.string().trim().min(20).max(6000),
  fallbackModel: z.enum(["claude-sonnet-5", "none"]).default("claude-sonnet-5"),
  deploy: z.boolean().default(false),
});

const manifestSchema = z.object({
  headline: z.string().min(1).max(160),
  subheadline: z.string().min(1).max(500),
  tone: z.string().min(1).max(120),
  seoTitle: z.string().min(1).max(160),
  seoDescription: z.string().min(1).max(320),
  navigation: z.array(z.string().min(1).max(80)).min(1).max(12),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(3000),
        cta: z.string().max(120).optional().default(""),
      }),
    )
    .min(1)
    .max(12),
  callsToAction: z.array(z.string().min(1).max(160)).max(6).default([]),
  imagePrompts: z.array(z.string().min(1).max(300)).max(12).default([]),
});

type BuilderDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  makeId: (prefix: string) => string;
  decryptSecret: (value: string) => string;
  reserveWalletUsage: (input: any) => Promise<any>;
  commitWalletReservation: (input: any) => Promise<any>;
  releaseWalletReservation: (input: any) => Promise<any>;
  provisionWebsiteRuntime: (
    userId: string,
    websiteId: string,
    options?: { skipAgreementCheck?: boolean; deploymentDomain?: "temporary" | "primary" },
  ) => Promise<any>;
  platformApiCredential: any;
  platformApiUsage: any;
  tokenWallet: any;
  tokenWalletLedger: any;
  website: any;
};

function parseManifest(text: string) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return manifestSchema.parse(JSON.parse(withoutFence));
}

async function requestClaude(input: { apiKey: string; model: string; brief: string }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 5000,
      temperature: 0.35,
      system:
        "You are CloudMonkey's senior website strategist. Return only valid JSON matching the requested website manifest. Write useful, specific South African business copy. Do not invent awards, client logos, statistics, prices, or guarantees.",
      messages: [
        {
          role: "user",
          content: `Create a website content and structure manifest from this brief:\n\n${input.brief}\n\nReturn JSON with exactly these top-level fields: headline, subheadline, tone, seoTitle, seoDescription, navigation (array), sections (array of {title, body, cta}), callsToAction (array), imagePrompts (array).`,
        },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(`Claude generation failed: ${response.status} ${body.error?.message ?? ""}`.trim()),
      {
        status: response.status,
      },
    );
  }
  const text = body.content?.find((part: any) => part.type === "text")?.text;
  if (!text) throw new Error("Claude returned no website manifest");
  return {
    manifest: parseManifest(text),
    inputTokens: Number(body.usage?.input_tokens ?? 0),
    outputTokens: Number(body.usage?.output_tokens ?? 0),
  };
}

export function createAiWebsiteBuilderHandlers(deps: BuilderDeps) {
  async function handlePublish(request: Request) {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);
    const body = await deps.parseBody(request, z.object({ websiteId: z.string().min(1) }));
    const site = await deps.db.query.website.findFirst({
      where: and(eq(deps.website.id, body.websiteId), eq(deps.website.userId, session.user.id)),
    });
    if (!site) return deps.json({ error: "Website not found" }, 404);
    const linkedDomain =
      site.primaryDomain && site.primaryDomain !== site.temporaryDomain ? site.primaryDomain : null;
    if (!linkedDomain) {
      return deps.json(
        { error: "Link a primary domain before publishing", needsDomain: true },
        409,
      );
    }
    try {
      const deployment = await deps.provisionWebsiteRuntime(session.user.id, site.id, {
        deploymentDomain: "primary",
      });
      await deps.db
        .update(deps.website)
        .set({ aiGenerationStatus: "published", updatedAt: new Date() })
        .where(eq(deps.website.id, site.id));
      return deps.json({ ok: true, domain: linkedDomain, deployment });
    } catch (error: any) {
      return deps.json({ error: error.message }, error.status ?? 500);
    }
  }

  async function handleGenerate(request: Request) {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    const body = await deps.parseBody(request, builderRequestSchema);
    const site = await deps.db.query.website.findFirst({
      where: and(eq(deps.website.id, body.websiteId), eq(deps.website.userId, session.user.id)),
    });
    if (!site) return deps.json({ error: "Website not found" }, 404);
    const previewDomain =
      site.temporaryDomain ||
      `${String(site.businessName || site.name || "preview")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${deps.makeId("preview").slice(-6)}.cloudmonkey.co.za`;
    if (!site.temporaryDomain) {
      await deps.db
        .update(deps.website)
        .set({ temporaryDomain: previewDomain, updatedAt: new Date() })
        .where(eq(deps.website.id, site.id));
    }

    const credential = await deps.db.query.platformApiCredential.findFirst({
      where: (row: any, operators: any) =>
        operators.and(operators.eq(row.provider, "anthropic"), operators.eq(row.status, "active")),
      orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
    });
    const apiKey = credential
      ? deps.decryptSecret(credential.keyEncrypted)
      : process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      return deps.json({ error: "No active Anthropic platform credential is configured" }, 503);

    const requestId = deps.makeId("builder");
    const reservation = await deps.reserveWalletUsage({
      userId: session.user.id,
      featureKey: "ai_website_builder",
      requestIdempotencyKey: requestId,
      sourceType: "ai_website_builder",
      sourceId: site.id,
      metadata: { websiteId: site.id, model: "claude-opus-4.8" },
    });
    let settled = false;
    try {
      let model = "claude-opus-4.8";
      let generated;
      try {
        generated = await requestClaude({ apiKey, model, brief: body.brief });
      } catch (error: any) {
        if (body.fallbackModel === "none" || [401, 403].includes(Number(error.status))) throw error;
        model = body.fallbackModel;
        generated = await requestClaude({ apiKey, model, brief: body.brief });
      }

      const [usage] = await recordPlatformApiUsage({
        db: deps.db,
        makeId: deps.makeId,
        platformApiUsage: deps.platformApiUsage,
        credentialId: credential?.id ?? null,
        userId: session.user.id,
        provider: "anthropic",
        model,
        featureKey: "ai_website_builder",
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        metadata: { websiteId: site.id, requestId, fallbackUsed: model !== "claude-opus-4.8" },
      });
      await deps.commitWalletReservation({
        reservationId: reservation.reservation.id,
        sourceId: usage.id,
        metadata: { provider: "anthropic", model, usageId: usage.id },
      });
      settled = true;
      const actualAdjustment = Number(usage.chargedTokens) - Number(reservation.chargeTokens);
      if (actualAdjustment !== 0) {
        await chargePlatformUsage({
          db: deps.db,
          makeId: deps.makeId,
          tokenWallet: deps.tokenWallet,
          tokenWalletLedger: deps.tokenWalletLedger,
          userId: session.user.id,
          usageId: usage.id,
          featureKey: "ai_website_builder",
          chargedTokens: actualAdjustment,
        });
      }

      const buildManifest = {
        ...generated.manifest,
        source: "ai_website_builder",
        generatedAt: new Date().toISOString(),
        model,
        brief: body.brief,
      };
      const [updated] = await deps.db
        .update(deps.website)
        .set({
          buildManifest: JSON.stringify(buildManifest),
          requirementManifest: JSON.stringify({ source: "ai_website_builder", brief: body.brief }),
          aiGenerationStatus: "generated",
          updatedAt: new Date(),
        })
        .where(eq(deps.website.id, site.id))
        .returning();
      let deployment = null;
      if (body.deploy) {
        deployment = await deps.provisionWebsiteRuntime(session.user.id, site.id);
      }
      return deps.json({
        website: { ...updated, temporaryDomain: previewDomain },
        manifest: buildManifest,
        usage,
        deployment,
        previewUrl: deployment?.runtime?.publicUrl ?? `https://${previewDomain}`,
      });
    } catch (error: any) {
      if (!settled) {
        await deps.releaseWalletReservation({
          reservationId: reservation.reservation.id,
          sourceId: site.id,
          metadata: { error: error.message },
        });
      }
      return deps.json({ error: error.message }, error.status ?? 500);
    }
  }

  return { handleGenerate, handlePublish };
}
