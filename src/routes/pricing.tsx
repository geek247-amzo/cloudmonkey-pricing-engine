import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { useCurrency } from "@/lib/currency";
import { BUNDLES, CATEGORIES, formatPrice } from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — CloudMonkey Platform 2.0" },
      { name: "description", content: "Transparent pricing for CloudMonkey Cloud, Business and AI — plus all-in-one platform bundles." },
      { property: "og:title", content: "CloudMonkey Pricing" },
      { property: "og:description", content: "Transparent pricing for everything CloudMonkey." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { currency } = useCurrency();
  return (
    <>
      <MascotHero
        eyebrow="Pricing"
        title={<>Simple pricing. <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Powerful platform.</span></>}
        subtitle="One catalogue, three divisions, and all-in-one bundles. Switch currency at any time."
      />

      {/* Bundles */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading
          eyebrow="Platform Bundles"
          accent="var(--ai)"
          title="Bundle up. Save more."
          subtitle="Single invoice. Single support team. Single dashboard."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {BUNDLES.map((b) => (
            <div
              key={b.id}
              className="relative flex flex-col rounded-2xl border bg-card p-6"
              style={b.highlighted ? { boxShadow: `0 0 0 2px var(--ai), var(--shadow-elevated)`, borderColor: "transparent" } : { borderColor: "var(--border)" }}
            >
              {b.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--ai)" }}>
                  {b.badge}
                </span>
              )}
              <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{b.name}</div>
              <div className="mt-2 text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                {formatPrice(b.priceZar, currency)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/month</span>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground/80">
                {b.features.map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: "var(--ai)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className="mt-5 rounded-full px-3 py-2 text-center text-xs font-semibold text-white" style={{ background: b.highlighted ? "var(--ai)" : "var(--foreground)" }}>
                Choose bundle
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* All categories */}
      {CATEGORIES.map((cat) => {
        const accentColor = cat.accent === "cloud" ? "var(--cloud)" : cat.accent === "business" ? "var(--business)" : "var(--ai)";
        return (
          <div key={cat.id} className="border-t border-border" style={{ background: cat.accent === "business" ? "color-mix(in oklab, var(--business-soft) 30%, transparent)" : undefined }}>
            <div className="mx-auto max-w-7xl px-6 pt-16 text-center">
              <SectionHeading
                eyebrow={cat.name}
                accent={accentColor}
                title={cat.tagline}
              />
            </div>
            {cat.services.map((s) => (
              <ServiceSection key={s.id} service={s} accent={cat.accent} />
            ))}
          </div>
        );
      })}

      <CtaBanner
        title="Not sure which plan is right for you?"
        subtitle="Talk to a CloudMonkey expert and we'll design a stack tailored to your business."
        primary={{ label: "Talk to an Expert", to: "/pricing" }}
        accent="var(--primary)"
      />
    </>
  );
}