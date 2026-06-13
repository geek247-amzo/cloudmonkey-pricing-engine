import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Filter, ShieldCheck, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/activity-logs")({
  head: () => ({
    meta: [{ title: "Activity logs - CloudMonkey Dashboard" }],
  }),
  component: ActivityLogsPage,
});

function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activity logs"
        title={<>Audit trail.</>}
        subtitle="Inspect changes to authentication, billing, role assignments, and provider linking over time."
        actions={
          <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
            <Filter className="h-4 w-4" />
            Filter logs
          </Button>
        }
      />

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Latest events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["Google SSO linked", "alex@cloudmonkey.co.za", "2 minutes ago", "success"],
            ["Billing plan updated", "Admin console", "11 minutes ago", "info"],
            ["Role changed to Admin", "Mpho Dlamini", "1 hour ago", "review"],
            ["Session revoked", "Sophie Naidoo", "2 hours ago", "security"],
          ].map(([action, actor, time, level]) => (
            <div key={`${action}-${actor}`} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{action}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {actor} · {time}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={level === "security" ? "destructive" : level === "review" ? "secondary" : "default"}>
                  {level}
                </Badge>
                <Badge variant="outline">CloudMonkey</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--business-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">Audit-ready</div>
            <p className="mt-1 text-xs text-muted-foreground">Use this page to inspect sensitive admin operations.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Filter className="h-5 w-5 text-[var(--cloud)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">Filter by type</div>
            <p className="mt-1 text-xs text-muted-foreground">Add search, actor, and event type controls later.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Sparkles className="h-5 w-5 text-[var(--business)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">Nice shell</div>
            <p className="mt-1 text-xs text-muted-foreground">The visual structure already matches the rest of CloudMonkey.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
