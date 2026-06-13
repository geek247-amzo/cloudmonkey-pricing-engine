import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MailQuestion, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot password - CloudMonkey" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password recovery"
      title={<>Reset your password.</>}
      subtitle="We’ll send a secure reset link to your email address so you can get back into your CloudMonkey account."
      footer={
        <>
          Remembered it? <Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Return to sign in</Link>
        </>
      }
    >
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recoveryEmail">Email address</Label>
          <Input id="recoveryEmail" type="email" placeholder="you@cloudmonkey.co.za" />
        </div>
        <Button className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
          Send reset link
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <MailQuestion className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Check your inbox</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">The reset link will expire after a short period for security.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Provider accounts</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Google and Office 365 accounts can be re-linked after password recovery.</p>
        </div>
      </div>
    </AuthShell>
  );
}
