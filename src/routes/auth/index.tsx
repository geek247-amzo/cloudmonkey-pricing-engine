import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "CloudMonkey Identity" },
      { name: "description", content: "Choose how to continue into your CloudMonkey account." },
    ],
  }),
  component: AuthIndexPage,
});

function AuthIndexPage() {
  return (
    <AuthShell
      eyebrow="Identity hub"
      title={<>Choose how you want to continue.</>}
      subtitle="Sign in, create a new account, or jump straight into Google and Office 365 SSO."
      footer={
        <>
          Need help? <Link to="/auth/sso-error" className="font-medium text-foreground hover:underline">View SSO recovery options</Link>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.7))] shadow-sm">
          <CardContent className="p-5">
            <ShieldCheck className="h-5 w-5 text-[var(--ai)]" />
            <div className="mt-3 text-base font-semibold text-foreground">Existing account</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Continue with email, Google, or Microsoft 365.</p>
            <Button asChild className="mt-4 w-full rounded-2xl bg-[var(--ai)]">
              <Link to="/auth/sign-in">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-[linear-gradient(135deg,var(--cloud-soft),rgba(255,255,255,0.85))] shadow-sm">
          <CardContent className="p-5">
            <ShieldCheck className="h-5 w-5 text-[var(--cloud)]" />
            <div className="mt-3 text-base font-semibold text-foreground">New to CloudMonkey?</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Create your account with email or a provider-linked SSO identity.</p>
            <Button asChild variant="outline" className="mt-4 w-full rounded-2xl border-border/70 bg-card">
              <Link to="/auth/sign-up">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/50 p-5">
        <div className="text-sm font-semibold text-foreground">What is included</div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Email login, Google SSO, Office 365 SSO, email verification, password recovery, and session recovery flows.
        </p>
      </div>
    </AuthShell>
  );
}
