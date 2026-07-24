import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  LifeBuoy,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { formatDateUTC } from "@/lib/date-format";

export const Route = createFileRoute("/dashboard/crm")({
  head: () => ({
    meta: [{ title: "CRM - CloudMonkey Dashboard" }],
  }),
  component: CrmPage,
});

type LeadRow = {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  services?: string | null;
  setupStyle?: string | null;
  createdAt: string;
};

type ProposalRow = {
  id: string;
  leadId?: string | null;
  customerUserId?: string | null;
  invoiceId?: string | null;
  proposalNumber?: string | null;
  title: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerCompany?: string | null;
  total: number;
  recurringTotal: number;
  publicUrl?: string | null;
  createdAt: string;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  summary: {
    totalServices: number;
    activeServices: number;
    problemServices: number;
    openTickets: number;
    billingStatus: string;
    unpaidInvoiceCount: number;
    unpaidInvoiceAmount: number;
  };
  services: {
    items: Array<{ id: string; type: string; label: string; status?: string | null }>;
    invoices: Array<{ id: string; invoiceNumber?: string | null; amount: number; status: string; dueDate: string }>;
    tickets: Array<{ id: string; subject: string; status: string; priority: string; createdAt: string }>;
    subscriptions?: Array<{ id: string; name: string; status: string; amount: number; interval: string }>;
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

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Failed to fetch ${path}`);
  return body;
}

function CrmPage() {
  const navigate = useNavigate();
  const { authReady, isAdmin } = useAdminAccess();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"customers" | "leads">("customers");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const [customersQuery, leadsQuery, proposalsQuery] = useQueries({
    queries: [
      {
        queryKey: ["admin", "crm", "customers"],
        queryFn: () => fetchJson<CustomersPayload>("/api/admin/customers"),
        enabled: isAdmin,
      },
      {
        queryKey: ["admin", "crm", "leads"],
        queryFn: () => fetchJson<LeadRow[]>("/api/admin/leads"),
        enabled: isAdmin,
      },
      {
        queryKey: ["admin", "crm", "proposals"],
        queryFn: () => fetchJson<ProposalRow[]>("/api/admin/proposals"),
        enabled: isAdmin,
      },
    ],
  });

  const customers = customersQuery.data?.customers ?? [];
  const leads = leadsQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const search = query.trim().toLowerCase();

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (!search) return true;
      return [
        customer.name,
        customer.email,
        customer.summary.billingStatus,
        ...customer.services.items.map((item) => `${item.type} ${item.label} ${item.status ?? ""}`),
        ...customer.services.invoices.map((invoice) => `${invoice.invoiceNumber ?? invoice.id} ${invoice.status}`),
        ...customer.services.tickets.map((ticket) => `${ticket.subject} ${ticket.status}`),
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [customers, search]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (!search) return true;
      return [lead.name, lead.email, lead.company, lead.services, lead.setupStyle]
        .some((value) => String(value ?? "").toLowerCase().includes(search));
    });
  }, [leads, search]);

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const summary = customersQuery.data?.summary ?? {
    totalCustomers: 0,
    totalServices: 0,
    activeServices: 0,
    problemServices: 0,
    openTickets: 0,
    unpaidInvoiceAmount: 0,
  };
  const openLeads = leads.filter((lead) => !customerForLead(lead, customers)).length;
  const openProposals = proposals.filter((proposal) => ["draft", "sent", "approved"].includes(proposal.status)).length;
  const loading = customersQuery.isLoading || leadsQuery.isLoading || proposalsQuery.isLoading;
  const fetching = customersQuery.isFetching || leadsQuery.isFetching || proposalsQuery.isFetching;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title={<>Relationships, leads, and customer context.</>}
        subtitle="CRM is for sales and support context: leads, registered customers, proposals, invoices, services, and tickets. Users remains for account access and roles."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-lg">
              <Link to="/dashboard/proposals">
                <FileText className="h-4 w-4" />
                Create proposal
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                customersQuery.refetch();
                leadsQuery.refetch();
                proposalsQuery.refetch();
              }}
              disabled={fetching}
            >
              <RefreshCcw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Customers" value={summary.totalCustomers} icon={UsersRound} />
        <Metric label="Open leads" value={openLeads} icon={Sparkles} />
        <Metric label="Services" value={summary.totalServices} icon={BriefcaseBusiness} />
        <Metric label="Open tickets" value={summary.openTickets} icon={LifeBuoy} />
        <Metric label="Open proposals" value={openProposals} icon={FileText} />
        <Metric label="Unpaid" value={money(summary.unpaidInvoiceAmount)} icon={CreditCard} />
      </div>

      <Card className="overflow-hidden rounded-xl border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="border-b border-border/60 bg-[#f8faff]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>CRM workspace</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Customers are registered accounts. Leads are sales contacts that have not necessarily registered yet.
              </p>
            </div>
            <div className="relative w-full xl:w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Search customer, lead, invoice, ticket, service..."
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={view === "customers" ? "default" : "outline"}
              size="sm"
              className={`rounded-lg ${view === "customers" ? "bg-[var(--ai)]" : ""}`}
              onClick={() => setView("customers")}
            >
              Customers
            </Button>
            <Button
              variant={view === "leads" ? "default" : "outline"}
              size="sm"
              className={`rounded-lg ${view === "leads" ? "bg-[var(--ai)]" : ""}`}
              onClick={() => setView("leads")}
            >
              Leads
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading CRM records...
            </div>
          ) : view === "customers" ? (
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <CustomerRelationshipCard
                  key={customer.id}
                  customer={customer}
                  proposals={proposalsForCustomer(customer, proposals)}
                  expanded={expandedCustomer === customer.id}
                  onToggle={() =>
                    setExpandedCustomer((current) => (current === customer.id ? null : customer.id))
                  }
                />
              ))}
              {!filteredCustomers.length && <EmptyState label="No customers match this search." />}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <LeadRelationshipCard
                  key={lead.id}
                  lead={lead}
                  customer={customerForLead(lead, customers)}
                  proposals={proposalsForLead(lead, proposals)}
                  expanded={expandedLead === lead.id}
                  onToggle={() => setExpandedLead((current) => (current === lead.id ? null : lead.id))}
                />
              ))}
              {!filteredLeads.length && <EmptyState label="No leads match this search." />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerRelationshipCard({
  customer,
  proposals,
  expanded,
  onToggle,
}: {
  customer: CustomerRow;
  proposals: ProposalRow[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-white">
      <button type="button" className="flex w-full items-center gap-4 p-4 text-left" onClick={onToggle}>
        <AvatarIcon />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-foreground">{customer.name}</div>
            <StatusBadge status={customer.summary.billingStatus} />
            {customer.summary.openTickets > 0 && <Badge variant="outline">{customer.summary.openTickets} open tickets</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">{customer.email}</div>
        </div>
        <div className="hidden grid-cols-4 gap-4 text-center text-xs md:grid">
          <SmallStat label="Services" value={customer.summary.totalServices} />
          <SmallStat label="Invoices" value={customer.services.invoices.length} />
          <SmallStat label="Tickets" value={customer.services.tickets.length} />
          <SmallStat label="Proposals" value={proposals.length} />
        </div>
        <ArrowRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/70 p-4">
          <ActionRow email={customer.email} />
          <div className="grid gap-4 xl:grid-cols-3">
            <RelatedPanel title="Services" empty="No services." rows={customer.services.items.map((item) => ({
              id: item.id,
              label: item.label,
              meta: item.type.replace("_", " "),
              status: item.status ?? "unknown",
            }))} />
            <RelatedPanel title="Invoices" empty="No invoices." rows={customer.services.invoices.map((invoice) => ({
              id: invoice.id,
              label: invoice.invoiceNumber || invoice.id,
              meta: `${money(invoice.amount)} due ${formatDate(invoice.dueDate)}`,
              status: invoice.status,
              href: `/dashboard/billing/invoices/${encodeURIComponent(invoice.id)}`,
            }))} />
            <RelatedPanel title="Support tickets" empty="No tickets." rows={customer.services.tickets.map((ticket) => ({
              id: ticket.id,
              label: ticket.subject,
              meta: ticket.priority,
              status: ticket.status,
              href: `/dashboard/support/${encodeURIComponent(ticket.id)}`,
            }))} />
          </div>
          <RelatedPanel title="Proposals" empty="No proposals." rows={proposals.map((proposal) => ({
            id: proposal.id,
            label: proposal.proposalNumber || proposal.title,
            meta: `${money(proposal.total)} · ${proposal.customerEmail}`,
            status: proposal.status,
            href: proposal.publicUrl || undefined,
          }))} />
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link to="/dashboard/users/$userId" params={{ userId: customer.id }}>
              Open full customer profile
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function LeadRelationshipCard({
  lead,
  customer,
  proposals,
  expanded,
  onToggle,
}: {
  lead: LeadRow;
  customer?: CustomerRow | null;
  proposals: ProposalRow[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-white">
      <button type="button" className="flex w-full items-center gap-4 p-4 text-left" onClick={onToggle}>
        <AvatarIcon lead />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-foreground">{lead.name}</div>
            <Badge variant={customer ? "default" : "outline"}>{customer ? "Registered customer" : "Lead only"}</Badge>
            {proposals.length > 0 && <Badge variant="outline">{proposals.length} proposals</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {lead.email}{lead.company ? ` · ${lead.company}` : ""}
          </div>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground md:block">
          Created {formatDate(lead.createdAt)}
        </div>
        <ArrowRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/70 p-4">
          <ActionRow email={lead.email} />
          <div className="grid gap-4 xl:grid-cols-3">
            <InfoBlock label="Company" value={lead.company || "Not captured"} />
            <InfoBlock label="Interested services" value={lead.services || "Not captured"} />
            <InfoBlock label="Setup style" value={lead.setupStyle || "Not captured"} />
          </div>
          <RelatedPanel title="Proposals" empty="No proposals yet." rows={proposals.map((proposal) => ({
            id: proposal.id,
            label: proposal.proposalNumber || proposal.title,
            meta: `${money(proposal.total)} · ${proposal.status}`,
            status: proposal.status,
            href: proposal.publicUrl || undefined,
          }))} />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link to="/dashboard/proposals">
                Create or update proposal
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {customer && (
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link to="/dashboard/users/$userId" params={{ userId: customer.id }}>
                  Open registered customer
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRow({ email }: { email: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" className="rounded-lg bg-[var(--ai)]">
        <a href={`mailto:${email}`}>
          <Mail className="h-3.5 w-3.5" />
          Email
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" className="rounded-lg">
        <a href={`https://wa.me/?text=${encodeURIComponent(`Hi, this is CloudMonkey following up with ${email}.`)}`} target="_blank" rel="noreferrer">
          <Phone className="h-3.5 w-3.5" />
          WhatsApp
        </a>
      </Button>
    </div>
  );
}

function RelatedPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; label: string; meta: string; status: string; href?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      <div className="space-y-2">
        {rows.length ? rows.slice(0, 6).map((row) => {
          const content = (
            <>
              <div className="min-w-0">
                <div className="truncate font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.meta}</div>
              </div>
              <StatusBadge status={row.status} />
            </>
          );
          return row.href ? (
            <a key={row.id} href={row.href} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm hover:bg-muted">
              {content}
            </a>
          ) : (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
              {content}
            </div>
          );
        }) : <div className="text-sm text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-[#f8faff] p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof UsersRound }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-bold text-[#07102c]">{value}</div>
          </div>
          <Icon className="h-5 w-5 text-[var(--ai)]" />
        </div>
      </CardContent>
    </Card>
  );
}

function AvatarIcon({ lead = false }: { lead?: boolean }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--ai-soft)] text-[var(--ai)]">
      {lead ? <Sparkles className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-semibold text-foreground">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = status || "unknown";
  const danger = ["failed", "suspended", "terminated", "expired", "overdue", "cancelled", "void", "rejected"].includes(value);
  const warning = ["pending", "pending_payment", "trial", "live_trial", "open", "past_due", "sent", "draft", "approved"].includes(value);
  return (
    <Badge variant={danger || warning ? "outline" : "default"} className={`capitalize ${danger ? "border-red-200 bg-red-50 text-red-700" : warning ? "border-amber-200 bg-amber-50 text-amber-800" : ""}`}>
      {value.replace("_", " ")}
    </Badge>
  );
}

function customerForLead(lead: LeadRow, customers: CustomerRow[]) {
  return customers.find((customer) => customer.email.toLowerCase() === lead.email.toLowerCase()) ?? null;
}

function proposalsForLead(lead: LeadRow, proposals: ProposalRow[]) {
  return proposals.filter((proposal) =>
    proposal.leadId === lead.id ||
    proposal.customerEmail.toLowerCase() === lead.email.toLowerCase()
  );
}

function proposalsForCustomer(customer: CustomerRow, proposals: ProposalRow[]) {
  return proposals.filter((proposal) =>
    proposal.customerUserId === customer.id ||
    proposal.customerEmail.toLowerCase() === customer.email.toLowerCase()
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format((cents || 0) / 100);
}

function formatDate(value?: string | null) {
  return formatDateUTC(value);
}
