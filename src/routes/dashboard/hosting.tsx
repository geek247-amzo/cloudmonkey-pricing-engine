import { createFileRoute } from "@tanstack/react-router";
import { Server, Zap, RefreshCcw, Square, Play, LifeBuoy, Globe, Cpu, MemoryStick, Database, ShieldAlert, Bot, Copy, Workflow, KeyRound, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/dashboard/hosting")({
  head: () => ({
    meta: [{ title: "Hosting & Servers - CloudMonkey Dashboard" }],
  }),
  component: HostingPage,
});

function HostingPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const [installCommand, setInstallCommand] = useState<string | null>(null);
  const [n8nConfig, setN8nConfig] = useState<{ instanceId: string; baseUrl: string; apiKey: string } | null>(null);
  const { data: servers, isLoading } = useQuery({
    queryKey: ["user", "vultr"],
    queryFn: async () => {
      const res = await fetch("/api/user/vultr");
      if (!res.ok) throw new Error("Failed to fetch servers");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ instanceId, action }: { instanceId: string; action: string }) => {
      const res = await fetch("/api/user/vultr", {
        method: "POST",
        body: JSON.stringify({ instanceId, action }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success(`Server ${variables.action}ed successfully`);
      queryClient.invalidateQueries({ queryKey: ["user", "vultr"] });
    },
    onError: () => {
      toast.error("Failed to perform server action");
    },
  });

  const enrollmentMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      const res = await fetch("/api/admin/server-agents/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      if (!res.ok) throw new Error("Failed to create enrollment token");
      return res.json();
    },
    onSuccess: (data) => {
      setInstallCommand(data.installCommand);
      toast.success("Agent install command generated");
      queryClient.invalidateQueries({ queryKey: ["user", "vultr"] });
    },
    onError: () => toast.error("Could not generate agent installer"),
  });

  const n8nSaveMutation = useMutation({
    mutationFn: async (payload: { instanceId: string; baseUrl: string; apiKey: string }) => {
      const res = await fetch("/api/admin/server-n8n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save n8n settings");
      return res.json();
    },
    onSuccess: () => {
      toast.success("n8n settings saved");
      setN8nConfig(null);
      queryClient.invalidateQueries({ queryKey: ["user", "vultr"] });
    },
    onError: () => toast.error("Could not save n8n settings"),
  });

  const n8nSyncMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      const res = await fetch("/api/admin/server-n8n/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to sync n8n workflows");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("n8n workflows synced");
      queryClient.invalidateQueries({ queryKey: ["user", "vultr"] });
    },
    onError: (error: any) => {
      toast.error(error.message ?? "Could not sync n8n workflows");
      queryClient.invalidateQueries({ queryKey: ["user", "vultr"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cloud"
        title={<>Cloud Hosting & Servers.</>}
        subtitle="Manage your CloudMonkey VPS instances, check status, and perform maintenance."
      />

      <div className="grid gap-6">
        {installCommand && (
          <Card className="border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                Agent installer
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => navigator.clipboard.writeText(installCommand)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block overflow-x-auto rounded-lg bg-[#070d23] p-4 text-xs text-white">{installCommand}</code>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!n8nConfig} onOpenChange={(open) => !open && setN8nConfig(null)}>
          <DialogContent className="rounded-lg">
            <DialogHeader>
              <DialogTitle>n8n integration</DialogTitle>
              <DialogDescription>Save server-side n8n API credentials for workflow sync.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (n8nConfig) n8nSaveMutation.mutate(n8nConfig);
              }}
            >
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  type="url"
                  value={n8nConfig?.baseUrl ?? ""}
                  onChange={(event) => setN8nConfig((current) => current ? { ...current, baseUrl: event.target.value } : current)}
                  placeholder="https://n8n.example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  value={n8nConfig?.apiKey ?? ""}
                  onChange={(event) => setN8nConfig((current) => current ? { ...current, apiKey: event.target.value } : current)}
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-lg bg-[var(--ai)]" disabled={n8nSaveMutation.isPending}>
                <KeyRound className="h-4 w-4" />
                Save credentials
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <Card className="border-border/70 bg-card/95 p-12 text-center shadow-sm">
             <RefreshCcw className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
             <div className="text-sm font-medium">Loading your cloud resources...</div>
          </Card>
        ) : !servers || servers.length === 0 ? (
          <Card className="border-border/70 bg-card/95 p-12 text-center shadow-sm">
             <div className="text-sm font-medium mb-2">No active servers found.</div>
             <p className="text-xs text-muted-foreground mb-6">Launch a new server from the marketplace to get started.</p>
             <Button variant="outline" className="rounded-xl">Browse Marketplace</Button>
          </Card>
        ) : (
          servers.map((srv: any) => (
            <Card key={srv.id} className="border-border/70 bg-card/95 shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-border/60">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#f1eafe] text-[#642ef0] flex items-center justify-center">
                        <Server className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#07102c]">{srv.label || "Untitled Instance"}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{srv.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full capitalize">
                        {srv.hostingMode ?? "private"} hosting
                      </Badge>
                      <Badge variant={srv.status === "active" ? "default" : "outline"} className="rounded-full">
                        {srv.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 gap-4 mt-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Main IP</div>
                      <div className="text-sm font-semibold">{srv.mainIp || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Region</div>
                      <div className="text-sm font-semibold flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {srv.region}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Operating System</div>
                      <div className="text-sm font-semibold">{srv.os}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Power Status</div>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${srv.powerStatus === "running" ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="text-sm font-semibold capitalize">{srv.powerStatus}</span>
                      </div>
                    </div>
                  </div>

                  <ServerTelemetry
                    srv={srv}
                    isAdmin={isAdmin}
                    onConfigureN8n={() => setN8nConfig({
                      instanceId: srv.id,
                      baseUrl: srv.n8nIntegration?.baseUrl ?? "",
                      apiKey: "",
                    })}
                    onSyncN8n={() => n8nSyncMutation.mutate(srv.id)}
                    n8nSyncPending={n8nSyncMutation.isPending}
                  />
                </div>

                <div className="w-full md:w-[320px] bg-muted/30 p-6 flex flex-col justify-between">
                  <div className="space-y-3 mb-6">
                     <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Zap className="h-3 w-3" /> Agent</span>
                        <span className="font-bold capitalize">{getAgentStatus(srv)}</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Cpu className="h-3 w-3" /> CPU</span>
                        <span className="font-bold">{srv.latestTelemetry?.cpuUsagePercent ?? "N/A"}%</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><MemoryStick className="h-3 w-3" /> RAM</span>
                        <span className="font-bold">{srv.latestTelemetry?.memoryUsedMb ?? "N/A"} / {srv.latestTelemetry?.memoryTotalMb ?? srv.ram} MB</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Database className="h-3 w-3" /> Storage</span>
                        <span className="font-bold">{srv.latestTelemetry?.diskUsedGb ?? "N/A"} / {srv.latestTelemetry?.diskTotalGb ?? srv.disk} GB</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldAlert className="h-3 w-3" /> Security</span>
                        <span className="font-bold">{srv.latestTelemetry?.securityScore ?? "N/A"}</span>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="flex-1 rounded-xl bg-[var(--ai)] shadow-sm">
                          <Zap className="h-4 w-4" />
                          Manage
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        <DropdownMenuLabel>Power Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => mutation.mutate({ instanceId: srv.id, action: "reboot" })}>
                          <RefreshCcw className="mr-2 h-4 w-4" /> Reboot
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mutation.mutate({ instanceId: srv.id, action: "stop" })}>
                          <Square className="mr-2 h-4 w-4" /> Stop
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mutation.mutate({ instanceId: srv.id, action: "start" })}>
                          <Play className="mr-2 h-4 w-4" /> Start
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Maintenance</DropdownMenuLabel>
                        <DropdownMenuItem className="text-red-600" onClick={() => mutation.mutate({ instanceId: srv.id, action: "reinstall" })}>
                          <RefreshCcw className="mr-2 h-4 w-4" /> Reinstall OS
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="icon" className="rounded-xl border-border/70 bg-card shadow-sm">
                      <LifeBuoy className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-border/70 bg-card shadow-sm"
                        onClick={() => enrollmentMutation.mutate(srv.id)}
                        disabled={enrollmentMutation.isPending}
                      >
                        Agent
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function getAgentStatus(srv: any) {
  if (!srv.agent) return "not enrolled";
  if (!srv.agent.lastSeenAt) return srv.agent.status;
  const ageMs = Date.now() - new Date(srv.agent.lastSeenAt).getTime();
  if (ageMs > 15 * 60 * 1000) return "stale";
  return srv.agent.status;
}

function ServerTelemetry({
  srv,
  isAdmin,
  onConfigureN8n,
  onSyncN8n,
  n8nSyncPending,
}: {
  srv: any;
  isAdmin: boolean;
  onConfigureN8n: () => void;
  onSyncN8n: () => void;
  n8nSyncPending: boolean;
}) {
  const websites = srv.websites ?? [];
  const containers = srv.containers ?? [];
  const databases = srv.databases ?? [];
  const findings = srv.securityFindings ?? [];
  const aiRuntimes = srv.aiRuntimes ?? [];
  const n8nIntegration = srv.n8nIntegration;
  const n8nWorkflows = srv.n8nWorkflows ?? [];

  if (!srv.agent) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        CloudMonkey agent is not enrolled on this server yet.
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <TelemetryPanel title="Websites" icon={Globe} empty="No websites detected.">
        {websites.map((site: any) => (
          <div key={site.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <a href={site.url} target="_blank" rel="noreferrer" className="font-semibold text-[#1381ee]">{site.domain}</a>
              <Badge variant={site.status === "online" ? "default" : "outline"}>{site.status}</Badge>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>HTTP: {site.httpStatus ?? "N/A"}</span>
              <span>SSL: {site.sslStatus ?? "N/A"}</span>
              <span>Issuer: {site.sslIssuer ?? "N/A"}</span>
              <span>Expires: {site.sslExpiresAt ? new Date(site.sslExpiresAt).toLocaleDateString() : "N/A"}</span>
              {site.redirectUrl && <span className="sm:col-span-2">Redirect: {site.redirectUrl}</span>}
              {site.sslHostnameMatches !== undefined && site.sslHostnameMatches !== null && (
                <span>Hostname: {site.sslHostnameMatches ? "matches" : "mismatch"}</span>
              )}
              {site.source && <span>Source: {site.source}</span>}
            </div>
          </div>
        ))}
      </TelemetryPanel>

      <TelemetryPanel title="Security" icon={ShieldAlert} empty="No security findings detected.">
        {findings.map((finding: any) => (
          <div key={finding.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{finding.title}</div>
              <Badge variant={finding.severity === "critical" || finding.severity === "high" ? "destructive" : "outline"}>{finding.severity}</Badge>
            </div>
            {isAdmin && <p className="mt-1 text-xs text-muted-foreground">{finding.detail}</p>}
          </div>
        ))}
      </TelemetryPanel>

      {isAdmin && (
        <>
          <TelemetryPanel title="Docker containers" icon={Server} empty="No containers detected.">
            {containers.map((container: any) => (
              <div key={container.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{container.name}</div>
                    <div className="text-xs text-muted-foreground">{container.image}</div>
                  </div>
                  <Badge variant={container.status === "running" ? "default" : "outline"}>{container.health || container.status}</Badge>
                </div>
              </div>
            ))}
          </TelemetryPanel>

          <TelemetryPanel title="Databases" icon={Database} empty="No database services detected.">
            {databases.map((database: any) => (
              <div key={database.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold capitalize">{database.engine}</div>
                    <div className="text-xs text-muted-foreground">{database.containerName || database.source}</div>
                  </div>
                  <Badge variant={database.isPublic ? "destructive" : "outline"}>{database.isPublic ? "public" : database.status}</Badge>
                </div>
              </div>
            ))}
          </TelemetryPanel>

          <TelemetryPanel title="Managed runtimes" icon={Bot} empty="No Hermes, OpenClaw, or n8n runtime detected.">
            {aiRuntimes.map((runtime: any) => (
              <div key={runtime.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{runtime.name}</div>
                    <div className="text-xs text-muted-foreground">{runtime.runtime} · {runtime.image || "unknown image"}</div>
                  </div>
                  <Badge variant={runtime.status === "running" ? "default" : "outline"}>{runtime.health || runtime.status}</Badge>
                </div>
              </div>
            ))}
          </TelemetryPanel>

          <TelemetryPanel title="n8n workflows" icon={Workflow} empty={n8nIntegration ? "No workflows synced yet." : "n8n API credentials are not configured."}>
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">n8n service</div>
                  <div className="text-xs text-muted-foreground">{n8nIntegration?.baseUrl ?? "Not configured"}</div>
                </div>
                <Badge variant={n8nIntegration?.status === "synced" ? "default" : n8nIntegration?.status === "error" ? "destructive" : "outline"}>
                  {n8nIntegration?.status ?? "missing"}
                </Badge>
              </div>
              {n8nIntegration?.lastError && <div className="mt-2 text-xs text-red-600">{n8nIntegration.lastError}</div>}
              {n8nIntegration?.lastSyncAt && <div className="mt-2 text-xs text-muted-foreground">Last sync: {new Date(n8nIntegration.lastSyncAt).toLocaleString()}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onConfigureN8n}>
                  <Settings className="h-3.5 w-3.5" />
                  Configure
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onSyncN8n} disabled={!n8nIntegration || n8nSyncPending}>
                  <RefreshCcw className={`h-3.5 w-3.5 ${n8nSyncPending ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              </div>
            </div>
            {n8nWorkflows.map((workflow: any) => (
              <div key={workflow.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{workflow.name}</div>
                    <div className="text-xs text-muted-foreground">{workflow.triggerSummary || "Manual or unknown trigger"}</div>
                  </div>
                  <Badge variant={workflow.active ? "default" : "outline"}>{workflow.active ? "active" : "inactive"}</Badge>
                </div>
              </div>
            ))}
          </TelemetryPanel>
        </>
      )}
    </div>
  );
}

function TelemetryPanel({ title, icon: Icon, empty, children }: { title: string; icon: typeof Server; empty: string; children: any }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="rounded-lg border border-border/60 bg-white/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 text-[var(--ai)]" />
        {title}
      </div>
      <div className="space-y-2">
        {hasRows ? children : <div className="text-xs text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}
