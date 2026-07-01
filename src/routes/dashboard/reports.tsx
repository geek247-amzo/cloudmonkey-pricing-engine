import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bot, FileText, Globe, LifeBuoy, Server, UsersRound } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHydratedSession } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/reports")({
  head: () => ({
    meta: [{ title: "Reports - CloudMonkey Dashboard" }],
  }),
  component: ReportsPage,
});

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function ReportsPage() {
  const { data: session, authReady } = useHydratedSession();
  const isAdmin = authReady && (session?.user?.role === "admin" || session?.user?.role === "owner");
  const dashboardReady = authReady;

  const [users, subscriptions, tickets, agents, domains, servers, websites, logs] = useQueries({
    queries: [
      { queryKey: ["admin", "users"], queryFn: () => fetchJson("/api/admin/users"), enabled: isAdmin },
      { queryKey: [isAdmin ? "admin" : "user", "subscriptions"], queryFn: () => fetchJson(isAdmin ? "/api/admin/subscriptions" : "/api/user/subscription"), enabled: dashboardReady },
      { queryKey: [isAdmin ? "admin" : "user", "tickets"], queryFn: () => fetchJson(isAdmin ? "/api/admin/tickets" : "/api/user/tickets"), enabled: dashboardReady },
      { queryKey: [isAdmin ? "admin" : "user", "agents"], queryFn: () => fetchJson(isAdmin ? "/api/admin/agents" : "/api/user/agents"), enabled: dashboardReady },
      { queryKey: ["user", "domains"], queryFn: () => fetchJson("/api/user/domains"), enabled: dashboardReady },
      { queryKey: ["user", "vultr"], queryFn: () => fetchJson("/api/user/vultr"), enabled: dashboardReady },
      { queryKey: ["user", "websites"], queryFn: () => fetchJson("/api/user/websites"), enabled: dashboardReady },
      { queryKey: ["admin", "audit-logs"], queryFn: () => fetchJson("/api/admin/audit-logs"), enabled: isAdmin },
    ],
  });

  const subscriptionRows = Array.isArray(subscriptions.data) ? subscriptions.data : subscriptions.data ? [subscriptions.data] : [];
  const ticketRows = tickets.data ?? [];
  const monthlyRevenue = subscriptionRows
    .filter((item: any) => item.status === "active" || item.status === "trialing")
    .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

  const cards = [
    { label: isAdmin ? "Users" : "Workspace users", value: isAdmin ? users.data?.length ?? 0 : 1, icon: UsersRound },
    { label: "Active subscriptions", value: subscriptionRows.filter((item: any) => item.status === "active" || item.status === "trialing").length, icon: FileText },
    { label: "Monthly recurring", value: `R ${(monthlyRevenue / 100).toFixed(2)}`, icon: BarChart3 },
    { label: "Open tickets", value: ticketRows.filter((item: any) => !["resolved", "closed"].includes(item.status)).length, icon: LifeBuoy },
    { label: "Agents", value: agents.data?.length ?? 0, icon: Bot },
    { label: "Domains", value: domains.data?.length ?? 0, icon: Globe },
    { label: "Servers", value: servers.data?.length ?? 0, icon: Server },
    { label: "Websites", value: websites.data?.length ?? 0, icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title={<>Operational reports.</>}
        subtitle={isAdmin ? "Live platform counts from subscriptions, support, infrastructure, users, agents, and audit activity." : "Live workspace counts from your subscriptions, support, infrastructure, agents, and websites."}
        actions={isAdmin ? (
          <Button asChild className="rounded-lg bg-[var(--ai)]">
            <Link to="/dashboard/activity-logs">
              Open logs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.label} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-2xl font-bold text-foreground">{item.value}</div>
                </div>
                <item.icon className="h-5 w-5 text-[var(--ai)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Recent audit activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!logs.data?.length ? (
              <div className="text-sm text-muted-foreground">No audit records available.</div>
            ) : logs.data.slice(0, 8).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                <span className="font-medium text-foreground">{item.message}</span>
                <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
