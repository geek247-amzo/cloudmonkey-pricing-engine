import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, RefreshCcw, ShieldX } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth/sso-error")({
  head: () => ({
    meta: [{ title: "SSO error - CloudMonkey" }],
  }),
  component: SsoErrorPage,
});

function SsoErrorPage() {
  return (
    <AuthShell
      eyebrow="SSO issue"
      title={<>We couldn’t complete the provider sign in.</>}
      subtitle="Use this page for configuration errors, consent issues, or identity provider failures."
      footer={
        <>
          Try again from <Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">sign in</Link>
        </>
      }
    >
      <Card className="border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.93),rgba(255,255,255,0.75))] shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--destructive)]/10 text-[var(--destructive)]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Provider callback failed</div>
              <p className="text-sm text-muted-foreground">The identity provider returned an error or a missing consent response.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            Common reasons include missing admin consent, an expired login session, or a blocked tenant policy.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="h-11 rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
          Retry sign in
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-card shadow-sm">
          <RefreshCcw className="h-4 w-4" />
          Try another provider
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <ShieldX className="h-5 w-5 text-[var(--destructive)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Admin contact</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Use this when your tenant needs a configuration review or consent change.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <RefreshCcw className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Recovery path</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Fallback to email sign-in if provider access is unavailable.</p>
        </div>
      </div>
    </AuthShell>
  );
}
