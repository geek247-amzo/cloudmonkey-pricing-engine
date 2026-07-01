import type { Service, ServicePlan } from "@/lib/pricing";
import { PricingCard } from "./PricingCard";

export function ServiceSection({
  service,
  accent,
  currency,
  ctaHref,
}: {
  service: Service;
  accent: "cloud" | "business" | "ai";
  currency?: "ZAR" | "USD" | "GBP" | "EUR";
  ctaHref?: string | ((plan: ServicePlan) => string);
}) {
  const accentColor = accent === "cloud" ? "var(--cloud)" : accent === "business" ? "var(--business)" : "var(--ai)";
  const cols =
    service.plans.length === 1
      ? "grid gap-6 sm:grid-cols-1 lg:max-w-md"
      : service.plans.length === 2
        ? "grid gap-6 sm:grid-cols-2"
        : service.plans.length === 3
          ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-6 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8 max-w-2xl">
        <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
          {service.name}
        </h3>
        {service.description && <p className="mt-2 text-muted-foreground">{service.description}</p>}
      </div>
      <div className={cols}>
        {service.plans.map((p) => (
          <PricingCard key={p.id} plan={p} accent={accent} currency={currency} href={ctaHref} />
        ))}
      </div>
      {service.note && <p className="mt-4 text-xs italic text-muted-foreground">{service.note}</p>}
      <div className="mt-12 h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }} />
    </section>
  );
}
