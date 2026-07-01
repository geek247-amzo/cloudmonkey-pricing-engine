import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Cloud, Shield, Database, Activity, RefreshCcw } from "lucide-react";
import mascot from "@/assets/cm-mascot.png";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { fetchPublicPricingCatalog } from "@/lib/pricing";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: "CloudMonkey Cloud — Infrastructure without complexity" },
      { name: "description", content: "Scalable, secure, reliable cloud hosting, websites, ecommerce, CloudMonkey VPS and managed infrastructure." },
      { property: "og:title", content: "CloudMonkey Cloud" },
      { property: "og:description", content: "Infrastructure without complexity." },
    ],
  }),
  component: CloudPage,
});

const FEATURES = [
  { icon: Cloud, title: "Cloud Hosting & Servers", desc: "High-performance hosting built for speed, reliability, and scale." },
  { icon: Shield, title: "Security & Compliance", desc: "Enterprise-grade security and compliance protecting your data and your business." },
  { icon: Database, title: "Backups & Disaster Recovery", desc: "Automated backups and rapid recovery to keep your business running." },
  { icon: Activity, title: "Scalability & Performance", desc: "Elastic infrastructure that scales with your needs, on demand." },
];

function CloudUploadGraphic() {
  return (
    <div className="relative h-52 w-64 sm:h-60 sm:w-72">
      <div className="absolute bottom-0 left-3 h-32 w-56 rounded-[54px] bg-[linear-gradient(145deg,#8bd0ff,#1f8de8)] shadow-[inset_0_8px_18px_rgba(255,255,255,0.45),0_22px_42px_rgba(29,126,220,0.25)]" />
      <div className="absolute left-16 top-7 h-36 w-36 rounded-full bg-[linear-gradient(145deg,#a9dcff,#248ee6)] shadow-[inset_0_8px_20px_rgba(255,255,255,0.5)]" />
      <div className="absolute right-4 top-20 h-28 w-28 rounded-full bg-[linear-gradient(145deg,#8dccff,#1f83de)]" />
      <div className="absolute left-1/2 top-[5.8rem] h-20 w-12 -translate-x-1/2 rounded-t-md bg-[#e8f5ff] shadow-[0_8px_22px_rgba(15,96,173,0.25)]" />
      <div className="absolute left-1/2 top-16 h-24 w-24 -translate-x-1/2 rotate-45 rounded-md bg-[#e8f5ff] shadow-[0_8px_22px_rgba(15,96,173,0.25)]" />
      <div className="absolute left-1/2 top-20 h-28 w-28 -translate-x-1/2 bg-[linear-gradient(145deg,#ffffff,#d9efff)] [clip-path:polygon(50%_0,100%_45%,72%_45%,72%_100%,28%_100%,28%_45%,0_45%)]" />
    </div>
  );
}

function ServerStackGraphic() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="flex h-14 w-48 items-center justify-between rounded-lg border border-[#1a335d] bg-[linear-gradient(145deg,#172742,#07142a)] px-4 shadow-[0_10px_22px_rgba(6,20,45,0.18)]"
        >
          <div className="h-5 w-16 rounded bg-[#0c203c] shadow-inner" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="h-2.5 w-2.5 rounded-full bg-[#328dff] shadow-[0_0_8px_rgba(50,141,255,0.75)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShieldGraphic() {
  return (
    <div className="flex h-24 w-24 items-center justify-center text-[var(--cloud)]">
      <svg viewBox="0 0 96 96" className="h-full w-full" role="img" aria-label="Secure cloud shield">
        <path d="M48 10 78 22v20c0 20-12 34-30 44C30 76 18 62 18 42V22l30-12Z" fill="#e8f5ff" stroke="currentColor" strokeWidth="5" />
        <path d="M34 48 44 58 64 36" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
      </svg>
    </div>
  );
}

function CloudPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });
  const cat = data?.categories.find((category) => category.id === "cloud");
  return (
    <>
      <section className="relative isolate overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_46%,rgba(40,167,225,0.16),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(75,145,255,0.12),transparent_26%),linear-gradient(135deg,#ffffff_0%,#fbfdff_45%,#edf7ff_100%)]" />
        <div className="absolute right-[8%] top-14 hidden h-[450px] w-[450px] rounded-full border border-[#cae7ff] opacity-70 lg:block" />
        <div className="absolute right-[8%] top-20 hidden h-[430px] w-[260px] bg-[radial-gradient(circle,#b8dcff_1.3px,transparent_1.6px)] [background-size:18px_18px] opacity-60 lg:block" />
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-[0.95fr_1.2fr] lg:py-10">
          <div className="relative z-10 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-3 text-sm font-extrabold uppercase tracking-[0.02em] text-[var(--cloud)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-current">
                <Cloud className="h-4 w-4" />
              </span>
              Cloud
            </div>
            <h1 className="text-[clamp(3.1rem,7vw,5.65rem)] font-extrabold leading-[0.95] text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
              Infrastructure
              <br />
              <span className="text-[var(--cloud)]">without complexity.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-[#17213a]">
              Scalable, secure, and reliable cloud solutions that grow with your business. We handle the complexity so you can focus on what matters.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/auth/sign-up"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--cloud)] px-7 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(25,116,220,0.75)] transition-transform hover:-translate-y-0.5"
              >
                Explore Cloud Solutions <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth/sign-up"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#b8d7f7] bg-white/80 px-7 text-sm font-bold text-[var(--cloud)] transition-colors hover:bg-[var(--cloud-soft)]"
              >
                Get Started
              </Link>
            </div>
          </div>

          <div className="relative min-h-[560px] overflow-hidden lg:min-h-[610px]">
            <div className="absolute left-[42%] top-12 h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-[var(--cloud-soft)] opacity-80 blur-sm" />
            <img
              src={mascot}
              alt="CloudMonkey cloud infrastructure mascot"
              className="absolute bottom-0 left-[29%] z-20 h-[500px] w-auto -translate-x-1/2 object-contain drop-shadow-[0_26px_45px_rgba(13,68,128,0.16)] sm:h-[560px]"
            />
            <div className="absolute right-2 top-16 z-10 hidden sm:block">
              <CloudUploadGraphic />
            </div>
            <div className="absolute bottom-16 right-8 z-20 hidden sm:block">
              <ServerStackGraphic />
            </div>
            <div className="absolute bottom-28 left-[45%] z-30 hidden sm:block">
              <ShieldGraphic />
            </div>
            <div className="absolute inset-x-0 bottom-2 z-30 grid gap-4 sm:hidden">
              <CloudUploadGraphic />
              <div className="grid grid-cols-[auto_1fr] items-end gap-4">
                <ShieldGraphic />
                <ServerStackGraphic />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--cloud-soft)", color: "var(--cloud)" }}>
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
            eyebrow="Cloud Services"
            accent="var(--cloud)"
            title="Choose your cloud stack"
            subtitle="From domain to managed CloudMonkey VPS — all the building blocks for a modern web presence, configured and supported by our team."
          />
        </div>
        {isLoading ? (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12 text-center text-muted-foreground">
            <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Loading cloud catalog...
          </div>
        ) : isError ? (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <div className="font-semibold">Failed to load cloud pricing.</div>
              <button type="button" onClick={() => refetch()} className="mt-2 font-semibold underline">
                Try again
              </button>
            </div>
          </div>
        ) : cat ? (
          cat.services.map((s) => (
            <ServiceSection key={s.id} service={s} accent="cloud" ctaHref={(plan) => `/auth/sign-up?plan=${encodeURIComponent(plan.id)}`} />
          ))
        ) : (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12 text-center text-muted-foreground">
            No cloud services are configured yet.
          </div>
        )}
      </div>

      <CtaBanner
        title="Let's build your cloud the smart way."
        subtitle="Our experts help you design, migrate, and optimize your cloud infrastructure."
        primary={{ label: "Talk to an Expert", to: "/auth/sign-up" }}
        secondary={{ label: "Get Started", to: "/auth/sign-up" }}
        accent="var(--cloud)"
      />
    </>
  );
}
