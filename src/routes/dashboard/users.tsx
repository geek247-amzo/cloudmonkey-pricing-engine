import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RefreshCcw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({
    meta: [{ title: "Users - CloudMonkey Dashboard" }],
  }),
  component: UsersPage,
});

const roles = ["owner", "admin", "support", "finance", "customer"] as const;

function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isChildRoute = pathname !== "/dashboard/users";

  useEffect(() => {
    if (!isChildRoute && authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, isChildRoute, navigate]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !isChildRoute && isAdmin,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch("/api/admin/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      toast.success("User role updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => toast.error("Could not update role"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User and all associated data deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Could not delete user");
    },
  });

  const handleDelete = (userId: string, email: string) => {
    if (
      window.confirm(
        `WARNING: Are you sure you want to permanently delete user ${email} and ALL their websites, databases, invoices, and subscriptions? This action CANNOT be undone.`
      )
    ) {
      deleteMutation.mutate(userId);
    }
  };

  if (isChildRoute) return <Outlet />;
  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const roleCounts = roles.map((role) => ({
    role,
    count: users?.filter((item: any) => item.role === role).length ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={<>Users and access.</>}
        subtitle="Manage account roles and inspect customer ownership across the platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {roleCounts.map((item) => (
          <Card key={item.role} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm capitalize text-muted-foreground">{item.role}</div>
                  <div className="mt-2 text-3xl font-bold text-[#07102c]">{item.count}</div>
                </div>
                <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading users...
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="pb-3">User</th>
                  <th className="pb-3">WhatsApp</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Verified</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((item: any) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ai-soft)] text-[var(--ai)]">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {item.whatsapp || "Not set"}
                    </td>
                    <td className="py-4">
                      <select
                        value={item.role}
                        className="rounded-md border border-border bg-white px-2 py-1 text-xs"
                        onChange={(event) => roleMutation.mutate({ userId: item.id, role: event.target.value })}
                      >
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="py-4">
                      <Badge variant={item.emailVerified ? "default" : "outline"}>{item.emailVerified ? "Verified" : "Unverified"}</Badge>
                    </td>
                    <td className="py-4 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="py-4 text-right flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm" className="rounded-lg">
                        <Link to="/dashboard/users/$userId" params={{ userId: item.id }}>
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => handleDelete(item.id, item.email)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
