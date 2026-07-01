import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Shield, Lock, Zap, Headphones, Globe, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { fetchPublicPricingCatalog } from "@/lib/pricing";
import { buildDomainCandidates, getDomainTldsFromPlans, normalizeDomainQuery, type DomainCheckResult } from "@/lib/domain-search";

export const Route = createFileRoute("/domains")({
  head: () => ({
    meta: [
      { title: "Domains — Find your perfect domain. Build your brand." },
      { name: "description", content: "Register or transfer your domain with CloudMonkey. DNS, nameserver and renewal management included." },
      { property: "og:title", content: "CloudMonkey Domains" },
      { property: "og:description", content: "Find your perfect domain." },
    ],
  }),
  component: DomainsPage,
});

const TRUST = [
  { icon: Shield, title: "Free Privacy Protection", desc: "Keep your personal information private" },
  { icon: Lock, title: "SSL Certificate", desc: "Keep your site secure with SSL included" },
  { icon: Zap, title: "Instant Setup", desc: "Your domain is active in minutes" },
  { icon: Headphones, title: "24/7 Expert Support", desc: "We're here whenever you need us" },
];

function DomainsPage() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DomainCheckResult[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });

  const categories = data?.categories ?? [];
  const cloudCategory = categories.find((c: any) => c.id === "cloud");
  const domainService = cloudCategory?.services?.find((s: any) => s.id === "domains");
  const domainTlds = getDomainTldsFromPlans(domainService?.plans);
  const domainPlansByTld = new Map(
    (domainService?.plans ?? [])
      .map((plan: any) => {
        const match = String(plan.name ?? "").toLowerCase().match(/\.([a-z0-9-]+(?:\.[a-z0-9-]+)*)$/);
        return match?.[1] ? [match[1], plan] : null;
      })
      .filter(Boolean) as Array<[string, any]>,
  );

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
      const checks = await Promise.all(candidates.map(async (candidate) => {
        const res = await fetch(`/api/domains/check?domain=${encodeURIComponent(candidate.domain)}`);
        const data = await res.json();
        if (data.error) {
          return {
            domain: candidate.domain,
            tld: candidate.tld,
            isAvailable: false,
            message: data.error,
          };
        }
        const isAvailable = data.isAvailable === true || data.isAvailable === "true";
        return {
          domain: candidate.domain,
          tld: candidate.tld,
          isAvailable,
          message: data.strMessage || (isAvailable ? "Available!" : "Taken"),
        };
      }));
      setSearchResults(checks);
    } catch (err) {
      setSearchResults([{
        domain: normalized.value,
        tld: "co.za",
        isAvailable: false,
        message: "Error checking domain",
      }]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <MascotHero
        eyebrow={<><Globe className="h-3 w-3" /> Domains</>}
        accent="var(--primary)"
        title={<>Find your perfect domain. <br /><span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Build your brand.</span></>}
        subtitle="Register a new domain or transfer your existing one. Fast, secure, and simple."
        ctas={
          <div className="flex w-full max-w-lg flex-col gap-4">
            <form onSubmit={handleSearch} className="flex w-full overflow-hidden rounded-full border border-border bg-card shadow-[var(--shadow-card)] transition-shadow focus-within:ring-2 focus-within:ring-primary/20">
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
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Search results</div>
                <div className="space-y-2">
                  {searchResults.map((item, index) => (
                    <div
                      key={item.domain}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-4 ${index === 0 ? "border-[var(--primary)] bg-[var(--accent)]/30" : item.isAvailable ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}
                    >
                      <div className="flex items-center gap-3">
                        {item.isAvailable ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{item.domain}</div>
                          <div className={`text-xs ${item.isAvailable ? "text-green-700" : "text-red-700"}`}>{item.message}</div>
                        </div>
                      </div>
                      {item.isAvailable && index === 0 && (
                        <Link to="/auth/sign-up" className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700">
                          Register
                        </Link>
                      )}
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
                    .{tld} {price ? <strong className="text-foreground">R{price}/yr</strong> : <strong className="text-foreground">Available</strong>}
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
              <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent)", color: "var(--primary)" }}>
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
        {isLoading ? (
          <div className="py-24 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            Loading latest domain pricing...
          </div>
        ) : domainService ? (
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
