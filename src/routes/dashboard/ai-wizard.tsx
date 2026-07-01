import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/ai-wizard")({
  validateSearch: (search: Record<string, unknown>) => ({
    payment: typeof search.payment === "string" ? search.payment : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
    subscription: typeof search.subscription === "string" ? search.subscription : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
    bundle: typeof search.bundle === "string" ? search.bundle : undefined,
    coupon: typeof search.coupon === "string" ? search.coupon : undefined,
  }),
  head: () => ({
    meta: [{ title: "Product Onboarding - CloudMonkey" }],
  }),
  component: AiWizardPage,
});

type FieldType = "text" | "textarea" | "select" | "multi";
type Field = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};
type FieldGroup = {
  id: string;
  title: string;
  description: string;
  fields: Field[];
};
type SubscriptionRow = {
  id: string;
  name: string;
  status: string;
  amount: number;
  interval: string;
  planId?: string | null;
  bundleId?: string | null;
  plan?: {
    id: string;
    name: string;
    service?: { id: string; name: string; categoryId: string } | null;
    features?: { content: string }[];
  } | null;
  bundle?: {
    id: string;
    name: string;
    features?: { content: string }[];
  } | null;
};
type PricingPlan = {
  id: string;
  name: string;
  priceZar?: string | null;
  trialDays?: number | null;
  service?: { id: string; name: string };
};
type PricingBundle = {
  id: string;
  name: string;
  priceZar?: string | null;
};
type PricingResponse = {
  categories?: Array<{ services?: Array<{ id: string; name: string; plans?: PricingPlan[] }> }>;
  bundles?: PricingBundle[];
};
type Answers = Record<string, string | string[]>;

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function AiWizardPage() {
  const { data: session } = authClient.useSession();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [couponCode, setCouponCode] = useState(search.coupon ?? "");

  const subscriptions = useQuery({
    queryKey: ["user", "subscription"],
    queryFn: () => fetchJson("/api/user/subscription") as Promise<SubscriptionRow[]>,
    enabled: !!session,
  });

  const pricing = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: () => fetchJson("/api/public/pricing") as Promise<PricingResponse>,
    enabled: !!session && (!!search.plan || !!search.bundle),
  });

  const verifyPayment = useQuery({
    queryKey: ["payment", "verify", search.reference, search.subscription],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.reference) params.set("reference", search.reference);
      if (search.subscription) params.set("subscription", search.subscription);
      return fetchJson(`/api/user/subscription/verify?${params.toString()}`);
    },
    enabled:
      !!session && search.payment === "return" && (!!search.reference || !!search.subscription),
    retry: 1,
  });

  useEffect(() => {
    if (verifyPayment.data?.verified) {
      subscriptions.refetch();
      localStorage.removeItem("cloudmonkey:selected-plan");
      localStorage.removeItem("cloudmonkey:selected-bundle");
      localStorage.removeItem("cloudmonkey:coupon-code");
    }
  }, [verifyPayment.data?.verified, subscriptions]);

  useEffect(() => {
    if (search.coupon) {
      setCouponCode(search.coupon);
      localStorage.setItem("cloudmonkey:coupon-code", search.coupon);
    }
  }, [search.coupon]);

  const selectedSubscription = useMemo(() => {
    const rows = subscriptions.data ?? [];
    const searched = search.subscription
      ? rows.find((item) => item.id === search.subscription)
      : null;
    const hasSelectedProduct = Boolean(search.plan || search.bundle);
    const selectedProductSubscription = hasSelectedProduct
      ? rows.find((item) =>
          search.plan ? item.planId === search.plan : item.bundleId === search.bundle,
        )
      : null;

    if (hasSelectedProduct) return searched ?? selectedProductSubscription ?? null;

    return (
      searched ??
      rows.find((item) => item.status === "active" || item.status === "trialing") ??
      rows.find((item) => item.status === "pending") ??
      null
    );
  }, [subscriptions.data, search.bundle, search.plan, search.subscription]);

  useEffect(() => {
    const isWebsitePlan = selectedSubscription?.planId?.startsWith("web-")
      || selectedSubscription?.planId?.startsWith("ecom-")
      || search.plan?.startsWith("web-")
      || search.plan?.startsWith("ecom-");
    if (isWebsitePlan) {
      navigate({
        to: "/dashboard/website-wizard",
        search: {
          payment: search.payment,
          reference: search.reference,
          subscription: search.subscription,
          plan: search.plan,
          coupon: search.coupon,
        },
        replace: true,
      });
      return;
    }

    const isIntelligencePlan = selectedSubscription?.planId?.startsWith("ci-")
      || selectedSubscription?.planId === "agent-marketing"
      || selectedSubscription?.plan?.service?.id === "competitor-intelligence"
      || search.plan?.startsWith("ci-")
      || search.plan === "agent-marketing";
    if (!isIntelligencePlan) return;
    navigate({
      to: "/dashboard/intelligence-wizard",
      search: {
        payment: search.payment,
        reference: search.reference,
        subscription: search.subscription,
        plan: search.plan,
        coupon: search.coupon,
      },
      replace: true,
    });
  }, [navigate, search.coupon, search.payment, search.plan, search.reference, search.subscription, selectedSubscription]);

  const groups = useMemo(() => buildFieldGroups(selectedSubscription), [selectedSubscription]);
  const currentGroup = groups[activeGroup];
  const isPaid =
    selectedSubscription?.status === "active" || selectedSubscription?.status === "trialing";
  const progress = groups.length ? Math.round(((activeGroup + 1) / groups.length) * 100) : 0;
  const selectedPlan = useMemo(() => {
    if (!search.plan) return null;
    return pricing.data?.categories
      ?.flatMap((category) => category.services ?? [])
      ?.flatMap((service) => (service.plans ?? []).map((plan) => ({ ...plan, service: { id: service.id, name: service.name } })))
      ?.find((plan) => plan.id === search.plan) ?? null;
  }, [pricing.data, search.plan]);
  const selectedBundle = useMemo(() => {
    if (!search.bundle) return null;
    return pricing.data?.bundles?.find((bundle) => bundle.id === search.bundle) ?? null;
  }, [pricing.data, search.bundle]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: search.plan ?? null,
          bundleId: search.plan ? null : search.bundle ?? null,
          interval: "month",
          couponCode: couponCode.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Failed to start checkout" }));
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      return data;
    },
    onSuccess: (data) => {
      if (data.authorization_url) {
        window.location.assign(data.authorization_url);
        return;
      }
      if (data.subscription?.status === "active" || data.subscription?.status === "trialing" || data.alreadyPaid || data.discounted || data.alreadyActive) {
        localStorage.removeItem("cloudmonkey:selected-plan");
        localStorage.removeItem("cloudmonkey:selected-bundle");
        localStorage.removeItem("cloudmonkey:coupon-code");
        subscriptions.refetch();
        toast.success(data.discounted ? "Coupon applied and subscription activated" : "Subscription ready");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubscription) throw new Error("No subscription selected");
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: selectedSubscription.id,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit onboarding");
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        data.n8nStatus === "sent" ? "Onboarding submitted" : "Onboarding saved for follow-up",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateAnswer(field: Field, value: string) {
    setAnswers((current) => {
      if (field.type !== "multi") return { ...current, [field.id]: value };
      const currentValues = Array.isArray(current[field.id]) ? (current[field.id] as string[]) : [];
      return {
        ...current,
        [field.id]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  }

  function canContinue() {
    if (!currentGroup) return false;
    return currentGroup.fields.every((field) => {
      if (!field.required) return true;
      const value = answers[field.id];
      return Array.isArray(value) ? value.length > 0 : !!value;
    });
  }

  if (subscriptions.isLoading || verifyPayment.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ai)]" />
      </div>
    );
  }

  if (!selectedSubscription) {
    if (search.plan || search.bundle) {
      return (
        <div className="space-y-6">
          <CheckoutSelectionPanel
            plan={selectedPlan}
            bundle={selectedBundle}
            selectedPlanId={search.plan}
            selectedBundleId={search.bundle}
            isLoading={pricing.isLoading}
            couponCode={couponCode}
            onCouponChange={(value) => {
              setCouponCode(value);
              if (value.trim()) localStorage.setItem("cloudmonkey:coupon-code", value.trim());
              else localStorage.removeItem("cloudmonkey:coupon-code");
            }}
            onCheckout={() => checkoutMutation.mutate()}
            isPending={checkoutMutation.isPending}
          />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <EmptyState
          title="No product subscription found"
          description="Choose a CloudMonkey product first so we can collect the right setup details."
        />
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="space-y-6">
        <PaymentRequired subscription={selectedSubscription} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#dfe4ef] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <WandSparkles className="h-10 w-10 text-[var(--ai)]" />
          <div>
            <h1
              className="text-2xl font-extrabold text-[#07102c]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Product onboarding
            </h1>
            <p className="text-sm font-medium text-[#4d5874]">{selectedSubscription.name}</p>
          </div>
        </div>
        <Badge className="w-fit rounded-lg bg-[#efe7ff] px-4 py-2 text-sm font-bold text-[#5d2fe8] shadow-none">
          {selectedSubscription.status === "trialing" ? "Trial subscription" : "Paid subscription"}
        </Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl text-[#07102c]">{currentGroup.title}</CardTitle>
                <p className="mt-2 text-sm text-[#4d5874]">{currentGroup.description}</p>
              </div>
              <Badge variant="outline" className="w-fit rounded-lg">
                Step {activeGroup + 1} of {groups.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {currentGroup.fields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={updateAnswer}
              />
            ))}

            <div className="flex flex-col gap-3 border-t border-[#e5e8ef] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                disabled={activeGroup === 0 || submitMutation.isPending}
                onClick={() => setActiveGroup((step) => Math.max(0, step - 1))}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {activeGroup === groups.length - 1 ? (
                <Button
                  type="button"
                  className="rounded-lg bg-[var(--ai)]"
                  disabled={!canContinue() || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit onboarding
                </Button>
              ) : (
                <Button
                  type="button"
                  className="rounded-lg bg-[var(--ai)]"
                  disabled={!canContinue()}
                  onClick={() => setActiveGroup((step) => Math.min(groups.length - 1, step + 1))}
                >
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
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[var(--ai)]" />
                <div className="font-bold text-[#07102c]">Setup progress</div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-[#e5e8ef]">
                <div
                  className="h-2 rounded-full bg-[var(--ai)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 text-sm font-medium text-[#4d5874]">{progress}% complete</div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Onboarding sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groups.map((group, index) => (
                <button
                  key={group.id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm ${index === activeGroup ? "border-[var(--ai)] bg-[#f6f1ff]" : "border-border bg-white"}`}
                  onClick={() => setActiveGroup(index)}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${index < activeGroup ? "bg-emerald-600 text-white" : "bg-muted text-foreground"}`}
                  >
                    {index < activeGroup ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  {group.title}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | string[] | undefined;
  onChange: (field: Field, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <textarea
          id={field.id}
          className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ai)]/20"
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field, event.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          id={field.id}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ai)]/20"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field, event.target.value)}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "multi" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {field.options?.map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-[var(--ai)] bg-[#f6f1ff] text-[#07102c]" : "border-border bg-white text-[#34415f]"}`}
                onClick={() => onChange(field, option)}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <Input
          id={field.id}
          className="rounded-lg"
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field, event.target.value)}
        />
      )}
    </div>
  );
}

function PaymentRequired({ subscription }: { subscription: SubscriptionRow }) {
  return (
    <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <CreditCard className="mt-1 h-6 w-6 text-amber-700" />
          <div>
            <h1 className="text-xl font-bold text-[#07102c]">Payment confirmation required</h1>
            <p className="mt-1 text-sm text-[#4d5874]">
              {subscription.name} is still marked as {subscription.status}. Complete payment before
              onboarding starts.
            </p>
          </div>
        </div>
        <Button asChild className="rounded-lg bg-amber-600 hover:bg-amber-700">
          <Link to="/dashboard/billing">Open billing</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CheckoutSelectionPanel({
  plan,
  bundle,
  selectedPlanId,
  selectedBundleId,
  isLoading,
  couponCode,
  onCouponChange,
  onCheckout,
  isPending,
}: {
  plan: PricingPlan | null;
  bundle: PricingBundle | null;
  selectedPlanId?: string;
  selectedBundleId?: string;
  isLoading: boolean;
  couponCode: string;
  onCouponChange: (value: string) => void;
  onCheckout: () => void;
  isPending: boolean;
}) {
  const selectedName = plan?.service?.name
    ? `${plan.service.name} - ${plan.name}`
    : plan?.name ?? bundle?.name ?? selectedPlanId ?? selectedBundleId ?? "Selected package";
  const rawPrice = plan?.priceZar ?? bundle?.priceZar ?? null;
  const price = rawPrice ? `R ${(parseInt(rawPrice, 10) / 100).toFixed(2)} / month` : "Price loading";

  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-center gap-3">
            <WandSparkles className="h-8 w-8 text-[var(--ai)]" />
            <div>
              <h1 className="text-xl font-bold text-[#07102c]">Start checkout</h1>
              <p className="text-sm text-[#4d5874]">Confirm the selected service, apply a coupon if needed, then activate onboarding.</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#dfe4ef] bg-[#f6f8fc] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Selected service</div>
            <div className="mt-2 text-lg font-bold text-[#07102c]">{isLoading ? "Loading selected service..." : selectedName}</div>
            <div className="mt-1 text-sm text-muted-foreground">{isLoading ? "Checking latest pricing" : price}</div>
          </div>
        </div>

        <form
          className="space-y-4 rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onCheckout();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="wizardCouponCode">Coupon code</Label>
            <Input
              id="wizardCouponCode"
              value={couponCode}
              onChange={(event) => onCouponChange(event.target.value)}
              placeholder="Optional"
              className="rounded-lg"
            />
          </div>
          <Button type="submit" className="w-full rounded-lg bg-[var(--ai)]" disabled={isPending || isLoading}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {couponCode.trim().toLowerCase() === "amrishtest" ? "Activate with coupon" : "Continue to checkout"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            100% discount coupons activate the subscription immediately. Paid subscriptions continue through Paystack.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-[var(--ai)]" />
        <h1 className="mt-4 text-xl font-bold text-[#07102c]">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-[#4d5874]">{description}</p>
        <Button asChild className="mt-5 rounded-lg bg-[var(--ai)]">
          <Link to="/pricing">Choose a product</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const commonGroups: FieldGroup[] = [
  {
    id: "business",
    title: "Business details",
    description: "Core details we need before preparing your setup.",
    fields: [
      { id: "companyName", label: "Company or organization name", type: "text", required: true },
      { id: "primaryContact", label: "Primary contact name", type: "text", required: true },
      { id: "phone", label: "Phone or WhatsApp number", type: "text", required: true },
      {
        id: "teamSize",
        label: "Team size",
        type: "select",
        required: true,
        options: ["1-5", "6-20", "21-50", "51-250", "250+"],
      },
    ],
  },
];

const fieldGroupsByKey: Record<string, FieldGroup[]> = {
  domains: [
    {
      id: "domains",
      title: "Domain setup",
      description: "Domain registration, transfer, and DNS requirements.",
      fields: [
        {
          id: "domainName",
          label: "Domain name",
          type: "text",
          required: true,
          placeholder: "example.co.za",
        },
        {
          id: "domainAction",
          label: "Domain action",
          type: "select",
          required: true,
          options: ["Register new domain", "Transfer existing domain", "DNS management only"],
        },
        { id: "dnsProvider", label: "Current DNS or hosting provider", type: "text" },
        { id: "dnsNeeds", label: "DNS records or email services to preserve", type: "textarea" },
      ],
    },
  ],
  websites: [
    {
      id: "websites",
      title: "Website brief",
      description: "Content, design, and launch details for your site.",
      fields: [
        { id: "websiteDomain", label: "Website domain", type: "text", required: true },
        {
          id: "websiteGoal",
          label: "Main website goal",
          type: "select",
          required: true,
          options: ["Leads", "Bookings", "Online sales", "Portfolio", "Customer portal"],
        },
        {
          id: "pagesRequired",
          label: "Pages required",
          type: "multi",
          options: ["Home", "About", "Services", "Contact", "Blog", "Landing pages"],
        },
        { id: "brandAssets", label: "Brand assets and copy readiness", type: "textarea" },
      ],
    },
  ],
  ecommerce: [
    {
      id: "ecommerce",
      title: "Ecommerce setup",
      description: "Store, payments, product, and fulfilment information.",
      fields: [
        {
          id: "productCount",
          label: "Approximate number of products",
          type: "select",
          required: true,
          options: ["1-20", "21-100", "101-500", "500+"],
        },
        {
          id: "paymentMethods",
          label: "Payment methods",
          type: "multi",
          options: ["Paystack", "EFT", "Card", "SnapScan", "Other"],
        },
        {
          id: "shippingRules",
          label: "Shipping, collection, or delivery rules",
          type: "textarea",
          required: true,
        },
        { id: "inventorySource", label: "Inventory source or existing platform", type: "text" },
      ],
    },
  ],
  hosting: [
    {
      id: "hosting",
      title: "Cloud hosting",
      description: "Infrastructure preferences and access requirements.",
      fields: [
        {
          id: "serverPurpose",
          label: "What will this server host?",
          type: "textarea",
          required: true,
        },
        {
          id: "region",
          label: "Preferred region",
          type: "select",
          options: ["South Africa", "Europe", "United Kingdom", "United States", "Best available"],
        },
        {
          id: "operatingSystem",
          label: "Operating system",
          type: "select",
          options: ["Ubuntu", "Debian", "AlmaLinux", "Windows Server", "Recommend for me"],
        },
        { id: "accessUsers", label: "Admin users or SSH keys", type: "textarea" },
        { id: "backupNeeds", label: "Backup and monitoring requirements", type: "textarea" },
      ],
    },
  ],
  productivity: [
    {
      id: "productivity",
      title: "Email and productivity",
      description: "Mailbox, domain, and migration information.",
      fields: [
        { id: "emailDomain", label: "Email domain", type: "text", required: true },
        { id: "mailboxCount", label: "Number of users/mailboxes", type: "text", required: true },
        { id: "currentProvider", label: "Current email provider", type: "text" },
        {
          id: "migrationNeeds",
          label: "Migration, aliases, shared mailboxes, or security needs",
          type: "textarea",
        },
      ],
    },
  ],
  voice: [
    {
      id: "voice",
      title: "Voice and PBX",
      description: "Phone system, extensions, routing, and AI voice requirements.",
      fields: [
        { id: "extensionCount", label: "Number of extensions", type: "text", required: true },
        { id: "numberPorting", label: "Existing numbers to port", type: "textarea" },
        {
          id: "callRouting",
          label: "Call routing, IVR, queues, and recording needs",
          type: "textarea",
          required: true,
        },
        {
          id: "voiceAi",
          label: "AI voice add-ons",
          type: "multi",
          options: ["Call analytics", "Sentiment analysis", "AI summaries", "Agent coaching"],
        },
      ],
    },
  ],
  ai: [
    {
      id: "ai",
      title: "AI workflow",
      description: "Agent goals, data sources, and approval boundaries.",
      fields: [
        {
          id: "agentGoal",
          label: "What should the AI help with?",
          type: "textarea",
          required: true,
        },
        {
          id: "dataSources",
          label: "Data sources or knowledge bases",
          type: "textarea",
          required: true,
        },
        {
          id: "integrations",
          label: "Systems to connect",
          type: "multi",
          options: ["Email", "Calendar", "CRM", "Website chat", "Documents", "Accounting"],
        },
        { id: "approvalRules", label: "Actions that require human approval", type: "textarea" },
      ],
    },
  ],
  security: [
    {
      id: "security",
      title: "Security and managed IT",
      description: "Coverage, risk priorities, and support requirements.",
      fields: [
        { id: "deviceCount", label: "Devices or users to cover", type: "text", required: true },
        { id: "currentTools", label: "Current antivirus, firewall, or IT tools", type: "textarea" },
        {
          id: "priorityRisks",
          label: "Priority risks",
          type: "multi",
          options: [
            "Endpoint security",
            "Backups",
            "Vulnerability scanning",
            "SOC monitoring",
            "Compliance",
            "Helpdesk",
          ],
        },
        {
          id: "supportHours",
          label: "Support hours required",
          type: "select",
          options: ["Business hours", "Extended hours", "24/7", "Not sure"],
        },
      ],
    },
  ],
};

function buildFieldGroups(subscription: SubscriptionRow | null): FieldGroup[] {
  if (!subscription) return commonGroups;
  const keys = getProductKeys(subscription);
  const productGroups = keys.flatMap((key) => fieldGroupsByKey[key] ?? []);
  const reviewGroup: FieldGroup = {
    id: "review",
    title: "Final notes",
    description:
      "Anything else your setup workflow should know before n8n starts the internal process.",
    fields: [
      {
        id: "launchTimeline",
        label: "Preferred launch timeline",
        type: "select",
        required: true,
        options: ["ASAP", "This week", "This month", "Flexible"],
      },
      {
        id: "constraints",
        label: "Constraints, blockers, or special instructions",
        type: "textarea",
      },
    ],
  };
  return [
    ...commonGroups,
    ...(productGroups.length ? productGroups : fieldGroupsByKey.ai),
    reviewGroup,
  ];
}

function getProductKeys(subscription: SubscriptionRow) {
  const keys = new Set<string>();
  const serviceId = subscription.plan?.service?.id;
  if (serviceId) {
    if (serviceId === "domains") keys.add("domains");
    if (serviceId === "websites") keys.add("websites");
    if (serviceId === "ecommerce") keys.add("ecommerce");
    if (serviceId === "hosting" || serviceId === "managed-infra" || serviceId === "openclaw")
      keys.add("hosting");
    if (serviceId === "m365" || serviceId === "gws") keys.add("productivity");
    if (serviceId === "pbx" || serviceId === "voice-intel") keys.add("voice");
    if (serviceId === "ai-assistant" || serviceId === "ai-agents") keys.add("ai");
    if (serviceId === "security" || serviceId === "managed-it") keys.add("security");
  }

  const bundleText = (subscription.bundle?.features ?? [])
    .map((feature) => feature.content.toLowerCase())
    .join(" ");
  if (bundleText.includes("domain")) keys.add("domains");
  if (bundleText.includes("website") || bundleText.includes("hosting")) keys.add("websites");
  if (
    bundleText.includes("hosted pbx") ||
    bundleText.includes("extension") ||
    bundleText.includes("call")
  )
    keys.add("voice");
  if (bundleText.includes("microsoft") || bundleText.includes("google")) keys.add("productivity");
  if (bundleText.includes("ai") || bundleText.includes("knowledge")) keys.add("ai");
  if (bundleText.includes("cloud")) keys.add("hosting");
  return Array.from(keys);
}
