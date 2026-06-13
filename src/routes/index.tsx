import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cloud, Briefcase, Brain, Check, Shield, Zap, Headphones, Sparkles } from "lucide-react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { BUNDLES, formatPrice } from "@/lib/pricing";
import { useCurrency } from "@/lib/currency";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloudMonkey — Everything your business needs. Simplified." },
      { name: "description", content: "Cloud infrastructure, business solutions, and AI agents in one platform. Single invoice. Single support team. Single dashboard." },
      { property: "og:title", content: "CloudMonkey — Everything your business needs. Simplified." },
      { property: "og:description", content: "Cloud, Business and AI — one platform, one invoice, one dashboard." },
    ],
  }),
  component: HomePage,
});

const DIVISIONS = [
  {
    id: "cloud",
    name: "CLOUD",
    tagline: "Scalable. Secure. Reliable.",
    description: "Enterprise-grade cloud infrastructure and services that grow with your business.",
    accent: "var(--cloud)",
    soft: "var(--cloud-soft)",
    icon: Cloud,
    bullets: ["Cloud Hosting & Servers", "Security & Compliance", "Backups & Disaster Recovery", "Scalability & Performance"],
    to: "/cloud",
  },
  {
    id: "business",
    name: "BUSINESS",
    tagline: "Optimize. Automate. Grow.",
    description: "IT management and business solutions that drive efficiency and productivity.",
    accent: "var(--business)",
    soft: "var(--business-soft)",
    icon: Briefcase,
    bullets: ["IT Management", "Process Automation", "Workflows & Integration", "Strategy & Consulting"],
    to: "/business",
  },
  {
    id: "ai",
    name: "AI",
    tagline: "Intelligent. Automated. Impactful.",
    description: "AI agents and automation that unlock insights and accelerate your business.",
    accent: "var(--ai)",
    soft: "var(--ai-soft)",
    icon: Brain,
    bullets: ["AI Agents for Every Team", "Workflow Automation", "Analytics & Insights", "Smart Integrations"],
    to: "/ai",
  },
] as const;

const WHY = [
  { icon: Shield, title: "All-in-One Platform", desc: "Cloud, business, and AI seamlessly integrated in one powerful platform." },
  { icon: Zap, title: "Built for Growth", desc: "Scalable solutions that grow with your business, from startup to enterprise." },
  { icon: Check, title: "Secure by Design", desc: "Enterprise-grade security and compliance to keep your data and business safe." },
  { icon: Sparkles, title: "Optimize Costs", desc: "Reduce operational costs and increase efficiency with smart automation." },
  { icon: Headphones, title: "Expert Support", desc: "24/7 expert support from real people who are here to help you succeed." },
];

function HomePage() {
  const { currency } = useCurrency();
  return (
    <>
      <MascotHero
        eyebrow={<><Sparkles className="h-3 w-3" /> One platform. Endless possibilities.</>}
        title={<>Everything your business needs.<br /><span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Simplified.</span></>}
        subtitle="CloudMonkey brings together cloud infrastructure, business solutions, and AI agents to help you build, run, and grow your business — all in one place."
        ctas={
          <>
            <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform hover:scale-[1.02]" style={{ background: "var(--gradient-primary)" }}>
              Get Started for Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/cloud" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary">
              Explore Solutions
            </Link>
          </>
        }
      />

      {/* Three divisions */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          title={<><span style={{ color: "var(--ai)" }}>Three</span> powerful divisions. <span className="text-muted-foreground">One seamless platform.</span></>}
          subtitle="Everything you need to build, manage, and scale your business in the modern world."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {DIVISIONS.map((d) => (
            <Link
              key={d.id}
              to={d.to}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70" style={{ background: d.accent }} />
              <div className="relative">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: d.soft, color: d.accent }}>
                  <d.icon className="h-6 w-6" />
                </div>
                <div className="text-xs font-bold tracking-widest" style={{ color: d.accent }}>{d.name}</div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  {d.tagline}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {d.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-foreground/80">
                      <Check className="h-4 w-4" style={{ color: d.accent }} />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: d.accent }}>
                  Explore {d.name.charAt(0) + d.name.slice(1).toLowerCase()} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bundles */}
      <section className="border-y border-border bg-secondary/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Platform Bundles"
            accent="var(--ai)"
            title={<>One bundle. <span style={{ color: "var(--ai)" }}>Everything connected.</span></>}
            subtitle="Combine cloud, business, and AI into one neat package — with a single invoice and a single team."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {BUNDLES.map((b) => (
              <div
                key={b.id}
                className="relative flex flex-col rounded-2xl border bg-card p-6"
                style={b.highlighted ? { boxShadow: `0 0 0 2px var(--ai), var(--shadow-elevated)`, borderColor: "transparent" } : { borderColor: "var(--border)" }}
              >
                {b.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--ai)" }}>
                    {b.badge}
                  </span>
                )}
                <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{b.name}</div>
                <div className="mt-2 text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  {formatPrice(b.priceZar, currency)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/month</span>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground/80">
                  {b.features.map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: "var(--ai)" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/pricing" className="mt-5 rounded-full border border-border px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary">
                  Choose bundle
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading title="Why businesses choose CloudMonkey" />
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {WHY.map((w) => (
            <div key={w.title} className="text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <w.icon className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">{w.title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBanner
        title="Ready to transform your business?"
        subtitle="Join thousands of businesses using CloudMonkey to build, run, and grow smarter every day."
        primary={{ label: "Get Started for Free", to: "/pricing" }}
        secondary={{ label: "Talk to an Expert", to: "/pricing" }}
        accent="var(--primary)"
      />
    </>
  );
}
