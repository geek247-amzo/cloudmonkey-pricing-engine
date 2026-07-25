import { createFileRoute } from "@tanstack/react-router";

import { FreeToolChecker } from "@/components/site/FreeToolChecker";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/tools/ssl-checker")({
  head: () => ({
    meta: [
      { title: "Free SSL Checker — CloudMonkey" },
      {
        name: "description",
        content:
          "Check SSL certificate validity, issuer, hostname matching, and expiry with CloudMonkey's free SSL checker.",
      },
      { property: "og:title", content: "Free SSL Checker — CloudMonkey" },
      ogUrl("/tools/ssl-checker"),
    ],
    links: [canonicalLink("/tools/ssl-checker")],
  }),
  component: () => <FreeToolChecker kind="ssl" />,
});
