import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Globe, Loader2, Mail, Search, Server, ShoppingCart, Sparkles, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildDomainCandidates, getDomainTldsFromPlans, normalizeDomainQuery, type DomainCheckResult } from "@/lib/domain-search";

export const Route = createFileRoute("/dashboard/domains/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    payment: typeof search.payment === "string" ? search.payment : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
    subscription: typeof search.subscription === "string" ? search.subscription : undefined,
    domainOrder: typeof search.domainOrder === "string" ? search.domainOrder : undefined,
  }),
  head: () => ({
    meta: [{ title: "Add Domain - CloudMonkey Dashboard" }],
  }),
  component: AddDomainPage,
});

type Plan = {
  id: string;
  name: string;
  priceZar?: string | null;
  service?: { id: string; name: string; categoryId: string } | null;
};

function formatAmount(cents?: number | null) {
  return `R ${((cents ?? 0) / 100).toFixed(2)}`;
}

function extractTld(planName: string) {
  const lower = planName.toLowerCase();
  if (lower.includes(".co.za")) return "co.za";
  if (lower.includes(".com")) return "com";
  const match = lower.match(/\.([a-z0-9-]+(?:\.[a-z0-9-]+)*)$/);
  return match?.[1] ?? "custom";
}

function AddDomainPage() {
  const search = Route.useSearch();
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DomainCheckResult[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainCheckResult | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const { data: pricing } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: async () => {
      const res = await fetch("/api/public/pricing");
      if (!res.ok) throw new Error("Failed to fetch pricing");
      return res.json();
    },
  });

  const verifyPayment = useQuery({
    queryKey: ["domain-order", "verify", search.reference, search.subscription],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.reference) params.set("reference", search.reference);
      if (search.subscription) params.set("subscription", search.subscription);
      const res = await fetch(`/api/user/subscription/verify?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to verify payment");
      return res.json();
    },
    enabled: search.payment === "return" && (!!search.reference || !!search.subscription),
    retry: 1,
  });

  const categories = pricing?.categories ?? [];
  const cloudCategory = categories.find((c: any) => c.id === "cloud");
  const businessCategory = categories.find((c: any) => c.id === "business");
  const domainService = cloudCategory?.services?.find((s: any) => s.id === "domains");
  const domainTlds = getDomainTldsFromPlans(domainService?.plans);

  const domainPlansByTld = useMemo(() => {
    const map = new Map<string, Plan>();
    for (const plan of (domainService?.plans ?? []) as Plan[]) {
      const tld = extractTld(plan.name);
      if (!map.has(tld)) map.set(tld, plan);
    }
    const fallback = (domainService?.plans ?? []).find((plan: Plan) => extractTld(plan.name) === "custom") ?? domainService?.plans?.[0];
    if (fallback && !map.has("custom")) map.set("custom", fallback);
    return map;
  }, [domainService?.plans]);

  const addonPlans = useMemo(() => {
    const cloudServices = (cloudCategory?.services ?? []).filter((service: any) => ["websites", "hosting", "managed-infra", "openclaw"].includes(service.id));
    const businessServices = (businessCategory?.services ?? []).filter((service: any) => ["m365", "gws"].includes(service.id));
    return [...cloudServices, ...businessServices]
      .flatMap((service: any) => (service.plans ?? []).slice(0, 2).map((plan: Plan) => ({ ...plan, service })))
      .filter((plan: Plan) => parseInt(plan.priceZar ?? "0", 10) > 0);
  }, [businessCategory?.services, cloudCategory?.services]);

  const selectedAddonPlans = addonPlans.filter((plan: Plan) => selectedAddons.includes(plan.id));
  const total = (selectedDomain?.priceZar ?? 0) + selectedAddonPlans.reduce((sum: number, plan: Plan) => sum + parseInt(plan.priceZar ?? "0", 10), 0);

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDomain?.planId) throw new Error("Select an available priced domain first");
      const res = await fetch("/api/user/domain-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainName: selectedDomain.domain,
          domainPlanId: selectedDomain.planId,
          addonPlanIds: selectedAddons,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to start domain checkout");
      return body;
    },
    onSuccess: (data) => {
      toast.success("Domain checkout created");
      if (data.authorization_url) window.location.assign(data.authorization_url);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDomainQuery(domain);
    if (!normalized) {
      toast.error("Enter a domain name first");
      return;
    }

    const candidates = buildDomainCandidates(normalized.value, domainTlds);
    if (!candidates.length) {
      toast.error("No domain candidates available");
      return;
    }

    setIsLoading(true);
    setResults([]);
    setSelectedDomain(null);

    try {
      const checks = await Promise.all(candidates.map(async (candidate) => {
        const plan = domainPlansByTld.get(candidate.tld) ?? domainPlansByTld.get("custom");
        const res = await fetch(`/api/domains/check?domain=${encodeURIComponent(candidate.domain)}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          return {
            domain: candidate.domain,
            tld: candidate.tld,
            isAvailable: false,
            message: data.error || "Failed to check domain",
            priceZar: plan ? parseInt(plan.priceZar ?? "0", 10) : undefined,
            planId: plan?.id,
            planName: plan?.name,
          };
        }
        const isAvailable = data.isAvailable === true || data.isAvailable === "true";
        return {
          domain: candidate.domain,
          tld: candidate.tld,
          isAvailable,
          message: data.strMessage || (isAvailable ? "Available" : "Taken"),
          priceZar: plan ? parseInt(plan.priceZar ?? "0", 10) : undefined,
          planId: plan?.id,
          planName: plan?.name,
        };
      }));
      setResults(checks);
      const firstAvailable = checks.find((item) => item.isAvailable && item.planId);
      if (firstAvailable) setSelectedDomain(firstAvailable);
    } catch (error: any) {
      setResults([{
        domain: normalized.value,
        tld: "co.za",
        isAvailable: false,
        message: error.message || "Domain availability is not configured",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Domains"
        title={<>Add a new domain</>}
        subtitle="Search availability, select a priced domain, then add hosting, website, or email services before checkout."
      />

      {search.payment === "return" && (
        <Card className="rounded-lg border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-emerald-900">{verifyPayment.isLoading ? "Verifying payment" : verifyPayment.data?.verified ? "Payment received" : "Payment pending"}</div>
              <div className="text-sm text-emerald-800">Your domain order is being processed. It will appear in your domains list once registration completes.</div>
            </div>
            <Button asChild className="rounded-lg bg-emerald-700 hover:bg-emerald-800">
              <Link to="/dashboard/domains">View domains</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Check domain availability</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCheck} className="space-y-4">
                <div className="flex overflow-hidden rounded-xl border border-border bg-white">
                  <div className="flex items-center px-4 text-muted-foreground">
                    <Search className="h-4 w-4" />
                  </div>
                  <Input
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="example"
                    className="border-0 focus-visible:ring-0"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="rounded-xl bg-[var(--ai)] shadow-sm" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Check availability
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/dashboard/domains">Back to domains</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Domain options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!results.length ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Search a domain first to see availability and pricing.
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((item, index) => (
                    <button
                      key={item.domain}
                      type="button"
                      disabled={!item.isAvailable || !item.planId}
                      onClick={() => setSelectedDomain(item)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${selectedDomain?.domain === item.domain ? "border-[var(--ai)] bg-[var(--ai-soft)]/30" : index === 0 ? "border-[#d8cdfc] bg-[#fbf9ff]" : item.isAvailable ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"} ${!item.isAvailable || !item.planId ? "cursor-not-allowed opacity-75" : "hover:border-[var(--ai)]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {item.isAvailable ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                          ) : (
                            <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-600" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground">{item.domain}</div>
                            <div className={`text-sm ${item.isAvailable ? "text-emerald-700" : "text-amber-700"}`}>{item.message}</div>
                            {item.planName && <div className="mt-1 text-xs text-muted-foreground">{item.planName}</div>}
                          </div>
                        </div>
                        <Badge variant={item.priceZar ? "default" : "outline"}>{item.priceZar ? formatAmount(item.priceZar) : "No price"}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedDomain ? (
                <>
                  <div className="rounded-lg border border-border bg-[#f8fafc] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#07102c]">
                      <Globe className="h-4 w-4 text-[var(--ai)]" />
                      {selectedDomain.domain}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Registration</span>
                      <span className="font-semibold">{formatAmount(selectedDomain.priceZar)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-[#07102c]">Add services on this domain</div>
                    {!addonPlans.length ? (
                      <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">No add-ons are configured yet.</div>
                    ) : addonPlans.map((plan: Plan) => {
                      const selected = selectedAddons.includes(plan.id);
                      const Icon = plan.service?.id === "m365" || plan.service?.id === "gws" ? Mail : plan.service?.id === "hosting" || plan.service?.id === "managed-infra" ? Server : ShoppingCart;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedAddons((current) => selected ? current.filter((id) => id !== plan.id) : [...current, plan.id])}
                          className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${selected ? "border-[var(--ai)] bg-[#f6f1ff]" : "border-border bg-white"}`}
                        >
                          <Icon className="mt-0.5 h-4 w-4 text-[var(--ai)]" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[#07102c]">{plan.service?.name} - {plan.name}</div>
                            <div className="text-xs text-muted-foreground">{formatAmount(parseInt(plan.priceZar ?? "0", 10))}</div>
                          </div>
                          <Badge variant={selected ? "default" : "outline"}>{selected ? "Added" : "Add"}</Badge>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#07102c]">Total due today</span>
                      <span className="text-lg font-bold text-[#07102c]">{formatAmount(total)}</span>
                    </div>
                    <Button className="mt-4 w-full rounded-lg bg-[var(--ai)]" disabled={orderMutation.isPending} onClick={() => orderMutation.mutate()}>
                      {orderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                      Continue to payment
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Select an available domain with pricing to continue.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
