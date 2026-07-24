import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Megaphone, Search, Target } from "lucide-react";

import { ServiceLanePage } from "@/components/site/ServiceLanePage";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/marketing")({
  head: () => ({
    meta: [
      { title: "Managed SEO & Digital Marketing South Africa | CloudMonkey" },
      {
        name: "description",
        content:
          "Managed SEO, content, campaigns, competitor intelligence, reporting, and growth operations for South African businesses.",
      },
      { property: "og:title", content: "CloudMonkey Marketing" },
      {
        property: "og:description",
        content: "SEO, content, campaigns, and growth operations managed by CloudMonkey.",
      },
      ogUrl("/marketing"),
    ],
    links: [canonicalLink("/marketing")],
  }),
  component: MarketingPage,
});

function MarketingPage() {
  return (
    <>
      <ServiceLanePage
        categoryId="marketing"
        eyebrow="CloudMonkey Marketing"
        title="Marketing operations"
        titleAccent="managed month to month."
        subtitle="SEO, content, campaigns, competitor intelligence, reporting, and growth workflows connected to your cloud, website, and business systems."
        accent="var(--business)"
        features={[
          {
            icon: Search,
            title: "SEO & Competitor Intel",
            desc: "Track competitors, keyword gaps, technical SEO issues, and priority fixes.",
          },
          {
            icon: Megaphone,
            title: "Campaign Management",
            desc: "Plan and manage campaigns with landing pages, tracking, and monthly reporting.",
          },
          {
            icon: Target,
            title: "Content & Local Growth",
            desc: "Managed content calendars, local SEO, and on-page improvements.",
          },
          {
            icon: BarChart3,
            title: "Reporting & Actions",
            desc: "Reports focus on next actions, not vanity dashboards.",
          },
        ]}
        proofPoints={[
          "Marketing plans define monthly deliverables, reporting cadence, and improvement scope.",
          "Ad spend, media budgets, creative production outside scope, and paid platform fees are separate.",
          "Competitor intelligence is used to prioritise fixes and content opportunities.",
          "Quote-based work covers complex campaigns, large content volumes, and custom integrations.",
        ]}
        ctaTitle="Need a marketing lane that connects to your platform?"
        ctaSubtitle="Pick a managed growth plan or request a quote for campaign, SEO, and reporting operations."
        faqs={[
          {
            question: "What does managed SEO include?",
            answer:
              "The selected plan defines its technical audit, keyword tracking, competitor intelligence, content, on-page changes and reporting allocation. Advertising spend and large creative projects remain separate.",
          },
          {
            question: "Does CloudMonkey guarantee first-page rankings?",
            answer:
              "No provider can responsibly guarantee an organic ranking. CloudMonkey measures technical health, search visibility, qualified traffic and conversion actions, then prioritises work against evidence and the subscribed delivery allocation.",
          },
          {
            question: "Can SEO connect to my website and CRM?",
            answer:
              "Yes. CloudMonkey can connect analytics, forms, landing pages and supported CRM workflows so reporting follows leads and outcomes rather than traffic alone. Custom integrations are scoped separately.",
          },
        ]}
      />
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--business)]">
              Free tool
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              See what your website needs next.
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Run CloudMonkey&apos;s free SEO checker for practical technical and search visibility
              findings.
            </p>
          </div>
          <Link
            to="/seo-checker"
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            Check my site <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
