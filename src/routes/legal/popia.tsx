import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/legal/popia")({
  head: () => ({
    meta: [
      { title: "POPIA Manual - CloudMonkey" },
      {
        name: "description",
        content: "CloudMonkey POPIA and PAIA Manual detailing data protection and access to information.",
      },
      { property: "og:title", content: "CloudMonkey POPIA Manual" },
      { property: "og:description", content: "Data protection and access to information." },
      ogUrl("/legal/popia"),
    ],
    links: [canonicalLink("/legal/popia")],
  }),
  component: PopiaPage,
});

function PopiaPage() {
  return (
    <>
      <section className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-8 w-8" />
          </div>
          <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-none text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            POPIA & PAIA Manual
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Compliance with the Protection of Personal Information Act (POPIA) and the Promotion of Access to Information Act (PAIA).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>1. Introduction</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>This manual provides information on the records held by CloudMonkey and the processes to request access to such records or personal information under PAIA and POPIA.</p>
              <p>Our designated Information Officer is responsible for encouraging compliance with conditions for the lawful processing of personal information.</p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>2. Processing of Personal Information</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>We process personal information for purposes including:</p>
              <ul className="list-inside list-disc space-y-2">
                <li>Providing managed IT, cloud, and voice services.</li>
                <li>Billing and account management.</li>
                <li>Technical support and troubleshooting.</li>
                <li>Complying with legal and regulatory obligations.</li>
              </ul>
              <p>Detailed information on data collection, processing purposes, retention periods, and cross-border transfers can be found in our primary <strong>Privacy Policy</strong>.</p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>3. Operator Duties</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>When providing services where we host or manage data on behalf of a customer, CloudMonkey acts as an "Operator" under POPIA, while the customer remains the "Responsible Party". We only process this data according to the customer's written instructions and maintain appropriate security safeguards to protect it.</p>
            </div>
          </article>

          <article className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>4. Access Requests</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>If you wish to request access to your personal information or other records held by CloudMonkey, please contact our Information Officer at <strong>legal@cloudmonkey.co.za</strong> with the necessary prescribed forms and details of your request.</p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
