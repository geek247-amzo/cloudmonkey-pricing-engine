import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cloud, Briefcase, Brain, Check, Shield, Zap, Headphones, Sparkles, RefreshCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import mascot from "@/assets/cm-mascot.png";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { BUNDLES, fetchPublicPricingCatalog, formatPrice } from "@/lib/pricing";
import { useCurrency } from "@/lib/currency";
import { useHydratedSession } from "@/hooks/use-admin-access";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Managed Cloud, Websites & AI Services South Africa | CloudMonkey" },
      { name: "description", content: "CloudMonkey manages cloud infrastructure, websites, business systems, voice and AI automation for South African SMEs through one team, invoice and dashboard." },
      { property: "og:title", content: "CloudMonkey — Everything your business needs. Simplified." },
      { property: "og:description", content: "Cloud, Business and AI — one platform, one invoice, one dashboard." },
      ogUrl("/"),
    ],
    links: [canonicalLink("/")],
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
  { icon: Shield, title: "All-in-One Platform", desc: "Replace 4 vendor invoices with 1 — clients typically cut admin time by 10+ hours/month." },
  { icon: Zap, title: "Built for Growth", desc: "Start small and scale instantly without migrating platforms or changing providers." },
  { icon: Check, title: "Secure by Design", desc: "POPIA-compliant data residency and built-in backups ensure your business is always protected." },
  { icon: Sparkles, title: "Optimize Costs", desc: "Bundle cloud, IT, and AI to save up to 30% compared to paying separate vendors." },
  { icon: Headphones, title: "Local Expert Support", desc: "Direct support from South African engineers who understand the context—no offshore call centers." },
];

const COMPARISON = [
  {
    title: "Hosting only",
    price: "From R55/year",
    description: "Domains and basic hosting components when you already know what you need.",
    bullets: ["Domain registration", "DNS management", "Hosting options"],
    to: "/domains",
  },
  {
    title: "Managed Cloud",
    price: "From R1,450/month",
    description: "Infrastructure operated by CloudMonkey with monitoring, backups, support, and updates.",
    bullets: ["Managed VPS", "SSL and backups", "Support included"],
    to: "/cloud",
  },
  {
    title: "Build + Managed Cloud",
    price: "From R999/month + setup",
    description: "We build the website, store, portal, or app and keep the platform running after launch.",
    bullets: ["Website/app build", "Managed hosting", "Monthly improvements"],
    to: "/build",
  },
  {
    title: "AI Agent Bundle",
    price: "R999/agent/month",
    description: "Purpose-built AI agents with business knowledge, managed setup, and monthly optimisation.",
    bullets: ["1M tokens/month", "Knowledge base", "Tuning review"],
    to: "/ai-agents",
  },
] as const;

const AGENT_COLORS = ["#12a04a", "#28a7e1", "#d947ef", "#fb923c"];

function AgentAvatar({ index }: { index: number }) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow-sm"
      style={{ background: AGENT_COLORS[index % AGENT_COLORS.length] }}
    >
      {index + 1}
    </div>
  );
}

function AiAgentsCard() {
  return (
    <div className="rounded-lg border border-[#ece8ff] bg-white/95 p-5 shadow-[0_18px_45px_rgba(77,48,170,0.12)] backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-extrabold text-[#07102c]">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ai)] text-white">
          <Brain className="h-3 w-3" />
        </span>
        Your AI Agents
      </div>
      <div className="mt-4 flex items-center">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={item === 0 ? "" : "-ml-2"}>
            <AgentAvatar index={item} />
          </div>
        ))}
        <div className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#efeaff] text-xs font-extrabold text-[var(--ai)] shadow-sm">+6</div>
      </div>
    </div>
  );
}

function SystemStatusCard() {
  return (
    <div className="rounded-lg border border-[#ece8ff] bg-white/95 p-5 shadow-[0_18px_45px_rgba(77,48,170,0.12)] backdrop-blur">
      <div className="text-sm font-extrabold text-[#07102c]">System Status</div>
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#4c566f]">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dff7e7] text-[var(--business)]">
          <Check className="h-3.5 w-3.5" />
        </span>
        All Systems Operational
      </div>
      <svg viewBox="0 0 210 78" className="mt-5 h-20 w-full" role="img" aria-label="System status line chart">
        <path d="M6 58 C22 50 35 53 48 48 S69 38 84 47 S108 57 124 44 S151 26 174 35 S196 39 206 20" fill="none" stroke="#41b967" strokeLinecap="round" strokeWidth="3" />
        <circle cx="206" cy="20" r="5" fill="#12a04a" />
      </svg>
    </div>
  );
}

function CostOptimizationCard() {
  return (
    <div className="rounded-lg border border-[#ece8ff] bg-white/95 p-5 shadow-[0_18px_45px_rgba(77,48,170,0.12)] backdrop-blur">
      <div className="text-sm font-extrabold text-[#07102c]">Managed Simplicity</div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-extrabold text-[#07102c]">One team</div>
          <div className="mt-1 text-sm font-semibold text-[#5d6477]">Less vendor chasing</div>
        </div>
        <div className="rounded-full bg-[#dff7e7] px-3 py-1.5 text-sm font-extrabold text-[var(--business)]">Managed</div>
      </div>
    </div>
  );
}

function HomePage() {
  const { currency } = useCurrency();
  const { data: session, authReady } = useHydratedSession();
  const isSignedIn = authReady && !!session;
  const primaryHeroHref = isSignedIn ? "/dashboard" : "/auth/sign-up";
  const primaryHeroLabel = isSignedIn ? "Dashboard" : "View Pricing";
  const bannerPrimaryHref = isSignedIn ? "/dashboard" : "/auth/sign-up";
  const bannerPrimaryLabel = isSignedIn ? "Go to Dashboard" : "Request a Quote";

  const { data, isLoading } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });

  const bundles = data?.bundles || BUNDLES;
  const bundleColumnCount = Math.min(Math.max(bundles.length || 1, 1), 5);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_73%_42%,rgba(124,58,237,0.13),transparent_34%),radial-gradient(circle_at_88%_16%,rgba(40,167,225,0.11),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fbfbff_46%,#f2efff_100%)]" />
        <div className="absolute right-[8%] top-16 hidden h-[460px] w-[460px] rounded-full border border-[#ded5ff] opacity-60 lg:block" />
        <div className="absolute right-[4%] top-6 hidden h-[500px] w-[360px] bg-[radial-gradient(circle,#d7cdfc_1.2px,transparent_1.5px)] [background-size:18px_18px] opacity-50 lg:block" />
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-8 px-6 py-14 lg:grid-cols-[0.95fr_1.45fr] lg:py-8">
          <div className="relative z-10 max-w-xl">
            <div className="mb-7 inline-flex rounded-full bg-[#f0eafd] px-4 py-2 text-sm font-extrabold text-[var(--ai)]">
              Built for South African Businesses.
            </div>
            <h1 className="text-[clamp(3.2rem,7vw,5.75rem)] font-extrabold leading-[0.94] text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
              Everything your
              <br />
              business needs.
              <br />
              <span className="text-[var(--ai)]">Simplified.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-[#17213a]">
              CloudMonkey brings together cloud infrastructure, business solutions, and AI agents to help you build, run, and grow your business, all in one place.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to={isSignedIn ? primaryHeroHref : "/pricing"}
                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[var(--ai)] px-8 text-sm font-extrabold text-white shadow-[0_18px_34px_-20px_rgba(91,44,214,0.85)] transition-transform hover:-translate-y-0.5"
              >
                {primaryHeroLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/build"
                className="inline-flex min-h-14 items-center justify-center rounded-lg border border-[#cfc3f8] bg-white/80 px-8 text-sm font-extrabold text-[var(--ai)] shadow-sm transition-colors hover:bg-[#f5f1ff]"
              >
                Build My Website/App
              </Link>
              <Link
                to="/cloud"
                className="inline-flex min-h-14 items-center justify-center rounded-lg border border-[#cfc3f8] bg-white/80 px-8 text-sm font-extrabold text-[var(--ai)] shadow-sm transition-colors hover:bg-[#f5f1ff]"
              >
                Get Managed Cloud
              </Link>
              <Link
                to="/ai-agents"
                className="inline-flex min-h-14 items-center justify-center rounded-lg border border-[#cfc3f8] bg-white/80 px-8 text-sm font-extrabold text-[var(--ai)] shadow-sm transition-colors hover:bg-[#f5f1ff]"
              >
                Add an AI Agent
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#515a70]">
              {["No credit card required", "Cancel anytime", "7-day free trial on eligible cloud plans"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 rounded-full border border-[var(--ai)] p-0.5 text-[var(--ai)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[610px] overflow-hidden lg:min-h-[620px]">
            <div className="absolute left-[45%] top-8 h-[510px] w-[510px] -translate-x-1/2 rounded-full bg-[#efeaff] opacity-55 blur-sm" />
            <img
              src={mascot}
              alt="CloudMonkey mascot"
              className="absolute bottom-0 left-[43%] z-10 h-[560px] w-auto -translate-x-1/2 object-contain drop-shadow-[0_28px_48px_rgba(42,27,91,0.16)] lg:h-[610px]"
            />
            <div className="absolute right-0 top-8 z-20 hidden w-[min(46%,18rem)] sm:block">
              <AiAgentsCard />
            </div>
            <div className="absolute right-0 top-[11.5rem] z-20 hidden w-[min(48%,18rem)] sm:block">
              <SystemStatusCard />
            </div>
            <div className="absolute right-0 top-[28rem] z-20 hidden w-[min(48%,18rem)] sm:block">
              <CostOptimizationCard />
            </div>
          </div>
          <div className="grid gap-3 sm:hidden">
            <AiAgentsCard />
            <SystemStatusCard />
            <CostOptimizationCard />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading
          eyebrow="Choose the right engagement"
          accent="var(--ai)"
          title={<>Hosting only vs managed platform</>}
          subtitle="CloudMonkey is not just raw hosting. Pick the service envelope that matches how much setup, support, and business outcome you want included."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {COMPARISON.map((item) => (
            <Link key={item.title} to={item.to} className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ai)]">{item.price}</div>
              <h3 className="mt-3 text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <ul className="mt-5 space-y-2 text-sm text-foreground/80">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ai)]" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--ai)]">
                View option <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust Signals */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4 text-center">
          <div>
            <div className="text-4xl font-extrabold text-[var(--ai)]" style={{ fontFamily: "var(--font-display)" }}>50+</div>
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Businesses Managed</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-[var(--ai)]" style={{ fontFamily: "var(--font-display)" }}>99.9%</div>
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Uptime Delivered</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-[var(--ai)]" style={{ fontFamily: "var(--font-display)" }}>24/7</div>
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Local Expert Support</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-[var(--ai)]" style={{ fontFamily: "var(--font-display)" }}>1</div>
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Simplified Invoice</div>
          </div>
        </div>
      </section>

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
            subtitle="CloudMonkey is a managed service: we set up, monitor, secure, update, and support the cloud, business, and AI tools in your bundle."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { icon: Headphones, title: "Handled for you", desc: "Setup, changes, and support are done by the CloudMonkey team." },
              { icon: Shield, title: "Managed security", desc: "Backups, monitoring, access, and updates stay on our radar." },
              { icon: Zap, title: "Connected workflows", desc: "Cloud, business apps, and AI agents are configured to work together." },
              { icon: Check, title: "One accountable team", desc: "No vendor chasing, no DIY stack maintenance, one support path." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 rounded-lg border border-border bg-background p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ai-soft)] text-[var(--ai)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{item.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-[repeat(var(--bundle-columns),minmax(0,1fr))]"
            style={{ "--bundle-columns": String(bundleColumnCount) } as CSSProperties}
          >

            {bundles.map((b: any) => (
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
                <div className="mb-3 inline-flex w-fit rounded-full bg-[var(--ai-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ai)]">
                  Managed service
                </div>
                <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{b.name}</div>
	                <div className="mt-2 text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
	                  {formatPrice(b.priceZar, currency)}
	                  <span className="ml-1 text-xs font-normal text-muted-foreground">{b.unit || "/month"}</span>
	                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground/80">
                  {b.features.map((f: any) => (
                    <li key={typeof f === "string" ? f : f.id} className="flex gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: "var(--ai)" }} />
                      {typeof f === "string" ? f : f.content}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth/sign-up"
                  search={{ bundle: b.id, plan: undefined, coupon: undefined, ref: undefined }}
                  className="mt-5 rounded-full border border-border px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary"
                >
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
        title={isSignedIn ? "Your dashboard is ready." : "Ready to transform your business?"}
        subtitle="Designed to reduce vendor chasing, manual admin, support complexity, and disconnected business systems."
        primary={{ label: bannerPrimaryLabel, to: bannerPrimaryHref }}
        secondary={isSignedIn ? { label: "Explore Solutions", to: "/cloud" } : { label: "View Pricing", to: "/pricing" }}
        accent="var(--primary)"
      />
    </>
  );
}
