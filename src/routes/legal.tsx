import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  FileCheck,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";
import { MANAGED_SERVER_RESPONSE_TARGETS } from "@/lib/pricing";
import { ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal Framework - CloudMonkey" },
      {
        name: "description",
        content:
          "CloudMonkey legal framework for managed IT, cloud, voice, security, AI services, POPIA, ECTA, CPA, VAT, SLA, and first-party signatures in South Africa.",
      },
      { property: "og:title", content: "CloudMonkey Legal Framework" },
      {
        property: "og:description",
        content:
          "The operating legal framework behind CloudMonkey managed IT, cloud, voice, security, and AI services.",
      },
      ogUrl("/legal"),
    ],
  }),
  component: LegalFrameworkPage,
});

const PILLARS = [
  {
    icon: Scale,
    title: "Commercial Boundaries",
    body: "Service orders define users, devices, support channels, response windows, exclusions, setup work, and recurring fees so managed services do not become unlimited support obligations.",
  },
  {
    icon: ClipboardCheck,
    title: "ECTA Contracting",
    body: "Online orders must give customers a review and correction step, clear supplier disclosures, cooling-off notices, and explicit consent where immediate provisioning starts before the statutory period ends.",
  },
  {
    icon: ShieldCheck,
    title: "POPIA Operations",
    body: "Where CloudMonkey processes personal information for a customer, the customer remains the Responsible Party and CloudMonkey acts as Operator under a written data protection addendum.",
  },
  {
    icon: Bot,
    title: "AI Governance",
    body: "AI agents are documented as probabilistic tools that require human review for material decisions, sensitive data handling, and any workflow that may affect legal rights.",
  },
  {
    icon: ShieldCheck,
    title: "Acceptable Use",
    body: "The Acceptable Use Policy defines prohibited activities to ensure platform stability, prevent abuse, and protect users.",
  },
  {
    icon: FileCheck,
    title: "SLA Enforcement",
    body: "The SLA separates response targets from resolution targets, classifies incidents by severity, and applies service credits only where the selected SKU or signed order includes them.",
  },
];

const DOCUMENTS = [
  {
    title: "Website Terms & E-Commerce Policy",
    law: "ECTA sections 43 and 44, CPA direct marketing rules, VAT Act section 65.",
    purpose:
      "Defines online contracting, supplier disclosures, review and correction, cooling-off treatment, immediate provisioning consent, price and tax display, electronic notices, and acceptable website use.",
    to: "/legal/terms",
  },
  {
    title: "Master Services Agreement",
    law: "Common law contract principles, CPA fixed-term constraints where applicable.",
    purpose:
      "Governs the long-term customer relationship, payment terms, fixed terms, renewal notices, service orders, intellectual property, liability caps, suspension, termination, and dispute handling.",
  },
  {
    title: "Service Order / Scope Schedule",
    law: "Plain-language and scope certainty controls.",
    purpose:
      "Turns each quote into measurable scope: seat counts, devices, supported systems, ticket allowance, included onboarding, excluded projects, minimum term, setup fees, and dependencies.",
  },
  {
    title: "Service Level Agreement Matrix",
    law: "Commercial SLA terms and Conventional Penalties Act proportionality.",
    purpose:
      "Sets package-specific S1 to S4 response targets, support windows, escalation paths, maintenance exclusions, customer-caused outage exclusions, and any expressly included service credits.",
  },
  {
    title: "Data Protection Addendum",
    law: "POPIA sections 19, 20, 21, and 22.",
    purpose:
      "Documents CloudMonkey's Operator obligations, confidentiality, security safeguards, breach notice process, subprocessors, retention, deletion, and assistance with data subject requests.",
    to: "/legal/privacy",
  },
  {
    title: "Cross-Border Transfer Addendum",
    law: "POPIA section 72.",
    purpose:
      "Discloses cloud, security, email, voice, and AI regions where personal information may be processed and requires POPIA-equivalent controls for foreign recipients and onward transfers.",
  },
  {
    title: "AI Services Addendum & Acceptable Use Policy",
    law: "ECTA electronic agent rules, POPIA automated decision-making controls.",
    purpose:
      "Defines human-in-the-loop requirements, AI output review, prohibited sensitive uses, data hygiene, customer ownership of inputs, and CloudMonkey ownership of integration workflow IP.",
  },
  {
    title: "Acceptable Use Policy",
    law: "General abuse prevention and terms compliance.",
    purpose:
      "Details prohibited activities and content on CloudMonkey infrastructure to ensure safe, legal, and reliable services for everyone.",
    to: "/legal/aup",
  },
];

const SLA_ROWS = [
  {
    level: "S1 Critical",
    impact:
      "Complete service outage, major privacy incident, catastrophic data loss, or multiple users unable to perform core work.",
    response: MANAGED_SERVER_RESPONSE_TARGETS.S1,
    handling:
      "Business-hours acknowledgement, triage, and escalation. After-hours response is separately billed.",
  },
  {
    level: "S2 High",
    impact:
      "Material degradation or one critical system unavailable while business can still operate in a limited way.",
    response: MANAGED_SERVER_RESPONSE_TARGETS.S2,
    handling:
      "Priority business-hours troubleshooting within the Managed Server support allocation.",
  },
  {
    level: "S3 Medium",
    impact: "Minor service impact with a workaround available or a non-critical system affected.",
    response: MANAGED_SERVER_RESPONSE_TARGETS.S3,
    handling: "Handled during standard support hours through the normal engineering queue.",
  },
  {
    level: "S4 Low",
    impact:
      "Informational request, cosmetic issue, planned maintenance request, or change with no operational impact.",
    response: MANAGED_SERVER_RESPONSE_TARGETS.S4,
    handling:
      "Scheduled into routine maintenance, change control, or the next appropriate work cycle.",
  },
];

function LegalFrameworkPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/legal") {
    return <Outlet />;
  }

  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f5fbf8_58%,#edf8ff_100%)]">
        <div className="mx-auto grid min-h-[520px] max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-primary shadow-[var(--shadow-card)]">
              <Scale className="h-3.5 w-3.5" />
              South Africa Legal Framework
            </div>
            <h1
              className="text-[clamp(2.75rem,6vw,5.4rem)] font-extrabold leading-[0.95] text-[#07102c]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Managed IT and AI,
              <br />
              documented properly.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#17213a]">
              CloudMonkey's public legal framework aligns managed cloud, IT, voice, security,
              Microsoft 365 administration, and AI services with South African e-commerce, privacy,
              consumer, tax, and electronic contracting requirements.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/legal/terms"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_16px_30px_-18px_rgba(9,149,63,0.7)]"
              >
                View Terms <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/legal/sla"
                className="inline-flex min-h-12 items-center rounded-lg border border-border bg-white px-6 text-sm font-bold text-foreground hover:bg-secondary"
              >
                View SLA
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PILLARS.slice(0, 4).map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-lg border border-border bg-white p-5 shadow-[var(--shadow-card)]"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h2
                  className="text-sm font-bold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {pillar.title}
                </h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow="Operating Model"
          accent="var(--primary)"
          title="The core compliance pillars"
          subtitle="These controls are designed to keep the commercial promise measurable, the platform compliant, and the customer relationship enforceable."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h3
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {pillar.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Required Documents"
            accent="var(--ai)"
            title="Documentation architecture"
            subtitle="The legal document set CloudMonkey should use for public onboarding, admin-generated quotes, service orders, and signed customer agreements."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {DOCUMENTS.map((doc) => (
              <div key={doc.title} className="rounded-lg border border-border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3
                    className="max-w-xl text-lg font-bold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {doc.title}
                  </h3>
                  {doc.to && (
                    <Link
                      to={doc.to}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
                  {doc.law}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{doc.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading
              align="left"
              eyebrow="SLA Matrix"
              accent="var(--business)"
              title="Severity, response, and remedies"
              subtitle="Managed Server response targets are acknowledgement and triage targets during business hours, not resolution guarantees. The selected SKU or signed service order controls package-specific commitments."
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[0.7fr_1.4fr_0.7fr_1.2fr] gap-0 border-b border-border bg-secondary px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
              <div>Level</div>
              <div>Operational impact</div>
              <div>Target</div>
              <div>Handling</div>
            </div>
            {SLA_ROWS.map((row) => (
              <div
                key={row.level}
                className="grid grid-cols-1 gap-3 border-b border-border px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.7fr_1.4fr_0.7fr_1.2fr]"
              >
                <div className="font-bold text-foreground">{row.level}</div>
                <div className="text-muted-foreground">{row.impact}</div>
                <div className="font-semibold text-foreground">{row.response}</div>
                <div className="text-muted-foreground">{row.handling}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-foreground py-20 text-background">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="mb-3 text-xs font-bold uppercase text-background/60">
              Fair use and safety
            </div>
            <h2
              className="text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Keeping the platform secure for everyone.
            </h2>
          </div>
          <div className="space-y-4 text-sm leading-7 text-background/75">
            <p>
              Our Acceptable Use Policy ensures that CloudMonkey infrastructure is not used for
              spam, phishing, illegal content, or activities that compromise network stability.
            </p>
            <p>
              By defining clear boundaries, we protect the reputation and performance of all
              tenants, websites, and emails hosted on our network.
            </p>
            <Link to="/legal/aup" className="inline-flex font-bold text-background underline">
              View Acceptable Use Policy
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="rounded-lg border border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">Document status:</strong> This public framework
          describes CloudMonkey's operating controls for customer onboarding, service scope,
          privacy, support, AI services, and first-party signatures. It is maintained with the
          customer Terms of Service, Privacy & POPIA Notice, service orders, SLA, DPA, and AI
          addendum.
        </div>
      </section>
    </>
  );
}
