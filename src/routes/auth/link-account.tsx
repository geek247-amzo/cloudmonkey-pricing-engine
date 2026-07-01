import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { ProviderButtons } from "@/components/auth/AuthProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/link-account")({
  head: () => ({
    meta: [{ title: "Link account - CloudMonkey" }],
  }),
  component: LinkAccountPage,
});

function LinkAccountPage() {
  return (
    <AuthShell
      eyebrow="Account linking"
      title={<>Link your identity providers.</>}
      subtitle="Connect email, Google, and Office 365 access to the same CloudMonkey user profile."
      footer={
        <>
          Need to start over? <Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Return to sign in</Link>
        </>
      }
    >
      <Card className="border-border/70 bg-muted/30 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai)]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Primary account</div>
              <p className="text-sm text-muted-foreground">Use the email address on your CloudMonkey account.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="text-sm font-semibold text-foreground">Google</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Link a Google Workspace identity for faster SSO access.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="text-sm font-semibold text-foreground">Office 365</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Link Microsoft 365 to keep enterprise access consistent.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProviderButtons label="Link with" />

      <div className="space-y-2">
        <Label htmlFor="linkEmail">Confirm account email</Label>
        <Input id="linkEmail" type="email" placeholder="name@company.com" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button className="h-11 rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]">
          Link account
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-card shadow-sm">
          <ShieldCheck className="h-4 w-4" />
          Review security
        </Button>
      </div>
    </AuthShell>
  );
}
