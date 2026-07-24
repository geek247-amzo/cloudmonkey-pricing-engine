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
      const findings = await analyzeHtml(parsed.url, response, html, fetchImpl);
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

async function analyzeHtml(url: string, response: Response, html: string, fetchImpl: typeof fetch) {
  const findings: Array<{ code: string; title: string; detail: string }> = [];
  const parsedUrl = new URL(url);
  const title = extractTitle(html);
  const description = extractMetaContent(html, "description");
  const h1Count = [...html.matchAll(/<h1\b[^>]*>[\s\S]*?<\/h1\s*>/gi)].length;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)];
  const missingAlt = images.filter(([tag]) => !/\balt\s*=\s*["'][^"']*["']/i.test(tag)).length;
  const missingOpenGraph = ["og:title", "og:description", "og:image"].filter(
    (property) => !new RegExp(`<meta\\b[^>]*property=["']${property}["'][^>]*>`, "i").test(html),
  );
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
  if (!title || title.length < 10 || title.length > 60)
    findings.push({
      code: "missing_title",
      title: title ? "Page title length needs attention" : "Page is missing a title",
      detail: title
        ? `The title is ${title.length} characters; keep it between 10 and 60 characters.`
        : "A descriptive title helps visitors and search engines understand the page.",
    });
  if (!description || description.length < 50 || description.length > 160)
    findings.push({
      code: "missing_description",
      title: description
        ? "Meta description length needs attention"
        : "Page is missing a meta description",
      detail: description
        ? `The meta description is ${description.length} characters; keep it between 50 and 160 characters.`
        : "Add a concise description for search previews.",
    });
  if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(html))
    findings.push({
      code: "missing_viewport",
      title: "Mobile viewport metadata is missing",
      detail: "Add viewport metadata so the layout behaves correctly on phones.",
    });
  if (h1Count === 0 || h1Count > 1)
    findings.push({
      code: "h1_structure",
      title: h1Count === 0 ? "Page is missing an H1 heading" : "Page has multiple H1 headings",
      detail: `Found ${h1Count} H1 headings; use exactly one clear primary heading.`,
    });
  if (missingAlt > 0)
    findings.push({
      code: "missing_alt_text",
      title: "Some images are missing alt text",
      detail: `${missingAlt} of ${images.length} images missing alt text. Descriptive alt text improves accessibility and image search.`,
    });
  if (!/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i.test(html))
    findings.push({
      code: "missing_canonical",
      title: "Canonical link is missing",
      detail: "Add a canonical URL to identify the preferred version of this page.",
    });
  if (missingOpenGraph.length > 0)
    findings.push({
      code: "missing_open_graph",
      title: "Open Graph metadata is incomplete",
      detail: `Missing ${missingOpenGraph.join(", ")}; these tags control how the page appears when shared socially.`,
    });
  if (!/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html))
    findings.push({
      code: "missing_structured_data",
      title: "Structured data is missing",
      detail: "Add JSON-LD structured data to help search engines understand the page.",
    });
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html))
    findings.push({
      code: "missing_html_lang",
      title: "HTML language attribute is missing",
      detail:
        "Set the html lang attribute to identify the page language for browsers and assistive technology.",
    });

  const [robots, sitemap, brokenLinks] = await Promise.all([
    fetchText(`${parsedUrl.origin}/robots.txt`, fetchImpl),
    fetchText(`${parsedUrl.origin}/sitemap.xml`, fetchImpl),
    findBrokenInternalLinks(parsedUrl, html, fetchImpl),
  ]);
  if (!robots.ok || !robots.body.trim())
    findings.push({
      code: "missing_robots",
      title: "robots.txt is missing",
      detail: "Publish a robots.txt file to provide crawl guidance to search engines.",
    });
  if (!sitemap.ok || !sitemap.body.trim())
    findings.push({
      code: "missing_sitemap",
      title: "sitemap.xml is missing",
      detail: "Publish an XML sitemap so search engines can discover your important pages.",
    });
  if (brokenLinks.length > 0)
    findings.push({
      code: "broken_links",
      title: "Broken internal links were found",
      detail: `${brokenLinks.length} of the first 10 internal links returned an error: ${brokenLinks.join(", ")}.`,
    });
  return findings;
}

function extractTitle(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function extractMetaContent(html: string, name: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (nameMatch?.[1].toLowerCase() !== name.toLowerCase()) continue;
    return decodeHtmlEntities(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? "");
  }
  return "";
}

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(?:amp|lt|gt|quot|#39);/gi,
    (entity) =>
      ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[
        entity.toLowerCase()
      ] ?? entity,
  );
}

async function fetchText(url: string, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(3_000),
      headers: { "User-Agent": "CloudMonkey-Free-Scan/1.0" },
    });
    return { ok: response.ok, body: await response.text() };
  } catch {
    return { ok: false, body: "" };
  }
}

async function findBrokenInternalLinks(url: URL, html: string, fetchImpl: typeof fetch) {
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map(([, href]) => {
      try {
        const link = new URL(href, url);
        link.hash = "";
        return link;
      } catch {
        return null;
      }
    })
    .filter(
      (link): link is URL =>
        Boolean(link) && link.origin === url.origin && ["http:", "https:"].includes(link.protocol),
    );
  const uniqueLinks = [...new Map(links.map((link) => [link.toString(), link])).values()].slice(
    0,
    10,
  );
  const results = await Promise.all(
    uniqueLinks.map(async (link) => {
      try {
        const response = await fetchImpl(link.toString(), {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(3_000),
          headers: { "User-Agent": "CloudMonkey-Free-Scan/1.0" },
        });
        return response.status >= 400 ? link.pathname : null;
      } catch {
        return link.pathname;
      }
    }),
  );
  return results.filter((result): result is string => Boolean(result));
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
