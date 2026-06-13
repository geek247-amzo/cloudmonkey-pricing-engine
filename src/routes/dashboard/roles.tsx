import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, UsersRound, LockKeyhole, BadgeCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/roles")({
  head: () => ({
    meta: [{ title: "Roles - CloudMonkey Dashboard" }],
  }),
  component: RolesPage,
});

function RolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roles"
        title={<>Roles and permissions.</>}
        subtitle="Define access boundaries for admins, support staff, finance, and read-only reviewers."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {[
          { title: "Owner", icon: ShieldCheck, desc: "Full backend access and account control.", badge: "All access" },
          { title: "Admin", icon: UsersRound, desc: "Manage users, settings, and billing without owner rights.", badge: "High access" },
          { title: "Finance", icon: BadgeCheck, desc: "Invoices, billing records, and payment operations.", badge: "Scoped" },
          { title: "Support", icon: LockKeyhole, desc: "Sessions, tickets, and user troubleshooting.", badge: "Scoped" },
        ].map((role) => (
          <Card key={role.title} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <role.icon className="h-5 w-5 text-[var(--ai)]" />
                  {role.title}
                </span>
                <Badge variant="secondary">{role.badge}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{role.desc}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Users", "Billing", "Sessions", "Logs"].map((label) => (
                  <Badge key={label} variant="outline" className="rounded-full">
                    {label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--ai-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Permissions matrix</div>
            <p className="mt-1 text-sm text-muted-foreground">Add a matrix or policy editor here when the backend arrives.</p>
          </div>
          <Button className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">Edit policies</Button>
        </CardContent>
      </Card>
    </div>
  );
}
