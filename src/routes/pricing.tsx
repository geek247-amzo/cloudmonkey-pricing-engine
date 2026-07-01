import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Globe, Headphones, Lock, RefreshCcw, Shield, Zap } from "lucide-react";

import { CtaBanner } from "@/components/site/CtaBanner";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ServiceSection } from "@/components/site/ServiceSection";
import { fetchPublicPricingCatalog, formatPrice, type Bundle } from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — CloudMonkey" },
      { name: "description", content: "CloudMonkey pricing in ZAR, managed from the admin catalog and synced to the public site." },
      { property: "og:title", content: "CloudMonkey Pricing" },
      { property: "og:description", content: "Transparent pricing in ZAR, powered by the product catalog." },
    ],
  }),
  component: PricingPage,
});

type PricingBundle = Bundle & { priceZar: number };

const TRUST = [
  { icon: Shield, title: "Admin Managed", desc: "Product and bundle pricing is edited from the dashboard." },
  { icon: Lock, title: "Single Source of Truth", desc: "The public site reads from the same catalog as internal tools." },
  { icon: Zap, title: "Fast Updates", desc: "Change pricing once and it appears across the site." },
  { icon: Headphones, title: "Human Support", desc: "If pricing needs a quote, sales can take it from here." },
];

function PricingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });

  const pricing = data ?? { categories: [], bundles: [] };
  const categories = pricing.categories;
  const bundles = pricing.bundles;

  return (
    <>
      <MascotHero
        eyebrow={<><Globe className="h-3 w-3" /> Pricing</>}
        title={<>Simple, transparent pricing</>}
        subtitle="All public prices are shown in ZAR and managed from the same product catalog used by the dashboard."
        ctas={
          <>
            <Link
              to="/auth/sign-up"
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
              <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent)", color: "var(--primary)" }}>
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

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <SectionHeading
          eyebrow="Catalog"
          accent="var(--ai)"
          title={<>ZAR pricing from the live catalog</>}
          subtitle="These prices are pulled from the database and displayed the same way across the public site and admin views."
        />

        {isError && (
          <div className="mt-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            <div className="font-semibold">Failed to load pricing.</div>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        )}

        {isLoading && (
          <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Loading latest pricing catalog...
          </div>
        )}

        {!isLoading && !isError && categories.length === 0 && (
          <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            No pricing categories are configured yet.
          </div>
        )}

        {!isLoading && !isError && categories.map((category) => (
          <div key={category.id} className="mt-12 first:mt-0">
            <div className="mb-6">
              <SectionHeading
                align="left"
                eyebrow={category.name}
                accent={`var(--${category.accent})`}
                title={category.tagline}
              />
            </div>
            {category.services.map((service) => (
              <ServiceSection
                key={service.id}
                service={service}
                accent={category.accent}
                currency="ZAR"
                ctaHref={(plan) => `/auth/sign-up?plan=${encodeURIComponent(plan.id)}`}
              />
            ))}
          </div>
        ))}
      </section>

      <section className="border-y border-border bg-secondary/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Platform Bundles"
            accent="var(--ai)"
            title={<>One bundle. <span style={{ color: "var(--ai)" }}>Everything connected.</span></>}
            subtitle="Bundle cloud, business, and AI into a single invoice with one support team."
          />

          {isError ? (
            <div className="mt-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <div className="font-semibold">Failed to load bundles.</div>
              <button type="button" onClick={() => refetch()} className="mt-2 font-semibold underline">
                Try again
              </button>
            </div>
          ) : isLoading ? (
            <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading bundles...
            </div>
          ) : bundles.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
              No bundles are configured yet.
            </div>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              {bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  className="relative flex flex-col rounded-2xl border bg-card p-6"
                  style={bundle.highlighted ? { boxShadow: "0 0 0 2px var(--ai), var(--shadow-elevated)", borderColor: "transparent" } : { borderColor: "var(--border)" }}
                >
                  {bundle.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--ai)" }}>
                      {bundle.badge}
                    </span>
                  )}
                  <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                    {bundle.name}
                  </div>
                  <div className="mt-2 text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                    {formatPrice(bundle.priceZar, "ZAR")}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">/month</span>
                  </div>
                  <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground/80">
                    {bundle.features.map((feature) => (
                      <li key={feature} className="flex gap-1.5">
                        <Check className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: "var(--ai)" }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to={`/auth/sign-up?bundle=${encodeURIComponent(bundle.id)}`} className="mt-5 rounded-full border border-border px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary">
                    Choose bundle
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

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
