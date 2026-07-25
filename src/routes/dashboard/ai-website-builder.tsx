import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle2, Globe, Loader2, Rocket, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/ai-website-builder")({
  head: () => ({ meta: [{ title: "AI Website Builder - CloudMonkey" }] }),
  component: AiWebsiteBuilderPage,
});

type Website = { id: string; name: string; businessName?: string | null; domain?: string | null };
type BuilderResult = {
  manifest: {
    headline: string;
    subheadline: string;
    sections: Array<{ title: string; body: string; cta?: string }>;
  };
  usage: { model: string; chargedTokens: number };
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}

function AiWebsiteBuilderPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [websiteId, setWebsiteId] = useState("");
  const [brief, setBrief] = useState("");
  const [fallbackModel, setFallbackModel] = useState("claude-sonnet-5");
  const [deploy, setDeploy] = useState(false);
  const [result, setResult] = useState<BuilderResult | null>(null);
  const websites = useQuery({
    queryKey: ["user", "websites", "ai-builder"],
    queryFn: () => fetchJson<Website[]>("/api/user/websites"),
    enabled: !!session,
  });
  const generate = useMutation({
    mutationFn: () =>
      fetchJson<BuilderResult>("/api/user/ai-website-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, brief, fallbackModel, deploy }),
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        deploy ? "Website generated and sent to deployment" : "Website content generated",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isSessionPending) return <div className="p-8 text-center">Checking permissions...</div>;
  const rows = websites.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI website builder"
        title={<>Describe it. We build the first draft.</>}
        subtitle="CloudMonkey turns your brief into structured website content, then can send the saved manifest into the existing runtime deployment pipeline."
        actions={
          <Badge className="bg-[#efe7ff] text-[#5d2fe8]">
            <Sparkles className="mr-1 h-3 w-3" />
            Wallet funded
          </Badge>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Generate a site draft
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="website">Website project</Label>
              <select
                id="website"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={websiteId}
                onChange={(event) => setWebsiteId(event.target.value)}
              >
                <option value="">Select a website project</option>
                {rows.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.businessName || site.name} · {site.domain || "temporary domain"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief">Describe the business and desired website</Label>
              <Textarea
                id="brief"
                rows={12}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="We are a Johannesburg-based... Include audience, services, pages, tone, differentiators, calls to action, and anything the site must avoid."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fallback">Fallback model</Label>
                <select
                  id="fallback"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={fallbackModel}
                  onChange={(event) => setFallbackModel(event.target.value)}
                >
                  <option value="claude-sonnet-5">Claude Sonnet 5</option>
                  <option value="none">No fallback</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input
                  type="checkbox"
                  checked={deploy}
                  onChange={(event) => setDeploy(event.target.checked)}
                />
                Deploy after generation
              </label>
            </div>
            <Button
              className="w-full bg-[var(--ai)]"
              disabled={!websiteId || brief.trim().length < 20 || generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : deploy ? (
                <Rocket className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {deploy ? "Generate and deploy" : "Generate first draft"}
            </Button>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              How billing works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Wallet tokens are reserved before generation starts and released if generation fails.
            </p>
            <p>
              The final charge uses actual provider input/output tokens, the configured model rate,
              and CloudMonkey’s 70% platform markup.
            </p>
            <p>Opus 4.8 is the default. Sonnet 5 is an explicit fallback.</p>
          </CardContent>
        </Card>
      </div>
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Generated manifest{" "}
              <Badge variant="outline">
                {result.usage.model} · {result.usage.chargedTokens} tokens
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="text-xl font-semibold">{result.manifest.headline}</h3>
            <p className="text-muted-foreground">{result.manifest.subheadline}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {result.manifest.sections.map((section) => (
                <div className="rounded-lg border p-4" key={section.title}>
                  <h4 className="font-semibold">{section.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{section.body}</p>
                  {section.cta && (
                    <p className="mt-3 text-sm font-medium text-[var(--ai)]">CTA: {section.cta}</p>
                  )}
                </div>
              ))}
            </div>
            <Button asChild variant="outline">
              <Link to="/dashboard/websites">
                <Globe className="mr-2 h-4 w-4" />
                View website projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
