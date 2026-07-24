import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  detectedAiRuntime,
  serverAgent,
  serverContainer,
  serverDatabase,
  serverSecurityFinding,
  serverTelemetrySnapshot,
  serverWebsite,
  user,
  vultrInstance,
} from "../src/db/schema";
import { createAgentsRuntimeHandlers } from "../src/lib/domain/agents-runtime";

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

function makeTestDeps() {
  const counters = new Map<string, number>();
  return createAgentsRuntimeHandlers({
    db,
    json: jsonResponse,
    parseBody: async (request) => (await request.json()) as any,
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
    getRemoteIp: (request) =>
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "127.0.0.1",
    encryptSecret: (secret) => {
      return `enc:v1:local:${secret}`;
    },
    decryptSecret: (secret) => {
      const parts = secret.split(":");
      return parts.slice(3).join(":");
    },
    serverAgent,
    serverTelemetrySnapshot,
    serverSecurityFinding,
    serverWebsite,
    serverContainer,
    serverDatabase,
    detectedAiRuntime,
    vultrInstance,
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

function signAgentRequest(input: {
  secret: string;
  method: string;
  pathname: string;
  body: string;
  timestamp?: string;
  nonce?: string;
  agentId: string;
}) {
  const timestamp = input.timestamp ?? `${Date.now()}`;
  const nonce = input.nonce ?? crypto.randomBytes(12).toString("hex");
  const signature = crypto
    .createHmac("sha256", input.secret)
    .update(`${timestamp}.${nonce}.${input.method.toUpperCase()}.${input.pathname}.${input.body}`)
    .digest("hex");

  return {
    headers: {
      "x-cm-agent-id": input.agentId,
      "x-cm-timestamp": timestamp,
      "x-cm-nonce": nonce,
      "x-cm-signature": signature,
    },
  };
}

async function cleanupFixture(input: {
  agentId?: string;
  instanceId: string;
  adminUserId: string;
  ownerUserId: string;
}) {
  if (input.agentId) {
    await db.delete(serverTelemetrySnapshot).where(eq(serverTelemetrySnapshot.agentId, input.agentId));
    await db.delete(serverSecurityFinding).where(eq(serverSecurityFinding.agentId, input.agentId));
    await db.delete(serverWebsite).where(eq(serverWebsite.agentId, input.agentId));
    await db.delete(serverContainer).where(eq(serverContainer.agentId, input.agentId));
    await db.delete(serverDatabase).where(eq(serverDatabase.agentId, input.agentId));
    await db.delete(detectedAiRuntime).where(eq(detectedAiRuntime.agentId, input.agentId));
    await db.delete(serverAgent).where(eq(serverAgent.id, input.agentId));
  }
  await db.delete(serverAgent).where(eq(serverAgent.instanceId, input.instanceId));
  await db.delete(vultrInstance).where(eq(vultrInstance.id, input.instanceId));
  await db.delete(user).where(eq(user.id, input.adminUserId));
  await db.delete(user).where(eq(user.id, input.ownerUserId));
}

describe("agents runtime", () => {
  test("admin enrollment, signed enrollment, heartbeat, config, and snapshot all work", async () => {
    const adminUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const ownerUserId = `owner_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const instanceId = `inst_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const timestamp = new Date();
    const handlers = makeTestDeps();
    let agentId = "";
    let signingSecret = "";
    let enrollmentToken = "";

    await db.insert(user).values([
      {
        id: adminUserId,
        name: "Admin Tester",
        email: `agent-admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "admin",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: ownerUserId,
        name: "Agent Owner",
        email: `agent-owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);

    await db.insert(vultrInstance).values({
      id: instanceId,
      userId: ownerUserId,
      os: "Ubuntu 22.04",
      ram: 4096,
      disk: 80,
      mainIp: "10.0.0.1",
      region: "jnb1",
      status: "active",
      powerStatus: "running",
      label: "Agent Instance",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      const adminEnrollment = await handlers.handleAdminServerAgentEnrollment(
        await requestJson("/api/admin/server-agents/enrollment", "POST", {
          instanceId,
          name: "Primary runtime",
        }),
      );
      expect(adminEnrollment.status).toBe(201);
      const adminBody = await adminEnrollment.json();
      agentId = String(adminBody.agent.id);
      enrollmentToken = String(adminBody.enrollmentToken);
      expect(agentId).toBeTruthy();
      expect(enrollmentToken.startsWith("cm_enroll_")).toBe(true);

      const createdAgent = await db.query.serverAgent.findFirst({
        where: eq(serverAgent.id, agentId),
      });
      expect(createdAgent?.status).toBe("pending");
      expect(createdAgent?.enrollmentTokenHash).toBeTruthy();

      const enrollment = await handlers.handleAgentEnroll(
        await requestJson("/api/agent/enroll", "POST", {
          enrollmentToken,
          hostname: "agent-host",
          version: "1.0.0",
        }),
      );
      expect(enrollment.status).toBe(200);
      const enrollmentBody = await enrollment.json();
      signingSecret = String(enrollmentBody.signingSecret);
      expect(signingSecret.startsWith("cm_secret_")).toBe(true);
      expect(enrollmentBody.config.heartbeatIntervalSeconds).toBe(60);

      const enrolledAgent = await db.query.serverAgent.findFirst({
        where: eq(serverAgent.id, agentId),
      });
      expect(enrolledAgent?.status).toBe("online");
      expect(enrolledAgent?.enrollmentTokenHash).toBeNull();
      expect(enrolledAgent?.secretHash).toBeTruthy();

      const configHeaders = signAgentRequest({
        secret: signingSecret,
        method: "GET",
        pathname: "/api/agent/config",
        body: "",
        agentId,
      }).headers;
      const configResponse = await handlers.handleAgentConfig(
        new Request("https://cloudmonkey.co.za/api/agent/config", {
          method: "GET",
          headers: configHeaders,
        }),
      );
      expect(configResponse.status).toBe(200);
      const configBody = await configResponse.json();
      expect(configBody.agent.id).toBe(agentId);
      expect(configBody.config.snapshotIntervalSeconds).toBe(300);

      const heartbeatPayload = { status: "degraded", version: "1.0.1" };
      const heartbeatHeaders = signAgentRequest({
        secret: signingSecret,
        method: "POST",
        pathname: "/api/agent/heartbeat",
        body: JSON.stringify(heartbeatPayload),
        agentId,
      }).headers;
      const heartbeatResponse = await handlers.handleAgentHeartbeat(
        new Request("https://cloudmonkey.co.za/api/agent/heartbeat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...heartbeatHeaders,
          },
          body: JSON.stringify(heartbeatPayload),
        }),
      );
      expect(heartbeatResponse.status).toBe(200);
      const heartbeatBody = await heartbeatResponse.json();
      expect(heartbeatBody.ok).toBe(true);
      expect(heartbeatBody.agent.status).toBe("degraded");

      await db.insert(serverSecurityFinding).values({
        id: `finding_old_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        agentId,
        instanceId,
        userId: ownerUserId,
        code: "old_finding",
        title: "Old finding",
        severity: "low",
        status: "open",
        detail: null,
        evidence: null,
        observedAt: timestamp,
      });
      await db.insert(serverWebsite).values({
        id: `site_old_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        agentId,
        instanceId,
        userId: ownerUserId,
        url: "https://old.example.com",
        domain: "old.example.com",
        status: "unknown",
        httpStatus: null,
        redirectUrl: null,
        sslStatus: null,
        sslIssuer: null,
        sslExpiresAt: null,
        sslHostnameMatches: null,
        appType: null,
        source: null,
        raw: null,
        observedAt: timestamp,
      });
      await db.insert(serverContainer).values({
        id: `container_old_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        agentId,
        instanceId,
        userId: ownerUserId,
        containerId: "old-container",
        name: "old-container",
        image: "nginx:latest",
        status: "running",
        health: "healthy",
        ports: JSON.stringify([{ publicPort: 80 }]),
        labels: JSON.stringify({}),
        isPrivileged: false,
        restartCount: 0,
        observedAt: timestamp,
      });
      await db.insert(serverDatabase).values({
        id: `db_old_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        agentId,
        instanceId,
        userId: ownerUserId,
        engine: "postgres",
        version: "16",
        source: "container",
        containerName: "postgres",
        port: 5432,
        status: "running",
        isPublic: false,
        hasPersistentVolume: true,
        raw: JSON.stringify({}),
        observedAt: timestamp,
      });
      await db.insert(detectedAiRuntime).values({
        id: `airuntime_old_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        agentId,
        instanceId,
        userId: ownerUserId,
        runtime: "n8n",
        name: "old-runtime",
        image: "n8nio/n8n",
        version: "1.0",
        status: "running",
        health: "healthy",
        ports: JSON.stringify([{ publicPort: 5678 }]),
        raw: JSON.stringify({}),
        observedAt: timestamp,
      });

      const snapshotPayload = {
        observedAt: new Date().toISOString(),
        host: {
          hostname: "agent-host",
          osName: "Ubuntu",
          kernel: "6.5.0",
          uptimeSeconds: 12345,
        },
        metrics: {
          cpuUsagePercent: 33,
          memoryUsedMb: 2048,
          memoryTotalMb: 4096,
          diskUsedGb: 40,
          diskTotalGb: 80,
        },
        security: {
          score: 82,
          summary: "No critical issues",
          findings: [
            {
              code: "ssh_root_login_disabled",
              title: "Root login disabled",
              severity: "info",
              detail: "SSH is configured safely",
            },
          ],
        },
        websites: [
          {
            url: "https://example.com",
            domain: "example.com",
            status: "ok",
            httpStatus: 200,
            sslStatus: "valid",
          },
        ],
        containers: [
          {
            containerId: "container-new",
            name: "app",
            image: "ghcr.io/cloudmonkey/app:latest",
            status: "running",
            health: "healthy",
            ports: [{ publicPort: 8080 }],
            labels: { role: "app" },
            isPrivileged: false,
            restartCount: 1,
          },
        ],
        databases: [
          {
            engine: "postgres",
            version: "16",
            source: "container",
            containerName: "postgres",
            port: 5432,
            status: "running",
            isPublic: false,
            hasPersistentVolume: true,
          },
        ],
        aiRuntimes: [
          {
            runtime: "n8n",
            name: "automation",
            image: "n8nio/n8n",
            version: "1.105.0",
            status: "running",
            health: "healthy",
            ports: [{ publicPort: 5678 }],
          },
        ],
      };

      const snapshotHeaders = signAgentRequest({
        secret: signingSecret,
        method: "POST",
        pathname: "/api/agent/snapshot",
        body: JSON.stringify(snapshotPayload),
        agentId,
      }).headers;
      const snapshotResponse = await handlers.handleAgentSnapshot(
        new Request("https://cloudmonkey.co.za/api/agent/snapshot", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...snapshotHeaders,
          },
          body: JSON.stringify(snapshotPayload),
        }),
      );
      expect(snapshotResponse.status).toBe(200);
      const snapshotBody = await snapshotResponse.json();
      expect(snapshotBody.ok).toBe(true);
      expect(snapshotBody.snapshotId).toContain("snap_");

      const storedSnapshot = await db.query.serverTelemetrySnapshot.findFirst({
        where: eq(serverTelemetrySnapshot.agentId, agentId),
      });
      expect(storedSnapshot?.hostname).toBe("agent-host");
      expect(storedSnapshot?.cpuUsagePercent).toBe(33);

      const findings = await db.query.serverSecurityFinding.findMany({
        where: eq(serverSecurityFinding.agentId, agentId),
      });
      const websites = await db.query.serverWebsite.findMany({
        where: eq(serverWebsite.agentId, agentId),
      });
      const containers = await db.query.serverContainer.findMany({
        where: eq(serverContainer.agentId, agentId),
      });
      const databases = await db.query.serverDatabase.findMany({
        where: eq(serverDatabase.agentId, agentId),
      });
      const runtimes = await db.query.detectedAiRuntime.findMany({
        where: eq(detectedAiRuntime.agentId, agentId),
      });

      expect(findings.length).toBe(1);
      expect(findings[0]?.code).toBe("ssh_root_login_disabled");
      expect(websites.length).toBe(1);
      expect(websites[0]?.domain).toBe("example.com");
      expect(containers.length).toBe(1);
      expect(containers[0]?.containerId).toBe("container-new");
      expect(databases.length).toBe(1);
      expect(databases[0]?.engine).toBe("postgres");
      expect(runtimes.length).toBe(1);
      expect(runtimes[0]?.name).toBe("automation");
      expect(await db.query.serverSecurityFinding.findFirst({ where: eq(serverSecurityFinding.id, "old_finding") })).toBeUndefined();
    } finally {
      await cleanupFixture({
        agentId,
        instanceId,
        adminUserId,
        ownerUserId,
      });
    }
  });

  test("admin enrollment rotates the token for the same instance", async () => {
    const adminUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const ownerUserId = `owner_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const instanceId = `inst_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const timestamp = new Date();
    const handlers = makeTestDeps();

    await db.insert(user).values([
      {
        id: adminUserId,
        name: "Admin Tester",
        email: `agent-admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "admin",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: ownerUserId,
        name: "Agent Owner",
        email: `agent-owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);

    await db.insert(vultrInstance).values({
      id: instanceId,
      userId: ownerUserId,
      os: "Ubuntu 22.04",
      ram: 4096,
      disk: 80,
      mainIp: "10.0.0.2",
      region: "jnb1",
      status: "active",
      powerStatus: "running",
      label: "Agent Instance",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      const first = await handlers.handleAdminServerAgentEnrollment(
        await requestJson("/api/admin/server-agents/enrollment", "POST", { instanceId }),
      );
      expect(first.status).toBe(201);
      const firstBody = await first.json();
      const firstToken = String(firstBody.enrollmentToken);
      const agentId = String(firstBody.agent.id);

      const second = await handlers.handleAdminServerAgentEnrollment(
        await requestJson("/api/admin/server-agents/enrollment", "POST", { instanceId }),
      );
      expect(second.status).toBe(201);
      const secondBody = await second.json();

      expect(String(secondBody.agent.id)).toBe(agentId);
      expect(String(secondBody.enrollmentToken)).not.toBe(firstToken);
      const storedAgent = await db.query.serverAgent.findFirst({ where: eq(serverAgent.id, agentId) });
      expect(storedAgent?.status).toBe("pending");
    } finally {
      await cleanupFixture({
        agentId: undefined,
        instanceId,
        adminUserId,
        ownerUserId,
      });
    }
  });

  test("malformed snapshot payload is rejected", async () => {
    const adminUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const ownerUserId = `owner_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const instanceId = `inst_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const timestamp = new Date();
    const handlers = makeTestDeps();
    let agentId = "";
    let signingSecret = "";

    await db.insert(user).values([
      {
        id: adminUserId,
        name: "Admin Tester",
        email: `agent-admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "admin",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: ownerUserId,
        name: "Agent Owner",
        email: `agent-owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);

    await db.insert(vultrInstance).values({
      id: instanceId,
      userId: ownerUserId,
      os: "Ubuntu 22.04",
      ram: 4096,
      disk: 80,
      mainIp: "10.0.0.3",
      region: "jnb1",
      status: "active",
      powerStatus: "running",
      label: "Agent Instance",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      const adminEnrollment = await handlers.handleAdminServerAgentEnrollment(
        await requestJson("/api/admin/server-agents/enrollment", "POST", { instanceId }),
      );
      const adminBody = await adminEnrollment.json();
      agentId = String(adminBody.agent.id);
      const enrollment = await handlers.handleAgentEnroll(
        await requestJson("/api/agent/enroll", "POST", {
          enrollmentToken: String(adminBody.enrollmentToken),
        }),
      );
      const enrollmentBody = await enrollment.json();
      signingSecret = String(enrollmentBody.signingSecret);

      const invalidSnapshot = {
        host: {
          hostname: "agent-host",
        },
        metrics: {
          cpuUsagePercent: 101,
        },
      };
      const snapshotHeaders = signAgentRequest({
        secret: signingSecret,
        method: "POST",
        pathname: "/api/agent/snapshot",
        body: JSON.stringify(invalidSnapshot),
        agentId,
      }).headers;
      const snapshotResponse = await handlers.handleAgentSnapshot(
        new Request("https://cloudmonkey.co.za/api/agent/snapshot", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...snapshotHeaders,
          },
          body: JSON.stringify(invalidSnapshot),
        }),
      );

      expect(snapshotResponse.status).toBe(400);
      const snapshotBody = await snapshotResponse.json();
      expect(snapshotBody.error).toBe("Invalid request body");
      expect(await db.query.serverTelemetrySnapshot.findFirst({ where: eq(serverTelemetrySnapshot.agentId, agentId) })).toBeUndefined();
    } finally {
      await cleanupFixture({
        agentId,
        instanceId,
        adminUserId,
        ownerUserId,
      });
    }
  });
});
