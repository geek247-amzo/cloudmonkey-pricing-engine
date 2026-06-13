import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Building2, UserRound } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { ProviderButtons, SectionDivider } from "@/components/auth/AuthProviders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [{ title: "Create account - CloudMonkey" }],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title={<>Start your CloudMonkey workspace.</>}
      subtitle="Create a new account with email, Google, or Office 365 and set up your team-ready access structure."
      footer={
        <>
          Already have access? <Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Sign in</Link>
        </>
      }
    >
      <ProviderButtons label="Create with" />
      <SectionDivider text="Or create with email" />

      <form className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" placeholder="Alex Johnson" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" placeholder="CloudMonkey Ltd" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workEmail">Work email</Label>
          <Input id="workEmail" type="email" placeholder="alex@cloudmonkey.co.za" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">Password</Label>
          <Input id="newPassword" type="password" placeholder="Create a strong password" />
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border text-[var(--ai)] focus:ring-[var(--ai)]" />
          <span>
            I agree to the CloudMonkey terms and understand that Google and Microsoft connections can be linked later from account settings.
          </span>
        </label>

        <Button className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
          Create account
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: UserRound, label: "Personalize", desc: "Set profile and team defaults." },
          { icon: Building2, label: "Workspace ready", desc: "Built for backend and admin access." },
          { icon: BadgeCheck, label: "Provider linking", desc: "Connect Google or Microsoft after signup." },
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
