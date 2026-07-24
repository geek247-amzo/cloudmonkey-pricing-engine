import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ReceiptText, Plus, Edit2, Trash2, Tag, Layers, Settings2, RefreshCcw, Search, Save, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAccess } from "@/hooks/use-admin-access";

export const Route = createFileRoute("/dashboard/products")({
  head: () => ({
    meta: [{ title: "Product Management - CloudMonkey Admin" }],
  }),
  component: AdminProductsPage,
});

function billingFrequency(plan: any): "month" | "year" | "once_off" {
  if (["month", "year", "once_off"].includes(plan?.billingFrequency)) return plan.billingFrequency;
  if (plan?.billingType === "once_off") return "once_off";
  const unit = String(plan?.unit ?? "").toLowerCase();
  if (unit.includes("year")) return "year";
  if (unit.includes("once")) return "once_off";
  return "month";
}

function frequencyLabel(plan: any) {
  const frequency = billingFrequency(plan);
  if (frequency === "once_off") return "once off";
  if (frequency === "year") return "per year";
  return "per month";
}

function minimumTermMonths(plan: any) {
  if (typeof plan?.minimumTermMonths === "number") return plan.minimumTermMonths;
  const text = String(plan?.minimumTerm ?? "").toLowerCase();
  if (!text) return "";
  if (text === "monthly" || text === "month") return 1;
  const months = parseInt(text.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(months) || months <= 0) return "";
  return text.includes("year") ? months * 12 : months;
}

function AdminProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authReady, isAdmin } = useAdminAccess();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  useEffect(() => {
    if (authReady && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [authReady, isAdmin, navigate]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin", "products", "full"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: !!isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedPlan: any) => {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        body: JSON.stringify(updatedPlan),
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Failed to update product");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Product updated successfully");
      setEditingPlan(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "full"] });
    },
    onError: () => toast.error("Failed to update product")
  });

  if (!authReady || !isAdmin) return <div className="p-12 text-center">Checking permissions...</div>;

  const filteredProducts = products?.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.service.categoryId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const money = (value?: string | null) => value ? (parseInt(value) / 100).toFixed(2) : "";

  return (
    <div className="space-y-6 relative">
      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl bg-white shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>Edit Product</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setEditingPlan(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[78vh] overflow-y-auto">
              <form 
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateMutation.mutate({
                    id: editingPlan.id,
                    name: formData.get("name"),
                    tagline: formData.get("tagline"),
                    priceZar: formData.get("priceZar"),
                    setupPriceZar: formData.get("setupPriceZar"),
                    billingFrequency: formData.get("billingFrequency"),
                    minimumTermMonths: formData.get("minimumTermMonths"),
                    billingType: formData.get("billingType"),
                    priceLabel: formData.get("priceLabel"),
                    isBundle: formData.get("isBundle") === "on",
                    sortOrder: formData.get("sortOrder"),
                    serviceNote: formData.get("serviceNote"),
                    active: formData.get("active") === "on",
                  });
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input name="name" defaultValue={editingPlan.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={editingPlan.service.categoryId} readOnly />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Tagline / Short Desc</Label>
                    <Input name="tagline" defaultValue={editingPlan.tagline || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly / Product Price (ZAR)</Label>
                    <Input name="priceZar" type="number" step="0.01" defaultValue={money(editingPlan.priceZar)} />
                    <p className="text-[10px] text-muted-foreground">Blank for quote-only products.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Setup Price (ZAR)</Label>
                    <Input name="setupPriceZar" type="number" step="0.01" defaultValue={money(editingPlan.setupPriceZar)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Type</Label>
                    <select name="billingType" defaultValue={editingPlan.billingType || "recurring"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="recurring">Recurring</option>
                      <option value="once_off">Once-off</option>
                      <option value="quote">Quote</option>
                    </select>
                  </div>
	                  <div className="space-y-2">
	                    <Label>Frequency</Label>
	                    <select
	                      name="billingFrequency"
	                      defaultValue={billingFrequency(editingPlan)}
	                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
	                    >
	                      <option value="month">Per month</option>
	                      <option value="year">Per year</option>
	                      <option value="once_off">Once off</option>
	                    </select>
	                  </div>
                  <div className="space-y-2">
                    <Label>Price Label</Label>
                    <Input name="priceLabel" defaultValue={editingPlan.priceLabel || ""} placeholder="Request Quote, Once-off" />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Term (months)</Label>
                    <Input
                      name="minimumTermMonths"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={minimumTermMonths(editingPlan)}
                      placeholder="0 for no fixed term"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort Order</Label>
                    <Input name="sortOrder" type="number" defaultValue={editingPlan.sortOrder ?? 0} />
                  </div>
                  <div className="flex items-center gap-6 pt-8">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name="isBundle" defaultChecked={Boolean(editingPlan.isBundle)} />
                      Bundle flag
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name="active" defaultChecked={editingPlan.active !== false} />
                      Active
                    </label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Product Note</Label>
                    <Textarea name="serviceNote" defaultValue={editingPlan.serviceNote || ""} rows={3} />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-4 bg-[var(--ai)]" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <PageHeader
        eyebrow="Administration"
        title={<>Product & Pricing Management.</>}
        subtitle="Create, edit, and manage all your cloud, business, and AI service offerings from a single console."
        actions={
          <Button className="rounded-xl bg-[var(--ai)] shadow-sm">
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        }
      />

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-border/60 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search products, plans or services..." 
            className="pl-10 h-10 rounded-lg border-border/70"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="rounded-lg border-border/70"><Tag className="h-4 w-4 mr-2" /> Categories</Button>
           <Button variant="outline" size="sm" className="rounded-lg border-border/70"><Layers className="h-4 w-4 mr-2" /> Bundles</Button>
        </div>
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
           <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Full Catalog</CardTitle>
              <Badge variant="outline" className="bg-white">{filteredProducts?.length || 0} Plans</Badge>
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-20 text-center text-muted-foreground">
               <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4" />
               Loading product catalog...
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/10 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Service / Category</th>
                  <th className="px-6 py-4">Plan Name</th>
                  <th className="px-6 py-4">Description / Notes</th>
                  <th className="px-6 py-4">Pricing</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Sort</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts?.map((plan: any) => (
                  <tr key={plan.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                       <div className="font-bold text-[#07102c]">{plan.service.name}</div>
                       <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-tighter">{plan.service.category?.name ?? plan.service.categoryId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{plan.name}</div>
                      {plan.badge && <Badge className="text-[9px] h-4 px-1.5 bg-purple-50 text-purple-700 border-purple-200 mt-1">{plan.badge}</Badge>}
                      {plan.isBundle && <Badge variant="outline" className="ml-1 text-[9px] h-4 px-1.5 mt-1">Bundle</Badge>}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground max-w-[250px]">
                      {plan.tagline}
                      {plan.serviceNote && <div className="mt-1 text-[10px]">{plan.serviceNote}</div>}
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-extrabold text-[#07102c]">
                         {plan.billingType === "quote" ? (plan.priceLabel || "Request Quote") : plan.priceZar ? `R ${(parseInt(plan.priceZar) / 100).toFixed(2)}` : "No price"}
                       </div>
	                       <div className="text-[10px] text-muted-foreground">{plan.billingType || "recurring"} {frequencyLabel(plan)}</div>
                       {plan.setupPriceZar && <div className="text-[10px] text-muted-foreground">Setup R {(parseInt(plan.setupPriceZar) / 100).toFixed(2)}</div>}
                       {(plan.minimumTermMonths || plan.minimumTerm) && (
                         <div className="text-[10px] text-muted-foreground">
                           Minimum term: {plan.minimumTermMonths ? `${plan.minimumTermMonths} month${plan.minimumTermMonths === 1 ? "" : "s"}` : plan.minimumTerm}
                         </div>
                       )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={plan.active === false ? "outline" : "default"} className={plan.active === false ? "bg-gray-50 text-gray-600" : "bg-green-50 text-green-700 border-green-200"}>
                        {plan.active === false ? "Inactive" : "Active"}
                      </Badge>
                      {plan.billingType === "quote" && <Badge variant="outline" className="mt-1 block w-fit">Quote</Badge>}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {plan.sortOrder ?? 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                            onClick={() => setEditingPlan(plan)}
                          >
                             <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted">
                             <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50">
                             <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      
      <div className="grid gap-6 lg:grid-cols-2">
         <Card className="border-border/70 shadow-sm bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(241,234,254,0.5)_100%)]">
            <CardHeader><CardTitle className="text-base">Subscription Summary</CardTitle></CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground mb-4">View how many users are subscribed to each plan.</p>
               <Button variant="outline" className="w-full rounded-xl bg-white shadow-none text-xs">Analyze Subscriptions</Button>
            </CardContent>
         </Card>
         <Card className="border-border/70 shadow-sm bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(230,240,255,0.5)_100%)]">
            <CardHeader><CardTitle className="text-base">Pricing Rules</CardTitle></CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground mb-4">Manage currency conversion rates and dynamic markups (e.g. CloudMonkey VPS + 25%).</p>
               <Button variant="outline" className="w-full rounded-xl bg-white shadow-none text-xs">Edit FX & Markups</Button>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
