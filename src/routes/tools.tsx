import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, ArrowRight, Search, ShieldCheck } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Free Website Tools — CloudMonkey" },
      {
        name: "description",
        content:
          "Use CloudMonkey's free website tools to check SEO, technical health, and search visibility.",
      },
      { property: "og:title", content: "Free Website Tools — CloudMonkey" },
      { property: "og:description", content: "Free CloudMonkey tools for SEO and website health." },
      ogUrl("/tools"),
    ],
    links: [canonicalLink("/tools")],
  }),
  component: ToolsPage,
});

const TOOLS = [
  {
    icon: Search,
    title: "Free SEO Checker",
    description:
      "Check titles, metadata, links, structured data, accessibility, and technical search issues.",
    to: "/seo-checker" as const,
    action: "Run an SEO scan",
  },
  {
    icon: ShieldCheck,
    title: "Free SSL Checker",
    description: "Check certificate validity, hostname matching, issuer, and expiry dates.",
    to: "/tools/ssl-checker" as const,
    action: "Check SSL",
  },
  {
    icon: Activity,
    title: "Free Uptime Checker",
    description: "Check HTTP status, response time, and redirect behavior in one quick test.",
    to: "/tools/uptime-checker" as const,
    action: "Check uptime",
  },
];

function ToolsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/tools") return <Outlet />;

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <SectionHeading
        eyebrow="CloudMonkey Free Tools"
        title="Practical tools for healthier websites"
        subtitle="Start with a free SEO scan, then come back as more website health tools are added."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.title}
              to={tool.to}
              className="group rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-[var(--ai)]">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-6 text-xl font-bold">{tool.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tool.description}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ai)]">
                {tool.action}{" "}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
