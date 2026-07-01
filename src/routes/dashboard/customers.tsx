import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  Globe,
  HardDrive,
  LifeBuoy,
  RefreshCcw,
  Search,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/customers")({
  head: () => ({
    meta: [{ title: "Customer Services - CloudMonkey Dashboard" }],
  }),
  component: CustomerServicesPage,
});

type CustomerService = {
  id: string;
  type: string;
  label: string;
  status?: string | null;
  containerStatus?: string | null;
  powerStatus?: string | null;
  amount?: number;
  interval?: string;
  temporaryDomain?: string | null;
  primaryDomain?: string | null;
  mainIp?: string | null;
  databaseName?: string | null;
  trialEndsAt?: string | null;
  store?: {
    status: string;
    paymentMode: string;
    database?: {
      containerName: string;
      databaseName: string;
      status: string;
      backupStatus: string;
    } | null;
  } | null;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  summary: {
    totalServices: number;
    activeServices: number;
    warningServices: number;
    problemServices: number;
    openTickets: number;
    billingStatus: string;
    unpaidInvoiceCount: number;
    unpaidInvoiceAmount: number;
  };
  services: {
    items: CustomerService[];
    tickets: Array<{ id: string; subject: string; status: string; priority: string; createdAt: string }>;
    invoices: Array<{ id: string; invoiceNumber?: string | null; amount: number; status: string; dueDate: string }>;
  };
};

type CustomersPayload = {
  customers: CustomerRow[];
  summary: {
    totalCustomers: number;
    totalServices: number;
    activeServices: number;
    problemServices: number;
    openTickets: number;
    unpaidInvoiceAmount: number;
  };
};

const filterOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "problem", label: "Problems" },
  { value: "billing", label: "Billing" },
  { value: "tickets", label: "Open tickets" },
] as const;

function CustomerServicesPage() {
  const navigate = useNavigate();
  const { authReady, isAdmin } = useAdminAccess();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filterOptions)[number]["value"]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<CustomersPayload>({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/customers");
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to load customers");
      return body;
    },
    enabled: isAdmin,
  });

  const customers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data?.customers ?? []).filter((customer) => {
      const matchesSearch = !search || [
        customer.name,
        customer.email,
        customer.role,
        customer.summary.billingStatus,
        ...customer.services.items.flatMap((service) => [
          service.label,
          service.type,
          service.status,
          service.containerStatus,
          service.temporaryDomain,
          service.primaryDomain,
          service.mainIp,
          service.store?.database?.containerName,
          service.store?.database?.databaseName,
        ]),
      ].some((value) => String(value ?? "").toLowerCase().includes(search));
      if (!matchesSearch) return false;

      if (filter === "active") return customer.summary.activeServices > 0;
      if (filter === "trial") return customer.services.items.some((service) => ["trial", "live_trial"].includes(String(service.status)));
      if (filter === "problem") return customer.summary.problemServices > 0;
      if (filter === "billing") return ["pending", "overdue"].includes(customer.summary.billingStatus);
      if (filter === "tickets") return customer.summary.openTickets > 0;
      return true;
    });
  }, [data?.customers, filter, query]);

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const summary = data?.summary ?? {
    totalCustomers: 0,
    totalServices: 0,
    activeServices: 0,
    problemServices: 0,
    openTickets: 0,
    unpaidInvoiceAmount: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={<>Customer services.</>}
        subtitle="A single backend view of customers, assigned services, billing state, websites, domains, servers, AI agents and support status."
        actions={
          <Button variant="outline" className="rounded-lg" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Customers" value={summary.totalCustomers} icon={UserRound} />
        <Metric label="Services" value={summary.totalServices} icon={HardDrive} />
        <Metric label="Active" value={summary.activeServices} icon={ShieldCheck} />
        <Metric label="Problems" value={summary.problemServices} icon={AlertTriangle} tone="danger" />
        <Metric label="Tickets" value={summary.openTickets} icon={LifeBuoy} />
        <Metric label="Unpaid" value={money(summary.unpaidInvoiceAmount)} icon={CreditCard} />
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle>Customers and assigned services</CardTitle>
            <div className="relative w-full xl:w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Search customer, domain, server, service..."
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                className={`rounded-lg ${filter === option.value ? "bg-[var(--ai)]" : ""}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading customers...
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              {error instanceof Error ? error.message : "Failed to load customer services"}
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  expanded={expanded === customer.id}
                  onToggle={() => setExpanded((current) => current === customer.id ? null : customer.id)}
                />
              ))}
              {!customers.length && (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No customers match this view.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerCard({ customer, expanded, onToggle }: { customer: CustomerRow; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-border/70 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--ai-soft)] text-[var(--ai)]">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-foreground">{customer.name}</div>
            <Badge variant="outline" className="capitalize">{customer.role}</Badge>
            <StatusBadge status={customer.summary.billingStatus} />
          </div>
          <div className="truncate text-xs text-muted-foreground">{customer.email}</div>
        </div>
        <div className="hidden grid-cols-5 gap-3 text-center text-xs md:grid">
          <SmallStat label="Services" value={customer.summary.totalServices} />
          <SmallStat label="Active" value={customer.summary.activeServices} />
          <SmallStat label="Problems" value={customer.summary.problemServices} />
          <SmallStat label="Tickets" value={customer.summary.openTickets} />
          <SmallStat label="Unpaid" value={money(customer.summary.unpaidInvoiceAmount)} />
        </div>
        {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/70 p-4">
          <div className="grid gap-3 xl:grid-cols-2">
            {customer.services.items.map((service) => (
              <ServiceRow key={`${service.type}-${service.id}`} service={service} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <RelatedPanel title="Recent invoices" empty="No invoices." rows={customer.services.invoices.map((invoice) => ({
              id: invoice.id,
              label: invoice.invoiceNumber || invoice.id,
              meta: `${money(invoice.amount)} due ${formatDate(invoice.dueDate)}`,
              status: invoice.status,
            }))} />
            <RelatedPanel title="Recent tickets" empty="No tickets." rows={customer.services.tickets.map((ticket) => ({
              id: ticket.id,
              label: ticket.subject,
              meta: ticket.priority,
              status: ticket.status,
            }))} />
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceRow({ service }: { service: CustomerService }) {
  const Icon = iconForService(service.type);
  const detail = serviceDetail(service);
  return (
    <div className="rounded-lg border border-border/60 bg-[#f8faff] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[var(--ai)] shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-semibold text-foreground">{service.label}</div>
            <Badge variant="outline" className="capitalize">{service.type.replace("_", " ")}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
          {service.store?.database && (
            <div className="mt-2 rounded-md bg-white px-3 py-2 text-xs text-muted-foreground">
              DB: <span className="font-medium text-foreground">{service.store.database.databaseName}</span> · Container: {service.store.database.containerName} · Backup: {service.store.database.backupStatus}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={service.containerStatus || service.status || service.powerStatus} />
          {service.temporaryDomain && (
            <a href={`http://${service.temporaryDomain}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--ai)]">
              Open
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function RelatedPanel({ title, rows, empty }: { title: string; empty: string; rows: Array<{ id: string; label: string; meta: string; status: string }> }) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      <div className="space-y-2">
        {rows.length ? rows.slice(0, 5).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{row.label}</div>
              <div className="text-xs text-muted-foreground">{row.meta}</div>
            </div>
            <StatusBadge status={row.status} />
          </div>
        )) : <div className="text-sm text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof UserRound; tone?: "danger" }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-bold text-[#07102c]">{value}</div>
          </div>
          <Icon className={`h-5 w-5 ${tone === "danger" ? "text-red-600" : "text-[var(--ai)]"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return <div><div className="font-semibold text-foreground">{value}</div><div className="text-muted-foreground">{label}</div></div>;
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = status || "unknown";
  const danger = ["failed", "suspended", "terminated", "expired", "overdue", "cancelled", "rejected"].includes(value);
  const warning = ["pending", "pending_payment", "trial", "live_trial", "open", "past_due"].includes(value);
  return (
    <Badge variant={danger || warning ? "outline" : "default"} className={`capitalize ${danger ? "border-red-200 bg-red-50 text-red-700" : warning ? "border-amber-200 bg-amber-50 text-amber-800" : ""}`}>
      {value.replace("_", " ")}
    </Badge>
  );
}

function iconForService(type: string) {
  if (type === "domain" || type === "domain_order") return Globe;
  if (type === "server") return Server;
  if (type === "website" || type === "ecommerce") return HardDrive;
  if (type === "ai_agent") return Bot;
  if (type === "subscription") return CreditCard;
  if (type === "affiliate") return ShieldCheck;
  return Database;
}

function serviceDetail(service: CustomerService) {
  if (service.type === "subscription") return `${money(service.amount || 0)} / ${service.interval || "month"}`;
  if (service.type === "domain") return `Registered domain${service.status ? ` · ${service.status}` : ""}`;
  if (service.type === "domain_order") return `Domain order${service.status ? ` · ${service.status}` : ""}`;
  if (service.type === "server") return `${service.mainIp || "No IP"} · ${service.powerStatus || service.status || "unknown"}`;
  if (service.type === "website" || service.type === "ecommerce") return `${service.primaryDomain || service.temporaryDomain || "No domain"} · trial ends ${formatDate(service.trialEndsAt)}`;
  if (service.type === "ai_agent") return "AI agent runtime and automation";
  if (service.type === "affiliate") return "Affiliate/partner account";
  return service.status || "Assigned service";
}

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format((cents || 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "not set";
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
