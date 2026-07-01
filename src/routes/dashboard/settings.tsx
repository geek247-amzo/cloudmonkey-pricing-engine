import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [{ title: "Settings - CloudMonkey Dashboard" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [form, setForm] = useState({
    workspaceName: "",
    adminNotificationEmail: "",
    securityContactEmail: "",
    billingLegalName: "",
    billingEmail: "",
    billingPhone: "",
    billingWebsite: "",
    billingAddress: "",
    billingRegistrationNumber: "",
    billingVatNumber: "",
    billingBankName: "",
    billingBankAccountName: "",
    billingBankAccountNumber: "",
    billingBankBranchCode: "",
    billingInvoiceNotes: "",
    defaultTicketPriority: "medium",
    allowCustomerTicketCreation: true,
  });

  const { data: settings } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  useEffect(() => {
    if (settings) {
      setForm({
        workspaceName: settings.workspaceName ?? "",
        adminNotificationEmail: settings.adminNotificationEmail ?? "",
        securityContactEmail: settings.securityContactEmail ?? "",
        billingLegalName: settings.billingLegalName ?? "",
        billingEmail: settings.billingEmail ?? "",
        billingPhone: settings.billingPhone ?? "",
        billingWebsite: settings.billingWebsite ?? "",
        billingAddress: settings.billingAddress ?? "",
        billingRegistrationNumber: settings.billingRegistrationNumber ?? "",
        billingVatNumber: settings.billingVatNumber ?? "",
        billingBankName: settings.billingBankName ?? "",
        billingBankAccountName: settings.billingBankAccountName ?? "",
        billingBankAccountNumber: settings.billingBankAccountNumber ?? "",
        billingBankBranchCode: settings.billingBankBranchCode ?? "",
        billingInvoiceNotes: settings.billingInvoiceNotes ?? "",
        defaultTicketPriority: settings.defaultTicketPriority ?? "medium",
        allowCustomerTicketCreation: Boolean(settings.allowCustomerTicketCreation),
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          adminNotificationEmail: form.adminNotificationEmail || null,
          securityContactEmail: form.securityContactEmail || null,
          billingLegalName: form.billingLegalName || null,
          billingEmail: form.billingEmail || null,
          billingPhone: form.billingPhone || null,
          billingWebsite: form.billingWebsite || null,
          billingAddress: form.billingAddress || null,
          billingRegistrationNumber: form.billingRegistrationNumber || null,
          billingVatNumber: form.billingVatNumber || null,
          billingBankName: form.billingBankName || null,
          billingBankAccountName: form.billingBankAccountName || null,
          billingBankAccountNumber: form.billingBankAccountNumber || null,
          billingBankBranchCode: form.billingBankBranchCode || null,
          billingInvoiceNotes: form.billingInvoiceNotes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: () => toast.error("Could not save settings"),
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={<>Workspace settings.</>}
        subtitle="Configure operational defaults used by tickets, notifications, and admin views."
      />

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5 lg:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field label="Workspace name">
              <Input value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })} required />
            </Field>
            <Field label="Admin notification email">
              <Input type="email" value={form.adminNotificationEmail} onChange={(event) => setForm({ ...form, adminNotificationEmail: event.target.value })} />
            </Field>
            <Field label="Security contact email">
              <Input type="email" value={form.securityContactEmail} onChange={(event) => setForm({ ...form, securityContactEmail: event.target.value })} />
            </Field>
            <Field label="Default ticket priority">
              <select
                value={form.defaultTicketPriority}
                onChange={(event) => setForm({ ...form, defaultTicketPriority: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border p-4 lg:col-span-2">
              <div>
                <div className="text-sm font-medium text-foreground">Customer ticket creation</div>
                <div className="text-xs text-muted-foreground">Allow customers to open tickets from the dashboard.</div>
              </div>
              <Switch
                checked={form.allowCustomerTicketCreation}
                onCheckedChange={(checked) => setForm({ ...form, allowCustomerTicketCreation: checked })}
              />
            </div>
            <Button type="submit" className="rounded-lg bg-[var(--ai)] lg:col-span-2" disabled={mutation.isPending}>
              <Save className="h-4 w-4" />
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Billing and invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5 lg:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field label="Legal name">
              <Input value={form.billingLegalName} onChange={(event) => setForm({ ...form, billingLegalName: event.target.value })} />
            </Field>
            <Field label="Billing email">
              <Input type="email" value={form.billingEmail} onChange={(event) => setForm({ ...form, billingEmail: event.target.value })} />
            </Field>
            <Field label="Billing phone">
              <Input value={form.billingPhone} onChange={(event) => setForm({ ...form, billingPhone: event.target.value })} />
            </Field>
            <Field label="Billing website">
              <Input value={form.billingWebsite} onChange={(event) => setForm({ ...form, billingWebsite: event.target.value })} />
            </Field>
            <Field label="Company registration number">
              <Input value={form.billingRegistrationNumber} onChange={(event) => setForm({ ...form, billingRegistrationNumber: event.target.value })} />
            </Field>
            <Field label="VAT number">
              <Input value={form.billingVatNumber} onChange={(event) => setForm({ ...form, billingVatNumber: event.target.value })} />
            </Field>
            <Field label="Bank name">
              <Input value={form.billingBankName} onChange={(event) => setForm({ ...form, billingBankName: event.target.value })} />
            </Field>
            <Field label="Bank account name">
              <Input value={form.billingBankAccountName} onChange={(event) => setForm({ ...form, billingBankAccountName: event.target.value })} />
            </Field>
            <Field label="Bank account number">
              <Input value={form.billingBankAccountNumber} onChange={(event) => setForm({ ...form, billingBankAccountNumber: event.target.value })} />
            </Field>
            <Field label="Branch code">
              <Input value={form.billingBankBranchCode} onChange={(event) => setForm({ ...form, billingBankBranchCode: event.target.value })} />
            </Field>
            <Field label="Registered address">
              <textarea
                value={form.billingAddress}
                onChange={(event) => setForm({ ...form, billingAddress: event.target.value })}
                className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Invoice notes">
              <textarea
                value={form.billingInvoiceNotes}
                onChange={(event) => setForm({ ...form, billingInvoiceNotes: event.target.value })}
                className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Button type="submit" className="rounded-lg bg-[var(--ai)] lg:col-span-2" disabled={mutation.isPending}>
              <Save className="h-4 w-4" />
              Save billing settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
