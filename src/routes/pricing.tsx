import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Globe, Headphones, Lock, RefreshCcw, Shield, Zap } from "lucide-react";
import { useState } from "react";

import { CtaBanner } from "@/components/site/CtaBanner";
import { MascotHero } from "@/components/site/MascotHero";
import { PricingCard } from "@/components/site/PricingCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ServiceSection } from "@/components/site/ServiceSection";
import {
  BUNDLES,
  CATEGORIES,
  fetchPublicPricingCatalog,
  formatPrice,
  type Bundle,
} from "@/lib/pricing";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — CloudMonkey" },
      {
        name: "description",
        content:
          "CloudMonkey pricing in ZAR, managed from the admin catalog and synced to the public site.",
      },
      { property: "og:title", content: "CloudMonkey Pricing" },
      {
        property: "og:description",
        content: "Transparent pricing in ZAR, powered by the product catalog.",
      },
      ogUrl("/pricing"),
    ],
    links: [canonicalLink("/pricing")],
  }),
  component: PricingPage,
});

const TRUST = [
  {
    icon: Shield,
    title: "Admin Managed",
    desc: "Product and bundle pricing is edited from the dashboard.",
  },
  {
    icon: Lock,
    title: "Single Source of Truth",
    desc: "The public site reads from the same catalog as internal tools.",
  },
  { icon: Zap, title: "Fast Updates", desc: "Change pricing once and it appears across the site." },
  {
    icon: Headphones,
    title: "Human Support",
    desc: "If pricing needs a quote, sales can take it from here.",
  },
];

function PricingPage() {
  const [viewMode, setViewMode] = useState<"bundles" | "advanced">("bundles");
  const [activeBundleGroup, setActiveBundleGroup] = useState<string>("all");
  const [aiAgentType, setAiAgentType] = useState<string>("agent-marketing");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });

  const pricing = data ?? { categories: CATEGORIES, bundles: BUNDLES };
  const categories = pricing.categories;
  const bundles = pricing.bundles;
  const bundleGroupOrder = [
    "Build Bundles",
    "Growth Bundles",
    "Cloud Bundles",
    "AI Bundles",
    "Voice Bundles",
    "Managed + Voice Bundles",
    "Full-Service Packages",
  ];
  const bundleFilterOptions = [
    { value: "all", label: "All Bundles", count: bundles.length },
    ...bundleGroupOrder
      .map((label) => ({
        value: label,
        label,
        count: bundles.filter((bundle) => bundle.categoryNote === label).length,
      }))
      .filter((option) => option.count > 0),
  ];
  const visibleBundles =
    activeBundleGroup === "all"
      ? bundles
      : bundles.filter((bundle) => bundle.categoryNote === activeBundleGroup);

  return (
    <>
      <MascotHero
        eyebrow={
          <>
            <Globe className="h-3 w-3" /> Pricing
          </>
        }
        title={<>Simple, transparent pricing</>}
        subtitle="All public prices are shown in ZAR and managed from the same product catalog used by the dashboard."
        ctas={
          <>
            <Link
              to="/auth/sign-up"
              search={{ bundle: undefined, plan: undefined, coupon: undefined, ref: undefined }}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:sales@cloudmonkey.co.za?subject=CloudMonkey%20Pricing%20Quote"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              Request a Quote
            </a>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent)", color: "var(--primary)" }}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mx-auto mb-10 flex max-w-sm justify-center rounded-full bg-secondary p-1">
          <button
            onClick={() => setViewMode("bundles")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${viewMode === "bundles" ? "bg-background shadow-[var(--shadow-card)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Recommended Bundles
          </button>
          <button
            onClick={() => setViewMode("advanced")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${viewMode === "advanced" ? "bg-background shadow-[var(--shadow-card)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Products (A La Carte)
          </button>
        </div>

        {isError && (
          <div className="mt-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            <div className="font-semibold">
              Live pricing did not load. Static catalog pricing is shown below.
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      {viewMode === "bundles" ? (
        <section className="border-y border-border bg-secondary/50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              eyebrow="Bundles"
              accent="var(--ai)"
              title={
                <>
                  Grouped packages.{" "}
                  <span style={{ color: "var(--ai)" }}>Everything connected.</span>
                </>
              }
              subtitle="Build, growth, cloud, voice, AI, and support packages grouped by how customers buy them."
            />

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {bundleFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setActiveBundleGroup(option.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      activeBundleGroup === option.value
                        ? "border-transparent bg-[var(--ai)] text-white shadow-[var(--shadow-elevated)]"
                        : "border-border bg-card text-muted-foreground hover:border-[var(--ai)] hover:text-foreground"
                    }`}
                  >
                    {option.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        activeBundleGroup === option.value
                          ? "bg-white/15 text-white"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">{visibleBundles.length}</span>{" "}
                bundle{visibleBundles.length === 1 ? "" : "s"}
              </div>
            </div>

            {visibleBundles.length === 0 ? (
              <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
                No bundles are configured yet.
              </div>
            ) : (
              <div className="mt-12 columns-1 gap-6 md:columns-2 xl:columns-3">
                {visibleBundles.map((bundle) => (
                  <div key={bundle.id} className="mb-6 break-inside-avoid">
                    <BundleCard bundle={bundle} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-6 pb-16">
          <SectionHeading
            eyebrow="Catalog"
            accent="var(--ai)"
            title={<>ZAR pricing from the live catalog</>}
            subtitle="These prices are pulled from the database and displayed the same way across the public site and admin views."
          />
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-muted-foreground">
            Taxes, VAT treatment, setup fees, minimum terms, and final totals are confirmed in
            checkout, quotes, invoices, and accepted service orders before provisioning starts.
          </p>

          {categories.length === 0 && (
            <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
              No pricing categories are configured yet.
            </div>
          )}

          <PricingLaneSummary categories={categories} bundles={bundles} />

          {categories.map((category) => (
            <div key={category.id} className="mt-12 first:mt-0">
              <div className="mb-6">
                <SectionHeading
                  align="left"
                  eyebrow={category.name}
                  accent={`var(--${category.accent})`}
                  title={category.tagline}
                />
              </div>
              {category.services.map((service) => {
                if (service.id === "ai-agents") {
                  const selectedPlan =
                    service.plans.find((p) => p.id === aiAgentType) || service.plans[0];
                  return (
                    <section key={service.id} className="mx-auto max-w-7xl py-12">
                      <div className="mb-8 max-w-2xl">
                        <h3
                          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {service.name}
                        </h3>
                        {service.description && (
                          <p className="mt-2 text-muted-foreground">{service.description}</p>
                        )}
                        <div className="mt-5 max-w-xs">
                          <label className="mb-2 block text-sm font-semibold text-foreground">
                            Select Agent Type
                          </label>
                          <select
                            value={aiAgentType}
                            onChange={(e) => setAiAgentType(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm"
                          >
                            {service.plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-6 sm:grid-cols-1 lg:max-w-md">
                        <PricingCard
                          plan={selectedPlan}
                          accent={category.accent}
                          currency="ZAR"
                          href={`/auth/sign-up?plan=${selectedPlan.id}`}
                        />
                      </div>
                      <div
                        className="mt-12 h-px w-full"
                        style={{
                          background: `linear-gradient(90deg, transparent, var(--${category.accent})30, transparent)`,
                        }}
                      />
                    </section>
                  );
                }
                return (
                  <ServiceSection
                    key={service.id}
                    service={service}
                    accent={category.accent}
                    currency="ZAR"
                    ctaHref={(plan) => `/auth/sign-up?plan=${encodeURIComponent(plan.id)}`}
                  />
                );
              })}
              {category.note && (
                <p className="mx-auto max-w-7xl px-6 text-sm text-muted-foreground">
                  {category.note}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <CtaBanner
        title="Already know what you need?"
        subtitle="Talk to us and we’ll turn the right combination of cloud, AI, and support into a live solution."
        primary={{ label: "Request a Quote", to: "/auth/sign-up" }}
        secondary={{ label: "Book a Demo", to: "/auth/sign-up" }}
        accent="var(--primary)"
      />
    </>
  );
}

function PricingLaneSummary({
  categories,
  bundles,
}: {
  categories: typeof CATEGORIES;
  bundles: Bundle[];
}) {
  const laneRows = [
    {
      lane: "Managed Cloud",
      offer: "Static hosting, managed websites, VPS, backups and DNS",
      categoryId: "managed-cloud",
    },
    {
      lane: "Build",
      offer: "Landing pages, websites, ecommerce, MVPs, portals and automations",
      categoryId: "build",
    },
    {
      lane: "Marketing",
      offer: "SEO, content, campaigns, competitor intelligence and growth operations",
      categoryId: "marketing",
    },
    {
      lane: "Voice",
      offer: "VoIP, hosted PBX, SIP trunks, recording, IVR and voice intelligence",
      categoryId: "voice",
    },
    {
      lane: "AI Agents",
      offer: "Managed business agents with setup, tuning and 1M tokens/month",
      serviceId: "ai-agents",
    },
    {
      lane: "Add-ons",
      offer: "Domains, productivity admin, security, backups, SSL and support extensions",
      categoryId: "addons",
    },
    {
      lane: "Quote-based",
      offer: "Enterprise, custom AI, migrations, security and complex integrations",
      categoryId: "quote-services",
    },
  ];
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_1.6fr_1fr] gap-3 border-b border-border bg-[#f8faff] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <div>Lane</div>
        <div>Entry offer</div>
        <div>Starting price</div>
      </div>
      {laneRows.map((row) => {
        const plans = categories
          .filter((category) => !row.categoryId || category.id === row.categoryId)
          .flatMap((category) => category.services)
          .filter((service) => !row.serviceId || service.id === row.serviceId)
          .flatMap((service) => service.plans);
        const starting = startingPrice(plans);
        return (
          <div
            key={row.lane}
            className="grid grid-cols-[1fr_1.6fr_1fr] gap-3 border-b border-border/60 px-5 py-4 text-sm last:border-0"
          >
            <div className="font-semibold text-foreground">{row.lane}</div>
            <div className="text-muted-foreground">{row.offer}</div>
            <div className="font-semibold text-foreground">{starting}</div>
          </div>
        );
      })}
      <div className="border-t border-border bg-[#fbfcff] px-5 py-4 text-sm text-muted-foreground">
        Popular bundles include{" "}
        {bundles
          .slice(0, 4)
          .map(
            (bundle) =>
              `${bundle.name} (${formatPrice(bundle.priceZar, "ZAR")}${bundle.unit ?? ""})`,
          )
          .join(", ")}
        .
      </div>
    </div>
  );
}

function startingPrice(
  plans: Array<{
    priceZar: number | null;
    unit?: string;
    billingType?: string;
    priceLabel?: string;
  }>,
) {
  if (plans.some((plan) => plan.billingType === "token_based")) return "Token usage";
  const priced = plans.filter((plan) => typeof plan.priceZar === "number") as Array<{
    priceZar: number;
    unit?: string;
  }>;
  if (!priced.length) return "Quote";
  const cheapest = priced.reduce(
    (lowest, plan) => (plan.priceZar < lowest.priceZar ? plan : lowest),
    priced[0],
  );
  return `From ${formatPrice(cheapest.priceZar, "ZAR")}${cheapest.unit ?? ""}`;
}

function BundleCard({ bundle }: { bundle: Bundle }) {
  const billingType = bundle.billingType ?? "recurring";
  const canCheckout = billingType !== "quote";
  const priceText =
    billingType === "quote"
      ? bundle.priceLabel || "Request Quote"
      : formatPrice(bundle.priceZar, "ZAR");
  const ctaLabel =
    billingType === "quote"
      ? "Request Quote"
      : billingType === "once_off"
        ? "Buy Once Off"
        : "Choose bundle";

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]"
      style={
        bundle.highlighted
          ? { boxShadow: "0 0 0 2px var(--ai), var(--shadow-elevated)", borderColor: "transparent" }
          : { borderColor: "var(--border)" }
      }
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: bundle.highlighted
            ? "var(--gradient-primary)"
            : "linear-gradient(90deg, transparent, color-mix(in srgb, var(--ai) 45%, transparent), transparent)",
        }}
      />
      {bundle.badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: "var(--ai)" }}
        >
          {bundle.badge}
        </span>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {bundle.categoryNote ?? "Bundle"}
        </div>
        {bundle.highlighted && (
          <div className="rounded-full bg-[var(--ai)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            Featured
          </div>
        )}
      </div>
      <div
        className="text-sm font-semibold text-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {bundle.name}
      </div>
      <div
        className="mt-3 text-3xl font-bold text-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {priceText}
        {billingType !== "quote" && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {bundle.unit || "/month"}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {bundle.setupPriceZar != null && bundle.setupPriceZar > 0 && (
          <div>Setup: {formatPrice(bundle.setupPriceZar, "ZAR")}</div>
        )}
        {bundle.minimumTerm && <div>Minimum term: {bundle.minimumTerm}</div>}
        {bundle.serviceNote && <div>{bundle.serviceNote}</div>}
      </div>
      <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground/80">
        {bundle.features.map((feature) => (
          <li key={feature} className="flex gap-1.5">
            <Check className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: "var(--ai)" }} />
            {feature}
          </li>
        ))}
      </ul>
      {canCheckout ? (
        <Link
          to="/auth/sign-up"
          search={{ bundle: bundle.id, plan: undefined, coupon: undefined, ref: undefined }}
          className="mt-5 rounded-full border border-border bg-background px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary"
        >
          {ctaLabel}
        </Link>
      ) : (
        <a
          href="mailto:sales@cloudmonkey.co.za?subject=CloudMonkey%20Bundle%20Quote"
          className="mt-5 rounded-full border border-border bg-background px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
