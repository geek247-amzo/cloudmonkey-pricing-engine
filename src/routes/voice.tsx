import { createFileRoute } from "@tanstack/react-router";
import { Headphones, Mic, PhoneCall, Route as RouteIcon } from "lucide-react";

import { ServiceLanePage } from "@/components/site/ServiceLanePage";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "Hosted PBX, VoIP & SIP Trunks South Africa | CloudMonkey" },
      {
        name: "description",
        content:
          "Yeastar Cloud PBX, managed VoIP, SIP trunks, routing, IVR, call recording, reporting, and voice intelligence from CloudMonkey.",
      },
      { property: "og:title", content: "CloudMonkey Voice" },
      {
        property: "og:description",
        content:
          "Hosted PBX, SIP trunks, routing, recording, and voice intelligence managed by CloudMonkey.",
      },
      ogUrl("/voice"),
    ],
    links: [canonicalLink("/voice")],
  }),
  component: VoicePage,
});

function VoicePage() {
  return (
    <>
      <ServiceLanePage
        categoryId="voice"
        eyebrow="CloudMonkey Voice"
        title="Hosted PBX and voice systems"
        titleAccent="without telco complexity."
        subtitle="Managed VoIP, SIP trunks, extensions, IVR, recording, reporting, and voice intelligence for teams that need reliable communications."
        accent="var(--business)"
        features={[
          {
            icon: PhoneCall,
            title: "Hosted PBX",
            desc: "Cloud PBX, extensions, queues, ring groups, voicemail, recording, and reporting.",
          },
          {
            icon: RouteIcon,
            title: "SIP Trunks & Routing",
            desc: "Number allocation, routing, failover, monitoring, and managed support.",
          },
          {
            icon: Mic,
            title: "Voice Intelligence",
            desc: "Transcription, summaries, searchable calls, sentiment, and coaching workflows.",
          },
          {
            icon: Headphones,
            title: "Managed Support",
            desc: "Setup, IVR design, recording policy, reporting, and troubleshooting.",
          },
        ]}
        proofPoints={[
          "Voice Team bundles are capped at 10 extensions unless upgraded or quoted.",
          "Carrier usage, call charges, regulatory costs, number porting delays, and customer network quality are excluded.",
          "Setup covers PBX configuration, SIP trunk setup, IVR design, and recording configuration.",
          "Contact centre, multi-site rollout, compliance retention, and CRM integration are quote-based.",
        ]}
        ctaTitle="Want CloudMonkey to manage your voice stack?"
        ctaSubtitle="Choose hosted PBX, SIP trunks, voice intelligence, or request a quote for a multi-site or contact centre rollout."
        faqs={[
          {
            question: "What is a hosted PBX?",
            answer:
              "A hosted PBX runs business call routing in managed cloud infrastructure instead of an on-site phone system. It can provide extensions, queues, ring groups, IVR, voicemail, recording and reporting according to the selected plan.",
          },
          {
            question: "Can existing business numbers be ported?",
            answer:
              "Number porting may be available subject to the current carrier, ownership records and regulatory approval. Carrier timelines and fees are outside CloudMonkey's direct control and are confirmed during onboarding.",
          },
          {
            question: "Are call charges included?",
            answer:
              "Carrier usage, destination-based call charges, number rental and regulatory costs are billed according to the applicable service order or prepaid usage rules. A platform package is not unlimited calling unless expressly stated.",
          },
        ]}
      />
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-[var(--business)]/30 bg-[var(--business-soft)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--business)]">
                CloudMonkey partner platform
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">
                Yeastar Cloud PBX, managed by CloudMonkey.
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                Yeastar Cloud PBX gives teams a modern business phone system with the call flows,
                clients, and integrations needed to stay responsive across locations and devices.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:w-[46%]">
              {[
                "Extensions, queues, and ring groups",
                "Multi-level IVR and intelligent routing",
                "Linkus mobile, desktop, and web clients",
                "Call recording, reporting, and queue tools",
                "CRM and helpdesk integrations",
                "Microsoft 365 connectivity",
              ].map((feature) => (
                <div key={feature} className="rounded-2xl border border-border bg-background p-4">
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
