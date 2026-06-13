import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, MailCheck, RefreshCcw } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/auth/verify-email")({
  head: () => ({
    meta: [{ title: "Verify email - CloudMonkey" }],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      title={<>Verify your email address.</>}
      subtitle="Open the verification message we sent, confirm your account, and continue into CloudMonkey."
      footer={
        <>
          Need a new link? <Link to="/auth/forgot-password" className="font-medium text-foreground hover:underline">Resend verification options</Link>
        </>
      }
    >
      <div className="rounded-[1.75rem] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
            <MailCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Verification email sent</div>
            <p className="text-sm text-muted-foreground">alex@cloudmonkey.co.za</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-[var(--ai-soft)] text-[var(--ai)]">Verify inbox</Badge>
          <Badge variant="secondary" className="bg-[var(--cloud-soft)] text-[var(--cloud)]">Allow resend</Badge>
          <Badge variant="secondary" className="bg-[var(--business-soft)] text-[var(--business)]">Link later</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button className="h-11 rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
            Open inbox
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-card shadow-sm">
            <RefreshCcw className="h-4 w-4" />
            Resend email
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <CheckCircle2 className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Confirmed identity</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Verification unlocks the rest of the onboarding and linking flows.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <MailCheck className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Safe by default</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">You can always resend verification without exposing the account state.</p>
        </div>
      </div>
    </AuthShell>
  );
}
