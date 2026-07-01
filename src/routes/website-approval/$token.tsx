import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageSquare, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/website-approval/$token")({
  head: () => ({
    meta: [{ title: "Website Approval - CloudMonkey" }],
  }),
  component: WebsiteApprovalPage,
});

async function fetchJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}

function WebsiteApprovalPage() {
  const { token } = Route.useParams();
  const [selectedDesignId, setSelectedDesignId] = useState<string>("");
  const [comments, setComments] = useState("");

  const approval = useQuery({
    queryKey: ["website-approval", token],
    queryFn: () => fetchJson<any>(`/api/public/website-approvals/${encodeURIComponent(token)}`),
  });
  const site = approval.data?.website;
  const isDesign = approval.data?.token?.actionType === "design_approval";
  const designOptions = site?.designOptions ?? [];
  const chosenDesignId = selectedDesignId || designOptions[0]?.id || "";

  const respond = useMutation({
    mutationFn: async (action: "approve" | "changes_requested") => fetchJson(`/api/public/website-approvals/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, designOptionId: isDesign ? chosenDesignId : undefined, comments }),
    }),
    onSuccess: () => {
      toast.success("Response submitted");
      approval.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (approval.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]"><Loader2 className="h-8 w-8 animate-spin text-[var(--ai)]" /></div>;
  }

  if (approval.isError || !approval.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] p-4">
        <Card className="max-w-lg rounded-lg border-[#dfe4ef] bg-white text-center shadow-sm">
          <CardContent className="p-8">
            <XCircle className="mx-auto mb-4 h-10 w-10 text-red-600" />
            <div className="font-bold text-[#07102c]">{approval.error?.message ?? "Approval link unavailable"}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-2xl text-[#07102c]">{site.businessName || site.domain}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">{site.temporaryDomain || site.domain}</p>
              </div>
              <Badge className="w-fit rounded-lg bg-[#efe7ff] text-[#5d2fe8]">{isDesign ? "Design approval" : "Staging review"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {isDesign ? (
              <div className="grid gap-4 md:grid-cols-2">
                {designOptions.map((option: any) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`overflow-hidden rounded-lg border bg-white text-left ${chosenDesignId === option.id ? "border-[var(--ai)] ring-2 ring-[var(--ai)]/20" : "border-[#dfe4ef]"}`}
                    onClick={() => setSelectedDesignId(option.id)}
                  >
                    {option.imageUrl ? (
                      <img src={option.imageUrl} alt={option.styleLabel} className="aspect-[16/10] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center bg-muted text-sm text-muted-foreground">Preview unavailable</div>
                    )}
                    <div className="p-3 font-semibold text-[#07102c]">{option.styleLabel}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-[#dfe4ef] bg-muted/20 p-5">
                <div className="text-sm font-semibold text-[#07102c]">Staging URL</div>
                <a className="mt-1 inline-flex text-sm font-medium text-[var(--ai)]" href={`https://${site.primaryDomain || site.temporaryDomain || site.domain}`} target="_blank" rel="noreferrer">
                  {site.primaryDomain || site.temporaryDomain || site.domain}
                </a>
              </div>
            )}

            <Textarea value={comments} rows={4} onChange={(event) => setComments(event.target.value)} placeholder="Optional comments or edit notes" />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-lg" onClick={() => respond.mutate("changes_requested")} disabled={respond.isPending}>
                <MessageSquare className="h-4 w-4" />
                Request edits
              </Button>
              <Button className="rounded-lg bg-[var(--ai)]" onClick={() => respond.mutate("approve")} disabled={respond.isPending || (isDesign && !chosenDesignId)}>
                {respond.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
        <Button asChild variant="outline" className="rounded-lg">
          <Link to="/dashboard/websites">Open dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
