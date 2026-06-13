import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Shield, Lock, Zap, Headphones, Globe } from "lucide-react";
import { useState } from "react";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBanner } from "@/components/site/CtaBanner";
import { ServiceSection } from "@/components/site/ServiceSection";
import { getCategory } from "@/lib/pricing";

export const Route = createFileRoute("/domains")({
  head: () => ({
    meta: [
      { title: "Domains — Find your perfect domain. Build your brand." },
      { name: "description", content: "Register or transfer your domain with CloudMonkey. DNS, nameserver and renewal management included." },
      { property: "og:title", content: "CloudMonkey Domains" },
      { property: "og:description", content: "Find your perfect domain." },
    ],
  }),
  component: DomainsPage,
});

const TRUST = [
  { icon: Shield, title: "Free Privacy Protection", desc: "Keep your personal information private" },
  { icon: Lock, title: "SSL Certificate", desc: "Keep your site secure with SSL included" },
  { icon: Zap, title: "Instant Setup", desc: "Your domain is active in minutes" },
  { icon: Headphones, title: "24/7 Expert Support", desc: "We're here whenever you need us" },
];

function DomainsPage() {
  const cat = getCategory("cloud");
  const domainService = cat.services.find((s) => s.id === "domains")!;
  const [query, setQuery] = useState("");
  return (
    <>
      <MascotHero
        eyebrow={<><Globe className="h-3 w-3" /> Domains</>}
        accent="var(--primary)"
        title={<>Find your perfect domain. <br /><span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Build your brand.</span></>}
        subtitle="Register a new domain or transfer your existing one. Fast, secure, and simple."
        ctas={
          <div className="flex w-full max-w-lg flex-col gap-2">
            <div className="flex w-full overflow-hidden rounded-full border border-border bg-card shadow-[var(--shadow-card)]">
              <div className="flex flex-1 items-center gap-2 px-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find your perfect domain name"
                  className="w-full bg-transparent py-3 text-sm outline-none"
                />
              </div>
              <Link to="/pricing" className="rounded-full px-6 py-3 text-sm font-semibold text-white" style={{ background: "var(--gradient-primary)" }}>
                Search
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 px-2 text-xs text-muted-foreground">
              <span>.co.za <strong className="text-foreground">R99/yr</strong></span>
              <span>.com <strong className="text-foreground">R150/yr</strong></span>
              <span>.io <strong className="text-foreground">R599/yr</strong></span>
            </div>
          </div>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent)", color: "var(--primary)" }}>
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 pt-16 text-center">
          <SectionHeading
            eyebrow="Domain Plans"
            title="Pick the domain plan that fits"
            subtitle="All plans include DNS, nameserver, and renewal management."
          />
        </div>
        <ServiceSection service={domainService} accent="cloud" />
      </div>

      <CtaBanner
        title="Already have a domain?"
        subtitle="Transfer it to CloudMonkey and get 1 year added to your registration."
        primary={{ label: "Transfer Now", to: "/pricing" }}
        accent="var(--primary)"
      />
    </>
  );
}