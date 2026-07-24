export type WebsiteHealthStatus = "healthy" | "degraded" | "down";

export type WebsiteHealthCheckValues = {
  checkedAt: Date;
  httpStatus: number | null;
  sslDaysRemaining: number | null;
  responseTimeMs: number | null;
  contentCheckPassed: boolean;
  issues: string[];
  status: WebsiteHealthStatus;
};

export type WebsiteHealthSweepWebsite = {
  id: string;
  domain: string;
  primaryDomain?: string | null;
  temporaryDomain?: string | null;
  status: string;
  runtimeServerId?: string | null;
};

export type WebsiteHealthSweepDeps = {
  getWebsites: () => Promise<WebsiteHealthSweepWebsite[]>;
  checkWebsite: (
    website: WebsiteHealthSweepWebsite,
    timeoutMs: number,
  ) => Promise<WebsiteHealthCheckValues>;
  persist: (
    website: WebsiteHealthSweepWebsite,
    values: WebsiteHealthCheckValues,
  ) => Promise<{ id: string }>;
  remediateDownWebsite?: (
    website: WebsiteHealthSweepWebsite,
    healthCheckId: string,
  ) => Promise<void>;
  withLock: <T>(work: () => Promise<T>) => Promise<T>;
  timeoutMs?: number;
};

export function evaluateWebsiteContent(body: string) {
  const normalized = body.trim();
  if (!normalized || normalized.length < 200) return false;
  if (!/<html(?:\s|>)/i.test(normalized)) return false;
  return !/(domain is for sale|coming soon|website parked|account suspended|404 not found|server not found)/i.test(
    normalized,
  );
}

export async function runWebsiteHealthSweep(deps: WebsiteHealthSweepDeps) {
  return deps.withLock(async () => {
    const websites = (await deps.getWebsites()).filter((website) =>
      ["online", "active"].includes(website.status),
    );
    const summary = { checked: 0, healthy: 0, degraded: 0, down: 0 };

    for (const website of websites) {
      const values = await deps.checkWebsite(website, deps.timeoutMs ?? 15_000);
      const healthCheck = await deps.persist(website, values);
      if (values.status === "down" && deps.remediateDownWebsite) {
        await deps.remediateDownWebsite(website, healthCheck.id);
      }
      summary.checked += 1;
      summary[values.status] += 1;
    }

    return summary;
  });
}
