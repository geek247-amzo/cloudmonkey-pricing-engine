import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock3, RefreshCcw } from "lucide-react";
import { useEffect } from "react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { formatDateTimeUTC } from "@/lib/date-format";

export const Route = createFileRoute("/dashboard/activity-logs")({
  head: () => ({
    meta: [{ title: "Activity logs - CloudMonkey Dashboard" }],
  }),
  component: ActivityLogsPage,
});

function ActivityLogsPage() {
  const navigate = useNavigate();
  const { authReady, isAdmin } = useAdminAccess();

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs");
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: isAdmin,
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activity logs"
        title={<>Audit trail.</>}
        subtitle="Review changes made across billing, users, infrastructure, support, and settings."
      />

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Latest events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading activity...
            </div>
          ) : !logs?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No audit activity has been recorded yet.</div>
          ) : logs.map((item: any) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 text-[var(--ai)]" />
                <div>
                  <div className="font-semibold text-foreground">{item.message}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {item.action} · {formatDateTimeUTC(item.createdAt)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={item.level === "error" ? "destructive" : item.level === "warning" ? "secondary" : "default"}>{item.level}</Badge>
                <Badge variant="outline">{item.entityType}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
