import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  FileText,
  Globe,
  HardDrive,
  Mail,
  Plus,
  ReceiptText,
  Send,
  Server,
  ShoppingCart,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
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

type ManualInvoiceLineForm = {
  id: string;
  planId: string;
  websitePackageType: string;
  description: string;
  quantity: string;
  amountRand: string;
  recurring: boolean;
  interval: "month" | "year";
};

function createInvoiceLine(id?: string): ManualInvoiceLineForm {
  return {
    id: id ?? crypto.randomUUID?.() ?? `line_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    planId: "",
    websitePackageType: "",
    description: "",
    quantity: "1",
    amountRand: "",
    recurring: false,
    interval: "month",
  };
}

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [invoiceForm, setInvoiceForm] = useState({
    interval: "month",
    paymentMethod: "gateway",
    billingPeriodStart: "",
    billingPeriodEnd: "",
    dueDate: "",
    notes: "",
  });
  const [contactForm, setContactForm] = useState({
    whatsapp: "",
  });
  const [invoiceLines, setInvoiceLines] = useState<ManualInvoiceLineForm[]>(() => [
    createInvoiceLine("initial-invoice-line"),
  ]);

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

  useEffect(() => {
    if (data?.user) {
      setContactForm({
        whatsapp: data.user.whatsapp ?? "",
      });
    }
  }, [data?.user]);

  const selectedPlansByLine = useMemo(() => {
    return Object.fromEntries(
      invoiceLines.map((line) => [
        line.id,
        (products ?? []).find((item: any) => item.id === line.planId) ?? null,
      ]),
    );
  }, [products, invoiceLines]);

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const items = invoiceLines.map((line) => ({
        description: line.description,
        quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
        unitPrice: Math.round(Number(line.amountRand) * 100),
        planId: line.planId || null,
        websitePackageType: line.websitePackageType || null,
        recurring: line.recurring,
        interval: line.interval,
      }));
      const res = await fetch("/api/admin/manual-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          interval: invoiceForm.interval,
          paymentMethod: invoiceForm.paymentMethod,
          items,
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
        interval: "month",
        billingPeriodStart: "",
        billingPeriodEnd: "",
        dueDate: "",
        notes: "",
      });
      setInvoiceLines([createInvoiceLine("initial-invoice-line")]);
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(
        `/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/publish`,
        { method: "POST" },
      );
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
      const res = await fetch(`/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/email`, {
        method: "POST",
      });
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

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await fetch(
        `/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to cancel subscription");
      return body;
    },
    onSuccess: () => {
      toast.success("Subscription cancelled");
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
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
      toast.success("User deleted successfully");
      navigate({ to: "/dashboard/users" });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Could not delete user");
    },
  });

  const handleDeleteUser = () => {
    if (
      window.confirm(
        `WARNING: Are you sure you want to permanently delete user ${user?.email} and ALL their websites, databases, invoices, and subscriptions? This action CANNOT be undone.`
      )
    ) {
      deleteUserMutation.mutate();
    }
  };

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: contactForm.whatsapp || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update user");
      return body;
    },
    onSuccess: () => {
      toast.success("User contact updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const user = data?.user;
  const invoices = data?.invoices ?? [];
  const manualInvoices = invoices.filter((item: any) => item.invoiceSource === "manual");
  const websitePlans = (products ?? []).filter(
    (plan: any) =>
      ["websites", "ecommerce"].includes(plan.service?.id) ||
      plan.id?.startsWith("web-") ||
      plan.id?.startsWith("ecom-"),
  );
  const invoiceTotalCents = invoiceLines.reduce((sum, line) => {
    const quantity = Math.max(1, Math.round(Number(line.quantity) || 1));
    return sum + quantity * Math.round(Number(line.amountRand || 0) * 100);
  }, 0);
  const hasInvalidLine = invoiceLines.some((line) => {
    const selectedPlan = selectedPlansByLine[line.id];
    const selectedIsWebsitePackage = Boolean(
      selectedPlan &&
      (["websites", "ecommerce"].includes(selectedPlan.service?.id) ||
        selectedPlan.id?.startsWith("web-") ||
        selectedPlan.id?.startsWith("ecom-")),
    );
    return (
      !line.description ||
      Number(line.amountRand) <= 0 ||
      Number(line.quantity) < 1 ||
      (selectedIsWebsitePackage && !line.websitePackageType)
    );
  });
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

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>WhatsApp allowlist</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateUserMutation.mutate();
                }}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp contact</Label>
                  <Input
                    id="whatsapp"
                    value={contactForm.whatsapp}
                    onChange={(event) =>
                      setContactForm((current) => ({ ...current, whatsapp: event.target.value }))
                    }
                    placeholder="+27..."
                  />
                </div>
                <Button
                  type="submit"
                  className="rounded-lg bg-[var(--ai)]"
                  disabled={updateUserMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                  Save contact
                </Button>
              </form>
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
                <div className="text-sm text-muted-foreground">
                  No active subscriptions recorded.
                </div>
              ) : (
                data.subscriptions.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        R {(item.amount / 100).toFixed(2)} / {item.interval}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          item.status === "active" || item.status === "trialing"
                            ? "default"
                            : "outline"
                        }
                      >
                        {item.status}
                      </Badge>
                      {item.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => cancelSubscriptionMutation.mutate(item.id)}
                          disabled={cancelSubscriptionMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Billing invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!invoices.length ? (
                <div className="text-sm text-muted-foreground">
                  No invoices recorded for this user.
                </div>
              ) : (
                invoices.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.invoiceNumber ?? item.id}</div>
                      <div className="text-xs text-muted-foreground">
                        R {(item.amount / 100).toFixed(2)} · {item.status} · {item.invoiceSource}
                        {item.emailedAt
                          ? ` · emailed ${new Date(item.emailedAt).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          item.status === "draft"
                            ? "outline"
                            : item.status === "paid"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                      <Button asChild size="sm" variant="outline" className="rounded-lg">
                        <Link
                          to="/dashboard/billing/invoices/$invoiceId"
                          params={{ invoiceId: item.id }}
                        >
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
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Manual invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  createInvoiceMutation.mutate();
                }}
              >
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Line items</div>
                      <div className="text-xs text-muted-foreground">
                        Recurring line items become subscriptions on the user's profile after
                        payment.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-lg sm:w-auto"
                      onClick={() => setInvoiceLines((lines) => [...lines, createInvoiceLine()])}
                    >
                      <Plus className="h-4 w-4" />
                      Add line item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {invoiceLines.map((line, index) => {
                      const selectedPlan = selectedPlansByLine[line.id];
                      const selectedIsWebsitePackage = Boolean(
                        selectedPlan &&
                        (["websites", "ecommerce"].includes(selectedPlan.service?.id) ||
                          selectedPlan.id?.startsWith("web-") ||
                          selectedPlan.id?.startsWith("ecom-")),
                      );
                      const visibleProducts = line.websitePackageType
                        ? (products ?? []).filter((plan: any) => {
                            if (
                              !websitePlans.some((websitePlan: any) => websitePlan.id === plan.id)
                            )
                              return true;
                            return line.websitePackageType === "ecommerce"
                              ? plan.id?.startsWith("ecom-")
                              : plan.id?.startsWith("web-");
                          })
                        : (products ?? []);
                      const updateLine = (patch: Partial<ManualInvoiceLineForm>) => {
                        setInvoiceLines((lines) =>
                          lines.map((item) => (item.id === line.id ? { ...item, ...patch } : item)),
                        );
                      };
                      return (
                        <div
                          key={line.id}
                          className="rounded-lg border border-border bg-slate-50/60 p-3"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-foreground">
                              Item {index + 1}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-red-200 text-red-700 hover:bg-red-50"
                              disabled={invoiceLines.length === 1}
                              onClick={() =>
                                setInvoiceLines((lines) =>
                                  lines.filter((item) => item.id !== line.id),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-6">
                            <div className="space-y-2 lg:col-span-2">
                              <Label>Service</Label>
                              <select
                                value={line.planId}
                                onChange={(event) => {
                                  const nextPlan = (products ?? []).find(
                                    (item: any) => item.id === event.target.value,
                                  );
                                  const nextPackageType = nextPlan?.id?.startsWith("ecom-")
                                    ? "ecommerce"
                                    : nextPlan?.id?.startsWith("web-")
                                      ? "website"
                                      : line.websitePackageType;
                                  updateLine({
                                    planId: event.target.value,
                                    websitePackageType: nextPackageType,
                                    description: nextPlan
                                      ? `${nextPlan.service?.name ?? "Service"} - ${nextPlan.name}`
                                      : line.description,
                                    amountRand: nextPlan?.priceZar
                                      ? (parseInt(nextPlan.priceZar, 10) / 100).toFixed(2)
                                      : line.amountRand,
                                    recurring: nextPlan ? true : line.recurring,
                                  });
                                }}
                                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                              >
                                <option value="">Custom invoice item</option>
                                {visibleProducts.map((plan: any) => (
                                  <option key={plan.id} value={plan.id}>
                                    {plan.service?.name} - {plan.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2 lg:col-span-2">
                              <Label>Description</Label>
                              <Input
                                value={line.description}
                                onChange={(event) =>
                                  updateLine({ description: event.target.value })
                                }
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={line.quantity}
                                onChange={(event) => updateLine({ quantity: event.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Unit amount ZAR</Label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={line.amountRand}
                                onChange={(event) => updateLine({ amountRand: event.target.value })}
                                required
                              />
                            </div>
                          </div>

                          {selectedIsWebsitePackage && (
                            <div className="mt-3 space-y-2">
                              <Label>Package type</Label>
                              <div className="grid gap-2 sm:grid-cols-2 lg:max-w-xl">
                                {[
                                  {
                                    value: "website",
                                    label: "Website",
                                    detail: "Static content site. No database.",
                                    icon: Globe,
                                  },
                                  {
                                    value: "ecommerce",
                                    label: "Ecommerce",
                                    detail: "Online store with database.",
                                    icon: ShoppingCart,
                                  },
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                      updateLine({
                                        websitePackageType: option.value,
                                        planId:
                                          line.planId &&
                                          option.value === "website" &&
                                          line.planId.startsWith("ecom-")
                                            ? ""
                                            : line.planId &&
                                                option.value === "ecommerce" &&
                                                line.planId.startsWith("web-")
                                              ? ""
                                              : line.planId,
                                      })
                                    }
                                    className={`flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
                                      line.websitePackageType === option.value
                                        ? "border-[var(--ai)] bg-[var(--ai-soft)]/30"
                                        : "border-border bg-white hover:border-[var(--ai)]/50"
                                    }`}
                                  >
                                    <option.icon className="mt-0.5 h-4 w-4 text-[var(--ai)]" />
                                    <span>
                                      <span className="block font-semibold text-foreground">
                                        {option.label}
                                      </span>
                                      <span className="block text-xs text-muted-foreground">
                                        {option.detail}
                                      </span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
                              <input
                                type="checkbox"
                                checked={line.recurring}
                                onChange={(event) =>
                                  updateLine({ recurring: event.target.checked })
                                }
                              />
                              Subscription item
                            </label>
                            <div className="space-y-2">
                              <Label>Line interval</Label>
                              <select
                                value={line.interval}
                                onChange={(event) =>
                                  updateLine({ interval: event.target.value as "month" | "year" })
                                }
                                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                                disabled={!line.recurring}
                              >
                                <option value="month">Monthly</option>
                                <option value="year">Yearly</option>
                              </select>
                            </div>
                            <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm sm:col-span-2">
                              <div className="text-xs text-muted-foreground">Line total</div>
                              <div className="font-semibold text-foreground">
                                R{" "}
                                {(
                                  (Math.max(1, Number(line.quantity) || 1) *
                                    Math.round(Number(line.amountRand || 0) * 100)) /
                                  100
                                ).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Interval</Label>
                    <select
                      value={invoiceForm.interval}
                      onChange={(event) =>
                        setInvoiceForm({
                          ...invoiceForm,
                          interval: event.target.value,
                          billingPeriodEnd: invoiceForm.billingPeriodEnd || "",
                        })
                      }
                      className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                    >
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment method</Label>
                    <select
                      value={invoiceForm.paymentMethod}
                      onChange={(event) =>
                        setInvoiceForm({ ...invoiceForm, paymentMethod: event.target.value })
                      }
                      className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                    >
                      <option value="gateway">Paystack gateway</option>
                      <option value="eft">EFT/manual</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Service billing date</Label>
                    <Input
                      type="date"
                      value={invoiceForm.billingPeriodStart}
                      onChange={(event) =>
                        setInvoiceForm({ ...invoiceForm, billingPeriodStart: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Billing period end</Label>
                    <Input
                      type="date"
                      value={invoiceForm.billingPeriodEnd}
                      onChange={(event) =>
                        setInvoiceForm({ ...invoiceForm, billingPeriodEnd: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <Input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(event) =>
                        setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice total</Label>
                    <div className="flex h-9 items-center rounded-md border border-input bg-slate-50 px-3 text-sm font-semibold">
                      R {(invoiceTotalCents / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label>Notes</Label>
                    <Input
                      value={invoiceForm.notes}
                      onChange={(event) =>
                        setInvoiceForm({ ...invoiceForm, notes: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-end lg:col-span-2">
                    <Button
                      type="submit"
                      className="rounded-lg bg-[var(--ai)]"
                      disabled={
                        createInvoiceMutation.isPending || hasInvalidLine || invoiceTotalCents <= 0
                      }
                    >
                      <FileText className="h-4 w-4" />
                      Save draft invoice
                    </Button>
                  </div>
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
                <div className="text-sm text-muted-foreground">
                  No manual invoices created for this user.
                </div>
              ) : (
                manualInvoices.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.invoiceNumber ?? item.id}</div>
                      <div className="text-xs text-muted-foreground">
                        R {(item.amount / 100).toFixed(2)} · {item.status}
                        {item.emailedAt
                          ? ` · emailed ${new Date(item.emailedAt).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          item.status === "draft"
                            ? "outline"
                            : item.status === "paid"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                      <Button asChild size="sm" variant="outline" className="rounded-lg">
                        <Link
                          to="/dashboard/billing/invoices/$invoiceId"
                          params={{ invoiceId: item.id }}
                        >
                          <ReceiptText className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      {item.status === "draft" && (
                        <Button
                          size="sm"
                          className="rounded-lg bg-[var(--ai)]"
                          onClick={() => publishInvoiceMutation.mutate(item.id)}
                          disabled={publishInvoiceMutation.isPending}
                        >
                          <Send className="h-4 w-4" />
                          Publish
                        </Button>
                      )}
                      {item.status !== "draft" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            onClick={() => emailInvoiceMutation.mutate(item.id)}
                            disabled={emailInvoiceMutation.isPending}
                          >
                            <Mail className="h-4 w-4" />
                            Email
                          </Button>
                        </>
                      )}
                      {!["paid", "void"].includes(item.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => voidInvoiceMutation.mutate(item.id)}
                          disabled={voidInvoiceMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-red-200 bg-red-50/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-foreground text-sm">Delete User Account</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Permanently delete this user, including their websites, databases, invoices, and active subscriptions. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="rounded-lg shrink-0"
                  onClick={handleDeleteUser}
                  disabled={deleteUserMutation.isPending}
                >
                  Delete User
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
