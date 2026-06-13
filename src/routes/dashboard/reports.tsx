import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, FileText, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/reports")({
  head: () => ({
    meta: [{ title: "Reports - CloudMonkey Dashboard" }],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title={<>Operational reports.</>}
        subtitle="Track adoption, billing, and authentication trends with simple admin-friendly reporting cards."
        actions={
          <Button asChild className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
            <Link to="/dashboard/activity-logs">
              Open logs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Growth", value: "+18%", icon: TrendingUp, accent: "var(--cloud)" },
          { label: "Billing collection", value: "98%", icon: BarChart3, accent: "var(--business)" },
          { label: "Auth success", value: "99.2%", icon: FileText, accent: "var(--ai)" },
        ].map((item) => (
          <Card key={item.label} className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.value}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${item.accent} 14%, transparent)`, color: item.accent }}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Report catalog</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Usage summary", "Monthly adoption and seat growth."],
            ["Billing overview", "Plan changes and invoice status."],
            ["Authentication health", "Provider success and failed logins."],
            ["Security posture", "Risk, sessions, and policy checks."],
            ["Support activity", "Ticket handling and response time."],
            ["Product signals", "Feature usage and behavior trends."],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="text-sm font-semibold text-foreground">{title}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              <Badge variant="outline" className="mt-3 rounded-full">Ready</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
