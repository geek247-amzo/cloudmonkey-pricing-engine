import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Zap, TrendingUp, Sparkles, Users, Shield, Rocket, Workflow, Database, MessageSquare, Gauge, Settings, CheckCircle2, FileText, LockKeyhole } from "lucide-react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { useCurrency } from "@/lib/currency";
import { formatPrice, getCategory } from "@/lib/pricing";

export const Route = createFileRoute("/ai-agents")({
  head: () => ({
    meta: [
      { title: "AI Agents — Purpose-built AI for every part of your business" },
      { name: "description", content: "Marketing, Sales, Support, HR, Finance and Operations AI agents — specialised, secure, and ready to work alongside your team." },
      { property: "og:title", content: "CloudMonkey AI Agents" },
      { property: "og:description", content: "AI agents for every part of your business." },
    ],
  }),
  component: AgentsPage,
});

const PROMISES = [
  { icon: Zap, title: "Automate", desc: "Reduce repetitive work and save time" },
  { icon: TrendingUp, title: "Analyze", desc: "Turn data into insights you can act on" },
  { icon: Sparkles, title: "Accelerate", desc: "Empower your team to move faster" },
];

const BENEFITS = [
  { icon: Brain, title: "Specialized AI Experts", desc: "Purpose-built agents for every business function." },
  { icon: Users, title: "Work Together Seamlessly", desc: "Agents collaborate across teams and systems." },
  { icon: Shield, title: "Secure & Enterprise-Ready", desc: "Built with enterprise-grade security and compliance." },
  { icon: Rocket, title: "Continuously Improving", desc: "Agents learn and evolve to deliver even more value." },
];

const HOW_IT_WORKS = [
  { icon: FileText, title: "Define the job", desc: "We map the outcomes, tone, rules, escalation paths, and data the agent needs before anything goes live." },
  { icon: Database, title: "Connect knowledge", desc: "Your documents, FAQs, systems, forms, inboxes, or workflow tools become the agent's working context." },
  { icon: Workflow, title: "Automate actions", desc: "Agents can draft, classify, research, summarize, route work, update records, and trigger approved workflows." },
  { icon: Gauge, title: "Measure and improve", desc: "Usage, quality, gaps, and handoffs are reviewed so the agent gets sharper over time." },
];

const INCLUDED = [
  { icon: Settings, title: "Managed setup", desc: "Agent configuration, prompts, knowledge setup, and launch support are included." },
  { icon: MessageSquare, title: "Business workflows", desc: "Intake forms, email/chat handoffs, summaries, routing, and workflow triggers." },
  { icon: LockKeyhole, title: "Access controls", desc: "Role-aware knowledge access, human escalation, and clear operating boundaries." },
  { icon: CheckCircle2, title: "Monthly optimization", desc: "Review usage, missed questions, workflow quality, and improvement opportunities." },
];

const USAGE_BUNDLE = [
  { label: "Price", value: "R999 / agent / month" },
  { label: "Included usage", value: "1,000,000 AI tokens / month" },
  { label: "Typical capacity", value: "About 600-900 short tasks or 80-150 larger workflows" },
  { label: "Overage", value: "Reviewed before billing or moved to a higher-capacity plan" },
];

const AGENT_DETAILS: Record<string, { outcome: string; examples: string[]; connects: string }> = {
  "agent-marketing": {
    outcome: "Plan campaigns, create content, repurpose posts, and report on performance.",
    examples: ["Social captions and email drafts", "Campaign calendars", "SEO and ad copy ideas"],
    connects: "Website, brand docs, analytics exports, CRM lists",
  },
  "agent-sales": {
    outcome: "Research leads, personalize outreach, summarize opportunities, and keep follow-ups moving.",
    examples: ["Lead qualification notes", "Proposal and email drafts", "Deal follow-up reminders"],
    connects: "CRM, inbox, lead forms, product sheets",
  },
  "agent-support": {
    outcome: "Triage tickets, answer common questions, search knowledge, and escalate the right issues.",
    examples: ["Customer chat responses", "Ticket summaries", "Knowledge base suggestions"],
    connects: "Helpdesk, documentation, website chat, email",
  },
  "agent-hr": {
    outcome: "Support recruitment, onboarding, policy Q&A, and internal HR workflows.",
    examples: ["Candidate screening summaries", "Onboarding checklists", "Policy answers"],
    connects: "HR docs, forms, shared drives, email",
  },
  "agent-finance": {
    outcome: "Classify finance requests, summarize spend, prepare reports, and support forecasting.",
    examples: ["Expense summaries", "Invoice query drafts", "Monthly report notes"],
    connects: "Spreadsheets, invoices, accounting exports, inbox",
  },
  "agent-operations": {
    outcome: "Coordinate recurring processes, track tasks, summarize blockers, and trigger workflows.",
    examples: ["SOP checklists", "Task routing", "Process improvement notes"],
    connects: "Project tools, forms, SOPs, shared docs",
  },
};

function AgentsPage() {
  const cat = getCategory("ai");
  const agents = cat.services.find((s) => s.id === "ai-agents")!.plans;
  const { currency } = useCurrency();
  return (
    <>
      <MascotHero
        eyebrow={<><Brain className="h-3 w-3" /> AI Agents</>}
        accent="var(--ai)"
        title={<>AI agents for every part of your <span style={{ color: "var(--ai)" }}>business.</span></>}
        subtitle="Managed AI agents that use your business knowledge, follow your workflows, and handle real work across sales, support, marketing, HR, finance, and operations."
        ctas={
          <>
            <a href="#ai-agent-plans" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--ai)" }}>
              Explore All Agents <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/ai" className="rounded-full border-2 px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--ai)", color: "var(--ai)" }}>How AI Agents Work</Link>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <p.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            title="How CloudMonkey AI agents work"
            subtitle="You do not just get a chatbot. Each agent is configured around a business outcome, connected to approved knowledge, and managed as part of your CloudMonkey service."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <SectionHeading
            align="left"
            title="What's included"
            subtitle="Every AI agent subscription includes the managed setup and operating layer needed to make the agent useful in a real business."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <div key={item.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--ai)]/25 bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ai)]">Included usage</div>
          <h2 className="mt-2 text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>1 million AI tokens per agent</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Tokens are used by prompts, business context, tool calls, and agent responses. Actual task volume depends on how much context each workflow needs.
          </p>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
            {USAGE_BUNDLE.map((item) => (
              <div key={item.label} className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr] sm:items-center">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                <div className="text-sm font-semibold text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Higher-volume agents, multi-agent automations, voice workloads, or dedicated private model/server requirements can be sized separately.
          </p>
        </div>
      </section>

      <section id="ai-agent-plans" className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading title="Meet your AI team" subtitle="Each agent starts at R999/month and includes managed setup, monthly optimization, and 1,000,000 AI tokens per month." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <div key={a.id} className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{a.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{AGENT_DETAILS[a.id]?.outcome}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {a.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
              <div className="mt-4 rounded-xl bg-secondary/70 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Example outputs</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(AGENT_DETAILS[a.id]?.examples ?? []).map((example) => (
                    <span key={example} className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground">{example}</span>
                  ))}
                </div>
                <div className="mt-3 text-xs leading-relaxed text-muted-foreground">Connects to: {AGENT_DETAILS[a.id]?.connects}</div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{formatPrice(a.priceZar, currency)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{a.unit}</span>
                </div>
                <Link to="/auth/sign-up" search={{ plan: a.id }} className="text-sm font-semibold" style={{ color: "var(--ai)" }}>Learn more →</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-4">
              <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{b.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBanner
        title="Ready to build your AI team?"
        subtitle="See how CloudMonkey AI agents can transform your business."
        primary={{ label: "Talk to an Expert", to: "/auth/sign-up" }}
        secondary={{ label: "See AI in Action", to: "/ai" }}
        accent="var(--ai)"
      />
    </>
  );
}
