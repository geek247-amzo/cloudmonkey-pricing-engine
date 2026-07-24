import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Database,
  FileText,
  Globe2,
  KeyRound,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & POPIA Notice - CloudMonkey" },
      {
        name: "description",
        content:
          "CloudMonkey end-user privacy and POPIA notice for accounts, billing, support, managed cloud, Microsoft 365 administration, voice, security, and AI services.",
      },
      { property: "og:title", content: "CloudMonkey Privacy & POPIA Notice" },
      { property: "og:description", content: "How CloudMonkey collects, uses, shares, protects, and retains personal information." },
      ogUrl("/legal/privacy"),
    ],
    links: [canonicalLink("/legal/privacy")],
  }),
  component: PrivacyPage,
});

const PRIVACY_UPDATED = "4 July 2026";

const SUMMARY = [
  {
    icon: Database,
    title: "What We Collect",
    body: "Account, billing, support, technical, tenant, domain, server, voice, security, website, and AI service information needed to operate CloudMonkey.",
  },
  {
    icon: ShieldCheck,
    title: "Why We Use It",
    body: "To provide services, secure accounts, process payments, support customers, manage infrastructure, meet legal duties, and improve the platform.",
  },
  {
    icon: Globe2,
    title: "Where It Goes",
    body: "Data may be processed by CloudMonkey staff, approved subprocessors, cloud providers, email providers, payment providers, security tools, and AI infrastructure where needed.",
  },
  {
    icon: UserCheck,
    title: "Your Rights",
    body: "You may ask to access, correct, delete, object to, or restrict certain personal information, subject to legal, security, billing, and service-record limits.",
  },
];

const DATA_TYPES = [
  {
    title: "Account and contact data",
    examples: "Name, company, email address, phone number, login details, role, workspace, authentication records, and communication preferences.",
  },
  {
    title: "Billing and commercial data",
    examples: "Customer name, invoice details, payment status, billing address, tax details where provided, quote history, subscriptions, service orders, and transaction references.",
  },
  {
    title: "Support and service data",
    examples: "Tickets, messages, attachments, diagnostics, device or server details, logs, screenshots, requested changes, support notes, and service history.",
  },
  {
    title: "Cloud, domain, and website data",
    examples: "Domain names, DNS records, hosting details, SSL records, website content, deployment metadata, backups, monitoring data, and infrastructure usage.",
  },
  {
    title: "Microsoft 365, email, and security data",
    examples: "Tenant identifiers, user lists, licence information, security posture results, admin actions, mailbox security indicators, audit findings, and policy checks.",
  },
  {
    title: "Voice, PBX, and AI data",
    examples: "Extensions, routing rules, call metadata, recordings where enabled, transcripts, prompts, AI knowledge base content, agent configuration, and workflow outputs.",
  },
  {
    title: "Website and device data",
    examples: "IP address, browser, device details, cookies or similar identifiers, pages viewed, referral source, session data, and error or performance telemetry.",
  },
];

const PURPOSES = [
  "Create and manage CloudMonkey accounts, workspaces, roles, authentication, and dashboard access.",
  "Process quotes, orders, invoices, payments, subscriptions, refunds, collections, and tax or accounting records.",
  "Provision, monitor, secure, maintain, support, suspend, restore, or terminate managed services.",
  "Administer domains, hosting, websites, servers, DNS, SSL, backups, email tenants, Microsoft 365, security checks, voice services, and AI agents.",
  "Investigate support requests, abuse reports, security incidents, billing disputes, service failures, and compliance issues.",
  "Send service messages, billing notices, security alerts, onboarding instructions, legal notices, and operational updates.",
  "Improve reliability, user experience, service quality, security controls, internal processes, and product planning.",
  "Comply with legal, regulatory, tax, accounting, audit, consumer-protection, privacy, and law-enforcement obligations.",
];

const RIGHTS = [
  {
    title: "Access",
    body: "Ask whether we hold your personal information and request access to it, subject to identity verification and lawful limits.",
  },
  {
    title: "Correction",
    body: "Ask us to correct or update inaccurate, outdated, incomplete, or misleading personal information.",
  },
  {
    title: "Deletion",
    body: "Ask us to delete personal information where we no longer need it and no legal, security, billing, dispute, backup, or service reason requires retention.",
  },
  {
    title: "Objection",
    body: "Object to certain processing where POPIA allows it, including some direct marketing or processing based on legitimate interests.",
  },
  {
    title: "Complaint",
    body: "Contact us first so we can investigate. You may also complain to the Information Regulator of South Africa where applicable.",
  },
];

const PRIVACY_SECTIONS = [
  {
    title: "1. Responsible Party And Operator Roles",
    body: [
      "For CloudMonkey's own website, billing, account, security, marketing, and platform administration data, CloudMonkey is generally the Responsible Party.",
      "For managed services where a customer asks CloudMonkey to process personal information on the customer's behalf, the customer is generally the Responsible Party and CloudMonkey acts as Operator under the customer's instructions.",
      "A Data Protection Addendum may apply to managed services such as hosting, email administration, Microsoft 365 tenant checks, voice services, support, security monitoring, and AI workflows.",
    ],
  },
  {
    title: "2. How We Collect Personal Information",
    body: [
      "We collect information directly from you when you create an account, request a quote, accept a service order, pay an invoice, submit a ticket, connect a provider, or use the dashboard.",
      "We collect technical and service information automatically from the website, dashboard, logs, monitored systems, security tools, hosting infrastructure, support workflows, and connected services.",
      "We may receive information from payment providers, identity providers, domain registries, cloud providers, email providers, voice providers, security vendors, referral partners, and other service providers involved in delivering CloudMonkey services.",
    ],
  },
  {
    title: "3. Legal Grounds For Processing",
    body: [
      "We process personal information to perform contracts, take steps before entering contracts, comply with legal obligations, protect legitimate business and security interests, and where necessary based on consent.",
      "Where we process personal information as Operator, we do so under the customer's documented instructions and the agreement that applies to the service.",
      "You may withdraw consent where processing depends on consent, but this will not affect lawful processing that already happened or processing needed for contract, legal, security, billing, or record-keeping reasons.",
    ],
  },
  {
    title: "4. Sharing And Subprocessors",
    body: [
      "We share personal information only where needed to provide services, operate the platform, meet legal duties, protect rights or security, process payments, manage infrastructure, or support customers.",
      "Subprocessors may include hosting, DNS, domain, email, payment, identity, analytics, monitoring, backup, security, ticketing, communication, voice, AI, and software infrastructure providers.",
      "We require staff, contractors, and relevant providers to handle personal information confidentially and only for authorised purposes.",
    ],
  },
  {
    title: "5. Cross-Border Processing",
    body: [
      "Some providers used for cloud hosting, payment, security, email, support, analytics, voice, or AI may process information outside South Africa.",
      "Where personal information is transferred outside South Africa, CloudMonkey relies on appropriate contractual protections, customer instructions, consent where applicable, adequacy-type safeguards, or transfer mechanisms allowed by POPIA.",
      "Service orders or DPAs may provide more specific details about hosting regions, subprocessors, and cross-border processing for a particular customer service.",
    ],
  },
  {
    title: "6. Security Measures",
    body: [
      "CloudMonkey uses reasonable technical and organisational safeguards such as access controls, role-based permissions, authentication controls, logging, backups, encryption where appropriate, secure administration practices, and staff confidentiality measures.",
      "No system can be made perfectly secure. Customers must also protect passwords, recovery accounts, administrator access, API keys, domain access, tenant permissions, endpoint devices, and data shared with CloudMonkey.",
      "If you suspect unauthorised access to a CloudMonkey account, connected tenant, domain, mailbox, server, PBX, or AI workflow, contact us immediately.",
    ],
  },
  {
    title: "7. Retention",
    body: [
      "We keep personal information for as long as needed to provide services, maintain business records, comply with legal and tax obligations, resolve disputes, detect abuse, secure systems, and preserve audit evidence.",
      "Backups, logs, signed agreements, invoices, service records, security records, and support records may be retained for different periods depending on operational, legal, accounting, and security requirements.",
      "When information is no longer needed, we delete, anonymise, archive, or restrict it using reasonable processes.",
    ],
  },
  {
    title: "8. AI, Recordings, And Sensitive Information",
    body: [
      "Customers must not submit special personal information, confidential third-party data, regulated records, or sensitive business data into AI, support, voice, or website workflows unless the service is designed for that use and the applicable agreement allows it.",
      "Where call recording, transcription, AI knowledge bases, or monitoring features are enabled, customers are responsible for ensuring they have the required notices, permissions, and lawful basis for their own users, staff, callers, and data subjects.",
      "CloudMonkey may use upstream AI infrastructure to provide AI services, but customer-specific inputs and knowledge bases should be handled according to the applicable service order and DPA.",
    ],
  },
  {
    title: "9. Cookies And Similar Technologies",
    body: [
      "CloudMonkey may use cookies, local storage, session storage, and similar technologies to keep you signed in, remember preferences, protect forms, detect abuse, measure performance, and improve the website.",
      "Some cookies are necessary for security and account functionality. Browser settings may allow you to block or delete cookies, but doing so can affect the dashboard and checkout experience.",
    ],
  },
  {
    title: "10. Security Compromises",
    body: [
      "If we have reasonable grounds to believe personal information has been accessed or acquired by an unauthorised person, we will assess the incident and notify affected customers or Responsible Parties as required by POPIA and the applicable agreement.",
      "Where a customer is the Responsible Party, CloudMonkey's role is to notify and assist the customer so the customer can assess its own regulator and data subject notification duties.",
    ],
  },
  {
    title: "11. Contact",
    body: [
      "For privacy requests, POPIA questions, or data protection notices, contact CloudMonkey at info@cloudmonkey.co.za. Billing-related privacy questions may also be sent to billing@cloudmonkey.co.za.",
      "Please include enough information for us to verify your identity and locate the relevant account, invoice, domain, tenant, ticket, or service record.",
    ],
  },
];

function PrivacyPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f6fff9_100%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
              <Lock className="h-3.5 w-3.5" />
              Privacy & POPIA
            </div>
            <h1 className="text-[clamp(2.5rem,5vw,4.8rem)] font-extrabold leading-none text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
              Privacy Notice
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              This Notice explains how CloudMonkey collects, uses, shares, protects, stores, and deletes personal information when you use the website, dashboard, and managed services.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {PRIVACY_UPDATED}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Privacy Contact</h2>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div><dt className="font-semibold text-foreground">Entity</dt><dd>CloudMonkey (Pty) Ltd</dd></div>
              <div><dt className="font-semibold text-foreground">Registration</dt><dd>2021/743645/07</dd></div>
              <div><dt className="font-semibold text-foreground">Address</dt><dd>377 Rivonia Boulevard, Sandton, 2196, South Africa</dd></div>
              <div><dt className="font-semibold text-foreground">Email</dt><dd>info@cloudmonkey.co.za</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {SUMMARY.map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-primary">
              <Database className="h-3.5 w-3.5" />
              Personal Information
            </div>
            <h2 className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Data we may process</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              The exact data depends on the services you use, the integrations you connect, the support you request, and the information you choose to provide.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {DATA_TYPES.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.examples}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
            <FileText className="h-3.5 w-3.5" />
            Use Of Data
          </div>
          <h2 className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Why we process information</h2>
        </div>
        <div className="grid gap-3">
          {PURPOSES.map((purpose) => (
            <div key={purpose} className="flex gap-3 rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
              <CheckIcon />
              <p>{purpose}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="space-y-5">
            {PRIVACY_SECTIONS.map((section) => (
              <article key={section.title} className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{section.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
            <UserCheck className="h-3.5 w-3.5" />
            Your Rights
          </div>
          <h2 className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Privacy requests</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            We may need to verify your identity before actioning a request. Some requests may be limited by law, contract, billing records, security logs, backups, or the rights of another person.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {RIGHTS.map((right) => (
            <div key={right.title} className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{right.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{right.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-foreground py-14 text-background">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-4">
          {[
            { icon: FileText, title: "Terms", to: "/legal/terms" },
            { icon: KeyRound, title: "POPIA", to: "/legal/popia" },
            { icon: Mail, title: "Contact", to: "mailto:info@cloudmonkey.co.za" },
            { icon: RefreshCcw, title: "Legal Framework", to: "/legal" },
          ].map((item) => (
            <a key={item.title} href={item.to} className="flex items-center justify-between rounded-lg border border-background/15 p-5 text-sm font-bold hover:bg-background/10">
              <span className="inline-flex items-center gap-3"><item.icon className="h-5 w-5" />{item.title}</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex gap-3 rounded-lg border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            <strong className="text-foreground">Document status:</strong> This Privacy & POPIA Notice is published for CloudMonkey website, dashboard, customer onboarding, support, billing, managed services, connected tenants, and AI workflows from 4 July 2026.
          </p>
        </div>
      </section>
    </>
  );
}

function CheckIcon() {
  return <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />;
}
