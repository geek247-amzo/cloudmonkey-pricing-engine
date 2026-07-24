import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  Mail,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { formatDateTimeUTC } from "@/lib/date-format";
import {
  PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY,
  PROPOSAL_DEFAULT_INTRODUCTION,
  buildProposalTerms,
} from "@/lib/pricing";

export const Route = createFileRoute("/dashboard/proposals")({
  head: () => ({
    meta: [{ title: "Proposal Manager - CloudMonkey Admin" }],
  }),
  component: ProposalManagerPage,
});

function buildProposalFieldFallback(
  type: "introduction" | "executiveSummary" | "terms",
  serviceNames: string[],
) {
  if (type === "introduction") return PROPOSAL_DEFAULT_INTRODUCTION;
  if (type === "executiveSummary") return PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY;
  return buildProposalTerms(serviceNames);
}

type Lead = {
  id: string;
  name: string;
  email: string;
  company?: string | null;
};

type CatalogPlan = {
  id: string;
  name: string;
  tagline?: string | null;
  priceZar?: string | null;
  setupPriceZar?: string | null;
  billingType?: string | null;
  billingFrequency?: "month" | "year" | "once_off" | null;
  unit?: string | null;
  serviceNote?: string | null;
  serviceDefinition?: string | null;
  features?: Array<{ content: string }>;
  service?: { id: string; name: string; categoryId?: string | null };
};

type CatalogBundle = {
  id: string;
  name: string;
  priceZar?: string | null;
  setupPriceZar?: string | null;
  billingFrequency?: "month" | "year" | "once_off" | null;
  serviceNote?: string | null;
  categoryNote?: string | null;
  serviceDefinition?: string | null;
  features?: Array<{ content: string }>;
};

type PricingPayload = {
  categories: Array<{
    name: string;
    services: Array<{ name: string; plans: CatalogPlan[] }>;
  }>;
  bundles: CatalogBundle[];
};

type CatalogOption = {
  key: string;
  productType: "plan" | "bundle";
  id: string;
  name: string;
  description?: string | null;
  price: number;
  setupPrice: number;
  recurring: boolean;
  interval: "month" | "year";
  serviceDefinition?: string | null;
  features: string[];
};

type ProposalLine = CatalogOption & {
  quantity: number;
  unitPrice: number;
};

type Proposal = {
  id: string;
  proposalNumber?: string | null;
  title: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerCompany?: string | null;
  total: number;
  setupTotal: number;
  recurringTotal: number;
  publicUrl?: string | null;
  invoiceId?: string | null;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  viewedAt?: string | null;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}`);
  return response.json();
}

function cents(value?: string | null) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function billingFrequency(item: {
  billingFrequency?: string | null;
  billingType?: string | null;
  unit?: string | null;
}) {
  if (
    item.billingFrequency === "once_off" ||
    item.billingFrequency === "year" ||
    item.billingFrequency === "month"
  ) {
    return item.billingFrequency;
  }
  if (item.billingType === "once_off") return "once_off";
  const unit = String(item.unit ?? "").toLowerCase();
  if (unit.includes("year")) return "year";
  if (unit.includes("once")) return "once_off";
  return "month";
}

function frequencyInterval(frequency: string): "month" | "year" {
  return frequency === "year" || frequency === "once_off" ? "year" : "month";
}

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function parseDefinition(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function definitionList(definition: Record<string, unknown> | null, keys: string[]) {
  if (!definition) return [];
  for (const key of keys) {
    const value = definition[key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).map(
        ([label, detail]) => `${label}: ${String(detail)}`,
      );
    }
  }
  return [];
}

function packageRuleList(definition: Record<string, unknown> | null, keys: string[]) {
  if (!definition?.packageRules || typeof definition.packageRules !== "object") return [];
  return definitionList(definition.packageRules as Record<string, unknown>, keys);
}

function uniqueDefinitionItems(...groups: string[][]) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function ProposalManagerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [leadId, setLeadId] = useState("new");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [title, setTitle] = useState("CloudMonkey Managed Services Proposal");
  const [introduction, setIntroduction] = useState(PROPOSAL_DEFAULT_INTRODUCTION);
  const [executiveSummary, setExecutiveSummary] = useState(PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY);
  const [terms, setTerms] = useState(buildProposalTerms());
  const [selectedProductKey, setSelectedProductKey] = useState("");
  const [lines, setLines] = useState<ProposalLine[]>([]);
  const [generatingField, setGeneratingField] = useState<
    "" | "introduction" | "executiveSummary" | "terms"
  >("");
  const [aiContext, setAiContext] = useState("");

  const generateField = async (type: "introduction" | "executiveSummary" | "terms") => {
    let name = leadName;
    let email = leadEmail;
    let company = leadCompany;

    if (leadId !== "new" && selectedLead) {
      name = selectedLead.name;
      email = selectedLead.email;
      company = selectedLead.company ?? "";
    }

    if (!name) {
      toast.error("Please select a lead or fill in the lead name first.");
      return;
    }

    setGeneratingField(type);
    try {
      const res = await fetch("/api/admin/proposals/generate-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadName: name,
          leadCompany: company,
          services: lines.map((l) => l.name),
          type,
          customContext: aiContext,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        if (res.status === 404 || res.status >= 500) {
          const fallbackText = buildProposalFieldFallback(
            type,
            lines.map((line) => line.name),
          );
          if (type === "introduction") setIntroduction(fallbackText);
          if (type === "executiveSummary") setExecutiveSummary(fallbackText);
          if (type === "terms") setTerms(fallbackText);
          toast.success("AI service unavailable, applied proposal template fallback.");
          return;
        }
        throw new Error(body.error || "Failed to generate field");
      }

      if (type === "introduction") setIntroduction(body.text);
      if (type === "executiveSummary") setExecutiveSummary(body.text);
      if (type === "terms") setTerms(body.text);

      toast.success(
        `${
          type === "introduction"
            ? "Introduction"
            : type === "executiveSummary"
              ? "Executive summary"
              : "Terms and boundaries"
        } generated!`,
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to generate field");
    } finally {
      setGeneratingField("");
    }
  };

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const leadsQuery = useQuery({
    queryKey: ["admin", "leads"],
    queryFn: () => fetchJson<Lead[]>("/api/admin/leads"),
    enabled: isAdmin,
  });

  const pricingQuery = useQuery({
    queryKey: ["public", "pricing", "proposal-catalog"],
    queryFn: () => fetchJson<PricingPayload>("/api/public/pricing"),
    enabled: isAdmin,
  });

  const proposalsQuery = useQuery({
    queryKey: ["admin", "proposals"],
    queryFn: () => fetchJson<Proposal[]>("/api/admin/proposals"),
    enabled: isAdmin,
  });

  const catalog = useMemo<CatalogOption[]>(() => {
    const options: CatalogOption[] = [];
    for (const category of pricingQuery.data?.categories ?? []) {
      for (const service of category.services ?? []) {
        for (const plan of service.plans ?? []) {
          const frequency = billingFrequency(plan);
          options.push({
            key: `plan:${plan.id}`,
            productType: "plan",
            id: plan.id,
            name: `${service.name} - ${plan.name}`,
            description: plan.serviceNote ?? plan.tagline ?? null,
            price: cents(plan.priceZar),
            setupPrice: cents(plan.setupPriceZar),
            recurring: frequency !== "once_off",
            interval: frequencyInterval(frequency),
            serviceDefinition: plan.serviceDefinition,
            features: plan.features?.map((feature) => feature.content) ?? [],
          });
        }
      }
    }
    for (const bundle of pricingQuery.data?.bundles ?? []) {
      const frequency = billingFrequency(bundle);
      options.push({
        key: `bundle:${bundle.id}`,
        productType: "bundle",
        id: bundle.id,
        name: `Bundle - ${bundle.name}`,
        description: bundle.serviceNote ?? bundle.categoryNote ?? null,
        price: cents(bundle.priceZar),
        setupPrice: cents(bundle.setupPriceZar),
        recurring: frequency !== "once_off",
        interval: frequencyInterval(frequency),
        serviceDefinition: bundle.serviceDefinition,
        features: bundle.features?.map((feature) => feature.content) ?? [],
      });
    }
    return options;
  }, [pricingQuery.data]);

  const selectedLead = leadsQuery.data?.find((lead) => lead.id === leadId);
  const setupTotal = lines.reduce((sum, line) => sum + line.quantity * line.setupPrice, 0);
  const recurringTotal = lines.reduce(
    (sum, line) => sum + (line.recurring ? line.quantity * line.unitPrice : 0),
    0,
  );
  const onceOffTotal = lines.reduce(
    (sum, line) => sum + (!line.recurring ? line.quantity * line.unitPrice : 0),
    0,
  );
  const firstInvoiceTotal = setupTotal + recurringTotal + onceOffTotal;

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadId === "new" ? null : leadId,
          lead:
            leadId === "new"
              ? { name: leadName, email: leadEmail, company: leadCompany || null }
              : undefined,
          title,
          introduction,
          executiveSummary,
          terms,
          items: lines.map((line) => ({
            name: line.name,
            description: line.description ?? null,
            productType: line.productType,
            productId: line.id,
            planId: line.productType === "plan" ? line.id : null,
            bundleId: line.productType === "bundle" ? line.id : null,
            quantity: line.quantity,
            unitPrice: line.unitPrice / 100,
            setupPrice: line.setupPrice / 100,
            recurring: line.recurring,
            interval: line.interval,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create proposal");
      return payload as Proposal;
    },
    onSuccess: (proposal) => {
      toast.success("Proposal created");
      queryClient.invalidateQueries({ queryKey: ["admin", "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
      if (proposal.publicUrl) window.open(proposal.publicUrl, "_blank", "noopener,noreferrer");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "send" | "convert" | "void" }) => {
      const response = await fetch(`/api/admin/proposals/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `Failed to ${action} proposal`);
      return payload;
    },
    onSuccess: (_payload, variables) => {
      toast.success(
        variables.action === "send"
          ? "Proposal sent"
          : variables.action === "convert"
            ? "Invoice generated"
            : "Proposal voided",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "proposals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function addSelectedProduct() {
    const option = catalog.find((item) => item.key === selectedProductKey);
    if (!option) return;
    setLines((current) => [
      ...current,
      {
        ...option,
        quantity: 1,
        unitPrice: option.price,
      },
    ]);
  }

  if (!authReady || !isAdmin) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">Checking permissions...</div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={<>Proposal Manager.</>}
        subtitle="Create detailed sales proposals from the managed service catalog, send them to leads, and convert approved proposals into customer invoices."
        actions={
          <Button
            className="rounded-xl bg-[#076766] text-white hover:bg-[#075756]"
            disabled={
              !lines.length ||
              createMutation.isPending ||
              (leadId === "new" && (!leadName || !leadEmail))
            }
            onClick={() => createMutation.mutate()}
          >
            <FileText className="h-4 w-4" />
            {createMutation.isPending ? "Creating..." : "Create proposal"}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Lead And Proposal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Lead</Label>
                  <select
                    value={leadId}
                    onChange={(event) => setLeadId(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="new">Create new lead</option>
                    {leadsQuery.data?.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name} - {lead.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Proposal Title</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
              </div>

              {leadId === "new" ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Lead Name</Label>
                    <Input value={leadName} onChange={(event) => setLeadName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Email</Label>
                    <Input
                      type="email"
                      value={leadEmail}
                      onChange={(event) => setLeadEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={leadCompany}
                      onChange={(event) => setLeadCompany(event.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Proposal will be prepared for{" "}
                  <strong className="text-foreground">{selectedLead?.name}</strong> at{" "}
                  <strong className="text-foreground">{selectedLead?.email}</strong>.
                </div>
              )}

              <div className="grid gap-4">
                <div className="rounded-xl border border-dashed border-[var(--ai)]/50 bg-[var(--ai-soft)]/15 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ai)]">
                    <Sparkles className="h-4 w-4" /> AI Copilot Context (Optional)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Provide custom context, client requirements, or focus areas (e.g. 10 mailboxes
                    migration, 24/7 SLA window). The generation buttons below will use this context.
                  </p>
                  <Textarea
                    placeholder="e.g. Focus on database migration from on-prem, 99.9% uptime SLA, or outline hard limits for the marketing voice agent."
                    value={aiContext}
                    onChange={(event) => setAiContext(event.target.value)}
                    className="bg-white border-border/70 text-sm focus-visible:ring-[var(--ai)]"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Introduction</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[var(--ai)] h-7 px-2.5 hover:bg-[var(--ai-soft)] rounded-lg gap-1.5 flex items-center font-medium"
                      onClick={() => generateField("introduction")}
                      disabled={generatingField === "introduction"}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {generatingField === "introduction" ? "Generating..." : "Generate with AI"}
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    value={introduction}
                    onChange={(event) => setIntroduction(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Executive Summary</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[var(--ai)] h-7 px-2.5 hover:bg-[var(--ai-soft)] rounded-lg gap-1.5 flex items-center font-medium"
                      onClick={() => generateField("executiveSummary")}
                      disabled={generatingField === "executiveSummary"}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {generatingField === "executiveSummary"
                        ? "Generating..."
                        : "Generate with AI"}
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    value={executiveSummary}
                    onChange={(event) => setExecutiveSummary(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Terms And Boundaries</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[var(--ai)] h-7 px-2.5 hover:bg-[var(--ai-soft)] rounded-lg gap-1.5 flex items-center font-medium"
                      onClick={() => generateField("terms")}
                      disabled={generatingField === "terms"}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {generatingField === "terms" ? "Generating..." : "Generate with AI"}
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    value={terms}
                    onChange={(event) => setTerms(event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Service Selection</CardTitle>
              <Badge variant="outline">{catalog.length} catalog items</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row">
                <select
                  value={selectedProductKey}
                  onChange={(event) => setSelectedProductKey(event.target.value)}
                  className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a service or bundle</option>
                  {catalog.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.name} - {money(item.price)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={addSelectedProduct}
                  disabled={!selectedProductKey}
                >
                  <Plus className="h-4 w-4" />
                  Add service
                </Button>
              </div>

              {pricingQuery.isLoading ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
                  Loading catalog...
                </div>
              ) : lines.length ? (
                <div className="space-y-4">
                  {lines.map((line, index) => {
                    const definition = parseDefinition(line.serviceDefinition);
                    const limits = uniqueDefinitionItems(
                      definitionList(definition, [
                        "limits",
                        "hardLimits",
                        "serviceLimits",
                        "usageLimits",
                      ]),
                      packageRuleList(definition, ["usageLimits"]),
                    );
                    const scope = uniqueDefinitionItems(
                      definitionList(definition, [
                        "scope",
                        "scopeOfInclusion",
                        "included",
                        "includedScope",
                        "managementLayer",
                      ]),
                      packageRuleList(definition, ["coverage"]),
                      packageRuleList(definition, ["serviceAllocation"]),
                      packageRuleList(definition, ["infrastructureAllocation"]),
                      packageRuleList(definition, ["supportAllocation"]),
                      packageRuleList(definition, ["includedChanges"]),
                    );
                    const serviceLevels = uniqueDefinitionItems(
                      definitionList(definition, [
                        "support",
                        "sla",
                        "serviceLevel",
                        "serviceLevels",
                        "requestHandling",
                      ]),
                      packageRuleList(definition, ["responseTimes"]),
                    );
                    const exclusions = uniqueDefinitionItems(
                      definitionList(definition, [
                        "exclusions",
                        "excludedScope",
                        "outOfScope",
                        "notIncluded",
                      ]),
                      packageRuleList(definition, ["limitExceeded"]),
                      definitionList(definition, ["outOfScopeBilling"]),
                    );
                    const packageTerms = uniqueDefinitionItems(
                      definitionList(definition, ["standardTerms"]),
                      definitionList(definition, ["vatTreatment"]),
                    );
                    return (
                      <div
                        key={`${line.key}-${index}`}
                        className="rounded-2xl border border-border/70 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{line.productType}</Badge>
                              <h3 className="text-base font-bold">{line.name}</h3>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {line.description || "Managed CloudMonkey service."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() =>
                              setLines((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          <div className="space-y-1">
                            <Label>Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          quantity: Math.max(1, Number(event.target.value) || 1),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Recurring cents</Label>
                            <Input
                              type="number"
                              min={0}
                              value={line.unitPrice}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          unitPrice: Math.max(0, Number(event.target.value) || 0),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Setup cents</Label>
                            <Input
                              type="number"
                              min={0}
                              value={line.setupPrice}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          setupPrice: Math.max(0, Number(event.target.value) || 0),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Billing</Label>
                            <select
                              value={line.recurring ? "recurring" : "once_off"}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, recurring: event.target.value === "recurring" }
                                      : item,
                                  ),
                                )
                              }
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="recurring">Recurring</option>
                              <option value="once_off">Once-off</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <ScopeBox
                            title="Included Scope"
                            items={scope.length ? scope : line.features}
                          />
                          <ScopeBox
                            title="Service Levels"
                            items={serviceLevels}
                            fallback="WhatsApp and email tickets are actioned against the subscribed service and SLA."
                          />
                          <ScopeBox
                            title="Hard Limits"
                            items={limits}
                            fallback="Limits defined by selected plan and onboarding scope."
                          />
                          <ScopeBox
                            title="Out Of Scope"
                            items={exclusions}
                            fallback="Quoted separately before work starts."
                          />
                          <ScopeBox
                            title="Package Terms"
                            items={packageTerms}
                            fallback="The selected SKU, SLA, and Terms of Service apply."
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Select services to build a proposal with predefined scope, limits, and pricing.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-[#072b35] text-white shadow-sm">
            <CardHeader>
              <CardTitle>Proposal Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TotalRow label="Once-off setup" value={money(setupTotal)} />
              <TotalRow label="Recurring monthly" value={money(recurringTotal)} />
              <TotalRow label="Once-off products" value={money(onceOffTotal)} />
              <div className="border-t border-white/15 pt-4">
                <TotalRow label="First invoice total" value={money(firstInvoiceTotal)} large />
              </div>
              <p className="text-xs leading-6 text-white/65">
                The public proposal shows setup, recurring, service levels, hard limits,
                request-handling steps, and approval terms. Approval generates an invoice only once
                the lead exists as a registered customer.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Proposals</CardTitle>
              <Badge variant="outline">{proposalsQuery.data?.length ?? 0}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposalsQuery.isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Loading proposals...
                </div>
              ) : proposalsQuery.data?.length ? (
                proposalsQuery.data.map((proposal) => (
                  <div key={proposal.id} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={proposal.status === "converted" ? "default" : "secondary"}
                          >
                            {proposal.status}
                          </Badge>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {proposal.proposalNumber}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold">{proposal.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {proposal.customerName} - {proposal.customerEmail}
                        </p>
                        <div className="mt-1 flex gap-3 text-xs text-muted-foreground/75">
                          {proposal.sentAt && (
                            <span>Sent: {formatDateTimeUTC(proposal.sentAt)}</span>
                          )}
                          {proposal.deliveredAt && (
                            <span className="text-emerald-500">
                              Delivered: {formatDateTimeUTC(proposal.deliveredAt)}
                            </span>
                          )}
                          {proposal.viewedAt && (
                            <span className="text-purple-500 font-medium">
                              Viewed: {formatDateTimeUTC(proposal.viewedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm font-bold">{money(proposal.total)}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {proposal.publicUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(proposal.publicUrl ?? "", "_blank", "noopener,noreferrer")
                          }
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => actionMutation.mutate({ id: proposal.id, action: "send" })}
                      >
                        <Send className="h-4 w-4" />
                        Send
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          actionMutation.mutate({ id: proposal.id, action: "convert" })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Convert
                      </Button>
                      {proposal.publicUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(proposal.publicUrl ?? "");
                            toast.success("Proposal link copied");
                          }}
                        >
                          <Mail className="h-4 w-4" />
                          Copy link
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No proposals created yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScopeBox({
  title,
  items,
  fallback = "Defined by selected service.",
}: {
  title: string;
  items: string[];
  fallback?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        {(items.length ? items : [fallback]).slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TotalRow({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${large ? "text-xl font-black" : "text-sm font-semibold"}`}
    >
      <span className="text-white/68">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
