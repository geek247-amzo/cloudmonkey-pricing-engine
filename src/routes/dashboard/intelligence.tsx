import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Brain, ExternalLink, FileText, Globe, PlayCircle, Plus, RefreshCcw, Search, Send, ShieldCheck, Target, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/intelligence")({
  head: () => ({
    meta: [{ title: "Competitor Intelligence - CloudMonkey Dashboard" }],
  }),
  component: IntelligencePage,
});

type IntelligenceProject = {
  id: string;
  userId: string;
  name: string;
  businessName: string;
  websiteUrl: string;
  location?: string | null;
  industry?: string | null;
  servicesProducts?: string | null;
  status: string;
  lastScanStatus?: string | null;
  lastScanAt?: string | null;
  visibilityScore: number;
  technicalSeoScore: number;
  contentSeoScore: number;
  contentGapScore: number;
  localSeoScore: number;
  performanceScore: number;
  aiReadinessScore: number;
  opportunityScore: number;
  owner?: { id: string; name?: string | null; email?: string | null } | null;
};

type IntelligenceOverview = {
  project: IntelligenceProject;
  competitors: Array<any>;
  keywords: Array<any>;
  rankings: Array<any>;
  jobs: Array<any>;
  crawlPages: Array<any>;
  audits: Array<any>;
  issues: Array<any>;
  contentGaps: Array<any>;
  recommendations: Array<any>;
  reports: Array<any>;
  latestJob?: any;
  latestReport?: any;
};

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error ?? "Request failed") as Error & { status?: number; code?: string };
    error.status = res.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function IntelligencePage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminAccess();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({
    businessName: "",
    websiteUrl: "",
    location: "",
    industry: "",
    servicesProducts: "",
    targetKeywords: "",
    competitors: "",
  });
  const [competitorForm, setCompetitorForm] = useState({ name: "", websiteUrl: "" });
  const [keywordForm, setKeywordForm] = useState({ keyword: "", location: "", priority: "medium" });

  const projectsQuery = useQuery({
    queryKey: ["intelligence", "projects"],
    queryFn: async () => fetchJson("/api/user/intelligence"),
  });

  const projects: IntelligenceProject[] = projectsQuery.data?.projects ?? [];
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const overviewQuery = useQuery({
    queryKey: ["intelligence", "overview", selectedProject?.id],
    enabled: !!selectedProject?.id,
    queryFn: async () => fetchJson(`/api/user/intelligence/${encodeURIComponent(selectedProject!.id)}/overview`) as Promise<IntelligenceOverview>,
  });

  const adminProjectsQuery = useQuery({
    queryKey: ["admin", "intelligence", "projects"],
    enabled: isAdmin,
    queryFn: async () => fetchJson("/api/admin/intelligence"),
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const targetKeywords = projectForm.targetKeywords
        .split(/\n|,/)
        .map((value) => value.trim())
        .filter(Boolean);
      const competitors = projectForm.competitors
        .split(/\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((websiteUrl) => ({ websiteUrl }));
      return fetchJson("/api/user/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: projectForm.businessName,
          websiteUrl: projectForm.websiteUrl,
          location: projectForm.location || null,
          industry: projectForm.industry || null,
          servicesProducts: projectForm.servicesProducts || null,
          targetKeywords,
          competitors,
        }),
      });
    },
    onSuccess: (data) => {
      toast.success("Intelligence project created");
      setProjectForm({ businessName: "", websiteUrl: "", location: "", industry: "", servicesProducts: "", targetKeywords: "", competitors: "" });
      setSelectedProjectId(data.project.id);
      queryClient.invalidateQueries({ queryKey: ["intelligence", "projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addCompetitorMutation = useMutation({
    mutationFn: async () => fetchJson(`/api/user/intelligence/${encodeURIComponent(selectedProject!.id)}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: competitorForm.name || null, websiteUrl: competitorForm.websiteUrl }),
    }),
    onSuccess: () => {
      toast.success("Competitor added");
      setCompetitorForm({ name: "", websiteUrl: "" });
      queryClient.invalidateQueries({ queryKey: ["intelligence", "overview", selectedProject?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addKeywordMutation = useMutation({
    mutationFn: async () => fetchJson(`/api/user/intelligence/${encodeURIComponent(selectedProject!.id)}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...keywordForm, location: keywordForm.location || null }),
    }),
    onSuccess: () => {
      toast.success("Keyword added");
      setKeywordForm({ keyword: "", location: "", priority: "medium" });
      queryClient.invalidateQueries({ queryKey: ["intelligence", "overview", selectedProject?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connectGoogleSearchConsoleMutation = useMutation({
    mutationFn: async () => {
      await authClient.linkSocial({
        provider: "google",
        callbackURL: "/dashboard/intelligence",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      } as any);
    },
    onError: (error: Error) => toast.error(error.message || "Could not open Google consent"),
  });

  const submitMutation = useMutation({
    mutationFn: async () => fetchJson(`/api/user/intelligence/${encodeURIComponent(selectedProject!.id)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      toast.success("Submitted for CloudMonkey analysis");
      queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    },
    onError: (error: Error & { missing?: string[] }) => toast.error(error.message),
  });

  const adminScanMutation = useMutation({
    mutationFn: async (projectId: string) => fetchJson(`/api/admin/intelligence/${encodeURIComponent(projectId)}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanType: "full" }),
    }),
    onSuccess: (data) => {
      toast[data.n8nStatus === "sent" ? "success" : "warning"](data.n8nStatus === "sent" ? "Report run sent to n8n" : "Report job saved but n8n needs attention");
      queryClient.invalidateQueries({ queryKey: ["admin", "intelligence"] });
      queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accessError = projectsQuery.error as (Error & { status?: number; code?: string }) | null;

  if (accessError?.status === 402) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Competitor Intelligence"
          title={<>Competitor intelligence.</>}
          subtitle="See what competitors are doing better online and what CloudMonkey should fix next."
        />
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-bold text-[#07102c]">Subscription required</div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Competitor Intelligence is available to CloudMonkey subscribers. Activate a managed intelligence plan to create your profile and receive managed reports.
              </p>
            </div>
            <Button asChild className="rounded-lg bg-[var(--ai)]">
              <a href="/ai-agents">View managed AI services</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Competitor Intelligence"
        title={<>Competitor intelligence.</>}
        subtitle="Track competitors, SEO gaps, SERP movements, content opportunities, and AI-prioritized next actions from one managed dashboard."
      />

      {isAdmin && (
        <AdminIntelligenceQueue
          projects={adminProjectsQuery.data?.projects ?? []}
          loading={adminProjectsQuery.isLoading}
          runningProjectId={adminScanMutation.variables ?? null}
          runProject={(projectId) => adminScanMutation.mutate(projectId)}
          isRunning={adminScanMutation.isPending}
        />
      )}

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-bold text-[#07102c]">Free owned-site data</div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Connect Google Search Console for your own site data. CloudMonkey will use this with the configured SEO APIs when an admin runs your managed report.
            </p>
          </div>
          <Button
            className="rounded-lg bg-[var(--ai)]"
            onClick={() => connectGoogleSearchConsoleMutation.mutate()}
            disabled={connectGoogleSearchConsoleMutation.isPending}
          >
            <ExternalLink className="h-4 w-4" />
            Connect Google Search Console
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Create project</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createProjectMutation.mutate();
                }}
              >
                <Field label="Business name" value={projectForm.businessName} onChange={(businessName) => setProjectForm({ ...projectForm, businessName })} required />
                <Field label="Website URL" value={projectForm.websiteUrl} onChange={(websiteUrl) => setProjectForm({ ...projectForm, websiteUrl })} placeholder="https://example.co.za" required />
                <Field label="Location" value={projectForm.location} onChange={(location) => setProjectForm({ ...projectForm, location })} placeholder="South Africa" required />
                <Field label="Industry" value={projectForm.industry} onChange={(industry) => setProjectForm({ ...projectForm, industry })} required />
                <div className="space-y-2">
                  <Label>Services/products</Label>
                  <Textarea value={projectForm.servicesProducts} onChange={(event) => setProjectForm({ ...projectForm, servicesProducts: event.target.value })} className="min-h-20" required />
                </div>
                <div className="space-y-2">
                  <Label>Target keywords</Label>
                  <Textarea value={projectForm.targetKeywords} onChange={(event) => setProjectForm({ ...projectForm, targetKeywords: event.target.value })} placeholder="At least 3, one per line or comma separated" className="min-h-20" required />
                </div>
                <div className="space-y-2">
                  <Label>Competitor URLs</Label>
                  <Textarea value={projectForm.competitors} onChange={(event) => setProjectForm({ ...projectForm, competitors: event.target.value })} placeholder="At least 3, one URL per line or comma separated" className="min-h-20" required />
                </div>
                <Button type="submit" className="w-full rounded-lg bg-[var(--ai)]" disabled={createProjectMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  Create intelligence project
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  Loading projects
                </div>
              ) : projects.length ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedProject?.id === project.id ? "border-[var(--ai)] bg-[#f2efff]" : "border-[#dfe4ef] bg-white hover:bg-[#f6f8fc]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#07102c]">{project.businessName}</div>
                        <div className="truncate text-xs text-muted-foreground">{project.websiteUrl}</div>
                      </div>
                      <Badge variant={project.lastScanStatus === "completed" ? "default" : "outline"}>{project.lastScanStatus ?? project.status}</Badge>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[#dfe4ef] p-5 text-sm text-muted-foreground">No intelligence projects yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {!selectedProject ? (
            <EmptyPanel />
          ) : overviewQuery.isLoading ? (
            <Card className="rounded-lg border-[#dfe4ef] bg-white p-12 text-center shadow-sm">
              <RefreshCcw className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Loading intelligence dashboard...</div>
            </Card>
          ) : overview ? (
            <ProjectDashboard
              overview={overview}
              competitorForm={competitorForm}
              setCompetitorForm={setCompetitorForm}
              addCompetitor={() => addCompetitorMutation.mutate()}
              addingCompetitor={addCompetitorMutation.isPending}
              keywordForm={keywordForm}
              setKeywordForm={setKeywordForm}
              addKeyword={() => addKeywordMutation.mutate()}
              addingKeyword={addKeywordMutation.isPending}
              submitProject={() => submitMutation.mutate()}
              submittingProject={submitMutation.isPending}
            />
          ) : (
            <EmptyPanel />
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectDashboard({
  overview,
  competitorForm,
  setCompetitorForm,
  addCompetitor,
  addingCompetitor,
  keywordForm,
  setKeywordForm,
  addKeyword,
  addingKeyword,
  submitProject,
  submittingProject,
}: {
  overview: IntelligenceOverview;
  competitorForm: { name: string; websiteUrl: string };
  setCompetitorForm: (value: { name: string; websiteUrl: string }) => void;
  addCompetitor: () => void;
  addingCompetitor: boolean;
  keywordForm: { keyword: string; location: string; priority: string };
  setKeywordForm: (value: { keyword: string; location: string; priority: string }) => void;
  addKeyword: () => void;
  addingKeyword: boolean;
  submitProject: () => void;
  submittingProject: boolean;
}) {
  const project = overview.project;
  const scoreCards = [
    { label: "Visibility", value: project.visibilityScore, icon: BarChart3 },
    { label: "Technical SEO", value: project.technicalSeoScore, icon: ShieldCheck },
    { label: "Content gap", value: project.contentGapScore, icon: Search },
    { label: "AI readiness", value: project.aiReadinessScore, icon: Brain },
  ];
  const topCompetitor = overview.competitors[0];
  const urgentRecommendations = overview.recommendations.slice(0, 5);
  const missingItems = [
    !project.location ? "location" : null,
    !project.industry ? "industry" : null,
    !project.servicesProducts ? "services/products" : null,
    overview.keywords.length < 3 ? "3 target keywords" : null,
    overview.competitors.length < 3 ? "3 competitor URLs" : null,
  ].filter(Boolean) as string[];
  const canSubmit = missingItems.length === 0;
  const isSubmitted = ["submitted", "running"].includes(project.status) || Boolean(project.lastScanStatus);

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>{project.businessName}</h2>
              <Badge variant={project.lastScanStatus === "completed" ? "default" : "outline"}>{project.lastScanStatus ?? "not scanned"}</Badge>
            </div>
            <div className="mt-2 break-all text-sm text-muted-foreground">{project.websiteUrl}</div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <span>{project.location || "No location"}</span>
              <span>{project.industry || "No industry"}</span>
              <span>{overview.keywords.length} keywords tracked</span>
            </div>
          </div>
          <div className="rounded-lg border border-[#dfe4ef] bg-[#f6f8fc] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Fastest signal</div>
            <div className="mt-2 text-sm font-semibold text-[#07102c]">
              {urgentRecommendations[0]?.title ?? (topCompetitor ? `${topCompetitor.name} is your current benchmark.` : "Complete the intake fields so CloudMonkey can run your first report.")}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-bold text-[#07102c]">Managed analysis status</div>
              <Badge variant={isSubmitted ? "default" : "outline"}>{project.status}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {canSubmit
                ? "Your intake has enough detail for CloudMonkey to run the managed competitor intelligence report."
                : `Still needed: ${missingItems.join(", ")}.`}
            </p>
          </div>
          <Button className="rounded-lg bg-[var(--ai)]" onClick={submitProject} disabled={!canSubmit || submittingProject || isSubmitted}>
            <Send className="h-4 w-4" />
            {isSubmitted ? "Submitted" : "Submit for analysis"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {scoreCards.map((score) => (
          <ScoreCard key={score.label} {...score} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Add competitor</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                addCompetitor();
              }}
            >
              <Field label="Name" value={competitorForm.name} onChange={(name) => setCompetitorForm({ ...competitorForm, name })} />
              <Field label="Website URL" value={competitorForm.websiteUrl} onChange={(websiteUrl) => setCompetitorForm({ ...competitorForm, websiteUrl })} required />
              <Button type="submit" className="self-end rounded-lg bg-[var(--ai)]" disabled={addingCompetitor}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Add keyword</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                addKeyword();
              }}
            >
              <Field label="Keyword" value={keywordForm.keyword} onChange={(keyword) => setKeywordForm({ ...keywordForm, keyword })} required />
              <Field label="Location" value={keywordForm.location} onChange={(location) => setKeywordForm({ ...keywordForm, location })} />
              <Button type="submit" className="self-end rounded-lg bg-[var(--ai)]" disabled={addingKeyword}>
                <Target className="h-4 w-4" />
                Track
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="Competitor scorecard"
          icon={Globe}
          empty="No competitors added yet."
          headers={["Competitor", "Type", "Visibility", "Technical"]}
          rows={overview.competitors.map((competitor) => [
            competitor.name,
            competitor.competitorType,
            scoreText(competitor.visibilityScore),
            scoreText(competitor.technicalSeoScore),
          ])}
        />
        <DataTable
          title="Keyword gap signals"
          icon={Target}
          empty="No keyword rankings returned yet."
          headers={["Keyword", "Target", "Rank", "Opportunity"]}
          rows={overview.rankings.slice(0, 12).map((ranking) => [
            ranking.keyword,
            ranking.target,
            ranking.rank ? `#${ranking.rank}` : "Not ranking",
            ranking.opportunity || "Pending",
          ])}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="Urgent SEO issues"
          icon={Zap}
          empty="No issues stored yet."
          headers={["Issue", "Severity", "Category", "Status"]}
          rows={overview.issues.slice(0, 10).map((issue) => [
            issue.title,
            issue.severity,
            issue.category,
            issue.status,
          ])}
        />
        <DataTable
          title="Content gaps"
          icon={Search}
          empty="No content gaps stored yet."
          headers={["Gap", "Type", "Opportunity", "Action"]}
          rows={overview.contentGaps.slice(0, 10).map((gap) => [
            gap.title,
            gap.gapType,
            gap.opportunity,
            gap.suggestedAction || "Review",
          ])}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-[var(--ai)]" />
              AI recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.recommendations.length ? overview.recommendations.slice(0, 8).map((recommendation) => (
              <div key={recommendation.id} className="rounded-lg border border-[#dfe4ef] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-[#07102c]">{recommendation.title}</div>
                  <Badge variant={recommendation.priority === "urgent" || recommendation.priority === "high" ? "default" : "outline"}>{recommendation.priority}</Badge>
                </div>
                {recommendation.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>}
                <div className="mt-2 text-xs text-muted-foreground">Impact {recommendation.impact} | Effort {recommendation.effort}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[#dfe4ef] p-8 text-center text-sm text-muted-foreground">Submit the intake so CloudMonkey can generate recommendations.</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-[var(--ai)]" />
              Latest report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.latestReport ? (
              <div className="space-y-3">
                <div className="text-sm font-bold text-[#07102c]">{overview.latestReport.title}</div>
                <p className="text-sm leading-6 text-muted-foreground">{overview.latestReport.executiveSummary || "Report generated and ready for review."}</p>
                {overview.latestReport.pdfUrl && (
                  <Button asChild variant="outline" className="w-full rounded-lg">
                    <a href={overview.latestReport.pdfUrl} target="_blank" rel="noreferrer">Open PDF</a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#dfe4ef] p-8 text-center text-sm text-muted-foreground">No report generated yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminIntelligenceQueue({
  projects,
  loading,
  runningProjectId,
  runProject,
  isRunning,
}: {
  projects: IntelligenceProject[];
  loading: boolean;
  runningProjectId: string | null;
  runProject: (projectId: string) => void;
  isRunning: boolean;
}) {
  const submittedProjects = projects.filter((project) => ["submitted", "running"].includes(project.status) || project.lastScanStatus);

  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Admin report queue</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Loading submitted projects
          </div>
        ) : submittedProjects.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfe4ef] text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Customer</th>
                  <th className="py-3 pr-4 font-semibold">Project</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Last run</th>
                  <th className="py-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {submittedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-[#eef1f7] last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[#07102c]">{project.owner?.name || "Customer"}</div>
                      <div className="text-xs text-muted-foreground">{project.owner?.email || project.userId}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[#07102c]">{project.businessName}</div>
                      <div className="break-all text-xs text-muted-foreground">{project.websiteUrl}</div>
                    </td>
                    <td className="py-3 pr-4"><Badge variant="outline">{project.status}</Badge></td>
                    <td className="py-3 pr-4 text-muted-foreground">{project.lastScanStatus ?? "Not run"}</td>
                    <td className="py-3 pr-4">
                      <Button
                        size="sm"
                        className="rounded-lg bg-[var(--ai)]"
                        onClick={() => runProject(project.id)}
                        disabled={isRunning && runningProjectId === project.id}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Run report
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#dfe4ef] p-6 text-center text-sm text-muted-foreground">No submitted intelligence projects yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof BarChart3 }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-[var(--ai)]" />
        </div>
        <div className="mt-3 text-2xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>{value}/100</div>
        <Progress value={value} className="mt-3 h-2" />
      </CardContent>
    </Card>
  );
}

function DataTable({ title, icon: Icon, empty, headers, rows }: { title: string; icon: typeof BarChart3; empty: string; headers: string[]; rows: string[][] }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-[var(--ai)]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfe4ef] text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {headers.map((header) => <th key={header} className="py-3 pr-4 font-semibold">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${title}-${rowIndex}`} className="border-b border-[#eef1f7] last:border-0">
                    {row.map((cell, cellIndex) => <td key={`${title}-${rowIndex}-${cellIndex}`} className="py-3 pr-4 text-[#07102c]">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#dfe4ef] p-8 text-center text-sm text-muted-foreground">{empty}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function EmptyPanel() {
  return (
    <Card className="rounded-lg border-dashed border-[#dfe4ef] bg-transparent p-12 text-center">
      <div className="text-sm font-medium text-muted-foreground">Create or select a project to open the intelligence dashboard.</div>
    </Card>
  );
}

function scoreText(value: number | null | undefined) {
  return typeof value === "number" ? `${value}/100` : "Pending";
}
