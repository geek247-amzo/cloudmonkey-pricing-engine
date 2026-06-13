import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { ProviderButtons, SectionDivider } from "@/components/auth/AuthProviders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({
    meta: [{ title: "Sign in - CloudMonkey" }],
  }),
  component: SignInPage,
});

function SignInPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title={<>Sign in to CloudMonkey.</>}
      subtitle="Use your email address, Google account, or Office 365 identity to access the backend and platform tools."
      footer={
        <>
          New here? <Link to="/auth/sign-up" className="font-medium text-foreground hover:underline">Create an account</Link>
        </>
      }
    >
      <ProviderButtons label="Sign in with" />
      <SectionDivider />

      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@cloudmonkey.co.za" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth/forgot-password" className="text-sm font-medium text-[var(--ai)] hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="Enter your password" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 rounded border-border text-[var(--ai)] focus:ring-[var(--ai)]" />
            Keep me signed in
          </label>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[var(--ai)]" />
            Secure session
          </span>
        </div>

        <Button className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: CheckCircle2, label: "Email login", desc: "Password or magic link ready." },
          { icon: LockKeyhole, label: "SSO supported", desc: "Google and Microsoft entry points." },
          { icon: ShieldCheck, label: "Audit-friendly", desc: "Built for session traceability." },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <item.icon className="h-5 w-5 text-[var(--ai)]" />
            <div className="mt-3 text-sm font-semibold text-foreground">{item.label}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </AuthShell>
  );
}
