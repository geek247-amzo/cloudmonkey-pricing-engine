import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, CreditCard, Loader2, Search, Send, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/intelligence-wizard")({
  validateSearch: (search: Record<string, unknown>) => ({
    payment: typeof search.payment === "string" ? search.payment : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
    subscription: typeof search.subscription === "string" ? search.subscription : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
    coupon: typeof search.coupon === "string" ? search.coupon : undefined,
  }),
  head: () => ({
    meta: [{ title: "SEO & Marketing Wizard - CloudMonkey" }],
  }),
  component: IntelligenceWizardPage,
});

type SubscriptionRow = {
  id: string;
  name: string;
  status: string;
  planId?: string | null;
  plan?: { id: string; name: string; service?: { id: string; name: string } | null } | null;
};

type PricingPlan = {
  id: string;
  name: string;
  priceZar?: string | null;
  service?: { id: string; name: string };
};

type PricingResponse = {
  categories?: Array<{ services?: Array<{ id: string; name: string; plans?: PricingPlan[] }> }>;
};

type Intake = {
  businessName: string;
  websiteUrl: string;
  location: string;
  industry: string;
  servicesProducts: string;
  goals: string;
  targetAudience: string;
  monthlyBudget: string;
  keywords: string;
  competitors: string;
  marketingChannels: string;
};

function isIntelligencePlanId(planId?: string | null) {
  return Boolean(planId?.startsWith("ci-") || planId === "agent-marketing");
}

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed to fetch ${path}`);
  return data;
}

function IntelligenceWizardPage() {
  const { data: session } = authClient.useSession();
  const search = Route.useSearch();
  const [activeStep, setActiveStep] = useState(0);
  const [couponCode, setCouponCode] = useState(search.coupon ?? "");
  const [intake, setIntake] = useState<Intake>({
    businessName: "",
    websiteUrl: "",
    location: "",
    industry: "",
    servicesProducts: "",
    goals: "",
    targetAudience: "",
    monthlyBudget: "",
    keywords: "",
    competitors: "",
    marketingChannels: "",
  });

  const subscriptions = useQuery({
    queryKey: ["user", "subscription"],
    queryFn: () => fetchJson("/api/user/subscription") as Promise<SubscriptionRow[]>,
    enabled: !!session,
  });

  const pricing = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: () => fetchJson("/api/public/pricing") as Promise<PricingResponse>,
    enabled: !!session && !!search.plan,
  });

  const verifyPayment = useQuery({
    queryKey: ["intelligence-payment", "verify", search.reference, search.subscription],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.reference) params.set("reference", search.reference);
      if (search.subscription) params.set("subscription", search.subscription);
      return fetchJson(`/api/user/subscription/verify?${params.toString()}`);
    },
    enabled: !!session && search.payment === "return" && (!!search.reference || !!search.subscription),
    retry: 1,
  });

  useEffect(() => {
    if (verifyPayment.data?.verified) {
      subscriptions.refetch();
      localStorage.removeItem("cloudmonkey:selected-plan");
      localStorage.removeItem("cloudmonkey:coupon-code");
    }
  }, [verifyPayment.data?.verified, subscriptions]);

  const selectedSubscription = useMemo(() => {
    const rows = subscriptions.data ?? [];
    if (search.subscription) {
      const exact = rows.find((item) => item.id === search.subscription);
      if (exact) return exact;
    }
    if (search.plan) {
      const matchingPlan = rows.find((item) => item.planId === search.plan);
      if (matchingPlan) return matchingPlan;
    }
    return rows.find((item) => isIntelligencePlanId(item.planId) && ["active", "trialing", "pending"].includes(item.status)) ?? null;
  }, [search.plan, search.subscription, subscriptions.data]);

  const selectedPlan = useMemo(() => {
    if (!search.plan) return null;
    return pricing.data?.categories
      ?.flatMap((category) => category.services ?? [])
      ?.flatMap((service) => (service.plans ?? []).map((plan) => ({ ...plan, service: { id: service.id, name: service.name } })))
      ?.find((plan) => plan.id === search.plan) ?? null;
  }, [pricing.data, search.plan]);

  const isPaid = selectedSubscription?.status === "active" || selectedSubscription?.status === "trialing";
  const steps = [
    { id: "business", title: "Business profile", icon: BarChart3 },
    { id: "market", title: "SEO and marketing goals", icon: Search },
    { id: "competitors", title: "Keywords and competitors", icon: Target },
  ];
  const progress = Math.round(((activeStep + 1) / steps.length) * 100);

  const checkoutMutation = useMutation({
    mutationFn: async () => fetchJson("/api/user/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: search.plan ?? "ci-growth",
        bundleId: null,
        interval: "month",
        couponCode: couponCode.trim() || null,
      }),
    }),
    onSuccess: (data) => {
      if (data.authorization_url) {
        window.location.assign(data.authorization_url);
        return;
      }
      if (data.subscription?.status === "active" || data.subscription?.status === "trialing" || data.discounted || data.alreadyActive) {
        localStorage.removeItem("cloudmonkey:selected-plan");
        localStorage.removeItem("cloudmonkey:coupon-code");
        subscriptions.refetch();
        toast.success(data.discounted ? "Coupon applied and SEO service activated" : "SEO service activated");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const targetKeywords = splitList(intake.keywords);
      const competitors = splitList(intake.competitors).map((websiteUrl) => ({ websiteUrl }));
      const created = await fetchJson("/api/user/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: intake.businessName,
          websiteUrl: intake.websiteUrl,
          location: intake.location,
          industry: intake.industry,
          servicesProducts: [
            intake.servicesProducts,
            intake.goals ? `Goals: ${intake.goals}` : "",
            intake.targetAudience ? `Audience: ${intake.targetAudience}` : "",
            intake.monthlyBudget ? `Marketing budget: ${intake.monthlyBudget}` : "",
            intake.marketingChannels ? `Current channels: ${intake.marketingChannels}` : "",
          ].filter(Boolean).join("\n\n"),
          targetKeywords,
          competitors,
        }),
      });
      await fetchJson(`/api/user/intelligence/${encodeURIComponent(created.project.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return created;
    },
    onSuccess: () => {
      toast.success("SEO and marketing intake submitted");
      window.location.assign("/dashboard/intelligence");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function canContinue() {
    if (activeStep === 0) return Boolean(intake.businessName && intake.websiteUrl && intake.location && intake.industry && intake.servicesProducts);
    if (activeStep === 1) return Boolean(intake.goals && intake.targetAudience);
    return splitList(intake.keywords).length >= 3 && splitList(intake.competitors).length >= 3;
  }

  if (subscriptions.isLoading || verifyPayment.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ai)]" />
      </div>
    );
  }

  if (!selectedSubscription) {
    return (
      <CheckoutPanel
        plan={selectedPlan}
        selectedPlanId={search.plan}
        couponCode={couponCode}
        onCouponChange={(value) => {
          setCouponCode(value);
          if (value.trim()) localStorage.setItem("cloudmonkey:coupon-code", value.trim());
          else localStorage.removeItem("cloudmonkey:coupon-code");
        }}
        onCheckout={() => checkoutMutation.mutate()}
        isPending={checkoutMutation.isPending}
        isLoading={pricing.isLoading}
      />
    );
  }

  if (!isPaid) {
    return (
      <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#07102c]">Payment confirmation required</h1>
            <p className="mt-1 text-sm text-[#4d5874]">{selectedSubscription.name} is still marked as {selectedSubscription.status}.</p>
          </div>
          <Button asChild className="rounded-lg bg-amber-600 hover:bg-amber-700">
            <Link to="/dashboard/billing">Open billing</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#dfe4ef] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            SEO and marketing setup
          </h1>
          <p className="mt-1 text-sm font-medium text-[#4d5874]">{selectedSubscription.name}</p>
        </div>
        <Badge className="w-fit rounded-lg bg-[#efe7ff] px-4 py-2 text-sm font-bold text-[#5d2fe8] shadow-none">
          {selectedSubscription.status === "trialing" ? "Trial subscription" : "Paid subscription"}
        </Badge>
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Product to onboard</div>
            <div className="mt-2 text-lg font-extrabold text-[#07102c]">{selectedSubscription.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              This will create your Competitor Intelligence profile and submit it for CloudMonkey admin analysis.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/dashboard/intelligence">View intelligence dashboard</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-[#07102c]">{steps[activeStep].title}</CardTitle>
            <p className="text-sm text-[#4d5874]">CloudMonkey uses this intake to prepare your Competitor Intelligence profile and admin-run SEO report.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {activeStep === 0 && (
              <>
                <Field label="Business name" value={intake.businessName} onChange={(businessName) => setIntake({ ...intake, businessName })} required />
                <Field label="Website URL" value={intake.websiteUrl} onChange={(websiteUrl) => setIntake({ ...intake, websiteUrl })} placeholder="https://example.co.za" required />
                <Field label="Primary location" value={intake.location} onChange={(location) => setIntake({ ...intake, location })} placeholder="Durban, South Africa" required />
                <Field label="Industry" value={intake.industry} onChange={(industry) => setIntake({ ...intake, industry })} required />
                <TextField label="Services/products" value={intake.servicesProducts} onChange={(servicesProducts) => setIntake({ ...intake, servicesProducts })} required />
              </>
            )}
            {activeStep === 1 && (
              <>
                <TextField label="Main SEO and marketing goals" value={intake.goals} onChange={(goals) => setIntake({ ...intake, goals })} placeholder="More qualified leads, local ranking, content plan, competitor monitoring..." required />
                <TextField label="Target audience" value={intake.targetAudience} onChange={(targetAudience) => setIntake({ ...intake, targetAudience })} required />
                <Field label="Monthly marketing budget" value={intake.monthlyBudget} onChange={(monthlyBudget) => setIntake({ ...intake, monthlyBudget })} placeholder="Optional" />
                <TextField label="Current marketing channels" value={intake.marketingChannels} onChange={(marketingChannels) => setIntake({ ...intake, marketingChannels })} placeholder="Google Ads, Facebook, email, SEO, referrals..." />
              </>
            )}
            {activeStep === 2 && (
              <>
                <TextField label="Target keywords" value={intake.keywords} onChange={(keywords) => setIntake({ ...intake, keywords })} placeholder="At least 3, one per line or comma separated" required />
                <TextField label="Competitor URLs" value={intake.competitors} onChange={(competitors) => setIntake({ ...intake, competitors })} placeholder="At least 3, one URL per line or comma separated" required />
              </>
            )}

            <div className="flex flex-col gap-3 border-t border-[#e5e8ef] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" className="rounded-lg" disabled={activeStep === 0 || submitMutation.isPending} onClick={() => setActiveStep((step) => Math.max(0, step - 1))}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button type="button" className="rounded-lg bg-[var(--ai)]" disabled={!canContinue() || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit for analysis
                </Button>
              ) : (
                <Button type="button" className="rounded-lg bg-[var(--ai)]" disabled={!canContinue()} onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-5">
          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="font-bold text-[#07102c]">Setup progress</div>
              <div className="mt-5 h-2 rounded-full bg-[#e5e8ef]">
                <div className="h-2 rounded-full bg-[var(--ai)]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3 text-sm font-medium text-[#4d5874]">{progress}% complete</div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm ${index === activeStep ? "border-[var(--ai)] bg-[#f6f1ff]" : "border-border bg-white"}`}
                    onClick={() => setActiveStep(index)}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${index < activeStep ? "bg-emerald-600 text-white" : "bg-muted text-foreground"}`}>
                      {index < activeStep ? <Check className="h-3 w-3" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    {step.title}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function CheckoutPanel({
  plan,
  selectedPlanId,
  couponCode,
  onCouponChange,
  onCheckout,
  isPending,
  isLoading,
}: {
  plan: PricingPlan | null;
  selectedPlanId?: string;
  couponCode: string;
  onCouponChange: (value: string) => void;
  onCheckout: () => void;
  isPending: boolean;
  isLoading: boolean;
}) {
  const selectedName = plan?.service?.name ? `${plan.service.name} - ${plan.name}` : plan?.name ?? selectedPlanId ?? "SEO and marketing package";
  const rawPrice = plan?.priceZar ?? null;
  const price = rawPrice ? `R ${(parseInt(rawPrice, 10) / 100).toFixed(2)} / month` : "Price loading";

  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-[var(--ai)]" />
            <div>
              <h1 className="text-xl font-bold text-[#07102c]">Start SEO and marketing checkout</h1>
              <p className="text-sm text-[#4d5874]">Activate the service, then complete the dedicated intake for competitor intelligence, SEO, and marketing.</p>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-[#dfe4ef] bg-[#f6f8fc] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Selected service</div>
            <div className="mt-2 text-lg font-bold text-[#07102c]">{isLoading ? "Loading selected service..." : selectedName}</div>
            <div className="mt-1 text-sm text-muted-foreground">{isLoading ? "Checking latest pricing" : price}</div>
          </div>
        </div>

        <form className="space-y-4 rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-4" onSubmit={(event) => { event.preventDefault(); onCheckout(); }}>
          <div className="space-y-2">
            <Label htmlFor="intelligenceCouponCode">Coupon code</Label>
            <Input id="intelligenceCouponCode" value={couponCode} onChange={(event) => onCouponChange(event.target.value)} placeholder="Optional" className="rounded-lg" />
          </div>
          <Button type="submit" className="w-full rounded-lg bg-[var(--ai)]" disabled={isPending || isLoading}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {couponCode.trim().toLowerCase() === "amrishtest" ? "Activate with coupon" : "Continue to checkout"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            After payment, you will complete the SEO and marketing intake. CloudMonkey admins run the reports from the backend.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="rounded-lg" />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="min-h-28 rounded-lg" />
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
