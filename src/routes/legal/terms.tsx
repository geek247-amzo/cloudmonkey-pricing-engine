import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CreditCard,
  FileSignature,
  Headphones,
  Lock,
  Scale,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service - CloudMonkey" },
      {
        name: "description",
        content:
          "CloudMonkey end-user terms for managed cloud, domains, websites, IT support, Microsoft 365 administration, voice, security, AI agents, billing, and electronic signatures.",
      },
      { property: "og:title", content: "CloudMonkey Terms of Service" },
      { property: "og:description", content: "Customer terms for using CloudMonkey services." },
      ogUrl("/legal/terms"),
    ],
    links: [canonicalLink("/legal/terms")],
  }),
  component: TermsPage,
});

const TERMS_UPDATED = "17 July 2026";

const QUICK_TERMS = [
  {
    icon: ShoppingCart,
    title: "Orders",
    body: "Your accepted quote, checkout, service definition, service order, or signed agreement confirms what you bought, its limits, exclusions, price, billing cycle, setup fees, and minimum term.",
  },
  {
    icon: CreditCard,
    title: "Billing",
    body: "Prices are shown in South African Rand unless stated otherwise. VAT treatment, setup fees, recurring fees, and totals are confirmed before payment or invoice acceptance.",
  },
  {
    icon: Headphones,
    title: "Support",
    body: "Support is limited to the services, users, systems, channels, and response targets stated in your plan, quote, SLA, or service order.",
  },
  {
    icon: FileSignature,
    title: "Signatures",
    body: "CloudMonkey may use its own in-platform signature, click acceptance, and audit trail for quotes, service orders, MSAs, DPAs, and provisioning consent.",
  },
];

const TERMS_SECTIONS = [
  {
    title: "1. Who These Terms Apply To",
    body: [
      "These Terms apply when you visit cloudmonkey.co.za, create a CloudMonkey account, use the dashboard, request a quote, accept a service order, buy a subscription, connect a third-party tenant, or use any CloudMonkey managed service.",
      "CloudMonkey is operated by CloudMonkey (Pty) Ltd, registration number 2021/743645/07, with a business address at 377 Rivonia Boulevard, Sandton, 2196, South Africa.",
      "If you accept these Terms for a company or other organisation, you confirm that you are authorised to bind that organisation.",
    ],
  },
  {
    title: "2. Your Agreement With CloudMonkey",
    body: [
      "Your agreement may include these Terms, the Privacy & POPIA Notice, your selected SKU and accepted service definition, quote, service order, invoice, SLA, Data Protection Addendum, AI Services Addendum, and any signed Master Services Agreement.",
      "If there is a conflict, a signed Master Services Agreement or service order applies first for the specific services it covers, followed by the selected SKU and accepted service definition, then the applicable addendum or SLA, and then these Terms. A public summary does not expand the selected package.",
      "CloudMonkey may update these Terms for future orders or renewals. Material changes that affect an active fixed-term service will be handled through the agreement, notice, renewal, or change-control process that applies to that service.",
    ],
  },
  {
    title: "3. Accounts, Security, And Access",
    body: [
      "You must provide accurate account, billing, domain, tenant, and contact information. You are responsible for keeping passwords, recovery details, and administrator access secure.",
      "You must tell us promptly if an account, API key, domain, email tenant, server, PBX, or AI agent may have been compromised.",
      "We may suspend access where we reasonably believe there is fraud, abuse, unpaid billing, a security risk, unlawful activity, or use that may harm CloudMonkey, customers, upstream providers, or the public.",
    ],
  },
  {
    title: "4. Orders, Review, And Electronic Contracting",
    body: [
      "Before an online order is submitted, the checkout or quote flow should show the selected services, coverage, service allocation, infrastructure allocation, support allocation, response targets, included changes, usage limits, limit-exceeded treatment, setup fees, recurring fees, taxes where applicable, and minimum terms so that you can review and correct errors.",
      "You agree that electronic acceptance, website checkouts, dashboard clicks, accepted quotes, in-platform signatures, email confirmations, invoices, and electronic notices are valid, legally binding, and may be used as electronic records for your agreement with CloudMonkey.",
      "Where you ask us to begin provisioning immediately, you consent to CloudMonkey starting the service before any cooling-off period expires. This may affect cancellation and refund rights for services already provisioned, configured, used, or reserved for you.",
    ],
  },
  {
    title: "5. Service Scope And Exclusions",
    body: [
      "Each plan includes only the work listed in the relevant service order, product description, quote, or dashboard checkout. Examples include domains, managed hosting, websites, Microsoft 365 administration, Google Workspace administration, managed IT, security checks, PBX, SIP, voice, AI agents, automation, and support.",
      "Unused development time, support time, incidents, revisions, infrastructure capacity, and usage allowances do not roll over unless the selected SKU or signed service order expressly says otherwise.",
      "A package limit is a maximum allowance, not a guaranteed amount of work where delivery is blocked or delayed by missing content, approvals, access, dependencies, client decisions, third-party delays, or other customer responsibilities.",
      "Unless your service order says otherwise, Microsoft 365 or Google Workspace management means administrator-level management such as user creation, licensing, basic policies, and tenant checks. It does not include unlimited productivity helpdesk, complex migrations, data cleanup, training, or project work.",
      "Out-of-scope work, urgent project work, after-hours support, data migrations, custom development, forensic security work, onsite support, and third-party vendor disputes may require a new quote or separate approval.",
      "Corrective support is included only where the feature was approved, previously worked, remains supported, is reproducibly defective, was not altered by the customer, is not failing because of a third party, and the customer has an eligible active package. New fields, screens, reports, roles, calculations, rules, integrations, automations, redesigns, imports, applications, or code-level improvements are development.",
      "While an eligible Build package is active, the standard Managed Server fee is paused where Build includes the same management scope. VPS resources are bundled only where the selected Build package expressly includes them. When Build ends, Managed Server, VPS, backups, AI wallet usage, communications, domains, and licences become separate recurring or usage charges as applicable.",
    ],
  },
  {
    title: "6. Payments, Taxes, And Invoices",
    body: [
      "You must pay the fees shown in the accepted quote, checkout, invoice, or service order by the due date. Recurring services renew and bill according to the selected billing cycle unless cancelled under the applicable agreement.",
      "If CloudMonkey is required to charge VAT or any other tax, the applicable tax treatment will be shown in the quote, checkout, invoice, or payment record. Where VAT applies, records should show the VAT component and final total clearly.",
      "Late payment may result in reminder notices, suspension, recovery of reasonable collection costs, domain or service interruption, or termination after notice where required by law or the applicable agreement.",
      "AI, messaging, voice, email, storage, bandwidth, and other metered services may require prepaid balance or usage billing. Usage may pause when the usable balance reaches zero. Rates and units are shown in the applicable product, wallet, service order, or usage record and may change for future usage after reasonable notice where practicable.",
    ],
  },
  {
    title: "7. Fixed Terms, Cancellation, And Refunds",
    body: [
      "Some services are month-to-month. Others have a fixed term, minimum term, setup fee, reserved capacity, domain registration period, software licence period, custom build, or upfront onboarding work.",
      "Where South African consumer fixed-term rules apply, cancellation and renewal rights will be handled according to the Consumer Protection Act, including any required notice and reasonable cancellation charge for work already done, reserved, discounted, or provisioned.",
      "Domain registrations, third-party licences, configured infrastructure, custom AI setup, completed onboarding, consumed support, and immediate provisioning work may be non-refundable to the extent allowed by law and the applicable service order.",
    ],
  },
  {
    title: "8. Uptime, Support, And Service Credits",
    body: [
      "SLA commitments apply only where the selected SKU, accepted service definition, quote, or service order expressly includes them. Response targets mean the time to acknowledge, triage, or begin work during the applicable support window. They are not guaranteed resolution times unless stated in writing.",
      "Downtime does not include planned maintenance, customer-caused issues, incorrect DNS, expired domains, unpaid accounts, unsupported changes, third-party network failures, upstream provider outages, force majeure events, or systems outside CloudMonkey's control.",
      "Where service credits apply, they are the sole financial remedy for the relevant SLA availability failure unless a signed agreement expressly says otherwise.",
    ],
  },
  {
    title: "9. Acceptable Use",
    body: [
      "You may not use CloudMonkey services for unlawful activity, spam, phishing, malware, credential theft, abusive automation, intellectual-property infringement, unauthorised scanning, harassment, deceptive content, or activity that threatens service reliability.",
      "You must have the legal right to use any domain, content, data, software, licence, recording, prompt, knowledge base, or integration you provide to CloudMonkey.",
      "We may remove or suspend content, services, tenants, or accounts where required by law, an upstream provider, a security incident, or a reasonable abuse complaint.",
    ],
  },
  {
    title: "10. AI Services",
    body: [
      "AI outputs can be incomplete, inaccurate, biased, or unsuitable for a specific decision. You must review AI output before relying on it for legal, financial, medical, employment, security, contractual, or other material decisions.",
      "You must not use AI agents to make decisions based solely on automated processing where that would unlawfully affect a person. A human decision-maker must remain responsible for material outcomes.",
      "You own the customer content and business data you provide. CloudMonkey owns its platform, workflows, prompts, templates, integrations, implementation know-how, and service configuration unless a signed agreement says otherwise.",
    ],
  },
  {
    title: "11. Privacy And Customer Data",
    body: [
      "CloudMonkey handles personal information according to the Privacy & POPIA Notice and any Data Protection Addendum that applies to your services.",
      "Where we process personal information for you as part of managed services, you are generally the Responsible Party and CloudMonkey acts as Operator under your instructions, subject to the agreement and applicable law.",
      "You must not provide special personal information, regulated data, or sensitive business information to a service unless the service order and DPA allow it and suitable controls are in place.",
    ],
  },
  {
    title: "12. Liability",
    body: [
      "CloudMonkey provides managed technology services, but no provider can guarantee uninterrupted, error-free, or risk-free operation of the internet, third-party platforms, AI models, cloud providers, telecom networks, or customer-controlled systems.",
      "To the maximum extent allowed by law, CloudMonkey is not liable for indirect loss, lost profit, lost revenue, loss of goodwill, business interruption, loss caused by customer instructions, or failures outside CloudMonkey's reasonable control.",
      "Any liability cap, indemnity, or exclusion in a signed MSA, service order, SLA, DPA, or AI addendum will apply to the service it covers.",
    ],
  },
  {
    title: "13. Governing Law And Contact",
    body: [
      "These Terms are governed by the laws of the Republic of South Africa unless a signed agreement says otherwise.",
      "For support, billing, legal, privacy, or contract questions, contact CloudMonkey at info@cloudmonkey.co.za or billing@cloudmonkey.co.za. Notices may also be sent through the CloudMonkey dashboard where available.",
      "Nothing in these Terms limits rights that cannot lawfully be limited under South African law.",
    ],
  },
];

const CUSTOMER_CHECKLIST = [
  "You have authority to order the service for yourself or your organisation.",
  "You reviewed the plan coverage, allocations, response targets, included changes, usage limits, overage treatment, setup fees, recurring fees, taxes, and minimum term.",
  "You understand that immediate provisioning may begin after payment, signature, or checkout acceptance.",
  "You will not place unlawful, unauthorised, or sensitive data into services that are not designed for it.",
];

function TermsPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
              <Scale className="h-3.5 w-3.5" />
              Customer Terms
            </div>
            <h1
              className="text-[clamp(2.5rem,5vw,4.8rem)] font-extrabold leading-none text-[#07102c]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Terms of Service
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              These Terms explain how CloudMonkey customers buy, use, manage, cancel, and receive
              support for managed cloud, domains, websites, IT, Microsoft 365 administration, voice,
              security, and AI services.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {TERMS_UPDATED}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2
              className="text-lg font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CloudMonkey (Pty) Ltd
            </h2>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div>
                <dt className="font-semibold text-foreground">Registration</dt>
                <dd>2021/743645/07</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Address</dt>
                <dd>377 Rivonia Boulevard, Sandton, 2196, South Africa</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Email</dt>
                <dd>info@cloudmonkey.co.za</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Billing</dt>
                <dd>billing@cloudmonkey.co.za</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Website</dt>
                <dd>cloudmonkey.co.za</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {QUICK_TERMS.map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h2
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Before You Accept
            </div>
            <h2
              className="text-3xl font-extrabold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Customer acknowledgement
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              These are the practical points a customer should understand before accepting a quote,
              checkout, or service order.
            </p>
          </div>
          <div className="grid gap-3">
            {CUSTOMER_CHECKLIST.map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="space-y-5">
          {TERMS_SECTIONS.map((section) => (
            <article key={section.title} className="rounded-lg border border-border bg-card p-6">
              <h2
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-foreground py-14 text-background">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-4">
          {[
            { icon: Lock, title: "Privacy", to: "/legal/privacy" },
            { icon: ShieldCheck, title: "AUP", to: "/legal/aup" },
            { icon: Scale, title: "SLA", to: "/legal/sla" },
            { icon: Bot, title: "AI Services", to: "/ai-agents" },
          ].map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="flex items-center justify-between rounded-lg border border-background/15 p-5 text-sm font-bold hover:bg-background/10"
            >
              <span className="inline-flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.title}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex gap-3 rounded-lg border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            <strong className="text-foreground">Document status:</strong> These Terms are published
            for CloudMonkey customer onboarding and apply to website use, dashboard access, quotes,
            orders, subscriptions, managed services, support, and in-platform acceptance from 4 July
            2026.
          </p>
        </div>
      </section>
    </>
  );
}
