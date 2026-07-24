import { createFileRoute } from "@tanstack/react-router";
import { Headphones, Mic, PhoneCall, Route as RouteIcon } from "lucide-react";

import { ServiceLanePage } from "@/components/site/ServiceLanePage";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "Hosted PBX, VoIP & SIP Trunks South Africa | CloudMonkey" },
      { name: "description", content: "Managed VoIP, hosted PBX, SIP trunks, routing, IVR, call recording, reporting, and voice intelligence." },
      { property: "og:title", content: "CloudMonkey Voice" },
      { property: "og:description", content: "Hosted PBX, SIP trunks, routing, recording, and voice intelligence managed by CloudMonkey." },
      ogUrl("/voice"),
    ],
    links: [canonicalLink("/voice")],
  }),
  component: VoicePage,
});

function VoicePage() {
  return (
    <ServiceLanePage
      categoryId="voice"
      eyebrow="CloudMonkey Voice"
      title="Hosted PBX and voice systems"
      titleAccent="without telco complexity."
      subtitle="Managed VoIP, SIP trunks, extensions, IVR, recording, reporting, and voice intelligence for teams that need reliable communications."
      accent="var(--business)"
      features={[
        { icon: PhoneCall, title: "Hosted PBX", desc: "Cloud PBX, extensions, queues, ring groups, voicemail, recording, and reporting." },
        { icon: RouteIcon, title: "SIP Trunks & Routing", desc: "Number allocation, routing, failover, monitoring, and managed support." },
        { icon: Mic, title: "Voice Intelligence", desc: "Transcription, summaries, searchable calls, sentiment, and coaching workflows." },
        { icon: Headphones, title: "Managed Support", desc: "Setup, IVR design, recording policy, reporting, and troubleshooting." },
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
          answer: "A hosted PBX runs business call routing in managed cloud infrastructure instead of an on-site phone system. It can provide extensions, queues, ring groups, IVR, voicemail, recording and reporting according to the selected plan.",
        },
        {
          question: "Can existing business numbers be ported?",
          answer: "Number porting may be available subject to the current carrier, ownership records and regulatory approval. Carrier timelines and fees are outside CloudMonkey's direct control and are confirmed during onboarding.",
        },
        {
          question: "Are call charges included?",
          answer: "Carrier usage, destination-based call charges, number rental and regulatory costs are billed according to the applicable service order or prepaid usage rules. A platform package is not unlimited calling unless expressly stated.",
        },
      ]}
    />
  );
}
