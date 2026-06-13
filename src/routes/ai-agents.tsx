import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Zap, TrendingUp, Sparkles, Users, Shield, Rocket } from "lucide-react";
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
        subtitle="Intelligent, specialized AI agents that automate tasks, unlock insights, and help your team achieve more."
        ctas={
          <>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--ai)" }}>
              Explore All Agents <ArrowRight className="h-4 w-4" />
            </Link>
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

      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading title="Meet your AI team" subtitle="Our AI agents are purpose-built to handle critical functions across your business." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <div key={a.id} className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{a.name}</h3>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {a.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{formatPrice(a.priceZar, currency)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{a.unit}</span>
                </div>
                <Link to="/pricing" className="text-sm font-semibold" style={{ color: "var(--ai)" }}>Learn more →</Link>
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
        primary={{ label: "Talk to an Expert", to: "/pricing" }}
        secondary={{ label: "See AI in Action", to: "/ai" }}
        accent="var(--ai)"
      />
    </>
  );
}