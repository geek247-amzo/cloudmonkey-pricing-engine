import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, CircleDashed, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/sso-callback")({
  head: () => ({
    meta: [{ title: "SSO callback - CloudMonkey" }],
  }),
  component: SsoCallbackPage,
});

function SsoCallbackPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.navigate({ to: "/auth/sign-in" });
      return;
    }

    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const finish = async () => {
      const referralCode = localStorage.getItem("cloudmonkey:affiliate-ref");
      const referralCreatedAt = Number(localStorage.getItem("cloudmonkey:affiliate-ref-created-at") ?? 0);
      const referralIsFresh = referralCode && Date.now() - referralCreatedAt <= 60 * 24 * 60 * 60 * 1000;

      if (referralIsFresh) {
        const response = await fetch("/api/user/affiliate/attribute-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referralCode,
            visitorId: localStorage.getItem("cloudmonkey:visitor-id"),
          }),
        }).catch(() => null);

        if (response?.ok) {
          localStorage.removeItem("cloudmonkey:affiliate-ref");
          localStorage.removeItem("cloudmonkey:affiliate-ref-created-at");
        }
      }

      router.navigate({ to: "/dashboard" });
    };

    finish().catch(() => router.navigate({ to: "/dashboard" }));
  }, [isPending, router, session]);

  return (
    <AuthShell
      eyebrow="SSO callback"
      title={<>Completing sign in.</>}
      subtitle="We’re finalizing your Google or Office 365 sign-in and preparing your CloudMonkey session."
      footer={
        <>
          If this takes too long, <Link to="/auth/sso-error" className="font-medium text-foreground hover:underline">view SSO troubleshooting</Link>
        </>
      }
    >
      <Card className="border-border/70 bg-muted/30 shadow-sm">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
            <CircleDashed className="h-6 w-6 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Processing provider response</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Validating the external identity token and loading your dashboard permissions.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Security checks</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">MFA, provider claims, and team membership are validated before entry.</p>
        </div>
        <Button asChild variant="outline" className="h-full rounded-2xl border-border/70 bg-card shadow-sm">
          <Link to="/dashboard">
            Continue to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </AuthShell>
  );
}
