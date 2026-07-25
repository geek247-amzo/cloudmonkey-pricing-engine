import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useCurrency } from "@/lib/currency";
import { formatPrice, type Currency, type ServicePlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function PricingCard({
  plan,
  accent = "ai",
  currency: currencyOverride,
  href = "/pricing",
}: {
  plan: ServicePlan;
  accent?: "cloud" | "business" | "ai";
  currency?: Currency;
  href?: string | ((plan: ServicePlan) => string);
}) {
  const { currency } = useCurrency();
  const resolvedCurrency = currencyOverride ?? currency;
  const billingType = plan.billingType ?? "recurring";
  const canCheckout = billingType !== "quote";
  const resolvedHref = canCheckout
    ? typeof href === "function"
      ? href(plan)
      : href
    : "mailto:sales@cloudmonkey.co.za?subject=CloudMonkey%20Quote";
  const accentColor =
    accent === "cloud" ? "var(--cloud)" : accent === "business" ? "var(--business)" : "var(--ai)";
  const ringStyle: CSSProperties | undefined = plan.highlighted
    ? { boxShadow: `0 0 0 2px ${accentColor}, var(--shadow-elevated)` }
    : undefined;
  const displayPrice =
    billingType === "quote"
      ? plan.priceLabel || "Request Quote"
      : `${plan.priceLabel ? `${plan.priceLabel} ` : ""}${formatPrice(plan.priceZar, resolvedCurrency)}`;
  const ctaLabel =
    billingType === "quote"
      ? "Request Quote"
      : billingType === "once_off"
        ? "Buy Once Off"
        : plan.trialDays
          ? "Start Free Trial"
          : "Choose Plan";
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
      {plan.trialDays ? (
        <div className="mb-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {plan.trialDays}-day free trial
        </div>
      ) : null}
      {plan.isBundle ? (
        <div className="mb-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Bundle
        </div>
      ) : null}
      {plan.tagline && <p className="mb-3 text-xs text-muted-foreground">{plan.tagline}</p>}
      <div className="mb-3 flex flex-wrap items-baseline gap-1">
        <span
          className="text-4xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {displayPrice}
        </span>
        {billingType !== "quote" && plan.unit && (
          <span className="text-sm text-muted-foreground">{plan.unit}</span>
        )}
      </div>
      <div className="mb-5 min-h-10 space-y-1 text-xs text-muted-foreground">
        {plan.setupPriceZar != null && plan.setupPriceZar > 0 && (
          <div>Setup: {formatPrice(plan.setupPriceZar, resolvedCurrency)}</div>
        )}
        {plan.minimumTerm && <div>Minimum term: {plan.minimumTerm}</div>}
        {billingType === "once_off" && <div>Once-off product. No monthly subscription.</div>}
        {billingType === "token_based" && (
          <div>Usage is deducted from your CloudMonkey wallet per action.</div>
        )}
        {plan.serviceNote && <div>{plan.serviceNote}</div>}
      </div>
      <ul className="mb-6 flex-1 space-y-2.5 text-sm">
        {(plan.features as Array<string | { id?: string; content?: string }>).map((feature) => (
          <li
            key={typeof feature === "string" ? feature : (feature.id ?? feature.content ?? "")}
            className="flex items-start gap-2 text-foreground/80"
          >
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
            <span>{typeof feature === "string" ? feature : (feature.content ?? "")}</span>
          </li>
        ))}
      </ul>
      {canCheckout ? (
        <Link
          to={resolvedHref}
          className={cn(
            "rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-all",
            plan.highlighted
              ? "text-white hover:opacity-90"
              : "border border-border text-foreground hover:bg-secondary",
          )}
          style={plan.highlighted ? { background: accentColor } : undefined}
        >
          {ctaLabel}
        </Link>
      ) : (
        <a
          href={resolvedHref}
          className={cn(
            "rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-all",
            plan.highlighted
              ? "text-white hover:opacity-90"
              : "border border-border text-foreground hover:bg-secondary",
          )}
          style={plan.highlighted ? { background: accentColor } : undefined}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
