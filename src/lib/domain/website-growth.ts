/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";

const activationSchema = z.object({
  dailyBudgetTokens: z.number().int().min(1000).max(1_000_000).optional(),
  maxChangesPerRun: z.number().int().min(1).max(50).optional(),
});

const messageSchema = z.object({ body: z.string().trim().min(1).max(10000) });
const decisionSchema = z.object({
  decision: z.enum(["approve", "reject", "request_changes"]),
  note: z.string().trim().max(4000).optional().default(""),
});
const statusSchema = z.object({ status: z.enum(["active", "paused"]) });

type GrowthDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: any) => Promise<unknown>;
  sendEmail: (input: any) => Promise<void>;
  makeId: (prefix: string) => string;
  website: any;
  user: any;
  websiteGrowthAgent: any;
  websiteGrowthRun: any;
  websiteGrowthMessage: any;
  websiteGrowthProposal: any;
  platformApiUsage: any;
  provisionWebsiteRuntime?: (userId: string, websiteId: string, options?: { deploymentDomain?: "temporary" | "primary" }) => Promise<unknown>;
};

function workerToken() {
  return process.env.GROWTH_AGENT_WORKER_TOKEN ?? process.env.CLOUDMONKEY_API_TOKEN;
}

function tomorrow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function sendGrowthEmail(deps: GrowthDeps, input: { to: string; subject: string; body: string; websiteId: string }) {
  try {
    await deps.sendEmail({
      template: "website_growth",
      to: input.to,
      subject: input.subject,
      data: {
        emailTitle: input.subject,
        emailIntro: input.body,
        primaryCtaText: "Open website growth workspace",
        primaryCtaUrl: `${process.env.BETTER_AUTH_URL ?? "https://cloudmonkey.co.za"}/dashboard/websites/${encodeURIComponent(input.websiteId)}/growth`,
      },
      idempotencyKey: `growth-${input.websiteId}-${input.subject}-${Date.now()}`,
    });
  } catch (error) {
    console.error("Growth agent notification failed", error);
  }
}

async function getOwnedAgent(deps: GrowthDeps, userId: string, websiteId: string) {
  const site = await deps.db.query.website.findFirst({
    where: and(eq(deps.website.id, websiteId), eq(deps.website.userId, userId)),
  });
  if (!site) return null;
  return deps.db.query.websiteGrowthAgent.findFirst({
    where: eq(deps.websiteGrowthAgent.websiteId, websiteId),
  });
}

async function activate(deps: GrowthDeps, websiteId: string, userId: string, body: unknown) {
  const site = await deps.db.query.website.findFirst({
    where: eq(deps.website.id, websiteId),
  });
  if (!site || site.userId !== userId) return null;
  const values = activationSchema.parse(body ?? {});
  const existing = await deps.db.query.websiteGrowthAgent.findFirst({
    where: eq(deps.websiteGrowthAgent.websiteId, websiteId),
  });
  if (existing) {
    const [updated] = await deps.db
      .update(deps.websiteGrowthAgent)
      .set({ status: "active", updatedAt: new Date(), ...values })
      .where(eq(deps.websiteGrowthAgent.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await deps.db
    .insert(deps.websiteGrowthAgent)
    .values({
      id: deps.makeId("growth"),
      websiteId,
      userId,
      status: "active",
      nextRunAt: new Date(),
      ...values,
    })
    .returning();
  await deps.recordAudit({
    actorUserId: userId,
    action: "website.growth.activate",
    entityType: "website",
    entityId: websiteId,
    message: "Website growth agent activated",
    metadata: { kpi: "qualified_leads", schedule: "daily" },
  });
  return created;
}

async function readWorkspace(deps: GrowthDeps, agent: any) {
  const [messages, proposals, runs] = await Promise.all([
    deps.db.query.websiteGrowthMessage.findMany({
      where: eq(deps.websiteGrowthMessage.agentId, agent.id),
      orderBy: (row: any, operators: any) => [operators.asc(row.createdAt)],
      limit: 200,
    }),
    deps.db.query.websiteGrowthProposal.findMany({
      where: eq(deps.websiteGrowthProposal.agentId, agent.id),
      orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
      limit: 50,
    }),
    deps.db.query.websiteGrowthRun.findMany({
      where: eq(deps.websiteGrowthRun.agentId, agent.id),
      orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
      limit: 50,
    }),
  ]);
  const usage = runs.length
    ? await deps.db.query.platformApiUsage.findMany({
        where: sql`${deps.platformApiUsage.growthAgentRunId} in (${sql.join(runs.map((run: any) => sql`${run.id}`), sql`, `)})`,
        orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
        limit: 100,
      }).catch(() => [])
    : [];
  return { agent, messages, proposals, runs, usage };
}

export function createWebsiteGrowthHandlers(deps: GrowthDeps) {
  async function handleUser(request: Request) {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const websiteId = parts[3];
    if (!websiteId) return deps.json({ error: "Website id is required" }, 400);
    const action = parts[4] ?? "workspace";
    if (action === "growth" && request.method === "GET") {
      const agent = await getOwnedAgent(deps, session.user.id, websiteId);
      if (!agent) return deps.json({ active: false, websiteId });
      return deps.json({ active: true, ...(await readWorkspace(deps, agent)) });
    }
    if (action === "growth" && request.method === "POST") {
      const agent = await activate(deps, websiteId, session.user.id, await request.json().catch(() => ({})));
      if (!agent) return deps.json({ error: "Website not found" }, 404);
      return deps.json({ active: true, agent });
    }
    if (action === "growth" && parts[5] === "messages" && request.method === "POST") {
      const agent = await getOwnedAgent(deps, session.user.id, websiteId);
      if (!agent) return deps.json({ error: "Growth agent is not active" }, 404);
      const body = await deps.parseBody(request, messageSchema);
      const [message] = await deps.db.insert(deps.websiteGrowthMessage).values({
        id: deps.makeId("growthmsg"), agentId: agent.id, websiteId, userId: session.user.id,
        senderRole: "customer", body: body.body, createdAt: new Date(),
      }).returning();
      await deps.db.update(deps.websiteGrowthAgent).set({ nextRunAt: new Date(), updatedAt: new Date() }).where(eq(deps.websiteGrowthAgent.id, agent.id));
      await deps.recordAudit({ actorUserId: session.user.id, action: "website.growth.message.create", entityType: "website_growth_message", entityId: message.id, message: "Customer sent a growth-agent message" });
      return deps.json(message, 201);
    }
    if (action === "growth" && parts[5] === "status" && request.method === "POST") {
      const agent = await getOwnedAgent(deps, session.user.id, websiteId);
      if (!agent) return deps.json({ error: "Growth agent is not active" }, 404);
      const body = await deps.parseBody(request, statusSchema);
      const [updated] = await deps.db.update(deps.websiteGrowthAgent).set({ status: body.status, updatedAt: new Date() }).where(eq(deps.websiteGrowthAgent.id, agent.id)).returning();
      await deps.recordAudit({ actorUserId: session.user.id, action: `website.growth.${body.status}`, entityType: "website_growth_agent", entityId: agent.id, message: `Customer ${body.status}d the growth agent` });
      return deps.json(updated);
    }
    if (action === "growth" && parts[5] === "proposals" && parts[6] && parts[7] === "decision" && request.method === "POST") {
      const agent = await getOwnedAgent(deps, session.user.id, websiteId);
      if (!agent) return deps.json({ error: "Growth agent is not active" }, 404);
      const proposal = await deps.db.query.websiteGrowthProposal.findFirst({ where: and(eq(deps.websiteGrowthProposal.id, parts[6]), eq(deps.websiteGrowthProposal.agentId, agent.id)) });
      if (!proposal) return deps.json({ error: "Proposal not found" }, 404);
      if (proposal.status !== "pending") return deps.json({ error: "Proposal has already been decided" }, 409);
      const body = await deps.parseBody(request, decisionSchema);
      const [updated] = await deps.db.update(deps.websiteGrowthProposal).set({ status: body.decision === "approve" ? "approved" : body.decision === "reject" ? "rejected" : "changes_requested", decisionNote: body.note || null, decidedByUserId: session.user.id, decidedAt: new Date(), updatedAt: new Date() }).where(eq(deps.websiteGrowthProposal.id, proposal.id)).returning();
      await deps.db.insert(deps.websiteGrowthMessage).values({ id: deps.makeId("growthmsg"), agentId: agent.id, websiteId, userId: session.user.id, senderRole: "customer", body: `Proposal decision: ${body.decision}${body.note ? `\n${body.note}` : ""}`, metadataJson: JSON.stringify({ proposalId: proposal.id, decision: body.decision }), createdAt: new Date() });
      if (body.decision === "approve") {
        await deps.db.insert(deps.websiteGrowthRun).values({ id: deps.makeId("growthrun"), agentId: agent.id, websiteId, status: "queued", scheduledAt: new Date(), metadataJson: JSON.stringify({ action: "apply_approved_proposal", proposalId: proposal.id }), createdAt: new Date() });
      }
      await deps.recordAudit({ actorUserId: session.user.id, action: `website.growth.proposal.${body.decision}`, entityType: "website_growth_proposal", entityId: proposal.id, message: `Customer ${body.decision.replace("_", " ")} growth proposal` });
      return deps.json(updated);
    }
    return deps.json({ error: "Not found" }, 404);
  }

  async function handleAdmin(request: Request) {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const websiteId = parts[3];
    if (!websiteId && request.method === "GET") {
      const agents = await deps.db.query.websiteGrowthAgent.findMany({ orderBy: (row: any, operators: any) => [operators.desc(row.updatedAt)] });
      return deps.json({ agents });
    }
    if (!websiteId) return deps.json({ error: "Website id is required" }, 400);
    if (request.method === "POST" && parts[4] === "activate") {
      const site = await deps.db.query.website.findFirst({ where: eq(deps.website.id, websiteId) });
      if (!site) return deps.json({ error: "Website not found" }, 404);
      const agent = await activate(deps, websiteId, site.userId, await request.json().catch(() => ({})));
      await deps.recordAudit({ actorUserId: session.user.id, action: "admin.website.growth.activate", entityType: "website", entityId: websiteId, message: "Admin activated website growth agent", metadata: { actedOnBehalfOf: site.userId } });
      return deps.json({ active: true, agent });
    }
    if (request.method === "GET") {
      const agent = await deps.db.query.websiteGrowthAgent.findFirst({ where: eq(deps.websiteGrowthAgent.websiteId, websiteId) });
      if (!agent) return deps.json({ active: false, websiteId });
      return deps.json({ active: true, ...(await readWorkspace(deps, agent)) });
    }
    return deps.json({ error: "Not found" }, 404);
  }

  async function authorizeWorker(request: Request) {
    const expected = workerToken();
    return Boolean(expected && request.headers.get("X-Growth-Agent-Token") === expected);
  }

  async function handleWorker(request: Request) {
    if (!(await authorizeWorker(request))) return deps.json({ error: "Unauthorized" }, 401);
    const path = new URL(request.url).pathname;
    if (path.endsWith("/claim") && request.method === "POST") {
      const claimed = await deps.db.transaction(async (tx: any) => {
        const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(771234) as locked`);
        if (!lock?.[0]?.locked) return null;
        const [agent] = await tx.select().from(deps.websiteGrowthAgent).where(and(eq(deps.websiteGrowthAgent.status, "active"), lte(deps.websiteGrowthAgent.nextRunAt, new Date()))).limit(1);
        if (!agent) return null;
        const runId = deps.makeId("growthrun");
        const now = new Date();
        await tx.update(deps.websiteGrowthAgent).set({ lastRunAt: now, nextRunAt: tomorrow(), updatedAt: now }).where(eq(deps.websiteGrowthAgent.id, agent.id));
        const [run] = await tx.insert(deps.websiteGrowthRun).values({ id: runId, agentId: agent.id, websiteId: agent.websiteId, status: "running", scheduledAt: now, claimedAt: now, heartbeatAt: now, createdAt: now }).returning();
        const site = await tx.query.website.findFirst({ where: eq(deps.website.id, agent.websiteId) });
        return { agent, run, site };
      });
      if (!claimed) return deps.json({ job: null });
      const workspace = await readWorkspace(deps, claimed.agent);
      return deps.json({ ...claimed, workspace });
    }
    const body = await request.json().catch(() => ({}));
    const runId = z.string().min(1).parse(body.runId);
    const run = await deps.db.query.websiteGrowthRun.findFirst({ where: eq(deps.websiteGrowthRun.id, runId) });
    if (!run) return deps.json({ error: "Run not found" }, 404);
    if (path.endsWith("/heartbeat")) {
      await deps.db.update(deps.websiteGrowthRun).set({ heartbeatAt: new Date() }).where(eq(deps.websiteGrowthRun.id, runId));
      return deps.json({ ok: true });
    }
    if (path.endsWith("/fail")) {
      const error = String(body.error ?? "Growth agent run failed").slice(0, 4000);
      await deps.db.update(deps.websiteGrowthRun).set({ status: "failed", error, completedAt: new Date(), metadataJson: JSON.stringify(body.metadata ?? {}) }).where(eq(deps.websiteGrowthRun.id, runId));
      const [agent] = await deps.db.select({ userId: deps.websiteGrowthAgent.userId }).from(deps.websiteGrowthAgent).where(eq(deps.websiteGrowthAgent.id, run.agentId));
      if (agent) await deps.db.insert(deps.websiteGrowthMessage).values({ id: deps.makeId("growthmsg"), agentId: run.agentId, websiteId: run.websiteId, runId, senderRole: "system", body: `Growth run failed: ${error}`, createdAt: new Date() });
      const recentFailures = await deps.db.query.websiteGrowthRun.findMany({ where: and(eq(deps.websiteGrowthRun.agentId, run.agentId), eq(deps.websiteGrowthRun.status, "failed")), orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)], limit: 3 });
      if (recentFailures.length >= 3) await deps.db.update(deps.websiteGrowthAgent).set({ status: "paused", updatedAt: new Date() }).where(eq(deps.websiteGrowthAgent.id, run.agentId));
      return deps.json({ ok: true });
    }
    if (path.endsWith("/complete")) {
      const usage = body.usage ?? {};
      const inputTokens = Number(usage.inputTokens ?? 0);
      const outputTokens = Number(usage.outputTokens ?? 0);
      const totalTokens = Number(usage.totalTokens ?? inputTokens + outputTokens);
      const provider = String(usage.provider ?? "openai");
      const model = String(usage.model ?? "codex-cli");
      const providerCostMicrousd = Number(usage.providerCostMicrousd ?? 0);
      const now = new Date();
      let proposal = null;
      if (body.proposal) {
        const proposalBody = z.object({ title: z.string().min(1).max(200), summary: z.string().min(1).max(10000), diff: z.unknown() }).parse(body.proposal);
        [proposal] = await deps.db.insert(deps.websiteGrowthProposal).values({ id: deps.makeId("growthprop"), agentId: run.agentId, websiteId: run.websiteId, runId, title: proposalBody.title, summary: proposalBody.summary, diffJson: JSON.stringify(proposalBody.diff), status: "pending", createdAt: now, updatedAt: now }).returning();
        await deps.db.insert(deps.websiteGrowthMessage).values({ id: deps.makeId("growthmsg"), agentId: run.agentId, websiteId: run.websiteId, runId, senderRole: "codex", body: `${proposalBody.title}\n\n${proposalBody.summary}`, metadataJson: JSON.stringify({ proposalId: proposal.id }), createdAt: now });
      }
      const [updatedRun] = await deps.db.update(deps.websiteGrowthRun).set({ status: "completed", completedAt: now, proposalId: proposal?.id ?? run.proposalId, provider, model, inputTokens, outputTokens, totalTokens, providerCostMicrousd, usageAvailable: body.usageAvailable !== false, metadataJson: JSON.stringify(body.metadata ?? {}) }).where(eq(deps.websiteGrowthRun.id, runId)).returning();
      if (body.deploymentRequest && deps.provisionWebsiteRuntime) {
        const deployment = z.object({ proposalId: z.string().min(1), deploymentDomain: z.enum(["temporary", "primary"]).default("temporary") }).parse(body.deploymentRequest);
        const approved = await deps.db.query.websiteGrowthProposal.findFirst({ where: and(eq(deps.websiteGrowthProposal.id, deployment.proposalId), eq(deps.websiteGrowthProposal.websiteId, run.websiteId), eq(deps.websiteGrowthProposal.status, "approved")) });
        if (!approved) return deps.json({ error: "Deployment requires an approved customer proposal" }, 409);
        const site = await deps.db.query.website.findFirst({ where: eq(deps.website.id, run.websiteId) });
        if (!site) return deps.json({ error: "Website not found" }, 404);
        try {
          await deps.provisionWebsiteRuntime(site.userId, site.id, { deploymentDomain: deployment.deploymentDomain });
          await deps.db.update(deps.websiteGrowthProposal).set({ deploymentStatus: "deployed", updatedAt: new Date() }).where(eq(deps.websiteGrowthProposal.id, approved.id));
        } catch (error: any) {
          await deps.db.update(deps.websiteGrowthProposal).set({ deploymentStatus: "failed", updatedAt: new Date() }).where(eq(deps.websiteGrowthProposal.id, approved.id));
          return deps.json({ error: error.message ?? "Approved deployment failed" }, error.status ?? 502);
        }
      }
      const runAgent = await deps.db.query.websiteGrowthAgent.findFirst({ where: eq(deps.websiteGrowthAgent.id, run.agentId) });
      await deps.db.insert(deps.platformApiUsage).values({ id: deps.makeId("apiusage"), userId: runAgent?.userId ?? null, growthAgentRunId: runId, provider, model, featureKey: "website_growth_agent", inputTokens: Math.max(0, inputTokens), outputTokens: Math.max(0, outputTokens), providerCostMicrousd: Math.max(0, providerCostMicrousd), chargedCostMicrousd: 0, chargedTokens: 0, metadataJson: JSON.stringify({ sponsored: true, usageAvailable: body.usageAvailable !== false, websiteId: run.websiteId }), createdAt: now }).catch((error: any) => console.error("Growth platform usage write failed", error));
      const agent = await deps.db.query.websiteGrowthAgent.findFirst({ where: eq(deps.websiteGrowthAgent.id, run.agentId) });
      const owner = agent ? await deps.db.query.user.findFirst({ where: eq(deps.user.id, agent.userId) }) : null;
      if (owner && (proposal || body.message)) await sendGrowthEmail(deps, { to: owner.email, subject: proposal ? "Your website growth proposal is ready" : "Your website growth agent replied", body: proposal?.summary ?? String(body.message), websiteId: run.websiteId });
      return deps.json({ ok: true, run: updatedRun, proposal });
    }
    return deps.json({ error: "Not found" }, 404);
  }

  return { handleUser, handleAdmin, handleWorker };
}
