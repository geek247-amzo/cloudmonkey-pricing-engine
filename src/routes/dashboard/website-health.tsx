import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/website-health")({
  head: () => ({ meta: [{ title: "Website Health - CloudMonkey Admin" }] }),
  component: WebsiteHealthPage,
});

type WebsiteHealthResponse = {
  generatedAt: string;
  summary: { total: number; healthy: number; degraded: number; down: number; unmonitored: number };
  websites: Array<{
    id: string;
    name: string;
    domain: string;
    current: {
      status: "healthy" | "degraded" | "down";
      checkedAt: string;
      httpStatus: number | null;
      sslDaysRemaining: number | null;
      responseTimeMs: number | null;
      contentCheckPassed: boolean;
      issues: string[];
    } | null;
  }>;
};

function WebsiteHealthPage() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const healthQuery = useQuery({
    queryKey: ["admin", "website-health"],
    queryFn: async () => {
      const response = await fetch("/api/admin/website-health");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load website health");
      return data as WebsiteHealthResponse;
    },
    enabled: Boolean(isAdmin),
    refetchInterval: 60_000,
  });

  if (!sessionPending && !isAdmin) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const data = healthQuery.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Autonomous Monitoring"
        title={<>Website Health.</>}
        subtitle="Continuous checks for customer websites, SSL certificates, response time, and expected content."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => healthQuery.refetch()}
            disabled={healthQuery.isFetching}
          >
            <RefreshCcw className={`h-4 w-4 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {healthQuery.isError && (
        <Card className="border-red-200 bg-red-50 text-red-700">
          <CardContent className="p-4 text-sm">{(healthQuery.error as Error).message}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Activity} label="Sites monitored" value={data?.summary.total ?? 0} />
        <Metric
          icon={CheckCircle2}
          label="Healthy"
          value={data?.summary.healthy ?? 0}
          tone="green"
        />
        <Metric
          icon={AlertTriangle}
          label="Degraded"
          value={data?.summary.degraded ?? 0}
          tone="amber"
        />
        <Metric icon={XCircle} label="Down" value={data?.summary.down ?? 0} tone="red" />
        <Metric icon={Clock3} label="Awaiting first check" value={data?.summary.unmonitored ?? 0} />
      </div>

      <Card className="border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-[var(--ai)]" />
            Customer websites
          </CardTitle>
          {data?.generatedAt && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {data?.websites.length ? (
            <div className="grid gap-3">
              {data.websites.map((site) => (
                <WebsiteHealthCard key={site.id} site={site} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#dfe4ef] p-8 text-center text-sm text-muted-foreground">
              No online or active customer websites are available to monitor yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "purple",
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone?: "purple" | "green" | "amber" | "red";
}) {
  const colors = {
    purple: "bg-[#f1eafe] text-[#642ef0]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Card className="border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-xl font-extrabold text-[#07102c]">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function WebsiteHealthCard({ site }: { site: WebsiteHealthResponse["websites"][number] }) {
  const current = site.current;
  const status = current?.status ?? "unmonitored";
  const badgeVariant = status === "healthy" ? "default" : "outline";
  return (
    <div className="rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold text-[#07102c]">{site.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{site.domain}</div>
        </div>
        <Badge variant={badgeVariant}>{status}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
        <Stat label="HTTP" value={current?.httpStatus ? String(current.httpStatus) : "—"} />
        <Stat
          label="Response"
          value={current?.responseTimeMs != null ? `${current.responseTimeMs} ms` : "—"}
        />
        <Stat
          label="SSL"
          value={current?.sslDaysRemaining != null ? `${current.sslDaysRemaining} days` : "—"}
        />
        <Stat
          label="Content"
          value={current ? (current.contentCheckPassed ? "Passed" : "Failed") : "Not checked"}
        />
      </div>
      {current?.issues.length ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="font-bold">Recent issues</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {current.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 text-[11px] text-muted-foreground">
        {current
          ? `Last checked ${new Date(current.checkedAt).toLocaleString()}`
          : "Waiting for the first scheduled check"}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold text-[#07102c]">{value}</div>
    </div>
  );
}
