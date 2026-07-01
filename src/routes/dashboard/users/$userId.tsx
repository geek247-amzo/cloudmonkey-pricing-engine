import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, FileText, Globe, HardDrive, Mail, ReceiptText, Send, Server, UserRound, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/users/$userId")({
  head: () => ({
    meta: [{ title: "User detail - CloudMonkey Dashboard" }],
  }),
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [invoiceForm, setInvoiceForm] = useState({
    planId: "",
    name: "",
    amountRand: "",
    interval: "month",
    billingPeriodStart: "",
    billingPeriodEnd: "",
    dueDate: "",
    notes: "",
  });

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: isAdmin,
  });
  const { data: products } = useQuery({
    queryKey: ["admin", "products", "manual-invoice"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: isAdmin,
  });

  const selectedPlan = useMemo(() => {
    return (products ?? []).find((item: any) => item.id === invoiceForm.planId);
  }, [products, invoiceForm.planId]);

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const amount = Math.round(Number(invoiceForm.amountRand) * 100);
      const res = await fetch("/api/admin/manual-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          planId: invoiceForm.planId || null,
          name: invoiceForm.name || selectedPlan?.name || "Manual CloudMonkey invoice",
          amount,
          interval: invoiceForm.interval,
          billingPeriodStart: invoiceForm.billingPeriodStart || null,
          dueDate: invoiceForm.dueDate || null,
          billingPeriodEnd: invoiceForm.billingPeriodEnd || null,
          notes: invoiceForm.notes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create draft invoice");
      return body;
    },
    onSuccess: () => {
      toast.success("Draft invoice created");
      setInvoiceForm({
        planId: "",
        name: "",
        amountRand: "",
        interval: "month",
        billingPeriodStart: "",
        billingPeriodEnd: "",
        dueDate: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/publish`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to publish invoice");
      return body;
    },
    onSuccess: () => {
      toast.success("Invoice published with payment link");
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const emailInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/email`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to send invoice email");
      return body;
    },
    onSuccess: () => {
      toast.success("Invoice email sent");
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const voidInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided from admin user detail" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to void invoice");
      return body;
    },
    onSuccess: () => {
      toast.success("Invoice voided");
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const user = data?.user;
  const invoices = data?.invoices ?? [];
  const manualInvoices = invoices.filter((item: any) => item.invoiceSource === "manual");
  const stats = [
    { label: "Domains", value: data?.domains?.length ?? 0, icon: Globe },
    { label: "Servers", value: data?.servers?.length ?? 0, icon: Server },
    { label: "Websites", value: data?.websites?.length ?? 0, icon: HardDrive },
    { label: "Agents", value: data?.agents?.length ?? 0, icon: Bot },
    { label: "Tickets", value: data?.tickets?.length ?? 0, icon: ReceiptText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User detail"
        title={isLoading ? <>Loading user...</> : <>{user?.name || userId}</>}
        subtitle={user?.email || "Account ownership and platform records."}
        actions={
          <Button asChild className="rounded-lg bg-[var(--ai)]">
            <Link to="/dashboard/users">
              Back to users
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {user && (
        <>
          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--ai-soft)] text-[var(--ai)]">
                <UserRound className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
              <Badge>{user.role}</Badge>
              <Badge variant={user.emailVerified ? "default" : "outline"}>
                {user.emailVerified ? "Verified" : "Unverified"}
              </Badge>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {stats.map((item) => (
              <Card key={item.label} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">{item.label}</div>
                      <div className="mt-2 text-3xl font-bold text-[#07102c]">{item.value}</div>
                    </div>
                    <item.icon className="h-5 w-5 text-[var(--ai)]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data?.subscriptions?.length ? (
                <div className="text-sm text-muted-foreground">No active subscriptions recorded.</div>
              ) : data.subscriptions.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">R {(item.amount / 100).toFixed(2)} / {item.interval}</div>
                  </div>
                  <Badge variant={item.status === "active" || item.status === "trialing" ? "default" : "outline"}>{item.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Billing invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!invoices.length ? (
                <div className="text-sm text-muted-foreground">No invoices recorded for this user.</div>
              ) : invoices.map((item: any) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-medium">{item.invoiceNumber ?? item.id}</div>
                    <div className="text-xs text-muted-foreground">
                      R {(item.amount / 100).toFixed(2)} · {item.status} · {item.invoiceSource}
                      {item.emailedAt ? ` · emailed ${new Date(item.emailedAt).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={item.status === "draft" ? "outline" : item.status === "paid" ? "default" : "secondary"}>{item.status}</Badge>
                    <Button asChild size="sm" variant="outline" className="rounded-lg">
                      <Link to="/dashboard/billing/invoices/$invoiceId" params={{ invoiceId: item.id }}>
                        <ReceiptText className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
                    {item.status === "pending" && item.paystackUrl && (
                      <Button asChild size="sm" className="rounded-lg bg-[var(--ai)]">
                        <a href={item.paystackUrl} target="_blank" rel="noreferrer">
                          <Mail className="h-4 w-4" />
                          Pay link
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Manual invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 lg:grid-cols-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  createInvoiceMutation.mutate();
                }}
              >
                <div className="space-y-2 lg:col-span-2">
                  <Label>Service</Label>
                  <select
                    value={invoiceForm.planId}
                    onChange={(event) => {
                      const nextPlan = (products ?? []).find((item: any) => item.id === event.target.value);
                      setInvoiceForm({
                        ...invoiceForm,
                        planId: event.target.value,
                        name: nextPlan ? `${nextPlan.service?.name ?? "Service"} - ${nextPlan.name}` : invoiceForm.name,
                        amountRand: nextPlan?.priceZar ? (parseInt(nextPlan.priceZar, 10) / 100).toFixed(2) : invoiceForm.amountRand,
                      });
                    }}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="">Custom invoice</option>
                    {(products ?? []).map((plan: any) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.service?.name} - {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Description</Label>
                  <Input value={invoiceForm.name} onChange={(event) => setInvoiceForm({ ...invoiceForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Amount ZAR</Label>
                  <Input type="number" min="1" step="0.01" value={invoiceForm.amountRand} onChange={(event) => setInvoiceForm({ ...invoiceForm, amountRand: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Interval</Label>
                  <select
                    value={invoiceForm.interval}
                    onChange={(event) => setInvoiceForm({
                      ...invoiceForm,
                      interval: event.target.value,
                      billingPeriodEnd: invoiceForm.billingPeriodEnd || "",
                    })}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Service billing date</Label>
                  <Input type="date" value={invoiceForm.billingPeriodStart} onChange={(event) => setInvoiceForm({ ...invoiceForm, billingPeriodStart: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Billing period end</Label>
                  <Input type="date" value={invoiceForm.billingPeriodEnd} onChange={(event) => setInvoiceForm({ ...invoiceForm, billingPeriodEnd: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Notes</Label>
                  <Input value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} />
                </div>
                <div className="flex items-end lg:col-span-2">
                  <Button type="submit" className="rounded-lg bg-[var(--ai)]" disabled={createInvoiceMutation.isPending}>
                    <FileText className="h-4 w-4" />
                    Save draft invoice
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Manual invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!manualInvoices.length ? (
                <div className="text-sm text-muted-foreground">No manual invoices created for this user.</div>
              ) : manualInvoices.map((item: any) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-medium">{item.invoiceNumber ?? item.id}</div>
                    <div className="text-xs text-muted-foreground">
                      R {(item.amount / 100).toFixed(2)} · {item.status}
                      {item.emailedAt ? ` · emailed ${new Date(item.emailedAt).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={item.status === "draft" ? "outline" : item.status === "paid" ? "default" : "secondary"}>{item.status}</Badge>
                    {item.status === "draft" && (
                      <Button size="sm" className="rounded-lg bg-[var(--ai)]" onClick={() => publishInvoiceMutation.mutate(item.id)} disabled={publishInvoiceMutation.isPending}>
                        <Send className="h-4 w-4" />
                        Publish
                      </Button>
                    )}
                    {item.status !== "draft" && (
                      <>
                        <Button asChild size="sm" variant="outline" className="rounded-lg">
                          <Link to="/dashboard/billing/invoices/$invoiceId" params={{ invoiceId: item.id }}>
                            <ReceiptText className="h-4 w-4" />
                            View
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => emailInvoiceMutation.mutate(item.id)} disabled={emailInvoiceMutation.isPending}>
                          <Mail className="h-4 w-4" />
                          Email
                        </Button>
                      </>
                    )}
                    {!["paid", "void"].includes(item.status) && (
                      <Button size="sm" variant="outline" className="rounded-lg border-red-200 text-red-700 hover:bg-red-50" onClick={() => voidInvoiceMutation.mutate(item.id)} disabled={voidInvoiceMutation.isPending}>
                        <XCircle className="h-4 w-4" />
                        Void
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
