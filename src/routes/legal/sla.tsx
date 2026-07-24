import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { BUILD_PACKAGE_RESPONSE_TARGETS, MANAGED_SERVER_RESPONSE_TARGETS } from "@/lib/pricing";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal/sla")({
  head: () => ({
    meta: [
      { title: "Service Level Agreement (SLA) - CloudMonkey" },
      {
        name: "description",
        content:
          "CloudMonkey Service Level Agreement, including package-specific availability and support response targets.",
      },
      { property: "og:title", content: "CloudMonkey SLA" },
      {
        property: "og:description",
        content: "Our commitments to uptime and support responsiveness.",
      },
      ogUrl("/legal/sla"),
    ],
    links: [canonicalLink("/legal/sla")],
  }),
  component: SlaPage,
});

const SLA_UPDATED = "17 July 2026";

const MANAGED_SERVER_ROWS = [
  [
    "S1 Critical",
    "Complete outage of a covered production service",
    MANAGED_SERVER_RESPONSE_TARGETS.S1,
  ],
  [
    "S2 High",
    "Material degradation or critical function unavailable",
    MANAGED_SERVER_RESPONSE_TARGETS.S2,
  ],
  ["S3 Medium", "Limited impact with a workaround available", MANAGED_SERVER_RESPONSE_TARGETS.S3],
  ["S4 Low", "Information request or planned non-urgent work", MANAGED_SERVER_RESPONSE_TARGETS.S4],
] as const;

const BUILD_RESPONSE_ROWS = [
  ["Build Starter", BUILD_PACKAGE_RESPONSE_TARGETS.build_site_starter],
  ["Build Growth", BUILD_PACKAGE_RESPONSE_TARGETS.build_site_growth],
  ["Build Scale", BUILD_PACKAGE_RESPONSE_TARGETS.build_site_scale],
  ["Ecommerce Launch", BUILD_PACKAGE_RESPONSE_TARGETS.build_ecommerce_launch],
  ["Custom App Build", BUILD_PACKAGE_RESPONSE_TARGETS.build_custom_app],
] as const;

function SlaPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Activity className="h-8 w-8" />
          </div>
          <h1
            className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-none text-[#07102c]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Service Level Agreement
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Package-specific operational commitments for covered CloudMonkey services.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {SLA_UPDATED}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              1. Applicability And Package Limits
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                This SLA applies only to services with an active eligible package. The selected SKU,
                accepted service definition, quote, or signed service order determines the covered
                clients, brands, websites, applications, servers, infrastructure, support
                allocation, response targets, included changes, and usage limits.
              </p>
              <p>
                The selected SKU and signed service order take precedence over this public summary
                for package-specific quantities. This SLA does not convert monitoring, support,
                backups, development, infrastructure, or usage into an unlimited service.
              </p>
              <p>
                Unused development time, support time, incidents, revisions, infrastructure
                capacity, and usage allowances do not roll over unless expressly stated. A limit is
                a maximum allowance and does not guarantee delivery where customer content,
                approvals, access, dependencies, or decisions are missing or delayed.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              2. Availability
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                An uptime percentage or recovery objective applies only where the selected SKU or
                signed service order expressly states it. Monitoring frequency is not an uptime
                guarantee.
              </p>
              <p>
                Measured downtime excludes scheduled maintenance, customer-caused issues, incorrect
                DNS, expired domains, exhausted or undersized resources, unsupported changes, unpaid
                accounts, upstream provider or network failures, force majeure, and systems outside
                CloudMonkey's control.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              3. Managed Server Response Targets
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                These are business-hours acknowledgement and triage targets for an active Managed
                Server package. They are not resolution guarantees. After-hours response is excluded
                unless separately purchased.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[0.7fr_1.5fr_0.8fr] bg-secondary px-4 py-3 text-xs font-bold uppercase text-foreground">
                  <div>Priority</div>
                  <div>Impact</div>
                  <div>Target</div>
                </div>
                {MANAGED_SERVER_ROWS.map(([priority, impact, target]) => (
                  <div
                    key={priority}
                    className="grid grid-cols-1 gap-2 border-t border-border px-4 py-3 sm:grid-cols-[0.7fr_1.5fr_0.8fr]"
                  >
                    <strong className="text-foreground">{priority}</strong>
                    <span>{impact}</span>
                    <span className="font-semibold text-foreground">{target}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              4. Build Package Response Targets
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Build response targets apply during the package's support window and delivery term.
                Development remains subject to the monthly allocation, approved scope, sequencing,
                dependencies, and client readiness.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                {BUILD_RESPONSE_ROWS.map(([name, target]) => (
                  <div
                    key={name}
                    className="grid grid-cols-[1.2fr_0.8fr] border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <strong className="text-foreground">{name}</strong>
                    <span>{target}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              5. Backups And Restoration
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Backup frequency, retention, storage, restore requests, restore testing, and
                recovery targets follow the selected backup or Build SKU. A successful backup job
                does not guarantee a specific recovery time unless a signed Critical Backup order
                defines recovery objectives.
              </p>
              <p>
                Restore labour, disaster recovery, large data restoration, and recovery beyond the
                included allowance may be separately billed.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              6. Service Credits
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Service credits apply only where the selected SKU or signed service order expressly
                includes them and defines the eligible availability commitment or calculation. A
                claim must be submitted within 30 days of the incident.
              </p>
              <p>
                Where applicable, service credits are the sole financial remedy for the relevant SLA
                failure unless a signed agreement expressly states otherwise.
              </p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
