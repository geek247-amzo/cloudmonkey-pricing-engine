/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

const agentEnrollmentRequestSchema = z.object({
  instanceId: z.string().min(1),
  name: z.string().optional().nullable(),
});

const agentEnrollSchema = z.object({
  enrollmentToken: z.string().min(20),
  hostname: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
});

const agentHeartbeatSchema = z.object({
  hostname: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  status: z.enum(["online", "degraded", "offline"]).optional().default("online"),
});

const agentSnapshotSchema = z.object({
  observedAt: z.string().optional(),
  host: z
    .object({
      hostname: z.string().optional().nullable(),
      osName: z.string().optional().nullable(),
      kernel: z.string().optional().nullable(),
      uptimeSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
    })
    .optional()
    .default({}),
  metrics: z
    .object({
      cpuUsagePercent: z.coerce.number().int().min(0).max(100).optional().nullable(),
      memoryUsedMb: z.coerce.number().int().nonnegative().optional().nullable(),
      memoryTotalMb: z.coerce.number().int().nonnegative().optional().nullable(),
      diskUsedGb: z.coerce.number().int().nonnegative().optional().nullable(),
      diskTotalGb: z.coerce.number().int().nonnegative().optional().nullable(),
    })
    .optional()
    .default({}),
  security: z
    .object({
      score: z.coerce.number().int().min(0).max(100).optional().nullable(),
      summary: z.string().optional().nullable(),
      findings: z
        .array(
          z.object({
            code: z.string().min(1),
            title: z.string().min(1),
            severity: z.enum(["info", "low", "medium", "high", "critical"]).default("info"),
            detail: z.string().optional().nullable(),
            evidence: z.unknown().optional().nullable(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ findings: [] }),
  websites: z
    .array(
      z.object({
        url: z.string().min(1),
        domain: z.string().min(1),
        status: z.string().optional().default("unknown"),
        httpStatus: z.coerce.number().int().optional().nullable(),
        redirectUrl: z.string().optional().nullable(),
        sslStatus: z.string().optional().nullable(),
        sslIssuer: z.string().optional().nullable(),
        sslExpiresAt: z.string().optional().nullable(),
        sslHostnameMatches: z.boolean().optional().nullable(),
        appType: z.string().optional().nullable(),
        source: z.string().optional().nullable(),
      }),
    )
    .optional()
    .default([]),
  containers: z
    .array(
      z.object({
        containerId: z.string().min(1),
        name: z.string().min(1),
        image: z.string().min(1),
        status: z.string().min(1),
        health: z.string().optional().nullable(),
        ports: z.unknown().optional().nullable(),
        labels: z.unknown().optional().nullable(),
        isPrivileged: z.boolean().optional().default(false),
        restartCount: z.coerce.number().int().nonnegative().optional().default(0),
      }),
    )
    .optional()
    .default([]),
  databases: z
    .array(
      z.object({
        engine: z.string().min(1),
        version: z.string().optional().nullable(),
        source: z.string().optional().default("container"),
        containerName: z.string().optional().nullable(),
        port: z.coerce.number().int().optional().nullable(),
        status: z.string().optional().default("unknown"),
        isPublic: z.boolean().optional().default(false),
        hasPersistentVolume: z.boolean().optional().default(false),
      }),
    )
    .optional()
    .default([]),
  aiRuntimes: z
    .array(
      z.object({
        runtime: z.enum(["hermes", "openclaw", "n8n"]),
        name: z.string().min(1),
        image: z.string().optional().nullable(),
        version: z.string().optional().nullable(),
        status: z.string().optional().default("unknown"),
        health: z.string().optional().nullable(),
        ports: z.unknown().optional().nullable(),
      }),
    )
    .optional()
    .default([]),
});

type AgentsRuntimeDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  makeId: (prefix: string) => string;
  getRemoteIp: (request: Request) => string | null;
  encryptSecret: (secret: string) => string;
  decryptSecret: (secret: string) => string;
  serverAgent: any;
  serverTelemetrySnapshot: any;
  serverSecurityFinding: any;
  serverWebsite: any;
  serverContainer: any;
  serverDatabase: any;
  detectedAiRuntime: any;
  vultrInstance: any;
  user: any;
};

function getAgentConfig() {
  return {
    heartbeatIntervalSeconds: 60,
    snapshotIntervalSeconds: 300,
    dockerEnabled: true,
    websiteDiscoveryEnabled: true,
    securityScanEnabled: true,
  };
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signAgentPayload(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  method: string;
  pathname: string;
  body: string;
}) {
  return crypto
    .createHmac("sha256", input.secret)
    .update(
      `${input.timestamp}.${input.nonce}.${input.method.toUpperCase()}.${input.pathname}.${input.body}`,
    )
    .digest("hex");
}

function toJsonText(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function toDateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createAgentsRuntimeHandlers(deps: AgentsRuntimeDeps) {
  async function readSignedAgentRequest(request: Request, url: URL) {
    const agentId = request.headers.get("x-cm-agent-id");
    const timestamp = request.headers.get("x-cm-timestamp");
    const nonce = request.headers.get("x-cm-nonce");
    const signature = request.headers.get("x-cm-signature");
    const bodyText = await request.text();

    if (!agentId || !timestamp || !nonce || !signature) {
      return { response: deps.json({ error: "Missing agent signature headers" }, 401) };
    }

    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) {
      return { response: deps.json({ error: "Stale agent signature" }, 401) };
    }

    const agent = await deps.db.query.serverAgent.findFirst({
      where: eq(deps.serverAgent.id, agentId),
    });
    if (!agent?.secretHash) {
      return { response: deps.json({ error: "Unknown agent" }, 401) };
    }

    const expected = signAgentPayload({
      secret: deps.decryptSecret(agent.secretHash),
      timestamp,
      nonce,
      method: request.method,
      pathname: url.pathname,
      body: bodyText,
    });
    if (!safeEqual(expected, signature)) {
      return { response: deps.json({ error: "Invalid agent signature" }, 401) };
    }

    return { agent, bodyText };
  }

  async function handleAdminServerAgentEnrollment(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;

    try {
      const body = await deps.parseBody(request, agentEnrollmentRequestSchema);
      const instance = await deps.db.query.vultrInstance.findFirst({
        where: eq(deps.vultrInstance.id, body.instanceId),
      });
      if (!instance) {
        return deps.json({ error: "CloudMonkey VPS server is not assigned in CloudMonkey" }, 404);
      }

      const enrollmentToken = `cm_enroll_${crypto.randomBytes(32).toString("base64url")}`;
      const existingAgent = await deps.db.query.serverAgent.findFirst({
        where: eq(deps.serverAgent.instanceId, instance.id),
      });
      const agentId = existingAgent?.id ?? deps.makeId("agent");
      const [agent] = await deps.db
        .insert(deps.serverAgent)
        .values({
          id: agentId,
          instanceId: instance.id,
          userId: instance.userId,
          name: body.name ?? instance.label ?? instance.id,
          status: "pending",
          enrollmentTokenHash: sha256(enrollmentToken),
          config: JSON.stringify(getAgentConfig()),
        })
        .onConflictDoUpdate({
          target: deps.serverAgent.id,
          set: {
            enrollmentTokenHash: sha256(enrollmentToken),
            status: "pending",
            updatedAt: new Date(),
          },
        })
        .returning();

      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "server_agent.enrollment_created",
        entityType: "server_agent",
        entityId: agent.id,
        message: `Server agent enrollment token created for ${instance.label || instance.id}`,
        metadata: { instanceId: instance.id },
      });

      const installCommand = `curl -fsSL https://cloudmonkey.co.za/install-agent.sh | sudo CM_ENROLLMENT_TOKEN='${enrollmentToken}' bash`;
      return deps.json(
        {
          agent,
          enrollmentToken,
          installCommand,
          expiresHint: "Token is one-time use. Regenerate if it is exposed before enrollment.",
        },
        201,
      );
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleAgentEnroll(request: Request): Promise<Response> {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const body = await deps.parseBody(request, agentEnrollSchema);
      const tokenHash = sha256(body.enrollmentToken);
      const agent = await deps.db.query.serverAgent.findFirst({
        where: eq(deps.serverAgent.enrollmentTokenHash, tokenHash),
      });
      if (!agent) return deps.json({ error: "Invalid enrollment token" }, 401);

      const signingSecret = `cm_secret_${crypto.randomBytes(32).toString("base64url")}`;
      const config = getAgentConfig();
      const [updated] = await deps.db
        .update(deps.serverAgent)
        .set({
          secretHash: deps.encryptSecret(signingSecret),
          enrollmentTokenHash: null,
          hostname: body.hostname ?? agent.hostname,
          version: body.version ?? agent.version,
          status: "online",
          enrolledAt: new Date(),
          lastSeenAt: new Date(),
          lastIp: deps.getRemoteIp(request),
          config: JSON.stringify(config),
          updatedAt: new Date(),
        })
        .where(eq(deps.serverAgent.id, agent.id))
        .returning();

      return deps.json({
        agentId: updated.id,
        signingSecret,
        config,
      });
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleAgentConfig(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const signed = await readSignedAgentRequest(request, url);
    if (signed.response) return signed.response;
    return deps.json({
      config: getAgentConfig(),
      agent: { id: signed.agent.id, instanceId: signed.agent.instanceId },
    });
  }

  async function handleAgentHeartbeat(request: Request): Promise<Response> {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const signed = await readSignedAgentRequest(request, url);
    if (signed.response) return signed.response;
    try {
      const parsedBody = signed.bodyText ? JSON.parse(signed.bodyText) : {};
      const parsed = agentHeartbeatSchema.safeParse(parsedBody);
      if (!parsed.success) {
        return deps.json({ error: "Invalid request body", issues: parsed.error.flatten() }, 400);
      }
      const body = parsed.data;
      const [updated] = await deps.db
        .update(deps.serverAgent)
        .set({
          hostname: body.hostname ?? signed.agent.hostname,
          version: body.version ?? signed.agent.version,
          status: body.status,
          lastSeenAt: new Date(),
          lastIp: deps.getRemoteIp(request),
          updatedAt: new Date(),
        })
        .where(eq(deps.serverAgent.id, signed.agent.id))
        .returning();
      return deps.json({
        ok: true,
        agent: { id: updated.id, status: updated.status, lastSeenAt: updated.lastSeenAt },
      });
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        return deps.json({ error: "Invalid request body" }, 400);
      }
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleAgentSnapshot(request: Request): Promise<Response> {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const signed = await readSignedAgentRequest(request, url);
    if (signed.response) return signed.response;
    try {
      const parsedBody = signed.bodyText ? JSON.parse(signed.bodyText) : {};
      const parsed = agentSnapshotSchema.safeParse(parsedBody);
      if (!parsed.success) {
        return deps.json({ error: "Invalid request body", issues: parsed.error.flatten() }, 400);
      }
      const body = parsed.data;
      const observedAt = toDateOrNull(body.observedAt) ?? new Date();
      const snapshotId = deps.makeId("snap");

      await deps.db.insert(deps.serverTelemetrySnapshot).values({
        id: snapshotId,
        agentId: signed.agent.id,
        instanceId: signed.agent.instanceId,
        userId: signed.agent.userId,
        status: "online",
        hostname: body.host.hostname ?? signed.agent.hostname,
        osName: body.host.osName,
        kernel: body.host.kernel,
        uptimeSeconds: body.host.uptimeSeconds ?? null,
        cpuUsagePercent: body.metrics.cpuUsagePercent ?? null,
        memoryUsedMb: body.metrics.memoryUsedMb ?? null,
        memoryTotalMb: body.metrics.memoryTotalMb ?? null,
        diskUsedGb: body.metrics.diskUsedGb ?? null,
        diskTotalGb: body.metrics.diskTotalGb ?? null,
        securityScore: body.security.score ?? null,
        securitySummary: body.security.summary ?? null,
        raw: JSON.stringify(body),
        observedAt,
      });

      await Promise.all([
        deps.db.delete(deps.serverSecurityFinding).where(eq(deps.serverSecurityFinding.agentId, signed.agent.id)),
        deps.db.delete(deps.serverWebsite).where(eq(deps.serverWebsite.agentId, signed.agent.id)),
        deps.db.delete(deps.serverContainer).where(eq(deps.serverContainer.agentId, signed.agent.id)),
        deps.db.delete(deps.serverDatabase).where(eq(deps.serverDatabase.agentId, signed.agent.id)),
        deps.db.delete(deps.detectedAiRuntime).where(eq(deps.detectedAiRuntime.agentId, signed.agent.id)),
      ]);

      if (body.security.findings.length) {
        await deps.db.insert(deps.serverSecurityFinding).values(
          body.security.findings.map((finding) => ({
            id: deps.makeId("finding"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            code: finding.code,
            title: finding.title,
            severity: finding.severity,
            status: "open",
            detail: finding.detail ?? null,
            evidence: toJsonText(finding.evidence),
            observedAt,
          })),
        );
      }

      if (body.websites.length) {
        await deps.db.insert(deps.serverWebsite).values(
          body.websites.map((site) => ({
            id: deps.makeId("siteobs"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            url: site.url,
            domain: site.domain,
            status: site.status,
            httpStatus: site.httpStatus ?? null,
            redirectUrl: site.redirectUrl ?? null,
            sslStatus: site.sslStatus ?? null,
            sslIssuer: site.sslIssuer ?? null,
            sslExpiresAt: toDateOrNull(site.sslExpiresAt),
            sslHostnameMatches: site.sslHostnameMatches ?? null,
            appType: site.appType ?? null,
            source: site.source ?? null,
            raw: JSON.stringify(site),
            observedAt,
          })),
        );
      }

      if (body.containers.length) {
        await deps.db.insert(deps.serverContainer).values(
          body.containers.map((container) => ({
            id: deps.makeId("container"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            containerId: container.containerId,
            name: container.name,
            image: container.image,
            status: container.status,
            health: container.health ?? null,
            ports: toJsonText(container.ports),
            labels: toJsonText(container.labels),
            isPrivileged: container.isPrivileged,
            restartCount: container.restartCount,
            observedAt,
          })),
        );
      }

      if (body.databases.length) {
        await deps.db.insert(deps.serverDatabase).values(
          body.databases.map((database) => ({
            id: deps.makeId("dbobs"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            engine: database.engine,
            version: database.version ?? null,
            source: database.source,
            containerName: database.containerName ?? null,
            port: database.port ?? null,
            status: database.status,
            isPublic: database.isPublic,
            hasPersistentVolume: database.hasPersistentVolume,
            raw: JSON.stringify(database),
            observedAt,
          })),
        );
      }

      if (body.aiRuntimes.length) {
        await deps.db.insert(deps.detectedAiRuntime).values(
          body.aiRuntimes.map((runtime) => ({
            id: deps.makeId("airuntime"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            runtime: runtime.runtime,
            name: runtime.name,
            image: runtime.image ?? null,
            version: runtime.version ?? null,
            status: runtime.status,
            health: runtime.health ?? null,
            ports: toJsonText(runtime.ports),
            raw: JSON.stringify(runtime),
            observedAt,
          })),
        );
      }

      await deps.db
        .update(deps.serverAgent)
        .set({
          hostname: body.host.hostname ?? signed.agent.hostname,
          status: "online",
          lastSeenAt: new Date(),
          lastIp: deps.getRemoteIp(request),
          updatedAt: new Date(),
        })
        .where(eq(deps.serverAgent.id, signed.agent.id));

      return deps.json({ ok: true, snapshotId });
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        return deps.json({ error: "Invalid request body" }, 400);
      }
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  return {
    handleAdminServerAgentEnrollment,
    handleAgentEnroll,
    handleAgentConfig,
    handleAgentHeartbeat,
    handleAgentSnapshot,
  };
}
