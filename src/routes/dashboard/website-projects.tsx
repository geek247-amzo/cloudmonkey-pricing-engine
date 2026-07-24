import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Mail,
  Plus,
  Rocket,
  Send,
  Upload,
} from "lucide-react";
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
import { formatDateUTC } from "@/lib/date-format";

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
  return formatDateUTC(value);
}

function WebsiteProjectsPage() {
  const { isAdmin, authReady } = useAdminAccess();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [createForm, setCreateForm] = useState({
    userId: "",
    siteType: "website",
    planId: "",
    subscriptionId: "",
    githubRepo: "",
    businessName: "",
    businessDescription: "",
    industry: "",
    preferredSlug: "",
    subscriptionStatus: "active",
  });

  const projects = useQuery({
    queryKey: ["admin", "website-projects"],
    queryFn: () => fetchJson<any[]>("/api/admin/website-projects"),
    enabled: authReady && isAdmin,
  });
  const customers = useQuery({
    queryKey: ["admin", "customers", "website-projects"],
    queryFn: () => fetchJson<any>("/api/admin/customers"),
    enabled: authReady && isAdmin,
  });
  const products = useQuery({
    queryKey: ["admin", "products", "website-projects"],
    queryFn: () => fetchJson<any[]>("/api/admin/products"),
    enabled: authReady && isAdmin,
  });

  const selected = useMemo(
    () => selectedId || projects.data?.[0]?.id || "",
    [projects.data, selectedId],
  );
  const detail = useQuery({
    queryKey: ["admin", "website-projects", selected],
    queryFn: () => fetchJson<any>(`/api/admin/website-projects/${selected}`),
    enabled: authReady && isAdmin && !!selected,
  });

  const uploadDesign = useMutation({
    mutationFn: async (form: FormData) =>
      fetchJson(`/api/admin/website-projects/${selected}/design-options`, {
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

  const saveDesignInputs = useMutation({
    mutationFn: async (form: FormData) =>
      fetchJson(`/api/admin/website-projects/${selected}/design-inputs`, {
        method: "POST",
        body: form,
      }),
    onSuccess: async () => {
      toast.success("Design inputs saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects", selected] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) =>
      fetchJson(`/api/admin/website-projects/${selected}/${action}`, { method: "POST" }),
    onSuccess: async (_data, action) => {
      toast.success(action.replace(/-/g, " "));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects", selected] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createProject = useMutation({
    mutationFn: async () =>
      fetchJson<any>("/api/admin/website-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          subscriptionId: createForm.subscriptionId || null,
          githubRepo: createForm.githubRepo || null,
          businessDescription: createForm.businessDescription || "",
          industry: createForm.industry || "",
          preferredSlug: createForm.preferredSlug || "",
        }),
      }),
    onSuccess: async (created) => {
      toast.success("Website project created");
      setSelectedId(created.id);
      setCreateForm((current) => ({
        ...current,
        businessName: "",
        businessDescription: "",
        industry: "",
        preferredSlug: "",
        subscriptionId: "",
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "website-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "customers", "website-projects"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!authReady) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  if (!isAdmin)
    return (
      <Card className="rounded-lg border-[#dfe4ef] bg-white p-10 text-center">
        Admin access required.
      </Card>
    );

  const project = detail.data;
  const rows = projects.data ?? [];
  const customerRows = customers.data?.customers ?? [];
  const planRows = (products.data ?? []).filter((plan: any) =>
    createForm.siteType === "ecommerce"
      ? plan.id?.startsWith("ecom-")
      : plan.id?.startsWith("web-"),
  );
  const selectedCustomer = customerRows.find((customer: any) => customer.id === createForm.userId);
  const linkedSubscriptionIds = new Set(
    (projects.data ?? [])
      .map((project: any) => project.subscriptionId)
      .filter((subscriptionId: unknown): subscriptionId is string =>
        typeof subscriptionId === "string" && subscriptionId.length > 0,
      ),
  );
  const customerSubscriptions = (selectedCustomer?.services?.subscriptions ?? []).filter(
    (subscription: any) =>
      subscription.planId === createForm.planId && !linkedSubscriptionIds.has(subscription.id),
  );
  const canSendDesignEmail = Boolean(project?.designOptions?.length);
  const canProvision = project?.containerStatus !== "provisioning" && project?.containerStatus !== "running";
  const designInputs = project?.requirementManifest?.designInputs ?? {};
  const uploadedAssets = Array.isArray(designInputs.assets) ? designInputs.assets : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={<>Website and ecommerce projects.</>}
        subtitle="Track paid and trial website builds from brief through design approval, staging and launch."
      />

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Spin up project shell</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              createProject.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="projectCustomer">Customer</Label>
              <select
                id="projectCustomer"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createForm.userId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    userId: event.target.value,
                    subscriptionId: "",
                  }))
                }
                required
              >
                <option value="">Choose customer</option>
                {customerRows.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name || customer.email} · {customer.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectType">Type</Label>
              <select
                id="projectType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createForm.siteType}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    siteType: event.target.value,
                    planId: "",
                    subscriptionId: "",
                  }))
                }
              >
                <option value="website">Website</option>
                <option value="ecommerce">Ecommerce</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectPackage">Package</Label>
              <select
                id="projectPackage"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createForm.planId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    planId: event.target.value,
                    subscriptionId: "",
                  }))
                }
                required
              >
                <option value="">Choose package</option>
                {planRows.map((plan: any) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · R {(parseInt(plan.priceZar ?? "0", 10) / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectSubscription">Subscription</Label>
              <select
                id="projectSubscription"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createForm.subscriptionId}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, subscriptionId: event.target.value }))
                }
              >
                <option value="">Create linked subscription</option>
                {customerSubscriptions.map((subscription: any) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.name} · {subscription.status}
                  </option>
                ))}
              </select>
            </div>
            {!createForm.subscriptionId && (
              <div className="space-y-2">
                <Label htmlFor="subscriptionStatus">New subscription status</Label>
                <select
                  id="subscriptionStatus"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createForm.subscriptionStatus}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      subscriptionStatus: event.target.value,
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                value={createForm.businessName}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, businessName: event.target.value }))
                }
                required
                placeholder="Customer website name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredSlug">Temp domain slug</Label>
              <Input
                id="preferredSlug"
                value={createForm.preferredSlug}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, preferredSlug: event.target.value }))
                }
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={createForm.industry}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, industry: event.target.value }))
                }
                placeholder="Retail, services, hospitality"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubRepo">Github URL</Label>
              <Input
                id="githubRepo"
                value={createForm.githubRepo}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, githubRepo: event.target.value }))
                }
                placeholder="optional (e.g. https://github.com/user/repo)"
              />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="businessDescription">Notes</Label>
              <Input
                id="businessDescription"
                value={createForm.businessDescription}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    businessDescription: event.target.value,
                  }))
                }
                placeholder="Short internal context before the customer completes onboarding"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full rounded-lg bg-[var(--ai)]"
                disabled={createProject.isPending || !createForm.userId || !createForm.planId}
              >
                {createProject.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Project queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {projects.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading projects...
              </div>
            ) : !rows.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No website projects yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#dfe4ef] bg-muted/20 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Billing</th>
                      <th className="px-4 py-3">Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b border-[#eef1f6] ${selected === row.id ? "bg-[#f6f1ff]" : "hover:bg-muted/20"}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#07102c]">
                            {row.businessName || row.name || row.domain}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.user?.email} · {row.temporaryDomain || row.domain}
                          </div>
                          <Badge variant="outline" className="mt-2 rounded-full">
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant={
                              row.subscription?.status === "active" ||
                              row.subscription?.status === "trialing"
                                ? "default"
                                : "outline"
                            }
                            className="rounded-full"
                          >
                            {row.subscription?.status || "n/a"}
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.invoice?.status || "no invoice"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-muted-foreground">
                          {row.nextAction}
                        </td>
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
            <Card className="rounded-lg border-[#dfe4ef] bg-white p-10 text-center text-sm text-muted-foreground">
              Select a project.
            </Card>
          ) : (
            <>
              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl text-[#07102c]">
                      {project.businessName || project.domain}
                    </CardTitle>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {project.user?.email} · {project.subscription?.name}
                    </div>
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
                <CardHeader>
                  <CardTitle className="text-base">Wizard answers</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(project.onboardingAnswers ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-[#dfe4ef] p-3">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{key}</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-[#07102c]">
                        {String(value || "-")}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Pre-deploy design inputs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    className="grid gap-4 rounded-lg border border-[#dfe4ef] bg-muted/20 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveDesignInputs.mutate(new FormData(event.currentTarget));
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="preferredStyle">Preferred style</Label>
                        <Input
                          id="preferredStyle"
                          name="preferredStyle"
                          defaultValue={designInputs.preferredStyle || ""}
                          placeholder="Clean, premium, bold, minimal"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mustHaveSections">Must-have sections</Label>
                        <Input
                          id="mustHaveSections"
                          name="mustHaveSections"
                          defaultValue={designInputs.mustHaveSections || ""}
                          placeholder="Hero, services, gallery, contact"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designBrief">Design requirements</Label>
                      <Textarea
                        id="designBrief"
                        name="designBrief"
                        rows={3}
                        defaultValue={designInputs.designBrief || ""}
                        placeholder="Describe layout, audience, brand feel, competitors, offers, or conversion goals."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contentNotes">Website content</Label>
                      <Textarea
                        id="contentNotes"
                        name="contentNotes"
                        rows={4}
                        defaultValue={designInputs.contentNotes || ""}
                        placeholder="Paste homepage copy, service descriptions, contact details, FAQs, or launch notes."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assets">Reference pictures</Label>
                      <Input id="assets" name="assets" type="file" accept="image/*" multiple />
                      <p className="text-xs text-muted-foreground">
                        Optional. These are saved into the project brief and passed to the basic runtime build flow.
                      </p>
                    </div>
                    {uploadedAssets.length > 0 && (
                      <div className="rounded-lg border border-[#dfe4ef] bg-white p-3">
                        <div className="text-xs font-bold uppercase text-muted-foreground">
                          Uploaded references
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {uploadedAssets.map((asset: any) => (
                            <div key={asset.id || asset.fileName} className="truncate rounded-md bg-muted px-3 py-2 text-xs text-[#07102c]">
                              {asset.fileName || asset.id}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-fit rounded-lg bg-[var(--ai)]"
                      disabled={saveDesignInputs.isPending}
                    >
                      {saveDesignInputs.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Save inputs
                    </Button>
                  </form>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    Provisioning no longer requires design drafts. If no customer-approved design exists,
                    CloudMonkey will create a basic runtime manifest from these inputs and call the n8n
                    basic website flow when configured.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Design drafts</CardTitle>
                </CardHeader>
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
                        <Input
                          id="styleLabel"
                          name="styleLabel"
                          required
                          placeholder="Clean corporate concept"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="image">Draft image</Label>
                        <Input id="image" name="image" type="file" accept="image/*" />
                      </div>
                    </div>
                    <Textarea
                      name="notes"
                      rows={2}
                      placeholder="Internal notes or design rationale"
                    />
                    <Button
                      className="w-fit rounded-lg bg-[var(--ai)]"
                      disabled={uploadDesign.isPending}
                    >
                      {uploadDesign.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload draft
                    </Button>
                  </form>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {(project.designOptions ?? []).map((option: any) => (
                      <div
                        key={option.id}
                        className="overflow-hidden rounded-lg border border-[#dfe4ef]"
                      >
                        {option.imageUrl ? (
                          <img
                            src={option.imageUrl}
                            alt={option.styleLabel}
                            className="aspect-[16/10] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[16/10] items-center justify-center bg-muted">
                            <ImagePlus className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="p-3 text-sm font-semibold text-[#07102c]">
                          {option.styleLabel}
                          {project.selectedDesignOptionId === option.id && (
                            <Badge className="ml-2 rounded-full bg-emerald-600 text-white">
                              Selected
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => actionMutation.mutate("send-design-email")}
                      disabled={actionMutation.isPending || !canSendDesignEmail}
                      title={
                        canSendDesignEmail
                          ? "Send design choices to the customer"
                          : "Upload at least one design draft first"
                      }
                    >
                      <Mail className="h-4 w-4" />
                      Send design email
                    </Button>
                    <Button
                      className="rounded-lg bg-[var(--ai)]"
                      onClick={() => actionMutation.mutate("provision")}
                      disabled={actionMutation.isPending || !canProvision}
                      title={
                        canProvision
                          ? "Provision runtime. If no design is selected, a basic manifest is generated from the project inputs."
                          : "Runtime is already provisioning or running"
                      }
                    >
                      <Rocket className="h-4 w-4" />
                      Provision runtime
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => actionMutation.mutate("send-staging-email")}
                      disabled={actionMutation.isPending || project.containerStatus !== "running"}
                    >
                      <Send className="h-4 w-4" />
                      Send staging
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => actionMutation.mutate("mark-live")}
                      disabled={actionMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark live
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(project.reviewRequests ?? []).length ? (
                    project.reviewRequests.map((review: any) => (
                      <div
                        key={review.id}
                        className="rounded-lg border border-[#dfe4ef] p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[#07102c]">{review.type}</span>
                          <Badge variant="outline" className="rounded-full">
                            {review.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(review.sentAt)}
                        </div>
                        {review.response && (
                          <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
                            {review.response}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No review requests yet.</div>
                  )}
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
