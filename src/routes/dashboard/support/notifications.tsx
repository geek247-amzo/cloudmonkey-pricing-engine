import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CheckCircle2, Plus, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/support/notifications")({
  head: () => ({ meta: [{ title: "Service notifications - CloudMonkey" }] }),
  component: ServiceNotificationsPage,
});

type Incident = { id: string; title: string; summary: string; body: string; severity: string; status: string; audience: { groups?: string[] }; updatedAt: string; updates?: { body: string; status: string; createdAt: string }[] };
const groups = [
  ["all", "All customers"],
  ["hosting", "Hosting / Cloud"],
  ["websites", "Websites / SEO"],
  ["ecommerce", "Ecommerce"],
  ["domains", "Domains"],
  ["ai", "AI services"],
] as const;

function ServiceNotificationsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(["all"]);
  const [serviceText, setServiceText] = useState("CloudMonkey platform");
  const [updateBody, setUpdateBody] = useState<Record<string, string>>({});
  const [updateStatus, setUpdateStatus] = useState<Record<string, string>>({});
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ["admin", "service-incidents"],
    queryFn: async () => {
      const response = await fetch("/api/admin/service-incidents");
      if (!response.ok) throw new Error("Could not load service notifications");
      return response.json();
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/service-incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, summary, body, severity, affectedServices: serviceText.split(",").map((item) => item.trim()).filter(Boolean), audience: { groups: selectedGroups, userIds: [] } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not publish notification");
      return result;
    },
    onSuccess: () => { setTitle(""); setSummary(""); setBody(""); setSelectedGroups(["all"]); toast.success("Status notification published"); queryClient.invalidateQueries({ queryKey: ["admin", "service-incidents"] }); },
    onError: (error) => toast.error(error.message),
  });
  const postUpdate = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await fetch(`/api/admin/service-incidents/${id}/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: updateStatus[id] ?? "monitoring", body: updateBody[id] ?? "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not post update");
      return result;
    },
    onSuccess: (_, variables) => { setUpdateBody((current) => ({ ...current, [variables.id]: "" })); toast.success("Status update posted"); queryClient.invalidateQueries({ queryKey: ["admin", "service-incidents"] }); },
    onError: (error) => toast.error(error.message),
  });
  const toggleGroup = (value: string) => setSelectedGroups((current) => value === "all" ? ["all"] : current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== "all"), value]);

  return <div className="space-y-6">
    <PageHeader eyebrow="Helpdesk" title="Service notifications" subtitle="Publish transparent outage updates, target only affected customers, and keep a public service-status record." />
    <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Active incidents</div><div className="mt-2 text-3xl font-bold">{incidents.filter((item) => item.status !== "resolved").length}</div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Resolved incidents</div><div className="mt-2 text-3xl font-bold">{incidents.filter((item) => item.status === "resolved").length}</div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Public status page</div><a className="mt-2 block font-semibold text-[var(--ai)]" href="/status" target="_blank" rel="noreferrer">cloudmonkey.co.za/status</a></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Publish an outage or service notice</CardTitle><p className="text-sm text-muted-foreground">Progress updates create in-app notifications. Only the resolved update sends closure email.</p></CardHeader><CardContent><form className="grid gap-4 lg:grid-cols-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="API service interruption" required /></div>
      <div className="space-y-2"><Label>Severity</Label><select value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></div>
      <div className="space-y-2"><Label>Customer-facing summary</Label><Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Some customers may experience delays." required /></div>
      <div className="space-y-2"><Label>Affected services</Label><Input value={serviceText} onChange={(event) => setServiceText(event.target.value)} placeholder="Hosting, Support chat" /></div>
      <div className="space-y-2 lg:col-span-2"><Label>Details</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What happened, what we are doing, and what customers should expect." rows={4} required /></div>
      <div className="space-y-2 lg:col-span-2"><Label>Notify customer groups</Label><div className="flex flex-wrap gap-2">{groups.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm"><input type="checkbox" checked={selectedGroups.includes(value)} onChange={() => toggleGroup(value)} />{label}</label>)}</div></div>
      <div className="flex justify-end lg:col-span-2"><Button disabled={create.isPending}><Send className="h-4 w-4" />Publish notice</Button></div>
    </form></CardContent></Card>
    <div className="space-y-4">{incidents.map((incident) => <Card key={incident.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{incident.status === "resolved" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}{incident.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{incident.summary}</p></div><div className="flex gap-2"><Badge>{incident.severity}</Badge><Badge variant={incident.status === "resolved" ? "secondary" : "outline"}>{incident.status}</Badge></div></div></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{incident.body}</p><div className="text-xs text-muted-foreground">Audience: {(incident.audience?.groups ?? []).join(", ")}</div><div className="rounded-lg border bg-muted/20 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4" />Post progress update</div><div className="grid gap-2 md:grid-cols-[160px_1fr_auto]"><select value={updateStatus[incident.id] ?? "monitoring"} onChange={(event) => setUpdateStatus((current) => ({ ...current, [incident.id]: event.target.value }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="identified">Identified</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select><Input value={updateBody[incident.id] ?? ""} onChange={(event) => setUpdateBody((current) => ({ ...current, [incident.id]: event.target.value }))} placeholder="What changed?" /><Button disabled={!updateBody[incident.id]?.trim() || postUpdate.isPending} onClick={() => postUpdate.mutate({ id: incident.id })}>Post update</Button></div></div></CardContent></Card>)}</div>
  </div>;
}
