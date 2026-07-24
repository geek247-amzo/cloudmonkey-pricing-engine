import { describe, expect, test } from "bun:test";

import { createPublicScanHandlers } from "../src/lib/public-scans";

function request(ip = "203.0.113.10", url = "https://example.com") {
  return new Request("https://cloudmonkey.co.za/api/public/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ url }),
  });
}

describe("public general scan", () => {
  test("returns actionable findings from a valid public URL", async () => {
    const handler = createPublicScanHandlers({
      getRemoteIp: (request) => request.headers.get("x-forwarded-for"),
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async () =>
        new Response(
          '<html><head><title>Example</title></head><body><img src="hero.jpg"></body></html>',
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    });

    const response = await handler.handleGeneralScan(request());
    const body = (await response.json()) as { ok: boolean; findings: Array<{ code: string }> };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.findings.map((finding) => finding.code)).toContain("missing_alt_text");
    expect(body.findings.map((finding) => finding.code)).toContain("missing_description");
  });

  test("enforces the rate limit on repeated HTTP requests through the public handler", async () => {
    const handler = createPublicScanHandlers({
      limit: 2,
      windowMs: 60_000,
      getRemoteIp: (request) => request.headers.get("x-forwarded-for"),
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async () => new Response("<html><title>Example</title></html>", { status: 200 }),
    });

    expect((await handler.handleGeneralScan(request())).status).toBe(200);
    expect((await handler.handleGeneralScan(request())).status).toBe(200);
    const limited = await handler.handleGeneralScan(request());

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  test("rejects private targets before making an outbound request", async () => {
    let fetchCalls = 0;
    const handler = createPublicScanHandlers({
      getRemoteIp: (request) => request.headers.get("x-forwarded-for"),
      fetch: async () => {
        fetchCalls += 1;
        return new Response("should not be fetched");
      },
    });

    const response = await handler.handleGeneralScan(
      request("203.0.113.11", "http://127.0.0.1:3000"),
    );
    expect(response.status).toBe(400);
    expect(fetchCalls).toBe(0);
  });

  test("does not follow an allowed URL redirect toward an internal target", async () => {
    let fetchCalls = 0;
    const handler = createPublicScanHandlers({
      getRemoteIp: (request) => request.headers.get("x-forwarded-for"),
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async () => {
        fetchCalls += 1;
        return new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data" },
        });
      },
    });

    const response = await handler.handleGeneralScan(request("203.0.113.12"));

    expect(response.status).toBe(400);
    expect(fetchCalls).toBe(1);
    expect(await response.json()).toEqual({
      error: "Redirects are not followed by the public scanner",
    });
  });
});
