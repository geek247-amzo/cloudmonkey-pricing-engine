import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, ImagePlus, Loader2, Mail, Rocket, Send, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/website-projects")({
  head: () => ({
    meta: [{ title: "Website Projects - CloudMonkey Dashboard" }],
  }),
  component: WebsiteProjectsPage,
});

async function fetchJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function WebsiteProjectsPage() {
  const { isAdmin, authReady } = useAdminAccess();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");

  const projects = useQuery({
    queryKey: ["admin", "website-projects"],
    queryFn: () => fetchJson<any[]>("/api/admin/website-projects"),
    enabled: authReady && isAdmin,
  });

  const selected = useMemo(() => selectedId || projects.data?.[0]?.id || "", [projects.data, selectedId]);
  const detail = useQuery({
    queryKey: ["admin", "website-projects", selected],
    queryFn: () => fetchJson<any>(`/api/admin/website-projects/${selected}`),
    enabled: authReady && isAdmin && !!selected,
  });

  const uploadDesign = useMutation({
    mutationFn: async (form: FormData) => fetchJson(`/api/admin/website-projects/${selected}/design-options`, {
      method: "POST",
      body: form,
    }),
    onSuccess: async () => {
      toast.success("Design option uploaded");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects", selected] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => fetchJson(`/api/admin/website-projects/${selected}/${action}`, { method: "POST" }),
    onSuccess: async (_data, action) => {
      toast.success(action.replace(/-/g, " "));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects", selected] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!authReady) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  if (!isAdmin) return <Card className="rounded-lg border-[#dfe4ef] bg-white p-10 text-center">Admin access required.</Card>;

  const project = detail.data;
  const rows = projects.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={<>Website and ecommerce projects.</>}
        subtitle="Track paid and trial website builds from brief through design approval, staging and launch."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Project queue</CardTitle></CardHeader>
          <CardContent className="p-0">
            {projects.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading projects...</div>
            ) : !rows.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No website projects yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#dfe4ef] bg-muted/20 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Billing</th><th className="px-4 py-3">Next</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className={`cursor-pointer border-b border-[#eef1f6] ${selected === row.id ? "bg-[#f6f1ff]" : "hover:bg-muted/20"}`} onClick={() => setSelectedId(row.id)}>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#07102c]">{row.businessName || row.name || row.domain}</div>
                          <div className="text-xs text-muted-foreground">{row.user?.email} · {row.temporaryDomain || row.domain}</div>
                          <Badge variant="outline" className="mt-2 rounded-full">{row.status}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={row.subscription?.status === "active" || row.subscription?.status === "trialing" ? "default" : "outline"} className="rounded-full">{row.subscription?.status || "n/a"}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">{row.invoice?.status || "no invoice"}</div>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-muted-foreground">{row.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!project ? (
            <Card className="rounded-lg border-[#dfe4ef] bg-white p-10 text-center text-sm text-muted-foreground">Select a project.</Card>
          ) : (
            <>
              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl text-[#07102c]">{project.businessName || project.domain}</CardTitle>
                    <div className="mt-2 text-sm text-muted-foreground">{project.user?.email} · {project.subscription?.name}</div>
                  </div>
                  <Button asChild variant="outline" className="rounded-lg">
                    <Link to="/dashboard/websites/$websiteId" params={{ websiteId: project.id }}>
                      <ExternalLink className="h-4 w-4" />
                      Customer view
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                  <Info label="Temp domain" value={project.temporaryDomain || project.domain} />
                  <Info label="Status" value={project.status} />
                  <Info label="Runtime" value={project.containerStatus} />
                  <Info label="Trial ends" value={formatDate(project.trialEndsAt)} />
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader><CardTitle className="text-base">Wizard answers</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(project.onboardingAnswers ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-[#dfe4ef] p-3">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{key}</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-[#07102c]">{String(value || "-")}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader><CardTitle className="text-base">Design drafts</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <form
                    className="grid gap-3 rounded-lg border border-[#dfe4ef] bg-muted/20 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      uploadDesign.mutate(new FormData(event.currentTarget));
                      event.currentTarget.reset();
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="styleLabel">Label</Label>
                        <Input id="styleLabel" name="styleLabel" required placeholder="Clean corporate concept" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="image">Draft image</Label>
                        <Input id="image" name="image" type="file" accept="image/*" />
                      </div>
                    </div>
                    <Textarea name="notes" rows={2} placeholder="Internal notes or design rationale" />
                    <Button className="w-fit rounded-lg bg-[var(--ai)]" disabled={uploadDesign.isPending}>
                      {uploadDesign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload draft
                    </Button>
                  </form>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {(project.designOptions ?? []).map((option: any) => (
                      <div key={option.id} className="overflow-hidden rounded-lg border border-[#dfe4ef]">
                        {option.imageUrl ? <img src={option.imageUrl} alt={option.styleLabel} className="aspect-[16/10] w-full object-cover" /> : <div className="flex aspect-[16/10] items-center justify-center bg-muted"><ImagePlus className="h-5 w-5 text-muted-foreground" /></div>}
                        <div className="p-3 text-sm font-semibold text-[#07102c]">
                          {option.styleLabel}
                          {project.selectedDesignOptionId === option.id && <Badge className="ml-2 rounded-full bg-emerald-600 text-white">Selected</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-lg" onClick={() => actionMutation.mutate("send-design-email")} disabled={actionMutation.isPending}>
                      <Mail className="h-4 w-4" />
                      Send design email
                    </Button>
                    <Button className="rounded-lg bg-[var(--ai)]" onClick={() => actionMutation.mutate("provision")} disabled={actionMutation.isPending || project.status !== "design_selected"}>
                      <Rocket className="h-4 w-4" />
                      Provision runtime
                    </Button>
                    <Button variant="outline" className="rounded-lg" onClick={() => actionMutation.mutate("send-staging-email")} disabled={actionMutation.isPending || project.containerStatus !== "running"}>
                      <Send className="h-4 w-4" />
                      Send staging
                    </Button>
                    <Button variant="outline" className="rounded-lg" onClick={() => actionMutation.mutate("mark-live")} disabled={actionMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark live
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader><CardTitle className="text-base">Reviews</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(project.reviewRequests ?? []).length ? project.reviewRequests.map((review: any) => (
                    <div key={review.id} className="rounded-lg border border-[#dfe4ef] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-[#07102c]">{review.type}</span>
                        <Badge variant="outline" className="rounded-full">{review.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDate(review.sentAt)}</div>
                      {review.response && <div className="mt-2 whitespace-pre-wrap text-muted-foreground">{review.response}</div>}
                    </div>
                  )) : <div className="text-sm text-muted-foreground">No review requests yet.</div>}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-[#dfe4ef] p-3">
      <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-semibold text-[#07102c]">{value || "Not set"}</div>
    </div>
  );
}
