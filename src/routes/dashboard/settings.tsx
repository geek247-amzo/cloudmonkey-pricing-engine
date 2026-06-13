import { createFileRoute } from "@tanstack/react-router";
import { BellRing, LayoutTemplate, ShieldCheck, UserCog } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [{ title: "Settings - CloudMonkey Dashboard" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={<>Workspace settings.</>}
        subtitle="Configure profile details, security posture, branding, and notification preferences for the backend."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {[
          { title: "Profile", icon: UserCog, desc: "Name, email, and contact settings for the current admin." },
          { title: "Security", icon: ShieldCheck, desc: "Password policies, MFA, and provider access rules." },
          { title: "Branding", icon: LayoutTemplate, desc: "Logos, colors, and backend UI accents." },
          { title: "Notifications", icon: BellRing, desc: "Email alerts, support notifications, and audit summaries." },
        ].map((item) => (
          <Card key={item.title} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-[var(--ai)]" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Enable</div>
                  <div className="text-xs text-muted-foreground">Toggle this settings area on or off.</div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--ai-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Save changes</div>
            <p className="mt-1 text-sm text-muted-foreground">This page represents the reusable backend settings shell.</p>
          </div>
          <Button className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">Save settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
