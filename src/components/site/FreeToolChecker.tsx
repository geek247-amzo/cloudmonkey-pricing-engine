import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FreeToolKind } from "@/lib/free-tools";
import { authClient } from "@/lib/auth-client";

type ToolResult = {
  ok: boolean;
  issuer?: string | null;
  expiresAt?: string | null;
  daysRemaining?: number | null;
  chainValid?: boolean;
  hostnameMatches?: boolean | null;
  status?: number | null;
  responseTimeMs?: number;
  finalUrl?: string;
  redirectCount?: number;
  findings: Array<{ code: string; title: string; detail: string }>;
  upsells?: Array<{ bundleId: string; label: string; href: string }>;
};

const config: Record<
  FreeToolKind,
  { title: string; description: string; endpoint: string; source: string; placeholder: string }
> = {
  ssl: {
    title: "SSL Checker",
    description:
      "Check certificate validity, issuer, hostname matching, and expiry before it becomes a customer-facing problem.",
    endpoint: "/api/public/tools/ssl-check",
    source: "ssl_checker",
    placeholder: "https://example.com",
  },
  uptime: {
    title: "Uptime Checker",
    description:
      "Run a quick availability check with HTTP status, response time, and redirect-chain visibility.",
    endpoint: "/api/public/tools/uptime-check",
    source: "uptime_checker",
    placeholder: "https://example.com",
  },
};

export function FreeToolChecker({ kind }: { kind: FreeToolKind }) {
  const tool = config[kind];
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [leadState, setLeadState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const { data: session, isPending } = authClient.useSession();

  async function check() {
    if (!session) {
      window.location.assign(
        `/auth/sign-in?callbackURL=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(tool.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Check failed");
      setResult(body);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  async function captureLead() {
    if (!email || !result || leadState !== "idle") return;
    setLeadState("sending");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: email.split("@")[0],
          email,
          services: tool.title,
          captureSource: tool.source,
          consent: true,
          wizardAnswers: { url, findings: result.findings },
        }),
      });
      if (!response.ok) throw new Error("Could not send your plan");
      setLeadState("sent");
    } catch (leadError) {
      setLeadState("idle");
      setError(leadError instanceof Error ? leadError.message : "Could not send your plan");
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--ai)]">
          CloudMonkey Free Tools
        </p>
        <h1 className="mt-2 text-4xl font-bold">{tool.title}</h1>
        <p className="mt-3 text-muted-foreground">{tool.description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={tool.placeholder}
            />
          </div>
          <Button className="mt-auto" onClick={check} disabled={loading || isPending || !url}>
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : session ? (
              "Check site"
            ) : (
              "Sign in to check"
            )}
          </Button>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.findings.length ? <ShieldAlert /> : <CheckCircle2 />}
              {result.findings.length
                ? `${result.findings.length} issue${result.findings.length === 1 ? "" : "s"} found`
                : "No immediate issues detected"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {kind === "ssl" && (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Issuer</span>
                  <p>{result.issuer ?? "Unavailable"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires</span>
                  <p>
                    {result.expiresAt
                      ? new Date(result.expiresAt).toLocaleDateString()
                      : "Unavailable"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Days remaining</span>
                  <p>{result.daysRemaining ?? "Unavailable"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Chain / hostname</span>
                  <p>
                    {result.chainValid ? "Valid" : "Invalid"} /{" "}
                    {result.hostnameMatches == null
                      ? "Unknown"
                      : result.hostnameMatches
                        ? "Matches"
                        : "Mismatch"}
                  </p>
                </div>
              </div>
            )}
            {kind === "uptime" && (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">HTTP status</span>
                  <p>{result.status ?? "Unavailable"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Response time</span>
                  <p>
                    {result.responseTimeMs == null ? "Unavailable" : `${result.responseTimeMs} ms`}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Redirects</span>
                  <p>{result.redirectCount ?? 0}</p>
                </div>
              </div>
            )}
            {result.findings.map((finding) => (
              <div className="rounded-lg border p-4" key={finding.code}>
                <p className="font-semibold">{finding.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p>
              </div>
            ))}
            {result.findings.length > 0 && (
              <div className="rounded-lg bg-muted p-4">
                <p className="font-semibold">Get the CloudMonkey action plan</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    type="email"
                  />
                  <Button onClick={captureLead} disabled={!email || leadState !== "idle"}>
                    {leadState === "sending"
                      ? "Sending..."
                      : leadState === "sent"
                        ? "Plan requested"
                        : "Send plan"}
                  </Button>
                </div>
              </div>
            )}
            {result.upsells?.map((upsell) => (
              <a
                className="block rounded-lg border border-[var(--ai)] p-4 text-sm font-semibold text-[var(--ai)]"
                href={upsell.href}
                key={upsell.bundleId}
              >
                Recommended: {upsell.label} →
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
