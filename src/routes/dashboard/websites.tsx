import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarClock,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Server,
  ShoppingCart,
  Store,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/websites")({
  head: () => ({
    meta: [{ title: "Websites & Ecommerce - CloudMonkey Dashboard" }],
  }),
  component: WebsitesRouteShell,
});

type WebsiteRow = {
  id: string;
  domain: string;
  temporaryDomain?: string | null;
  primaryDomain?: string | null;
  siteType?: "website" | "ecommerce";
  name?: string | null;
  businessName?: string | null;
  plan: string;
  status: string;
  aiGenerationStatus?: string;
  containerStatus?: string;
  baseRepo?: string | null;
  trialEndsAt?: string | null;
  store?: {
    id: string;
    status: string;
    database?: {
      engine: string;
      version: string;
      containerName: string;
      databaseName: string;
      username: string;
      volumeName: string;
      status: string;
      backupStatus: string;
    } | null;
  } | null;
  domains?: Array<{ domain: string; type: string; status: string; sslStatus: string }>;
  plugins?: Array<{ pluginKey: string; status: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function WebsitesRouteShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/dashboard/websites") return <Outlet />;
  return <WebsitesPage />;
}

function WebsitesPage() {
  const queryClient = useQueryClient();
  const [createType, setCreateType] = useState<"website" | "ecommerce" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: websitesResponse, isLoading, isError, error: websitesError } = useQuery<WebsiteRow[]>({
    queryKey: ["user", "websites"],
    queryFn: async () => {
      const res = await fetch("/api/user/websites");
      if (res.status === 401) {
        window.location.href = "/auth/sign-in";
        return [];
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to fetch websites");
      return Array.isArray(data) ? data : [];
    },
  });
  const websites = Array.isArray(websitesResponse) ? websitesResponse : [];

  const createWebsite = useMutation({
    mutationFn: async (form: FormData) => {
      setError(null);
      const payload = {
        siteType: createType ?? "website",
        businessName: String(form.get("businessName") ?? ""),
        businessDescription: String(form.get("businessDescription") ?? ""),
        industry: String(form.get("industry") ?? ""),
        targetCustomers: String(form.get("targetCustomers") ?? ""),
        whatsapp: String(form.get("whatsapp") ?? ""),
        email: String(form.get("email") ?? ""),
        preferredSlug: String(form.get("preferredSlug") ?? ""),
        productCount: Number(form.get("productCount") || 0),
        needsInventory: form.get("needsInventory") === "on",
        needsDelivery: form.get("needsDelivery") === "on",
        needsPos: form.get("needsPos") === "on",
      };
      const res = await fetch("/api/user/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create website");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user", "websites"] });
      setCreateType(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Websites + Ecommerce"
        title={<>Websites, stores and runtime databases.</>}
        subtitle="Create AI-ready web properties with an isolated SQL container, trial lifecycle, temp domain and provisioning plan."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl border-border/70 shadow-none" onClick={() => setCreateType("website")}>
              <Globe className="h-4 w-4" />
              Add Website
            </Button>
            <Button className="rounded-xl bg-[var(--ai)] shadow-sm" onClick={() => setCreateType("ecommerce")}>
              <ShoppingCart className="h-4 w-4" />
              Add Ecommerce
            </Button>
          </div>
        }
      />

      {createType && (
        <form
          className="rounded-xl border border-border/70 bg-card/95 p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            createWebsite.mutate(new FormData(event.currentTarget));
          }}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#07102c]">
                New {createType === "ecommerce" ? "ecommerce store" : "website"}
              </div>
              <div className="text-xs text-muted-foreground">
                CloudMonkey will reserve a temp domain and create a dedicated Postgres container plan for this storefront.
              </div>
            </div>
            <Badge variant="outline" className="rounded-full">
              7-day trial
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input id="businessName" name="businessName" required placeholder="Happy Paws Grooming" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" placeholder="Pet grooming and supplies" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredSlug">Temporary domain slug</Label>
              <Input id="preferredSlug" name="preferredSlug" placeholder="happy-paws" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Business email</Label>
              <Input id="email" name="email" type="email" placeholder="hello@example.co.za" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp number</Label>
              <Input id="whatsapp" name="whatsapp" placeholder="+27..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productCount">Estimated products</Label>
              <Input id="productCount" name="productCount" type="number" min="0" defaultValue={createType === "ecommerce" ? 25 : 0} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="targetCustomers">Target customers</Label>
              <Input id="targetCustomers" name="targetCustomers" placeholder="Local families, small businesses, repeat buyers..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="businessDescription">Business description</Label>
              <Textarea id="businessDescription" name="businessDescription" rows={3} placeholder="What the business sells, who it serves and what makes it different." />
            </div>
          </div>

          {createType === "ecommerce" && (
            <div className="mt-4 grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input name="needsInventory" type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                Inventory
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input name="needsDelivery" type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                Delivery
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input name="needsPos" type="checkbox" className="h-4 w-4 rounded border-border" />
                POS
              </label>
            </div>
          )}

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-xl border-border/70 shadow-none" onClick={() => setCreateType(null)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl bg-[var(--ai)] shadow-sm" disabled={createWebsite.isPending}>
              {createWebsite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <Card className="md:col-span-2 xl:col-span-3 border-border/70 bg-card/95 p-20 text-center shadow-sm">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-sm font-medium">Loading your websites...</div>
          </Card>
        ) : isError ? (
          <Card className="md:col-span-2 xl:col-span-3 border-red-200 bg-red-50 p-10 text-center shadow-sm">
            <div className="mb-2 text-sm font-semibold text-red-800">Could not load websites</div>
            <p className="mx-auto mb-5 max-w-md text-xs text-red-700">
              {websitesError instanceof Error ? websitesError.message : "Refresh the page and try again."}
            </p>
            <Button variant="outline" className="rounded-xl border-red-200 bg-white" onClick={() => queryClient.invalidateQueries({ queryKey: ["user", "websites"] })}>
              Retry
            </Button>
          </Card>
        ) : websites.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed border-2 bg-transparent p-12 text-center">
            <div className="mb-1 text-sm font-medium text-muted-foreground">No websites or stores yet.</div>
            <p className="mx-auto mb-6 max-w-md text-xs text-muted-foreground">
              Create a website or ecommerce store to reserve a CloudMonkey temp domain and a dedicated SQL container.
            </p>
            <Button className="rounded-xl bg-[var(--ai)] shadow-sm" onClick={() => setCreateType("ecommerce")}>
              <ShoppingCart className="h-4 w-4" />
              Start Ecommerce
            </Button>
          </Card>
        ) : (
          websites.map((site) => {
            const domain = site.primaryDomain || site.temporaryDomain || site.domain;
            const database = site.store?.database;
            return (
              <Card key={site.id} className="flex flex-col overflow-hidden border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="border-b border-border/60 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e6f0ff] text-[#1381ee]">
                      {site.siteType === "ecommerce" ? <Store className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                    </div>
                    <Badge className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                      {site.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-lg font-bold">{site.businessName || site.name || domain}</CardTitle>
                  <div className="text-xs text-muted-foreground">{domain}</div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</div>
                        <div className="text-sm font-semibold capitalize">{site.siteType || "website"}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trial ends</div>
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(site.trialEndsAt)}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Container</div>
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          <Server className="h-3.5 w-3.5 text-muted-foreground" />
                          {site.containerStatus || "not_provisioned"}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI</div>
                        <div className="text-sm font-semibold">{site.aiGenerationStatus || "not_started"}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Database className="h-4 w-4 text-[#1381ee]" />
                        Dedicated SQL container
                      </div>
                      {database ? (
                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <div className="flex justify-between gap-3">
                            <span>Container</span>
                            <span className="truncate font-mono text-foreground">{database.containerName}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Database</span>
                            <span className="truncate font-mono text-foreground">{database.databaseName}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Status</span>
                            <span className="font-medium text-foreground">{database.status}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Database plan pending.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button asChild variant="outline" className="flex-1 rounded-xl border-border/70 shadow-none text-xs">
                      <Link to="/dashboard/websites/$websiteId" params={{ websiteId: site.id }}>
                      Manage
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="icon" className="rounded-xl border-border/70 shadow-none">
                      <a href={`https://${domain}`} target="_blank" rel="noreferrer" aria-label="Open website">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
