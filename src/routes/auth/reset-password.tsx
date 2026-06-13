import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password - CloudMonkey" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Set a new password"
      title={<>Choose a new password.</>}
      subtitle="Create a fresh password for your CloudMonkey identity and regain access to your account."
      footer={
        <>
          Back to <Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">sign in</Link>
        </>
      }
    >
      <form className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="newPass">New password</Label>
          <Input id="newPass" type="password" placeholder="Enter a new password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPass">Confirm password</Label>
          <Input id="confirmPass" type="password" placeholder="Repeat the new password" />
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
          Passwords should be at least 12 characters and include upper, lower, number, and symbol characters.
        </div>
        <Button className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
          Save new password
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <KeyRound className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Recovery token</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">This page represents the tokenized reset flow after the email link is opened.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
          <div className="mt-3 text-sm font-semibold text-foreground">Security check</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sessions can be invalidated after a password change from the backend dashboard.</p>
        </div>
      </div>
    </AuthShell>
  );
}
