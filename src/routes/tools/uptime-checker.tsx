import { createFileRoute } from "@tanstack/react-router";

import { FreeToolChecker } from "@/components/site/FreeToolChecker";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/tools/uptime-checker")({
  head: () => ({
    meta: [
      { title: "Free Uptime Checker — CloudMonkey" },
      {
        name: "description",
        content:
          "Check website availability, HTTP status, response time, and redirects with CloudMonkey's free uptime checker.",
      },
      { property: "og:title", content: "Free Uptime Checker — CloudMonkey" },
      ogUrl("/tools/uptime-checker"),
    ],
    links: [canonicalLink("/tools/uptime-checker")],
  }),
  component: () => <FreeToolChecker kind="uptime" />,
});
