import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/proposals/$publicToken")({
  head: () => ({
    meta: [{ title: "CloudMonkey Proposal" }],
  }),
  component: PublicProposalPage,
});

type ProposalItem = {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  setupPrice: number;
  recurring: boolean;
  interval: string;
  lineTotal: number;
};

type Proposal = {
  id: string;
  proposalNumber?: string | null;
  title: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerCompany?: string | null;
  currency: string;
  subtotal: number;
  setupTotal: number;
  recurringTotal: number;
  total: number;
  expiresAt?: string | null;
  introduction?: string | null;
  executiveSummary?: string | null;
  terms?: string | null;
  approvalName?: string | null;
};

type ProposalResponse = { proposal: Proposal; items: ProposalItem[] };

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "This proposal link is unavailable");
  return body as T;
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}

function PublicProposalPage() {
  const { publicToken } = Route.useParams();
  const [approvalName, setApprovalName] = useState("");
  const proposalQuery = useQuery({
    queryKey: ["public-proposal", publicToken],
    queryFn: () =>
      fetchJson<ProposalResponse>(`/api/proposals/${encodeURIComponent(publicToken)}/data`, {
        headers: { Accept: "application/json" },
      }),
  });
  const approval = useMutation({
    mutationFn: () =>
      fetchJson<{
        approved: boolean;
        paystackUrl?: string | null;
        invoiceUrl?: string;
        requiresRegistration?: boolean;
      }>(`/api/proposals/${encodeURIComponent(publicToken)}/approve`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ approvalName: approvalName.trim() }),
      }),
    onSuccess: (result) => {
      if (result.paystackUrl) window.location.assign(result.paystackUrl);
      else if (result.invoiceUrl) window.location.assign(result.invoiceUrl);
      else proposalQuery.refetch();
    },
  });

  if (proposalQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5d2fe8]" />
      </div>
    );
  }

  if (proposalQuery.isError || !proposalQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] p-4">
        <Card className="max-w-lg text-center">
          <CardContent className="space-y-4 p-8">
            <XCircle className="mx-auto h-10 w-10 text-red-600" />
            <p>{proposalQuery.error?.message ?? "This proposal link is unavailable."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { proposal, items } = proposalQuery.data;
  const canApprove = ["draft", "sent"].includes(proposal.status) && !proposalQuery.isError;
  const approved = ["approved", "converted"].includes(proposal.status);

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="bg-[#070d23] px-6 py-10 text-white sm:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#bfb3ff]">
                  CloudMonkey proposal
                </div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
                  {proposal.title}
                </h1>
                <p className="mt-4 max-w-2xl text-white/75">
                  {proposal.introduction || "A clear service proposal from CloudMonkey."}
                </p>
              </div>
              <Badge className="w-fit bg-white/10 text-white">
                {proposal.proposalNumber || proposal.id}
              </Badge>
            </div>
          </div>
          <CardContent className="space-y-8 p-6 sm:p-10">
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Prepared for" value={proposal.customerName} />
              <Info label="Company" value={proposal.customerCompany || "Not specified"} />
              <Info
                label="Valid until"
                value={
                  proposal.expiresAt
                    ? new Date(proposal.expiresAt).toLocaleDateString("en-ZA")
                    : "30 days from issue"
                }
              />
            </div>

            {proposal.executiveSummary && (
              <section>
                <h2 className="text-xl font-bold text-[#07102c]">Executive summary</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#58637e]">
                  {proposal.executiveSummary}
                </p>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#07102c]">Services and pricing</h2>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#dfe4ef] p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <div className="font-bold text-[#07102c]">{item.name}</div>
                    <p className="mt-1 text-sm text-[#58637e]">
                      {item.description || "Managed CloudMonkey service"}
                    </p>
                  </div>
                  <div className="shrink-0 text-left font-bold text-[#07102c] sm:text-right">
                    <div>{money(item.lineTotal, proposal.currency)}</div>
                    <div className="text-xs font-medium text-[#58637e]">
                      {item.recurring ? `/${item.interval}` : "once-off"}
                      {item.setupPrice > 0
                        ? ` · setup ${money(item.setupPrice * item.quantity, proposal.currency)}`
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
              <div className="ml-auto max-w-sm space-y-2 border-t border-[#dfe4ef] pt-4 text-sm">
                <div className="flex justify-between">
                  <span>Setup</span>
                  <strong>{money(proposal.setupTotal, proposal.currency)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Recurring services</span>
                  <strong>{money(proposal.recurringTotal, proposal.currency)}</strong>
                </div>
                <div className="flex justify-between pt-2 text-lg text-[#5d2fe8]">
                  <span>First invoice total</span>
                  <strong>{money(proposal.total, proposal.currency)}</strong>
                </div>
              </div>
            </section>

            {proposal.terms && (
              <section>
                <h2 className="text-xl font-bold text-[#07102c]">Terms and boundaries</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#58637e]">
                  {proposal.terms}
                </p>
              </section>
            )}

            {approved ? (
              <div className="flex items-start gap-3 rounded-xl bg-green-50 p-5 text-green-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-bold">Proposal approved</div>
                  <p className="mt-1 text-sm">
                    Your approval has been recorded. Continue to the payment link if one is
                    available.
                  </p>
                </div>
              </div>
            ) : canApprove ? (
              <section className="rounded-2xl bg-[#070d23] p-5 text-white sm:p-7">
                <h2 className="text-xl font-bold">Approve and pay</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Enter your name to sign off this proposal. Your name, timestamp, IP address, and
                  browser details are recorded with the approval.
                </p>
                <div className="mt-5 space-y-2">
                  <Label htmlFor="approvalName" className="text-white">
                    Full name
                  </Label>
                  <Input
                    id="approvalName"
                    value={approvalName}
                    onChange={(event) => setApprovalName(event.target.value)}
                    placeholder={proposal.customerName}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/45"
                  />
                </div>
                {approval.error && (
                  <p className="mt-3 text-sm text-red-300">{approval.error.message}</p>
                )}
                <Button
                  className="mt-5 w-full bg-white text-[#321594] hover:bg-white/90"
                  onClick={() => approval.mutate()}
                  disabled={approval.isPending || approvalName.trim().length < 2}
                >
                  {approval.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}{" "}
                  Approve proposal and continue to Paystack
                </Button>
              </section>
            ) : (
              <div className="rounded-xl bg-[#f3f6fa] p-5 text-sm text-[#58637e]">
                This proposal is currently {proposal.status}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dfe4ef] bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#58637e]">{label}</div>
      <div className="mt-2 font-semibold text-[#07102c]">{value}</div>
    </div>
  );
}
