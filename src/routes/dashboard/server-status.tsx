import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Boxes,
  Cloud,
  Cpu,
  Database,
  Globe,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCcw,
  Server,
  Workflow,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/server-status")({
  head: () => ({
    meta: [{ title: "Server Status - CloudMonkey Admin" }],
  }),
  component: ServerStatusPage,
});

type ContainerLink = {
  type: string;
  name?: string;
  id?: string;
  domains?: string[];
  dataLocation?: string;
  status?: string;
  containerStatus?: string;
  engine?: string;
  volumeName?: string;
};

type ContainerRow = {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  role: string;
  composeProject?: string | null;
  composeService?: string | null;
  stats?: {
    cpuPercent?: number | null;
    memoryUsageBytes?: number | null;
    memoryLimitBytes?: number | null;
    networkRxBytes?: number | null;
    networkTxBytes?: number | null;
  } | null;
  ports?: Array<{ IP?: string; PrivatePort?: number; PublicPort?: number; Type?: string }>;
  links?: ContainerLink[];
};

type ServerStatusResponse = {
  generatedAt: string;
  local: {
    label: string;
    status: string;
    error?: string | null;
    networkName?: string;
    containers: ContainerRow[];
  };
  remoteServers: Array<{
    id: string;
    label?: string | null;
    region?: string | null;
    mainIp?: string | null;
    status?: string | null;
    powerStatus?: string | null;
    latestTelemetry?: any;
    agent?: any;
    containers?: ContainerRow[];
    websites?: any[];
    databases?: any[];
    aiRuntimes?: any[];
  }>;
  dataFlow: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
    summary: {
      localContainerCount: number;
      remoteServerCount: number;
      linkedContainerCount: number;
    };
  };
};

function ServerStatusPage() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const statusQuery = useQuery({
    queryKey: ["admin", "server-status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/server-status");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load server status");
      return data as ServerStatusResponse;
    },
    enabled: Boolean(isAdmin),
    refetchInterval: 30_000,
  });

  if (!sessionPending && !isAdmin) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const data = statusQuery.data;
  const localContainers = data?.local.containers ?? [];
  const runningContainers = localContainers.filter((container) => container.state === "running");
  const linkedContainers = localContainers.filter((container) => container.links?.length);
  const remoteServers = data?.remoteServers ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin Operations"
        title={<>Server Status.</>}
        subtitle="View CloudMonkey servers, Docker containers, linked apps/domains, runtime status, and business data flow."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            <RefreshCcw className={`h-4 w-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {statusQuery.isError && (
        <Card className="border-red-200 bg-red-50 text-red-700">
          <CardContent className="p-4 text-sm">{(statusQuery.error as Error).message}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Server} label="Primary Host" value={data?.local.status ?? "loading"} />
        <MetricCard icon={Boxes} label="Local Containers" value={String(localContainers.length)} sub={`${runningContainers.length} running`} />
        <MetricCard icon={Globe} label="Linked Workloads" value={String(linkedContainers.length)} sub="apps, domains, data" />
        <MetricCard icon={Cloud} label="Remote Servers" value={String(remoteServers.length)} sub="agent or Vultr telemetry" />
      </div>

      <Card className="border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4 text-[var(--ai)]" />
            Business Data Flow
          </CardTitle>
          {data?.generatedAt && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <DataFlow data={data?.dataFlow} />
        </CardContent>
      </Card>

      <Card className="border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4 text-[var(--ai)]" />
            Primary Docker Host
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            {data?.local.label ?? "CloudMonkey primary Docker host"} · Network {data?.local.networkName ?? "unknown"}
          </div>
        </CardHeader>
        <CardContent>
          {data?.local.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{data.local.error}</div>
          ) : (
            <ContainerGrid containers={localContainers} />
          )}
        </CardContent>
      </Card>

      <Card className="border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-[var(--ai)]" />
            Server Fleet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-2">
            {remoteServers.length ? (
              remoteServers.map((server) => <RemoteServerCard key={server.id} server={server} />)
            ) : (
              <div className="rounded-lg border border-dashed border-[#dfe4ef] p-5 text-sm text-muted-foreground">
                No remote server telemetry is available yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1eafe] text-[#642ef0]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-extrabold text-[#07102c]">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ContainerGrid({ containers }: { containers: ContainerRow[] }) {
  if (!containers.length) {
    return <div className="text-sm text-muted-foreground">No containers detected.</div>;
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {containers.map((container) => (
        <ContainerCard key={container.id} container={container} />
      ))}
    </div>
  );
}

function ContainerCard({ container }: { container: ContainerRow }) {
  const memoryLabel =
    container.stats?.memoryUsageBytes && container.stats?.memoryLimitBytes
      ? `${formatBytes(container.stats.memoryUsageBytes)} / ${formatBytes(container.stats.memoryLimitBytes)}`
      : "N/A";
  return (
    <div className="rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold text-[#07102c]">{container.name}</div>
          <div className="truncate text-xs text-muted-foreground">{container.image}</div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">{container.shortId}</div>
        </div>
        <Badge variant={container.state === "running" ? "default" : "outline"}>{container.state}</Badge>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <Info icon={Activity} label="Role" value={container.role} />
        <Info icon={Workflow} label="Service" value={container.composeService || "standalone"} />
        <Info icon={Cpu} label="CPU" value={container.stats?.cpuPercent != null ? `${container.stats.cpuPercent}%` : "N/A"} />
        <Info icon={MemoryStick} label="Memory" value={memoryLabel} />
        <Info icon={Network} label="Network RX/TX" value={`${formatBytes(container.stats?.networkRxBytes)} / ${formatBytes(container.stats?.networkTxBytes)}`} />
        <Info icon={HardDrive} label="Ports" value={formatPorts(container.ports)} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Linked app, domain, or data</div>
        {container.links?.length ? (
          container.links.map((link, index) => <LinkedResource key={`${container.id}-${index}`} link={link} />)
        ) : (
          <div className="rounded-md border border-dashed border-[#dfe4ef] p-3 text-xs text-muted-foreground">
            No CloudMonkey app/domain link detected.
          </div>
        )}
      </div>
    </div>
  );
}

function LinkedResource({ link }: { link: ContainerLink }) {
  return (
    <div className="rounded-md border border-[#e8edf4] bg-white p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-[#07102c]">{link.name || link.id || link.type}</div>
        <Badge variant="outline">{link.type}</Badge>
      </div>
      {link.domains?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {link.domains.map((domain) => (
            <span key={domain} className="rounded bg-[#eef4ff] px-2 py-1 font-mono text-[11px] text-[#2456a6]">
              {domain}
            </span>
          ))}
        </div>
      ) : null}
      {link.dataLocation && <div className="mt-2 text-muted-foreground">Data: {link.dataLocation}</div>}
      {link.volumeName && <div className="mt-2 text-muted-foreground">Volume: {link.volumeName}</div>}
      {(link.status || link.containerStatus) && (
        <div className="mt-2 text-muted-foreground">Status: {link.status || link.containerStatus}</div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-white px-2 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
        <div className="truncate font-semibold text-[#07102c]">{value}</div>
      </div>
    </div>
  );
}

function RemoteServerCard({ server }: { server: ServerStatusResponse["remoteServers"][number] }) {
  const telemetry = server.latestTelemetry;
  const containers = server.containers ?? [];
  return (
    <div className="rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-[#07102c]">{server.label || server.id}</div>
          <div className="text-xs text-muted-foreground">{server.region || "unknown region"} · {server.mainIp || "no IP"}</div>
        </div>
        <Badge variant={server.powerStatus === "running" ? "default" : "outline"}>{server.powerStatus || server.status}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <Info icon={Cpu} label="CPU" value={telemetry?.cpuUsagePercent != null ? `${telemetry.cpuUsagePercent}%` : "N/A"} />
        <Info icon={MemoryStick} label="RAM" value={telemetry ? `${telemetry.memoryUsedMb ?? "N/A"} / ${telemetry.memoryTotalMb ?? "N/A"} MB` : "N/A"} />
        <Info icon={Database} label="Disk" value={telemetry ? `${telemetry.diskUsedGb ?? "N/A"} / ${telemetry.diskTotalGb ?? "N/A"} GB` : "N/A"} />
      </div>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
        <CountPill label="Containers" value={containers.length} />
        <CountPill label="Websites" value={server.websites?.length ?? 0} />
        <CountPill label="Databases" value={server.databases?.length ?? 0} />
        <CountPill label="AI runtimes" value={server.aiRuntimes?.length ?? 0} />
      </div>
      <div className="mt-4 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Docker containers on this server</div>
        {containers.length ? (
          containers.map((container) => <RemoteContainerRow key={container.id || container.name} container={container} />)
        ) : (
          <div className="rounded-md border border-dashed border-[#dfe4ef] p-3 text-xs text-muted-foreground">
            No container telemetry has been reported by this server yet.
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteContainerRow({ container }: { container: ContainerRow }) {
  return (
    <div className="rounded-md border border-[#e8edf4] bg-white p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold text-[#07102c]">{container.name}</div>
          <div className="truncate text-muted-foreground">{container.image}</div>
          <div className="mt-1 text-muted-foreground">{container.role}</div>
        </div>
        <Badge variant={container.state === "running" ? "default" : "outline"}>{container.state || container.status}</Badge>
      </div>
      <div className="mt-2 text-muted-foreground">Ports: {formatPorts(container.ports)}</div>
      <div className="mt-3 space-y-2">
        {container.links?.length ? (
          container.links.map((link, index) => <LinkedResource key={`${container.id}-${index}`} link={link} />)
        ) : (
          <div className="rounded-md border border-dashed border-[#dfe4ef] p-3 text-muted-foreground">
            No app/domain/data link detected for this container.
          </div>
        )}
      </div>
    </div>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-extrabold text-[#07102c]">{value}</div>
    </div>
  );
}

function DataFlow({ data }: { data?: ServerStatusResponse["dataFlow"] }) {
  if (!data) return <div className="text-sm text-muted-foreground">Loading data flow...</div>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {data.nodes.map((node) => (
          <div key={node.id} className="rounded-lg border border-[#dfe4ef] bg-[#fbfcff] p-3">
            <div className="text-xs font-bold uppercase text-muted-foreground">{node.type}</div>
            <div className="mt-1 text-sm font-bold text-[#07102c]">{node.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {data.edges.map((edge, index) => (
          <div key={`${edge.from}-${edge.to}-${index}`} className="flex items-center gap-2 rounded-lg border border-[#dfe4ef] bg-white p-3 text-xs">
            <span className="font-semibold text-[#07102c]">{labelForNode(data, edge.from)}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-semibold text-[#07102c]">{labelForNode(data, edge.to)}</span>
            <span className="ml-auto rounded bg-[#eef4ff] px-2 py-1 text-[#2456a6]">{edge.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelForNode(data: ServerStatusResponse["dataFlow"], id: string) {
  return data.nodes.find((node) => node.id === id)?.label ?? id;
}

function formatPorts(ports?: ContainerRow["ports"]) {
  if (!ports?.length) return "none";
  return ports
    .map((port) =>
      port.PublicPort
        ? `${port.PublicPort}->${port.PrivatePort}/${port.Type}`
        : `${port.PrivatePort}/${port.Type}`,
    )
    .join(", ");
}

function formatBytes(value?: number | null) {
  if (!value || value < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : Math.round(size * 10) / 10} ${units[unitIndex]}`;
}
