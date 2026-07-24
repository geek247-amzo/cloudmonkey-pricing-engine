import dns from "node:dns";
import http from "node:http";

import { afterEach, describe, expect, test } from "bun:test";

import { fetchIpv4 } from "../src/lib/runtime-http";

const originalLookup = dns.lookup;
type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

afterEach(() => {
  dns.lookup = originalLookup;
});

describe("fetchIpv4", () => {
  test("passes family 4 to DNS lookup and completes the request", async () => {
    let observedFamily: number | undefined;
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");

    dns.lookup = ((_hostname: string, options: unknown, callback: LookupCallback) => {
      observedFamily = (options as { family?: number }).family;
      if ((options as { all?: boolean }).all) {
        callback(null, [{ address: "127.0.0.1", family: 4 }]);
      } else {
        callback(null, "127.0.0.1", 4);
      }
    }) as typeof dns.lookup;

    try {
      const response = await fetchIpv4(`http://runtime-test.local:${address.port}/health`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
      expect(observedFamily).toBe(4);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  test("rejects when IPv4 DNS lookup fails", async () => {
    dns.lookup = ((_hostname: string, _options: unknown, callback: LookupCallback) => {
      const error = Object.assign(new Error("DNS temporarily unavailable"), { code: "EAI_AGAIN" });
      callback(error, "", 0);
    }) as typeof dns.lookup;

    await expect(fetchIpv4("http://runtime-unresolvable.local:8787/health")).rejects.toThrow(
      "DNS temporarily unavailable",
    );
  });
});
