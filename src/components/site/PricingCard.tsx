import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useCurrency } from "@/lib/currency";
import { formatPrice, type ServicePlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function PricingCard({ plan, accent = "ai" }: { plan: ServicePlan; accent?: "cloud" | "business" | "ai" }) {
  const { currency } = useCurrency();
  const accentColor = accent === "cloud" ? "var(--cloud)" : accent === "business" ? "var(--business)" : "var(--ai)";
  const ringStyle: CSSProperties | undefined = plan.highlighted ? { boxShadow: `0 0 0 2px ${accentColor}, var(--shadow-elevated)` } : undefined;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1",
        plan.highlighted ? "border-transparent" : "border-border shadow-[var(--shadow-card)]",
      )}
      style={ringStyle}
    >
      {plan.badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
          style={{ background: accentColor }}
        >
          {plan.badge}
        </span>
      )}
      <div className="mb-1 text-sm font-semibold" style={{ color: accentColor }}>
        {plan.name}
      </div>
      {plan.tagline && <p className="mb-3 text-xs text-muted-foreground">{plan.tagline}</p>}
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          {formatPrice(plan.priceZar, currency)}
        </span>
        {plan.unit && <span className="text-sm text-muted-foreground">{plan.unit}</span>}
      </div>
      <ul className="mb-6 flex-1 space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-foreground/80">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/pricing"
        className={cn(
          "rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-all",
          plan.highlighted ? "text-white hover:opacity-90" : "border border-border text-foreground hover:bg-secondary",
        )}
        style={plan.highlighted ? { background: accentColor } : undefined}
      >
        {plan.priceZar === null ? "Contact Sales" : "Choose Plan"}
      </Link>
    </div>
  );
}