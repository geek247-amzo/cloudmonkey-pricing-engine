import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/website-growth")({
  head: () => ({ meta: [{ title: "Website Growth Agents - CloudMonkey Admin" }] }),
  component: WebsiteGrowthAdminPage,
});

function WebsiteGrowthAdminPage() {
  const { isAdmin, authReady } = useAdminAccess();
  const query = useQuery({
    queryKey: ["admin", "website-growth"],
    queryFn: async () => {
      const response = await fetch("/api/admin/website-growth");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load growth agents");
      return data as { agents: Array<{ id: string; websiteId: string; userId: string; status: string; nextRunAt: string; kpi: string; lastRunAt?: string | null }> };
    },
    enabled: authReady && isAdmin,
  });
  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;
  return <div className="space-y-6"><PageHeader eyebrow="Autonomous growth" title="Website growth agents." subtitle="Observe customer-owned approval workflows, schedules, and Codex runs." /><Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Active pilots</CardTitle></CardHeader><CardContent className="space-y-3">{query.data?.agents?.length ? query.data.agents.map((agent) => <div key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><div className="font-semibold">Website {agent.websiteId}</div><div className="text-sm text-muted-foreground">Customer {agent.userId} · {agent.kpi} · next run {new Date(agent.nextRunAt).toLocaleString()}</div></div><div className="flex items-center gap-2"><Badge variant="outline">{agent.status}</Badge><Button asChild size="sm" variant="outline"><Link to="/dashboard/websites/$websiteId/growth" params={{ websiteId: agent.websiteId }}>Open workspace <ExternalLink className="ml-1 h-3 w-3" /></Link></Button></div></div>) : <p className="text-sm text-muted-foreground">No growth agents are active.</p>}</CardContent></Card></div>;
}
