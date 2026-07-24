import { describe, expect, test } from "bun:test";

import { toPublicDomainAvailability } from "../src/lib/domain/webhooks";

describe("public domain availability response", () => {
  test("returns only allowlisted public fields", () => {
    const result = toPublicDomainAvailability(
      {
        isAvailable: "true",
        strMessage: "Domain Available",
        isPremium: "false",
        strUUID: "supplier-request-id",
        strApiHost: "supplier-internal-host",
        objReseller: { username: "private", balance: "123.45" },
      },
      "example.co.za",
      "example",
      "co.za",
    );

    expect(result).toEqual({
      domain: "example.co.za",
      sld: "example",
      tld: "co.za",
      isAvailable: true,
      strMessage: "Domain Available",
      isPremium: false,
    });
    expect(result).not.toHaveProperty("objReseller");
    expect(result).not.toHaveProperty("strUUID");
    expect(result).not.toHaveProperty("strApiHost");
  });

  test("rejects malformed upstream responses instead of reporting a domain as taken", () => {
    expect(() =>
      toPublicDomainAvailability(
        { strMessage: "Unexpected response" },
        "example.com",
        "example",
        "com",
      ),
    ).toThrow("missing availability");
  });
});
