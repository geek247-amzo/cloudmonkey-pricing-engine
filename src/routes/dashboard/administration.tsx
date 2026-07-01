import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Globe, RefreshCcw, Server, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/administration")({
  head: () => ({
    meta: [{ title: "Administration - CloudMonkey Dashboard" }],
  }),
  component: AdministrationPage,
});

type MatrixUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type MatrixDomain = {
  domainName: string;
  status: string | null;
  expiryDate: string | null;
  source: string;
  assignment?: { userId: string } | null;
  user?: MatrixUser | null;
};

type MatrixServer = {
  id: string;
  label?: string;
  main_ip?: string;
  os?: string;
  ram?: number;
  disk?: number;
  region?: string;
  status?: string;
  power_status?: string;
  assignment?: { userId: string } | null;
  user?: MatrixUser | null;
};

type VultrPlan = {
  id: string;
  vcpu_count: number;
  ram: number;
  disk: number;
  bandwidth: number;
  monthly_cost: number;
  type: string;
  locations?: string[];
};

type MatrixPayload = {
  users: MatrixUser[];
  domains: MatrixDomain[];
  servers: MatrixServer[];
  vultrPlans: VultrPlan[];
  errors: Record<string, string | null>;
};

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function AdministrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [view, setView] = useState<"domains" | "servers" | "services">("domains");
  const [domainFilter, setDomainFilter] = useState("");
  const [serverFilter, setServerFilter] = useState("");

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const { data, isLoading, isFetching } = useQuery<MatrixPayload>({
    queryKey: ["admin", "platform-matrix"],
    queryFn: () => fetchJson("/api/admin/platform-matrix"),
    enabled: isAdmin,
  });

  const assignDomainMutation = useMutation({
    mutationFn: async ({ domain, userId }: { domain: MatrixDomain; userId: string }) => {
      const res = await fetch("/api/admin/assign-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainName: domain.domainName,
          userId,
          status: domain.status || "active",
          expiryDate: domain.expiryDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to assign domain");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Domain assignment updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-matrix"] });
    },
    onError: () => toast.error("Could not assign domain"),
  });

  const assignServerMutation = useMutation({
    mutationFn: async ({ server, userId }: { server: MatrixServer; userId: string }) => {
      const res = await fetch("/api/admin/assign-vultr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...server,
          userId,
        }),
      });
      if (!res.ok) throw new Error("Failed to assign server");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Server assignment updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-matrix"] });
    },
    onError: () => toast.error("Could not assign server"),
  });

  const users = data?.users ?? [];
  const domains = useMemo(() => {
    const query = domainFilter.trim().toLowerCase();
    return (data?.domains ?? []).filter((domain) => {
      if (!query) return true;
      return [
        domain.domainName,
        domain.status,
        domain.source,
        domain.user?.name,
        domain.user?.email,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [data?.domains, domainFilter]);
  const servers = useMemo(() => {
    const query = serverFilter.trim().toLowerCase();
    return (data?.servers ?? []).filter((server) => {
      if (!query) return true;
      return [
        server.id,
        server.label,
        server.main_ip,
        server.os,
        server.region,
        server.status,
        server.user?.name,
        server.user?.email,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [data?.servers, serverFilter]);
  const providerErrors = Object.entries(data?.errors ?? {}).filter(([, message]) => !!message);

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={<>Platform matrix.</>}
        subtitle="Provider inventory, local ownership, and customer resource links for domains and cloud services."
        actions={
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["admin", "platform-matrix"] })
            }
            disabled={isFetching}
          >
            <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={users.length} icon={UserRound} />
        <MetricCard label="Domains" value={data?.domains?.length ?? 0} icon={Globe} />
        <MetricCard label="CloudMonkey VPS servers" value={data?.servers?.length ?? 0} icon={Server} />
        <MetricCard label="CloudMonkey VPS services" value={data?.vultrPlans?.length ?? 0} icon={Database} />
      </div>

      {providerErrors.length > 0 && (
        <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="space-y-1 p-4 text-sm text-amber-900">
            {providerErrors.map(([key, message]) => (
              <div key={key}>
                <span className="font-semibold">{key}:</span> {message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { value: "domains", label: "Domains" },
          { value: "servers", label: "Servers" },
          { value: "services", label: "CloudMonkey VPS services" },
        ].map((item) => (
          <Button
            key={item.value}
            variant={view === item.value ? "default" : "outline"}
            className={`rounded-lg ${view === item.value ? "bg-[var(--ai)]" : ""}`}
            onClick={() => setView(item.value as typeof view)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Card className="rounded-lg border-[#dfe4ef] bg-white p-12 text-center shadow-sm">
          <RefreshCcw className="mx-auto mb-3 h-7 w-7 animate-spin text-muted-foreground" />
          <div className="text-sm font-medium">Loading provider inventory...</div>
        </Card>
      ) : (
        <>
          {view === "domains" && (
            <ResourceTable
              title="Domains API inventory"
              filter={domainFilter}
              onFilterChange={setDomainFilter}
              placeholder="Search domains, users, status..."
            >
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="pb-3">Domain</th>
                    <th className="pb-3">Provider</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Expiry</th>
                    <th className="pb-3">Linked user</th>
                    <th className="pb-3">Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((domain) => (
                    <tr key={domain.domainName} className="border-b border-border/50 last:border-0">
                      <td className="py-4 font-semibold text-foreground">{domain.domainName}</td>
                      <td className="py-4 text-muted-foreground">{domain.source}</td>
                      <td className="py-4">
                        <StatusBadge status={domain.status} />
                      </td>
                      <td className="py-4 text-muted-foreground">
                        {formatDate(domain.expiryDate)}
                      </td>
                      <td className="py-4">
                        <LinkedUser user={domain.user} />
                      </td>
                      <td className="py-4">
                        <UserSelect
                          users={users}
                          value={domain.assignment?.userId ?? ""}
                          onChange={(userId) => assignDomainMutation.mutate({ domain, userId })}
                        />
                      </td>
                    </tr>
                  ))}
                  {domains.length === 0 && <EmptyRow colSpan={6} label="No domains matched." />}
                </tbody>
              </table>
            </ResourceTable>
          )}

          {view === "servers" && (
            <ResourceTable
              title="CloudMonkey VPS server inventory"
              filter={serverFilter}
              onFilterChange={setServerFilter}
              placeholder="Search servers, IPs, users..."
            >
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="pb-3">Server</th>
                    <th className="pb-3">IP</th>
                    <th className="pb-3">Region</th>
                    <th className="pb-3">Resources</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Linked user</th>
                    <th className="pb-3">Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map((server) => (
                    <tr key={server.id} className="border-b border-border/50 last:border-0">
                      <td className="py-4">
                        <div className="font-semibold text-foreground">
                          {server.label || "Untitled instance"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{server.id}</div>
                        <div className="text-xs text-muted-foreground">{server.os}</div>
                      </td>
                      <td className="py-4 font-mono text-xs">{server.main_ip || "N/A"}</td>
                      <td className="py-4 text-muted-foreground">{server.region || "N/A"}</td>
                      <td className="py-4 text-xs text-muted-foreground">
                        {server.ram ?? 0} MB RAM · {server.disk ?? 0} GB disk
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={server.status} />
                          {server.power_status && (
                            <span className="text-xs text-muted-foreground">
                              {server.power_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <LinkedUser user={server.user} />
                      </td>
                      <td className="py-4">
                        <UserSelect
                          users={users}
                          value={server.assignment?.userId ?? ""}
                          onChange={(userId) => assignServerMutation.mutate({ server, userId })}
                        />
                      </td>
                    </tr>
                  ))}
                  {servers.length === 0 && (
                    <EmptyRow colSpan={7} label="No CloudMonkey VPS servers matched." />
                  )}
                </tbody>
              </table>
            </ResourceTable>
          )}

          {view === "services" && (
            <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
              <CardHeader>
                <CardTitle>CloudMonkey VPS service plans</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="pb-3">Plan</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">CPU</th>
                      <th className="pb-3">RAM</th>
                      <th className="pb-3">Disk</th>
                      <th className="pb-3">Monthly</th>
                      <th className="pb-3">Locations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.vultrPlans ?? []).map((plan) => (
                      <tr key={plan.id} className="border-b border-border/50 last:border-0">
                        <td className="py-4 font-semibold">{plan.id}</td>
                        <td className="py-4 text-muted-foreground">{plan.type}</td>
                        <td className="py-4">{plan.vcpu_count}</td>
                        <td className="py-4">{plan.ram} MB</td>
                        <td className="py-4">{plan.disk} GB</td>
                        <td className="py-4">${plan.monthly_cost}</td>
                        <td className="py-4 text-xs text-muted-foreground">
                          {plan.locations?.slice(0, 8).join(", ") || "N/A"}
                        </td>
                      </tr>
                    ))}
                    {!data?.vultrPlans?.length && (
                      <EmptyRow colSpan={7} label="No CloudMonkey VPS service plans returned." />
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-3xl font-bold text-[#07102c]">{value}</div>
          </div>
          <Icon className="h-5 w-5 text-[var(--ai)]" />
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceTable({
  title,
  filter,
  onFilterChange,
  placeholder,
  children,
}: {
  title: string;
  filter: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm sm:w-72"
        />
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

function UserSelect({
  users,
  value,
  onChange,
}: {
  users: MatrixUser[];
  value: string;
  onChange: (userId: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value) onChange(event.target.value);
      }}
      className="h-9 w-56 rounded-md border border-border bg-white px-2 text-xs"
    >
      <option value="">Unassigned</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} ({user.email})
        </option>
      ))}
    </select>
  );
}

function LinkedUser({ user }: { user?: MatrixUser | null }) {
  if (!user) return <span className="text-xs text-muted-foreground">Unassigned</span>;

  return (
    <div>
      <div className="font-medium text-foreground">{user.name}</div>
      <div className="text-xs text-muted-foreground">{user.email}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status?.toLowerCase() ?? "unknown";
  return (
    <Badge variant={["active", "running", "ok"].includes(normalized) ? "default" : "outline"}>
      {status || "unknown"}
    </Badge>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
}
