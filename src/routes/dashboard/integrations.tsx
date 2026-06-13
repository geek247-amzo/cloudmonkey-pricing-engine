import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Mail, PlugZap, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/integrations")({
  head: () => ({
    meta: [{ title: "Integrations - CloudMonkey Dashboard" }],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title={<>Connected services.</>}
        subtitle="Manage identity providers, mail routing, webhooks, and automation hooks from a single console."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { name: "Google Workspace", status: "Connected", desc: "SSO, directory sync, and mail routing ready.", accent: "var(--cloud)" },
          { name: "Office 365", status: "Connected", desc: "Tenant access is enabled for business identities.", accent: "var(--business)" },
          { name: "Email provider", status: "Configured", desc: "Transactional and recovery email delivery.", accent: "var(--ai)" },
          { name: "Webhooks", status: "Pending", desc: "Route backend events to external systems.", accent: "var(--primary)" },
        ].map((item) => (
          <Card key={item.name} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                {item.name}
                <Badge variant={item.status === "Connected" ? "default" : "secondary"}>{item.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${item.accent} 14%, transparent)`, color: item.accent }}>
                  <PlugZap className="h-5 w-5" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
              <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-card shadow-sm">
                Manage connection
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--cloud-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Bot className="h-5 w-5 text-[var(--ai)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">Automation ready</div>
            <p className="mt-1 text-xs text-muted-foreground">Backend events can trigger AI workflows later.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Mail className="h-5 w-5 text-[var(--cloud)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">Recovery mail</div>
            <p className="mt-1 text-xs text-muted-foreground">Keep password and verification messages branded.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <ShieldCheck className="h-5 w-5 text-[var(--business)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">Policy enforced</div>
            <p className="mt-1 text-xs text-muted-foreground">Provider access can be locked to approved tenants.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
