import { describe, expect, test } from "bun:test";

import {
  buildDomainCandidates,
  getDomainTldsFromPlans,
  normalizeDomainQuery,
} from "../src/lib/domain-search";

describe("domain search", () => {
  test("offers only default and explicitly catalogued TLDs", () => {
    const tlds = getDomainTldsFromPlans([
      { name: ".co.za" },
      { name: ".com" },
      { name: ".xyz" },
      { name: ".store" },
    ]);

    expect(tlds).toEqual(["co.za", "com", "xyz", "store"]);
    expect(buildDomainCandidates("cloudmonkey", tlds).map((item) => item.tld)).toEqual(tlds);
  });

  test("keeps an explicitly entered unsupported TLD for an unpriced availability result", () => {
    const candidates = buildDomainCandidates("cloudmonkey.io", ["co.za", "com"]);

    expect(candidates[0]).toEqual({ domain: "cloudmonkey.io", tld: "io" });
  });

  test("normalizes names before candidate generation", () => {
    expect(normalizeDomainQuery("  Cloud Monkey.CO.ZA ")).toEqual({
      value: "cloudmonkey.co.za",
      root: "cloudmonkey",
    });
  });
});
