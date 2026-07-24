import { createFileRoute } from "@tanstack/react-router";
import { RefreshCcw } from "lucide-react";
import { canonicalLink, ogUrl } from "@/lib/seo";

const REFUNDS_UPDATED = "17 July 2026";

export const Route = createFileRoute("/legal/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy - CloudMonkey" },
      {
        name: "description",
        content: "CloudMonkey Refund and Cancellation Policy.",
      },
      { property: "og:title", content: "CloudMonkey Refund Policy" },
      {
        property: "og:description",
        content: "Details about our cancellation and refund processes.",
      },
      ogUrl("/legal/refunds"),
    ],
    links: [canonicalLink("/legal/refunds")],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RefreshCcw className="h-8 w-8" />
          </div>
          <h1
            className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-none text-[#07102c]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Refund & Cancellation Policy
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Clear guidelines on how cancellations and refunds are handled for CloudMonkey
            subscriptions, services, and digital products.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {REFUNDS_UPDATED}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Cancellations
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                You may cancel your month-to-month subscriptions at any time through the CloudMonkey
                dashboard or by contacting support. Cancellations will take effect at the end of
                your current billing cycle.
              </p>
              <p>
                For services with a minimum fixed term, early cancellation may incur a reasonable
                cancellation fee in accordance with the South African Consumer Protection Act (where
                applicable) to cover provisioned software, reserved infrastructure, or setup work
                already performed.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Refund Eligibility
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Refunds are generally provided only where we have failed to deliver the agreed-upon
                services or where mandated by applicable law. Because our services typically involve
                immediate provisioning of infrastructure, licensing, and engineer time, the
                following are generally non-refundable:
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>Domain name registrations and renewals once processed.</li>
                <li>Setup fees for custom configurations, onboarding, or migrations.</li>
                <li>
                  Third-party software licenses (e.g., Microsoft 365, Google Workspace) once
                  provisioned.
                </li>
                <li>Services used or consumed during the billing period prior to cancellation.</li>
              </ul>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              AI Wallet And Prepaid Usage
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Purchased, unused wallet balance may be eligible for refund to the original payment
                method after verification of the payment, account ownership, outstanding invoices,
                pending reservations, chargebacks, and any usage already supplied. Consumed or
                reserved usage is not refundable.
              </p>
              <p>
                Included package allowances, promotional credits, goodwill credits, manual
                adjustments, and free credits have no cash value and are not refundable or
                transferable. Wallet balances cannot be transferred between customers unless
                CloudMonkey approves the transfer in writing.
              </p>
              <p>
                Purchased wallet balance does not expire while the account remains active and in
                good standing unless the applicable order expressly states otherwise. Account
                closure, fraud, abuse, legal restrictions, payment reversals, or supplier charges
                may affect refund processing.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Cooling-off Period
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Under the Electronic Communications and Transactions Act (ECTA), you may have a
                7-day cooling-off period for certain online transactions. However, if you explicitly
                request that we begin provisioning the service (such as cloud hosting, domains, or
                licensing) immediately, you acknowledge that this cooling-off right may not apply to
                those provisioned services.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Requesting a Refund
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                To request a refund for a disputed charge or an eligible service, please contact our
                billing team at <strong>billing@cloudmonkey.co.za</strong> within 30 days of the
                invoice date. Approved refunds will be processed to the original payment method.
              </p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
