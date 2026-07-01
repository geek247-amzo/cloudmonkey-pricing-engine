import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Sparkles, UsersRound, Wallet } from "lucide-react";
import { useEffect } from "react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/crm")({
  head: () => ({
    meta: [{ title: "CRM - CloudMonkey Dashboard" }],
  }),
  component: CrmPage,
});

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function CrmPage() {
  const navigate = useNavigate();
  const { authReady, isAdmin } = useAdminAccess();

  useEffect(() => {
    if (authReady && !isAdmin) navigate({ to: "/dashboard" });
  }, [authReady, isAdmin, navigate]);

  const [users, subscriptions, onboarding] = useQueries({
    queries: [
      { queryKey: ["admin", "crm", "users"], queryFn: () => fetchJson("/api/admin/users"), enabled: isAdmin },
      { queryKey: ["admin", "crm", "subscriptions"], queryFn: () => fetchJson("/api/admin/subscriptions"), enabled: isAdmin },
      { queryKey: ["admin", "crm", "onboarding"], queryFn: () => fetchJson("/api/admin/onboarding"), enabled: isAdmin },
    ],
  });

  if (!authReady || !isAdmin) return <div className="p-8 text-center">Checking permissions...</div>;

  const userRows = users.data ?? [];
  const subscriptionRows = subscriptions.data ?? [];
  const onboardingRows = onboarding.data ?? [];

  const customerCount = userRows.filter((item: any) => item.role === "customer").length;
  const activeSubscriptions = subscriptionRows.filter((item: any) => item.status === "active" || item.status === "trialing").length;
  const pendingSubscriptions = subscriptionRows.filter((item: any) => item.status === "pending").length;

  const latestSubscriptionByUser = new Map<string, any>();
  subscriptionRows.forEach((item: any) => {
    if (!latestSubscriptionByUser.has(item.userId)) {
      latestSubscriptionByUser.set(item.userId, item);
    }
  });

  const onboardingByUser = new Map<string, any>();
  onboardingRows.forEach((item: any) => {
    if (!onboardingByUser.has(item.userId)) {
      onboardingByUser.set(item.userId, item);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title={<>Customers and wizard answers.</>}
        subtitle="Track customer accounts, onboarding submissions, subscription status, and product onboarding responses in one place."
        actions={
          <Button asChild className="rounded-lg bg-[var(--ai)]">
            <Link to="/dashboard/ai-wizard">
              Open onboarding
              <Sparkles className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Customers", value: customerCount, icon: UsersRound },
          { label: "Onboarding submissions", value: onboardingRows.length, icon: Sparkles },
          { label: "Active subscriptions", value: activeSubscriptions, icon: CheckCircle2 },
          { label: "Pending subscriptions", value: pendingSubscriptions, icon: Clock3 },
        ].map((item) => (
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
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Subscription</th>
                <th className="pb-3">Wizard</th>
                <th className="pb-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((item: any) => {
                const subscription = latestSubscriptionByUser.get(item.id);
                const submission = onboardingByUser.get(item.id);
                return (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="py-4">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </td>
                    <td className="py-4">
                      <Badge variant={item.role === "customer" ? "default" : "outline"}>{item.role}</Badge>
                    </td>
                    <td className="py-4">
                      {subscription ? (
                        <div className="space-y-1">
                          <Badge variant={subscription.status === "active" || subscription.status === "trialing" ? "default" : "outline"}>{subscription.status}</Badge>
                          <div className="text-xs text-muted-foreground">{subscription.name}</div>
                        </div>
                      ) : (
                        <Badge variant="outline">No subscription</Badge>
                      )}
                    </td>
                    <td className="py-4">
                      {submission ? (
                        <Badge variant={submission.status === "sent_to_n8n" ? "default" : "secondary"}>{submission.status}</Badge>
                      ) : (
                        <Badge variant="outline">No onboarding</Badge>
                      )}
                    </td>
                    <td className="py-4 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Product onboarding submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!onboardingRows.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No wizard submissions yet.</div>
          ) : onboardingRows.map((submission: any) => {
            const parsedAnswers = parseWizardAnswers(submission.answers);
            return (
              <div key={submission.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{submission.user?.name ?? "Customer"}</div>
                    <div className="text-sm text-muted-foreground">{submission.user?.email} {submission.subscription?.name ? `· ${submission.subscription.name}` : ""}</div>
                  </div>
                  <Badge variant={submission.status === "sent_to_n8n" ? "default" : "outline"}>{submission.status}</Badge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {parsedAnswers ? (
                    <>
                      <AnswerBlock label="Company" value={summarizeAnswerValue(parsedAnswers.companyName)} />
                      <AnswerBlock label="Contact" value={summarizeAnswerValue(parsedAnswers.primaryContact)} />
                      <AnswerBlock label="Timeline" value={summarizeAnswerValue(parsedAnswers.launchTimeline)} />
                      <AnswerBlock label="Product notes" value={summarizeAnswerValue(parsedAnswers.agentGoal ?? parsedAnswers.websiteGoal ?? parsedAnswers.serverPurpose ?? parsedAnswers.domainName ?? parsedAnswers.constraints)} />
                    </>
                  ) : (
                    <AnswerBlock label="Answers" value="No answer data stored yet" />
                  )}
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Submitted {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "recently"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function parseWizardAnswers(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, string | string[]>;
  } catch {
    return null;
  }
}

function summarizeAnswerValue(value?: string | string[]) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None selected";
  return value || "None selected";
}

function AnswerBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-[#f8faff] p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
