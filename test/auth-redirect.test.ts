import { describe, expect, test } from "bun:test";

import { safeDashboardCallback, signInPath } from "../src/lib/auth-redirect";

describe("dashboard authentication redirects", () => {
  test("keeps valid dashboard destinations and query strings", () => {
    expect(safeDashboardCallback("/dashboard/domains/new?domain=example.co.za")).toBe(
      "/dashboard/domains/new?domain=example.co.za",
    );
  });

  test("rejects external and non-dashboard destinations", () => {
    expect(safeDashboardCallback("https://evil.example/steal")).toBe("/dashboard");
    expect(safeDashboardCallback("//evil.example/steal")).toBe("/dashboard");
    expect(safeDashboardCallback("/domains")).toBe("/dashboard");
  });

  test("creates an encoded sign-in return URL", () => {
    expect(signInPath("/dashboard/domains/new?domain=example.co.za")).toBe(
      "/auth/sign-in?callbackURL=%2Fdashboard%2Fdomains%2Fnew%3Fdomain%3Dexample.co.za",
    );
  });
});
