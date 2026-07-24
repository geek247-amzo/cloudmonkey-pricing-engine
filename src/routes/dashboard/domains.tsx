import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe,
  LayoutGrid,
  List,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/domains")({
  head: () => ({
    meta: [{ title: "Domain Management - CloudMonkey Dashboard" }],
  }),
  component: DomainsManagementPage,
});

const SOON_EXPIRY_DAYS = 30;

type DomainAlertState = "expired" | "soon" | "safe" | "unknown";

type ManagedDomain = {
  id: string;
  status?: string | null;
  expiryDate?: string | null;
};

type PreparedDomain = ManagedDomain & {
  displayName: string;
  expiryLabel: string;
  expirySortKey: number;
  daysRemaining: number | null;
  alertState: DomainAlertState;
  alertLabel: string;
  alertTone: "danger" | "warning" | "success" | "neutral";
};

type DomainDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number | string;
};

type DomainDnsRecordInput = {
  type: string;
  name: string;
  content: string;
  ttl: number;
};

function getExpiryDetails(expiryDate?: string | null): {
  label: string;
  sortKey: number;
  daysRemaining: number | null;
  alertState: DomainAlertState;
  alertLabel: string;
  alertTone: "danger" | "warning" | "success" | "neutral";
} {
  if (!expiryDate) {
    return {
      label: "No expiry date",
      sortKey: Number.MAX_SAFE_INTEGER,
      daysRemaining: null,
      alertState: "unknown",
      alertLabel: "No expiry date",
      alertTone: "neutral",
    };
  }

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return {
      label: "Invalid expiry date",
      sortKey: Number.MAX_SAFE_INTEGER - 1,
      daysRemaining: null,
      alertState: "unknown",
      alertLabel: "Invalid expiry date",
      alertTone: "neutral",
    };
  }

  const millis = expiry.getTime() - Date.now();
  const daysRemaining = Math.ceil(millis / (1000 * 60 * 60 * 24));
  const label = expiry.toLocaleDateString();

  if (daysRemaining < 0) {
    return {
      label,
      sortKey: expiry.getTime(),
      daysRemaining,
      alertState: "expired",
      alertLabel: "Expired",
      alertTone: "danger",
    };
  }

  if (daysRemaining <= SOON_EXPIRY_DAYS) {
    return {
      label,
      sortKey: expiry.getTime(),
      daysRemaining,
      alertState: "soon",
      alertLabel:
        daysRemaining === 0
          ? "Expires today"
          : `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      alertTone: "warning",
    };
  }

  return {
    label,
    sortKey: expiry.getTime(),
    daysRemaining,
    alertState: "safe",
    alertLabel: `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    alertTone: "success",
  };
}

function getAlertStyles(tone: PreparedDomain["alertTone"]) {
  switch (tone) {
    case "danger":
      return "border-red-200 bg-red-50 text-red-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

function DomainsPageContent() {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [sortMode, setSortMode] = useState<"expiry" | "name">("expiry");
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "soon" | "safe">("all");
  const [search, setSearch] = useState("");

  const { data: domains, isLoading: isLoadingList } = useQuery({
    queryKey: ["user", "domains", "list"],
    queryFn: async () => {
      const res = await fetch("/api/user/domains");
      if (!res.ok) throw new Error("Failed to fetch domains");
      return res.json();
    },
  });

  const preparedDomains = useMemo<PreparedDomain[]>(() => {
    const rows = (domains ?? []) as ManagedDomain[];
    return rows.map((dom) => {
      const expiryDetails = getExpiryDetails(dom.expiryDate);
      return {
        ...dom,
        displayName: dom.id,
        expiryLabel: expiryDetails.label,
        expirySortKey: expiryDetails.sortKey,
        daysRemaining: expiryDetails.daysRemaining,
        alertState: expiryDetails.alertState,
        alertLabel: expiryDetails.alertLabel,
        alertTone: expiryDetails.alertTone,
      };
    });
  }, [domains]);

  const filteredDomains = useMemo(() => {
    const query = search.trim().toLowerCase();
    return preparedDomains
      .filter((dom) => {
        if (statusFilter !== "all" && dom.alertState !== statusFilter) return false;
        if (!query) return true;
        return [dom.displayName, dom.status ?? "", dom.expiryLabel, dom.alertLabel]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        if (sortMode === "name") return left.displayName.localeCompare(right.displayName);
        const alertRank = (value: DomainAlertState) =>
          value === "expired" ? 0 : value === "soon" ? 1 : value === "safe" ? 2 : 3;
        const rankDiff = alertRank(left.alertState) - alertRank(right.alertState);
        if (rankDiff !== 0) return rankDiff;
        if (left.expirySortKey !== right.expirySortKey) {
          return left.expirySortKey - right.expirySortKey;
        }
        return left.displayName.localeCompare(right.displayName);
      });
  }, [preparedDomains, search, sortMode, statusFilter]);

  const stats = useMemo(() => {
    return preparedDomains.reduce(
      (acc, dom) => {
        acc.total += 1;
        if (dom.alertState === "expired") acc.expired += 1;
        if (dom.alertState === "soon") acc.soon += 1;
        if ((dom.status ?? "").toLowerCase() === "active") acc.active += 1;
        return acc;
      },
      { total: 0, active: 0, soon: 0, expired: 0 },
    );
  }, [preparedDomains]);

  if (isLoadingList) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4" /> Loading domains...
      </div>
    );
  }

  if (selectedDomain) {
    return <DomainDetailsView domainName={selectedDomain} onBack={() => setSelectedDomain(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total domains</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-emerald-700">Active</div>
            <div className="mt-2 text-3xl font-bold text-emerald-900">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-amber-700">Expiring soon</div>
            <div className="mt-2 text-3xl font-bold text-amber-900">{stats.soon}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-red-700">Expired</div>
            <div className="mt-2 text-3xl font-bold text-red-900">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by domain, status, or expiry..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary p-1">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  viewMode === "cards"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary p-1">
              <button
                type="button"
                onClick={() => setSortMode("expiry")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  sortMode === "expiry"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowUpDown className="h-4 w-4" />
                Expiry
              </button>
              <button
                type="button"
                onClick={() => setSortMode("name")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  sortMode === "name"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowUpDown className="h-4 w-4" />
                Name
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "all" as const, label: "All", count: stats.total },
              { id: "soon" as const, label: "Soon to expire", count: stats.soon },
              { id: "expired" as const, label: "Expired", count: stats.expired },
              { id: "safe" as const, label: "Healthy", count: stats.active },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  statusFilter === filter.id
                    ? "border-transparent bg-[var(--ai)] text-white shadow-[var(--shadow-elevated)]"
                    : "border-border bg-background text-muted-foreground hover:border-[var(--ai)] hover:text-foreground"
                }`}
              >
                {filter.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    statusFilter === filter.id
                      ? "bg-white/15 text-white"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!filteredDomains.length && (
        <Card className="border-dashed border-2 bg-transparent p-12 text-center">
          <div className="mb-1 text-sm font-medium text-muted-foreground">
            No registered domains found.
          </div>
          <p className="mb-6 text-xs text-muted-foreground">
            Assign your existing domains from the global list or register a new one.
          </p>
          <Link
            to="/dashboard/domains/new"
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Register New Domain
          </Link>
        </Card>
      )}

      {filteredDomains.length > 0 && viewMode === "cards" && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredDomains.map((dom) => (
            <DomainCard key={dom.id} domain={dom} onManage={() => setSelectedDomain(dom.id)} />
          ))}
        </div>
      )}

      {filteredDomains.length > 0 && viewMode === "list" && (
        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-secondary/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Domain</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3">Alert</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDomains.map((dom) => (
                  <tr
                    key={dom.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">{dom.displayName}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={dom.status === "active" ? "default" : "outline"}
                        className="rounded-full"
                      >
                        {dom.status || "unknown"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{dom.expiryLabel}</td>
                    <td className="px-5 py-4">
                      <div
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${getAlertStyles(dom.alertTone)}`}
                      >
                        {dom.alertState === "expired" ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}
                        {dom.alertLabel}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        className="rounded-xl bg-[var(--ai)] shadow-sm"
                        onClick={() => setSelectedDomain(dom.id)}
                      >
                        <Settings className="h-4 w-4" />
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Outlet />
    </div>
  );
}

function DomainCard({ domain, onManage }: { domain: PreparedDomain; onManage: () => void }) {
  return (
    <Card
      className={`relative flex flex-col overflow-hidden border-border/70 bg-card/95 shadow-sm ${domain.alertState === "expired" ? "ring-1 ring-red-200" : domain.alertState === "soon" ? "ring-1 ring-amber-200" : ""}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          domain.alertState === "expired"
            ? "bg-red-500"
            : domain.alertState === "soon"
              ? "bg-amber-500"
              : "bg-emerald-500"
        }`}
      />
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef8ff] text-[#1381ee]">
            <Globe className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className="rounded-full"
              variant={domain.status === "active" ? "default" : "outline"}
            >
              {domain.status || "unknown"}
            </Badge>
            <Badge
              className={`rounded-full border ${getAlertStyles(domain.alertTone)}`}
              variant="outline"
            >
              {domain.alertLabel}
            </Badge>
          </div>
        </div>
        <CardTitle className="mt-4 text-lg font-bold">{domain.displayName}</CardTitle>
        <div className="text-xs text-muted-foreground">Expires: {domain.expiryLabel}</div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-4">
            <span>Expiry flag</span>
            <span className="font-semibold text-foreground">
              {domain.alertState === "expired"
                ? "Expired"
                : domain.alertState === "soon"
                  ? "Needs attention"
                  : "Healthy"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Days remaining</span>
            <span className="font-semibold text-foreground">
              {domain.daysRemaining == null ? "N/A" : domain.daysRemaining}
            </span>
          </div>
        </div>
        <Button className="mt-auto w-full rounded-xl bg-[var(--ai)] shadow-sm" onClick={onManage}>
          <Settings className="h-4 w-4" />
          Manage Domain
        </Button>
      </CardContent>
    </Card>
  );
}

function DomainDetailsView({ domainName, onBack }: { domainName: string; onBack: () => void }) {
  const queryClient = useQueryClient();

  const { data: info, isLoading: isLoadingInfo } = useQuery({
    queryKey: ["user", "domains", "info", domainName],
    queryFn: async () => {
      const res = await fetch(`/api/user/domains/info?domain=${domainName}`);
      if (!res.ok) throw new Error("Failed to fetch domain info");
      return res.json();
    },
  });

  const { data: dns, isLoading: isLoadingDns } = useQuery({
    queryKey: ["user", "domains", "dns", domainName],
    queryFn: async () => {
      const res = await fetch(`/api/user/domains/dns?domain=${domainName}`);
      if (!res.ok) throw new Error("Failed to fetch DNS");
      return res.json();
    },
  });

  const addDnsMutation = useMutation({
    mutationFn: async (record: DomainDnsRecordInput) => {
      const res = await fetch(`/api/user/domains/dns?domain=${domainName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.intReturnCode === 1 || data.intReturnCode === 0) {
        toast.success("DNS record added");
        queryClient.invalidateQueries({ queryKey: ["user", "domains", "dns", domainName] });
      } else {
        toast.error(data.strMessage || "Failed to add record");
      }
    },
  });

  const deleteDnsMutation = useMutation({
    mutationFn: async (dnsId: string) => {
      const res = await fetch(`/api/user/domains/dns?domain=${domainName}&dnsId=${dnsId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.intReturnCode === 1 || data.intReturnCode === 0) {
        toast.success("DNS record deleted");
        queryClient.invalidateQueries({ queryKey: ["user", "domains", "dns", domainName] });
      } else {
        toast.error(data.strMessage || "Failed to delete record");
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" className="rounded-lg shadow-none" onClick={onBack}>
          ← Back to list
        </Button>
        <h2 className="text-2xl font-bold">{domainName}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-border/70 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Domain Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingInfo ? (
              <div className="text-xs text-muted-foreground animate-pulse">Loading API data...</div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="default">{info?.strStatus || "Active"}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nameservers</span>
                  <div className="text-right">
                    {info?.arrNameservers?.map((ns: string) => (
                      <div key={ns} className="text-xs font-mono">
                        {ns}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expiry</span>
                  <span className="font-medium">
                    {info?.intExDate ? new Date(info.intExDate * 1000).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/70 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">DNS Management</CardTitle>
            <DnsAddDialog
              onAdd={(rec) => addDnsMutation.mutate(rec)}
              isLoading={addDnsMutation.isPending}
            />
          </CardHeader>
          <CardContent>
            {isLoadingDns ? (
              <div className="py-8 text-center text-muted-foreground">
                <RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading records...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Content</th>
                      <th className="pb-2">TTL</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dns?.arrRecords?.map((rec: DomainDnsRecord) => (
                      <tr
                        key={rec.id}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-3 font-bold text-blue-600">{rec.type}</td>
                        <td className="py-3 font-medium">{rec.name}</td>
                        <td className="py-3 text-xs text-muted-foreground truncate max-w-[200px]">
                          {rec.content}
                        </td>
                        <td className="py-3 text-xs">{rec.ttl}</td>
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => deleteDnsMutation.mutate(rec.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!dns?.arrRecords?.length && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No custom DNS records found. Ensure you are using our Premium Nameservers.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DnsAddDialog({
  onAdd,
  isLoading,
}: {
  onAdd: (rec: DomainDnsRecordInput) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("A");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [ttl, setTtl] = useState("3600");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ type, name, content, ttl: parseInt(ttl) });
    setOpen(false);
    setName("");
    setContent("");
  };

  if (!open)
    return (
      <Button size="sm" className="rounded-lg shadow-none" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Record
      </Button>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md bg-white border-border/70 shadow-2xl">
        <CardHeader>
          <CardTitle>Add DNS Record</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full border rounded-md p-2 bg-white"
                >
                  <option>A</option>
                  <option>AAAA</option>
                  <option>CNAME</option>
                  <option>MX</option>
                  <option>TXT</option>
                  <option>SRV</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">TTL</label>
                <Input value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="3600" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. www"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Content</label>
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. 1.2.3.4"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 rounded-xl bg-blue-600" disabled={isLoading}>
                Save Record
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function DomainsManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Domains"
        title={<>Domains and DNS Management.</>}
        subtitle="Manage your domain registrations, renewals, and configure DNS records via the live API."
        actions={
          <Button asChild className="rounded-xl bg-[var(--ai)] shadow-sm">
            <Link to="/dashboard/domains/new">
              <Plus className="h-4 w-4" />
              Add domain
            </Link>
          </Button>
        }
      />

      <DomainsPageContent />
    </div>
  );
}
