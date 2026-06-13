import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase, Headphones, MessageCircle, Shield, Workflow, BarChart3 } from "lucide-react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { getCategory } from "@/lib/pricing";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "CloudMonkey Business — Your complete managed IT department" },
      { name: "description", content: "Microsoft 365, Google Workspace, Hosted PBX, Managed IT and security — your entire IT department, managed by CloudMonkey." },
      { property: "og:title", content: "CloudMonkey Business" },
      { property: "og:description", content: "Your business. Fully optimized." },
    ],
  }),
  component: BusinessPage,
});

const FEATURES = [
  { icon: Briefcase, title: "Microsoft 365 Management", desc: "Expert management and optimization of your Microsoft 365 environment." },
  { icon: Headphones, title: "IT Support & Helpdesk", desc: "Fast, friendly support that keeps your team productive." },
  { icon: MessageCircle, title: "Business Communications", desc: "Reliable voice, video, and messaging that connects your team." },
  { icon: Shield, title: "Security & Compliance", desc: "Protect your business with proactive security and compliance services." },
  { icon: Workflow, title: "Workflows & Automation", desc: "Automate repetitive work to save time and money." },
  { icon: BarChart3, title: "IT Strategy & Consulting", desc: "Strategic guidance and roadmaps aligned to your business goals." },
];

function BusinessPage() {
  const cat = getCategory("business");
  return (
    <>
      <MascotHero
        eyebrow={<><Briefcase className="h-3 w-3" /> Business</>}
        accent="var(--business)"
        title={<>Your business. <br /><span style={{ color: "var(--business)" }}>Fully optimized.</span></>}
        subtitle="We manage the technology behind your business so you can focus on what you do best. From IT management to process automation — efficiency, productivity and growth."
        ctas={
          <>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--business)" }}>
              Explore Business Solutions <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="rounded-full border-2 px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--business)", color: "var(--business)" }}>Talk to an Expert</Link>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading title="End-to-end IT management for your business" />
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--business-soft)", color: "var(--business)" }}>
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
            eyebrow="Business Services"
            accent="var(--business)"
            title="Pick the services your team needs"
            subtitle="Per-user, per-device, or all-in tiers — combine what you need into a single monthly invoice."
          />
        </div>
        {cat.services.map((s) => (
          <ServiceSection key={s.id} service={s} accent="business" />
        ))}
      </div>

      <CtaBanner
        title="Driving results for businesses like yours."
        subtitle="Streamline operations, reduce costs, and empower teams with the right technology — and a partner that's invested in your success."
        primary={{ label: "Talk to an Expert", to: "/pricing" }}
        secondary={{ label: "View Pricing", to: "/pricing" }}
        accent="var(--business)"
      />
    </>
  );
}