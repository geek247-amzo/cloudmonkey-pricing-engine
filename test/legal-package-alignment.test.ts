import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import {
  AGREEMENT_TEMPLATES,
  BUILD_PACKAGE_RESPONSE_TARGETS,
  CATEGORIES,
  MANAGED_SERVER_RESPONSE_TARGETS,
  serviceDefinitionForPlan,
} from "../src/lib/pricing";

const readSource = (relativePath: string) =>
  readFileSync(path.join(import.meta.dir, "../src/routes", relativePath), "utf8");

const termsSource = readSource("legal/terms.tsx");
const slaSource = readSource("legal/sla.tsx");
const legalSource = readSource("legal.tsx");
const refundsSource = readSource("legal/refunds.tsx");

describe("legal package alignment", () => {
  test("public legal pages do not contain the superseded SLA targets", () => {
    for (const source of [slaSource, legalSource]) {
      expect(source).not.toContain("15 minutes");
      expect(source).not.toContain("30 to 60 minutes");
      expect(source).not.toContain("24 business hours");
    }
    expect(slaSource).toContain("MANAGED_SERVER_RESPONSE_TARGETS");
    expect(legalSource).toContain("MANAGED_SERVER_RESPONSE_TARGETS");
  });

  test("Managed Server legal targets come from the product source of truth", () => {
    const category = CATEGORIES.find((item) => item.id === "managed-cloud")!;
    const service = category.services.find((item) => item.id === "managed-infra")!;
    const plan = service.plans.find((item) => item.id === "mi-managed")!;
    const definition = serviceDefinitionForPlan(category, service, plan);

    expect(definition.packageRules.responseTimes).toEqual(
      Object.entries(MANAGED_SERVER_RESPONSE_TARGETS).map(
        ([priority, target]) => `${priority}: ${target}`,
      ),
    );
  });

  test("Build package response targets match their service definitions", () => {
    const category = CATEGORIES.find((item) => item.id === "build")!;
    for (const service of category.services) {
      for (const plan of service.plans) {
        const expected =
          BUILD_PACKAGE_RESPONSE_TARGETS[plan.id as keyof typeof BUILD_PACKAGE_RESPONSE_TARGETS];
        if (!expected) continue;
        expect(
          serviceDefinitionForPlan(category, service, plan).packageRules.responseTimes,
        ).toEqual([expected]);
      }
    }
  });

  test("Terms and refund policy include the common package and wallet rules", () => {
    expect(termsSource).toContain('const TERMS_UPDATED = "17 July 2026"');
    expect(termsSource).toContain("do not roll over");
    expect(termsSource).toContain("maximum allowance");
    expect(termsSource).toContain("standard Managed Server fee is paused");
    expect(refundsSource).toContain("Purchased, unused wallet balance may be eligible for refund");
    expect(refundsSource).toContain("does not expire while the account remains active");
  });

  test("changed agreement templates use the current version without a one-brand conflict", () => {
    const managed = AGREEMENT_TEMPLATES.find((item) => item.id === "managed-services-sla")!;
    const build = AGREEMENT_TEMPLATES.find((item) => item.id === "build-service-order")!;

    expect(managed.version).toBe("2026-07-17");
    expect(build.version).toBe("2026-07-17");
    expect(build.body).not.toContain("one company, one brand");
    expect(build.body).toContain("selected SKU or signed service definition");
  });
});
