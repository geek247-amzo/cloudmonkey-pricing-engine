import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal/aup")({
  head: () => ({
    meta: [
      { title: "Acceptable Use Policy - CloudMonkey" },
      {
        name: "description",
        content: "CloudMonkey Acceptable Use Policy detailing prohibited activities, content restrictions, and abuse handling.",
      },
      { property: "og:title", content: "CloudMonkey Acceptable Use Policy" },
      { property: "og:description", content: "Rules for using CloudMonkey services safely and legally." },
      ogUrl("/legal/aup"),
    ],
    links: [canonicalLink("/legal/aup")],
  }),
  component: AupPage,
});

function AupPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-none text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            Acceptable Use Policy
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            This Acceptable Use Policy (AUP) outlines the rules and restrictions for using CloudMonkey services, infrastructure, and platforms to ensure a safe, secure, and reliable environment for all users.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>1. General Prohibitions</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>You may not use CloudMonkey services to engage in, promote, or facilitate any illegal, harmful, or abusive activities. This includes, but is not limited to:</p>
              <ul className="list-inside list-disc space-y-2">
                <li>Violating any applicable laws, regulations, or third-party rights.</li>
                <li>Distributing malware, viruses, trojans, or any other malicious code.</li>
                <li>Engaging in unauthorized scanning, penetration testing, or network abuse.</li>
                <li>Phishing, credential harvesting, or deploying deceptive content.</li>
                <li>Hosting or distributing material that is defamatory, harassing, or discriminatory.</li>
              </ul>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>2. Resource Abuse</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>You must not place an unreasonable or disproportionately large load on CloudMonkey infrastructure, nor interfere with the proper working of the services. This includes:</p>
              <ul className="list-inside list-disc space-y-2">
                <li>Cryptocurrency mining on shared or unauthorized environments.</li>
                <li>Operating open proxies, open mail relays, or open DNS resolvers.</li>
                <li>Using automated scripts or bots in a manner that degrades service performance for others.</li>
                <li>Bypassing or attempting to bypass resource limits or quotas.</li>
              </ul>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>3. Email and Anti-Spam</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>CloudMonkey has a zero-tolerance policy for Unsolicited Commercial Email (UCE) or "spam".</p>
              <p>You may not use our services to send bulk unsolicited email or participate in spam-related activities. All email sent must comply with the Consumer Protection Act (CPA), POPIA, and other applicable anti-spam regulations.</p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>4. Enforcement and Suspension</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>CloudMonkey reserves the right to investigate suspected violations of this AUP. We may take any technical or legal action we deem necessary to address violations, including:</p>
              <ul className="list-inside list-disc space-y-2">
                <li>Immediate suspension or termination of your account or access to services without notice or refund.</li>
                <li>Removal or disabling of access to content that violates this AUP.</li>
                <li>Reporting suspected illegal activities to law enforcement or relevant authorities.</li>
              </ul>
              <div className="mt-6 flex gap-3 rounded-lg border border-border bg-secondary p-4 text-sm">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <p>To report abuse, please contact us at <strong>abuse@cloudmonkey.co.za</strong>.</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
