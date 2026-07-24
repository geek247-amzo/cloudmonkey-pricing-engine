import { createFileRoute } from "@tanstack/react-router";
import { Code2, Globe2, Rocket, Workflow } from "lucide-react";

import { ServiceLanePage } from "@/components/site/ServiceLanePage";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Monthly Website & App Development South Africa | CloudMonkey" },
      { name: "description", content: "Managed monthly website, ecommerce, portal and app development for South African businesses, with hosting, support and defined delivery limits." },
      { property: "og:title", content: "CloudMonkey Build" },
      { property: "og:description", content: "Websites, apps, ecommerce, and portals built and managed by CloudMonkey." },
      ogUrl("/build"),
    ],
    links: [canonicalLink("/build")],
  }),
  component: BuildPage,
});

function BuildPage() {
  return (
    <ServiceLanePage
      categoryId="build"
      eyebrow="CloudMonkey Build"
      title="Websites, apps, and portals"
      titleAccent="built as a managed service."
      subtitle="Launch websites, ecommerce stores, dashboards, MVPs, and internal portals with delivery, hosting, support, and improvements handled by one team."
      accent="var(--ai)"
      features={[
        { icon: Globe2, title: "Websites & Landing Pages", desc: "Conversion-focused sites with hosting, SSL, forms, analytics, and launch support." },
        { icon: Rocket, title: "Ecommerce Launches", desc: "Online stores with payments, product setup, reporting, and operations support." },
        { icon: Code2, title: "Apps & Portals", desc: "Custom dashboards, client portals, internal tools, and workflow interfaces." },
        { icon: Workflow, title: "Managed Improvements", desc: "Monthly updates and roadmap work instead of one-and-done delivery." },
      ]}
      proofPoints={[
        "Setup fees cover scoping, launch planning, configuration, and deployment work.",
        "Monthly fees cover hosting, support, monitoring, updates, and defined improvement time.",
        "Custom app work, complex integrations, and scope expansion are quote-based.",
        "Minimum terms are set per plan so subscriptions and invoices stay commercially aligned.",
      ]}
      ctaTitle="Need CloudMonkey to build it and run it?"
      ctaSubtitle="Choose a Build plan or request a custom scope for ecommerce, portals, dashboards, and MVPs."
      faqs={[
        {
          question: "How do CloudMonkey monthly website packages work?",
          answer: "A Build package combines a defined development allocation with the hosting, monitoring, backups, deployment and support stated in that plan. Package limits and minimum terms apply, and unused allowances do not roll over unless a service order says otherwise.",
        },
        {
          question: "Can CloudMonkey build ecommerce stores and custom applications?",
          answer: "Yes. Ecommerce plans cover a defined storefront scope. Portals, operational applications and larger integrations are scoped against Build Scale or a signed Custom App Build service order with acceptance criteria.",
        },
        {
          question: "What happens when active development is complete?",
          answer: "The Build subscription can transition to Managed Server, the selected VPS tier, backups and usage services. New features can reactivate a suitable Build package or be quoted separately.",
        },
      ]}
    />
  );
}
