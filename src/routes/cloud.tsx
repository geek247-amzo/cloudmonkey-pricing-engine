import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cloud, Shield, Database, Activity } from "lucide-react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { getCategory } from "@/lib/pricing";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: "CloudMonkey Cloud — Infrastructure without complexity" },
      { name: "description", content: "Scalable, secure, reliable cloud hosting, websites, ecommerce, VPS and managed infrastructure from CloudMonkey." },
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

function CloudPage() {
  const cat = getCategory("cloud");
  return (
    <>
      <MascotHero
        eyebrow={<><Cloud className="h-3 w-3" /> Cloud</>}
        accent="var(--cloud)"
        title={<>Infrastructure <br /><span style={{ color: "var(--cloud)" }}>without complexity.</span></>}
        subtitle="Scalable, secure, and reliable cloud solutions that grow with your business. We handle the complexity so you can focus on what matters."
        ctas={
          <>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--cloud)" }}>
              Explore Cloud Solutions <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary">View Pricing</Link>
          </>
        }
      />

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
            subtitle="From domain to dedicated VPS — all the building blocks for a modern web presence, with managed add-ons available on every plan."
          />
        </div>
        {cat.services.map((s) => (
          <ServiceSection key={s.id} service={s} accent="cloud" />
        ))}
      </div>

      <CtaBanner
        title="Let's build your cloud the smart way."
        subtitle="Our experts help you design, migrate, and optimize your cloud infrastructure."
        primary={{ label: "Talk to an Expert", to: "/pricing" }}
        secondary={{ label: "View Pricing", to: "/pricing" }}
        accent="var(--cloud)"
      />
    </>
  );
}