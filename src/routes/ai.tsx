import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, MessageSquare, Zap, BarChart3, Search, Mic, Shield, RefreshCcw } from "lucide-react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { fetchPublicPricingCatalog } from "@/lib/pricing";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "CloudMonkey AI — Intelligent AI. Real business impact." },
      { name: "description", content: "AI agents, voice intelligence, automation and business assistants — built for real business outcomes." },
      { property: "og:title", content: "CloudMonkey AI" },
      { property: "og:description", content: "AI that works for your business." },
    ],
  }),
  component: AiPage,
});

const CAPS = [
  { icon: MessageSquare, title: "AI Assistants & Agents", desc: "Intelligent agents that understand, learn, and get things done." },
  { icon: Zap, title: "Process Automation", desc: "Automate repetitive tasks and complex business processes." },
  { icon: BarChart3, title: "Data Insights & Analytics", desc: "Turn data into insights that drive smarter decisions." },
  { icon: Search, title: "Knowledge & Search", desc: "Find answers instantly across all your data and systems." },
  { icon: Mic, title: "Voice AI & Chat", desc: "Natural conversations that make work effortless." },
  { icon: Shield, title: "Governance & Security", desc: "Enterprise-grade security and controls for responsible AI." },
];

const STATS = [
  { value: "500+", label: "AI Automations Deployed" },
  { value: "98%", label: "Accuracy in Task Execution" },
  { value: "10K+", label: "Hours Saved for Clients" },
];

function AiPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });
  const cat = data?.categories.find((category) => category.id === "ai");
  const visibleServices = cat?.services.filter((service) => service.id !== "openclaw") ?? [];
  return (
    <>
      <MascotHero
        eyebrow={<><Brain className="h-3 w-3" /> AI</>}
        accent="var(--ai)"
        title={<>Intelligent AI. <br /><span style={{ color: "var(--ai)" }}>Real business impact.</span></>}
        subtitle="AI agents and automation that streamline work, unlock insights, and give you a competitive edge."
        ctas={
          <>
            <Link to="/auth/sign-up" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--ai)" }}>
              Explore AI Solutions <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/ai-agents" className="rounded-full border-2 px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--ai)", color: "var(--ai)" }}>Meet the AI Agents</Link>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-6 text-center">
              <div className="text-4xl font-bold" style={{ color: "var(--ai)", fontFamily: "var(--font-display)" }}>{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionHeading title="Powerful AI capabilities for every part of your business" />
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((f) => (
            <div key={f.title} className="text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <f.icon className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 pt-16 text-center">
          <SectionHeading
            eyebrow="AI Services"
            accent="var(--ai)"
            title="AI tailored to your business"
            subtitle="From a single AI assistant to workflow automation and business intelligence — pick the depth of AI your team needs."
          />
        </div>
        {isLoading ? (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12 text-center text-muted-foreground">
            <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Loading AI catalog...
          </div>
        ) : isError ? (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <div className="font-semibold">Failed to load AI pricing.</div>
              <button type="button" onClick={() => refetch()} className="mt-2 font-semibold underline">
                Try again
              </button>
            </div>
          </div>
        ) : visibleServices.length ? (
          visibleServices.map((s) => (
            <ServiceSection key={s.id} service={s} accent="ai" ctaHref={(plan) => `/auth/sign-up?plan=${encodeURIComponent(plan.id)}`} />
          ))
        ) : (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12 text-center text-muted-foreground">
            No AI services are configured yet.
          </div>
        )}
      </div>

      <CtaBanner
        title="Ready to unlock the power of AI?"
        subtitle="Let's build intelligent solutions that drive real results for your business."
        primary={{ label: "Talk to an Expert", to: "/auth/sign-up" }}
        secondary={{ label: "Explore AI Agents", to: "/ai-agents" }}
        accent="var(--ai)"
      />
    </>
  );
}
