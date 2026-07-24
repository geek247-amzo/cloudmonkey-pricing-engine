import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Building2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/auth/sign-up")({
  validateSearch: (search: Record<string, unknown>) => ({
    bundle: typeof search.bundle === "string" ? search.bundle : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
    coupon: typeof search.coupon === "string" ? search.coupon : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
    callbackURL: typeof search.callbackURL === "string" ? search.callbackURL : undefined,
  }),
  head: () => ({
    meta: [{ title: "Create account - CloudMonkey" }],
    links: [canonicalLink("/auth/sign-up")],
  }),
  component: SignUpPage,
});

function getOrCreateVisitorId() {
  const existing = localStorage.getItem("cloudmonkey:visitor-id");
  if (existing) return existing;
  const created = `vis_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("cloudmonkey:visitor-id", created);
  return created;
}

function onboardingPathForPlan(planId?: string | null) {
  return planId?.startsWith("ci-") || planId === "agent-marketing"
    ? "/dashboard/intelligence-wizard"
    : "/dashboard/ai-wizard";
}

function SignUpPage() {
  const router = useRouter();
  const { bundle, plan, coupon, ref, callbackURL } = Route.useSearch();
  const returnTo = safeDashboardCallback(callbackURL);
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [couponCode, setCouponCode] = useState(coupon ?? "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (bundle) {
      localStorage.setItem("cloudmonkey:selected-bundle", bundle);
    }
    if (plan) {
      localStorage.setItem("cloudmonkey:selected-plan", plan);
    }
    if (ref) {
      const visitorId = getOrCreateVisitorId();
      localStorage.setItem("cloudmonkey:affiliate-ref", ref);
      localStorage.setItem("cloudmonkey:affiliate-ref-created-at", String(Date.now()));
      fetch("/api/public/affiliate-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: ref,
          visitorId,
          sourceUrl: document.referrer || null,
          landingPage: window.location.pathname,
        }),
      }).catch(() => undefined);
    }
    if (coupon) {
      localStorage.setItem("cloudmonkey:coupon-code", coupon);
      setCouponCode(coupon);
    }
  }, [bundle, coupon, plan, ref]);

  useEffect(() => {
    if (!isMounted || isSessionPending || !session) return;

    if (bundle || plan) {
      router.navigate({
        to: onboardingPathForPlan(plan) as "/dashboard/ai-wizard",
        search: {
          plan,
          bundle,
          coupon: coupon ?? localStorage.getItem("cloudmonkey:coupon-code") ?? undefined,
        },
      });
      return;
    }

    window.location.assign(returnTo);
  }, [bundle, isMounted, plan, isSessionPending, returnTo, router, session]);

  const selectedProductLabel = plan ? "Selected service will go straight to checkout after registration." : bundle ? "Selected package will go straight to checkout after registration." : null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Please fill out all fields");
      return;
    }

    try {
      setIsLoading(true);
      const recaptchaToken = await getRecaptchaToken();
      const { error } = await authClient.signUp.email(
        {
          email,
          password,
          name,
        },
        captchaFetchOptions(recaptchaToken),
      );

      if (error) {
        toast.error(error.message || "Failed to create account");
      } else {
        toast.success("Account created successfully");
        await claimCaesarSession().catch(() => null);
        const referralCode = ref ?? localStorage.getItem("cloudmonkey:affiliate-ref");
        const referralCreatedAt = Number(localStorage.getItem("cloudmonkey:affiliate-ref-created-at") ?? 0);
        const referralIsFresh = referralCode && Date.now() - referralCreatedAt <= 60 * 24 * 60 * 60 * 1000;
        if (referralIsFresh) {
          await fetch("/api/user/affiliate/attribute-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referralCode,
              visitorId: localStorage.getItem("cloudmonkey:visitor-id"),
            }),
          }).catch(() => undefined);
        }
        const selectedPlan = plan ?? localStorage.getItem("cloudmonkey:selected-plan");
        const selectedBundle = bundle ?? localStorage.getItem("cloudmonkey:selected-bundle");
        const selectedCoupon = couponCode.trim() || localStorage.getItem("cloudmonkey:coupon-code") || "";

        if (selectedPlan || selectedBundle) {
          try {
            const checkoutResponse = await fetch("/api/user/subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                planId: selectedPlan || null,
                bundleId: selectedPlan ? null : selectedBundle,
                interval: "month",
                couponCode: selectedCoupon || null,
              }),
            });
            const checkout = await checkoutResponse.json().catch(() => ({ error: "Failed to start checkout" }));
            if (checkoutResponse.status === 401) {
              router.navigate({ to: "/dashboard" });
              return;
            }
            if (!checkoutResponse.ok) throw new Error(checkout.error || "Failed to start checkout");
            if (checkout.subscription?.status === "trialing" || checkout.trialing || checkout.alreadyPaid || checkout.discounted) {
              localStorage.removeItem("cloudmonkey:selected-plan");
              localStorage.removeItem("cloudmonkey:selected-bundle");
              localStorage.removeItem("cloudmonkey:coupon-code");
              router.navigate({ to: onboardingPathForPlan(selectedPlan) as "/dashboard/ai-wizard" });
              return;
            }
            if (checkout.authorization_url) {
              window.location.assign(checkout.authorization_url);
              return;
            }
            if (checkout.alreadyActive) {
              localStorage.removeItem("cloudmonkey:selected-plan");
              localStorage.removeItem("cloudmonkey:selected-bundle");
              localStorage.removeItem("cloudmonkey:coupon-code");
              router.navigate({ to: onboardingPathForPlan(selectedPlan) as "/dashboard/ai-wizard" });
              return;
            }
          } catch (checkoutError: any) {
            toast.error(checkoutError.message || "Account created, but checkout could not start");
            router.navigate({ to: "/dashboard/billing" });
            return;
          }
        }

        window.location.assign(returnTo);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isMounted && (isSessionPending || session)) {
    return (
      <AuthShell
        eyebrow="Account ready"
        title={<>Preparing your checkout.</>}
        subtitle="You are already signed in. We are taking you to your dashboard to continue with the selected package."
      >
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-6 text-sm text-muted-foreground">
          Redirecting to your dashboard...
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title={<>Start your CloudMonkey workspace.</>}
      subtitle="Create a new account with email, Google, or Office 365 and set up your team-ready access structure."
      footer={
        <>
          Already have access? <Link to="/auth/sign-in" search={{ callbackURL: returnTo }} className="font-medium text-foreground hover:underline">Sign in</Link>
        </>
      }
    >
      <ProviderButtons
        label="Create with"
        callbackURL={`/auth/sso-callback?callbackURL=${encodeURIComponent(returnTo)}`}
      />
      <SectionDivider text="Or create with email" />

      <form className="grid gap-4" onSubmit={handleSignUp}>
        {selectedProductLabel && (
          <div className="rounded-2xl border border-[var(--ai)]/20 bg-[var(--ai)]/8 px-4 py-3 text-sm text-foreground">
            {selectedProductLabel}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input 
              id="fullName" 
              placeholder="Full legal name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input 
              id="company" 
              placeholder="Company or organization" 
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workEmail">Work email</Label>
          <Input 
            id="workEmail" 
            type="email" 
            placeholder="name@company.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">Password</Label>
          <Input 
            id="newPassword" 
            type="password" 
            placeholder="Create a strong password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        {(plan || bundle || (isMounted && (localStorage.getItem("cloudmonkey:selected-plan") || localStorage.getItem("cloudmonkey:selected-bundle")))) && (
          <div className="space-y-2">
            <Label htmlFor="couponCode">Coupon code</Label>
            <Input
              id="couponCode"
              placeholder="Optional"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value);
                if (e.target.value.trim()) localStorage.setItem("cloudmonkey:coupon-code", e.target.value.trim());
                else localStorage.removeItem("cloudmonkey:coupon-code");
              }}
              disabled={isLoading}
            />
          </div>
        )}

        <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border text-[var(--ai)] focus:ring-[var(--ai)]" required />
          <span>
            I agree to the{" "}
            <Link to="/legal/terms" className="font-semibold text-foreground underline">
              CloudMonkey Terms
            </Link>{" "}
            and{" "}
            <Link to="/legal/privacy" className="font-semibold text-foreground underline">
              Privacy Notice
            </Link>
            . I understand that Google and Microsoft connections can be linked later from account settings.
          </span>
        </label>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]"
        >
          {isLoading ? "Creating account..." : "Create account"}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
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
