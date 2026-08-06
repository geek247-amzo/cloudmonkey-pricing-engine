import { describe, expect, test } from "bun:test";

import {
  agreementTemplateForService,
  BUNDLES,
  CATEGORIES,
  buildProposalTerms,
  buildPublicPricingResponseFromDatabase,
  formatPrice,
  normalizePublicPricingCatalog,
  serializePublicPricingCatalog,
  serviceDefinitionForBundle,
  serviceDefinitionForPlan,
} from "../src/lib/pricing";

describe("pricing catalog serialization", () => {
  test("serializes static pricing back into the API cents contract", () => {
    const payload = serializePublicPricingCatalog({ categories: CATEGORIES, bundles: BUNDLES });
    const normalized = normalizePublicPricingCatalog(payload);

    const managedCloud = normalized.categories.find((category) => category.id === "managed-cloud");
    const websites = managedCloud?.services.find((service) => service.id === "websites");
    const aiWebsite = websites?.plans.find((plan) => plan.id === "web-ai");
    const bundles = normalized.bundles;
    const fullService = bundles.find((bundle) => bundle.id === "bundle_full_service_growth");
    const websiteLaunch = bundles.find((bundle) => bundle.id === "bundle_website_launch_essentials");
    const growthSeo = bundles.find((bundle) => bundle.id === "bundle_website_growth_seo");
    const managedCloudCare = bundles.find((bundle) => bundle.id === "bundle_managed_cloud_care");
    const aiAssistant = bundles.find((bundle) => bundle.id === "bundle_ai_business_assistant");

    expect(aiWebsite?.priceZar).toBe(149);
    expect(aiWebsite?.setupPriceZar).toBe(0);
    expect(fullService?.priceZar).toBe(27598);
    expect(fullService?.setupPriceZar).toBe(14999);
    expect(websiteLaunch?.priceZar).toBe(1299);
    expect(websiteLaunch?.setupPriceZar).toBe(3499);
    expect(growthSeo?.priceZar).toBe(5999);
    expect(managedCloudCare?.priceZar).toBe(1699);
    expect(aiAssistant?.priceZar).toBe(3499);
  });

  test("formats prices with a stable ZAR locale", () => {
    expect(formatPrice(1299, "ZAR")).toBe("R1,299");
    expect(formatPrice(99.5, "ZAR")).toBe("R99.50");
  });

  test("builds the public catalog from database-backed rows", () => {
    const payload = buildPublicPricingResponseFromDatabase({
      categories: [
        {
          id: "catalog",
          name: "Catalog",
          tagline: "Catalog tag",
          accent: "cloud",
          sortOrder: 1,
          active: true,
        },
      ],
      services: [
        {
          id: "svc",
          categoryId: "catalog",
          name: "Service",
          description: "Service desc",
          sortOrder: 1,
          active: true,
        },
      ],
      plans: [
        {
          id: "plan-a",
          serviceId: "svc",
          name: "Plan A",
          priceZar: "12345",
          setupPriceZar: "5000",
          billingType: "recurring",
          active: true,
          sortOrder: 1,
          features: [],
        } as any,
      ],
      planFeatures: [{ planId: "plan-a", content: "Feature A" }],
      bundles: [
        {
          id: "bundle-a",
          name: "Bundle A",
          priceZar: "27598",
          setupPriceZar: "14999",
          billingType: "recurring",
          active: true,
          sortOrder: 1,
          features: [],
        } as any,
      ],
      bundleFeatures: [{ bundleId: "bundle-a", content: "Bundle Feature" }],
    });

    const normalized = normalizePublicPricingCatalog(payload);
    const plan = normalized.categories[0]?.services[0]?.plans[0];
    const bundle = normalized.bundles[0];

    expect(plan?.priceZar).toBe(123.45);
    expect(plan?.setupPriceZar).toBe(50);
    expect(plan?.features).toEqual(["Feature A"]);
    expect(bundle?.priceZar).toBe(275.98);
    expect(bundle?.setupPriceZar).toBe(149.99);
    expect(bundle?.features).toEqual(["Bundle Feature"]);
  });

  test("build plans include measurable package rules and request-routing terms", () => {
    const buildCategory = CATEGORIES.find((category) => category.id === "build");
    const buildService = buildCategory?.services.find((service) => service.id === "build-websites");
    const buildPlan = buildService?.plans.find((plan) => plan.id === "build_site_growth");

    expect(buildCategory).toBeTruthy();
    expect(buildService).toBeTruthy();
    expect(buildPlan).toBeTruthy();
    if (!buildCategory || !buildService || !buildPlan) return;

    const definition = serviceDefinitionForPlan(buildCategory, buildService, buildPlan);

    expect(definition.packageRules.coverage.join(" ")).toContain("1 brand");
    expect(definition.packageRules.serviceAllocation.join(" ")).toContain("8 development hours");
    expect(definition.packageRules.infrastructureAllocation.join(" ")).toContain("1 GB database");
    expect(definition.packageRules.supportAllocation.join(" ")).toContain("4 incidents");
    expect(definition.packageRules.responseTimes).toContain("8 business hours");
    expect(definition.packageRules.includedChanges.join(" ")).toContain("3 basic integrations");
    expect(definition.packageRules.usageLimits.length).toBeGreaterThan(0);
    expect(definition.packageRules.limitExceeded.length).toBeGreaterThan(0);
    expect(definition.standardTerms.join(" ")).toContain("do not roll over");
    expect(definition.support ?? []).toContain(
      "WhatsApp and email requests are logged into CloudMonkey tickets",
    );
    expect(buildProposalTerms([buildPlan.name])).toContain(
      "companies, brands, websites, applications, and active workstreams stated in the selected SKU",
    );
    expect(agreementTemplateForService(buildService.id, buildPlan.id)).toBe("build-service-order");
  });

  test("every catalog plan and bundle has all eight package rule categories", () => {
    for (const category of CATEGORIES) {
      for (const service of category.services) {
        for (const plan of service.plans) {
          const definition = serviceDefinitionForPlan(category, service, plan);
          expect(Object.keys(definition.packageRules).sort()).toEqual(
            [
              "coverage",
              "includedChanges",
              "infrastructureAllocation",
              "limitExceeded",
              "responseTimes",
              "serviceAllocation",
              "supportAllocation",
              "usageLimits",
            ].sort(),
          );
          for (const values of Object.values(definition.packageRules)) {
            expect(values.length).toBeGreaterThan(0);
          }
          expect(definition.standardTerms.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
    for (const bundle of BUNDLES) {
      const definition = serviceDefinitionForBundle(bundle);
      expect(Object.values(definition.packageRules).every((values) => values.length > 0)).toBe(
        true,
      );
      expect(definition.standardTerms.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("bundle catalog includes the added build, growth, cloud, and AI bundle families", () => {
    const bundleIds = new Set(BUNDLES.map((bundle) => bundle.id));
    expect(bundleIds.has("bundle_website_launch_essentials")).toBe(true);
    expect(bundleIds.has("bundle_website_growth_seo")).toBe(true);
    expect(bundleIds.has("bundle_managed_cloud_care")).toBe(true);
    expect(bundleIds.has("bundle_ai_business_assistant")).toBe(true);
    expect(BUNDLES.find((bundle) => bundle.categoryNote === "Growth Bundles")).toBeTruthy();
    expect(BUNDLES.find((bundle) => bundle.categoryNote === "Cloud Bundles")).toBeTruthy();
    expect(BUNDLES.find((bundle) => bundle.categoryNote === "AI Bundles")).toBeTruthy();
  });

  test("managed server uses the post-build price and overage envelope", () => {
    const category = CATEGORIES.find((item) => item.id === "managed-cloud");
    const service = category?.services.find((item) => item.id === "managed-infra");
    const plan = service?.plans.find((item) => item.id === "mi-managed");
    expect(plan?.priceZar).toBe(999);
    if (!category || !service || !plan) return;

    const definition = serviceDefinitionForPlan(category, service, plan);
    expect(definition.packageRules.coverage.join(" ")).toContain("1 server");
    expect(definition.packageRules.limitExceeded.join(" ")).toContain("R2,500/hour");
  });

  test("includes the 2026 hourly and strategic advisory offerings", () => {
    const category = CATEGORIES.find((item) => item.id === "quote-services");
    const hourly = category?.services.find((item) => item.id === "technical-strategic-services");
    const advisory = category?.services.find((item) => item.id === "strategic-advisory");

    expect(hourly?.plans.map((plan) => plan.id)).toEqual(["hourly_on_site", "hourly_remote"]);
    expect(hourly?.plans.map((plan) => plan.priceZar)).toEqual([1000, 600]);
    expect(hourly?.plans.every((plan) => plan.billingType === "quote")).toBe(true);
    expect(advisory?.plans.map((plan) => plan.id)).toEqual([
      "advisory_5",
      "advisory_10",
      "advisory_20",
      "advisory_onsite_10",
      "advisory_hybrid_10",
      "advisory_payg",
    ]);
    expect(advisory?.plans.slice(0, 5).map((plan) => plan.priceZar)).toEqual([
      3000,
      6000,
      12000,
      10000,
      8000,
    ]);
    expect(advisory?.plans.at(-1)?.billingType).toBe("quote");
    expect(advisory?.plans.at(-1)?.priceLabel).toContain("R600 remote / R1,000 on-site");

    if (!category || !advisory) return;
    const definition = serviceDefinitionForPlan(category, advisory, advisory.plans[2]);
    expect(definition.excludedScope.join(" ")).toContain("Equity participation");
    expect(definition.outOfScopeBilling).toContain("R1,000/hour on-site");
  });
});
