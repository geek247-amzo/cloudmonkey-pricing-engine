import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HandCoins, PauseCircle, RefreshCcw, ShieldAlert, UserPlus, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/affiliate-admin")({
  head: () => ({
    meta: [{ title: "Affiliate Admin - CloudMonkey" }],
  }),
  component: AffiliateAdminPage,
});

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function money(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function AffiliateAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [filter, setFilter] = useState("");
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "affiliates"],
    queryFn: () => fetchJson("/api/admin/affiliates"),
    enabled: isAdmin,
  });

  const updateAffiliate = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/admin/affiliates/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update affiliate");
      return body;
    },
    onSuccess: () => {
      toast.success("Affiliate updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    },
    onError: (error: any) => toast.error(error.message || "Could not update affiliate"),
  });

  const updateCommission = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/affiliates/commissions/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update commission");
      return body;
    },
    onSuccess: () => {
      toast.success("Commission updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    },
    onError: (error: any) => toast.error(error.message || "Could not update commission"),
  });

  const markPayoutPaid = useMutation({
    mutationFn: async () => {
      const selected = (data?.commissions ?? []).filter((row: any) => selectedCommissionIds.includes(row.id));
      const affiliateId = selected[0]?.affiliateId;
      if (!affiliateId || selected.some((row: any) => row.affiliateId !== affiliateId)) {
        throw new Error("Select payable commissions for one affiliate");
      }
      const res = await fetch("/api/admin/affiliates/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId, commissionIds: selectedCommissionIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to mark payout");
      return body;
    },
    onSuccess: () => {
      setSelectedCommissionIds([]);
      toast.success("Payout marked paid");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    },
    onError: (error: any) => toast.error(error.message || "Could not mark payout"),
  });

  const affiliates = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (data?.affiliates ?? []).filter((row: any) => {
      if (!query) return true;
      return [row.fullName, row.email, row.companyName, row.tier, row.status].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [data?.affiliates, filter]);
  const payableCommissions = (data?.commissions ?? []).filter((row: any) => row.status === "approved" || row.status === "payable");
  const pendingCommissions = (data?.commissions ?? []).filter((row: any) => row.status === "pending");
  const flags = (data?.flags ?? []).filter((row: any) => row.status === "open");

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={<>Affiliate management.</>}
        subtitle="Approve partners, manage commissions, review fraud flags, and mark manual EFT payouts."
        actions={
          <Button variant="outline" className="rounded-lg" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] })}>
            <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Metric label="Affiliates" value={data?.affiliates?.length ?? 0} icon={UserPlus} />
        <Metric label="Pending commissions" value={pendingCommissions.length} icon={HandCoins} />
        <Metric label="Payable" value={money(payableCommissions.reduce((sum: number, row: any) => sum + row.commissionAmount, 0))} icon={HandCoins} />
        <Metric label="Open flags" value={flags.length} icon={ShieldAlert} />
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Affiliates</CardTitle>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search affiliates..." className="max-w-sm" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading affiliates...</div>
          ) : (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="pb-3">Affiliate</th>
                  <th className="pb-3">Tier</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Signups</th>
                  <th className="pb-3">Pending</th>
                  <th className="pb-3">Paid</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((row: any) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0">
                    <td className="py-4">
                      <div className="font-semibold text-foreground">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="py-4 capitalize">{row.tier}</td>
                    <td className="py-4"><Badge variant={row.status === "approved" || row.status === "active" ? "default" : "outline"}>{row.status}</Badge></td>
                    <td className="py-4">{row.summary?.totalSignups ?? 0}</td>
                    <td className="py-4">{money(row.summary?.pendingCommission ?? 0)}</td>
                    <td className="py-4">{money(row.summary?.paidCommission ?? 0)}</td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => updateAffiliate.mutate({ id: row.id, payload: { status: "approved" } })}>
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => updateAffiliate.mutate({ id: row.id, payload: { status: "suspended" } })}>
                          <PauseCircle className="h-4 w-4" /> Suspend
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => updateAffiliate.mutate({ id: row.id, payload: { status: "rejected" } })}>
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {affiliates.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No affiliates matched.</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Commissions</CardTitle>
          <Button className="rounded-lg bg-[var(--ai)]" disabled={!selectedCommissionIds.length || markPayoutPaid.isPending} onClick={() => markPayoutPaid.mutate()}>
            Mark selected paid
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="pb-3">Pay</th>
                <th className="pb-3">Invoice</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Rate</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Hold until</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.commissions ?? []).map((row: any) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="py-4">
                    <input
                      type="checkbox"
                      checked={selectedCommissionIds.includes(row.id)}
                      disabled={row.status !== "approved" && row.status !== "payable"}
                      onChange={(event) => setSelectedCommissionIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                    />
                  </td>
                  <td className="py-4 font-mono text-xs">{row.invoiceId}</td>
                  <td className="py-4">{money(row.commissionAmount)}</td>
                  <td className="py-4">{row.commissionRateBps / 100}%</td>
                  <td className="py-4"><Badge variant="outline">{row.status}</Badge></td>
                  <td className="py-4 text-muted-foreground">{new Date(row.holdUntilDate).toLocaleDateString()}</td>
                  <td className="py-4">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => updateCommission.mutate({ id: row.id, status: "approved" })}>Approve</Button>
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => updateCommission.mutate({ id: row.id, status: "cancelled" })}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.commissions || data.commissions.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No commissions yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {flags.length > 0 && (
        <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader><CardTitle>Fraud review flags</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-950">
            {flags.map((flag: any) => (
              <div key={flag.id} className="rounded-lg border border-amber-200 bg-white/70 p-3">
                <span className="font-semibold">{flag.flagType}</span>: {flag.detail}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof HandCoins }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-5">
        <Icon className="h-5 w-5 text-[var(--ai)]" />
        <div className="mt-3 text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
