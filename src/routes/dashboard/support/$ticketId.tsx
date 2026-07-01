import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, CreditCard, Globe, MessageSquareText, Server, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/support/$ticketId")({
  head: () => ({
    meta: [{ title: "Support ticket - CloudMonkey Dashboard" }],
  }),
  component: TicketDetailPage,
});

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const ticketBasePath = isAdmin ? `/api/admin/tickets/${ticketId}` : `/api/user/tickets/${ticketId}`;
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: [isAdmin ? "admin" : "user", "tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(ticketBasePath);
      if (!res.ok) throw new Error("Failed to fetch ticket");
      return res.json();
    },
    enabled: !isPending,
  });

  const { data: crmContext } = useQuery({
    queryKey: ["admin", "users", ticket?.userId, "support-context"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${ticket.userId}`);
      if (!res.ok) throw new Error("Failed to fetch customer context");
      return res.json();
    },
    enabled: isAdmin && !!ticket?.userId,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await fetch(ticketBasePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update ticket");
      return body;
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${ticketBasePath}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment, isInternal: isAdmin && isInternal }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      setIsInternal(false);
      toast.success("Comment added");
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "tickets", ticketId] });
    },
    onError: () => toast.error("Could not add comment"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support detail"
        title={isLoading ? <>Loading ticket...</> : <>{ticket?.subject || ticketId}</>}
        subtitle={ticket?.user?.email || "Ticket activity and comments."}
        actions={
          <Button asChild className="rounded-lg bg-[var(--ai)]">
            <Link to="/dashboard/support">
              Back to support
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {ticket && (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Case details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{ticket.description || "No description provided."}</p>
              <div className="flex flex-wrap gap-2">
                <Badge>{ticket.priority}</Badge>
                <Badge variant={ticket.status === "resolved" ? "secondary" : "outline"}>{ticket.status}</Badge>
                <Badge variant="outline">{ticket.category}</Badge>
                <Badge variant="outline">{ticket.source ?? "manual"}</Badge>
              </div>
              {isAdmin && (
                <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                  <select value={ticket.status} onChange={(event) => updateMutation.mutate({ status: event.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select value={ticket.priority} onChange={(event) => updateMutation.mutate({ priority: event.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select value={ticket.category} onChange={(event) => updateMutation.mutate({ category: event.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
                    <option value="general">General</option>
                    <option value="billing">Billing</option>
                    <option value="domains">Domains</option>
                    <option value="hosting">Hosting</option>
                    <option value="websites">Websites</option>
                    <option value="support">Support</option>
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!ticket.comments?.length ? (
                <div className="text-sm text-muted-foreground">No comments have been added.</div>
              ) : ticket.comments.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Clock3 className="mt-0.5 h-4 w-4 text-[var(--ai)]" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isInternal && <Badge variant="outline">Internal</Badge>}
                      <div className="text-sm text-foreground">{item.body}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  commentMutation.mutate();
                }}
              >
                <Textarea value={comment} onChange={(event) => setComment(event.target.value)} required />
                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
                    Internal note
                  </label>
                )}
                <Button type="submit" className="rounded-lg bg-[var(--ai)]" disabled={commentMutation.isPending}>
                  <MessageSquareText className="h-4 w-4" />
                  Add comment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isAdmin && crmContext && (
        <div className="grid gap-4 xl:grid-cols-4">
          <ContextCard icon={UserRound} title="Customer" value={crmContext.user?.email ?? "Unknown"} detail={crmContext.user?.name ?? "No name"} />
          <ContextCard icon={CreditCard} title="Invoices" value={String(crmContext.invoices?.filter((item: any) => item.status !== "void").length ?? 0)} detail={`${crmContext.subscriptions?.length ?? 0} subscriptions`} />
          <ContextCard icon={Globe} title="Domains" value={String(crmContext.domains?.length ?? 0)} detail={`${crmContext.websites?.length ?? 0} websites`} />
          <ContextCard icon={Server} title="Servers" value={String(crmContext.servers?.length ?? 0)} detail={`${crmContext.agents?.length ?? 0} agents`} />
        </div>
      )}
    </div>
  );
}

function ContextCard({ icon: Icon, title, value, detail }: { icon: any; title: string; value: string; detail: string }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-2 truncate text-lg font-bold text-[#07102c]">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
          </div>
          <Icon className="h-5 w-5 text-[var(--ai)]" />
        </div>
      </CardContent>
    </Card>
  );
}
