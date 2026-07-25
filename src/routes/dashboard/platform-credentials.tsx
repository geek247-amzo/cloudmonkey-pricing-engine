import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, RefreshCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/platform-credentials")({
  head: () => ({ meta: [{ title: "Platform API Keys - CloudMonkey Dashboard" }] }),
  component: PlatformCredentialsPage,
});

type Credential = {
  id: string;
  provider: string;
  label: string;
  keyLastFour: string;
  status: string;
  lastVerifiedAt: string | null;
  monthlySpendCap: number | null;
  monthlySpendMicrousd: number;
  runwayPercent: number | null;
  recentUsage: Array<{
    model: string;
    featureKey: string;
    chargedTokens: number;
    createdAt: string;
  }>;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}

function money(microusd: number) {
  return `$${(microusd / 1_000_000).toFixed(2)}`;
}

function PlatformCredentialsPage() {
  const { authReady, isAdmin } = useAdminAccess();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState("gemini");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [cap, setCap] = useState("");
  const query = useQuery({
    queryKey: ["admin", "platform-credentials"],
    queryFn: () => fetchJson<Credential[]>("/api/admin/platform-credentials"),
    enabled: authReady && isAdmin,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "platform-credentials"] });
  const add = useMutation({
    mutationFn: () =>
      fetchJson("/api/admin/platform-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          label,
          apiKey,
          monthlySpendCap: cap ? Math.round(Number(cap) * 1_000_000) : null,
        }),
      }),
    onSuccess: () => {
      toast.success("Platform key added");
      setApiKey("");
      setLabel("");
      setCap("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      action,
      replacement,
    }: {
      id: string;
      action: "verify" | "revoke" | "rotate";
      replacement?: string;
    }) =>
      fetchJson(
        `/api/admin/platform-credentials/${encodeURIComponent(id)}${action === "verify" ? "/verify" : ""}`,
        {
          method: action === "verify" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body:
            action === "revoke"
              ? JSON.stringify({ status: "revoked" })
              : action === "rotate"
                ? JSON.stringify({ apiKey: replacement })
                : undefined,
        },
      ),
    onSuccess: () => {
      toast.success("Credential updated");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;
  const credentials = query.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Provider API keys."
        subtitle="Manage CloudMonkey-owned pooled credentials and see real provider spend by key."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add credential
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="mailjet">Mailjet</option>
          </select>
          <Input
            placeholder="Label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Input
            type="password"
            placeholder={provider === "mailjet" ? "API key:secret" : "API key"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <Input
            type="number"
            placeholder="Monthly cap (USD)"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
          />
          <Button onClick={() => add.mutate()} disabled={add.isPending || !label || !apiKey}>
            <KeyRound className="mr-2 h-4 w-4" />
            Save key
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {credentials.map((credential) => (
          <Card key={credential.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <CardTitle className="capitalize">
                {credential.provider} · {credential.label}
              </CardTitle>
              <Badge variant={credential.status === "active" ? "default" : "destructive"}>
                {credential.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Key</span>
                <span>••••{credential.keyLastFour}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider spend this month</span>
                <span>{money(credential.monthlySpendMicrousd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cap runway</span>
                <span>
                  {credential.runwayPercent == null
                    ? "No cap"
                    : `${credential.runwayPercent}% remaining`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update.mutate({ id: credential.id, action: "verify" })}
                >
                  <RefreshCcw className="mr-2 h-3 w-3" />
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const replacement = window.prompt("Enter the replacement API key");
                    if (replacement)
                      update.mutate({ id: credential.id, action: "rotate", replacement });
                  }}
                >
                  Rotate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => update.mutate({ id: credential.id, action: "revoke" })}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Revoke
                </Button>
              </div>
              {credential.recentUsage.length > 0 ? (
                <div className="border-t pt-3">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <ShieldAlert className="h-4 w-4" />
                    Recent usage
                  </div>
                  {credential.recentUsage.slice(0, 4).map((item) => (
                    <div
                      className="flex justify-between text-xs text-muted-foreground"
                      key={`${item.featureKey}-${item.createdAt}`}
                    >
                      <span>
                        {item.featureKey} · {item.model}
                      </span>
                      <span>{item.chargedTokens} tokens</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No usage recorded yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {!query.isLoading && credentials.length === 0 && (
        <p className="text-sm text-muted-foreground">No platform credentials configured.</p>
      )}
    </div>
  );
}
