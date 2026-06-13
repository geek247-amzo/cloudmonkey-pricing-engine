import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Receipt, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({
    meta: [{ title: "Billing - CloudMonkey Dashboard" }],
  }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title={<>Billing and plans.</>}
        subtitle="Review subscriptions, invoices, and usage without leaving the backend console."
        actions={
          <>
            <Button variant="outline" className="rounded-2xl border-border/70 bg-card shadow-sm">
              <Receipt className="h-4 w-4" />
              Export invoice
            </Button>
            <Button asChild className="rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
              <Link to="/dashboard/reports">
                Usage report
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-[linear-gradient(135deg,var(--primary),var(--primary-glow))] p-5 text-primary-foreground shadow-[var(--shadow-elevated)]">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-white/75">Complete bundle</div>
              <div className="mt-3 text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>R 4,999</div>
              <p className="mt-2 text-sm text-white/85">Cloud, business, and AI in one managed backend subscription.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Paid this month", value: "R 4,999" },
                { label: "Next renewal", value: "28 Jun 2026" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Usage summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Seats used", value: "28 / 40", pct: 70 },
              { label: "Storage", value: "1.2 TB / 2 TB", pct: 60 },
              { label: "SSO sign-ins", value: "93% provider login", pct: 93 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">{item.value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-[var(--ai)]" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-[var(--ai)]" />
                Payment controls
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Invoice history, recurring plan control, and payment method management all belong here.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="pb-3 font-semibold">Invoice</th>
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["#2048", "13 Jun 2026", "R 4,999", "Paid"],
                ["#2047", "13 May 2026", "R 4,999", "Paid"],
                ["#2046", "13 Apr 2026", "R 4,999", "Paid"],
              ].map(([invoice, date, amount, status]) => (
                <tr key={invoice} className="border-b border-border/60 last:border-0">
                  <td className="py-4 font-medium text-foreground">{invoice}</td>
                  <td className="py-4 text-muted-foreground">{date}</td>
                  <td className="py-4 text-muted-foreground">{amount}</td>
                  <td className="py-4">
                    <Badge className="rounded-full">{status}</Badge>
                  </td>
                  <td className="py-4">
                    <Button variant="outline" size="sm" className="rounded-xl border-border/70 bg-card shadow-sm">
                      <FileText className="h-4 w-4" />
                      View PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
