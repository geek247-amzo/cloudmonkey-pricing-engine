import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, HandCoins, LinkIcon, Megaphone, UsersRound } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/affiliates")({
  head: () => ({
    meta: [{ title: "Affiliate Dashboard - CloudMonkey" }],
  }),
  component: AffiliateDashboardPage,
});

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function formatMoney(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function AffiliateDashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["user", "affiliate"],
    queryFn: () => fetchJson("/api/user/affiliate"),
    enabled: !!session,
  });

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/auth/sign-in" });
  }, [isPending, navigate, session]);

  if (isLoading || isPending) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading affiliate dashboard...</div>;
  }

  if (!data?.affiliate) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Affiliate"
          title={<>Affiliate program.</>}
          subtitle="Apply to receive a tracked referral link and earn commission on approved paid signups."
          actions={
            <Button asChild className="rounded-lg bg-[var(--ai)]">
              <Link to="/affiliates">
                Apply now <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="p-8 text-sm text-muted-foreground">
            No affiliate profile is connected to this account yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  const affiliate = data.affiliate;
  const summary = data.summary ?? {};
  const isApproved = affiliate.status === "approved" || affiliate.status === "active";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliate"
        title={<>Referral performance.</>}
        subtitle="Track referred signups, paid customers, commissions, and payouts."
        actions={
          <Button
            className="rounded-lg bg-[var(--ai)]"
            disabled={!isApproved}
            onClick={() => {
              navigator.clipboard.writeText(affiliate.referralLink);
              toast.success("Referral link copied");
            }}
          >
            <Copy className="h-4 w-4" />
            Copy link
          </Button>
        }
      />

      {!isApproved && (
        <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm text-amber-900">
            Your affiliate account is currently <span className="font-semibold">{affiliate.status}</span>. Referral links become commissionable after admin approval.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Metric label="Clicks" value={summary.totalClicks ?? 0} icon={LinkIcon} />
        <Metric label="Signups" value={summary.totalSignups ?? 0} icon={UsersRound} />
        <Metric label="Pending" value={formatMoney(summary.pendingCommission ?? 0)} icon={HandCoins} />
        <Metric label="Paid" value={formatMoney(summary.paidCommission ?? 0)} icon={HandCoins} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Program details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="Tier" value={affiliate.tier} />
            <Detail label="Status" value={affiliate.status} />
            <Detail label="Commission rate" value={`${affiliate.commissionRateBps / 100}%`} />
            <Detail label="Minimum payout" value="R 250.00" />
            <div className="sm:col-span-2">
              <div className="text-sm text-muted-foreground">Referral link</div>
              <div className="mt-1 break-all rounded-lg border border-border bg-muted/40 p-3 text-sm font-medium text-foreground">{affiliate.referralLink}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Marketing assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Asset title="Short pitch" body="CloudMonkey brings cloud hosting, domains, managed IT, billing, and AI agents into one business platform." />
            <Asset title="WhatsApp template" body={`I use CloudMonkey for cloud and AI services. You can sign up here: ${affiliate.referralLink}`} />
            <Asset title="Email intro" body={`Hi, I thought CloudMonkey may be useful for your cloud, domain, hosting, or AI requirements. My referral link is ${affiliate.referralLink}.`} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Signup</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Commission</th>
              </tr>
            </thead>
            <tbody>
              {(data.referrals ?? []).map((row: any) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="py-4 font-medium text-foreground">{row.customerName}</td>
                  <td className="py-4 text-muted-foreground">{row.signupDate ? new Date(row.signupDate).toLocaleDateString() : "Not signed up"}</td>
                  <td className="py-4"><Badge variant="outline">{row.status}</Badge></td>
                  <td className="py-4"><Badge>{row.commissionStatus}</Badge></td>
                </tr>
              ))}
              {(!data.referrals || data.referrals.length === 0) && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No referrals tracked yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold capitalize text-foreground">{value}</div>
    </div>
  );
}

function Asset({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Megaphone className="h-4 w-4 text-[var(--ai)]" />
        {title}
      </div>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}
