import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "CloudMonkey service status" }] }),
  component: StatusPage,
});

type Incident = { id: string; title: string; summary: string; body: string; severity: string; status: string; updatedAt: string; updates?: { status: string; body: string; createdAt: string }[] };

function StatusPage() {
  const { data: session } = authClient.useSession();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const { data, isLoading } = useQuery<{ incidents: Incident[]; stats: { active: number; resolved: number; services: number } }>({ queryKey: ["public", "status"], queryFn: async () => { const response = await fetch("/api/public/status"); if (!response.ok) throw new Error("Could not load status"); return response.json(); }, refetchInterval: 60_000 });
  const reportIssue = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/status-issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, description, priority: "medium", category: "service_status" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not submit issue");
      return result;
    },
    onSuccess: () => { setSubject(""); setDescription(""); toast.success("Issue sent to the CloudMonkey helpdesk"); },
    onError: (error) => toast.error(error.message),
  });
  const active = data?.incidents.filter((incident) => incident.status !== "resolved") ?? [];
  return <main className="min-h-screen bg-[#070d23] px-5 py-12 text-white sm:px-10"><div className="mx-auto max-w-4xl"><div className="flex flex-wrap items-center justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a895ff]">CloudMonkey</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight">Service status</h1><p className="mt-3 text-white/60">Operational updates, incident history and service health.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-4 text-right"><div className="text-xs uppercase tracking-wider text-white/50">Current status</div><div className="mt-1 flex items-center gap-2 font-semibold">{active.length ? <><ShieldAlert className="h-4 w-4 text-amber-300" />Service updates</> : <><CheckCircle2 className="h-4 w-4 text-emerald-300" />All systems operational</>}</div></div></div>
    <div className="mt-10 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[.06] p-5"><div className="text-sm text-white/55">Active incidents</div><div className="mt-2 text-3xl font-bold">{data?.stats.active ?? 0}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.06] p-5"><div className="text-sm text-white/55">Resolved incidents</div><div className="mt-2 text-3xl font-bold">{data?.stats.resolved ?? 0}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.06] p-5"><div className="text-sm text-white/55">Affected services</div><div className="mt-2 text-3xl font-bold">{data?.stats.services ?? 0}</div></div></div>
    {session?.user ? <form className="mt-8 rounded-2xl border border-[#a895ff]/25 bg-[#a895ff]/10 p-6" onSubmit={(event) => { event.preventDefault(); reportIssue.mutate(); }}><h2 className="text-xl font-bold">Can’t see your issue?</h2><p className="mt-2 text-sm text-white/60">Send a support request directly from the status page and we’ll add it to the helpdesk.</p><div className="mt-4 grid gap-3"><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What is not working?" required className="border-white/15 bg-white/10 text-white placeholder:text-white/40" /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you are seeing, including the service or domain affected." required rows={4} className="border-white/15 bg-white/10 text-white placeholder:text-white/40" /><div className="flex justify-end"><Button disabled={reportIssue.isPending}>{reportIssue.isPending ? "Sending…" : "Report issue"}</Button></div></div></form> : <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-5 text-sm text-white/60">Have an issue that is not listed? Sign in to your CloudMonkey account to report it directly to the helpdesk.</div>}
    <section className="mt-10 space-y-4">{isLoading ? <div className="text-white/60">Loading service history…</div> : !data?.incidents.length ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-emerald-100">No service incidents have been reported.</div> : data.incidents.map((incident) => <article id={incident.id} key={incident.id} className="rounded-2xl border border-white/10 bg-white/[.06] p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{incident.title}</h2><p className="mt-2 text-white/65">{incident.summary}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${incident.status === "resolved" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{incident.status}</span></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/70">{incident.body}</p><div className="mt-5 space-y-3 border-t border-white/10 pt-4">{(incident.updates ?? []).map((update) => <div key={`${update.createdAt}-${update.body}`} className="flex gap-3 text-sm"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#a895ff]" /><div><div className="font-semibold text-white/85">{update.status}</div><div className="mt-1 text-white/55">{update.body}</div><div className="mt-1 text-xs text-white/35">{new Date(update.createdAt).toLocaleString()}</div></div></div>)}</div></article>)}</section></div></main>;
}
