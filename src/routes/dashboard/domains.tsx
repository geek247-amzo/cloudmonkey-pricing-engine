import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Globe, ShieldCheck, Zap, Plus, ExternalLink, Settings, RefreshCcw, Search, Trash2, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/domains")({
  head: () => ({
    meta: [{ title: "Domain Management - CloudMonkey Dashboard" }],
  }),
  component: DomainsManagementPage,
});

function DomainsPageContent() {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const { data: domains, isLoading: isLoadingList } = useQuery({
    queryKey: ["user", "domains", "list"],
    queryFn: async () => {
      const res = await fetch("/api/user/domains");
      if (!res.ok) throw new Error("Failed to fetch domains");
      return res.json();
    },
  });

  if (isLoadingList) {
    return <div className="p-12 text-center text-muted-foreground"><RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4" /> Loading domains...</div>;
  }

  if (selectedDomain) {
    return <DomainDetailsView domainName={selectedDomain} onBack={() => setSelectedDomain(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {domains?.map((dom: any) => (
          <Card key={dom.id} className="flex flex-col overflow-hidden border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef8ff] text-[#1381ee]">
                  <Globe className="h-6 w-6" />
                </div>
                <Badge className="rounded-full" variant={dom.status === "active" ? "default" : "outline"}>
                  {dom.status}
                </Badge>
              </div>
              <CardTitle className="mt-4 text-lg font-bold">{dom.id}</CardTitle>
              <div className="text-xs text-muted-foreground">Expires: {dom.expiryDate ? new Date(dom.expiryDate).toLocaleDateString() : "N/A"}</div>
            </CardHeader>
            <CardContent className="pt-6">
              <Button className="w-full rounded-xl bg-[var(--ai)] shadow-sm" onClick={() => setSelectedDomain(dom.id)}>
                <Settings className="h-4 w-4" />
                Manage Domain
              </Button>
            </CardContent>
          </Card>
        ))}

        {!domains?.length && (
           <Card className="border-dashed border-2 bg-transparent p-12 text-center md:col-span-2 xl:col-span-3">
              <div className="mb-1 text-sm font-medium text-muted-foreground">No registered domains found.</div>
              <p className="mb-6 text-xs text-muted-foreground">Assign your existing domains from the global list or register a new one.</p>
              <Link to="/dashboard/domains/new" className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Register New Domain</Link>
           </Card>
        )}
      </div>

      <Outlet />
    </div>
  );
}

function DomainDetailsView({ domainName, onBack }: { domainName: string, onBack: () => void }) {
  const queryClient = useQueryClient();

  const { data: info, isLoading: isLoadingInfo } = useQuery({
    queryKey: ["user", "domains", "info", domainName],
    queryFn: async () => {
      const res = await fetch(`/api/user/domains/info?domain=${domainName}`);
      if (!res.ok) throw new Error("Failed to fetch domain info");
      return res.json();
    },
  });

  const { data: dns, isLoading: isLoadingDns } = useQuery({
    queryKey: ["user", "domains", "dns", domainName],
    queryFn: async () => {
      const res = await fetch(`/api/user/domains/dns?domain=${domainName}`);
      if (!res.ok) throw new Error("Failed to fetch DNS");
      return res.json();
    },
  });

  const addDnsMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`/api/user/domains/dns?domain=${domainName}`, {
        method: "POST",
        body: JSON.stringify(record),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.intReturnCode === 1 || data.intReturnCode === 0) {
        toast.success("DNS record added");
        queryClient.invalidateQueries({ queryKey: ["user", "domains", "dns", domainName] });
      } else {
        toast.error(data.strMessage || "Failed to add record");
      }
    }
  });

  const deleteDnsMutation = useMutation({
    mutationFn: async (dnsId: string) => {
      const res = await fetch(`/api/user/domains/dns?domain=${domainName}&dnsId=${dnsId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: (data) => {
       if (data.intReturnCode === 1 || data.intReturnCode === 0) {
        toast.success("DNS record deleted");
        queryClient.invalidateQueries({ queryKey: ["user", "domains", "dns", domainName] });
      } else {
        toast.error(data.strMessage || "Failed to delete record");
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" className="rounded-lg shadow-none" onClick={onBack}>← Back to list</Button>
        <h2 className="text-2xl font-bold">{domainName}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-border/70 bg-card shadow-sm">
           <CardHeader><CardTitle className="text-base font-bold">Domain Status</CardTitle></CardHeader>
           <CardContent className="space-y-4">
              {isLoadingInfo ? <div className="text-xs text-muted-foreground animate-pulse">Loading API data...</div> : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="default">{info?.strStatus || "Active"}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nameservers</span>
                    <div className="text-right">
                       {info?.arrNameservers?.map((ns: string) => <div key={ns} className="text-xs font-mono">{ns}</div>)}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expiry</span>
                    <span className="font-medium">{info?.intExDate ? new Date(info.intExDate * 1000).toLocaleDateString() : "N/A"}</span>
                  </div>
                </>
              )}
           </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/70 bg-card shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold">DNS Management</CardTitle>
              <DnsAddDialog onAdd={(rec) => addDnsMutation.mutate(rec)} isLoading={addDnsMutation.isPending} />
           </CardHeader>
           <CardContent>
              {isLoadingDns ? <div className="py-8 text-center text-muted-foreground"><RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading records...</div> : (
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                         <tr>
                            <th className="pb-2">Type</th>
                            <th className="pb-2">Name</th>
                            <th className="pb-2">Content</th>
                            <th className="pb-2">TTL</th>
                            <th className="pb-2 text-right">Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {dns?.arrRecords?.map((rec: any) => (
                           <tr key={rec.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                              <td className="py-3 font-bold text-blue-600">{rec.type}</td>
                              <td className="py-3 font-medium">{rec.name}</td>
                              <td className="py-3 text-xs text-muted-foreground truncate max-w-[200px]">{rec.content}</td>
                              <td className="py-3 text-xs">{rec.ttl}</td>
                              <td className="py-3 text-right">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteDnsMutation.mutate(rec.id)}>
                                    <Trash2 className="h-4 w-4" />
                                 </Button>
                              </td>
                           </tr>
                         ))}
                         {!dns?.arrRecords?.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No custom DNS records found. Ensure you are using our Premium Nameservers.</td></tr>}
                      </tbody>
                   </table>
                </div>
              )}
           </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DnsAddDialog({ onAdd, isLoading }: { onAdd: (rec: any) => void, isLoading: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("A");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [ttl, setTtl] = useState("3600");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ type, name, content, ttl: parseInt(ttl) });
    setOpen(false);
    setName(""); setContent("");
  };

  if (!open) return <Button size="sm" className="rounded-lg shadow-none" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Record</Button>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
       <Card className="w-full max-w-md bg-white border-border/70 shadow-2xl">
          <CardHeader><CardTitle>Add DNS Record</CardTitle></CardHeader>
          <CardContent>
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Type</label>
                      <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-md p-2 bg-white">
                         <option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>TXT</option><option>SRV</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">TTL</label>
                      <Input value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="3600" />
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-xs font-bold text-muted-foreground uppercase">Name</label>
                   <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. www" />
                </div>
                <div className="space-y-1">
                   <label className="text-xs font-bold text-muted-foreground uppercase">Content</label>
                   <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="e.g. 1.2.3.4" />
                </div>
                <div className="flex gap-2 pt-2">
                   <Button type="submit" className="flex-1 rounded-xl bg-blue-600" disabled={isLoading}>Save Record</Button>
                   <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
             </form>
          </CardContent>
       </Card>
    </div>
  );
}

function DomainsManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Domains"
        title={<>Domains and DNS Management.</>}
        subtitle="Manage your domain registrations, renewals, and configure DNS records via the live API."
        actions={
          <Button asChild className="rounded-xl bg-[var(--ai)] shadow-sm">
            <Link to="/dashboard/domains/new">
              <Plus className="h-4 w-4" />
              Add domain
            </Link>
          </Button>
        }
      />

      <DomainsPageContent />
    </div>
  );
}
