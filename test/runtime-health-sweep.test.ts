import { describe, expect, test } from "bun:test";
import {
  runRuntimeHealthSweep,
  type RuntimeHealthSweepRecord,
} from "../src/lib/runtime-health-sweep";

const runtime = (overrides: Partial<RuntimeHealthSweepRecord> = {}): RuntimeHealthSweepRecord => ({
  id: "runtime-1",
  status: "active",
  provisionerUrl: "http://10.66.66.3:8787",
  hostname: "runtime1",
  label: "Runtime 1",
  lastHealthCheckAt: new Date("2026-07-23T08:00:00.000Z"),
  lastError: null,
  ...overrides,
});

function depsFor(record: RuntimeHealthSweepRecord, result: { ok: boolean; status: number }) {
  const persisted: Array<Record<string, unknown>> = [];
  const alerts: string[] = [];
  return {
    persisted,
    alerts,
    deps: {
      now: () => new Date("2026-07-23T09:00:00.000Z"),
      timeoutMs: 10_000,
      repeatAlertAfterMs: 30 * 60 * 1000,
      getRuntimes: async () => [record],
      checkHealth: async () => result,
      persist: async (_runtime: RuntimeHealthSweepRecord, values: Record<string, unknown>) => {
        persisted.push(values);
      },
      hasRecentFailureAlert: async () => false,
      sendAlert: async (kind: "failure" | "recovery") => {
        alerts.push(kind);
      },
      withLock: async (work: () => Promise<unknown>) => work(),
    },
  };
}

describe("runRuntimeHealthSweep", () => {
  test("performs a real health check and advances the successful timestamp", async () => {
    const setup = depsFor(runtime(), { ok: true, status: 200 });
    const result = await runRuntimeHealthSweep(setup.deps);

    expect(result).toEqual({ checked: 1, failures: 0, recoveries: 0 });
    expect(setup.persisted).toEqual([
      {
        lastHealthCheckAt: new Date("2026-07-23T09:00:00.000Z"),
        lastError: null,
        updatedAt: new Date("2026-07-23T09:00:00.000Z"),
      },
    ]);
  });

  test("preserves the prior successful timestamp on an HTTP failure", async () => {
    const setup = depsFor(runtime(), { ok: false, status: 502 });
    const result = await runRuntimeHealthSweep(setup.deps);

    expect(result).toEqual({ checked: 1, failures: 1, recoveries: 0 });
    expect(setup.persisted[0]).toEqual({
      lastError: "Runtime health check failed: 502",
      updatedAt: new Date("2026-07-23T09:00:00.000Z"),
    });
    expect(setup.alerts).toEqual(["failure"]);
  });

  test("records transport failures without converting them into successes", async () => {
    const record = runtime();
    const setup = depsFor(record, { ok: true, status: 200 });
    setup.deps.checkHealth = async () => {
      throw new Error("IPv4 DNS lookup failed");
    };

    const result = await runRuntimeHealthSweep(setup.deps);

    expect(result).toEqual({ checked: 1, failures: 1, recoveries: 0 });
    expect(setup.persisted[0]).toEqual({
      lastError: "IPv4 DNS lookup failed",
      updatedAt: new Date("2026-07-23T09:00:00.000Z"),
    });
  });

  test("emits a recovery alert after a previously failed runtime succeeds", async () => {
    const setup = depsFor(runtime({ lastError: "IPv4 DNS lookup failed" }), {
      ok: true,
      status: 200,
    });

    const result = await runRuntimeHealthSweep(setup.deps);

    expect(result).toEqual({ checked: 1, failures: 0, recoveries: 1 });
    expect(setup.alerts).toEqual(["recovery"]);
  });

  test("does not run when another replica holds the advisory lock", async () => {
    const setup = depsFor(runtime(), { ok: true, status: 200 });
    setup.deps.withLock = async () => ({ locked: true as const });

    const result = await runRuntimeHealthSweep(setup.deps);

    expect(result).toEqual({ locked: true });
    expect(setup.persisted).toHaveLength(0);
  });
});
