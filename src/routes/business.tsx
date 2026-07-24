import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  DollarSign,
  Headphones,
  MessageCircle,
  Shield,
  Workflow,
  BarChart3,
  RefreshCcw,
} from "lucide-react";
import mascot from "@/assets/cm-mascot.png";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { CATEGORIES, fetchPublicPricingCatalog } from "@/lib/pricing";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "CloudMonkey Business — Voice, productivity, security, and managed support" },
      {
        name: "description",
        content:
          "CloudMonkey Voice, Microsoft 365, Google Workspace, Managed IT and security — business technology managed by CloudMonkey.",
      },
      { property: "og:title", content: "CloudMonkey Business" },
      { property: "og:description", content: "Your business. Fully optimized." },
      ogUrl("/business"),
    ],
    links: [canonicalLink("/business")],
  }),
  component: BusinessPage,
});

const FEATURES = [
  {
    icon: Briefcase,
    title: "Microsoft 365 Management",
    desc: "Expert management and optimization of your Microsoft 365 environment.",
  },
  {
    icon: Headphones,
    title: "IT Support & Helpdesk",
    desc: "Fast, friendly support that keeps your team productive.",
  },
  {
    icon: MessageCircle,
    title: "Managed Voice",
    desc: "VoIP, hosted PBX, SIP trunks, routing, recording, apps, reporting, and call workflows.",
  },
  {
    icon: Shield,
    title: "Security & Compliance",
    desc: "Protect your business with proactive security and compliance services.",
  },
  {
    icon: Workflow,
    title: "Workflows & Automation",
    desc: "Automate repetitive work to save time and money.",
  },
  {
    icon: BarChart3,
    title: "IT Strategy & Consulting",
    desc: "Strategic guidance and roadmaps aligned to your business goals.",
  },
];

function ProductivityCard() {
  return (
    <div className="rounded-lg border border-[#e8edf1] bg-white/95 p-5 shadow-[0_18px_45px_rgba(9,39,19,0.12)] backdrop-blur">
      <div className="text-sm font-semibold text-[#17213a]">Team Productivity</div>
      <div className="mt-3 text-2xl font-extrabold text-[var(--business)]">+32%</div>
      <svg
        viewBox="0 0 210 92"
        className="mt-2 h-24 w-full"
        role="img"
        aria-label="Team productivity rising line chart"
      >
        <defs>
          <linearGradient id="businessChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#09953f" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#09953f" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d="M4 78 C24 58 34 70 50 53 S77 42 92 50 S116 65 132 42 S158 28 174 36 S196 23 206 8 L206 88 L4 88 Z"
          fill="url(#businessChartFill)"
        />
        <path
          d="M4 78 C24 58 34 70 50 53 S77 42 92 50 S116 65 132 42 S158 28 174 36 S196 23 206 8"
          fill="none"
          stroke="#09953f"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle cx="206" cy="8" r="5" fill="#09953f" />
      </svg>
    </div>
  );
}

function TasksCard() {
  return (
    <div className="flex items-center gap-5 rounded-lg border border-[#e8edf1] bg-white/95 p-5 shadow-[0_18px_45px_rgba(9,39,19,0.12)] backdrop-blur">
      <div
        className="relative h-20 w-20 shrink-0 rounded-full"
        style={{ background: "conic-gradient(var(--business) 0 98%, #e6f6ea 98% 100%)" }}
      >
        <div className="absolute inset-4 rounded-full bg-white" />
      </div>
      <div>
        <div className="text-sm font-semibold text-[#17213a]">Tasks Completed</div>
        <div className="mt-2 text-3xl font-extrabold text-[var(--business)]">98%</div>
        <div className="mt-2 h-1.5 w-16 rounded-full bg-[#e2f3e8]">
          <div className="h-full w-4/5 rounded-full bg-[var(--business)]" />
        </div>
      </div>
    </div>
  );
}

function OperationsCard() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e8edf1] bg-white/95 p-5 shadow-[0_18px_45px_rgba(9,39,19,0.12)] backdrop-blur">
      <div>
        <div className="text-sm font-semibold text-[#17213a]">Operational Focus</div>
        <div className="mt-4 text-3xl font-extrabold text-[var(--business)]">Less admin</div>
        <div className="mt-1 text-sm text-[#596273]">Fewer vendors to chase</div>
      </div>
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#d9f3df] text-[var(--business)]">
        <DollarSign className="h-8 w-8" />
      </div>
    </div>
  );
}

function BusinessPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });
  const pricingCategories = data?.categories ?? CATEGORIES;
  const businessCategoryIds = new Set(["voice", "addons", "quote-services"]);
  const businessServices =
    pricingCategories
      .filter((category) => businessCategoryIds.has(category.id))
      .flatMap((category) => category.services)
      .filter((service) => ["productivity", "security", "managed-it"].includes(service.id)) ?? [];
  return (
    <>
      <section className="relative isolate overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_24%,rgba(18,160,72,0.09),transparent_30%),radial-gradient(circle_at_58%_86%,rgba(18,160,72,0.08),transparent_25%)]" />
        <div className="absolute right-[8%] top-16 -z-10 hidden h-[360px] w-[360px] rounded-full bg-[var(--business-soft)] opacity-70 blur-2xl lg:block" />
        <div className="absolute right-[8%] top-20 hidden h-[440px] w-[230px] bg-[radial-gradient(circle,#b7e7c5_1.4px,transparent_1.6px)] [background-size:18px_18px] opacity-75 lg:block" />
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-8 px-6 py-16 lg:grid-cols-[0.95fr_1.45fr] lg:py-10">
          <div className="relative z-10 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-3 text-sm font-extrabold uppercase tracking-[0.02em] text-[var(--business)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-current">
                <Briefcase className="h-4 w-4" />
              </span>
              Business
            </div>
            <h1
              className="text-[clamp(3rem,7vw,5.6rem)] font-extrabold leading-[0.95] text-[#07102c]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your business.
              <br />
              <span className="text-[var(--business)]">Fully optimized.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-[#17213a]">
              Managed IT, Microsoft 365, Google Workspace, security, workflows, support, and voice
              services managed by one CloudMonkey team.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/auth/sign-up"
                search={{ bundle: undefined, plan: undefined, coupon: undefined, ref: undefined }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--business)] px-7 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(0,126,54,0.75)] transition-transform hover:-translate-y-0.5"
              >
                Explore Business IT <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth/sign-up"
                search={{ bundle: undefined, plan: undefined, coupon: undefined, ref: undefined }}
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--business)] px-7 text-sm font-bold text-[var(--business)] transition-colors hover:bg-[var(--business-soft)]"
              >
                Talk to an Expert
              </Link>
            </div>
          </div>

          <div className="relative min-h-[610px] overflow-hidden lg:min-h-[620px]">
            <div className="absolute left-1/2 top-16 h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-[var(--business-soft)] opacity-75" />
            <img
              src={mascot}
              alt="CloudMonkey business mascot"
              className="absolute bottom-0 left-1/2 z-10 h-[520px] w-auto -translate-x-[64%] object-contain drop-shadow-[0_26px_45px_rgba(6,35,20,0.16)] sm:h-[560px] lg:h-[590px]"
            />
            <div className="absolute right-0 top-8 z-20 hidden w-[min(48%,18rem)] sm:block">
              <ProductivityCard />
            </div>
            <div className="absolute right-0 top-[15.5rem] z-20 hidden w-[min(50%,18rem)] sm:block">
              <TasksCard />
            </div>
            <div className="absolute right-0 top-[28rem] z-20 hidden w-[min(50%,18rem)] sm:block">
              <OperationsCard />
            </div>
          </div>
          <div className="grid gap-3 sm:hidden">
            <ProductivityCard />
            <TasksCard />
            <OperationsCard />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading title="End-to-end IT management for your business" />
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center">
              <div
                className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: "var(--business-soft)", color: "var(--business)" }}
              >
                <f.icon className="h-7 w-7" />
              </div>
              <h3
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 pt-16 text-center">
          <SectionHeading
            eyebrow="Business Services"
            accent="var(--business)"
            title="Pick the voice and business services your team needs"
            subtitle="Hosted PBX, SIP trunks, managed productivity, security, and support can be combined into a single monthly invoice."
          />
        </div>
        {isLoading && (
          <div className="mx-auto mt-8 max-w-7xl px-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-sm text-blue-800">
              <RefreshCcw className="mr-2 inline h-4 w-4 animate-spin" />
              Refreshing live business pricing. Crawlable fallback plans are shown below.
            </div>
          </div>
        )}
        {isError && (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <div className="font-semibold">
                Live business pricing did not load. Static catalog pricing is shown below.
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-[var(--business)]/20 bg-[var(--business-soft)] p-8 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[var(--business)]">
                Managed voice
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Yeastar Cloud PBX and voice pricing
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                See the complete Hosted PBX, SIP Trunks, Voice Intelligence, and voice quote options
                on the dedicated Voice page.
              </p>
            </div>
            <Link
              to="/voice"
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ background: "var(--business)" }}
            >
              See full Voice pricing <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
        {businessServices.length ? (
          businessServices.map((s) => (
            <ServiceSection
              key={s.id}
              service={s}
              accent="business"
              ctaHref={(plan) => `/auth/sign-up?plan=${encodeURIComponent(plan.id)}`}
            />
          ))
        ) : (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12 text-center text-muted-foreground">
            No business services are configured yet.
          </div>
        )}
      </div>

      <CtaBanner
        title="Driving results for businesses like yours."
        subtitle="Streamline operations, reduce costs, and empower teams with the right technology — and a partner that's invested in your success."
        primary={{ label: "Talk to an Expert", to: "/auth/sign-up" }}
        secondary={{ label: "Get Started", to: "/auth/sign-up" }}
        accent="var(--business)"
      />
    </>
  );
}
