import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, CreditCard, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/wallet")({
  head: () => ({
    meta: [{ title: "Wallet - CloudMonkey Dashboard" }],
  }),
  component: WalletPage,
});

async function fetchJson<T>(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Failed to fetch ${path}`);
  }
  return data as T;
}

function money(tokens: number) {
  return `${Number(tokens || 0).toLocaleString()} token${Number(tokens) === 1 ? "" : "s"}`;
}

const TOKENS_PER_ZAR = 100;
const MIN_TOP_UP_ZAR = 250;
const MAX_SELF_SERVICE_TOP_UP_ZAR = 10_000;

function WalletPage() {
  const queryClient = useQueryClient();
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(false);
  const [autoTopUpThresholdTokens, setAutoTopUpThresholdTokens] = useState("100");
  const [autoTopUpAmountTokens, setAutoTopUpAmountTokens] = useState("500");

  const walletQuery = useQuery({
    queryKey: ["user", "wallet"],
    queryFn: () =>
      fetchJson<{
        wallet: {
          balanceTokens: number;
          reservedTokens: number;
          autoTopUpEnabled?: boolean | null;
          autoTopUpThresholdTokens?: number | null;
          autoTopUpAmountTokens?: number | null;
        } | null;
        availableTokens: number;
        ledger: Array<{
          id: string;
          entryType: string;
          amountTokens: number;
          createdAt: string;
          sourceType?: string | null;
          sourceId?: string | null;
        }>;
        reservations: Array<{
          id: string;
          featureKey: string;
          status: string;
          reservedTokens: number;
          expiresAt: string;
          sourceType?: string | null;
        }>;
        topUpIntents: Array<{
          id: string;
          amountTokens: number;
          status: string;
          paystackUrl?: string | null;
          createdAt: string;
        }>;
        featureRates: Array<{
          featureKey: string;
          displayName: string;
          baseTokenCost: number;
          multiplierBps: number;
          notes?: string | null;
        }>;
      }>("/api/user/wallet"),
  });

  useEffect(() => {
    if (!walletQuery.data?.wallet) return;
    setAutoTopUpEnabled(Boolean(walletQuery.data.wallet.autoTopUpEnabled));
    setAutoTopUpThresholdTokens(
      String((walletQuery.data.wallet.autoTopUpThresholdTokens ?? 0) / TOKENS_PER_ZAR),
    );
    setAutoTopUpAmountTokens(
      String((walletQuery.data.wallet.autoTopUpAmountTokens ?? 0) / TOKENS_PER_ZAR),
    );
  }, [walletQuery.data?.wallet]);

  const topUpMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ paystackUrl?: string; authorization_url?: string }>(`/api/user/wallet/top-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountTokens: Number(topUpAmount) * TOKENS_PER_ZAR,
          paymentMethod: "gateway",
        }),
      }),
    onSuccess: (data) => {
      toast.success("Top-up intent created");
      queryClient.invalidateQueries({ queryKey: ["user", "wallet"] });
      const target = data.paystackUrl || data.authorization_url;
      if (target) window.location.assign(target);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{
        ok: true;
        wallet: {
          autoTopUpEnabled: boolean;
          autoTopUpThresholdTokens: number;
          autoTopUpAmountTokens: number;
        };
      }>("/api/user/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoTopUpEnabled,
          autoTopUpThresholdTokens: Number(autoTopUpThresholdTokens) * TOKENS_PER_ZAR,
          autoTopUpAmountTokens: Number(autoTopUpAmountTokens) * TOKENS_PER_ZAR,
        }),
      }),
    onSuccess: () => {
      toast.success("Wallet settings saved");
      queryClient.invalidateQueries({ queryKey: ["user", "wallet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const balance = walletQuery.data?.wallet?.balanceTokens ?? 0;
  const reserved = walletQuery.data?.wallet?.reservedTokens ?? 0;
  const available = walletQuery.data?.availableTokens ?? Math.max(0, balance - reserved);
  const featureRates = walletQuery.data?.featureRates ?? [];
  const recentLedger = walletQuery.data?.ledger ?? [];
  const recentTopUps = walletQuery.data?.topUpIntents ?? [];
  const recentReservations = walletQuery.data?.reservations ?? [];
  const canTopUp =
    Number(topUpAmount) >= MIN_TOP_UP_ZAR &&
    Number(topUpAmount) <= MAX_SELF_SERVICE_TOP_UP_ZAR &&
    Number.isFinite(Number(topUpAmount));

  const statusBadge = useMemo(() => {
    if (available > 0) return <Badge variant="default">Healthy</Badge>;
    if (reserved > 0) return <Badge variant="outline">Reserved</Badge>;
    return <Badge variant="secondary">Empty</Badge>;
  }, [available, reserved]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet"
        title={<>Token balance and top-ups.</>}
        subtitle="Tokens fund billable AI tools such as website generation and analytics. The logged-in CloudMonkey copilot is included and does not use this balance."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Available</div>
                <div className="mt-2 text-3xl font-bold text-foreground">{money(available)}</div>
              </div>
              <Coins className="h-5 w-5 text-[#5a78f7]" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Reserved</div>
                <div className="mt-2 text-3xl font-bold text-foreground">{money(reserved)}</div>
              </div>
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-2 text-3xl font-bold text-foreground">{statusBadge}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Top up tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-top-up-amount">Top-up amount (ZAR)</Label>
              <Input
                id="wallet-top-up-amount"
                type="number"
                min={MIN_TOP_UP_ZAR}
                max={MAX_SELF_SERVICE_TOP_UP_ZAR}
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum R250. Top-ups above R10,000 require manual approval.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-lg"
                onClick={() => topUpMutation.mutate()}
                disabled={!canTopUp || topUpMutation.isPending}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {topUpMutation.isPending ? "Creating top-up..." : "Create Paystack top-up"}
              </Button>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => walletQuery.refetch()}
                disabled={walletQuery.isFetching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh wallet
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Top-ups are credited only after Paystack confirms payment. New customers can use the
              AI features below, but they need wallet balance before a reservation can commit.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Auto top-up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-auto-top-up-enabled">Enable auto top-up</Label>
              <select
                id="wallet-auto-top-up-enabled"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={autoTopUpEnabled ? "true" : "false"}
                onChange={(event) => setAutoTopUpEnabled(event.target.value === "true")}
              >
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wallet-auto-top-up-threshold">Low-balance threshold (ZAR)</Label>
                <Input
                  id="wallet-auto-top-up-threshold"
                  type="number"
                  min="0"
                  value={autoTopUpThresholdTokens}
                  onChange={(event) => setAutoTopUpThresholdTokens(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wallet-auto-top-up-amount">Automatic top-up (ZAR)</Label>
                <Input
                  id="wallet-auto-top-up-amount"
                  type="number"
                  min="0"
                  value={autoTopUpAmountTokens}
                  onChange={(event) => setAutoTopUpAmountTokens(event.target.value)}
                />
              </div>
            </div>
            <Button
              className="rounded-lg"
              onClick={() => settingsMutation.mutate()}
              disabled={settingsMutation.isPending}
            >
              Save wallet settings
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Recent reservations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recentReservations.length ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No reservations yet.
              </div>
            ) : (
              recentReservations.map((reservation) => (
                <div key={reservation.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{reservation.featureKey}</div>
                    <Badge variant={reservation.status === "pending" ? "outline" : "secondary"}>
                      {reservation.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    {money(reservation.reservedTokens)} · expires{" "}
                    {new Date(reservation.expiresAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Current feature rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!featureRates.length ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No feature rates configured.
              </div>
            ) : (
              featureRates.map((rate) => (
                <div key={rate.featureKey} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{rate.displayName}</div>
                      <div className="text-muted-foreground">{rate.featureKey}</div>
                    </div>
                    <Badge variant="secondary">{money(rate.baseTokenCost)} base</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Recent ledger entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recentLedger.length ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No ledger entries yet.
              </div>
            ) : (
              recentLedger.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{entry.entryType}</div>
                    <Badge variant={entry.direction === "debit" ? "outline" : "default"}>
                      {entry.direction}
                    </Badge>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    {money(entry.amountTokens)} · {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Recent top-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recentTopUps.length ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No top-ups yet.</div>
            ) : (
              recentTopUps.map((intent) => (
                <div key={intent.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{money(intent.amountTokens)}</div>
                    <Badge variant={intent.status === "paid" ? "default" : "outline"}>
                      {intent.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
                    <span>{new Date(intent.createdAt).toLocaleString()}</span>
                    {intent.paystackUrl && (
                      <a
                        href={intent.paystackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Continue payment
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
