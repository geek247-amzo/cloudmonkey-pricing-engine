import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect } from "react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/roles")({
  head: () => ({
    meta: [{ title: "Roles - CloudMonkey Dashboard" }],
  }),
  component: RolesPage,
});

const roleDescriptions: Record<string, string> = {
  owner: "Full platform ownership and account control.",
  admin: "Platform administration, billing, users, and operations.",
  support: "Ticket handling and customer troubleshooting.",
  finance: "Invoices, subscriptions, and payment operations.",
  customer: "Customer workspace access.",
};

function RolesPage() {
  const navigate = useNavigate();
  const { authReady, isAdmin } = useAdminAccess();

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAdmin,
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const roles = Object.keys(roleDescriptions).map((role) => ({
    role,
    count: users?.filter((user: any) => user.role === role).length ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roles"
        title={<>Roles and access.</>}
        subtitle="Current role distribution from live user accounts."
        actions={
          <Button asChild className="rounded-lg bg-[var(--ai)]">
            <Link to="/dashboard/users">
              Manage users
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {roles.map((item) => (
          <Card key={item.role} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3 capitalize">
                  <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
                  {item.role}
                </span>
                <Badge variant="secondary">{isLoading ? "..." : item.count} users</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{roleDescriptions[item.role]}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
