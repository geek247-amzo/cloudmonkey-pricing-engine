import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy - CloudMonkey" },
      {
        name: "description",
        content: "CloudMonkey Cookie Policy explaining how we use cookies and similar technologies on our website.",
      },
      { property: "og:title", content: "CloudMonkey Cookie Policy" },
      { property: "og:description", content: "Information about our use of cookies." },
      ogUrl("/legal/cookies"),
    ],
    links: [canonicalLink("/legal/cookies")],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Cookie className="h-8 w-8" />
          </div>
          <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-none text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            Cookie Policy
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            This policy explains how CloudMonkey uses cookies and similar tracking technologies when you visit our website or use our platform.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>What Are Cookies?</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>Cookies are small text files placed on your device by websites you visit. They are widely used to make websites work more efficiently, as well as to provide reporting information and personalized experiences.</p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>How We Use Cookies</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>CloudMonkey uses cookies for several purposes:</p>
              <ul className="list-inside list-disc space-y-2">
                <li><strong>Essential Cookies:</strong> Required for the operation of our platform, such as enabling you to log into secure areas or processing orders.</li>
                <li><strong>Performance and Analytics Cookies:</strong> Allow us to recognize and count the number of visitors and see how they move around our website. This helps us improve the way our website works.</li>
                <li><strong>Functionality Cookies:</strong> Used to recognize you when you return to our website, enabling us to personalize content and remember your preferences.</li>
                <li><strong>Targeting Cookies:</strong> Record your visit, pages visited, and links followed. We may use this to make advertising more relevant to your interests.</li>
              </ul>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Managing Cookies</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>You can manage your cookie preferences through your browser settings. Most browsers allow you to refuse or accept cookies, or delete them altogether.</p>
              <p>Please note that blocking essential cookies may impact your ability to use certain features of the CloudMonkey platform effectively, such as logging into your dashboard or completing checkouts.</p>
            </div>
          </article>

        </div>
      </section>
    </>
  );
}
