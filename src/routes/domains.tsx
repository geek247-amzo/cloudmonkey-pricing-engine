import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  Shield,
  Lock,
  Zap,
  Headphones,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { CATEGORIES, fetchPublicPricingCatalog, formatPrice } from "@/lib/pricing";
import {
  buildDomainCandidates,
  getDomainTldsFromPlans,
  normalizeDomainQuery,
  type DomainCheckResult,
} from "@/lib/domain-search";
import { canonicalLink, ogUrl } from "@/lib/seo";
import { useHydratedSession } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/domains")({
  head: () => ({
    meta: [
      { title: ".co.za Domain Registration & DNS Management | CloudMonkey" },
      {
        name: "description",
        content:
          "Search and register .co.za and other business domains with CloudMonkey. Get managed DNS, nameserver configuration, renewals and account support.",
      },
      { property: "og:title", content: "CloudMonkey Domains" },
      { property: "og:description", content: "Find your perfect domain." },
      ogUrl("/domains"),
    ],
    links: [canonicalLink("/domains")],
  }),
  component: DomainsPage,
});

const TRUST = [
  {
    icon: Shield,
    title: "Free Privacy Protection",
    desc: "Keep your personal information private",
  },
  { icon: Lock, title: "SSL Certificate", desc: "Keep your site secure with SSL included" },
  { icon: Zap, title: "Instant Setup", desc: "Your domain is active in minutes" },
  { icon: Headphones, title: "24/7 Expert Support", desc: "We're here whenever you need us" },
];

type DomainPlan = {
  id: string;
  name: string;
  priceZar: number | null;
  unit?: string;
};

function extractTld(planName: string) {
  const match = planName.toLowerCase().match(/\.([a-z0-9-]+(?:\.[a-z0-9-]+)*)$/);
  return match?.[1] ?? "custom";
}

function DomainsPage() {
  const { data: session, authReady } = useHydratedSession();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DomainCheckResult[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });

  const categories = data?.categories ?? CATEGORIES;
  const cloudCategory = categories.find((c: any) => c.id === "managed-cloud");
  const domainService = cloudCategory?.services?.find((s: any) => s.id === "domains");
  const domainTlds = getDomainTldsFromPlans(domainService?.plans);
  const domainPlansByTld = useMemo(() => {
    const map = new Map<string, DomainPlan>();
    for (const plan of (domainService?.plans ?? []) as DomainPlan[]) {
      const tld = extractTld(plan.name);
      if (!map.has(tld)) map.set(tld, plan);
    }
    return map;
  }, [domainService?.plans]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = normalizeDomainQuery(query);
    if (!normalized) return;

    const candidates = buildDomainCandidates(normalized.value, domainTlds);
    if (!candidates.length) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const checks = await Promise.all(
        candidates.map(async (candidate) => {
          const plan = domainPlansByTld.get(candidate.tld);
          const res = await fetch(
            `/api/public/domains/check?domain=${encodeURIComponent(candidate.domain)}`,
          );
          const data = await res
            .json()
            .catch(() => ({ error: "Invalid response from domain service" }));
          if (!res.ok || data.error) {
            return {
              domain: candidate.domain,
              tld: candidate.tld,
              isAvailable: false,
              message: data.error || "Failed to check domain",
              priceZar: plan?.priceZar ?? undefined,
              planId: plan?.id,
              planName: plan?.name,
            };
          }
          const isAvailable = data.isAvailable === true || data.isAvailable === "true";
          return {
            domain: candidate.domain,
            tld: candidate.tld,
            isAvailable,
            message: data.strMessage || (isAvailable ? "Available!" : "Taken"),
            priceZar: plan?.priceZar ?? undefined,
            planId: plan?.id,
            planName: plan?.name,
          };
        }),
      );
      setSearchResults(checks);
    } catch (err) {
      setSearchResults([
        {
          domain: normalized.value,
          tld: "co.za",
          isAvailable: false,
          message: "Error checking domain",
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <MascotHero
        eyebrow={
          <>
            <Globe className="h-3 w-3" /> Domains
          </>
        }
        accent="var(--primary)"
        title={
          <>
            Find your perfect domain. <br />
            <span
              style={{
                background: "var(--gradient-primary)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Build your brand.
            </span>
          </>
        }
        subtitle="Register a new domain or transfer your existing one. Fast, secure, and simple."
        ctas={
          <div className="flex w-full max-w-lg flex-col gap-4">
            <form
              onSubmit={handleSearch}
              className="flex w-full overflow-hidden rounded-full border border-border bg-card shadow-[var(--shadow-card)] transition-shadow focus-within:ring-2 focus-within:ring-primary/20"
            >
              <div className="flex flex-1 items-center gap-2 px-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Your brand name"
                  className="w-full bg-transparent py-3 text-sm outline-none"
                  disabled={isSearching}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-80"
                style={{ background: "var(--gradient-primary)" }}
              >
                {isSearching && <Loader2 className="h-4 w-4 animate-spin" />}
                Search
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Search results
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {searchResults.filter((item) => item.isAvailable).length} available TLD
                      {searchResults.filter((item) => item.isAvailable).length === 1
                        ? ""
                        : "s"}{" "}
                      found
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:max-h-[28rem] sm:overflow-y-auto sm:pr-1">
                  {searchResults.map((item, index) => (
                    <div
                      key={item.domain}
                      className={`grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center ${index === 0 ? "border-[var(--primary)] bg-[var(--accent)]/30" : item.isAvailable ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}
                    >
                      <div className="flex items-center gap-3">
                        {item.isAvailable ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{item.domain}</div>
                          <div
                            className={`text-xs ${item.isAvailable ? "text-green-700" : "text-red-700"}`}
                          >
                            {item.isAvailable ? "Available to register" : item.message}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">
                            {typeof item.priceZar === "number"
                              ? formatPrice(item.priceZar, "ZAR")
                              : "Price pending"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">/year</div>
                        </div>
                        {item.isAvailable && item.planId ? (
                          <a
                            href={
                              authReady && session
                                ? `/dashboard/domains/new?domain=${encodeURIComponent(item.domain)}`
                                : `/auth/sign-up?callbackURL=${encodeURIComponent(
                                    `/dashboard/domains/new?domain=${encodeURIComponent(item.domain)}`,
                                  )}`
                            }
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Register
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground opacity-70"
                          >
                            Unavailable
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 px-2 text-xs text-muted-foreground">
              {domainTlds.map((tld) => {
                const plan = domainPlansByTld.get(tld);
                const price = typeof plan?.priceZar === "number" ? plan.priceZar.toFixed(0) : null;
                return (
                  <span key={tld}>
                    .{tld}{" "}
                    {price ? (
                      <strong className="text-foreground">R{price}/yr</strong>
                    ) : (
                      <strong className="text-foreground">Available</strong>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <div
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent)", color: "var(--primary)" }}
              >
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 pt-16 text-center">
          <SectionHeading
            eyebrow="Domain Plans"
            title="Pick the domain plan that fits"
            subtitle="All plans include DNS, nameserver, and renewal management."
          />
        </div>
        {isLoading && (
          <div className="mx-auto mt-8 max-w-7xl px-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-sm text-blue-800">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Refreshing live domain pricing. Crawlable fallback plans are shown below.
            </div>
          </div>
        )}
        {isError && (
          <div className="mx-auto mt-12 max-w-7xl px-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <div className="font-semibold">
                Live domain pricing did not load. Static catalog pricing is shown below.
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}
        {domainService ? (
          <ServiceSection service={domainService} accent={cloudCategory?.accent || "cloud"} />
        ) : null}
      </div>

      <CtaBanner
        title="Already have a domain?"
        subtitle="Transfer it to CloudMonkey and get 1 year added to your registration."
        primary={{ label: "Transfer Now", to: "/auth/sign-up" }}
        accent="var(--primary)"
      />
    </>
  );
}
