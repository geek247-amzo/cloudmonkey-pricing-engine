import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Clock3, Loader2, MessageSquare, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/websites/$websiteId/growth")({
  head: () => ({ meta: [{ title: "Website Growth Agent - CloudMonkey" }] }),
  component: WebsiteGrowthPage,
});

type Workspace = {
  active: boolean;
  agent?: { id: string; status: string; nextRunAt: string; kpi: string; schedule: string };
  messages?: Array<{ id: string; senderRole: string; body: string; createdAt: string }>;
  proposals?: Array<{ id: string; title: string; summary: string; diffJson: string; status: string; createdAt: string }>;
  runs?: Array<{ id: string; status: string; model?: string; totalTokens: number; usageAvailable: boolean; completedAt?: string | null; error?: string | null }>;
  usage?: Array<{ inputTokens: number; outputTokens: number; providerCostMicrousd: number; createdAt: string; model: string }>;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "Request failed");
  return data as T;
}

function WebsiteGrowthPage() {
  const { websiteId } = Route.useParams();
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminAccess();
  const [message, setMessage] = useState("");
  const workspace = useQuery({
    queryKey: ["website-growth", websiteId],
    queryFn: () => requestJson<Workspace>(isAdmin ? `/api/admin/website-growth/${encodeURIComponent(websiteId)}` : `/api/user/websites/${encodeURIComponent(websiteId)}/growth`),
    refetchInterval: 30_000,
  });
  const activate = useMutation({
    mutationFn: () => requestJson(`/api/user/websites/${encodeURIComponent(websiteId)}/growth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["website-growth", websiteId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const send = useMutation({
    mutationFn: () => requestJson(`/api/user/websites/${encodeURIComponent(websiteId)}/growth/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: message }) }),
    onSuccess: () => { setMessage(""); queryClient.invalidateQueries({ queryKey: ["website-growth", websiteId] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const decide = useMutation({
    mutationFn: ({ proposalId, decision }: { proposalId: string; decision: string }) => requestJson(`/api/user/websites/${encodeURIComponent(websiteId)}/growth/proposals/${encodeURIComponent(proposalId)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["website-growth", websiteId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const toggleStatus = useMutation({
    mutationFn: () => requestJson(`/api/user/websites/${encodeURIComponent(websiteId)}/growth/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: workspace.data?.agent?.status === "paused" ? "active" : "paused" }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["website-growth", websiteId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (workspace.isLoading) return <div className="p-8 text-center">Loading growth workspace...</div>;
  if (workspace.isError) return <div className="p-8 text-center text-red-600">{(workspace.error as Error).message}</div>;
  const data = workspace.data;
  if (!data?.active) {
    return <div className="space-y-6"><PageHeader eyebrow="Organic growth" title="A measured growth partner for your website." subtitle="CloudMonkey will review search visibility and conversion opportunities daily, then ask for your approval before changing the live site." /><Card><CardContent className="space-y-4 p-6"><p className="text-sm text-muted-foreground">This sponsored pilot uses Google Search Console and Google Analytics when connected. The primary goal is qualified leads.</p><Button onClick={() => activate.mutate()} disabled={activate.isPending}>{activate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start website growth pilot</Button></CardContent></Card></div>;
  }
  const usage = data.usage ?? [];
  const totalInput = usage.reduce((sum, row) => sum + Number(row.inputTokens || 0), 0);
  const totalOutput = usage.reduce((sum, row) => sum + Number(row.outputTokens || 0), 0);
  return <div className="space-y-6">
    <PageHeader eyebrow="Organic growth agent" title="Your website growth workspace." subtitle="Daily analysis, proposals, approvals, and transparent CloudMonkey-sponsored usage." actions={<div className="flex items-center gap-2"><Badge className={data.agent?.status === "paused" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}><Bot className="mr-1 h-3 w-3" /> {data.agent?.status ?? "active"}</Badge>{!isAdmin && <Button variant="outline" size="sm" onClick={() => toggleStatus.mutate()} disabled={toggleStatus.isPending}>{data.agent?.status === "paused" ? "Resume" : "Pause"}</Button>}</div>} />
    <div className="grid gap-4 md:grid-cols-4"><Metric label="Primary KPI" value="Qualified leads" /><Metric label="Schedule" value="Daily" /><Metric label="Input tokens" value={totalInput.toLocaleString()} /><Metric label="Output tokens" value={totalOutput.toLocaleString()} /></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Communications</CardTitle></CardHeader><CardContent className="space-y-4"><div className="max-h-[520px] space-y-3 overflow-auto">{data.messages?.length ? data.messages.map((item) => <div key={item.id} className={`rounded-lg border p-3 text-sm ${item.senderRole === "customer" ? "ml-8 bg-[#f5f1ff]" : "mr-8 bg-slate-50"}`}><div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span className="font-semibold capitalize">{item.senderRole}</span><span>{new Date(item.createdAt).toLocaleString()}</span></div><div className="whitespace-pre-wrap">{item.body}</div></div>) : <p className="text-sm text-muted-foreground">No messages yet. The agent will ask questions here when it needs a decision.</p>}</div>{!isAdmin && <div className="flex gap-2"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask the growth agent a question..." rows={3} /><Button className="self-end" onClick={() => send.mutate()} disabled={!message.trim() || send.isPending}>{send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>}</CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Approvals</CardTitle></CardHeader><CardContent className="space-y-4">{data.proposals?.filter((item) => item.status === "pending").length ? data.proposals.filter((item) => item.status === "pending").map((proposal) => <div key={proposal.id} className="space-y-3 rounded-lg border p-4"><div className="font-semibold">{proposal.title}</div><p className="text-sm text-muted-foreground">{proposal.summary}</p>{!isAdmin && <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => decide.mutate({ proposalId: proposal.id, decision: "approve" })}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => decide.mutate({ proposalId: proposal.id, decision: "request_changes" })}>Request changes</Button><Button size="sm" variant="ghost" className="text-red-600" onClick={() => decide.mutate({ proposalId: proposal.id, decision: "reject" })}><X className="mr-1 h-4 w-4" />Reject</Button></div>}</div>) : <p className="text-sm text-muted-foreground">No proposals waiting for approval.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Run history</CardTitle></CardHeader><CardContent className="space-y-3">{data.runs?.slice(0, 8).map((run) => <div key={run.id} className="flex items-center justify-between gap-3 text-sm"><div><div className="font-medium capitalize">{run.status}</div><div className="text-xs text-muted-foreground">{run.model ?? "Codex CLI"} · {run.usageAvailable ? `${run.totalTokens.toLocaleString()} tokens` : "usage unavailable"}</div></div><Badge variant="outline">{run.completedAt ? new Date(run.completedAt).toLocaleDateString() : "Queued"}</Badge></div>)}</CardContent></Card><p className="text-xs text-muted-foreground">Usage is CloudMonkey-sponsored for this pilot. Token counts are shown from the executor’s returned telemetry; unavailable telemetry is never guessed.</p></div>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-lg font-extrabold text-[#07102c]">{value}</div></CardContent></Card>;
}
