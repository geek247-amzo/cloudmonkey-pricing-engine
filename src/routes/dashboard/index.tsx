import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Cloud,
  FileSignature,
  Globe,
  HardDrive,
  LifeBuoy,
  ReceiptText,
  Server,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ElementType, ReactNode } from "react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [{ title: "Dashboard - CloudMonkey" }],
  }),
  component: DashboardOverviewPage,
});

async function fetchJson<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function wizardPathForPlan(planId?: string | null) {
  if (planId?.startsWith("web-") || planId?.startsWith("ecom-")) return "/dashboard/website-wizard";
  if (planId?.startsWith("ci-") || planId === "agent-marketing")
    return "/dashboard/intelligence-wizard";
  return "/dashboard/ai-wizard";
}

type PricingPlan = {
  id: string;
  name: string;
  priceZar?: string | null;
  unit?: string | null;
  billingType?: string | null;
  billingFrequency?: string | null;
  trialDays?: number | null;
};

type PricingBundle = {
  id: string;
  name: string;
  priceZar?: string | null;
  unit?: string | null;
  billingType?: string | null;
  billingFrequency?: string | null;
};

type PricingResponse = {
  categories?: Array<{ services?: Array<{ plans?: PricingPlan[] }> }>;
  bundles?: PricingBundle[];
};

function billingFrequency(
  item?: {
    billingFrequency?: string | null;
    billingType?: string | null;
    unit?: string | null;
  } | null,
) {
  if (
    item?.billingFrequency === "once_off" ||
    item?.billingFrequency === "year" ||
    item?.billingFrequency === "month"
  ) {
    return item.billingFrequency;
  }
  if (item?.billingType === "once_off") return "once_off";
  const unit = String(item?.unit ?? "").toLowerCase();
  if (unit.includes("year")) return "year";
  if (unit.includes("once")) return "once_off";
  return "month";
}

function billingFrequencyLabel(item?: PricingPlan | PricingBundle | null) {
  const frequency = billingFrequency(item);
  if (frequency === "once_off") return "once off";
  if (frequency === "year") return "/ year";
  return "/ month";
}

function billingInterval(item?: PricingPlan | PricingBundle | null): "month" | "year" {
  return billingFrequency(item) === "month" ? "month" : "year";
}

type AgreementRequirement = {
  required: boolean;
  signed?: boolean;
  consentText?: string;
  template?: {
    id: string;
    title: string;
    version: string;
    documentType: string;
    body: string;
  };
  serviceDefinition?: {
    vatTreatment?: string;
    includedScope?: string[];
    excludedScope?: string[];
    hardLimits?: string[];
    standardTerms?: string[];
    packageRules?: Record<string, string[]>;
  } | null;
};

type MetricSummary = {
  totalSpend?: number;
  activeAgents?: number;
  websites?: number;
  domains?: number;
  cloudResources?: number;
  openTickets?: number;
};

type DomainItem = {
  id: string;
  status: string;
  expiryDate?: string | null;
};

type ServerItem = {
  id: string;
  label?: string | null;
  mainIp?: string | null;
  region?: string | null;
  status: string;
};

type WebsiteItem = {
  id: string;
  domain: string;
  plan: string;
  status: string;
};

type AgentItem = {
  id: string;
  name: string;
  purpose: string;
  status: string;
};

type TicketItem = {
  id: string;
  subject: string;
  updatedAt: string;
  status: string;
};

type AuditLogItem = {
  id: string;
  message: string;
  createdAt: string;
};

type SubscriptionItem = {
  id: string;
  name: string;
  amount: number;
  interval: string;
  status: string;
};

type SimpleRow = {
  id: string;
  title: string;
  detail: string;
  status: string;
  icon: ElementType<{ className?: string }>;
};

function DashboardOverviewPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [onboardingStateLoaded, setOnboardingStateLoaded] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const dashboardReady = isMounted && !isPending && !!session;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    setSelectedBundleId(localStorage.getItem("cloudmonkey:selected-bundle"));
    setSelectedPlanId(localStorage.getItem("cloudmonkey:selected-plan"));
    setOnboardingStateLoaded(true);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/auth/sign-in" });
  }, [session, isPending, navigate]);

  const { data: pricing } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: () => fetchJson<PricingResponse>("/api/public/pricing"),
    enabled: dashboardReady && !isAdmin,
  });

  const { data: metrics } = useQuery({
    queryKey: ["user", "metrics"],
    queryFn: () => fetchJson<MetricSummary>("/api/user/metrics"),
    enabled: dashboardReady && !isAdmin,
  });

  const [domains, servers, websites, agents, tickets, logs, subscriptions] = useQueries({
    queries: [
      {
        queryKey: ["user", "domains"],
        queryFn: () => fetchJson<DomainItem[]>("/api/user/domains"),
        enabled: dashboardReady && !isAdmin,
      },
      {
        queryKey: ["user", "vultr"],
        queryFn: () => fetchJson<ServerItem[]>("/api/user/vultr"),
        enabled: dashboardReady && !isAdmin,
      },
      {
        queryKey: ["user", "websites"],
        queryFn: () => fetchJson<WebsiteItem[]>("/api/user/websites"),
        enabled: dashboardReady && !isAdmin,
      },
      {
        queryKey: [isAdmin ? "admin" : "user", "agents"],
        queryFn: () => fetchJson<AgentItem[]>(isAdmin ? "/api/admin/agents" : "/api/user/agents"),
        enabled: dashboardReady,
      },
      {
        queryKey: [isAdmin ? "admin" : "user", "tickets"],
        queryFn: () =>
          fetchJson<TicketItem[]>(isAdmin ? "/api/admin/tickets" : "/api/user/tickets"),
        enabled: dashboardReady,
      },
      {
        queryKey: ["admin", "audit-logs"],
        queryFn: () => fetchJson<AuditLogItem[]>("/api/admin/audit-logs"),
        enabled: isAdmin,
      },
      {
        queryKey: ["user", "subscription"],
        queryFn: () => fetchJson<SubscriptionItem[]>("/api/user/subscription"),
        enabled: dashboardReady && !isAdmin,
      },
    ],
  });

  const domainItems = (domains.data ?? []) as DomainItem[];
  const serverItems = (servers.data ?? []) as ServerItem[];
  const websiteItems = (websites.data ?? []) as WebsiteItem[];
  const agentItems = (agents.data ?? []) as AgentItem[];
  const ticketItems = (tickets.data ?? []) as TicketItem[];
  const auditLogItems = (logs.data ?? []) as AuditLogItem[];
  const subscriptionItems = (subscriptions.data ?? []) as SubscriptionItem[];

  const hasAccessSubscription =
    subscriptionItems.some((item) => item.status === "active" || item.status === "trialing") ??
    false;
  const hasPendingSubscription =
    subscriptionItems.some((item) => item.status === "pending") ?? false;
  const selectedPlan =
    pricing?.categories
      ?.flatMap((category) => category.services ?? [])
      ?.flatMap((item) => item.plans ?? [])
      ?.find((item) => item.id === selectedPlanId) ?? null;
  const selectedBundle = pricing?.bundles?.find((item) => item.id === selectedBundleId) ?? null;
  const selectedProductLabel =
    selectedPlan?.name ?? selectedBundle?.name ?? "your selected package";
  const selectedProduct = selectedPlan ?? selectedBundle ?? null;
  const selectedProductPrice = selectedPlan?.trialDays
    ? `${selectedPlan.trialDays}-day free trial`
    : selectedPlan?.priceZar
      ? `R ${(parseInt(selectedPlan.priceZar, 10) / 100).toFixed(2)} ${billingFrequencyLabel(selectedPlan)}`
      : selectedBundle?.priceZar
        ? `R ${(parseInt(selectedBundle.priceZar, 10) / 100).toFixed(2)} ${billingFrequencyLabel(selectedBundle)}`
        : null;
  const agreementRequirementPath = selectedPlanId
    ? `/api/user/agreement-requirement?planId=${encodeURIComponent(selectedPlanId)}`
    : selectedBundleId
      ? `/api/user/agreement-requirement?bundleId=${encodeURIComponent(selectedBundleId)}`
      : null;
  const { data: agreementRequirement, isLoading: isAgreementLoading } = useQuery({
    queryKey: ["user", "agreement-requirement", selectedPlanId, selectedBundleId],
    queryFn: () => fetchJson<AgreementRequirement>(agreementRequirementPath!),
    enabled:
      dashboardReady &&
      !isAdmin &&
      onboardingStateLoaded &&
      !!agreementRequirementPath &&
      !hasPendingSubscription,
  });
  // Temporarily hidden from customer surfaces. Restore once onboarding is gated by an
  // order-level completion check, so only customers with an incomplete wizard see it.
  const shouldShowOnboarding = false;

  async function startCheckout() {
    if (isStartingCheckout || hasPendingSubscription) return;
    if (agreementRequirement?.required && !agreementRequirement.signed && !agreementAccepted)
      return;
    const selectedCoupon = localStorage.getItem("cloudmonkey:coupon-code") || "";
    setIsStartingCheckout(true);
    try {
      const res = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId || null,
          bundleId: selectedPlanId ? null : selectedBundleId,
          interval: billingInterval(selectedProduct),
          couponCode: selectedCoupon || null,
          agreementAccepted: agreementRequirement?.required ? agreementAccepted : undefined,
          agreementConsentText: agreementRequirement?.consentText ?? null,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Failed to start checkout" }));
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      if (
        data.subscription?.status === "trialing" ||
        data.trialing ||
        data.alreadyPaid ||
        data.discounted ||
        data.alreadyActive
      ) {
        localStorage.removeItem("cloudmonkey:selected-plan");
        localStorage.removeItem("cloudmonkey:selected-bundle");
        localStorage.removeItem("cloudmonkey:coupon-code");
        navigate({
          to: wizardPathForPlan(selectedPlanId),
          search: { subscription: data.subscription?.id, plan: selectedPlanId || undefined },
        });
        return;
      }
      if (data.authorization_url) {
        window.location.assign(data.authorization_url);
        return;
      }
    } catch {
      navigate({ to: "/dashboard/billing" });
    } finally {
      setIsStartingCheckout(false);
    }
  }

  if (!dashboardReady) {
    return <DashboardSkeleton />;
  }

  const cards = [
    {
      label: "Total spend",
      value: `R ${((metrics?.totalSpend ?? 0) / 100).toFixed(2)}`,
      icon: Wallet,
      to: "/dashboard/billing",
    },
    {
      label: "Active agents",
      value: metrics?.activeAgents ?? 0,
      icon: Bot,
      to: "/dashboard/agents",
    },
    {
      label: "Websites",
      value: metrics?.websites ?? 0,
      icon: HardDrive,
      to: "/dashboard/websites",
    },
    { label: "Domains", value: metrics?.domains ?? 0, icon: Globe, to: "/dashboard/domains" },
    {
      label: "Cloud resources",
      value: metrics?.cloudResources ?? 0,
      icon: Cloud,
      to: "/dashboard/hosting",
    },
    {
      label: "Open tickets",
      value: metrics?.openTickets ?? 0,
      icon: LifeBuoy,
      to: "/dashboard/support",
    },
  ];

  const adminCards = [
    {
      label: "Customer services",
      description: "View customers, subscriptions, and assigned services.",
      icon: HardDrive,
      to: "/dashboard/customers",
    },
    {
      label: "Website projects",
      description: "Manage onboarding, design approvals, staging, and launches.",
      icon: HardDrive,
      to: "/dashboard/website-projects",
    },
    {
      label: "Platform matrix",
      description: "Assign domains, servers, and CloudMonkey infrastructure.",
      icon: Cloud,
      to: "/dashboard/administration",
    },
    {
      label: "Users",
      description: "Manage user accounts and access.",
      icon: Bot,
      to: "/dashboard/users",
    },
    {
      label: "Roles",
      description: "Review admin and customer role assignments.",
      icon: CheckCircle2,
      to: "/dashboard/roles",
    },
    {
      label: "Products & pricing",
      description: "Maintain service plans, bundles, and package pricing.",
      icon: ReceiptText,
      to: "/dashboard/products",
    },
    {
      label: "CRM",
      description: "Track customer relationships and follow-ups.",
      icon: LifeBuoy,
      to: "/dashboard/crm",
    },
    {
      label: "Support",
      description: "Handle customer tickets and operational requests.",
      icon: LifeBuoy,
      to: "/dashboard/support",
    },
    {
      label: "Activity logs",
      description: "Audit operational changes across the platform.",
      icon: CheckCircle2,
      to: "/dashboard/activity-logs",
    },
    {
      label: "Settings",
      description: "Configure platform defaults and notifications.",
      icon: Cloud,
      to: "/dashboard/settings",
    },
  ];

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {shouldShowOnboarding && (
        <OnboardingBanner
          bundleLabel={selectedProductLabel}
          bundlePrice={selectedProductPrice}
          hasPendingSubscription={hasPendingSubscription}
          agreementRequirement={agreementRequirement}
          agreementAccepted={agreementAccepted}
          agreementLoading={isAgreementLoading}
          isStartingCheckout={isStartingCheckout}
          onAgreementAcceptedChange={setAgreementAccepted}
          onStartCheckout={startCheckout}
          onDismiss={dismissOnboarding}
        />
      )}
      <PageHeader
        eyebrow={isAdmin ? "Admin overview" : "Overview"}
        title={<>Overview</>}
        subtitle={`Welcome back, ${session.user.name.split(" ")[0]}.`}
      />

      {isAdmin ? (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
            {adminCards.map((card) => (
              <Link key={card.label} to={card.to} className="min-w-0">
                <Card className="h-full rounded-lg border-[#dfe4ef] bg-white shadow-sm transition-colors hover:bg-muted/20">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ai)]/10 text-[var(--ai)]">
                        <card.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground">{card.label}</div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-3">
            <DataPanel title="Support queue" to="/dashboard/support" action="Open support">
              <SimpleRows
                rows={ticketItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.subject,
                  detail: new Date(item.updatedAt).toLocaleString(),
                  status: item.status,
                  icon: LifeBuoy,
                }))}
                empty="No support tickets."
              />
            </DataPanel>

            <DataPanel title="Managed agents" to="/dashboard/agents" action="Open agents">
              <SimpleRows
                rows={agentItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.name,
                  detail: item.purpose,
                  status: item.status,
                  icon: Bot,
                }))}
                empty="No agents configured."
              />
            </DataPanel>

            <DataPanel
              title="Recent audit activity"
              to="/dashboard/activity-logs"
              action="View all"
            >
              <SimpleRows
                rows={auditLogItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.message,
                  detail: new Date(item.createdAt).toLocaleString(),
                  status: "logged",
                  icon: CheckCircle2,
                }))}
                empty="No audit records available."
              />
            </DataPanel>
          </div>
        </>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="min-w-0">
                <Card className="h-full rounded-lg border-[#dfe4ef] bg-white shadow-sm transition-colors hover:bg-muted/20">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                          {card.label}
                        </div>
                        <div className="mt-2 truncate text-xl font-bold text-foreground sm:text-2xl">
                          {card.value}
                        </div>
                      </div>
                      <card.icon className="h-5 w-5 shrink-0 text-[var(--ai)]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-3">
            <DataPanel title="Domains" to="/dashboard/domains" action="Manage domains">
              <SimpleRows
                rows={domainItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.id,
                  detail: item.expiryDate
                    ? `Expires ${new Date(item.expiryDate).toLocaleDateString()}`
                    : "No expiry date",
                  status: item.status,
                  icon: Globe,
                }))}
                empty="No domains assigned."
              />
            </DataPanel>

            <DataPanel title="Servers" to="/dashboard/hosting" action="Manage servers">
              <SimpleRows
                rows={serverItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.label || item.id,
                  detail: item.mainIp || item.region,
                  status: item.status,
                  icon: Server,
                }))}
                empty="No servers assigned."
              />
            </DataPanel>

            <DataPanel title="Subscriptions" to="/dashboard/billing" action="Open billing">
              <SimpleRows
                rows={subscriptionItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.name,
                  detail: `R ${(item.amount / 100).toFixed(2)} / ${item.interval}`,
                  status: item.status,
                  icon: ReceiptText,
                }))}
                empty="No subscriptions assigned."
              />
            </DataPanel>
          </div>

          <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-3">
            <DataPanel title="Agents" to="/dashboard/agents" action="Manage agents">
              <SimpleRows
                rows={agentItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.name,
                  detail: item.purpose,
                  status: item.status,
                  icon: Bot,
                }))}
                empty="No agents configured."
              />
            </DataPanel>

            <DataPanel title="Websites" to="/dashboard/websites" action="Manage websites">
              <SimpleRows
                rows={websiteItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.domain,
                  detail: item.plan,
                  status: item.status,
                  icon: HardDrive,
                }))}
                empty="No websites recorded."
              />
            </DataPanel>

            <DataPanel title="Support" to="/dashboard/support" action="Open support">
              <SimpleRows
                rows={ticketItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.subject,
                  detail: new Date(item.updatedAt).toLocaleString(),
                  status: item.status,
                  icon: LifeBuoy,
                }))}
                empty="No support tickets."
              />
            </DataPanel>
          </div>

          {isAdmin && (
            <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
              <CardHeader className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <CardTitle>Recent audit activity</CardTitle>
                <Button asChild variant="outline" className="w-full rounded-lg sm:w-auto">
                  <Link to="/dashboard/activity-logs">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
                {!auditLogItems.length ? (
                  <div className="text-sm text-muted-foreground">No audit records available.</div>
                ) : (
                  auditLogItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="flex min-w-0 flex-col gap-1 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <span className="min-w-0 break-words font-medium text-foreground">
                        {item.message}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function OnboardingBanner({
  bundleLabel,
  bundlePrice,
  hasPendingSubscription,
  agreementRequirement,
  agreementAccepted,
  agreementLoading,
  isStartingCheckout,
  onAgreementAcceptedChange,
  onStartCheckout,
  onDismiss,
}: {
  bundleLabel: string;
  bundlePrice: string | null;
  hasPendingSubscription: boolean;
  agreementRequirement?: AgreementRequirement;
  agreementAccepted: boolean;
  agreementLoading: boolean;
  isStartingCheckout: boolean;
  onAgreementAcceptedChange: (value: boolean) => void;
  onStartCheckout: () => void;
  onDismiss: () => void;
}) {
  const title = hasPendingSubscription
    ? "Complete your Paystack checkout"
    : "Finish your subscription setup";
  const description = hasPendingSubscription
    ? `We already started checkout for ${bundleLabel}. Open billing to finish payment and activate your subscription.`
    : `Review the service scope and sign the required agreement before checkout starts for ${bundleLabel}.`;
  const requiresSignature = Boolean(agreementRequirement?.required && !agreementRequirement.signed);
  const startDisabled =
    isStartingCheckout || agreementLoading || (requiresSignature && !agreementAccepted);
  const serviceDefinition = agreementRequirement?.serviceDefinition;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="w-full max-w-2xl rounded-lg border border-[#dfe4ef] bg-white p-4 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.5)] sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ai)]/10 text-[var(--ai)] sm:h-12 sm:w-12">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Setup required
              </div>
              <h2
                className="mt-1 text-xl font-extrabold text-foreground sm:text-2xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss onboarding banner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-3 sm:p-4 md:grid-cols-2">
          <div className="min-w-0 rounded-lg border border-dashed border-[var(--ai)]/30 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Selected package
            </div>
            <div className="mt-2 break-words text-lg font-bold text-foreground">{bundleLabel}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {bundlePrice ?? "We will confirm the right package in the wizard."}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-dashed border-[var(--ai)]/30 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              What happens next
            </div>
            {hasPendingSubscription ? (
              <>
                <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Finish payment in billing
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Wait for Paystack confirmation
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Add the subscription to your profile
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Complete product onboarding
                </div>
              </>
            )}
          </div>
        </div>

        {!hasPendingSubscription && (
          <div className="mt-4 rounded-lg border border-[#dfe4ef] bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileSignature className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground">
                  {agreementLoading
                    ? "Loading service agreement"
                    : (agreementRequirement?.template?.title ?? "Service agreement")}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {agreementRequirement?.template
                    ? `Version ${agreementRequirement.template.version}. ${serviceDefinition?.vatTreatment ?? ""}`
                    : "No additional agreement is configured for this SKU."}
                </div>
              </div>
            </div>

            {serviceDefinition && (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ScopeList title="Included" items={serviceDefinition.includedScope} />
                  <ScopeList title="Limits" items={serviceDefinition.hardLimits} />
                  <ScopeList title="Excluded" items={serviceDefinition.excludedScope} />
                </div>
                {serviceDefinition.packageRules && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <ScopeList title="Coverage" items={serviceDefinition.packageRules.coverage} />
                    <ScopeList
                      title="Service allocation"
                      items={serviceDefinition.packageRules.serviceAllocation}
                    />
                    <ScopeList
                      title="Infrastructure"
                      items={serviceDefinition.packageRules.infrastructureAllocation}
                    />
                    <ScopeList
                      title="Support allocation"
                      items={serviceDefinition.packageRules.supportAllocation}
                    />
                    <ScopeList
                      title="Response times"
                      items={serviceDefinition.packageRules.responseTimes}
                    />
                    <ScopeList
                      title="Included changes"
                      items={serviceDefinition.packageRules.includedChanges}
                    />
                    <ScopeList
                      title="Usage limits"
                      items={serviceDefinition.packageRules.usageLimits}
                    />
                    <ScopeList
                      title="When limits are exceeded"
                      items={serviceDefinition.packageRules.limitExceeded}
                    />
                  </div>
                )}
                <div className="mt-3">
                  <ScopeList
                    title="Standard package terms"
                    items={serviceDefinition.standardTerms}
                  />
                </div>
              </>
            )}

            {requiresSignature && (
              <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#dfe4ef] bg-slate-50 p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(event) => onAgreementAcceptedChange(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>{agreementRequirement?.consentText}</span>
              </label>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {hasPendingSubscription ? (
            <Link
              to="/dashboard/billing"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ai)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]"
            >
              Open Billing
              <Sparkles className="h-4 w-4" />
            </Link>
          ) : (
            <Button
              type="button"
              onClick={onStartCheckout}
              disabled={startDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ai)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)] disabled:opacity-60"
            >
              {isStartingCheckout ? "Starting checkout" : "Review signed, start checkout"}
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopeList({ title, items = [] }: { title: string; items?: string[] }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={item} className="flex min-w-0 gap-2 text-xs leading-relaxed text-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="min-w-0 break-words">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <PageHeader eyebrow="Overview" title={<>Overview</>} subtitle="Loading your workspace..." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-4 h-8 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader className="flex-row items-center justify-between p-4 sm:p-6">
              <CardTitle className="h-5 w-28 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex} className="h-12 animate-pulse rounded-lg bg-muted/60" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DataPanel({
  title,
  action,
  to,
  children,
}: {
  title: string;
  action: string;
  to: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 sm:p-6">
        <CardTitle className="min-w-0 text-base">{title}</CardTitle>
        <Link to={to} className="shrink-0 text-xs font-semibold text-[var(--ai)] sm:text-sm">
          {action}
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">{children}</CardContent>
    </Card>
  );
}

function SimpleRows({ rows, empty }: { rows?: SimpleRow[]; empty: string }) {
  if (!rows?.length) return <div className="py-4 text-sm text-muted-foreground">{empty}</div>;
  return (
    <>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex min-w-0 items-start gap-3 rounded-lg border border-border p-3"
        >
          <row.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ai)]" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{row.title}</div>
            <div className="truncate text-xs text-muted-foreground">{row.detail}</div>
          </div>
          <Badge
            variant={
              row.status === "active" || row.status === "trialing" || row.status === "online"
                ? "default"
                : "outline"
            }
            className="max-w-24 shrink-0 truncate px-2 text-[10px] sm:max-w-32 sm:text-xs"
          >
            {row.status}
          </Badge>
        </div>
      ))}
    </>
  );
}
