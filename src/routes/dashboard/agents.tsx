import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/agents")({
  head: () => ({
    meta: [{ title: "AI Agents - CloudMonkey Dashboard" }],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [model, setModel] = useState("");

  const { data: agents, isLoading } = useQuery({
    queryKey: [isAdmin ? "admin" : "user", "agents"],
    queryFn: async () => {
      const res = await fetch(isAdmin ? "/api/admin/agents" : "/api/user/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(isAdmin ? "/api/admin/agents" : "/api/user/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user?.id,
          name,
          purpose,
          model: model || null,
          status: "draft",
          provider: "openrouter",
        }),
      });
      if (!res.ok) throw new Error("Failed to create agent");
      return res.json();
    },
    onSuccess: () => {
      setName("");
      setPurpose("");
      setModel("");
      toast.success("Agent added");
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "agents"] });
    },
    onError: () => toast.error("Could not add agent"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Intelligence"
        title={<>AI agents.</>}
        subtitle="Track assigned agents, ownership, model configuration, and operating status."
      />

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Add agent</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[1fr_1.5fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} required className="min-h-9" />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={model} onChange={(event) => setModel(event.target.value)} />
            </div>
            <Button type="submit" className="self-end rounded-lg bg-[var(--ai)]" disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {isLoading ? (
          <Card className="rounded-lg border-[#dfe4ef] bg-white p-12 text-center shadow-sm xl:col-span-3">
            <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Loading agents...</div>
          </Card>
        ) : !agents?.length ? (
          <Card className="rounded-lg border-dashed border-[#dfe4ef] bg-transparent p-12 text-center xl:col-span-3">
            <div className="text-sm font-medium text-muted-foreground">No agents have been added yet.</div>
          </Card>
        ) : agents.map((agent: any) => (
          <Card key={agent.id} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-3 text-base">
                <span className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-[var(--ai)]" />
                  {agent.name}
                </span>
                <span className="flex flex-wrap justify-end gap-2">
                  {agent.isDiscovered && <Badge variant="secondary">Detected runtime</Badge>}
                  <Badge variant={agent.status === "active" ? "default" : "outline"}>{agent.status}</Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{agent.purpose}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Provider</div>
                  <div className="mt-1 font-medium">{agent.provider}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Model</div>
                  <div className="mt-1 font-medium">{agent.model || "Not set"}</div>
                </div>
              </div>
              {agent.detectedRuntime?.instanceId && (
                <div className="text-xs text-muted-foreground">
                  Server: {agent.detectedRuntime.instance?.label || agent.detectedRuntime.instanceId}
                </div>
              )}
              {agent.detectedRuntime && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#dfe4ef] p-3 text-xs">
                  <div>
                    <div className="uppercase tracking-[0.16em] text-muted-foreground">Container</div>
                    <div className="mt-1 font-medium">{agent.detectedRuntime.name}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-[0.16em] text-muted-foreground">Health</div>
                    <div className="mt-1 font-medium">{agent.detectedRuntime.health || agent.detectedRuntime.status}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="uppercase tracking-[0.16em] text-muted-foreground">Image</div>
                    <div className="mt-1 break-all font-medium">{agent.detectedRuntime.image || "Unknown"}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="uppercase tracking-[0.16em] text-muted-foreground">Ports</div>
                    <div className="mt-1 break-all font-medium">{formatPorts(agent.detectedRuntime.ports)}</div>
                  </div>
                </div>
              )}
              {agent.user?.email && <div className="text-xs text-muted-foreground">Owner: {agent.user.email}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatPorts(value: string | null | undefined) {
  if (!value) return "Not exposed";
  try {
    const ports = JSON.parse(value);
    if (!Array.isArray(ports) || ports.length === 0) return "Not exposed";
    return ports.map((port: any) => port.PublicPort ? `${port.PublicPort}:${port.PrivatePort}/${port.Type ?? "tcp"}` : `${port.PrivatePort}/${port.Type ?? "tcp"}`).join(", ");
  } catch {
    return value;
  }
}
