import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Box,
  CalendarClock,
  CheckCircle2,
  Database,
  Eye,
  ExternalLink,
  Image,
  Loader2,
  PackagePlus,
  Pencil,
  Plug,
  ReceiptText,
  Rocket,
  Server,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/websites/$websiteId")({
  head: () => ({
    meta: [{ title: "Manage Website - CloudMonkey Dashboard" }],
  }),
  component: WebsiteManagePage,
});

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format((cents || 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

async function readImageValue(form: FormData) {
  const file = form.get("imageFile");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
    if (file.size > 6 * 1024 * 1024) throw new Error("Product images must be 6 MB or smaller");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read product image"));
      reader.readAsDataURL(file);
    });
  }
  return String(form.get("imageUrl") ?? "").trim();
}

function WebsiteManagePage() {
  const { websiteId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const { authReady, isAdmin } = useAdminAccess();

  const { data: site, isLoading } = useQuery({
    queryKey: [isAdmin ? "admin" : "user", "websites", websiteId],
    queryFn: async () => {
      const path = isAdmin ? `/api/admin/website-projects/${websiteId}` : `/api/user/websites/${websiteId}`;
      const res = await fetch(path);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load website");
      return data;
    },
    enabled: authReady,
  });

  const addProduct = useMutation({
    mutationFn: async (form: FormData) => {
      const payload = {
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        sku: String(form.get("sku") ?? ""),
        price: Number(form.get("price") || 0),
        inventoryQuantity: Number(form.get("inventoryQuantity") || 0),
        imageUrl: await readImageValue(form),
        status: String(form.get("status") ?? "active"),
        trackInventory: true,
      };
      const res = await fetch(`/api/user/websites/${websiteId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add product");
      return data;
    },
    onSuccess: async () => {
      toast.success("Product added");
      setShowProductForm(false);
      await queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "websites", websiteId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ productId, form }: { productId: string; form: FormData }) => {
      const payload = {
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        sku: String(form.get("sku") ?? ""),
        price: Number(form.get("price") || 0),
        inventoryQuantity: Number(form.get("inventoryQuantity") || 0),
        imageUrl: await readImageValue(form),
        status: String(form.get("status") ?? "active"),
        trackInventory: true,
      };
      const res = await fetch(`/api/user/websites/${websiteId}/products/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to update product");
      return data;
    },
    onSuccess: async () => {
      toast.success("Product updated");
      setEditingProduct(null);
      await queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "websites", websiteId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateDesigns = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/user/websites/${websiteId}/design-options/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate design previews");
      return data;
    },
    onSuccess: async () => {
      toast.success("Design previews generated");
      await queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "websites", websiteId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectDesign = useMutation({
    mutationFn: async (designOptionId: string) => {
      const res = await fetch(`/api/user/websites/${websiteId}/design-options/${designOptionId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to select design");
      return data;
    },
    onSuccess: async () => {
      toast.success("Design selected");
      await queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "websites", websiteId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const provisionWebsite = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/user/websites/${websiteId}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to provision website");
      return data;
    },
    onSuccess: async (data: any) => {
      toast.success("Storefront container started");
      await queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "websites", websiteId] });
      if (data?.runtime?.publicUrl) window.open(data.runtime.publicUrl, "_blank");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (pathname.endsWith("/growth")) return <Outlet />;

  const openPreview = (option: any) => {
    if (!option.imageUrl) {
      toast.error("Preview image is not available");
      return;
    }
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      toast.error("Your browser blocked the preview window");
      return;
    }
    previewWindow.opener = null;
    const title = option.styleLabel || "Website preview";
    const safeTitle = String(title).replace(/[&<>"']/g, "");
    previewWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <style>
            body { margin: 0; background: #111827; font-family: Arial, sans-serif; }
            header { position: sticky; top: 0; padding: 12px 18px; background: #ffffff; color: #111827; font-weight: 800; box-shadow: 0 1px 8px rgba(0,0,0,.18); }
            img { display: block; width: min(1200px, 100%); height: auto; margin: 0 auto; background: #ffffff; }
          </style>
        </head>
        <body>
          <header>${safeTitle}</header>
          <img src="${option.imageUrl}" alt="${safeTitle}" />
        </body>
      </html>`);
    previewWindow.document.close();
  };

  if (!authReady || isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
        Loading website...
      </div>
    );
  }

  if (!site) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/dashboard/websites">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card className="border-border/70 p-10 text-center">Website not found.</Card>
      </div>
    );
  }

  const domain = site.primaryDomain || site.temporaryDomain || site.domain;
  const database = site.store?.database;
  const products = site.products ?? [];
  const orders = site.orders ?? [];
  const plugins = site.plugins ?? [];
  const medusaPlan = site.provisioningPlan?.services?.medusa;
  const commerceEngine = site.siteType === "ecommerce" ? (site.provisioningPlan?.commerceEngine || "medusa") : "website";
  const designOptions = site.designOptions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Manager"
        title={<>{site.businessName || site.name || domain}</>}
        subtitle={domain}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl border-border/70 shadow-none">
              <Link to="/dashboard/websites">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button asChild className="rounded-xl bg-[var(--ai)] shadow-sm">
              <a href={`${site.containerStatus === "running" ? "http" : "https"}://${domain}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-[var(--ai)] text-[var(--ai)] shadow-none">
              <Link to="/dashboard/websites/$websiteId/growth" params={{ websiteId }}>
                <Sparkles className="h-4 w-4" />
                Growth agent
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <ShoppingBag className="h-4 w-4" />
              Products
            </div>
            <div className="text-2xl font-bold text-[#07102c]">{products.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <ReceiptText className="h-4 w-4" />
              Orders
            </div>
            <div className="text-2xl font-bold text-[#07102c]">{orders.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <Server className="h-4 w-4" />
              Runtime
            </div>
            <div className="text-sm font-bold text-[#07102c]">{site.containerStatus || "not_provisioned"}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              Trial Ends
            </div>
            <div className="text-sm font-bold text-[#07102c]">{formatDate(site.trialEndsAt)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-base">
                <Image className="h-4 w-4 text-[#1381ee]" />
                Design Previews
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {designOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                  CloudMonkey will upload design drafts here for your approval.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {designOptions.map((option: any) => (
                    <div key={option.id} className="overflow-hidden rounded-lg border border-border/70 bg-white">
                      {option.imageUrl ? (
                        <img src={option.imageUrl} alt={option.styleLabel} className="aspect-[16/10] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[16/10] items-center justify-center bg-muted text-sm text-muted-foreground">Preview unavailable</div>
                      )}
                      <div className="flex items-center justify-between gap-3 p-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#07102c]">
                            {option.styleLabel}
                            {site.selectedDesignOptionId === option.id && (
                              <Badge className="rounded-full bg-emerald-600 text-[10px] text-white">Selected</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{option.promptVersion || "design-preview"}</div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => openPreview(option)}>
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl bg-[var(--ai)]"
                            onClick={() => selectDesign.mutate(option.id)}
                            disabled={selectDesign.isPending || site.selectedDesignOptionId === option.id}
                          >
                            {selectDesign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {site.selectedDesignOptionId === option.id ? "Selected" : "Select"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
              <CardTitle className="text-base">Products</CardTitle>
              {site.siteType === "ecommerce" && (
                <Button size="sm" className="rounded-xl bg-[var(--ai)]" onClick={() => setShowProductForm((value) => !value)}>
                  <PackagePlus className="h-4 w-4" />
                  Add Product
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {showProductForm && (
                <form
                  className="grid gap-4 border-b border-border/60 bg-muted/20 p-5 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addProduct.mutate(new FormData(event.currentTarget));
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="title">Product title</Label>
                    <Input id="title" name="title" required placeholder="Car wash kit" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input id="sku" name="sku" placeholder="SKU-001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input id="price" name="price" type="number" min="0" step="0.01" required placeholder="199.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inventoryQuantity">Stock</Label>
                    <Input id="inventoryQuantity" name="inventoryQuantity" type="number" min="0" defaultValue="0" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="imageUrl">Product image</Label>
                    <Input id="imageUrl" name="imageUrl" type="text" placeholder="https://… or /ketiwe/assets/product.png" />
                    <Input id="imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
                    <p className="text-xs text-muted-foreground">Use an image URL or upload an image. Uploaded images are stored with the Medusa product.</p>
                  </div>
                  <input type="hidden" name="status" value="active" />
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={3} placeholder="Short product description" />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowProductForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-xl bg-[var(--ai)]" disabled={addProduct.isPending}>
                      {addProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                      Save Product
                    </Button>
                  </div>
                </form>
              )}

              {editingProduct && (
                <form
                  className="grid gap-4 border-b border-border/60 bg-[#f6f8ff] p-5 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateProduct.mutate({ productId: editingProduct.id, form: new FormData(event.currentTarget) });
                  }}
                >
                  <div className="md:col-span-2 flex items-center justify-between">
                    <div className="font-semibold">Edit {editingProduct.title}</div>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingProduct(null)}>Cancel</Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Product title</Label>
                    <Input id="edit-title" name="title" required defaultValue={editingProduct.title} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU</Label>
                    <Input id="edit-sku" name="sku" defaultValue={editingProduct.sku || editingProduct.variants?.[0]?.sku || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Price (ZAR)</Label>
                    <Input id="edit-price" name="price" type="number" min="0" step="0.01" required defaultValue={((editingProduct.price || 0) / 100).toFixed(2)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-inventoryQuantity">Stock</Label>
                    <Input id="edit-inventoryQuantity" name="inventoryQuantity" type="number" min="0" defaultValue={editingProduct.variants?.[0]?.inventoryQuantity ?? 0} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-imageUrl">Product image</Label>
                    <Input id="edit-imageUrl" name="imageUrl" type="text" defaultValue={editingProduct.image_url || ""} placeholder="https://… or /ketiwe/assets/product.png" />
                    <Input id="edit-imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
                    <p className="text-xs text-muted-foreground">Upload a new image to replace the current image, or edit the image URL.</p>
                  </div>
                  <input type="hidden" name="description" value={editingProduct.description || ""} />
                  <input type="hidden" name="status" value={editingProduct.status === "draft" ? "draft" : "active"} />
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" className="rounded-xl bg-[var(--ai)]" disabled={updateProduct.isPending}>
                      {updateProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                      Save changes
                    </Button>
                  </div>
                </form>
              )}

              {products.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No products yet. Add your first product to start building the store catalogue.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Product</th>
                        <th className="px-5 py-3">Image</th>
                        <th className="px-5 py-3">SKU</th>
                        <th className="px-5 py-3">Price</th>
                        <th className="px-5 py-3">Stock</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product: any) => {
                        const variant = product.variants?.[0];
                        return (
                          <tr key={product.id} className="border-b border-border/40 last:border-0">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-[#07102c]">{product.title}</div>
                              <div className="max-w-lg truncate text-xs text-muted-foreground">{product.description || "No description"}</div>
                            </td>
                            <td className="px-5 py-4">
                              {product.image_url ? (
                                <img src={product.image_url} alt="" className="h-12 w-12 rounded-lg border border-border/60 object-cover" />
                              ) : (
                                <span className="text-xs text-muted-foreground">No image</span>
                              )}
                            </td>
                            <td className="px-5 py-4 font-mono text-xs">{product.sku || variant?.sku || "-"}</td>
                            <td className="px-5 py-4 font-semibold">{money(product.price)}</td>
                            <td className="px-5 py-4">{variant?.inventoryQuantity ?? 0}</td>
                            <td className="px-5 py-4">
                              <Badge variant="outline" className="rounded-full capitalize">{product.status}</Badge>
                            </td>
                            <td className="px-5 py-4">
                              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingProduct(product)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Orders will appear here after checkout is connected and the storefront is provisioned.
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-[#1381ee]" />
                Dedicated SQL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm">
              {database ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Container</span>
                    <span className="truncate font-mono">{database.containerName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Database</span>
                    <span className="truncate font-mono">{database.databaseName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="truncate font-mono">{database.volumeName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="rounded-full">{database.status}</Badge>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">Database plan pending.</div>
              )}
            </CardContent>
          </Card>

          {site.siteType === "ecommerce" && (
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-4 w-4 text-[#1381ee]" />
                  Commerce Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Backend</span>
                  <Badge variant="outline" className="rounded-full capitalize">{commerceEngine}</Badge>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Medusa container</span>
                  <span className="truncate font-mono">{site.provisioningPlan?.medusaContainerName || medusaPlan?.containerName || "planned"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Redis</span>
                  <span className="truncate font-mono">{medusaPlan?.redis?.prefix || "shared runtime Redis"}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="h-4 w-4 text-[#1381ee]" />
                Plugins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {plugins.length === 0 ? (
                <div className="text-sm text-muted-foreground">No plugins planned yet.</div>
              ) : (
                plugins.map((plugin: any) => (
                  <div key={plugin.id || plugin.pluginKey} className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      {plugin.pluginKey}
                    </div>
                    <Badge variant="outline" className="rounded-full">{plugin.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-[#1381ee]" />
                Provisioning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
              <div>Current state: <span className="font-semibold text-foreground">{site.containerStatus || "not_provisioned"}</span></div>
              <div>AI state: <span className="font-semibold text-foreground">{site.aiGenerationStatus || "not_started"}</span></div>
              <div>Base repo: <span className="font-mono text-foreground">{site.baseRepo || "pending"}</span></div>
              {site.containerStatus === "running" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                  Storefront is running. Temporary domains currently use HTTP until a wildcard SSL certificate is added.
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  CloudMonkey will provision the runtime after your design approval.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
