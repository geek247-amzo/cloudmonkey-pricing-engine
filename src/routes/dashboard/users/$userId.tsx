import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mail, ShieldCheck, UserRound } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/users/$userId")({
  head: () => ({
    meta: [{ title: "User detail - CloudMonkey Dashboard" }],
  }),
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User detail"
        title={<>Profile: {userId}</>}
        subtitle="Inspect account identity, provider links, permissions, and recent security activity."
        actions={
          <Button asChild className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
            <Link to="/dashboard/users">
              Back to users
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Identity summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">Alex Johnson</div>
                <p className="text-sm text-muted-foreground">alex@cloudmonkey.co.za</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Role", "Owner"],
                ["Provider", "Google"],
                ["Status", "Active"],
                ["MFA", "Enabled"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                  <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Recent access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Signed in with Google on MacBook Pro",
              "Linked Office 365 account",
              "Approved backend admin access",
            ].map((event) => (
              <div key={event} className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                {event}
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                Revoke sessions
              </Button>
              <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
                <Mail className="h-4 w-4" />
                Send reminder
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--cloud-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Detail view scaffold</div>
            <p className="mt-1 text-sm text-muted-foreground">Use this page later for permissions, audit history, and account actions.</p>
          </div>
          <Badge variant="secondary" className="bg-[var(--ai-soft)] text-[var(--ai)]">Dynamic route</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
