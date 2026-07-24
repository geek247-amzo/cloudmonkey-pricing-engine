import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  findingCategory,
  mapFindingsToUpsells,
  summarizeFindings,
  type SeoFinding,
} from "@/lib/seo-checker";
import { authClient } from "@/lib/auth-client";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/seo-checker")({
  head: () => ({
    meta: [
      { title: "Free SEO Checker - CloudMonkey" },
      {
        name: "description",
        content:
          "Run a free SEO checker scan for title, metadata, links, structured data, accessibility, and technical search issues.",
      },
      { property: "og:title", content: "Free SEO Checker - CloudMonkey" },
      {
        property: "og:description",
        content:
          "Find practical SEO and technical website improvements with CloudMonkey's free checker.",
      },
      ogUrl("/seo-checker"),
    ],
    links: [canonicalLink("/seo-checker")],
  }),
  component: SeoCheckerPage,
});

function SeoCheckerPage() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ findings: SeoFinding[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  async function scan() {
    if (!session) {
      window.location.assign(`/auth/sign-in?callbackURL=${encodeURIComponent("/seo-checker")}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/public/seo-checker/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Scan failed");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }
  async function captureLead() {
    if (!email || !result) return;
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: email.split("@")[0],
        email,
        services: "SEO Checker",
        captureSource: "seo_checker",
        consent: true,
        wizardAnswers: { url, findingCount: result.findings.length },
      }),
    });
  }
  const findings = result?.findings ?? [];
  const summary = summarizeFindings(findings);
  const groupedFindings = findings.reduce<Record<string, SeoFinding[]>>((groups, finding) => {
    const category = findingCategory(finding.code);
    (groups[category] ??= []).push(finding);
    return groups;
  }, {});
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--ai)]">
          CloudMonkey SEO Checker
        </p>
        <h1 className="mt-2 text-4xl font-bold">Find the fastest wins for your website.</h1>
        <p className="mt-3 text-muted-foreground">
          A safe initial scan checks the public page without following redirects or accessing
          private networks.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <Button className="mt-auto" onClick={scan} disabled={loading || isSessionPending || !url}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}{" "}
            {session ? "Check site" : "Sign in to check"}
          </Button>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {findings.length ? <ShieldAlert /> : <CheckCircle2 />}{" "}
              {summary.count ? `${summary.count} opportunities found` : "Healthy baseline"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedFindings).map(([category, categoryFindings]) => (
              <section key={category} className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h2>
                {categoryFindings.map((finding) => (
                  <div key={finding.code} className="rounded-lg border p-4">
                    <p className="font-semibold">{finding.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p>
                  </div>
                ))}
              </section>
            ))}
            {findings.length > 0 && (
              <div className="rounded-lg bg-muted p-4">
                <p className="font-semibold">Get the full action plan</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Leave your email and we’ll map these findings to the right CloudMonkey growth
                  bundle.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    type="email"
                  />
                  <Button onClick={captureLead} disabled={!email}>
                    Send plan
                  </Button>
                </div>
              </div>
            )}
            {mapFindingsToUpsells(findings).map((upsell) => (
              <a
                className="block font-semibold text-[var(--ai)]"
                href={upsell.href}
                key={upsell.bundleId}
              >
                Explore {upsell.label} →
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
