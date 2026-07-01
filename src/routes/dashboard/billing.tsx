import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { FileText, Receipt } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({
    meta: [{ title: "Billing - CloudMonkey Dashboard" }],
  }),
  component: BillingPage,
});

function formatAmount(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function BillingPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isChildRoute = pathname !== "/dashboard/billing";
  const [subscriptions, invoices] = useQueries({
    queries: [
      { queryKey: ["user", "subscription"], queryFn: () => fetchJson("/api/user/subscription"), enabled: !isChildRoute },
      { queryKey: ["invoices"], queryFn: () => fetchJson("/api/invoices"), enabled: !isChildRoute },
    ],
  });

  if (isChildRoute) return <Outlet />;

  const activeSubscriptions = subscriptions.data?.filter((item: any) => item.status === "active" || item.status === "trialing") ?? [];
  const pendingSubscriptions = subscriptions.data?.filter((item: any) => item.status === "pending") ?? [];
  const monthlyTotal = activeSubscriptions.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title={<>Billing and subscriptions.</>}
        subtitle="Review active subscriptions, invoices, due dates, and payment links."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Active subscriptions</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{activeSubscriptions.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Monthly recurring</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{formatAmount(monthlyTotal)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Pending invoices</div>
            <div className="mt-2 text-3xl font-bold text-foreground">
              {invoices.data?.filter((item: any) => item.status === "pending").length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingSubscriptions.length > 0 && (
        <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Payment still pending</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {pendingSubscriptions.length} subscription{pendingSubscriptions.length > 1 ? "s" : ""} are waiting for Paystack confirmation.
              </div>
            </div>
            <Button asChild className="rounded-lg bg-amber-600 hover:bg-amber-700">
              <a href="#recent-invoices">Open invoices</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptions.isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading subscriptions...</div>
          ) : !subscriptions.data?.length ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No subscriptions are assigned to this account.</div>
          ) : subscriptions.data.map((item: any) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-foreground">{item.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatAmount(item.amount)} / {item.interval}
                  {item.currentPeriodEnd ? ` · renews ${new Date(item.currentPeriodEnd).toLocaleDateString()}` : ""}
                </div>
              </div>
              <Badge variant={item.status === "active" || item.status === "trialing" ? "default" : item.status === "pending" ? "outline" : "secondary"}>{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card id="recent-invoices" className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {invoices.isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading invoices...</div>
          ) : !invoices.data?.length ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No invoices found.</div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="pb-3">Invoice</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3">Due</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((invoice: any) => (
                  <tr key={invoice.id} className="border-b border-border/50 last:border-0">
                    <td className="py-4 font-medium text-foreground">{invoice.id}</td>
                    <td className="py-4 text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</td>
                    <td className="py-4 text-muted-foreground">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td className="py-4 text-muted-foreground">{formatAmount(invoice.amount)}</td>
                    <td className="py-4"><Badge variant={invoice.status === "paid" ? "default" : "outline"}>{invoice.status}</Badge></td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm" className="rounded-lg">
                          <Link to="/dashboard/billing/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
                            <FileText className="h-4 w-4" /> View
                          </Link>
                        </Button>
                        {invoice.status === "pending" && invoice.paystackUrl && (
                          <Button asChild size="sm" className="rounded-lg">
                            <a href={invoice.paystackUrl} target="_blank" rel="noreferrer">
                              <Receipt className="h-4 w-4" /> Pay
                            </a>
                          </Button>
                        )}
                      </div>
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
