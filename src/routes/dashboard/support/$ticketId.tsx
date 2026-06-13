import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, MessageSquareText, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/support/$ticketId")({
  head: () => ({
    meta: [{ title: "Support ticket - CloudMonkey Dashboard" }],
  }),
  component: TicketDetailPage,
});

function TicketDetailPage() {
  const { ticketId } = Route.useParams();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support detail"
        title={<>Ticket {ticketId}</>}
        subtitle="Inspect the individual case, notes, and backend actions taken to resolve it."
        actions={
          <Button asChild className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
            <Link to="/dashboard/support">
              Back to support
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Case details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="text-sm font-semibold text-foreground">Office 365 consent failed</div>
              <p className="mt-2 text-sm text-muted-foreground">The tenant did not return the required permission grant during sign in.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Priority</div>
                <div className="mt-2 text-sm font-semibold text-foreground">High</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</div>
                <div className="mt-2 text-sm font-semibold text-foreground">Open</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Ticket opened by support user",
              "SSO error reproduced in staging",
              "Tenant consent re-request scheduled",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
                <Clock3 className="mt-0.5 h-5 w-5 text-[var(--ai)]" />
                <div className="text-sm text-muted-foreground">{item}</div>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
                <MessageSquareText className="h-4 w-4" />
                Add note
              </Button>
              <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                Escalate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--business-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Detail view scaffold</div>
            <p className="mt-1 text-sm text-muted-foreground">This page can evolve into a full ticket workspace with notes and internal actions.</p>
          </div>
          <Badge variant="secondary" className="bg-[var(--ai-soft)] text-[var(--ai)]">Dynamic route</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
