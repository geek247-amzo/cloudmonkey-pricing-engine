export type RuntimeHealthSweepRecord = {
  id: string;
  status: string;
  provisionerUrl: string | null;
  hostname?: string | null;
  label?: string | null;
  lastHealthCheckAt: Date | null;
  lastError: string | null;
};

export type RuntimeHealthSweepDeps = {
  now?: () => Date;
  timeoutMs: number;
  repeatAlertAfterMs: number;
  getRuntimes: () => Promise<RuntimeHealthSweepRecord[]>;
  checkHealth: (
    runtime: RuntimeHealthSweepRecord,
    timeoutMs: number,
  ) => Promise<{
    ok: boolean;
    status: number;
  }>;
  persist: (
    runtime: RuntimeHealthSweepRecord,
    values: {
      lastHealthCheckAt?: Date;
      lastError: string | null;
      updatedAt: Date;
    },
  ) => Promise<void>;
  hasRecentFailureAlert: (runtime: RuntimeHealthSweepRecord, since: Date) => Promise<boolean>;
  sendAlert: (
    kind: "failure" | "recovery",
    runtime: RuntimeHealthSweepRecord,
    message: string,
  ) => Promise<void>;
  withLock: <T>(work: () => Promise<T>) => Promise<T | { locked: true }>;
};

export async function runRuntimeHealthSweep(deps: RuntimeHealthSweepDeps) {
  return deps.withLock(async () => {
    const now = (deps.now ?? (() => new Date()))();
    const runtimes = (await deps.getRuntimes()).filter(
      (runtime) => runtime.status === "active" && runtime.provisionerUrl,
    );
    let checked = 0;
    let failures = 0;
    let recoveries = 0;

    for (const runtime of runtimes) {
      checked += 1;
      try {
        const result = await deps.checkHealth(runtime, deps.timeoutMs);
        if (result.ok) {
          const recovered = Boolean(runtime.lastError);
          await deps.persist(runtime, {
            lastHealthCheckAt: now,
            lastError: null,
            updatedAt: now,
          });
          if (recovered) {
            recoveries += 1;
            await deps.sendAlert("recovery", runtime, "Runtime health check recovered.");
          }
          continue;
        }

        failures += 1;
        const message = `Runtime health check failed: ${result.status}`;
        await deps.persist(runtime, { lastError: message, updatedAt: now });
        const recentFailureAlert = await deps.hasRecentFailureAlert(
          runtime,
          new Date(now.getTime() - deps.repeatAlertAfterMs),
        );
        const shouldAlert = !runtime.lastError || !recentFailureAlert;
        if (shouldAlert) await deps.sendAlert("failure", runtime, message);
      } catch (error) {
        failures += 1;
        const message = error instanceof Error ? error.message : String(error);
        await deps.persist(runtime, { lastError: message, updatedAt: now });
        if (!runtime.lastError) await deps.sendAlert("failure", runtime, message);
      }
    }

    return { checked, failures, recoveries };
  });
}
