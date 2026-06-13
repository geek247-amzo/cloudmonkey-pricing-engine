import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LifeBuoy, MessageSquareWarning, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/support")({
  head: () => ({
    meta: [{ title: "Support - CloudMonkey Dashboard" }],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title={<>Support queue.</>}
        subtitle="Review open tickets, prioritize backend issues, and open detailed customer or admin cases."
        actions={
          <Button asChild className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
            <Link to="/dashboard/support/ticket-2048">
              Open ticket
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Open tickets", value: "12", icon: LifeBuoy },
          { label: "Escalations", value: "3", icon: MessageSquareWarning },
          { label: "SLA met", value: "97%", icon: Sparkles },
        ].map((item) => (
          <Card key={item.label} className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.value}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { title: "Office 365 consent failed", priority: "High", status: "Open" },
            { title: "Billing invoice correction", priority: "Medium", status: "Pending" },
            { title: "SSO link request", priority: "Low", status: "Resolved" },
          ].map((ticket) => (
            <div key={ticket.title} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">{ticket.title}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge>{ticket.priority}</Badge>
                  <Badge variant={ticket.status === "Resolved" ? "secondary" : "outline"}>{ticket.status}</Badge>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-xl border-border/70 bg-card shadow-sm">
                <Link to="/dashboard/support/ticket-2048">View</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--primary-glow),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Backend support detail views</div>
            <p className="mt-1 text-sm text-muted-foreground">Use dedicated routes for deep ticket inspection and admin notes.</p>
          </div>
          <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
            Review support policy
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
