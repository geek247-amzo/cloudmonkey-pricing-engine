import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Database, Globe, RefreshCcw, Send, Server, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { extractAiResponseText } from "@/lib/ai-response";
import { formatDateUTC } from "@/lib/date-format";
import { z } from "zod";

const adminSearchSchema = z.object({
  tab: z.enum(["domains", "servers", "services", "agent"]).optional(),
});

export const Route = createFileRoute("/dashboard/administration")({
  validateSearch: (search) => adminSearchSchema.parse(search),
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
  const search = Route.useSearch();
  const [view, setView] = useState<"domains" | "servers" | "services" | "agent">(
    search.tab || "domains",
  );
  const [domainFilter, setDomainFilter] = useState("");
  const [serverFilter, setServerFilter] = useState("");

  useEffect(() => {
    if (search.tab) {
      setView(search.tab);
    }
  }, [search.tab]);

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
        <MetricCard
          label="CloudMonkey VPS servers"
          value={data?.servers?.length ?? 0}
          icon={Server}
        />
        <MetricCard
          label="CloudMonkey VPS services"
          value={data?.vultrPlans?.length ?? 0}
          icon={Database}
        />
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
          { value: "agent", label: "Admin Agent" },
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

          {view === "agent" && <AdminAgentConsole users={users} />}
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
  return value ? formatDateUTC(value) : "N/A";
}

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const parts = [];
  const lines = content.split("\n");
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const renderTextWithFormatting = (text: string) => {
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const codeRegex = /`([^`]+)`/g;
    let elements: React.ReactNode[] = [text];

    elements = elements.flatMap((el) => {
      if (typeof el !== "string") return el;
      const parts = [];
      let lastIdx = 0;
      let match;
      boldRegex.lastIndex = 0;
      while ((match = boldRegex.exec(el)) !== null) {
        if (match.index > lastIdx) {
          parts.push(el.substring(lastIdx, match.index));
        }
        parts.push(
          <strong key={`bold-${match.index}`} className="font-semibold text-foreground">
            {match[1]}
          </strong>,
        );
        lastIdx = boldRegex.lastIndex;
      }
      if (lastIdx < el.length) {
        parts.push(el.substring(lastIdx));
      }
      return parts;
    });

    elements = elements.flatMap((el) => {
      if (typeof el !== "string") return el;
      const parts = [];
      let lastIdx = 0;
      let match;
      codeRegex.lastIndex = 0;
      while ((match = codeRegex.exec(el)) !== null) {
        if (match.index > lastIdx) {
          parts.push(el.substring(lastIdx, match.index));
        }
        parts.push(
          <code
            key={`code-${match.index}`}
            className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono border border-border/40 text-[var(--ai)]"
          >
            {match[1]}
          </code>,
        );
        lastIdx = codeRegex.lastIndex;
      }
      if (lastIdx < el.length) {
        parts.push(el.substring(lastIdx));
      }
      return parts;
    });

    return elements;
  };

  const flushTable = (key: number) => {
    if (tableHeaders.length === 0 && tableRows.length === 0) return null;
    const tableEl = (
      <div
        key={`table-${key}`}
        className="my-3 overflow-x-auto rounded-lg border border-border bg-card shadow-sm max-w-full"
      >
        <table className="min-w-full divide-y divide-border text-xs">
          {tableHeaders.length > 0 && (
            <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-left">
              <tr>
                {tableHeaders.map((header, i) => (
                  <th key={i} className="px-4 py-2.5 border-r border-border/40 last:border-r-0">
                    {renderTextWithFormatting(header)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border/40 bg-white">
            {tableRows.map((row, i) => (
              <tr key={i} className="hover:bg-muted/20 transition-colors">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2.5 text-foreground font-medium border-r border-border/40 last:border-r-0 whitespace-nowrap"
                  >
                    {renderTextWithFormatting(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeaders = [];
    tableRows = [];
    return tableEl;
  };

  let keyCounter = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      inTable = true;
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.every((c) => c.match(/^:?-+:?$/))) {
        continue;
      }
      if (tableHeaders.length === 0 && tableRows.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
    } else {
      if (inTable) {
        const table = flushTable(keyCounter++);
        if (table) parts.push(table);
        inTable = false;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        parts.push(
          <div key={keyCounter++} className="flex gap-2 pl-4 py-0.5 leading-relaxed text-sm">
            <span className="text-[var(--ai)] mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--ai)] flex-shrink-0" />
            <div className="flex-1">{renderTextWithFormatting(line.substring(2))}</div>
          </div>,
        );
      } else if (line.startsWith("#")) {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2];
          const className =
            level === 1 ? "text-lg font-bold mt-4 mb-2" : "text-base font-semibold mt-3 mb-1.5";
          parts.push(
            <div key={keyCounter++} className={`${className} text-foreground`}>
              {renderTextWithFormatting(text)}
            </div>,
          );
        } else {
          parts.push(
            <div key={keyCounter++} className="py-0.5 leading-relaxed">
              {renderTextWithFormatting(line)}
            </div>,
          );
        }
      } else {
        if (line === "") {
          parts.push(<div key={keyCounter++} className="h-2" />);
        } else {
          parts.push(
            <div key={keyCounter++} className="py-0.5 leading-relaxed whitespace-pre-wrap">
              {renderTextWithFormatting(lines[i])}
            </div>,
          );
        }
      }
    }
  }

  if (inTable) {
    const table = flushTable(keyCounter++);
    if (table) parts.push(table);
  }

  return <div className="space-y-1">{parts}</div>;
};

function AdminAgentConsole({
  users,
}: {
  users: Array<{ id: string; name: string | null; email: string }>;
}) {
  const [messages, setMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; body: string; createdAt: string }>
  >([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [contextType, setContextType] = useState<string>("");
  const [contextId, setContextId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending]);

  // Load chat history
  useEffect(() => {
    async function loadHistory() {
      try {
        const url = sessionId
          ? `/api/admin/chat/history?sessionId=${sessionId}`
          : "/api/admin/chat/history";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load chat history");
        const data = await res.json();
        setSessionId(data.session.id);
        setMessages(data.history || []);
      } catch (err) {
        toast.error("Could not load chat history");
      }
    }
    loadHistory();
  }, [sessionId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const userMsg = {
      id: "temp-" + Date.now(),
      role: "user" as const,
      body: newMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const messageToSend = newMessage;
    setNewMessage("");
    setIsSending(true);

    try {
      const conversationHistory = messages
        .filter((m) => m.id !== userMsg.id)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.body }));

      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: messageToSend,
          contextType: contextType || undefined,
          contextId: contextId || undefined,
          conversationHistory,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMsg.id);
        return [...filtered, data.userMessage, data.botMessage];
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get agent response");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setNewMessage(messageToSend);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm flex flex-col h-[calc(100vh-350px)] min-h-[500px]">
      <CardHeader className="border-b border-border/50 py-3 px-4 flex flex-row items-center justify-between gap-3">
        <div className="flex flex-row items-center gap-3">
          <div className="bg-[var(--ai-soft)] text-[var(--ai)] p-2 rounded-lg">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Admin AI Copilot</CardTitle>
            <div className="text-xs text-muted-foreground">
              Linked to database and Vultr API. Manage servers, accounts, and queries.
            </div>
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          {users && users.length > 0 && (
            <select
              className="text-sm border rounded p-1 max-w-[200px]"
              value={contextId}
              onChange={(e) => {
                setContextType(e.target.value ? "user" : "");
                setContextId(e.target.value);
              }}
            >
              <option value="">-- No linked customer --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([]);
              setSessionId(null);
            }}
          >
            New Chat
          </Button>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Bot className="h-10 w-10 text-[var(--ai)] mb-3 animate-pulse" />
            <div className="font-semibold text-foreground text-sm">
              CloudMonkey Administrative Assistant
            </div>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Ask me to provision Vultr servers, update customer profile roles, sync website
              containers, or query direct SQL statistics.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === "user"
                  ? "bg-[var(--ai)] text-white rounded-br-none"
                  : "bg-muted text-foreground rounded-bl-none border border-border/40"
              }`}
            >
              <div className="leading-relaxed">
                <MarkdownRenderer
                  content={
                    msg.role === "assistant" ? extractAiResponseText(msg.body, msg.body) : msg.body
                  }
                />
              </div>
              <div
                className={`text-[10px] mt-1 ${
                  msg.role === "user" ? "text-white/60 text-right" : "text-muted-foreground"
                }`}
              >
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground max-w-[80%] rounded-2xl rounded-bl-none px-4 py-2.5 text-sm border border-border/40 flex items-center gap-1.5 shadow-sm">
              <span
                className="h-2 w-2 rounded-full bg-[var(--ai)] animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></span>
              <span
                className="h-2 w-2 rounded-full bg-[var(--ai)] animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></span>
              <span
                className="h-2 w-2 rounded-full bg-[var(--ai)] animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-border/50 p-3 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Command the panel (e.g. 'Show me the last 3 registered users' or 'Provision a server')..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isSending}
        />
        <Button
          type="submit"
          disabled={isSending || !newMessage.trim()}
          className="rounded-lg bg-[var(--ai)] hover:bg-[var(--ai)]/90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
