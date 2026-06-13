import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Globe, Laptop, LogOut, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/sessions")({
  head: () => ({
    meta: [{ title: "Sessions - CloudMonkey Dashboard" }],
  }),
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sessions"
        title={<>Active sessions.</>}
        subtitle="Monitor sign-in sessions, device details, and provider source so you can revoke or review access quickly."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active sessions", value: "42", icon: Laptop },
          { label: "Geo locations", value: "9", icon: Globe },
          { label: "Needs review", value: "3", icon: ShieldCheck },
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
          <CardTitle>Session table</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { user: "Alex Johnson", device: "MacBook Pro", provider: "Google", region: "Cape Town, ZA", status: "Current" },
            { user: "Mpho Dlamini", device: "Windows 11", provider: "Office 365", region: "Johannesburg, ZA", status: "Trusted" },
            { user: "Sophie Naidoo", device: "iPhone", provider: "Email", region: "Durban, ZA", status: "Review" },
          ].map((session) => (
            <div key={`${session.user}-${session.device}`} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">{session.user}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {session.device} · {session.provider} · {session.region}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={session.status === "Review" ? "secondary" : "default"}>{session.status}</Badge>
                <Button variant="outline" size="sm" className="rounded-xl border-border/70 bg-card shadow-sm">
                  <LogOut className="h-4 w-4" />
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--business-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Session controls</div>
            <p className="mt-1 text-sm text-muted-foreground">Use this area for force logout, device review, and admin session tracking.</p>
          </div>
          <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
            Review policy
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
