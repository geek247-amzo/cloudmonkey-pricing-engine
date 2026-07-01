import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, HandCoins, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/affiliates")({
  head: () => ({
    meta: [{ title: "CloudMonkey Affiliate Program" }],
  }),
  component: AffiliatesPage,
});

function AffiliatesPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("termsAccepted") !== "on") {
      toast.error("Please accept the affiliate terms");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/public/affiliate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email"),
          phone: form.get("phone"),
          companyName: form.get("companyName"),
          website: form.get("website"),
          socialLinks: form.get("socialLinks"),
          affiliateType: form.get("affiliateType"),
          expectedReferralMethod: form.get("expectedReferralMethod"),
          payoutDetails: form.get("payoutDetails"),
          termsAccepted: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit application");
      setSubmitted(true);
      toast.success("Affiliate application submitted");
    } catch (error: any) {
      toast.error(error.message || "Could not submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f6f8fc]">
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-14">
        <div className="space-y-6">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ai)]">Affiliate Program</div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Earn commission by referring CloudMonkey customers.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Partners, agencies, consultants, MSPs, and existing customers can apply for a tracked referral account with monthly manual EFT payouts.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              ["Starter Affiliate", "10% once-off on the first successful payment."],
              ["Growth Partner", "20% recurring for the first 6 active paid months."],
              ["Strategic Partner", "35% recurring for the first 12 active paid months."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-[#dfe4ef] bg-white p-4 shadow-sm">
                <div className="font-semibold text-foreground">{title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric icon={HandCoins} label="R250" detail="Minimum payout" />
            <MiniMetric icon={BadgeCheck} label="30 days" detail="Commission hold" />
            <MiniMetric icon={ShieldCheck} label="60 days" detail="Tracking window" />
          </div>
        </div>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>{submitted ? "Application received" : "Apply to join"}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Your application is pending review. CloudMonkey will approve, reject, or request more detail before your referral link becomes active.</p>
                <Button asChild className="rounded-lg bg-[var(--ai)]">
                  <Link to="/auth/sign-in">
                    Go to sign in <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="fullName" label="Full name" required />
                  <Field name="email" label="Email" type="email" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="phone" label="Phone" />
                  <Field name="companyName" label="Company" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="website" label="Website" />
                  <div className="space-y-2">
                    <Label htmlFor="affiliateType">Affiliate type</Label>
                    <select id="affiliateType" name="affiliateType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="individual">Individual</option>
                      <option value="agency">Agency</option>
                      <option value="msp">MSP</option>
                      <option value="it_consultant">IT consultant</option>
                      <option value="web_designer_developer">Web designer/developer</option>
                      <option value="existing_customer">Existing customer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="socialLinks">Social media links</Label>
                  <Textarea id="socialLinks" name="socialLinks" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedReferralMethod">Expected referral method</Label>
                  <Textarea id="expectedReferralMethod" name="expectedReferralMethod" rows={3} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payoutDetails">Payment details</Label>
                  <Textarea id="payoutDetails" name="payoutDetails" rows={2} placeholder="Optional at application stage" />
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <input name="termsAccepted" type="checkbox" className="mt-1 h-4 w-4" />
                  <span>I agree to the CloudMonkey affiliate terms and understand applications require manual approval.</span>
                </label>
                <Button type="submit" disabled={isSubmitting} className="h-11 rounded-lg bg-[var(--ai)]">
                  {isSubmitting ? "Submitting..." : "Submit application"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

function MiniMetric({ icon: Icon, label, detail }: { icon: typeof HandCoins; label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#dfe4ef] bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-[var(--ai)]" />
      <div className="mt-3 font-semibold text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
