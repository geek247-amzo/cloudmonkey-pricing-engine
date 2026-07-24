import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Unplug,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/cloud-security")({
  head: () => ({
    meta: [{ title: "Cloud Email Security - CloudMonkey Dashboard" }],
  }),
  component: CloudSecurityPage,
});

type Microsoft365Tenant = {
  id: string;
  tenantId: string;
  displayName: string | null;
  defaultDomain: string | null;
  connectedAccountEmail: string | null;
  status: string;
  userCount: number | null;
  secureScoreCurrent: string | null;
  secureScoreMax: string | null;
  secureScorePercent: number | null;
  serviceHealthStatus: string | null;
  serviceIssueCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}

function CloudSecurityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("m365");
    const error = params.get("m365_error");
    if (connected === "connected") toast.success("Microsoft 365 tenant connected");
    if (error) toast.error(error);
    if (connected || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const tenantsQuery = useQuery({
    queryKey: ["admin", "m365", "tenants"],
    queryFn: () => fetchJson<Microsoft365Tenant[]>("/api/admin/m365/tenants"),
    enabled: authReady && isAdmin,
  });

  const syncMutation = useMutation({
    mutationFn: (tenantId: string) =>
      fetchJson<Microsoft365Tenant>(
        `/api/admin/m365/tenants/${encodeURIComponent(tenantId)}/sync`,
        { method: "POST" },
      ),
    onSuccess: () => {
      toast.success("Microsoft 365 tenant synced");
      queryClient.invalidateQueries({ queryKey: ["admin", "m365", "tenants"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Microsoft 365 sync failed"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (tenantId: string) =>
      fetchJson<{ ok: true }>(`/api/admin/m365/tenants/${encodeURIComponent(tenantId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Microsoft 365 tenant disconnected");
      queryClient.invalidateQueries({ queryKey: ["admin", "m365", "tenants"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Disconnect failed"),
  });

  if (!authReady || !isAdmin) {
    return <div className="p-8 text-center">Checking permissions...</div>;
  }

  const tenants = tenantsQuery.data ?? [];
  const connectedTenants = tenants.filter((tenant) => tenant.status !== "disconnected");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cloud"
        title={<>Email Security.</>}
        subtitle="Connect Microsoft 365 tenants with admin SSO consent and query Graph for tenant health, Secure Score, users, domains, and service issues."
      />

      <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ef] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e9f8f1] text-[#0f8a55]">
            <CloudCog className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#07102c]">Microsoft 365 backend</div>
            <div className="text-xs text-muted-foreground">
              Requires Microsoft admin consent for Graph delegated permissions.
            </div>
          </div>
        </div>
        <Button asChild className="rounded-lg bg-[#0f8a55] text-white hover:bg-[#0c7046]">
          <a href="/api/admin/m365/auth/start">
            <ShieldCheck className="h-4 w-4" />
            Connect tenant
          </a>
        </Button>
      </div>

      {tenantsQuery.isLoading ? (
        <Card className="border-[#dfe4ef] bg-white p-12 text-center shadow-sm">
          <RefreshCcw className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
          <div className="text-sm font-medium">Loading Microsoft 365 tenants...</div>
        </Card>
      ) : connectedTenants.length === 0 ? (
        <Card className="border-[#dfe4ef] bg-white p-12 text-center shadow-sm">
          <Mail className="mx-auto mb-4 h-9 w-9 text-muted-foreground" />
          <div className="mb-2 text-sm font-bold text-[#07102c]">No Microsoft 365 tenants connected.</div>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Connect a customer tenant with Microsoft admin SSO to start tenant health and security checks.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connectedTenants.map((tenant) => (
            <TenantCard
              key={tenant.tenantId}
              tenant={tenant}
              syncing={syncMutation.isPending && syncMutation.variables === tenant.tenantId}
              disconnecting={
                disconnectMutation.isPending && disconnectMutation.variables === tenant.tenantId
              }
              onSync={() => syncMutation.mutate(tenant.tenantId)}
              onDisconnect={() => disconnectMutation.mutate(tenant.tenantId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TenantCard({
  tenant,
  syncing,
  disconnecting,
  onSync,
  onDisconnect,
}: {
  tenant: Microsoft365Tenant;
  syncing: boolean;
  disconnecting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const score = tenant.secureScorePercent ?? 0;
  const hasError = tenant.status === "error" || Boolean(tenant.lastError);
  const healthLabel = tenant.serviceHealthStatus ?? "unknown";

  return (
    <Card className="overflow-hidden border-[#dfe4ef] bg-white shadow-sm">
      <CardHeader className="border-b border-[#eef1f6]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-[#07102c]">
              {tenant.displayName || tenant.defaultDomain || tenant.tenantId}
              <Badge className="rounded-full" variant={hasError ? "destructive" : "outline"}>
                {tenant.status}
              </Badge>
            </CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              {tenant.defaultDomain || tenant.tenantId}
              {tenant.connectedAccountEmail ? ` · ${tenant.connectedAccountEmail}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={onSync}
              disabled={syncing || disconnecting}
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button
              variant="outline"
              className="rounded-lg text-destructive hover:text-destructive"
              onClick={onDisconnect}
              disabled={syncing || disconnecting}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric
            icon={ShieldCheck}
            label="Secure Score"
            value={tenant.secureScorePercent === null ? "Unknown" : `${tenant.secureScorePercent}%`}
          />
          <Metric icon={Users} label="Users" value={tenant.userCount ?? "Unknown"} />
          <Metric
            icon={healthLabel === "healthy" ? CheckCircle2 : AlertTriangle}
            label="Service Health"
            value={`${healthLabel}${tenant.serviceIssueCount ? ` · ${tenant.serviceIssueCount} issue${tenant.serviceIssueCount === 1 ? "" : "s"}` : ""}`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Secure Score progress</span>
            <span>
              {tenant.secureScoreCurrent && tenant.secureScoreMax
                ? `${tenant.secureScoreCurrent} / ${tenant.secureScoreMax}`
                : "No score yet"}
            </span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        {tenant.lastError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {tenant.lastError}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Last synced {tenant.lastSyncAt ? new Date(tenant.lastSyncAt).toLocaleString() : "never"}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-xl font-bold text-[#07102c]">{value}</div>
    </div>
  );
}
