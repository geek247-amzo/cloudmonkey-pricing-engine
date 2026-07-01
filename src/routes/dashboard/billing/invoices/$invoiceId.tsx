import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Printer, Receipt, ArrowLeft, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
          {data?.invoice?.status === "pending" && data?.payment?.paystackUrl && (
            <Button asChild className="rounded-lg bg-[var(--ai)]">
              <a href={data.payment.paystackUrl} target="_blank" rel="noreferrer">
                <Receipt className="h-4 w-4" />
                Pay invoice
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-lg">
            <a href={`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </Button>
          <Button variant="outline" className="rounded-lg" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          {isAdmin && data?.invoice?.invoiceSource === "manual" && !["paid", "void"].includes(data?.invoice?.status) && (
            <Button variant="outline" className="rounded-lg border-red-200 text-red-700 hover:bg-red-50" onClick={() => voidMutation.mutate()} disabled={voidMutation.isPending}>
              <XCircle className="h-4 w-4" />
              Void invoice
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading invoice...</CardContent>
        </Card>
      ) : error ? (
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-8 text-center text-sm text-red-600">Invoice could not be loaded.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#dfe4ef] bg-[#f6f7fb] print:overflow-visible print:border-0">
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>
      )}
    </div>
  );
}
