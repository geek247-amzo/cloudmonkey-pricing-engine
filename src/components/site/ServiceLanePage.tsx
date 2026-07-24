import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, RefreshCcw } from "lucide-react";

import { CtaBanner } from "@/components/site/CtaBanner";
import { MascotHero } from "@/components/site/MascotHero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ServiceSection } from "@/components/site/ServiceSection";
import { CATEGORIES, fetchPublicPricingCatalog, type ServiceCategory } from "@/lib/pricing";

type LaneFeature = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

type LaneFaq = {
  question: string;
  answer: string;
};

export function ServiceLanePage({
  categoryId,
  eyebrow,
  title,
  titleAccent,
  subtitle,
  accent = "var(--ai)",
  features,
  proofPoints,
  ctaTitle,
  ctaSubtitle,
  faqs = [],
}: {
  categoryId: ServiceCategory["id"];
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  accent?: string;
  features: LaneFeature[];
  proofPoints: string[];
  ctaTitle: string;
  ctaSubtitle: string;
  faqs?: LaneFaq[];
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public", "pricing"],
    queryFn: fetchPublicPricingCatalog,
  });

  const categories = data?.categories ?? CATEGORIES;
  const category = categories.find((item) => item.id === categoryId);

  return (
    <>
      <MascotHero
        eyebrow={<><Check className="h-3 w-3" /> {eyebrow}</>}
        accent={accent}
        title={<>{title} <br /><span style={{ color: accent }}>{titleAccent}</span></>}
        subtitle={subtitle}
        ctas={
          <>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-elevated)]"
              style={{ background: accent }}
            >
              View Pricing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth/sign-up"
              search={{ bundle: undefined, plan: undefined, coupon: undefined, ref: undefined }}
              className="rounded-full border-2 bg-card px-6 py-3 text-sm font-semibold"
              style={{ borderColor: accent, color: accent }}
            >
              Request a Quote
            </Link>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent)", color: accent }}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-white to-secondary/70 p-8">
          <SectionHeading
            align="left"
            eyebrow="Service envelope"
            accent={accent}
            title="What the managed layer includes"
            subtitle="These lanes are sold as managed services, not unmanaged commodity hosting. The selected plan defines the exact commercial limits, setup work, support scope, and minimum term."
          />
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {proofPoints.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-border bg-white p-4 text-sm text-foreground/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 pt-16 text-center">
          <SectionHeading
            eyebrow={category?.name ?? eyebrow}
            accent={accent}
            title={category?.tagline ?? title}
            subtitle={category?.note ?? "Select the plan that matches the support envelope and commercial term you need."}
          />
        </div>
        {isLoading && (
          <div className="mx-auto mt-8 max-w-7xl px-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-sm text-blue-800">
              <RefreshCcw className="mr-2 inline h-4 w-4 animate-spin" />
              Refreshing live pricing. Crawlable fallback plans are shown below.
            </div>
          </div>
        )}
        {isError && (
          <div className="mx-auto mt-12 max-w-7xl px-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <div className="font-semibold">Live pricing did not load. Static catalog pricing is shown below.</div>
              <button type="button" onClick={() => refetch()} className="mt-2 font-semibold underline">
                Try again
              </button>
            </div>
          </div>
        )}
        {category ? (
          category.services.map((service) => (
            <ServiceSection
              key={service.id}
              service={service}
              accent={category.accent}
              ctaHref={(plan) => `/auth/sign-up?plan=${encodeURIComponent(plan.id)}`}
            />
          ))
        ) : (
          <div className="mx-auto mt-12 max-w-7xl px-6 py-12 text-center text-muted-foreground">
            No services are configured for this lane yet.
          </div>
        )}
      </div>

      {faqs.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faqs.map((item) => ({
                  "@type": "Question",
                  name: item.question,
                  acceptedAnswer: { "@type": "Answer", text: item.answer },
                })),
              }),
            }}
          />
          <SectionHeading
            eyebrow="Common questions"
            accent={accent}
            title={`About ${eyebrow}`}
            subtitle="Clear answers on scope, management, and what happens after launch."
          />
          <div className="mt-8 divide-y divide-border rounded-3xl border border-border bg-card px-6 shadow-[var(--shadow-card)]">
            {faqs.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none pr-8 text-base font-bold text-foreground marker:content-none">
                  {item.question}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      <CtaBanner
        title={ctaTitle}
        subtitle={ctaSubtitle}
        primary={{ label: "Request a Quote", to: "/auth/sign-up" }}
        secondary={{ label: "View Pricing", to: "/pricing" }}
        accent={accent}
      />
    </>
  );
}
