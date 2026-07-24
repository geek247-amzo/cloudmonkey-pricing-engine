import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CreditCard, Download, Mail, Printer, Receipt, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/billing/invoices/$invoiceId")({
  head: () => ({
    meta: [{ title: "Invoice - CloudMonkey Dashboard" }],
  }),
  component: InvoiceDetailPage,
});

async function fetchInvoice(invoiceId: string) {
  const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`);
  if (!res.ok) throw new Error("Failed to fetch invoice");
  return res.json();
}

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const queryClient = useQueryClient();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureForm, setCaptureForm] = useState({
    amount: "",
    method: "eft",
    reference: "",
    notes: "",
  });
  const [captureIdempotencyKey, setCaptureIdempotencyKey] = useState(() => crypto.randomUUID());
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => fetchInvoice(invoiceId),
  });
  const voidMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided from invoice detail" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to void invoice");
      return body;
    },
    onSuccess: () => {
      toast.success("Invoice voided");
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/publish`,
        {
          method: "POST",
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to publish invoice");
      return body;
    },
    onSuccess: () => {
      toast.success("Invoice published with payment link");
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/manual-invoices/${encodeURIComponent(invoiceId)}/email`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to send invoice email");
      return body;
    },
    onSuccess: () => {
      toast.success("Invoice email sent");
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const captureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: captureForm.amount ? Math.round(parseFloat(captureForm.amount) * 100) : null,
          idempotencyKey: captureIdempotencyKey,
          method: captureForm.method,
          reference: captureForm.reference || null,
          notes: captureForm.notes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to capture payment");
      return body;
    },
    onSuccess: (body) => {
      toast.success(body.paid ? "Payment captured and invoice marked paid" : "Partial payment captured");
      setCaptureOpen(false);
      setCaptureIdempotencyKey(crypto.randomUUID());
      setCaptureForm({ amount: "", method: "eft", reference: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invoice = data?.invoice;
  const isManualInvoice = invoice?.invoiceSource === "manual";
  const capturedTotal = (data?.payments ?? []).reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
  const outstandingCents = Math.max(0, Number(invoice?.amount ?? 0) - capturedTotal);
  const outstanding = (outstandingCents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title={<>Invoice {data?.document?.invoice?.invoiceNumber ?? invoiceId}</>}
        subtitle="View, print, download, or pay this CloudMonkey invoice."
        actions={
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/dashboard/billing">
              <ArrowLeft className="h-4 w-4" />
              Back to billing
            </Link>
          </Button>
        }
      />

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm print:hidden">
        <CardContent className="flex flex-wrap gap-2 p-4">
          {invoice?.status === "pending" && data?.payment?.paystackUrl && (
            <Button asChild className="rounded-lg bg-[var(--ai)]">
              <a href={data.payment.paystackUrl} target="_blank" rel="noreferrer">
                <Receipt className="h-4 w-4" />
                Pay invoice
              </a>
            </Button>
          )}
          {isAdmin && isManualInvoice && invoice?.status === "draft" && (
            <Button
              className="rounded-lg bg-[var(--ai)]"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              <Send className="h-4 w-4" />
              Publish invoice
            </Button>
          )}
          {isAdmin && isManualInvoice && !["draft", "void"].includes(invoice?.status) && (
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => emailMutation.mutate()}
              disabled={emailMutation.isPending || (invoice?.paymentMethod !== "eft" && !data?.payment?.paystackUrl)}
            >
              <Mail className="h-4 w-4" />
              Email customer
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-lg">
            <a
              href={`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </Button>
          <Button variant="outline" className="rounded-lg" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          {isAdmin && invoice && !["paid", "void", "cancelled", "draft"].includes(invoice.status) && (
            <Button
              variant="outline"
              className="rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => {
                setCaptureForm((current) => ({ ...current, amount: outstanding }));
                setCaptureIdempotencyKey(crypto.randomUUID());
                setCaptureOpen((current) => !current);
              }}
            >
              <CreditCard className="h-4 w-4" />
              Capture EFT/manual payment
            </Button>
          )}
          {isAdmin && isManualInvoice && !["paid", "void"].includes(invoice?.status) && (
            <Button
              variant="outline"
              className="rounded-lg border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => voidMutation.mutate()}
              disabled={voidMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              Void invoice
            </Button>
          )}
        </CardContent>
      </Card>

      {captureOpen && invoice && (
        <Card className="rounded-lg border-emerald-200 bg-emerald-50/40 shadow-sm print:hidden">
          <CardContent className="grid gap-4 p-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Amount (ZAR)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={captureForm.amount}
                onChange={(event) => setCaptureForm({ ...captureForm, amount: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">Outstanding: R {outstanding}</p>
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={captureForm.method}
                onChange={(event) => setCaptureForm({ ...captureForm, method: event.target.value })}
              >
                <option value="eft">EFT</option>
                <option value="cash">Cash</option>
                <option value="manual">Manual adjustment</option>
                <option value="gateway">Gateway verified manually</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Reference</Label>
              <Input
                value={captureForm.reference}
                onChange={(event) => setCaptureForm({ ...captureForm, reference: event.target.value })}
                placeholder="Bank reference, proof of payment, or note"
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={captureForm.notes}
                onChange={(event) => setCaptureForm({ ...captureForm, notes: event.target.value })}
                placeholder="Optional internal payment note"
              />
            </div>
            <div className="flex gap-2 md:col-span-4">
              <Button
                className="rounded-lg bg-[var(--ai)]"
                onClick={() => captureMutation.mutate()}
                disabled={captureMutation.isPending || !captureForm.amount}
              >
                Capture payment
              </Button>
              <Button variant="outline" className="rounded-lg" onClick={() => setCaptureOpen(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading invoice...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-8 text-center text-sm text-red-600">
            Invoice could not be loaded.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#dfe4ef] bg-[#f6f7fb] print:overflow-visible print:border-0">
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>
      )}
    </div>
  );
}
