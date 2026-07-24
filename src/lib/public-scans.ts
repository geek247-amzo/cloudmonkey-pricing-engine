import { lookup } from "node:dns/promises";

type ScanDeps = {
  fetch?: typeof fetch;
  lookup?: typeof lookup;
  now?: () => number;
  limit?: number;
  windowMs?: number;
  getRemoteIp: (request: Request) => string | null;
};

type RateEntry = { count: number; resetsAt: number };

const maxBodyBytes = 1_000_000;

export function createPublicScanHandlers(deps: ScanDeps) {
  const fetchImpl = deps.fetch ?? fetch;
  const lookupImpl = deps.lookup ?? lookup;
  const now = deps.now ?? Date.now;
  const limit = deps.limit ?? 5;
  const windowMs = deps.windowMs ?? 10 * 60 * 1000;
  const rateEntries = new Map<string, RateEntry>();

  async function handleGeneralScan(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const ip = deps.getRemoteIp(request) ?? "unknown";
    const rate = enforceRateLimit(ip);
    if (!rate.allowed) {
      return json(
        { error: "Scan rate limit exceeded", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }
    const target =
      typeof body === "object" && body !== null
        ? String((body as { url?: unknown }).url ?? "")
        : "";
    const parsed = await validateTarget(target);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    try {
      const response = await fetchImpl(parsed.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "CloudMonkey-Free-Scan/1.0" },
      });
      if (response.status >= 300 && response.status < 400) {
        return json({ error: "Redirects are not followed by the public scanner" }, 400);
      }
      const html = await readLimitedBody(response);
      const findings = analyzeHtml(parsed.url, response, html);
      return json({
        ok: response.ok,
        url: parsed.url,
        status: response.status,
        scannedAt: new Date(now()).toISOString(),
        findings,
        actionableFinding: findings[0] ?? {
          code: "healthy_baseline",
          title: "No basic health issue detected",
          detail: "Your site passed the initial public checks.",
        },
        cta: { kind: "monitoring_signup", href: "/sign-up" },
        shareableCard: {
          title: "CloudMonkey site health scan",
          domain: new URL(parsed.url).hostname,
          findingCount: findings.length,
          status: response.ok ? "review" : "attention",
        },
      });
    } catch (error) {
      return json(
        {
          ok: false,
          url: parsed.url,
          findings: [
            {
              code: "unreachable",
              title: "The site could not be reached",
              detail: error instanceof Error ? error.message : "The request failed",
            },
          ],
          actionableFinding: {
            code: "unreachable",
            title: "The site could not be reached",
            detail: "Check the domain, DNS, and hosting configuration.",
          },
          cta: { kind: "monitoring_signup", href: "/sign-up" },
        },
        200,
      );
    }
  }

  function enforceRateLimit(key: string) {
    const current = now();
    const existing = rateEntries.get(key);
    if (!existing || existing.resetsAt <= current) {
      rateEntries.set(key, { count: 1, resetsAt: current + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (existing.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetsAt - current) / 1000)),
      };
    }
    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async function validateTarget(
    value: string,
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { ok: false, error: "Enter a valid website URL" };
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return { ok: false, error: "Only public HTTP(S) URLs are supported" };
    }
    if (isPrivateAddress(url.hostname))
      return { ok: false, error: "Private or local addresses are not supported" };
    try {
      const addresses = await lookupImpl(url.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
        return { ok: false, error: "Private or local addresses are not supported" };
      }
    } catch {
      return { ok: false, error: "The website hostname could not be resolved" };
    }
    url.hash = "";
    return { ok: true, url: url.toString() };
  }

  return { handleGeneralScan };
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBodyBytes) throw new Error("Response is too large to scan");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBodyBytes) {
      await reader.cancel();
      throw new Error("Response is too large to scan");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function analyzeHtml(url: string, response: Response, html: string) {
  const lower = html.toLowerCase();
  const findings: Array<{ code: string; title: string; detail: string }> = [];
  if (!response.ok)
    findings.push({
      code: "http_status",
      title: `Site returned HTTP ${response.status}`,
      detail: "Visitors may be seeing an error page.",
    });
  if (!url.startsWith("https://"))
    findings.push({
      code: "https_required",
      title: "Site is not using HTTPS",
      detail: "HTTPS protects visitors and is expected by modern browsers and search engines.",
    });
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html))
    findings.push({
      code: "missing_title",
      title: "Page is missing a title",
      detail: "A descriptive title helps visitors and search engines understand the page.",
    });
  if (!/<meta\b[^>]*name=["']description["'][^>]*>/i.test(lower))
    findings.push({
      code: "missing_description",
      title: "Page is missing a meta description",
      detail: "Add a concise description for search previews.",
    });
  if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(lower))
    findings.push({
      code: "missing_viewport",
      title: "Mobile viewport metadata is missing",
      detail: "Add viewport metadata so the layout behaves correctly on phones.",
    });
  if (/<img\b/i.test(html) && /<img\b(?![^>]*\balt\s*=)/i.test(html))
    findings.push({
      code: "missing_alt_text",
      title: "Some images may be missing alt text",
      detail: "Descriptive alt text improves accessibility and image search.",
    });
  return findings;
}

function isPrivateAddress(value: string) {
  const hostname = value.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1")
    return true;
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1, 3).map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
