import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve the common typo/legacy URL and send visitors to the SEO checker.
export const Route = createFileRoute("/sso-checker")({
  beforeLoad: () => {
    throw redirect({ to: "/seo-checker" });
  },
});

export default function SsoCheckerRedirect() {
  return null;
}
