import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { ProviderButtons, SectionDivider } from "@/components/auth/AuthProviders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { captchaFetchOptions, getRecaptchaToken } from "@/lib/recaptcha";
import { canonicalLink } from "@/lib/seo";
import { safeDashboardCallback } from "@/lib/auth-redirect";
import { claimCaesarSession } from "@/lib/caesar-client";

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    callbackURL: typeof search.callbackURL === "string" ? search.callbackURL : undefined,
  }),
  head: () => ({
    meta: [{ title: "Sign in - CloudMonkey" }],
    links: [canonicalLink("/auth/sign-in")],
  }),
  component: SignInPage,
});

function SignInPage() {
  const router = useRouter();
  const { callbackURL } = Route.useSearch();
  const returnTo = safeDashboardCallback(callbackURL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    try {
      setIsLoading(true);
      const recaptchaToken = await getRecaptchaToken();
      const { data, error } = await authClient.signIn.email(
        {
          email,
          password,
        },
        captchaFetchOptions(recaptchaToken),
      );

      if (error) {
        toast.error(error.message || "Failed to sign in");
      } else if (data?.twoFactorRedirect) {
        // Better Auth completes the password step first and returns this
        // marker when the account requires TOTP. The pending 2FA challenge
        // is held in the auth cookie, so move directly to the verifier.
        router.navigate({ to: "/auth/two-factor" });
      } else {
        await claimCaesarSession().catch(() => null);
        window.location.assign(returnTo);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title={<>Sign in to CloudMonkey.</>}
      subtitle="Use your email address, Google account, or Office 365 identity to access the backend and platform tools."
      footer={
        <>
          New here?{" "}
          <Link
            to="/auth/sign-up"
            search={{ callbackURL: returnTo }}
            className="font-medium text-foreground hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <ProviderButtons label="Sign in with" callbackURL={returnTo} />
      <SectionDivider />

      <form className="space-y-4" onSubmit={handleSignIn}>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@cloudmonkey.co.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/auth/forgot-password"
              className="text-sm font-medium text-[var(--ai)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-[var(--ai)] focus:ring-[var(--ai)]"
            />
            Keep me signed in
          </label>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[var(--ai)]" />
            Secure session
          </span>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]"
        >
          {isLoading ? "Signing in..." : "Sign in"}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: CheckCircle2,
            label: "One identity",
            desc: "Email, Google, and Microsoft access in one flow.",
          },
          {
            icon: LockKeyhole,
            label: "Security first",
            desc: "MFA, sessions, and recovery states built into the UI.",
          },
          {
            icon: ShieldCheck,
            label: "Team ready",
            desc: "Invite, link, and manage access without leaving the brand theme.",
          },
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
