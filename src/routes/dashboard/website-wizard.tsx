import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CreditCard, Globe, Loader2, Send, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/website-wizard")({
  validateSearch: (search: Record<string, unknown>) => ({
    payment: typeof search.payment === "string" ? search.payment : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
    subscription: typeof search.subscription === "string" ? search.subscription : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
    coupon: typeof search.coupon === "string" ? search.coupon : undefined,
  }),
  head: () => ({
    meta: [{ title: "Website Wizard - CloudMonkey" }],
  }),
  component: WebsiteWizardPage,
});

type SubscriptionRow = {
  id: string;
  name: string;
  status: string;
  planId?: string | null;
  amount: number;
  currentPeriodEnd?: string | null;
  plan?: { id: string; name: string; service?: { id: string; name: string } | null } | null;
};

type Answers = Record<string, string>;

const groups = [
  {
    title: "Business",
    fields: [
      ["businessName", "Business name", "input", true],
      ["industry", "Industry", "input", true],
      ["businessDescription", "What the business does", "textarea", true],
      ["targetCustomers", "Target customers", "textarea", false],
    ],
  },
  {
    title: "Website",
    fields: [
      ["goals", "Primary goals", "textarea", true],
      ["pages", "Required pages", "textarea", true],
      ["brandStyle", "Brand style and references", "textarea", false],
      ["contentStatus", "Content, copy and image status", "textarea", false],
    ],
  },
  {
    title: "Commerce",
    fields: [
      ["products", "Products, services or categories", "textarea", false],
      ["paymentNeeds", "Payment needs", "textarea", false],
      ["deliveryNeeds", "Delivery or collection needs", "textarea", false],
      ["addons", "Add-ons and integrations", "textarea", false],
    ],
  },
  {
    title: "Launch",
    fields: [
      ["preferredSlug", "Temporary domain slug", "input", false],
      ["domainNeeds", "Domain and email needs", "textarea", false],
      ["seoGoals", "SEO goals and priority keywords", "textarea", false],
      ["notes", "Anything else CloudMonkey should know", "textarea", false],
    ],
  },
] as const;

async function fetchJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Failed to fetch ${path}`);
  return data;
}

function isWebsitePlan(planId?: string | null) {
  return !!planId && (planId.startsWith("web-") || planId.startsWith("ecom-"));
}

function WebsiteWizardPage() {
  const { data: session } = authClient.useSession();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const subscriptions = useQuery({
    queryKey: ["user", "subscription"],
    queryFn: () => fetchJson<SubscriptionRow[]>("/api/user/subscription"),
    enabled: !!session,
  });

  const verifyPayment = useQuery({
    queryKey: ["website-payment", "verify", search.reference, search.subscription],
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
    if (verifyPayment.data) subscriptions.refetch();
  }, [verifyPayment.data, subscriptions]);

  const selectedSubscription = useMemo(() => {
    const rows = subscriptions.data ?? [];
    return (
      (search.subscription ? rows.find((row) => row.id === search.subscription) : null) ??
      (search.plan ? rows.find((row) => row.planId === search.plan) : null) ??
      rows.find((row) => isWebsitePlan(row.planId) && ["active", "trialing", "pending"].includes(row.status)) ??
      null
    );
  }, [search.plan, search.subscription, subscriptions.data]);

  const checkout = useMutation({
    mutationFn: async () => fetchJson<any>("/api/user/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: search.plan, interval: "month", couponCode: search.coupon || null }),
    }),
    onSuccess: (data) => {
      if (data.authorization_url) window.location.assign(data.authorization_url);
      else subscriptions.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: async () => fetchJson<any>("/api/user/website-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: selectedSubscription?.id, answers }),
    }),
    onSuccess: (data) => {
      toast.success("Website brief submitted");
      navigate({ to: "/dashboard/websites/$websiteId", params: { websiteId: data.website.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = groups[step];
  const canContinue = current.fields.every(([id, , , required]) => !required || answers[id]?.trim());
  const isReady = selectedSubscription && ["active", "trialing"].includes(selectedSubscription.status);

  if (subscriptions.isLoading || verifyPayment.isLoading) {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--ai)]" /></div>;
  }

  if (!selectedSubscription || !isReady) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Website onboarding"
          title={<>Start your managed website build.</>}
          subtitle="Website and ecommerce plans need an active trial or confirmed payment before the build brief."
        />
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-bold text-[#07102c]">{selectedSubscription?.name ?? "No website plan selected"}</div>
              <div className="text-sm text-muted-foreground">
                {selectedSubscription?.status === "pending" ? "Payment is pending. Open checkout or billing to continue." : "Choose a website or ecommerce plan from pricing."}
              </div>
            </div>
            <div className="flex gap-2">
              {search.plan && (
                <Button className="rounded-lg bg-[var(--ai)]" onClick={() => checkout.mutate()} disabled={checkout.isPending}>
                  {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Continue checkout
                </Button>
              )}
              <Button asChild variant="outline" className="rounded-lg">
                <Link to="/pricing">Open pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website onboarding"
        title={<>Managed website build brief.</>}
        subtitle={selectedSubscription.name}
        actions={<Badge className="rounded-lg bg-[#efe7ff] text-[#5d2fe8]">{selectedSubscription.status}</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-[#07102c]">
              {selectedSubscription.planId?.startsWith("ecom-") ? <ShoppingCart className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
              {current.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {current.fields.map(([id, label, type]) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={id}>{label}</Label>
                {type === "textarea" ? (
                  <Textarea id={id} rows={4} value={answers[id] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [id]: event.target.value }))} />
                ) : (
                  <Input id={id} value={answers[id] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [id]: event.target.value }))} />
                )}
              </div>
            ))}
            <div className="flex justify-between border-t border-[#e5e8ef] pt-5">
              <Button variant="outline" className="rounded-lg" disabled={step === 0 || submit.isPending} onClick={() => setStep((value) => value - 1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {step === groups.length - 1 ? (
                <Button className="rounded-lg bg-[var(--ai)]" disabled={!canContinue || submit.isPending} onClick={() => submit.mutate()}>
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit brief
                </Button>
              ) : (
                <Button className="rounded-lg bg-[var(--ai)]" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Sections</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {groups.map((group, index) => (
              <button key={group.title} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm ${index === step ? "border-[var(--ai)] bg-[#f6f1ff]" : "border-border"}`} onClick={() => setStep(index)}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{index < step ? <Check className="h-3 w-3" /> : index + 1}</span>
                {group.title}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
