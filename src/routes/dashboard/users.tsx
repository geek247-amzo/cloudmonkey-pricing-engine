import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MailPlus, ShieldCheck, UserRound } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({
    meta: [{ title: "Users - CloudMonkey Dashboard" }],
  }),
  component: UsersPage,
});

const USERS = [
  { name: "Alex Johnson", email: "alex@cloudmonkey.co.za", role: "Owner", provider: "Google", status: "Active" },
  { name: "Mpho Dlamini", email: "mpho@cloudmonkey.co.za", role: "Admin", provider: "Office 365", status: "Active" },
  { name: "Sophie Naidoo", email: "sophie@cloudmonkey.co.za", role: "Analyst", provider: "Email", status: "Invited" },
  { name: "David Smith", email: "david@cloudmonkey.co.za", role: "Support", provider: "Google", status: "Suspended" },
] as const;

function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title={<>User management.</>}
        subtitle="View team members, provider status, and access levels. Link, invite, or review users from one place."
        actions={
          <>
            <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
              <MailPlus className="h-4 w-4" />
              Invite via email
            </Button>
            <Button asChild className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
              <Link to="/dashboard/users/alex-johnson">
                Open profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active", value: "102", accent: "var(--cloud)" },
          { label: "Invited", value: "14", accent: "var(--business)" },
          { label: "Need review", value: "6", accent: "var(--primary)" },
        ].map((item) => (
          <Card key={item.label} className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.value}</div>
              <div className="mt-3 h-1.5 rounded-full bg-muted">
                <div className="h-1.5 w-[68%] rounded-full" style={{ background: item.accent }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Directory</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="pb-3 font-semibold">User</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Provider</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((user) => (
                <tr key={user.email} className="border-b border-border/60 last:border-0">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-muted-foreground">{user.role}</td>
                  <td className="py-4 text-muted-foreground">{user.provider}</td>
                  <td className="py-4">
                    <Badge variant={user.status === "Active" ? "default" : "secondary"} className="rounded-full">
                      {user.status}
                    </Badge>
                  </td>
                  <td className="py-4">
                    <Button asChild variant="outline" size="sm" className="rounded-xl border-border/70 bg-card shadow-sm">
                      <Link to="/dashboard/users/alex-johnson">View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-[linear-gradient(135deg,var(--cloud-soft),rgba(255,255,255,0.92))] shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Account protection</div>
            <p className="mt-1 text-sm text-muted-foreground">Review active sessions and enforce provider linking for elevated access.</p>
          </div>
          <Button asChild variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
            <Link to="/dashboard/sessions">
              <ShieldCheck className="h-4 w-4" />
              Open sessions
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
